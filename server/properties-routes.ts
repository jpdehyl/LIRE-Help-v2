import { Router } from "express";
import { requireAdmin, requireStaffRole } from "./middleware/auth.js";
import { getTenants, createTenant, getProperties, createProperty, updateProperty } from "./storage.js";
import { insertPropertySchema, insertTenantSchema } from "../shared/schema.js";
import { assertPropertyInTenant, PropertyScopeError } from "./helpers/tenant-scope.js";
import { z } from "zod";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const tenantId = (req.session as any)?.staffTenantId ?? null;
    const data = await getProperties(tenantId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching properties" });
  }
});

router.get("/tenants", requireStaffRole("superadmin"), async (_req, res) => {
  try {
    res.json(await getTenants());
  } catch {
    res.status(500).json({ message: "Error fetching tenants" });
  }
});

router.post("/tenants", requireStaffRole("superadmin"), async (req, res) => {
  try {
    const data = insertTenantSchema.parse(req.body);
    const tenant = await createTenant(data);
    res.status(201).json(tenant);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
    res.status(500).json({ message: "Error creating tenant" });
  }
});

router.post("/", requireStaffRole("superadmin", "owner"), async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const raw = insertPropertySchema.parse(req.body);
    const data = isSuperadmin ? raw : { ...raw, tenantId: sess.staffTenantId ?? null };
    if (!isSuperadmin && !data.tenantId) return res.status(400).json({ message: "Session has no tenant" });
    const prop = await createProperty(data);
    res.status(201).json(prop);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
    console.error("[property create]", err);
    res.status(500).json({ message: "Error creating property" });
  }
});

router.put("/:id", requireStaffRole("superadmin", "owner"), async (req, res) => {
  try {
    const sess = req.session as any;
    const isSuperadmin = sess.staffRole === "superadmin";
    const parsed = insertPropertySchema.partial().parse(req.body);
    const data = isSuperadmin ? parsed : (() => {
      const { tenantId: _drop, ...rest } = parsed;
      return rest;
    })();
    if (!isSuperadmin) {
      if (!sess.staffTenantId) return res.status(400).json({ message: "Session has no tenant" });
      try {
        await assertPropertyInTenant(req.params["id"] as string, sess.staffTenantId);
      } catch (err) {
        if (err instanceof PropertyScopeError) return res.status(403).json({ message: "propertyId outside tenant scope" });
        throw err;
      }
    }
    const prop = await updateProperty(req.params["id"] as string, data);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    res.json(prop);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
    console.error("[property update]", err);
    res.status(500).json({ message: "Error updating property" });
  }
});

export default router;
