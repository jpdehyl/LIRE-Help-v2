# Zoom Team Chat setup (Phase 5)

Zoom Team Chat write scopes are only available on a **General (OAuth) app**, not a Server-to-Server app. We run the OAuth consent flow once, store the refresh token, and refresh automatically from there.

## 1. Create a General app with OAuth

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop** → **Build App**
2. Pick **General**
3. App Type = **User-managed app**
4. Under **App Credentials**, note **Client ID** and **Client Secret**

## 2. Set the Redirect URL

Under **App Credentials → Redirect URL for OAuth**:

```
https://lire-help-v2-web-production.up.railway.app/auth/zoom/callback
```

Also add the same URL to **OAuth allow list**.

## 3. Scopes — you must have at least one write scope

Under **Scopes**, add BOTH read and write Team Chat scopes. Zoom's scope catalog is granular; the exact names depend on whether your Zoom account has "Advanced Chat" tier:

**Read (for webhooks to fire):**
- `team_chat:read:list_user_messages` or `team_chat:read:user_message`
- `team_chat:read:channel` (if you want channel messages)

**Write (for the concierge to reply):**
- `team_chat:write:message:user` or `chat_message:write`
- `team_chat:write:channel_message` (if replying into channels)

If Zoom displays write scopes as `imchat:write:admin` or `chat_message:write:admin`, add those instead — Zoom periodically renames scope IDs.

**If the only write scope you see is `admin`-suffixed**, your account needs admin privileges to grant it. Use your own user for the concierge identity.

## 4. Event subscription (the webhook)

Under **Feature → Event Subscriptions → Add Event Subscription**:

- **Event notification endpoint URL**:
  ```
  https://lire-help-v2-web-production.up.railway.app/webhooks/zoom/chat
  ```
- Add event: **Chat Message → Chat Message Sent**
- Zoom displays a **Secret Token** for this subscription — copy it.
- Click **Validate**. Zoom POSTs a challenge; our handler answers it automatically.

## 5. Environment variables (Railway)

| Var | Value |
|---|---|
| `ZOOM_CLIENT_ID` | App Credentials |
| `ZOOM_CLIENT_SECRET` | App Credentials |
| `ZOOM_REDIRECT_URI` | `https://lire-help-v2-web-production.up.railway.app/auth/zoom/callback` (must match step 2 byte-for-byte) |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Secret Token from step 4 |
| `ZOOM_SENDER_USER_ID` | Email of the Zoom user whose consent backs the OAuth tokens. This is the user the concierge sends replies "as". |

Redeploy after setting.

## 6. Authorize the app (grant OAuth consent)

Once Railway is live with the env vars above:

1. Open `https://lire-help-v2-web-production.up.railway.app/auth/zoom/start` in a browser. You'll need to be signed in as a staff user.
2. Zoom's consent screen appears. Review the scopes. Click **Authorize**.
3. You land on `/auth/zoom/callback` → you should see a "Zoom connected" page.

The server now has an access token (1h) and a refresh token in `channel_oauth_tokens`. Refresh is transparent.

If you see "Invalid OAuth callback" on the callback page, your session cookie was lost (incognito? cleared cookies?). Retry by visiting `/auth/zoom/start` again.

## 7. Test

1. In Zoom Team Chat, DM the `ZOOM_SENDER_USER_ID` account from any other Zoom user in your workspace and send a message.
2. Railway logs should show: `[concierge] turn complete { channel: 'zoom', ... }`
3. The concierge replies in the same DM.

## Troubleshooting

- **Validation handshake fails in the Zoom UI**: `ZOOM_WEBHOOK_SECRET_TOKEN` mismatch, OR the deploy hasn't finished picking up the var.
- **OAuth consent screen lists no scopes / fewer than expected**: the app hasn't saved the scopes you added; go back to Scopes, re-save, then retry `/auth/zoom/start`.
- **"Zoom not connected" when replying**: OAuth flow hasn't been run yet. Visit `/auth/zoom/start` once.
- **"Invalid access token, does not contain scopes"** on send: add the missing scope Zoom names in the error, re-save, revoke the existing install in Zoom User Profile → Apps, then re-run `/auth/zoom/start` to re-consent with the new scopes.
- **Replies to group-channel messages DM the sender**: intentional for Phase 5. Phase 6 posts back into the channel when `channelId` is present on the inbound event.

## Why not Server-to-Server OAuth

Server-to-Server apps use the `account_credentials` grant. That grant type can't acquire `chat_message:write` / `team_chat:write:*` scopes — they require user consent. We tried this first; it's a dead end for bots that need to send messages.
