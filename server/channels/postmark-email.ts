// Postmark email channel adapter. Inbound via Postmark Inbound Stream
// (HTTP webhook); outbound via Postmark's REST API.
//
// Why Postmark instead of Resend for email in Phase 3:
// - Resend is send-only; inbound parsing lives with other vendors.
// - Postmark's inbound stream is mature, webhook-signed via Basic Auth,
//   and single-provider for send + receive simplifies ops.

import { ServerClient } from "postmark";
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

export const POSTMARK_ENV = {
  serverToken: "POSTMARK_SERVER_TOKEN",
  fromEmail: "POSTMARK_FROM_EMAIL",
  // Shared secret we expect Postmark to send via Basic Auth on inbound.
  // Configured as "username:password" on the Postmark inbound webhook URL
  // (Postmark → Servers → your server → Settings → Inbound → set
  // "Inbound webhook URL" to https://user:pass@host/webhooks/postmark/inbound).
  // Stored here as "user:pass".
  inboundBasicAuth: "POSTMARK_INBOUND_BASIC_AUTH",
} as const;

export function postmarkConfigured(): boolean {
  return Boolean(process.env[POSTMARK_ENV.serverToken] && process.env[POSTMARK_ENV.fromEmail]);
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  textBody: string;
  replyTo?: string;
  inReplyToMessageId?: string;
}

export interface SendEmailResult {
  messageId: string;
  to: string;
  submittedAt: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const serverToken = process.env[POSTMARK_ENV.serverToken];
  const from = process.env[POSTMARK_ENV.fromEmail];
  if (!serverToken || !from) {
    throw new Error(`Postmark env not configured. Missing ${POSTMARK_ENV.serverToken} or ${POSTMARK_ENV.fromEmail}.`);
  }
  const client = new ServerClient(serverToken);
  // Postmark automatically threads when a prior Message-ID is supplied on
  // inbound; for outbound we pass a custom header so replies thread in
  // the recipient's client. If we don't have an inReplyTo, skip the
  // header so the email opens a fresh thread.
  const headers = args.inReplyToMessageId
    ? [{ Name: "In-Reply-To", Value: `<${args.inReplyToMessageId}>` }]
    : undefined;
  const sent = await client.sendEmail({
    From: from,
    To: args.to,
    Subject: args.subject,
    TextBody: args.textBody,
    ReplyTo: args.replyTo,
    Headers: headers,
    MessageStream: "outbound",
  });
  return {
    messageId: sent.MessageID,
    to: sent.To ?? args.to,
    submittedAt: sent.SubmittedAt,
  };
}

// Postmark's inbound webhook doesn't sign payloads the way Twilio does —
// instead the recommended auth is HTTP Basic on the webhook URL. We
// check the Authorization header in constant time against the configured
// "user:pass" secret.
export function verifyPostmarkBasicAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env[POSTMARK_ENV.inboundBasicAuth];
  if (!expected) {
    console.error("[postmark] inbound hit but POSTMARK_INBOUND_BASIC_AUTH is unset — rejecting");
    res.status(503).send("Postmark inbound not configured");
    return;
  }
  const header = req.header("Authorization") ?? "";
  if (!header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="postmark"').status(401).send("Missing Basic auth");
    return;
  }
  const provided = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).send("Invalid Basic auth");
    return;
  }
  next();
}

// Subset of Postmark's inbound webhook JSON payload we actually use.
// Full shape: https://postmarkapp.com/developer/webhooks/inbound-webhook
export interface PostmarkInboundPayload {
  From: string;
  FromName?: string;
  To: string;
  Subject: string;
  TextBody: string;
  HtmlBody?: string;
  MessageID: string;
  Date: string;
  StrippedTextReply?: string;
  Headers?: Array<{ Name: string; Value: string }>;
  FromFull?: { Email: string; Name?: string; MailboxHash?: string };
}

export function parseInboundEmail(raw: unknown): PostmarkInboundPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const From = typeof body.From === "string" ? body.From : null;
  const To = typeof body.To === "string" ? body.To : null;
  const MessageID = typeof body.MessageID === "string" ? body.MessageID : null;
  const Subject = typeof body.Subject === "string" ? body.Subject : "";
  if (!From || !To || !MessageID) return null;
  // Prefer StrippedTextReply (just the new reply content, signatures +
  // quoted history removed) when available — it's what the agent should
  // actually see. Fall back to TextBody.
  const TextBody =
    typeof body.StrippedTextReply === "string" && body.StrippedTextReply.trim()
      ? body.StrippedTextReply
      : typeof body.TextBody === "string"
        ? body.TextBody
        : "";
  return {
    From,
    FromName: typeof body.FromName === "string" ? body.FromName : undefined,
    To,
    Subject,
    TextBody,
    HtmlBody: typeof body.HtmlBody === "string" ? body.HtmlBody : undefined,
    MessageID,
    Date: typeof body.Date === "string" ? body.Date : new Date().toISOString(),
    StrippedTextReply: typeof body.StrippedTextReply === "string" ? body.StrippedTextReply : undefined,
    FromFull:
      body.FromFull && typeof body.FromFull === "object"
        ? (body.FromFull as { Email: string; Name?: string; MailboxHash?: string })
        : undefined,
  };
}
