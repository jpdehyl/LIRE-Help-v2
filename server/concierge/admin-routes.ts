// Admin surfaces for the Claude-managed concierge agent. These are read-only
// views on top of Anthropic's Managed Agents API — the source of truth for
// prompt, model, tools, and skills lives in Claude Console, and LIRE links
// out for edits rather than duplicating the config surface.

import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireStaff } from "../middleware/auth.js";

const router = Router();
router.use(requireStaff);

interface AgentSummary {
  id: string;
  name: string;
  model: string;
  version: string;
  systemPromptPreview: string;
  systemPromptFull: string;
  toolsCount: number;
  skillsCount: number;
  consoleUrl: string | null;
  lastUpdatedLabel: string | null;
  configured: boolean;
}

function buildConsoleUrl(agentId: string): string {
  // Overridable per-deploy so staging / alt-workspace setups work without a
  // code change. Default points at the "default" workspace used during setup.
  const base = process.env.CONCIERGE_CONSOLE_URL?.replace(/\/$/, "")
    ?? "https://platform.claude.com/workspaces/default/agents";
  return `${base}/${agentId}`;
}

function unconfiguredResponse(): AgentSummary {
  return {
    id: "",
    name: "LIRE Help concierge",
    model: "",
    version: "",
    systemPromptPreview: "",
    systemPromptFull: "",
    toolsCount: 0,
    skillsCount: 0,
    consoleUrl: null,
    lastUpdatedLabel: null,
    configured: false,
  };
}

router.get("/agent", async (_req, res) => {
  const agentId = process.env.CONCIERGE_AGENT_ID;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!agentId || !apiKey) {
    return res.json(unconfiguredResponse());
  }

  try {
    const client = new Anthropic({ apiKey });
    const agent = await client.beta.agents.retrieve(agentId);

    const systemPrompt = (agent.system ?? "") as string;
    const rawTools = Array.isArray((agent as unknown as { tools?: unknown[] }).tools)
      ? (agent as unknown as { tools: unknown[] }).tools
      : [];
    const rawSkills = Array.isArray((agent as unknown as { skills?: unknown[] }).skills)
      ? (agent as unknown as { skills: unknown[] }).skills
      : [];

    const summary: AgentSummary = {
      id: agent.id,
      name: agent.name ?? "LIRE Help concierge",
      model: (agent as unknown as { model?: string }).model ?? "",
      version: String(agent.version ?? ""),
      systemPromptPreview: systemPrompt.slice(0, 400),
      systemPromptFull: systemPrompt,
      toolsCount: rawTools.length,
      skillsCount: rawSkills.length,
      consoleUrl: buildConsoleUrl(agent.id),
      lastUpdatedLabel: null,
      configured: true,
    };

    res.json(summary);
  } catch (err) {
    console.error("[concierge agent retrieve]", err);
    res.status(502).json({ message: "Unable to load concierge agent from Anthropic" });
  }
});

export default router;
