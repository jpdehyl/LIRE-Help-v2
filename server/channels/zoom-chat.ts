// Zoom Team Chat channel adapter.
//
// Inbound: Zoom posts to /webhooks/zoom/chat for the `chat_message.sent`
// event. The first POST Zoom ever sends is a URL-validation challenge —
// we must answer with HMAC(secretToken, plainToken) before Zoom will
// activate the subscription. After that, every event is signed via the
// X-Zm-Signature / X-Zm-Request-Timestamp pair and we verify before
// handing off.
//
// Outbound: we use Zoom's Chat API, authenticated via Server-to-Server
// OAuth (client_credentials grant). Access tokens live ~1h; we cache one
// in-memory per process and refresh on demand.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const ZOOM_ENV = {
  accountId: "ZOOM_ACCOUNT_ID",
  clientId: "ZOOM_CLIENT_ID",
  clientSecret: "ZOOM_CLIENT_SECRET",
  webhookSecret: "ZOOM_WEBHOOK_SECRET_TOKEN",
  // The Zoom user the concierge sends replies "as". In Server-to-Server
  // OAuth world this is typically the app owner's account. Can be an
  // email address or Zoom userId.
  senderUserId: "ZOOM_SENDER_USER_ID",
} as const;

export function zoomConfigured(): boolean {
  return Boolean(
    process.env[ZOOM_ENV.accountId] &&
      process.env[ZOOM_ENV.clientId] &&
      process.env[ZOOM_ENV.clientSecret] &&
      process.env[ZOOM_ENV.senderUserId],
  );
}

// ─── Access-token cache ─────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let cachedToken: CachedToken | null = null;

async function getZoomAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const accountId = process.env[ZOOM_ENV.accountId];
  const clientId = process.env[ZOOM_ENV.clientId];
  const clientSecret = process.env[ZOOM_ENV.clientSecret];
  if (!accountId || !clientId || !clientSecret) {
    throw new Error(`Zoom env not configured. Missing one of: ${Object.values(ZOOM_ENV).slice(0, 3).join(", ")}`);
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom token fetch failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return cachedToken.accessToken;
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

  const accessToken = await getZoomAccessToken();
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
