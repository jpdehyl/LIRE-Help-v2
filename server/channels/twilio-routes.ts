// Twilio webhook routes. Mounted at /webhooks/twilio in app-factory.
//
// Twilio expects:
// - a 200 response within 15s (empty TwiML is fine)
// - form-encoded POST body
// - X-Twilio-Signature header we validate against our auth token
//
// We keep the handler tight: verify signature, persist the inbound,
// dispatch the concierge turn asynchronously, respond 200.

import express, { Router } from "express";
import { intakeInbound } from "./intake.js";
import { parseInbound, verifyTwilioSignature } from "./twilio-sms.js";
import { runConciergeForInbound } from "../concierge/orchestrator.js";
import { normalizePhoneE164 } from "./phone.js";

const router = Router();

// Twilio posts form-encoded, not JSON. Also: urlencoded MUST be parsed
// BEFORE signature verification — validateRequest hashes the sorted body
// fields.
router.post(
  "/sms",
  express.urlencoded({ extended: false, limit: "32kb" }),
  verifyTwilioSignature,
  async (req, res) => {
    const body = parseInbound(req.body ?? {});
    if (!body) {
      res.status(400).send("Invalid Twilio payload");
      return;
    }

    // Respond fast so Twilio doesn't retry; run the concierge turn in the
    // background. Empty TwiML = "accepted, no immediate reply" — the agent
    // sends a reply over the Twilio REST API via send_reply once it's ready.
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    const handle = normalizePhoneE164(body.From);
    if (!handle) {
      console.warn("[twilio] inbound from non-E.164 number, dropping:", body.From);
      return;
    }

    try {
      const intake = await intakeInbound({
        channel: "sms",
        handle,
        body: body.Body,
        suggestedName: body.FromCity ? `${body.FromCity} caller` : undefined,
        providerMetadata: {
          MessageSid: body.MessageSid,
          FromCity: body.FromCity,
          FromState: body.FromState,
          FromCountry: body.FromCountry,
        },
      });
      if (!intake) return;
      await runConciergeForInbound({
        conversationId: intake.conversationId,
        inboundBody: body.Body,
      });
    } catch (err) {
      console.error("[twilio] inbound handling failed", err);
    }
  },
);

export default router;
