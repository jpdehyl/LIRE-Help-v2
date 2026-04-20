// Zoom OAuth (user-authorized / General app) — replaces the earlier
// Server-to-Server token fetch, which can't acquire chat_message:write
// scopes. Tokens live in the channel_oauth_tokens table, refreshed on
// demand; access tokens are ~1h, refresh tokens rotate on each use.

import { and, asc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { channelOauthTokens, tenants } from "../../shared/schema.js";

export const ZOOM_OAUTH_ENV = {
  clientId: "ZOOM_CLIENT_ID",
  clientSecret: "ZOOM_CLIENT_SECRET",
  // Public callback — must match the Redirect URL registered on the
  // Zoom Marketplace app exactly, byte-for-byte.
  redirectUri: "ZOOM_REDIRECT_URI",
  // Zoom user that acts as the bot / sender for replies. Also the user
  // whose OAuth consent the tokens represent.
  senderUserId: "ZOOM_SENDER_USER_ID",
} as const;

const TOKEN_URL = "https://zoom.us/oauth/token";
const AUTHORIZE_URL = "https://zoom.us/oauth/authorize";

function requireEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env[ZOOM_OAUTH_ENV.clientId];
  const clientSecret = process.env[ZOOM_OAUTH_ENV.clientSecret];
  const redirectUri = process.env[ZOOM_OAUTH_ENV.redirectUri];
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      `Zoom OAuth env not configured. Missing one of: ${Object.values(ZOOM_OAUTH_ENV).slice(0, 3).join(", ")}`,
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// Used by /auth/zoom/start to redirect the operator to Zoom's consent
// screen. Zoom appends ?code=... to the redirectUri on return.
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = requireEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface ZoomTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<ZoomTokenResponse> {
  const { clientId, clientSecret } = requireEnv();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoom token endpoint ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as ZoomTokenResponse;
}

export async function exchangeAuthorizationCode(code: string): Promise<ZoomTokenResponse> {
  const { redirectUri } = requireEnv();
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );
}

export async function refreshOAuthToken(refreshToken: string): Promise<ZoomTokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

// ─── Token persistence ──────────────────────────────────────────────────

async function resolveTenantId(): Promise<string> {
  const [t] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!t) throw new Error("No tenant found; OAuth storage requires at least one tenant.");
  return t.id;
}

export async function saveZoomTokens(resp: ZoomTokenResponse): Promise<void> {
  const tenantId = await resolveTenantId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + resp.expires_in * 1000);

  const existing = await db
    .select()
    .from(channelOauthTokens)
    .where(and(eq(channelOauthTokens.tenantId, tenantId), eq(channelOauthTokens.provider, "zoom")))
    .limit(1);

  if (existing[0]) {
    await db
      .update(channelOauthTokens)
      .set({
        accessToken: resp.access_token,
        // Zoom rotates the refresh token on every grant; fall back to
        // the old one only if Zoom omitted the field.
        refreshToken: resp.refresh_token ?? existing[0].refreshToken,
        expiresAt,
        scope: resp.scope ?? existing[0].scope,
        updatedAt: now,
      })
      .where(eq(channelOauthTokens.id, existing[0].id));
  } else {
    await db.insert(channelOauthTokens).values({
      tenantId,
      provider: "zoom",
      accessToken: resp.access_token,
      refreshToken: resp.refresh_token ?? null,
      expiresAt,
      scope: resp.scope ?? null,
    });
  }
}

// Reads the current stored token, refreshing transparently if it's
// about to expire or already has. Returns the access token string.
export async function getFreshZoomAccessToken(): Promise<string> {
  const tenantId = await resolveTenantId();
  const [row] = await db
    .select()
    .from(channelOauthTokens)
    .where(and(eq(channelOauthTokens.tenantId, tenantId), eq(channelOauthTokens.provider, "zoom")))
    .limit(1);
  if (!row) {
    throw new Error(
      "Zoom not connected. Visit /auth/zoom/start once on the production host to authorize the concierge.",
    );
  }

  const now = Date.now();
  const expiresAt = row.expiresAt ? row.expiresAt.getTime() : 0;
  // Refresh if we've already expired OR if we're within a 60s cushion;
  // avoids a narrow race where a request starts valid but the token
  // expires mid-call.
  if (expiresAt > now + 60_000) return row.accessToken;

  if (!row.refreshToken) {
    throw new Error("Zoom access token expired and no refresh_token is stored — re-authorize.");
  }

  const refreshed = await refreshOAuthToken(row.refreshToken);
  await saveZoomTokens(refreshed);
  return refreshed.access_token;
}
