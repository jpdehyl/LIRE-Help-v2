// Zoom Team Chat channel adapter.
//
// Inbound: Zoom posts to /webhooks/zoom/chat for the `chat_message.sent`
// event. The first POST Zoom ever sends is a URL-validation challenge —
// we must answer with HMAC(secretToken, plainToken) before Zoom will
// activate the subscription. After that, every event is signed via the
// X-Zm-Signature / X-Zm-Request-Timestamp pair and we verify before
// handing off.
//
// Outbound: we use Zoom's Chat API, authenticated via a user-OAuth
// (General app) flow — Server-to-Server OAuth does not expose
// chat_message:write scopes. Tokens are persisted in
// channel_oauth_tokens and refreshed on demand; see zoom-oauth.ts.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getFreshZoomAccessToken, ZOOM_OAUTH_ENV } from "./zoom-oauth.js";

export const ZOOM_ENV = {
  // Shared with the OAuth flow — the same app's client credentials.
  clientId: ZOOM_OAUTH_ENV.clientId,
  clientSecret: ZOOM_OAUTH_ENV.clientSecret,
  redirectUri: ZOOM_OAUTH_ENV.redirectUri,
  webhookSecret: "ZOOM_WEBHOOK_SECRET_TOKEN",
  // The Zoom user the concierge sends replies "as" (email or userId).
  // This is the user whose OAuth consent is stored in
  // channel_oauth_tokens and whose scopes back every send.
  senderUserId: ZOOM_OAUTH_ENV.senderUserId,
} as const;

export function zoomConfigured(): boolean {
  return Boolean(
    process.env[ZOOM_ENV.clientId] &&
      process.env[ZOOM_ENV.clientSecret] &&
      process.env[ZOOM_ENV.redirectUri] &&
      process.env[ZOOM_ENV.senderUserId],
  );
}

// ─── Outbound ───────────────────────────────────────────────────────────

export interface SendZoomChatArgs {
  // Recipient. For a 1:1 DM pass the recipient's email in `toContact`;
  // for a channel message pass the channel's jid in `toChannel`.
  toContact?: string;
  toChannel?: string;
  message: string;
}

export interface SendZoomChatResult {
  messageId: string;
  sentAt: string;
}

export async function sendZoomChat(args: SendZoomChatArgs): Promise<SendZoomChatResult> {
  if (!args.toContact && !args.toChannel) {
    throw new Error("sendZoomChat: supply either toContact or toChannel");
  }
  const senderUserId = process.env[ZOOM_ENV.senderUserId];
  if (!senderUserId) {
    throw new Error(`Zoom env not configured. Missing ${ZOOM_ENV.senderUserId}`);
  }

  const accessToken = await getFreshZoomAccessToken();
  const payload: Record<string, string> = { message: args.message };
  if (args.toContact) payload.to_contact = args.toContact;
  if (args.toChannel) payload.to_channel = args.toChannel;

  const res = await fetch(`https://api.zoom.us/v2/chat/users/${encodeURIComponent(senderUserId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom chat send failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string; sent_time?: string; date_time?: string };
  return {
    messageId: json.id,
    sentAt: json.sent_time ?? json.date_time ?? new Date().toISOString(),
  };
}

// ─── Inbound: URL validation + signature verification ───────────────────

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

// Handle Zoom's URL-validation handshake. Called once when the subscription
// is created in the Zoom Marketplace UI. Returns the challenge response.
export function buildUrlValidationResponse(secretToken: string, plainToken: string): { plainToken: string; encryptedToken: string } {
  return {
    plainToken,
    encryptedToken: hmacHex(secretToken, plainToken),
  };
}

// Verify every non-challenge webhook. Zoom signs as:
//   v0=HMAC-SHA256(secretToken, "v0:" + timestamp + ":" + rawBody)
// The raw body must be the exact bytes Zoom posted — not re-serialized,
// so the route mounts `express.raw` before this middleware.
export function verifyZoomWebhook(req: Request, res: Response, next: NextFunction) {
  const secret = process.env[ZOOM_ENV.webhookSecret];
  if (!secret) {
    console.error("[zoom] webhook hit but ZOOM_WEBHOOK_SECRET_TOKEN unset — rejecting");
    res.status(503).send("Zoom integration not configured");
    return;
  }
  const signature = req.header("x-zm-signature") ?? "";
  const timestamp = req.header("x-zm-request-timestamp") ?? "";
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
  if (!signature || !timestamp || !rawBody) {
    res.status(403).send("Missing Zoom signature headers");
    return;
  }

  const expected = `v0=${hmacHex(secret, `v0:${timestamp}:${rawBody}`)}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[zoom] signature mismatch");
    res.status(403).send("Invalid Zoom signature");
    return;
  }
  next();
}

// ─── Inbound: event payload parsing ─────────────────────────────────────

export interface ZoomChatInbound {
  messageId: string;
  senderEmail: string;
  senderName?: string;
  senderUserId?: string;
  message: string;
  toUserId?: string;
  channelId?: string;
}

export function parseInboundChat(raw: unknown): ZoomChatInbound | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as { event?: string; payload?: unknown };
  if (event.event !== "chat_message.sent") return null;
  const payload = event.payload as { object?: unknown } | undefined;
  const obj = payload?.object as Record<string, unknown> | undefined;
  if (!obj) return null;

  const senderEmail = typeof obj.sender === "string" ? obj.sender : null;
  const message = typeof obj.message === "string" ? obj.message : null;
  const messageId = typeof obj.message_id === "string" ? obj.message_id : null;
  if (!senderEmail || message === null || !messageId) return null;

  return {
    messageId,
    senderEmail,
    senderName: typeof obj.sender_name === "string" ? obj.sender_name : undefined,
    senderUserId: typeof obj.sender_user_id === "string" ? obj.sender_user_id : undefined,
    message,
    toUserId: typeof obj.to_user_id === "string" ? obj.to_user_id : undefined,
    channelId: typeof obj.channel_id === "string" ? obj.channel_id : undefined,
  };
}
