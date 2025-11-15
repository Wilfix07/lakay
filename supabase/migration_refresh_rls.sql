-- Migration: Refresh RLS policies for shared tables
-- Date: 2025-11-14

BEGIN;

-- Ensure RLS is enabled on all affected tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_frequencies ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- user_profiles
-- ===================================================================
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON user_profiles;
DROP POLICY IF EXISTS manager_view_own_agents_final ON user_profiles;
DROP POLICY IF EXISTS manager_view_own_agents ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS manager_view_agents ON user_profiles;
DROP POLICY IF EXISTS full_select_access ON user_profiles;
DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_select ON user_profiles;

CREATE POLICY "Users update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY user_profiles_self_select
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY user_profiles_admin_select
  ON user_profiles
  FOR SELECT
  TO public
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY manager_view_agents
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'manager'
    AND role = 'agent'
    AND EXISTS (
      SELECT 1
      FROM agents a
      WHERE a.agent_id = user_profiles.agent_id
        AND a.manager_id = auth.uid()
    )
  );

-- ===================================================================
-- agents
-- ===================================================================
DROP POLICY IF EXISTS manager_own_agents ON agents;

CREATE POLICY manager_manage_agents
  ON agents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'manager'
        AND agents.manager_id = up.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'manager'
        AND agents.manager_id = up.id
    )
  );

-- ===================================================================
-- manager_business_settings
-- ===================================================================
DROP POLICY IF EXISTS admin_manage_business_settings ON manager_business_settings;
DROP POLICY IF EXISTS manager_own_business_settings ON manager_business_settings;
DROP POLICY IF EXISTS manager_read_business_settings ON manager_business_settings;

CREATE POLICY manager_business_settings_admin_full_access
  ON manager_business_settings
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY manager_business_settings_manager_full_access
  ON manager_business_settings
  FOR ALL
  USING (
    get_user_role(auth.uid()) = 'manager'
    AND manager_business_settings.manager_id = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'manager'
    AND manager_business_settings.manager_id = auth.uid()
  );

CREATE POLICY manager_business_settings_authenticated_read
  ON manager_business_settings
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      manager_business_settings.manager_id IS NULL
      OR manager_business_settings.manager_id = auth.uid()
    )
  );

-- ===================================================================
-- month_names
-- ===================================================================
DROP POLICY IF EXISTS admin_manage_month_names ON month_names;
DROP POLICY IF EXISTS manager_manage_month_names ON month_names;
DROP POLICY IF EXISTS manager_read_month_names ON month_names;

CREATE POLICY month_names_admin_full_access
  ON month_names
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY month_names_manager_full_access
  ON month_names
  FOR ALL
  USING (
    get_user_role(auth.uid()) = 'manager'
    AND month_names.manager_id = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'manager'
    AND month_names.manager_id = auth.uid()
  );

CREATE POLICY month_names_authenticated_select
  ON month_names
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ===================================================================
-- repayment_frequencies
-- ===================================================================
DROP POLICY IF EXISTS admin_manage_repayment_frequencies ON repayment_frequencies;
DROP POLICY IF EXISTS manager_manage_repayment_frequencies ON repayment_frequencies;
DROP POLICY IF EXISTS manager_read_repayment_frequencies ON repayment_frequencies;

CREATE POLICY repayment_frequencies_admin_full_access
  ON repayment_frequencies
  FOR ALL
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY repayment_frequencies_manager_full_access
  ON repayment_frequencies
  FOR ALL
  USING (
    get_user_role(auth.uid()) = 'manager'
    AND repayment_frequencies.manager_id = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'manager'
    AND repayment_frequencies.manager_id = auth.uid()
  );

CREATE POLICY repayment_frequencies_authenticated_select
  ON repayment_frequencies
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMIT;

