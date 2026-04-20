-- Rename help_customers -> help_occupants and migrate the fields that
-- referred to it. The product is property management, and the occupant is
-- the tenant contact tied to a lease at a property. "customer" was a
-- generic helpdesk carry-over that doesn't match the domain.
--
-- Also migrates the linked column on help_conversations and the
-- waiting_on_customer status value to waiting_on_occupant. See
-- shared/schema.ts for the Drizzle equivalents.
--
-- Idempotent. Apply manually in prod/test:
--   DB_URL="$(railway variables get DATABASE_PUBLIC_URL)" \
--     psql "$DB_URL" -f migrations/manual/2026-04-20-rename-help-customers-to-occupants.sql
--
-- Verify afterwards:
--   psql "$DB_URL" -c "\d help_occupants"
--   psql "$DB_URL" -c "\d help_conversations"
--   psql "$DB_URL" -c "SELECT DISTINCT status FROM help_conversations;"

BEGIN;

-- 1. Rename the table.
ALTER TABLE IF EXISTS help_customers RENAME TO help_occupants;

-- 2. Rename the columns on help_conversations that point at occupants /
--    carry their last-message timestamp. Two renames inside a single
--    transaction so a partial failure rolls both back.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'help_conversations' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE help_conversations RENAME COLUMN customer_id TO occupant_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'help_conversations' AND column_name = 'last_customer_message_at'
  ) THEN
    ALTER TABLE help_conversations RENAME COLUMN last_customer_message_at TO last_occupant_message_at;
  END IF;
END $$;

-- 3. Migrate the status enum value. Conversations persisted under the old
--    literal stay usable — we just rewrite the string in place.
UPDATE help_conversations
SET status = 'waiting_on_occupant'
WHERE status = 'waiting_on_customer';

-- 4. Same rewrite for help_tickets if it mirrors conversation status.
UPDATE help_tickets
SET status = 'waiting_on_occupant'
WHERE status = 'waiting_on_customer';

-- 5. Message type literal: help_messages.message_type stored "customer"
--    for inbound tenant messages. Flip to "occupant" to match the new
--    TimelineItemType union, and update the column DEFAULT so new rows
--    written without an explicit messageType pick up the new literal.
UPDATE help_messages
SET message_type = 'occupant'
WHERE message_type = 'customer';

ALTER TABLE help_messages
  ALTER COLUMN message_type SET DEFAULT 'occupant';

COMMIT;
