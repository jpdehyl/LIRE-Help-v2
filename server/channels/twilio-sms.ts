// Twilio SMS channel adapter.
//
// Split into two concerns:
// - sendSms(...)        outbound: called by the send_reply tool handler.
// - verifyTwilioSignature(...) inbound: express middleware for the webhook.
//
// Twilio credentials come from env vars set on Railway. If they're missing,
// sendSms throws a helpful error and the webhook middleware refuses to
// accept traffic — we never silently accept un-authenticated calls.

import twilio from "twilio";
import type { Request, Response, NextFunction } from "express";

export const TWILIO_ENV = {
  accountSid: "TWILIO_ACCOUNT_SID",
  authToken: "TWILIO_AUTH_TOKEN",
  fromNumber: "TWILIO_FROM_NUMBER",
} as const;

function requireTwilioEnv(): { accountSid: string; authToken: string; fromNumber: string } {
  const accountSid = process.env[TWILIO_ENV.accountSid];
  const authToken = process.env[TWILIO_ENV.authToken];
  const fromNumber = process.env[TWILIO_ENV.fromNumber];
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      `Twilio env not configured. Missing one of: ${Object.values(TWILIO_ENV).join(", ")}`,
    );
  }
  return { accountSid, authToken, fromNumber };
}

export function twilioConfigured(): boolean {
  return Boolean(
    process.env[TWILIO_ENV.accountSid] &&
      process.env[TWILIO_ENV.authToken] &&
      process.env[TWILIO_ENV.fromNumber],
  );
}

export interface SendSmsArgs {
  to: string; // E.164, e.g. "+15551234567"
  body: string;
}

export interface SendSmsResult {
  sid: string;
  to: string;
  from: string;
  status: string;
}

export async function sendSms(args: SendSmsArgs): Promise<SendSmsResult> {
  const { accountSid, authToken, fromNumber } = requireTwilioEnv();
  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    from: fromNumber,
    to: args.to,
    body: args.body,
  });
  return {
    sid: message.sid,
    to: message.to,
    from: message.from,
    status: message.status,
  };
}

// Express middleware — validates the X-Twilio-Signature header so we know
// the request actually came from Twilio. Without this, anyone with our
// webhook URL could inject fake "customer messages" into the helpdesk.
//
// Twilio signs the full URL (including any query string) concatenated with
// the sorted form-encoded body. Our route is mounted behind a reverse proxy
// (Railway), so we trust `X-Forwarded-Proto` / `Host` — already set by
// app.set("trust proxy", 1) in app-factory.ts.
export function verifyTwilioSignature(req: Request, res: Response, next: NextFunction) {
  const authToken = process.env[TWILIO_ENV.authToken];
  if (!authToken) {
    console.error("[twilio] webhook hit but TWILIO_AUTH_TOKEN is unset — rejecting");
    res.status(503).send("Twilio integration not configured");
    return;
  }

  const signature = req.header("X-Twilio-Signature");
  if (!signature) {
    res.status(403).send("Missing Twilio signature");
    return;
  }

  const proto = req.header("X-Forwarded-Proto") ?? (req.secure ? "https" : "http");
  const host = req.header("X-Forwarded-Host") ?? req.header("Host") ?? "";
  const url = `${proto}://${host}${req.originalUrl}`;

  const valid = twilio.validateRequest(authToken, signature, url, req.body ?? {});
  if (!valid) {
    console.warn("[twilio] signature mismatch", { url, signaturePrefix: signature.slice(0, 12) });
    res.status(403).send("Invalid Twilio signature");
    return;
  }

  next();
}

// Shape of the form-encoded body Twilio POSTs on inbound SMS. Not exhaustive
// — see https://www.twilio.com/docs/messaging/guides/webhook-request — but
// covers every field we use.
export interface TwilioInboundSms {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
}

export function parseInbound(body: Record<string, unknown>): TwilioInboundSms | null {
  const From = typeof body.From === "string" ? body.From : null;
  const To = typeof body.To === "string" ? body.To : null;
  const Body = typeof body.Body === "string" ? body.Body : null;
  const MessageSid = typeof body.MessageSid === "string" ? body.MessageSid : null;
  if (!From || !To || !MessageSid) return null;
  return {
    From,
    To,
    Body: Body ?? "",
    MessageSid,
    NumMedia: typeof body.NumMedia === "string" ? body.NumMedia : undefined,
    FromCity: typeof body.FromCity === "string" ? body.FromCity : undefined,
    FromState: typeof body.FromState === "string" ? body.FromState : undefined,
    FromCountry: typeof body.FromCountry === "string" ? body.FromCountry : undefined,
  };
}
