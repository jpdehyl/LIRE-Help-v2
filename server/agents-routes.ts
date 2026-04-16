import { Router } from "express";
import type { Request, Response } from "express";
import { requireStaffRole } from "./middleware/auth.js";
import { getAllAgents, getAgentByPropertyId, createAgent, updateAgent, upsertAgent } from "./storage.js";

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
    const { propertyId, tenantId, name, emoji, tagline, greeting, personality } = req.body;
    if (!propertyId) return res.status(400).json({ message: "propertyId required" });
    const agent = await createAgent({
      propertyId,
      tenantId: tenantId ?? null,
      name: name ?? "LIRE Agent",
      emoji: emoji ?? "LH",
      tagline: tagline ?? null,
      greeting: greeting ?? null,
      personality: personality ?? null,
    });
    res.status(201).json(agent);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: "Agent already exists for this property" });
    res.status(500).json({ message: "Error creating agent" });
  }
});

router.put("/by-property/:propertyId", requireStaffRole("superadmin", "owner"), async (req: Request, res: Response) => {
  try {
    const { name, emoji, tagline, greeting, personality, tenantId } = req.body;
    const agent = await upsertAgent(req.params["propertyId"] as string, {
      name, emoji, tagline, greeting, personality, tenantId: tenantId ?? undefined,
    });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ message: "Error updating agent" });
  }
});

router.put("/:id", requireStaffRole("superadmin", "owner"), async (req: Request, res: Response) => {
  try {
    const { name, emoji, tagline, greeting, personality, isActive } = req.body;
    const agent = await updateAgent(req.params["id"] as string, { name, emoji, tagline, greeting, personality, isActive });
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ message: "Error updating agent" });
  }
});

export default router;
