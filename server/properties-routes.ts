import { Router } from "express";
import { requireAdmin, requireStaffRole } from "./middleware/auth.js";
import { getTenants, createTenant, getProperties, createProperty, updateProperty } from "./storage.js";
import { insertPropertySchema, insertTenantSchema } from "../shared/schema.js";
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
    const data = insertPropertySchema.parse(req.body);
    const prop = await createProperty(data);
    res.status(201).json(prop);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
    res.status(500).json({ message: "Error creating property" });
  }
});

router.put("/:id", requireStaffRole("superadmin", "owner"), async (req, res) => {
  try {
    const data = insertPropertySchema.partial().parse(req.body);
    const prop = await updateProperty(req.params["id"] as string, data);
    if (!prop) return res.status(404).json({ message: "Property not found" });
    res.json(prop);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
    res.status(500).json({ message: "Error updating property" });
  }
});

export default router;
