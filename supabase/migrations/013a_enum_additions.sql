-- 013a_enum_additions.sql
-- ============================================================
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- This migration MUST run separately, outside a transaction block.
--
-- Supabase CLI: supabase db push will handle this automatically
-- if you use the --include-all flag, but if it fails, run manually:
--
--   psql $DATABASE_URL -f 013a_enum_additions.sql
--
-- Or in Supabase SQL Editor (which runs outside transactions).
-- ============================================================

-- Add 'management' to user_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'management'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role'))
  THEN
    ALTER TYPE user_role ADD VALUE 'management';
  END IF;
END $$;

-- Add new values to suggestion_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'topic_shift'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'suggestion_type'))
  THEN
    ALTER TYPE suggestion_type ADD VALUE 'topic_shift';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'socratic_update'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'suggestion_type'))
  THEN
    ALTER TYPE suggestion_type ADD VALUE 'socratic_update';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'quiz_adjust'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'suggestion_type'))
  THEN
    ALTER TYPE suggestion_type ADD VALUE 'quiz_adjust';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'add_remediation'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'suggestion_type'))
  THEN
    ALTER TYPE suggestion_type ADD VALUE 'add_remediation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bloom_focus'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'suggestion_type'))
  THEN
    ALTER TYPE suggestion_type ADD VALUE 'bloom_focus';
  END IF;
END $$;
