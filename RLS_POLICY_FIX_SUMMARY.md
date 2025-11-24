# RLS Policy Fix Summary - chef_zone_membres INSERT

## Problem
Error: `new row violates row-level security policy for table "chef_zone_membres"`

## Root Cause
The RLS policy was trying to query `user_profiles` table directly, but `user_profiles` itself has RLS enabled, which can cause circular dependency issues or silent failures.

## Solution Applied

### 1. Updated RLS Policy to Use `get_user_role()` Function

The policy now uses the `get_user_role()` function which is `SECURITY DEFINER` and can bypass RLS on `user_profiles`.

**New INSERT Policy:**
```sql
CREATE POLICY chef_zone_membres_insert_admin_manager
ON public.chef_zone_membres
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role((SELECT auth.uid())) IN ('admin', 'manager')
);
```

**New ALL Policy (UPDATE/DELETE):**
```sql
CREATE POLICY chef_zone_membres_modify_admin_manager
ON public.chef_zone_membres
FOR ALL
TO authenticated
USING (
  get_user_role((SELECT auth.uid())) IN ('admin', 'manager')
)
WITH CHECK (
  get_user_role((SELECT auth.uid())) IN ('admin', 'manager')
);
```

### 2. Code Improvements

Added:
- ✅ Session validation before INSERT
- ✅ Better error messages for RLS violations
- ✅ Debug logging with user ID and role
- ✅ Validation that session.user.id matches userProfile.id

## Verification

### Check Current User Role
```sql
-- In Supabase SQL Editor, run as the logged-in user:
SELECT 
  id,
  role,
  get_user_role(auth.uid()) as function_result
FROM user_profiles
WHERE id = auth.uid();
```

### Test INSERT Policy
```sql
-- This should work if you're admin/manager:
INSERT INTO chef_zone_membres (chef_zone_id, membre_id, assigned_by)
VALUES (
  'your-chef-zone-uuid',
  'test-member-id',
  auth.uid()
);
```

## If Still Getting RLS Error

1. **Verify User Role:**
   ```sql
   SELECT id, role FROM user_profiles WHERE id = auth.uid();
   ```
   Should return `role = 'admin'` or `role = 'manager'`

2. **Check Function Works:**
   ```sql
   SELECT get_user_role(auth.uid());
   ```
   Should return 'admin' or 'manager'

3. **Verify Policy Exists:**
   ```sql
   SELECT policyname, cmd, with_check
   FROM pg_policies
   WHERE tablename = 'chef_zone_membres' AND cmd = 'INSERT';
   ```

4. **Check Browser Console:**
   - Look for `[DEBUG]` logs showing user role and ID
   - Verify `userRole` is 'admin' or 'manager'
   - Verify `authUidMatch` is `true`

## Migration Applied

✅ Migration `fix_chef_zone_membres_rls_with_function` has been applied successfully.

The policy now uses `get_user_role()` function which bypasses RLS on `user_profiles` table, solving the circular dependency issue.

