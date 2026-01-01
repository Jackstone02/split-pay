-- =====================================================
-- RLS Policies for user_profiles table
-- =====================================================

-- First, drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_insert_own_on_signup" ON amot.user_profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON amot.user_profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON amot.user_profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON amot.user_profiles;

-- Enable Row Level Security
ALTER TABLE amot.user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant table-level permissions (CRITICAL - RLS policies won't work without this!)
GRANT SELECT, INSERT, UPDATE, DELETE ON amot.user_profiles TO authenticated;
GRANT USAGE ON SCHEMA amot TO authenticated;

-- INSERT policy: allow users to create only their own profile during signup
CREATE POLICY "profiles_insert_own_on_signup" ON amot.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- SELECT policy: allow authenticated users to read all profiles
-- (needed for friends, groups, bill participants)
CREATE POLICY "profiles_select_all" ON amot.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE policy: allow users to update only their own profile
CREATE POLICY "profiles_update_own" ON amot.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- DELETE policy: allow users to delete only their own profile
CREATE POLICY "profiles_delete_own" ON amot.user_profiles
  FOR DELETE
  TO authenticated
  USING (id = (SELECT auth.uid()));
