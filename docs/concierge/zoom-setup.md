# Zoom Team Chat setup (Phase 5)

One-time setup to route inbound Zoom Team Chat messages through the concierge, and to send replies back as the same Zoom user.

## 1. Create a Zoom Server-to-Server OAuth app

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop** → **Build App**
2. Pick **Server-to-Server OAuth** (simpler than a user-OAuth app — no install flow)
3. Name it `LIRE Help Concierge` or similar
4. Under **App Credentials**, note down:
   - **Account ID**
   - **Client ID**
   - **Client Secret**

## 2. Scopes

Under **Scopes**, add:

- `chat_message:read` (or `chat_message:read:admin`) — receive message events
- `chat_message:write` (or `chat_message:write:admin`) — send replies
- `imchat:read`, `imchat:write` — fallbacks some accounts require

Scope names vary slightly between Zoom account tiers. If an API call returns `4711` "Invalid access token, does not contain scopes", add the suggested scope from the error and re-activate.

## 3. Event subscription (the webhook)

Under **Feature** → **Event Subscriptions**:

1. Enable event subscriptions
2. Add a subscription named `concierge-inbound`
3. **Event notification endpoint URL**:
   ```
   https://lire-help-v2-web-production.up.railway.app/webhooks/zoom/chat
   ```
4. Add event types:
   - `Chat Message` → `Chat Message Sent`
5. Zoom will display a **Secret Token** for this subscription. Copy it.
6. Click **Validate** — Zoom will POST a challenge to the endpoint; the app responds automatically.

The Secret Token is what signs every subsequent webhook.

## 4. Environment variables (Railway)

| Var | Source |
|---|---|
| `ZOOM_ACCOUNT_ID` | App Credentials |
| `ZOOM_CLIENT_ID` | App Credentials |
| `ZOOM_CLIENT_SECRET` | App Credentials |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Secret Token from step 3 |
| `ZOOM_SENDER_USER_ID` | The Zoom user that sends replies. Use the app owner's email (e.g. `jp@dehyl.ca`). |

Redeploy after setting.

## 5. Activate + test

1. In the Zoom Marketplace app, click **Activate** (top right). The app is now live in your account.
2. Open Zoom (desktop or web) → Team Chat
3. DM the account owner (`ZOOM_SENDER_USER_ID`) — or invite them to a group chat — from another user in your Zoom workspace and send a message like "Hey, what's the HVAC status at 123 Main St?"
4. Watch Railway logs for:
   ```
   [concierge] turn complete { channel: 'zoom', stopReason: 'end_turn', ... }
   ```
5. The concierge replies in the same DM / channel.

## Troubleshooting

- **Webhook validation fails in Zoom UI**: `ZOOM_WEBHOOK_SECRET_TOKEN` on Railway doesn't match the Secret Token in the Zoom app UI. They must be identical.
- **Inbound arrives, no reply sent**: usually missing `ZOOM_SENDER_USER_ID` or scope mismatch. Check Railway logs for `Zoom chat send failed`.
- **"Invalid access token"** (4711 or similar): add the scope Zoom names in the error to the Server-to-Server app, then re-activate.
- **Sending to a non-Zoom email**: Zoom Chat only delivers to users in your own account. Replies to external senders will 400; Phase 6 adds a fallback route (e.g. forward to email).

## Known limitations (Phase 5)

- Zoom Team Chat messages only — no Zoom Phone / voicemail routing (that requires a different product + TTS + transcription).
- No file/attachment forwarding.
- Group channels replied to as DM to the sender, not back into the channel. Fixing this is a Phase 6 improvement (use `to_channel` when `channelId` is present).
