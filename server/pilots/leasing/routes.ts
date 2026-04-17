import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db.js";
import { deals, dealEvents, properties, tours, units, unitSheets } from "../../../shared/schema.js";
import { insertDealSchema, insertDealEventSchema, insertTourSchema } from "../../../shared/schema.js";
import { requireStaff } from "../../middleware/auth.js";
import { loadTenantYaml } from "../tenant-config.js";
import { draftTourRecap } from "./claude-recap.js";
import { syncPropertyUnits } from "./yardi-sync.js";

type LeasingConfig = {
  pipeline: {
    stages: Array<{ key: string; label: string; stuck_after_days: number | null }>;
  };
};

const router = Router();
router.use(requireStaff);

function getTenantContext(req: Request) {
  const sess = req.session as any;
  return {
    tenantId: sess?.staffTenantId as string | null | undefined,
    tenantSlug: sess?.staffTenantSlug as string | null | undefined,
    staffId: sess?.staffId as string | null | undefined,
  };
}

router.get("/config", async (req: Request, res: Response) => {
  const { tenantSlug } = getTenantContext(req);
  if (!tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  try {
    const cfg = await loadTenantYaml<LeasingConfig>(tenantSlug, "leasing.yaml");
    return res.json(cfg);
  } catch (err) {
    console.error("[leasing config]", err);
    return res.status(404).json({ message: "Leasing config not found for tenant" });
  }
});

router.get("/units", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const propertyId = typeof req.query["propertyId"] === "string" ? req.query["propertyId"] : null;

  const rows = await db
    .select()
    .from(units)
    .where(
      propertyId
        ? and(eq(units.tenantId, tenantId), eq(units.propertyId, propertyId))
        : eq(units.tenantId, tenantId),
    )
    .orderBy(desc(units.updatedAt));

  return res.json({ units: rows });
});

router.get("/deals", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const stage = typeof req.query["stage"] === "string" ? req.query["stage"] : null;

  const rows = await db
    .select()
    .from(deals)
    .where(stage ? and(eq(deals.tenantId, tenantId), eq(deals.stage, stage)) : eq(deals.tenantId, tenantId))
    .orderBy(desc(deals.lastActivityAt));

  return res.json({ deals: rows });
});

router.post("/deals", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertDealSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid deal payload", issues: parsed.error.issues });

  const [row] = await db.insert(deals).values(parsed.data).returning();
  return res.status(201).json({ deal: row });
});

router.post("/deals/:dealId/events", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const dealId = req.params["dealId"] as string;

  const parsed = insertDealEventSchema.safeParse({ ...req.body, tenantId, dealId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid event payload", issues: parsed.error.issues });

  const [row] = await db.insert(dealEvents).values(parsed.data).returning();
  await db
    .update(deals)
    .set({ lastActivityAt: new Date() })
    .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));
  return res.status(201).json({ event: row });
});

router.post("/tours", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const parsed = insertTourSchema.safeParse({ ...req.body, tenantId });
  if (!parsed.success) return res.status(400).json({ message: "Invalid tour payload", issues: parsed.error.issues });
  const [row] = await db.insert(tours).values(parsed.data).returning();
  return res.status(201).json({ tour: row });
});

router.post("/tours/:tourId/recap", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) return res.status(400).json({ message: "Missing tenant context" });
  const tourId = req.params["tourId"] as string;

  const [tour] = await db
    .select()
    .from(tours)
    .where(and(eq(tours.id, tourId), eq(tours.tenantId, tenantId)))
    .limit(1);
  if (!tour) return res.status(404).json({ message: "Tour not found" });
  if (!tour.brokerNotesRaw) return res.status(400).json({ message: "Tour has no broker notes yet" });

  const [deal] = await db.select().from(deals).where(eq(deals.id, tour.dealId)).limit(1);
  const [unit] = tour.unitId
    ? await db.select().from(units).where(eq(units.id, tour.unitId)).limit(1)
    : [null];

  try {
    const result = await draftTourRecap({
      tenantId,
      prospectCompany: deal?.prospectCompany ?? "Unknown prospect",
      unitLabel: unit?.label ?? null,
      brokerNotes: tour.brokerNotesRaw,
    });
    const [updated] = await db
      .update(tours)
      .set({ aiRecap: result.recap, aiRecapModel: result.model, updatedAt: new Date() })
      .where(eq(tours.id, tourId))
      .returning();
    return res.json({ tour: updated });
  } catch (err) {
    console.error("[leasing tour recap]", err);
    return res.status(502).json({ message: "Recap draft failed" });
  }
});

router.post("/properties/:propertyId/sync", async (req: Request, res: Response) => {
  const { tenantId, tenantSlug } = getTenantContext(req);
  if (!tenantId || !tenantSlug) return res.status(400).json({ message: "Missing tenant context" });
  const propertyId = req.params["propertyId"] as string;

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
    .limit(1);
  if (!property) return res.status(404).json({ message: "Property not found" });

  const externalId =
    typeof req.body?.propertyExternalId === "string" && req.body.propertyExternalId.trim().length > 0
      ? req.body.propertyExternalId
      : property.slug;

  try {
    const result = await syncPropertyUnits({
      tenantId,
      tenantSlug,
      propertyId,
      propertyExternalId: externalId,
    });
    return res.json({ result });
  } catch (err) {
    console.error("[leasing yardi sync]", err);
    return res.status(502).json({ message: "Yardi sync failed" });
  }
});

router.get("/unit-sheets/:shareToken", async (req: Request, res: Response) => {
  const shareToken = req.params["shareToken"] as string;
  const [row] = await db.select().from(unitSheets).where(eq(unitSheets.shareToken, shareToken)).limit(1);
  if (!row) return res.status(404).json({ message: "Unit sheet not found" });
  return res.json({ unitSheet: row });
});

export default router;
