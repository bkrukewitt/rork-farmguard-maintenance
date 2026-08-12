-- =============================================================================
-- FarmGuard: Add app version / build info to farm_members
-- Run on the PRIMARY writable database (not a read replica).
--
-- If SQL Editor fails with "cannot execute ALTER TABLE in a read-only transaction":
--   1. Restore the project if paused (Supabase Dashboard home)
--   2. Use Settings → Database → Connection string (URI) with postgres user
-- =============================================================================

-- Step 1: Diagnose connection (must show postgres, false, off)
SELECT
  current_user,
  pg_is_in_recovery() AS is_read_replica,
  current_setting('transaction_read_only') AS tx_read_only;

-- Step 2: Abort if connected read-only (prevents confusing partial failures)
DO $$
BEGIN
  IF current_user = 'supabase_read_only_user' OR pg_is_in_recovery() THEN
    RAISE EXCEPTION
      'Read-only connection detected (user=%, replica=%). Restore project or connect via direct postgres URI.',
      current_user, pg_is_in_recovery();
  END IF;
END $$;

-- Step 3: Add columns
ALTER TABLE public.farm_members
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS build_number text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS app_last_seen timestamptz;

-- Step 4: Verify (expect 4 rows)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'farm_members'
  AND column_name IN ('app_version', 'build_number', 'platform', 'app_last_seen')
ORDER BY column_name;
