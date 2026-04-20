import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireStaffRole } from "./middleware/auth.js";
import { getAllAgents, getAgentByPropertyId, createAgent, updateAgent, upsertAgent } from "./storage.js";
import { assertPropertyInTenant, PropertyScopeError } from "./helpers/tenant-scope.js";
import { db } from "./db.js";
import { agents } from "../shared/schema.js";

const router = Router();

router.get("/", requireStaffRole("superadmin"), async (_req: Request, res: Response) => {
  try {
    res.json(await getAllAgents());
  } catch (err) {
    res.status(500).json({ message: "Error fetching agents" });
  }
});

router.get("/by-property/:propertyId", requireStaffRole("superadmin", "owner", "manager"), async (req: Request, res: Response) => {
  try {
    const agent = await getAgentByPropertyId(req.params["propertyId"] as string);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ message: "Error fetching agent" });
  }
});

router.post("/", requireStaffRole("superadmin", "owner"), async (req: Request, res: Response) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const { propertyId, tenantId, name, emoji, tagline, greeting, personality } = req.body;
    if (!propertyId) return res.status(400).json({ message: "propertyId required" });
    if (!isSuperadmin) {
      if (!sess.staffTenantId) return res.status(400).json({ message: "Session has no tenant" });
      try {
        await assertPropertyInTenant(propertyId, sess.staffTenantId);
      } catch (err) {
        if (err instanceof PropertyScopeError) return res.status(403).json({ message: "propertyId outside tenant scope" });
        throw err;
      }
    }
    const agent = await createAgent({
      propertyId,
      tenantId: isSuperadmin ? (tenantId ?? null) : sess.staffTenantId,
      name: name ?? "LIRE Agent",
      emoji: emoji ?? "LH",
      tagline: tagline ?? null,
      greeting: greeting ?? null,
      personality: personality ?? null,
    });
    res.status(201).json(agent);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: "Agent already exists for this property" });
    console.error("[agent create]", err);
    res.status(500).json({ message: "Error creating agent" });
  }
});

router.put("/by-property/:propertyId", requireStaffRole("superadmin", "owner"), async (req: Request, res: Response) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    if (!isSuperadmin) {
      if (!sess.staffTenantId) return res.status(400).json({ message: "Session has no tenant" });
      try {
        await assertPropertyInTenant(req.params["propertyId"] as string, sess.staffTenantId);
      } catch (err) {
        if (err instanceof PropertyScopeError) return res.status(403).json({ message: "propertyId outside tenant scope" });
        throw err;
      }
    }
    const { name, emoji, tagline, greeting, personality, tenantId } = req.body;
    const agent = await upsertAgent(req.params["propertyId"] as string, {
      name,
      emoji,
      tagline,
      greeting,
      personality,
      tenantId: isSuperadmin ? (tenantId ?? undefined) : undefined,
    });
    res.json(agent);
  } catch (err) {
    console.error("[agent upsert]", err);
    res.status(500).json({ message: "Error updating agent" });
  }
});

router.put("/:id", requireStaffRole("superadmin", "owner"), async (req: Request, res: Response) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    if (!isSuperadmin) {
      if (!sess.staffTenantId) return res.status(400).json({ message: "Session has no tenant" });
      const [row] = await db.select({ propertyId: agents.propertyId })
        .from(agents)
        .where(eq(agents.id, req.params["id"] as string))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Agent not found" });
      try {
        await assertPropertyInTenant(row.propertyId, sess.staffTenantId);
      } catch (err) {
        if (err instanceof PropertyScopeError) return res.status(403).json({ message: "agent outside tenant scope" });
        throw err;
      }
    }
    const { name, emoji, tagline, greeting, personality, isActive } = req.body;
    const agent = await updateAgent(req.params["id"] as string, { name, emoji, tagline, greeting, personality, isActive });
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  } catch (err) {
    console.error("[agent update]", err);
    res.status(500).json({ message: "Error updating agent" });
  }
});

export default router;
