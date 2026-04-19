-- Concierge Phase 1 — additive schema changes only.
-- Matches shared/schema.ts (PR #17, merged 2026-04-19).
--
-- Apply manually against prod while drizzle-kit push remains unsafe (it
-- still proposes to drop staff_sessions until that table is added to the
-- Drizzle schema). Both statements are idempotent.
--
-- Usage:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-19-concierge-phase-1.sql
--
-- Verify afterwards:
--   psql "$DB_URL" -c "\d help_messages" -c "\d help_tickets"

BEGIN;

-- Tracks whether a message was authored by a human operator, by the
-- concierge Managed Agent, or by the workflow/system. Lets the dashboard
-- compute % autonomous without brittle string matching on authorLabel.
ALTER TABLE help_messages
  ADD COLUMN IF NOT EXISTS message_source TEXT NOT NULL DEFAULT 'human';

-- Time in milliseconds between conversation open and the first response
-- (AI or human). Populated by the concierge session runner when it sends
-- a reply, or by the inbox UI when a staff user does. Used for the
-- dashboard "avg response" metric.
ALTER TABLE help_tickets
  ADD COLUMN IF NOT EXISTS response_latency_ms INTEGER;

COMMIT;
