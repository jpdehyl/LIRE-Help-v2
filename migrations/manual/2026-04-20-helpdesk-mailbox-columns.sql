-- Hotfix: add missing mailbox visibility columns expected by helpdesk code.
-- This is a surgical prod patch for LIRE-Help-v2 after inbox mailbox actions
-- landed before the corresponding DB columns existed in production.
--
-- Safe / idempotent.

BEGIN;

ALTER TABLE help_conversations
  ADD COLUMN IF NOT EXISTS visibility_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS previous_visibility_status text,
  ADD COLUMN IF NOT EXISTS visibility_changed_at timestamp,
  ADD COLUMN IF NOT EXISTS visibility_changed_by_staff_id varchar,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp,
  ADD COLUMN IF NOT EXISTS deleted_by_staff_id varchar,
  ADD COLUMN IF NOT EXISTS delete_reason text,
  ADD COLUMN IF NOT EXISTS snoozed_by_staff_id varchar;

UPDATE help_conversations
SET visibility_status = 'active'
WHERE visibility_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'help_conv_visibility_changed_by_staff_fk'
  ) THEN
    ALTER TABLE help_conversations
      ADD CONSTRAINT help_conv_visibility_changed_by_staff_fk
      FOREIGN KEY (visibility_changed_by_staff_id) REFERENCES staff_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'help_conv_deleted_by_staff_fk'
  ) THEN
    ALTER TABLE help_conversations
      ADD CONSTRAINT help_conv_deleted_by_staff_fk
      FOREIGN KEY (deleted_by_staff_id) REFERENCES staff_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'help_conv_snoozed_by_staff_fk'
  ) THEN
    ALTER TABLE help_conversations
      ADD CONSTRAINT help_conv_snoozed_by_staff_fk
      FOREIGN KEY (snoozed_by_staff_id) REFERENCES staff_users(id);
  END IF;
END $$;

COMMIT;
