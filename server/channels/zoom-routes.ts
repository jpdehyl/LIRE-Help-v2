// Zoom Team Chat webhook. Mounted at /webhooks/zoom in app-factory.
//
// Zoom sends two distinct POST shapes on the same URL:
// 1. URL-validation challenge (once, when the subscription is created)
// 2. Actual chat events (chat_message.sent, etc.)
//
// The URL-validation POST is not signed — it's the pre-activation step,
// so we handle it before the signature middleware. Every other event
// requires a valid X-Zm-Signature.

import express, { Router, type Request, type Response } from "express";
import { intakeInbound } from "./intake.js";
import {
  ZOOM_ENV,
  buildUrlValidationResponse,
  parseInboundChat,
  verifyZoomWebhook,
} from "./zoom-chat.js";
import { runConciergeForInbound } from "../concierge/orchestrator.js";

const router = Router();

// Use raw so we can verify Zoom's HMAC against the exact bytes they
// posted. We parse the JSON ourselves inside the handler.
router.post(
  "/chat",
  express.raw({ type: "application/json", limit: "256kb" }),
  (req: Request, res: Response, next) => {
    const bodyString = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    let parsed: { event?: string; payload?: { plainToken?: string } } = {};
    try {
      parsed = bodyString ? JSON.parse(bodyString) : {};
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }

    // URL-validation handshake. Answered without signature verification
    // because the subscription isn't active yet.
    if (parsed.event === "endpoint.url_validation" && parsed.payload?.plainToken) {
      const secret = process.env[ZOOM_ENV.webhookSecret];
      if (!secret) {
        res.status(503).send("Zoom integration not configured");
        return;
      }
      res.status(200).json(buildUrlValidationResponse(secret, parsed.payload.plainToken));
      return;
    }

    // Real events: verify signature, then handle.
    verifyZoomWebhook(req, res, () => handleRealEvent(req, res, parsed));
    // NOTE: handleRealEvent schedules its own response; the middleware
    // chain terminates here via the res.status call inside the callback.
    void next;
  },
);

async function handleRealEvent(
  _req: Request,
  res: Response,
  parsed: { event?: string; payload?: unknown },
): Promise<void> {
  // Ack fast (Zoom retries on non-2xx). Run the concierge in the
  // background, same pattern as Twilio/Postmark.
  res.status(200).send("ok");

  const inbound = parseInboundChat(parsed);
  if (!inbound) return;

  const handle = inbound.senderEmail.trim().toLowerCase();
  try {
    const intake = await intakeInbound({
      channel: "zoom",
      handle,
      email: handle,
      suggestedName: inbound.senderName,
      body: inbound.message,
      providerMetadata: {
        messageId: inbound.messageId,
        zoomUserId: inbound.senderUserId,
        channelId: inbound.channelId,
        toUserId: inbound.toUserId,
      },
    });
    if (!intake) return;
    await runConciergeForInbound({
      conversationId: intake.conversationId,
      inboundBody: inbound.message,
    });
  } catch (err) {
    console.error("[zoom] inbound handling failed", err);
  }
}

export default router;
