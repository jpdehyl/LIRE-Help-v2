// Channel-agnostic intake: upsert occupant → upsert conversation → insert
// the inbound message. Called by channel-specific webhook handlers
// (twilio-sms routes, future email/whatsapp/zoom) once they've normalised
// their provider payload into a plain ChannelInbound.

import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  helpConversations,
  helpOccupants,
  helpMessages,
  tenants,
} from "../../shared/schema.js";
import type { Channel } from "../concierge/types.js";

export interface ChannelInbound {
  channel: Channel;
  // Stable handle the occupant uses on this channel — phone for SMS/WhatsApp,
  // email address for email, Zoom user id for Zoom. Doubles as the dedup key
  // via helpOccupants.externalId and helpConversations.externalThreadId.
  handle: string;
  // Tenant phone number / inbox address the message arrived on. Not
  // persisted today but useful for multi-tenant routing in Phase 2+.
  receivedAt?: string;
  body: string;
  // Freeform metadata from the provider (Twilio MessageSid, WhatsApp
  // business-account id, etc.). Stored on helpMessages.metadataJson.
  providerMetadata?: Record<string, unknown>;
  // Optional friendly name for new occupants (Twilio gives us city/state
  // but not name; we leave name as null when unknown).
  suggestedName?: string;
  // Optional subject override. Email passes the real Subject header;
  // SMS/WhatsApp derive the subject from the first message body (default).
  subject?: string;
  // Optional email for helpOccupants.email. Only populated for channels
  // that actually carry email (Postmark inbound, future SMTP).
  email?: string;
}

export interface IntakeResult {
  conversationId: string;
  occupantId: string;
  messageId: string;
  isNewConversation: boolean;
}

// Picks the first tenant. Phase 2 is single-tenant — multi-tenant routing
// requires a Twilio-number-to-tenant mapping and is a Phase 6 concern.
async function resolveTenantId(): Promise<string | null> {
  const [t] = await db.select().from(tenants).limit(1);
  return t?.id ?? null;
}

async function upsertOccupantContact(tenantId: string, inbound: ChannelInbound): Promise<string> {
  const existing = await db
    .select()
    .from(helpOccupants)
    .where(and(eq(helpOccupants.tenantId, tenantId), eq(helpOccupants.externalId, inbound.handle)))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    await db
      .update(helpOccupants)
      .set({ lastSeenAt: now, updatedAt: now })
      .where(eq(helpOccupants.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db
    .insert(helpOccupants)
    .values({
      tenantId,
      externalId: inbound.handle,
      name: inbound.suggestedName ?? inbound.handle,
      email: inbound.email ?? null,
      tier: "standard",
      health: "stable",
      lastSeenAt: now,
    })
    .returning();
  return row!.id;
}

// One open conversation per (occupant, channel). When a new message comes
// in on an existing thread, we reuse the open conversation; otherwise we
// open a new one. The externalThreadId is the occupant handle so
// provider-side threading is stable.
async function upsertOpenConversation(
  tenantId: string,
  occupantId: string,
  inbound: ChannelInbound,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await db
    .select()
    .from(helpConversations)
    .where(
      and(
        eq(helpConversations.tenantId, tenantId),
        eq(helpConversations.occupantId, occupantId),
        eq(helpConversations.channel, inbound.channel),
      ),
    )
    .orderBy(desc(helpConversations.lastMessageAt))
    .limit(1);

  const openRow = existing.find((c) => c.status !== "resolved");
  if (openRow) {
    await db
      .update(helpConversations)
      .set({
        lastMessageAt: new Date(),
        lastOccupantMessageAt: new Date(),
        messageCount: (openRow.messageCount ?? 0) + 1,
        unreadCount: (openRow.unreadCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(helpConversations.id, openRow.id));
    return { id: openRow.id, isNew: false };
  }

  const subject =
    inbound.subject?.trim() ||
    inbound.body.slice(0, 80).replace(/\s+/g, " ").trim() ||
    `${inbound.channel} inquiry`;
  const [row] = await db
    .insert(helpConversations)
    .values({
      tenantId,
      occupantId,
      externalThreadId: inbound.handle,
      subject,
      status: "open",
      priority: "medium",
      assignmentState: "unassigned",
      channel: inbound.channel,
      preview: inbound.body.slice(0, 200),
      unreadCount: 1,
      messageCount: 1,
      lastOccupantMessageAt: new Date(),
    })
    .returning();
  return { id: row!.id, isNew: true };
}

async function insertInboundMessage(
  tenantId: string,
  conversationId: string,
  inbound: ChannelInbound,
): Promise<string> {
  const [row] = await db
    .insert(helpMessages)
    .values({
      tenantId,
      conversationId,
      messageType: "occupant",
      messageSource: "human",
      authorLabel: inbound.suggestedName ?? inbound.handle,
      body: inbound.body,
      externalMessageId: (inbound.providerMetadata?.MessageSid as string | undefined) ?? null,
      metadataJson: inbound.providerMetadata ?? {},
    })
    .returning();
  return row!.id;
}

export async function intakeInbound(inbound: ChannelInbound): Promise<IntakeResult | null> {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    console.error("[channels] intake called but no tenant exists — skipping", inbound);
    return null;
  }
  const occupantId = await upsertOccupantContact(tenantId, inbound);
  const { id: conversationId, isNew } = await upsertOpenConversation(tenantId, occupantId, inbound);
  const messageId = await insertInboundMessage(tenantId, conversationId, inbound);
  return { conversationId, occupantId, messageId, isNewConversation: isNew };
}
