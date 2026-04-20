# Email setup via Postmark (Phase 3)

One-time setup to route inbound email through Postmark to the concierge, and to send replies back out via the same account.

## 1. Postmark account + server

1. Sign up at [postmarkapp.com](https://postmarkapp.com) (free tier includes 100 emails/month).
2. Create a Server. Both transactional (outbound) and inbound streams live on the same server.
3. Under the server → **API Tokens**, copy the Server Token.
4. Under **Settings → Inbound** note the inbound-stream email address. It looks like `<random>@inbound.postmarkapp.com` — that's the address you'll forward your real support mailbox to.

## 2. Domain for outbound (Sender Signature)

Under **Sender Signatures**: either
- verify a single email (quick, e.g. `concierge@yourdomain.com`), or
- verify your full domain (adds DKIM / Return-Path DNS records — recommended for any real usage).

The verified address is what you'll set as `POSTMARK_FROM_EMAIL`.

## 3. Environment variables (Railway)

Set these on the production service. The webhook returns 503 and outbound send throws if any are missing.

| Var | Value |
|---|---|
| `POSTMARK_SERVER_TOKEN` | From step 1 |
| `POSTMARK_FROM_EMAIL` | From step 2 (verified sender) |
| `POSTMARK_INBOUND_BASIC_AUTH` | Your own chosen `user:pass` string. Used to authenticate Postmark's inbound calls. Pick something random, e.g. `postmark:xSsX...`. |

## 4. Point Postmark's inbound webhook at the app

In Postmark Console → your Server → **Settings → Inbound**:

- **Inbound webhook URL**:
  ```
  https://postmark:<your-secret>@lire-help-v2-web-production.up.railway.app/webhooks/postmark/inbound
  ```
  Where the `postmark:<your-secret>` prefix matches `POSTMARK_INBOUND_BASIC_AUTH` exactly.
- Leave "Include raw email content in JSON payload" off unless you need it.

## 5. Forward real mail in

To send real mail to the concierge, forward your support address (e.g. `help@lire-help.com`) to the Postmark inbound address. Set up a forwarding rule in Gmail / Outlook / your DNS provider.

For testing, you can just email the Postmark inbound address directly.

## 6. Test

Email the Postmark inbound address (or your forwarded address) from any account. Railway logs should show:

```
[concierge] turn complete { conversationId: ..., stopReason: 'end_turn', eventCount: ... }
```

You should receive a reply at your original sender address.

## Troubleshooting

- **401 on the inbound webhook in Postmark's dashboard** — `POSTMARK_INBOUND_BASIC_AUTH` on Railway doesn't match the `user:pass` in the webhook URL. Both must be identical strings.
- **503 "Postmark inbound not configured"** — `POSTMARK_INBOUND_BASIC_AUTH` env var unset on Railway.
- **Outbound rejected "Sender not verified"** — the `POSTMARK_FROM_EMAIL` isn't a verified Sender Signature yet.
- **Replies not threading** — expected for Phase 3; we currently don't echo the original `Message-Id` back. Phase 6 adds full In-Reply-To / References handling.
