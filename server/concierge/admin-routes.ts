// Admin surfaces for the Claude-managed concierge agent. These are read-only
// views on top of Anthropic's Managed Agents API — the source of truth for
// prompt, model, tools, and skills lives in Claude Console, and LIRE links
// out for edits rather than duplicating the config surface.

import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireStaff } from "../middleware/auth.js";
import { loadConciergeIdentity, runConciergeTurn } from "./session-runner.js";
import type { ToolCall } from "./session-runner.js";
import type { ConversationBrief } from "./types.js";
import type { ConciergeSettingsPatch } from "../storage.js";
import { getConciergeSettings, getPlatformKnowledge, upsertConciergeSettings } from "../storage.js";
import { helpConversations, helpCustomers, helpMessages, properties } from "../../shared/schema.js";

const router = Router();
router.use(requireStaff);

const KB_LOOKUP_MAX_RESULTS = 10;
const RECENT_ACTIVITY_LIMIT = 25;

type ActivityRun = {
  id: string;
  source: "try" | "draft";
  createdAt: string;
  conversationId: string | null;
  userMessage: string;
  reply: string | null;
  confidence: "high" | "medium" | "low" | null;
  escalated: boolean;
  escalationReason: string | null;
  stopReason: string;
  toolCalls: TryItToolCall[];
};

const recentActivityRuns: ActivityRun[] = [];

function pushActivity(run: ActivityRun) {
  recentActivityRuns.unshift(run);
  if (recentActivityRuns.length > RECENT_ACTIVITY_LIMIT) {
    recentActivityRuns.length = RECENT_ACTIVITY_LIMIT;
  }
}

function derivePropertyCode(slug: string, name: string): string {
  const source = (slug || name).replace(/[^a-zA-Z]/g, "").toUpperCase();
  return source.slice(0, 3).padEnd(3, "X");
}

async function lookupKnowledgeResult(tenantId: string, input: Record<string, unknown>): Promise<string> {
  const section = typeof input.section === "string" ? input.section.trim().toLowerCase() : null;
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : null;
  const all = await getPlatformKnowledge(tenantId);
  const filtered = all.filter((entry) => {
    if (section && entry.section.toLowerCase() !== section) return false;
    if (query) {
      const haystack = `${entry.title}\n${entry.content}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return JSON.stringify({
    total_matched: filtered.length,
    returned: Math.min(filtered.length, KB_LOOKUP_MAX_RESULTS),
    entries: filtered.slice(0, KB_LOOKUP_MAX_RESULTS).map((entry) => ({
      id: entry.id,
      section: entry.section,
      title: entry.title,
      content: entry.content,
    })),
  });
}

async function buildDraftBrief(conversationId: string): Promise<ConversationBrief | null> {
  const [conversation] = await db
    .select()
    .from(helpConversations)
    .where(eq(helpConversations.id, conversationId))
    .limit(1);
  if (!conversation) return null;

  const [customer] = conversation.customerId
    ? await db.select().from(helpCustomers).where(eq(helpCustomers.id, conversation.customerId)).limit(1)
    : [undefined];
  const [property] = conversation.propertyId
    ? await db.select().from(properties).where(eq(properties.id, conversation.propertyId)).limit(1)
    : [undefined];
  const [latestCustomerMessage] = await db
    .select({ body: helpMessages.body })
    .from(helpMessages)
    .where(
      and(
        eq(helpMessages.conversationId, conversation.id),
        eq(helpMessages.messageType, "customer"),
        eq(helpMessages.messageSource, "human"),
      ),
    )
    .orderBy(desc(helpMessages.createdAt))
    .limit(1);

  return {
    conversationId: conversation.id,
    tenantId: conversation.tenantId,
    propertyId: conversation.propertyId,
    channel: "web",
    customerName: customer?.name ?? null,
    customerCompany: customer?.company ?? null,
    propertyName: property?.name ?? null,
    propertyCode: property ? derivePropertyCode(property.slug, property.name) : null,
    subject: conversation.subject,
    latestMessage: latestCustomerMessage?.body ?? conversation.preview ?? conversation.subject,
    runState: "live",
  };
}

const SettingsPatchSchema = z.object({
  runState: z.enum(["live", "shadow", "paused"]).optional(),
  autonomyCeilingPct: z.number().int().min(0).max(100).optional(),
  channels: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      sms: z.boolean().optional(),
      zoom: z.boolean().optional(),
      slack: z.boolean().optional(),
      messenger: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

router.get("/settings", async (req, res) => {
  const sess = req.session as { staffTenantId?: string | null } | undefined;
  const tenantId = sess?.staffTenantId;
  if (!tenantId) return res.status(400).json({ message: "Session is missing a tenant" });
  try {
    const settings = await getConciergeSettings(tenantId);
    res.json(settings);
  } catch (err) {
    console.error("[concierge settings get]", err);
    res.status(500).json({ message: "Unable to load concierge settings" });
  }
});

router.patch("/settings", async (req, res) => {
  const sess = req.session as { staffTenantId?: string | null } | undefined;
  const tenantId = sess?.staffTenantId;
  if (!tenantId) return res.status(400).json({ message: "Session is missing a tenant" });

  const parse = SettingsPatchSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: parse.error.issues[0]?.message ?? "Invalid patch" });
  }

  try {
    const patch: ConciergeSettingsPatch = {
      runState: parse.data.runState,
      autonomyCeilingPct: parse.data.autonomyCeilingPct,
      channels: parse.data.channels,
    };
    const settings = await upsertConciergeSettings(tenantId, patch);
    res.json(settings);
  } catch (err) {
    console.error("[concierge settings patch]", err);
    res.status(500).json({ message: "Unable to save concierge settings" });
  }
});

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
  // When present, resume this session so the agent keeps context across
  // turns. Managed-agent session IDs start with `sesn_`.
  sessionId: z.string().trim().regex(/^sesn_[A-Za-z0-9]+$/).optional(),
});

const DraftBodySchema = z.object({
  conversationId: z.string().trim().min(1, "conversationId required"),
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
      case "lookup_knowledge": {
        result = await lookupKnowledgeResult(brief.tenantId, input);
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
      resumeSessionId: parse.data.sessionId,
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
    pushActivity({
      id: `${Date.now()}-try`,
      source: "try",
      createdAt: new Date().toISOString(),
      conversationId: null,
      userMessage: parse.data.message,
      reply: capturedReply,
      confidence: capturedConfidence,
      escalated,
      escalationReason,
      stopReason: turn.stopReason,
      toolCalls,
    });
    return res.json(response);
  } catch (err) {
    console.error("[concierge try]", err);
    return res.status(502).json({ message: err instanceof Error ? err.message : "Agent run failed" });
  }
});

router.post("/draft", async (req, res) => {
  const parse = DraftBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: parse.error.issues[0]?.message ?? "Invalid request" });
  }

  const identity = loadConciergeIdentity();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!identity || !apiKey) {
    return res.status(503).json({ message: "Concierge agent is not configured on this deployment." });
  }

  const brief = await buildDraftBrief(parse.data.conversationId);
  if (!brief) {
    return res.status(404).json({ message: "Conversation not found" });
  }

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
        result = "Reply captured as inbox draft (not delivered).";
        break;
      }
      case "escalate_to_human": {
        escalated = true;
        escalationReason = typeof input.reason === "string" ? input.reason : null;
        result = "Escalation captured for inbox draft (no one was paged).";
        break;
      }
      case "add_internal_note": {
        result = "Internal note suppressed in draft mode (not persisted).";
        break;
      }
      case "lookup_property_context": {
        if (!brief.propertyId) {
          result = JSON.stringify({ error: "No property linked to this conversation." });
          break;
        }
        const [property] = await db.select().from(properties).where(eq(properties.id, brief.propertyId)).limit(1);
        result = property
          ? JSON.stringify({ id: property.id, name: property.name, slug: property.slug, location: property.location })
          : JSON.stringify({ error: `property ${brief.propertyId} not found` });
        break;
      }
      case "lookup_knowledge": {
        result = await lookupKnowledgeResult(brief.tenantId, input);
        break;
      }
      case "update_ticket": {
        result = "Ticket update suppressed in draft mode (no ticket mutated).";
        break;
      }
    }

    toolCalls.push({ id: call.id, name: call.name, input: input as Record<string, unknown>, result });
    return result;
  };

  try {
    const client = new Anthropic({ apiKey });
    const turn = await runConciergeTurn({
      client,
      identity,
      brief,
      latestCustomerMessage: brief.latestMessage,
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
    pushActivity({
      id: `${Date.now()}-draft`,
      source: "draft",
      createdAt: new Date().toISOString(),
      conversationId: brief.conversationId,
      userMessage: brief.latestMessage,
      reply: capturedReply,
      confidence: capturedConfidence,
      escalated,
      escalationReason,
      stopReason: turn.stopReason,
      toolCalls,
    });
    return res.json(response);
  } catch (err) {
    console.error("[concierge draft]", err);
    return res.status(502).json({ message: err instanceof Error ? err.message : "Agent run failed" });
  }
});

router.get("/activity", async (_req, res) => {
  res.json({ runs: recentActivityRuns });
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

interface KnowledgeSection {
  section: string;
  entryCount: number;
  totalCharCount: number;
  entries: {
    id: string;
    title: string;
    content: string;
    contentChars: number;
    updatedAtLabel: string;
  }[];
}

interface ConciergeKnowledgeResponse {
  totalEntries: number;
  totalCharCount: number;
  sectionCount: number;
  sections: KnowledgeSection[];
  editUrl: string;
}

// Read-only knowledge surface for /concierge. Mirrors /api/knowledge/platform
// but is scoped to requireStaff (anyone on the team) and groups by section
// with per-entry summaries — full content is still edited elsewhere.
router.get("/knowledge", async (req, res) => {
  const sess = req.session as { staffTenantId?: string | null } | undefined;
  const tenantId = sess?.staffTenantId;
  if (!tenantId) return res.status(400).json({ message: "Session is missing a tenant" });

  try {
    const entries = await getPlatformKnowledge(tenantId);
    const bySection = new Map<string, KnowledgeSection>();
    for (const entry of entries) {
      const contentChars = entry.content?.length ?? 0;
      const current = bySection.get(entry.section) ?? {
        section: entry.section,
        entryCount: 0,
        totalCharCount: 0,
        entries: [],
      };
      current.entryCount += 1;
      current.totalCharCount += contentChars;
      current.entries.push({
        id: entry.id,
        title: entry.title,
        content: entry.content ?? "",
        contentChars,
        updatedAtLabel: formatIsoDate(entry.updatedAt),
      });
      bySection.set(entry.section, current);
    }

    const response: ConciergeKnowledgeResponse = {
      totalEntries: entries.length,
      totalCharCount: entries.reduce((sum, e) => sum + (e.content?.length ?? 0), 0),
      sectionCount: bySection.size,
      sections: [...bySection.values()].sort((a, b) => a.section.localeCompare(b.section)),
      editUrl: "/platform-dashboard", // KB CRUD lives on the platform-admin page until /settings/workspace/knowledge ships
    };
    res.json(response);
  } catch (err) {
    console.error("[concierge knowledge]", err);
    res.status(500).json({ message: "Unable to load concierge knowledge" });
  }
});

function formatIsoDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export default router;
