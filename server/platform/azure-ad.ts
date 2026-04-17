import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { staffUsers, tenants } from "../../shared/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Azure AD OIDC auth provider.
//
// Enabled when AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID + AZURE_AD_CLIENT_SECRET
// are present. Falls back to the existing session/password flow otherwise.
//
// Flow:
//   1. /api/auth/azure/login        → redirects user to Microsoft with PKCE + state
//   2. /api/auth/azure/callback     → exchanges code for tokens, validates id_token,
//                                     upserts the staff_users row, sets session.
//
// We deliberately do NOT pull in passport or openid-client yet — this is a
// direct implementation so compliance can audit every network call. Swap to an
// SDK once Berkeley IT approves the dependency.
// ─────────────────────────────────────────────────────────────────────────────

export type AzureAdConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  homeTenantSlug: string; // which LIRE tenant (e.g. "berkeley") does this Azure AD tenant map to
};

export function readAzureAdConfig(): AzureAdConfig | null {
  const tenantId = process.env["AZURE_AD_TENANT_ID"];
  const clientId = process.env["AZURE_AD_CLIENT_ID"];
  const clientSecret = process.env["AZURE_AD_CLIENT_SECRET"];
  const redirectUri = process.env["AZURE_AD_REDIRECT_URI"];
  const homeTenantSlug = process.env["AZURE_AD_HOME_TENANT_SLUG"] ?? "berkeley";

  if (!tenantId || !clientId || !clientSecret || !redirectUri) return null;
  return { tenantId, clientId, clientSecret, redirectUri, homeTenantSlug };
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function authorityBase(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}`;
}

// ─── Step 1: Build authorization URL ────────────────────────────────────────

export function buildAuthorizationUrl(cfg: AzureAdConfig, req: Request): string {
  const state = base64url(randomBytes(24));
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

  (req.session as any).azureAdPkce = { state, codeVerifier };

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    response_mode: "query",
    scope: "openid profile email offline_access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${authorityBase(cfg.tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
}

// ─── Step 2: Exchange code for tokens ───────────────────────────────────────

type TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function exchangeCodeForTokens(
  cfg: AzureAdConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "openid profile email offline_access",
    code,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${authorityBase(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

type IdTokenClaims = {
  oid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  tid: string;
  iss: string;
  aud: string;
  exp: number;
};

function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const payload = Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(payload) as IdTokenClaims;
}

// NOTE: full signature verification against the Microsoft JWKS is required
// before production use. For the pilot we validate issuer + audience + exp
// and rely on TLS + the token-exchange receipt to bind the id_token to this
// request. Wire up a JWKS verifier before the first real Berkeley login.
function validateIdTokenClaims(claims: IdTokenClaims, cfg: AzureAdConfig) {
  const expectedAudience = cfg.clientId;
  const expectedIssuer = `https://login.microsoftonline.com/${cfg.tenantId}/v2.0`;
  if (claims.aud !== expectedAudience) throw new Error("id_token audience mismatch");
  if (claims.iss !== expectedIssuer) throw new Error("id_token issuer mismatch");
  if (claims.exp * 1000 < Date.now()) throw new Error("id_token expired");
  if (claims.tid !== cfg.tenantId) throw new Error("id_token tenant id mismatch");
}

// ─── Step 3: Upsert staff user + set session ────────────────────────────────

async function upsertStaffFromClaims(cfg: AzureAdConfig, claims: IdTokenClaims) {
  const email = (claims.email ?? claims.preferred_username ?? "").toLowerCase();
  if (!email) throw new Error("No email in id_token");

  const [tenantRow] = await db.select().from(tenants).where(eq(tenants.slug, cfg.homeTenantSlug)).limit(1);
  if (!tenantRow) throw new Error(`Home tenant not found: ${cfg.homeTenantSlug}`);

  const [existing] = await db.select().from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
  if (existing) {
    await db
      .update(staffUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(staffUsers.id, existing.id));
    return existing;
  }

  const [inserted] = await db
    .insert(staffUsers)
    .values({
      email,
      passwordHash: "azure-ad-sso",
      name: claims.name ?? email,
      role: "readonly",
      tenantId: tenantRow.id,
      isActive: true,
      lastLoginAt: new Date(),
    })
    .returning();

  return inserted;
}

export async function handleAzureAdCallback(req: Request, res: Response, cfg: AzureAdConfig) {
  const pkce = (req.session as any).azureAdPkce as { state: string; codeVerifier: string } | undefined;
  const { code, state } = req.query as { code?: string; state?: string };

  if (!pkce) return res.status(400).send("No PKCE session state");
  if (!code || !state || state !== pkce.state) return res.status(400).send("Invalid state");

  try {
    const tokens = await exchangeCodeForTokens(cfg, code, pkce.codeVerifier);
    const claims = decodeIdToken(tokens.id_token);
    validateIdTokenClaims(claims, cfg);

    const user = await upsertStaffFromClaims(cfg, claims);
    const { setStaffSession } = await import("../helpers/authHelpers.js");
    await setStaffSession(req, user);
    delete (req.session as any).azureAdPkce;

    req.session.save((err) => {
      if (err) {
        console.error("[azure-ad callback] session save error:", err);
        return res.status(500).send("Session error");
      }
      return res.redirect("/dashboard");
    });
  } catch (err) {
    console.error("[azure-ad callback]", err);
    return res.status(500).send("Azure AD authentication failed");
  }
}
