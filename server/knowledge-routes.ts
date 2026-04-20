import { Router } from "express";
import { requireAdmin } from "./middleware/auth.js";
import { getPlatformKnowledge, createPlatformKnowledge, updatePlatformKnowledge, deletePlatformKnowledge, reorderPlatformKnowledge } from "./storage.js";
import kbDocumentsRouter from "./kb-documents/routes.js";

const router = Router();

// /api/knowledge/documents — uploaded files (leases, drawings, policy PDFs).
// requireAdmin applies to every nested route; the sub-router reads tenant
// from session like the platform KB routes above.
router.use("/documents", requireAdmin, kbDocumentsRouter);

function tenantIdOrNull(req: Parameters<typeof requireAdmin>[0]): string | null {
  const sess = req.session as any;
  return typeof sess?.staffTenantId === "string" && sess.staffTenantId ? sess.staffTenantId : null;
}

router.get("/platform", requireAdmin, async (req, res) => {
  try {
    const tenantId = tenantIdOrNull(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    res.json(await getPlatformKnowledge(tenantId));
  } catch (err) {
    res.status(500).json({ message: "Error fetching knowledge base" });
  }
});

router.post("/platform", requireAdmin, async (req, res) => {
  try {
    const tenantId = tenantIdOrNull(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const { section, title, content } = req.body;
    if (!section || !title || !content) return res.status(400).json({ message: "section, title, and content required" });
    const entry = await createPlatformKnowledge(tenantId, { section, title, content });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: "Error creating entry" });
  }
});

router.put("/platform/:id", requireAdmin, async (req, res) => {
  try {
    const tenantId = tenantIdOrNull(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const { section, title, content } = req.body;
    const entry = await updatePlatformKnowledge(req.params["id"] as string, tenantId, { section, title, content });
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: "Error updating entry" });
  }
});

router.delete("/platform/:id", requireAdmin, async (req, res) => {
  try {
    const tenantId = tenantIdOrNull(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const deleted = await deletePlatformKnowledge(req.params["id"] as string, tenantId);
    if (!deleted) return res.status(404).json({ message: "Entry not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error deleting entry" });
  }
});

router.patch("/platform/:id/reorder", requireAdmin, async (req, res) => {
  try {
    const tenantId = tenantIdOrNull(req);
    if (!tenantId) return res.status(403).json({ message: "Tenant context required" });
    const { direction } = req.body as { direction: "up" | "down" };
    const entries = await reorderPlatformKnowledge(req.params["id"] as string, direction, tenantId);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: "Error reordering" });
  }
});

export default router;
