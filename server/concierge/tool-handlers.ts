// Tool-call dispatch for the concierge Managed Agent.
//
// The session runner emits `agent.custom_tool_use` events and hands them
// here; this file turns those calls into concrete DB writes and channel
// sends. The flow is deliberately side-effect-heavy — these handlers are
// the ONLY place where an AI reply becomes a durable message.

import { and, asc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  helpConversations,
  helpCustomers,
  helpMessages,
  helpTickets,
  properties,
} from "../../shared/schema.js";
import type { ConversationBrief } from "./types.js";
import type { ConciergeToolName } from "./custom-tools.js";
import type { ToolCall, ToolHandler } from "./session-runner.js";
import { sendSms } from "../channels/twilio-sms.js";
import { sendEmail } from "../channels/postmark-email.js";

// Reply sender per channel. Adding WhatsApp / Zoom later is a matter of
// one more case and one more adapter — the rest of the flow is
// channel-agnostic.
async function sendToChannel(
  brief: ConversationBrief,
  to: string,
  body: string,
): Promise<{ providerMessageId: string; providerMetadata: Record<string, unknown> }> {
  switch (brief.channel) {
    case "sms": {
      const result = await sendSms({ to, body });
      return {
        providerMessageId: result.sid,
        providerMetadata: { provider: "twilio", status: result.status },
      };
    }
    case "email": {
      // Subject: reuse the conversation's subject, prefixed with "Re:"
      // unless it already starts with one.
      const subject = /^re:/i.test(brief.subject) ? brief.subject : `Re: ${brief.subject}`;
      const result = await sendEmail({ to, subject, textBody: body });
      return {
        providerMessageId: result.messageId,
        providerMetadata: { provider: "postmark", submittedAt: result.submittedAt },
      };
    }
    default:
      throw new Error(`sendToChannel: channel "${brief.channel}" not yet wired`);
  }
}

async function recordOutboundReply(
  brief: ConversationBrief,
  body: string,
  providerMessageId: string | null,
  providerMetadata: Record<string, unknown>,
): Promise<void> {
  // First: persist the outbound message as an "ai"-sourced reply.
  await db.insert(helpMessages).values({
    tenantId: brief.tenantId,
    conversationId: brief.conversationId,
    propertyId: brief.propertyId,
    messageType: "teammate",
    messageSource: "ai",
    authorLabel: "Concierge",
    body,
    externalMessageId: providerMessageId,
    metadataJson: providerMetadata,
  });

  // Second: compute + stamp response latency on the ticket. Latency is
  // measured from conversation open, which is "good enough" for now; when
  // we start tracking per-message turn latency this moves to per-message.
  const [conversation] = await db
    .select()
    .from(helpConversations)
    .where(eq(helpConversations.id, brief.conversationId))
    .limit(1);

  const [ticket] = await db
    .select()
    .from(helpTickets)
    .where(eq(helpTickets.conversationId, brief.conversationId))
    .limit(1);

  const now = new Date();
  if (conversation && ticket && !ticket.firstResponseAt) {
    const latencyMs = now.getTime() - conversation.createdAt.getTime();
    await db
      .update(helpTickets)
      .set({
        firstResponseAt: now,
        responseLatencyMs: latencyMs >= 0 ? latencyMs : null,
        updatedAt: now,
      })
      .where(eq(helpTickets.id, ticket.id));
  }

  // Third: update conversation bookkeeping. lastMessageAt pushes the thread
  // to the top; status slides to waiting_on_customer so the human inbox
  // doesn't treat it as freshly inbound.
  await db
    .update(helpConversations)
    .set({
      lastMessageAt: now,
      status: "waiting_on_customer",
      unreadCount: 0,
      messageCount: (conversation?.messageCount ?? 0) + 1,
      updatedAt: now,
    })
    .where(eq(helpConversations.id, brief.conversationId));
}

async function sendReplyHandler(input: Record<string, unknown>, brief: ConversationBrief): Promise<string> {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const confidence = typeof input.confidence === "string" ? input.confidence : "medium";
  if (!body) return "send_reply failed: empty body.";

  if (confidence === "low") {
    // Low confidence: don't auto-send. Leave as an internal note for the
    // human operator and escalate.
    await db.insert(helpMessages).values({
      tenantId: brief.tenantId,
      conversationId: brief.conversationId,
      propertyId: brief.propertyId,
      messageType: "internal_note",
      messageSource: "ai",
      authorLabel: "Concierge (draft — low confidence)",
      body,
      metadataJson: { draft: true, confidence },
    });
    return "Queued as draft for human review (confidence=low). Do not send another reply.";
  }

  // Look up the customer's channel handle so we know where to send.
  const [customer] = await db
    .select()
    .from(helpCustomers)
    .where(
      and(
        eq(helpCustomers.tenantId, brief.tenantId),
        eq(helpCustomers.id, await customerIdForConversation(brief.conversationId)),
      ),
    )
    .limit(1);
  if (!customer?.externalId) {
    return "send_reply failed: no customer handle on record. Escalate to human.";
  }

  try {
    const { providerMessageId, providerMetadata } = await sendToChannel(brief, customer.externalId, body);
    await recordOutboundReply(brief, body, providerMessageId, providerMetadata);
    return `Reply sent to ${customer.externalId} (${brief.channel}).`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[concierge] send_reply failed", msg);
    return `send_reply failed: ${msg}. Escalate to human.`;
  }
}

async function customerIdForConversation(conversationId: string): Promise<string> {
  const [conv] = await db
    .select({ customerId: helpConversations.customerId })
    .from(helpConversations)
    .where(eq(helpConversations.id, conversationId))
    .limit(1);
  return conv?.customerId ?? "";
}

async function escalateHandler(input: Record<string, unknown>, brief: ConversationBrief): Promise<string> {
  const reason = typeof input.reason === "string" ? input.reason : "Concierge escalated without reason.";
  const suggested = typeof input.suggested_next_step === "string" ? input.suggested_next_step : null;
  const now = new Date();

  const noteBody = suggested ? `${reason}\n\nSuggested next step: ${suggested}` : reason;
  await db.insert(helpMessages).values({
    tenantId: brief.tenantId,
    conversationId: brief.conversationId,
    propertyId: brief.propertyId,
    messageType: "internal_note",
    messageSource: "ai",
    authorLabel: "Concierge escalation",
    body: noteBody,
  });

  const [ticket] = await db
    .select()
    .from(helpTickets)
    .where(eq(helpTickets.conversationId, brief.conversationId))
    .limit(1);
  if (ticket) {
    await db
      .update(helpTickets)
      .set({ status: "pending", priority: "high", updatedAt: now })
      .where(eq(helpTickets.id, ticket.id));
  }
  await db
    .update(helpConversations)
    .set({ status: "pending", assignmentState: "unassigned", updatedAt: now })
    .where(eq(helpConversations.id, brief.conversationId));

  return "Conversation flagged for human review.";
}

async function addInternalNoteHandler(input: Record<string, unknown>, brief: ConversationBrief): Promise<string> {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) return "add_internal_note failed: empty body.";
  await db.insert(helpMessages).values({
    tenantId: brief.tenantId,
    conversationId: brief.conversationId,
    propertyId: brief.propertyId,
    messageType: "internal_note",
    messageSource: "ai",
    authorLabel: "Concierge note",
    body,
  });
  return "Note added to conversation.";
}

async function lookupPropertyHandler(
  input: Record<string, unknown>,
  brief: ConversationBrief,
): Promise<string> {
  const propertyId = typeof input.property_id === "string" ? input.property_id : brief.propertyId;
  if (!propertyId) return JSON.stringify({ error: "No property_id available on this conversation." });
  const [prop] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!prop) return JSON.stringify({ error: `property ${propertyId} not found` });

  const openTickets = await db
    .select({
      id: helpTickets.id,
      subject: helpConversations.subject,
      status: helpTickets.status,
      priority: helpTickets.priority,
      nextMilestone: helpTickets.nextMilestone,
      createdAt: helpTickets.createdAt,
    })
    .from(helpTickets)
    .leftJoin(helpConversations, eq(helpTickets.conversationId, helpConversations.id))
    .where(and(eq(helpTickets.propertyId, propertyId)))
    .orderBy(asc(helpTickets.createdAt));

  return JSON.stringify({
    name: prop.name,
    slug: prop.slug,
    location: prop.location,
    open_tickets: openTickets.filter((t) => t.status !== "resolved"),
    recent_tickets: openTickets.slice(-5),
  });
}

async function updateTicketHandler(input: Record<string, unknown>, brief: ConversationBrief): Promise<string> {
  const [ticket] = await db
    .select()
    .from(helpTickets)
    .where(eq(helpTickets.conversationId, brief.conversationId))
    .limit(1);
  if (!ticket) return "update_ticket failed: no ticket on this conversation.";

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.status === "string") patch.status = input.status;
  if (typeof input.priority === "string") patch.priority = input.priority;
  if (typeof input.next_milestone === "string") patch.nextMilestone = input.next_milestone;
  if (patch.status === "resolved") patch.resolvedAt = new Date();

  await db.update(helpTickets).set(patch).where(eq(helpTickets.id, ticket.id));
  if (typeof patch.status === "string") {
    await db
      .update(helpConversations)
      .set({ status: patch.status as "open" | "pending" | "waiting_on_customer" | "resolved", updatedAt: new Date() })
      .where(eq(helpConversations.id, brief.conversationId));
  }
  return `Ticket updated: ${JSON.stringify(patch)}.`;
}

export const conciergeToolHandler: ToolHandler = async (call: ToolCall, brief: ConversationBrief) => {
  const { name, input } = call;
  switch (name as ConciergeToolName) {
    case "send_reply":
      return sendReplyHandler(input, brief);
    case "escalate_to_human":
      return escalateHandler(input, brief);
    case "add_internal_note":
      return addInternalNoteHandler(input, brief);
    case "lookup_property_context":
      return lookupPropertyHandler(input, brief);
    case "update_ticket":
      return updateTicketHandler(input, brief);
    default:
      return `Unknown tool: ${name}`;
  }
};
