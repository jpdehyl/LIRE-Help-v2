// Ties channel intake to the session runner. Channel webhooks call
// runConciergeForInbound(intakeResult, inboundBody) — this builds a
// ConversationBrief from the DB and kicks off one session turn.
//
// The Anthropic API call happens fire-and-forget from the webhook's
// perspective; the webhook returns 200 immediately so Twilio is happy,
// and we stream + process events in the background. If the agent call
// throws, we log and leave the conversation in "open / unassigned" so a
// human picks it up next time the inbox is checked.

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { helpConversations, helpCustomers, properties } from "../../shared/schema.js";
import { loadConciergeIdentity, runConciergeTurn } from "./session-runner.js";
import { conciergeToolHandler } from "./tool-handlers.js";
import type { Channel, ConversationBrief } from "./types.js";

function derivePropertyCode(slug: string, name: string): string {
  const source = (slug || name).replace(/[^a-zA-Z]/g, "").toUpperCase();
  return source.slice(0, 3).padEnd(3, "X");
}

export interface RunArgs {
  conversationId: string;
  inboundBody: string;
}

export async function runConciergeForInbound(args: RunArgs): Promise<void> {
  const identity = loadConciergeIdentity();
  if (!identity) {
    console.error("[concierge] identity env vars missing — skipping turn. See docs/concierge/phase-plan.md.");
    return;
  }

  const [conversation] = await db
    .select()
    .from(helpConversations)
    .where(eq(helpConversations.id, args.conversationId))
    .limit(1);
  if (!conversation) {
    console.error("[concierge] conversation not found:", args.conversationId);
    return;
  }

  const [customer] = conversation.customerId
    ? await db.select().from(helpCustomers).where(eq(helpCustomers.id, conversation.customerId)).limit(1)
    : [undefined];

  const [property] = conversation.propertyId
    ? await db.select().from(properties).where(eq(properties.id, conversation.propertyId)).limit(1)
    : [undefined];

  const brief: ConversationBrief = {
    conversationId: conversation.id,
    tenantId: conversation.tenantId,
    propertyId: conversation.propertyId,
    channel: (conversation.channel as Channel) ?? "sms",
    customerName: customer?.name ?? null,
    customerCompany: customer?.company ?? null,
    propertyName: property?.name ?? null,
    propertyCode: property ? derivePropertyCode(property.slug, property.name) : null,
    subject: conversation.subject,
    latestMessage: args.inboundBody,
  };

  const client = new Anthropic();
  try {
    const result = await runConciergeTurn({
      client,
      identity,
      brief,
      latestCustomerMessage: args.inboundBody,
      handleTool: conciergeToolHandler,
    });
    console.log("[concierge] turn complete", { conversationId: brief.conversationId, ...result });
  } catch (err) {
    console.error("[concierge] turn failed", err);
  }
}
