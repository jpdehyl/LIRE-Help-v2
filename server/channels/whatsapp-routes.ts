// WhatsApp Cloud API webhook. Mounted at /webhooks/whatsapp in app-factory.
//
// Meta uses the same URL for both:
//   - GET: verification handshake (hub.challenge echo)
//   - POST: signed message events (X-Hub-Signature-256)

import express, { Router, type Request, type Response } from "express";
import { intakeInbound } from "./intake.js";
import {
  handleVerificationHandshake,
  parseInbound,
  verifyWhatsappSignature,
} from "./whatsapp-meta.js";
import { runConciergeForInbound } from "../concierge/orchestrator.js";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  // handleVerificationHandshake writes the response itself and returns
  // true when it recognised the request shape.
  if (!handleVerificationHandshake(req, res)) {
    res.status(400).send("Expected hub.mode=subscribe");
  }
});

// Raw body so the HMAC verifier sees exactly what Meta signed.
router.post(
  "/",
  express.raw({ type: "application/json", limit: "512kb" }),
  verifyWhatsappSignature,
  async (req, res) => {
    // Ack immediately — Meta retries on non-2xx within a few seconds.
    res.status(200).send("ok");

    const bodyString = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    if (!bodyString) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyString);
    } catch {
      console.warn("[whatsapp] inbound JSON parse failed");
      return;
    }

    const inbound = parseInbound(parsed);
    if (!inbound) return; // not a text message we handle (status callback, media, etc.)

    try {
      const intake = await intakeInbound({
        channel: "whatsapp",
        handle: inbound.fromPhoneE164,
        suggestedName: inbound.senderName,
        body: inbound.body,
        providerMetadata: {
          messageId: inbound.messageId,
          provider: "meta-whatsapp",
          timestamp: inbound.timestamp,
        },
      });
      if (!intake) return;
      await runConciergeForInbound({
        conversationId: intake.conversationId,
        inboundBody: inbound.body,
      });
    } catch (err) {
      console.error("[whatsapp] inbound handling failed", err);
    }
  },
);

export default router;
