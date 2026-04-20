-- KB documents — Phase 1 of docs/superpowers/plans/2026-04-19-kb-documents.md.
-- Stores uploaded file metadata + extracted plaintext. Bytes live on the
-- Railway volume at RAILWAY_VOLUME_MOUNT_PATH/kb-documents/<tenantId>/<id>.<ext>.
--
-- Phase 2 will add kb_document_chunks + pgvector; leaving that for a
-- separate migration so this one ships without the pgvector extension.
--
-- Usage:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-19-kb-documents.sql
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS kb_documents (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             VARCHAR NOT NULL REFERENCES tenants(id),
  property_id           VARCHAR,
  kind                  TEXT NOT NULL,
  title                 TEXT NOT NULL,
  original_name         TEXT NOT NULL,
  mime_type             TEXT NOT NULL,
  size_bytes            INTEGER NOT NULL,
  storage_path          TEXT NOT NULL,
  extract_status        TEXT NOT NULL DEFAULT 'pending',
  extract_error         TEXT,
  extracted_text        TEXT,
  uploaded_by_staff_id  VARCHAR,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_tenant
  ON kb_documents (tenant_id);

CREATE INDEX IF NOT EXISTS idx_kb_documents_tenant_property
  ON kb_documents (tenant_id, property_id);

COMMIT;
