-- Add concierge_settings_json to tenants for per-tenant concierge config.
-- Matches shared/schema.ts, where this is modeled as an optional JSONB blob.
--
-- Apply manually against prod/test as needed while drizzle-kit push remains
-- unsafe for live environments. Statement is idempotent and additive only.
--
-- Usage:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-20-tenants-concierge-settings-json.sql

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS concierge_settings_json jsonb;

COMMIT;
