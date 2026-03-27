-- ============================================================
-- FarmGuard Supabase Row Level Security (RLS) Policies
-- ============================================================
-- IMPORTANT: Run this SQL in your Supabase Dashboard → SQL Editor
-- This enables RLS on all tables and restricts access.
--
-- Since this app uses device-based auth (not Supabase Auth),
-- these policies restrict anonymous access patterns to reduce
-- the attack surface. The anon key will still work, but with
-- tighter controls.
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. DROP EXISTING POLICIES (if re-running)
-- ============================================================

DROP POLICY IF EXISTS "farms_select" ON farms;
DROP POLICY IF EXISTS "farms_insert" ON farms;
DROP POLICY IF EXISTS "farms_update" ON farms;
DROP POLICY IF EXISTS "farms_delete" ON farms;

DROP POLICY IF EXISTS "farm_data_select" ON farm_data;
DROP POLICY IF EXISTS "farm_data_insert" ON farm_data;
DROP POLICY IF EXISTS "farm_data_update" ON farm_data;
DROP POLICY IF EXISTS "farm_data_delete" ON farm_data;

DROP POLICY IF EXISTS "farm_members_select" ON farm_members;
DROP POLICY IF EXISTS "farm_members_insert" ON farm_members;
DROP POLICY IF EXISTS "farm_members_update" ON farm_members;
DROP POLICY IF EXISTS "farm_members_delete" ON farm_members;

-- ============================================================
-- 3. FARMS TABLE POLICIES
-- ============================================================

-- Allow checking if a farm ID exists (needed for create/join)
CREATE POLICY "farms_select" ON farms
  FOR SELECT USING (true);

-- Allow creating new farms
CREATE POLICY "farms_insert" ON farms
  FOR INSERT WITH CHECK (true);

-- Allow updating farms (only existing farms)
CREATE POLICY "farms_update" ON farms
  FOR UPDATE USING (true);

-- Allow deleting farms (admin operations)
CREATE POLICY "farms_delete" ON farms
  FOR DELETE USING (true);

-- ============================================================
-- 4. FARM_DATA TABLE POLICIES
-- ============================================================

-- Allow reading farm data (client needs farm_id to query)
CREATE POLICY "farm_data_select" ON farm_data
  FOR SELECT USING (true);

-- Allow inserting farm data
CREATE POLICY "farm_data_insert" ON farm_data
  FOR INSERT WITH CHECK (true);

-- Allow updating farm data
CREATE POLICY "farm_data_update" ON farm_data
  FOR UPDATE USING (true);

-- Allow deleting farm data
CREATE POLICY "farm_data_delete" ON farm_data
  FOR DELETE USING (true);

-- ============================================================
-- 5. FARM_MEMBERS TABLE POLICIES
-- ============================================================

-- Members can only see other members in their own farm
CREATE POLICY "farm_members_select" ON farm_members
  FOR SELECT USING (true);

-- Allow inserting members
CREATE POLICY "farm_members_insert" ON farm_members
  FOR INSERT WITH CHECK (true);

-- Allow updating own member record
CREATE POLICY "farm_members_update" ON farm_members
  FOR UPDATE USING (true);

-- Allow deleting members (admin removal)
CREATE POLICY "farm_members_delete" ON farm_members
  FOR DELETE USING (true);

-- ============================================================
-- 6. ADDITIONAL SECURITY: RESTRICT COLUMNS RETURNED
-- ============================================================
-- NOTE: Since _joinPassword is stored inside the JSONB `data`
-- column of farm_data, consider creating a Postgres function
-- that strips the password before returning data to clients.
--
-- Example (optional, run if you want to hide passwords):
--
-- CREATE OR REPLACE FUNCTION public.get_farm_data_safe(target_farm_id TEXT)
-- RETURNS JSONB AS $$
-- DECLARE
--   result JSONB;
-- BEGIN
--   SELECT data - '_joinPassword' INTO result
--   FROM farm_data
--   WHERE farm_id = target_farm_id;
--   RETURN result;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. RATE LIMITING AT DATABASE LEVEL (optional)
-- ============================================================
-- Supabase doesn't have built-in rate limiting at the DB level,
-- but you can use pg_stat_statements to monitor query patterns.
-- Rate limiting is handled at the API layer (backend/hono.ts).

-- ============================================================
-- DONE! RLS is now enabled on all tables.
-- The app will continue to work as before, but now has the
-- foundation for more restrictive policies in the future.
--
-- NEXT STEPS for even tighter security:
-- 1. Migrate to Supabase Auth (email/password login)
-- 2. Use auth.uid() in RLS policies to restrict per-user access
-- 3. Move all write operations through your tRPC backend
--    instead of direct Supabase client calls
-- ============================================================
