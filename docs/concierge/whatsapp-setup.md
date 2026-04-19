# WhatsApp (Meta Cloud API) setup (Phase 4)

Uses Meta's WhatsApp Cloud API directly — not Twilio. Meta provides a free test phone number that can chat with up to 5 personal WhatsApp numbers without business verification, 1000 conversations/month free.

## 1. Create a Meta app

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Use case: **Other**
3. App type: **Business**
4. Fill in app name, your contact email; click Create.

## 2. Add the WhatsApp product

1. On the app dashboard → **Add products to your app** → find **WhatsApp** → **Set up**
2. Pick or create a Meta Business Account to attach to.
3. Under **WhatsApp → API setup** you now have:
   - A **test phone number** (Meta-provided) — this is your sending number
   - **Phone number ID** (numeric) — `META_WHATSAPP_PHONE_NUMBER_ID`
   - A **temporary access token** (24h lifespan) — good for initial testing; see step 5 for a permanent one

## 3. Allowlist your personal WhatsApp number

Under **API setup → To**, click **Manage phone number list** → **Add phone number**. Add your personal WhatsApp number. Meta texts it a 6-digit code; enter it to verify.

Once verified, your personal WhatsApp can both send messages to the test number and receive replies from it.

## 4. App secret

Under app dashboard → **App settings → Basic** → **App secret** → **Show**. This is `META_WHATSAPP_APP_SECRET` — used to verify webhook signatures. **Not the same** as the access token.

## 5. Permanent access token (optional but recommended)

The temporary token expires in 24h. For anything beyond initial testing, create a System User token:

1. [business.facebook.com](https://business.facebook.com) → **Business Settings** → **Users → System Users** → **Add**
2. Name the user (e.g. `concierge`) with role **Admin**.
3. Click the user → **Add Assets** → WhatsApp Account → your WABA → enable **Full control**.
4. Click **Generate new token** → select the app → pick scopes `whatsapp_business_messaging` and `whatsapp_business_management` → token never expires.

That's `META_WHATSAPP_ACCESS_TOKEN`.

## 6. Environment variables (Railway)

| Var | Value |
|---|---|
| `META_WHATSAPP_ACCESS_TOKEN` | From step 5 (or the temp token from step 2 for quick tests) |
| `META_WHATSAPP_PHONE_NUMBER_ID` | From step 2 |
| `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Any string you choose, e.g. `lire-help-wa-verify-xyz` |
| `META_WHATSAPP_APP_SECRET` | From step 4 |

## 7. Configure the webhook

1. In the Meta app dashboard → **WhatsApp → Configuration** → **Webhook** → **Edit**
2. **Callback URL**:
   ```
   https://lire-help-v2-web-production.up.railway.app/webhooks/whatsapp
   ```
3. **Verify token**: paste exactly what you set for `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Click **Verify and save**. Meta calls your endpoint with a GET and expects back the `hub.challenge` value — our handler answers that automatically if the verify tokens match.
5. Under **Webhook fields**, subscribe to `messages`.

## 8. Test

1. From your personal WhatsApp, send a message to the test number shown in the Meta dashboard.
2. Watch Railway logs for `[concierge] turn complete { channel: 'whatsapp', ... }`.
3. The concierge replies in the same thread on your phone.

## Troubleshooting

- **"Verify and save" fails in the Meta UI**: your `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` on Railway doesn't match what you pasted in the Meta UI, or the deploy hasn't finished.
- **Inbound arrives but reply fails with 403**: `META_WHATSAPP_APP_SECRET` is the *access token* by mistake. They're two different fields.
- **Inbound arrives but reply fails with `(#100) Recipient phone number not in allowed list`**: you're still on the test number and haven't added the recipient's personal WhatsApp at step 3.
- **No inbound at all**: subscribe to the `messages` webhook field (step 7.5). The default subscription set doesn't include it.

## Known limitations

- Text messages only. Media, stickers, reactions, and interactive templates are dropped in Phase 4. Phase 6 adds media.
- Test-number mode is limited to 5 allowlisted recipients. For real deployment, the business phone number needs to be verified via Meta Business verification (takes days).
- Status callbacks (delivered/read receipts) come through the same endpoint and are currently ignored. Phase 6 stores them on `helpMessages.metadataJson`.
