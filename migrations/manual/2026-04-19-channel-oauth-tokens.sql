-- Channel OAuth tokens table. Backs user-OAuth channels whose APIs
-- require per-user authorization (Zoom Team Chat primarily — Server-to-
-- Server apps don't expose chat_message:write).
--
-- Apply manually on prod while drizzle-kit push remains unsafe. Columns
-- and index are all additive; no data migration.
--
-- Usage:
--   psql "$DB_URL" -f migrations/manual/2026-04-19-channel-oauth-tokens.sql

BEGIN;

CREATE TABLE IF NOT EXISTS channel_oauth_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id),
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp,
  scope text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_oauth_tokens_tenant_provider_uq
  ON channel_oauth_tokens (tenant_id, provider);

COMMIT;
