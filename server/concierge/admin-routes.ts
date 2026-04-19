// Admin surfaces for the Claude-managed concierge agent. These are read-only
// views on top of Anthropic's Managed Agents API — the source of truth for
// prompt, model, tools, and skills lives in Claude Console, and LIRE links
// out for edits rather than duplicating the config surface.

import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireStaff } from "../middleware/auth.js";
import { loadConciergeIdentity, runConciergeTurn } from "./session-runner.js";
import type { ToolCall } from "./session-runner.js";
import type { ConversationBrief } from "./types.js";

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

const TryItBodySchema = z.object({
  message: z.string().trim().min(1, "message required").max(4000),
});

interface TryItToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result: string;
}

interface TryItResponse {
  sessionId: string;
  reply: string | null;
  confidence: "high" | "medium" | "low" | null;
  escalated: boolean;
  escalationReason: string | null;
  stopReason: string;
  toolCalls: TryItToolCall[];
}

// Interactive playground for the concierge agent. Runs a full Managed Agent
// turn with a canned ConversationBrief and tool handlers that simulate success
// rather than writing to helpMessages / helpTickets — so operators can exercise
// the agent without producing real outbound replies or mutating state.
router.post("/try", async (req, res) => {
  const parse = TryItBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: parse.error.issues[0]?.message ?? "Invalid request" });
  }

  const identity = loadConciergeIdentity();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!identity || !apiKey) {
    return res.status(503).json({ message: "Concierge agent is not configured on this deployment." });
  }

  const sess = req.session as { staffTenantId?: string | null } | undefined;
  const brief: ConversationBrief = {
    conversationId: `try-${Date.now().toString(36)}`,
    tenantId: sess?.staffTenantId ?? "playground",
    propertyId: null,
    channel: "web",
    customerName: "Playground operator",
    customerCompany: null,
    propertyName: null,
    propertyCode: null,
    subject: "Operator try-it playground",
    latestMessage: parse.data.message,
  };

  const toolCalls: TryItToolCall[] = [];
  let capturedReply: string | null = null;
  let capturedConfidence: "high" | "medium" | "low" | null = null;
  let escalated = false;
  let escalationReason: string | null = null;

  const handleTool = async (call: ToolCall): Promise<string> => {
    const input = call.input;
    let result = "ok";

    switch (call.name) {
      case "send_reply": {
        capturedReply = typeof input.body === "string" ? input.body : "";
        const c = typeof input.confidence === "string" ? input.confidence : "";
        if (c === "high" || c === "medium" || c === "low") capturedConfidence = c;
        result = "Reply captured for playground (not delivered to any channel).";
        break;
      }
      case "escalate_to_human": {
        escalated = true;
        escalationReason = typeof input.reason === "string" ? input.reason : null;
        result = "Escalation recorded for playground (no one was paged).";
        break;
      }
      case "add_internal_note": {
        result = "Internal note captured for playground (not persisted).";
        break;
      }
      case "lookup_property_context": {
        result =
          "No property is linked in playground mode. Treat this as a generic tenant inquiry with no specific lease, billing, or vendor data available.";
        break;
      }
      case "update_ticket": {
        result = "Ticket update captured for playground (no ticket mutated).";
        break;
      }
    }

    toolCalls.push({
      id: call.id,
      name: call.name,
      input: input as Record<string, unknown>,
      result,
    });
    return result;
  };

  try {
    const client = new Anthropic({ apiKey });
    const turn = await runConciergeTurn({
      client,
      identity,
      brief,
      latestCustomerMessage: parse.data.message,
      handleTool,
    });

    const response: TryItResponse = {
      sessionId: turn.sessionId,
      reply: capturedReply,
      confidence: capturedConfidence,
      escalated,
      escalationReason,
      stopReason: turn.stopReason,
      toolCalls,
    };
    return res.json(response);
  } catch (err) {
    console.error("[concierge try]", err);
    return res.status(502).json({ message: err instanceof Error ? err.message : "Agent run failed" });
  }
});

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
