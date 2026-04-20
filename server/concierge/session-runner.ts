// Drives a single Managed Agent session for one conversation turn.
//
// Flow:
//   1. Channel adapter hands us an inbound tenant message (already persisted
//      to helpMessages with messageSource="human").
//   2. runConciergeTurn() opens a session on the pre-created Managed Agent,
//      seeds it with ConversationBrief + the latest message, and streams
//      events.
//   3. When the agent emits `agent.custom_tool_use`, we dispatch to one of
//      the CONCIERGE_CUSTOM_TOOLS handlers defined in tool-handlers.ts
//      (Phase 2) and respond with `user.custom_tool_result`.
//   4. We break the loop when the session reaches a terminal idle or is
//      terminated — same gate pattern documented in the claude-api skill.
//
// Phase 1 note: tool handlers are stubs that log intent. Wiring them to
// helpMessages / helpTickets / channel adapters happens in Phase 2.

import Anthropic from "@anthropic-ai/sdk";
import type { ConciergeIdentity, ConversationBrief } from "./types.js";
import type { ConciergeToolName } from "./custom-tools.js";
import { CONCIERGE_ENV_KEYS } from "./agent-setup.js";

export function loadConciergeIdentity(): ConciergeIdentity | null {
  const agentId = process.env[CONCIERGE_ENV_KEYS.agentId];
  const agentVersion = process.env[CONCIERGE_ENV_KEYS.agentVersion];
  const environmentId = process.env[CONCIERGE_ENV_KEYS.environmentId];
  if (!agentId || !agentVersion || !environmentId) return null;
  const parsedVersion = Number(agentVersion);
  if (!Number.isFinite(parsedVersion)) return null;
  return { agentId, agentVersion: parsedVersion, environmentId };
}

export interface ToolCall {
  id: string;
  name: ConciergeToolName;
  input: Record<string, unknown>;
}

export type ToolHandler = (call: ToolCall, brief: ConversationBrief) => Promise<string>;

export type ConciergeTurnProgressEvent =
  | { type: "session"; phase: "created" | "resumed" | "stream_opened" | "message_sent"; sessionId: string }
  | { type: "agent"; eventType: string; eventId?: string }
  | { type: "tool"; phase: "started"; call: ToolCall }
  | { type: "tool"; phase: "completed"; call: ToolCall; result: string }
  | { type: "session"; phase: "completed"; sessionId: string; stopReason: string; eventCount: number };

export interface RunTurnArgs {
  client: Anthropic;
  identity: ConciergeIdentity;
  brief: ConversationBrief;
  latestOccupantMessage: string;
  handleTool: ToolHandler;
  onProgress?: (event: ConciergeTurnProgressEvent) => void | Promise<void>;
  // When provided, resume the existing session rather than creating a new
  // one. The runner only processes events whose id isn't already on the
  // session — so prior-turn events are skipped even though the SSE stream
  // replays from the beginning.
  resumeSessionId?: string;
}

export interface TurnResult {
  sessionId: string;
  stopReason: string;
  // Raw event count — useful for metrics and debugging runaway turns.
  eventCount: number;
  resumed: boolean;
}

export async function runConciergeTurn(args: RunTurnArgs): Promise<TurnResult> {
  const { client, identity, brief, latestOccupantMessage, handleTool, onProgress, resumeSessionId } = args;

  let sessionId: string;
  const seenEventIds = new Set<string>();
  const resumed = Boolean(resumeSessionId);

  if (resumeSessionId) {
    sessionId = resumeSessionId;
    // Snapshot existing events so we can skip them during the stream replay.
    // asc order is the default; we don't need the bodies, just the ids.
    for await (const event of client.beta.sessions.events.list(sessionId)) {
      seenEventIds.add(event.id);
    }
    await onProgress?.({ type: "session", phase: "resumed", sessionId });
  } else {
    const session = await client.beta.sessions.create({
      agent: { type: "agent", id: identity.agentId, version: identity.agentVersion },
      environment_id: identity.environmentId,
      title: `${brief.propertyCode ?? "???"} · ${brief.subject}`.slice(0, 80),
      metadata: {
        conversation_id: brief.conversationId,
        tenant_id: brief.tenantId,
        channel: brief.channel,
      },
    });
    sessionId = session.id;
    await onProgress?.({ type: "session", phase: "created", sessionId });
  }

  // Stream-first, then send. If we send before opening the stream, the agent
  // can start processing and emit events before our consumer is attached.
  const stream = await client.beta.sessions.events.stream(sessionId);
  await onProgress?.({ type: "session", phase: "stream_opened", sessionId });

  const messageText = resumed
    ? `Latest message from the tenant:\n${latestOccupantMessage}`
    : [
        `Conversation context:`,
        `- Channel: ${brief.channel}`,
        `- Tenant: ${brief.tenantName ?? "unknown"}${brief.tenantCompany ? ` (${brief.tenantCompany})` : ""}`,
        `- Property: ${brief.propertyName ?? "unassigned"}${brief.propertyCode ? ` [${brief.propertyCode}]` : ""}`,
        `- Subject: ${brief.subject}`,
        ``,
        `Latest message from the tenant:`,
        latestOccupantMessage,
      ].join("\n");

  await client.beta.sessions.events.send(sessionId, {
    events: [{ type: "user.message", content: [{ type: "text", text: messageText }] }],
  });
  await onProgress?.({ type: "session", phase: "message_sent", sessionId });

  let eventCount = 0;
  let stopReason = "unknown";

  for await (const event of stream) {
    // Skip pre-existing events when resuming. For new sessions seenEventIds
    // is empty so this is a no-op.
    if ("id" in event && typeof event.id === "string" && seenEventIds.has(event.id)) {
      continue;
    }
    eventCount++;
    await onProgress?.({
      type: "agent",
      eventType: event.type,
      eventId: "id" in event && typeof event.id === "string" ? event.id : undefined,
    });

    if (event.type === "agent.custom_tool_use") {
      const call: ToolCall = {
        id: event.id,
        name: (event as { name: string }).name as ConciergeToolName,
        input: ((event as { input?: unknown }).input ?? {}) as Record<string, unknown>,
      };
      await onProgress?.({ type: "tool", phase: "started", call });
      const result = await handleTool(call, brief);
      await onProgress?.({ type: "tool", phase: "completed", call, result });
      await client.beta.sessions.events.send(sessionId, {
        events: [{
          type: "user.custom_tool_result",
          custom_tool_use_id: call.id,
          content: [{ type: "text", text: result }],
        }],
      });
      continue;
    }

    if (event.type === "session.status_terminated") {
      stopReason = "terminated";
      break;
    }

    if (event.type === "session.status_idle") {
      const reason = event.stop_reason?.type ?? "end_turn";
      if (reason === "requires_action") continue;
      stopReason = reason;
      break;
    }
  }

  await onProgress?.({ type: "session", phase: "completed", sessionId, stopReason, eventCount });
  return { sessionId, stopReason, eventCount, resumed };
}
