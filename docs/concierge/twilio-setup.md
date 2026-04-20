# Twilio SMS setup (Phase 2)

One-time setup to point Twilio at the concierge.

## 1. Environment variables (Railway)

Set these on the production service. The app refuses to send (and rejects incoming webhooks) without them.

| Var | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC…` from Twilio Console → Account |
| `TWILIO_AUTH_TOKEN` | Primary auth token (rotate if ever pasted in chat) |
| `TWILIO_FROM_NUMBER` | The phone number messages will be sent from, E.164 (e.g. `+18157433066`) |

## 2. Concierge agent IDs

Run once, locally, with `ANTHROPIC_API_KEY` set:

```
railway run npm run concierge:setup
```

It prints three lines. Paste them into Railway as env vars:

| Var | Source |
|---|---|
| `CONCIERGE_AGENT_ID` | from setup script |
| `CONCIERGE_AGENT_VERSION` | from setup script |
| `CONCIERGE_ENVIRONMENT_ID` | from setup script |

## 3. Point Twilio at the webhook

In Twilio Console → Phone Numbers → Manage → Active numbers → click your SMS-capable number:

- Under **Messaging** → **A message comes in**
  - Set to: `Webhook`
  - URL: `https://lire-help-v2-web-production.up.railway.app/webhooks/twilio/sms`
  - HTTP method: `POST`
- Save

## 4. Test

Text the Twilio number from your phone. In the app's Railway logs you should see:

```
[concierge] turn complete { conversationId: ..., stopReason: 'end_turn', eventCount: ... }
```

And you should receive an SMS reply back. The message will appear in the inbox as an "ai"-sourced reply, and the dashboard's `% autonomous` number should tick up.

## Troubleshooting

- **Twilio returns 403**: the app rejected the webhook signature. Usually either `TWILIO_AUTH_TOKEN` mismatch or the webhook URL doesn't match what Twilio is signing (check `https://` vs `http://` — Railway always terminates HTTPS).
- **Agent never replies**: `CONCIERGE_*` env vars missing. Check Railway logs for `[concierge] identity env vars missing`.
- **"Twilio env not configured"**: one of the three Twilio vars is missing.
- **AI replies not marked autonomous in dashboard**: `message_source` column not present on `help_messages`. Re-run the Phase 1 SQL migration.
