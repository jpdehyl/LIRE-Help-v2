-- Add tenant_id to platform_knowledge so the KB is tenant-scoped.
-- Matches shared/schema.ts (getPlatformKnowledge filters on tenant_id).
--
-- Unscoped rows (created before tenant scoping existed) are moved to a
-- "system" tenant so NOT NULL can be applied without data loss. If any of
-- those rows actually belong to a real tenant, reassign them manually
-- AFTER this migration runs:
--
--   UPDATE platform_knowledge SET tenant_id = '<real-tenant-id>'
--    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'system');
--
-- Usage:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-19-platform-knowledge-tenant-id.sql
--
-- All statements are idempotent.

BEGIN;

ALTER TABLE platform_knowledge
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR;

-- Create the "system" tenant only if we actually have unscoped rows that
-- need a home. Avoids polluting fresh databases.
INSERT INTO tenants (slug, name)
SELECT 'system', 'System'
 WHERE EXISTS (SELECT 1 FROM platform_knowledge WHERE tenant_id IS NULL)
   AND NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'system');

UPDATE platform_knowledge
   SET tenant_id = (SELECT id FROM tenants WHERE slug = 'system')
 WHERE tenant_id IS NULL;

ALTER TABLE platform_knowledge
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_knowledge_tenant_id_fkey'
  ) THEN
    ALTER TABLE platform_knowledge
      ADD CONSTRAINT platform_knowledge_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_knowledge_tenant
  ON platform_knowledge (tenant_id);

COMMIT;
