-- Phase 2 of docs/superpowers/plans/2026-04-19-kb-documents.md.
-- Adds pgvector + kb_document_chunks so the concierge agent can cite
-- lease/policy/drawing content via lookup_knowledge.
--
-- Usage:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-19-kb-document-chunks.sql
--
-- Idempotent. Assumes Phase 1 migration (2026-04-19-kb-documents.sql) has run.

BEGIN;

-- pgvector ships with Railway's managed Postgres. If CREATE EXTENSION
-- fails on your instance, enable it in the Railway UI (Database → Extensions)
-- and re-run. No fallback — retrieval quality is the whole point of Phase 2.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_document_chunks (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  VARCHAR NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  tenant_id    VARCHAR NOT NULL REFERENCES tenants(id),
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  char_count   INTEGER NOT NULL,
  page_label   TEXT,
  -- voyage-3-large returns 1024-dim embeddings. If we change model we'll
  -- add a new column + migrate rather than trying to mix dims in one col.
  embedding    VECTOR(1024),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_document_chunks_document
  ON kb_document_chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_kb_document_chunks_tenant
  ON kb_document_chunks (tenant_id);

-- ivfflat defaults are fine for <100k chunks. Revisit with `lists = sqrt(N)`
-- when a single tenant exceeds that; for now the planner may prefer seq scan
-- on small tables, which is correct.
CREATE INDEX IF NOT EXISTS idx_kb_document_chunks_embedding
  ON kb_document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMIT;
