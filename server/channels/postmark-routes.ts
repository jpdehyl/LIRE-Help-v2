// Postmark inbound webhook. Mounted at /webhooks/postmark in app-factory.
//
// Postmark POSTs JSON when a new email arrives in the inbound stream.
// Authentication is via HTTP Basic Auth configured on the webhook URL
// (Postmark → Servers → your server → Settings → Inbound → set the
// webhook URL to include "https://user:pass@host/...").

import express, { Router } from "express";
import { intakeInbound } from "./intake.js";
import { parseInboundEmail, verifyPostmarkBasicAuth } from "./postmark-email.js";
import { runConciergeForInbound } from "../concierge/orchestrator.js";

const router = Router();

// 2MB limit covers most text + HTML bodies with a generous margin. Postmark
// attachments aren't consumed yet; when they are we'll need to bump this.
router.post(
  "/inbound",
  express.json({ limit: "2mb" }),
  verifyPostmarkBasicAuth,
  async (req, res) => {
    const payload = parseInboundEmail(req.body);
    if (!payload) {
      res.status(400).send("Invalid Postmark payload");
      return;
    }

    // Postmark retries on non-2xx, so ack fast; run the concierge turn in
    // the background (same pattern as the Twilio SMS webhook).
    res.status(200).send("ok");

    const handle = payload.From.trim().toLowerCase();
    try {
      const intake = await intakeInbound({
        channel: "email",
        handle,
        email: handle,
        suggestedName: payload.FromName ?? payload.FromFull?.Name,
        subject: payload.Subject,
        body: payload.TextBody,
        providerMetadata: {
          MessageID: payload.MessageID,
          To: payload.To,
          Date: payload.Date,
        },
      });
      if (!intake) return;
      await runConciergeForInbound({
        conversationId: intake.conversationId,
        inboundBody: payload.TextBody,
      });
    } catch (err) {
      console.error("[postmark] inbound handling failed", err);
    }
  },
);

export default router;
