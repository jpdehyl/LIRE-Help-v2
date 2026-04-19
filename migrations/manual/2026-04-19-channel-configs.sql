-- Manual migration: channel_configs table + unique index
-- Applied: 2026-04-19 (against Railway prod)
--
-- Applied by hand instead of `drizzle-kit push` because push drift wanted to
-- drop the live staff_sessions table (17 rows), which is created at runtime
-- in server/app-factory.ts and isn't declared in shared/schema.ts. Until
-- that drift is cleaned up, do not run db:push against prod.
--
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS channel_configs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_staff_id varchar REFERENCES staff_users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_configs_tenant_channel_uq
  ON channel_configs (tenant_id, channel_type);
