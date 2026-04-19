// WhatsApp channel adapter using Meta's WhatsApp Cloud API directly
// (graph.facebook.com), not Twilio. Meta's free tier provides a test
// phone number that developers can chat with from their personal
// WhatsApp client — perfect for Phase 4 testing without Business
// verification or monthly fees.
//
// Inbound: Meta sends GET (handshake) + POST (events) to the same URL.
//   - GET has query params hub.mode, hub.verify_token, hub.challenge.
//     We echo hub.challenge back when verify_token matches ours.
//   - POST is signed via X-Hub-Signature-256 = sha256=HMAC(app_secret,
//     raw_body). We verify before handling.
//
// Outbound: POST /v19.0/{phone_number_id}/messages with a bearer token.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const WHATSAPP_ENV = {
  // Bearer token for the Graph API. System-User or temporary dev tokens
  // both work; system-user tokens don't expire, dev tokens last 24h.
  accessToken: "META_WHATSAPP_ACCESS_TOKEN",
  // The numeric phone_number_id tied to the test (or production) number.
  // Shown on the Meta app dashboard under WhatsApp → API Setup.
  phoneNumberId: "META_WHATSAPP_PHONE_NUMBER_ID",
  // The string we pick to verify Meta's GET handshake.
  webhookVerifyToken: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  // The Meta app's secret — used to verify X-Hub-Signature-256 on
  // inbound POSTs. Different from accessToken.
  appSecret: "META_WHATSAPP_APP_SECRET",
} as const;

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env[WHATSAPP_ENV.accessToken] &&
      process.env[WHATSAPP_ENV.phoneNumberId] &&
      process.env[WHATSAPP_ENV.webhookVerifyToken] &&
      process.env[WHATSAPP_ENV.appSecret],
  );
}

// ─── Outbound ───────────────────────────────────────────────────────────

export interface SendWhatsappArgs {
  // E.164 WITHOUT the leading "+" — Meta's Graph API requires bare digits.
  // The module accepts either form and strips the "+" for you.
  to: string;
  body: string;
}

export interface SendWhatsappResult {
  messageId: string;
  to: string;
}

export async function sendWhatsapp(args: SendWhatsappArgs): Promise<SendWhatsappResult> {
  const accessToken = process.env[WHATSAPP_ENV.accessToken];
  const phoneNumberId = process.env[WHATSAPP_ENV.phoneNumberId];
  if (!accessToken || !phoneNumberId) {
    throw new Error(
      `WhatsApp env not configured. Missing ${WHATSAPP_ENV.accessToken} or ${WHATSAPP_ENV.phoneNumberId}`,
    );
  }
  const toDigits = args.to.replace(/^\+/, "").replace(/\D/g, "");

  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: args.body },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { messages?: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> };
  const messageId = json.messages?.[0]?.id ?? "";
  const wa_id = json.contacts?.[0]?.wa_id ?? toDigits;
  return { messageId, to: wa_id };
}

// ─── Inbound: GET handshake ────────────────────────────────────────────

export function handleVerificationHandshake(req: Request, res: Response): boolean {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe") return false;
  const expected = process.env[WHATSAPP_ENV.webhookVerifyToken];
  if (!expected) {
    res.status(503).send("WhatsApp integration not configured");
    return true;
  }
  if (token !== expected) {
    res.status(403).send("Invalid verify_token");
    return true;
  }
  res.status(200).send(typeof challenge === "string" ? challenge : "");
  return true;
}

// ─── Inbound: POST signature verification ──────────────────────────────

export function verifyWhatsappSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env[WHATSAPP_ENV.appSecret];
  if (!secret) {
    console.error("[whatsapp] webhook hit but META_WHATSAPP_APP_SECRET unset — rejecting");
    res.status(503).send("WhatsApp integration not configured");
    return;
  }
  const signature = req.header("x-hub-signature-256") ?? "";
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  if (!signature || !rawBody) {
    res.status(403).send("Missing signature");
    return;
  }
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[whatsapp] signature mismatch");
    res.status(403).send("Invalid signature");
    return;
  }
  next();
}

// ─── Inbound: event payload parsing ────────────────────────────────────

export interface WhatsappInbound {
  messageId: string;
  fromPhoneE164: string; // "+15551234567"
  senderName?: string;
  body: string;
  timestamp: string;
}

interface MetaWhatsappWebhookBody {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: Array<{
          id: string;
          from: string; // wa_id (digits only, no +)
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
      };
    }>;
  }>;
}

// Meta batches changes; this surfaces the first text message so the
// webhook handler can hand it off to intake. Status callbacks (sent,
// delivered, read) come through the same endpoint — we ignore those
// for Phase 4 and Phase 6 wires them to helpMessages.metadataJson.
export function parseInbound(raw: unknown): WhatsappInbound | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as MetaWhatsappWebhookBody;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const message = change.value?.messages?.[0];
      if (!message) continue;
      if (message.type !== "text" || !message.text?.body) continue;
      const contact = change.value?.contacts?.find((c) => c.wa_id === message.from);
      return {
        messageId: message.id,
        fromPhoneE164: `+${message.from}`,
        senderName: contact?.profile?.name,
        body: message.text.body,
        timestamp: message.timestamp,
      };
    }
  }
  return null;
}
