-- ============================================================
-- Sahayata Cooperative Accounts — Supabase RLS Migration
-- Run this in Supabase SQL Editor → New query
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE vouchers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_users    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Helper: get current user's society_id from society_users
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_society_id()
RETURNS TEXT AS $$
  SELECT society_id FROM society_users
  WHERE email = auth.jwt()->>'email'
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM society_users
  WHERE email = auth.jwt()->>'email'
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- 3. VOUCHERS — tenant isolation + role-based write control
-- ============================================================
DROP POLICY IF EXISTS vouchers_select   ON vouchers;
DROP POLICY IF EXISTS vouchers_insert   ON vouchers;
DROP POLICY IF EXISTS vouchers_update   ON vouchers;
DROP POLICY IF EXISTS vouchers_delete   ON vouchers;

-- All users in the same society can read vouchers
CREATE POLICY vouchers_select ON vouchers
  FOR SELECT USING (society_id = get_current_society_id());

-- Admin + Accountant can insert
CREATE POLICY vouchers_insert ON vouchers
  FOR INSERT WITH CHECK (
    society_id = get_current_society_id()
    AND get_current_user_role() IN ('admin', 'accountant')
  );

-- Admin + Accountant can update (soft delete, approve etc.)
CREATE POLICY vouchers_update ON vouchers
  FOR UPDATE USING (
    society_id = get_current_society_id()
    AND get_current_user_role() IN ('admin', 'accountant')
  );

-- Only admin can hard delete
CREATE POLICY vouchers_delete ON vouchers
  FOR DELETE USING (
    society_id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

-- ============================================================
-- 4. ACCOUNTS — only admin can modify chart of accounts
-- ============================================================
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_insert ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
DROP POLICY IF EXISTS accounts_delete ON accounts;

CREATE POLICY accounts_select ON accounts
  FOR SELECT USING (society_id = get_current_society_id());

CREATE POLICY accounts_insert ON accounts
  FOR INSERT WITH CHECK (
    society_id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

CREATE POLICY accounts_update ON accounts
  FOR UPDATE USING (
    society_id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

CREATE POLICY accounts_delete ON accounts
  FOR DELETE USING (
    society_id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

-- ============================================================
-- 5. MEMBERS — admin + accountant can write, all can read
-- ============================================================
DROP POLICY IF EXISTS members_select ON members;
DROP POLICY IF EXISTS members_write  ON members;

CREATE POLICY members_select ON members
  FOR SELECT USING (society_id = get_current_society_id());

CREATE POLICY members_write ON members
  FOR ALL USING (
    society_id = get_current_society_id()
    AND get_current_user_role() IN ('admin', 'accountant')
  );

-- ============================================================
-- 6. LOANS — same as members
-- ============================================================
DROP POLICY IF EXISTS loans_select ON loans;
DROP POLICY IF EXISTS loans_write  ON loans;

CREATE POLICY loans_select ON loans
  FOR SELECT USING (society_id = get_current_society_id());

CREATE POLICY loans_write ON loans
  FOR ALL USING (
    society_id = get_current_society_id()
    AND get_current_user_role() IN ('admin', 'accountant')
  );

-- ============================================================
-- 7. ASSETS — same as members
-- ============================================================
DROP POLICY IF EXISTS assets_select ON assets;
DROP POLICY IF EXISTS assets_write  ON assets;

CREATE POLICY assets_select ON assets
  FOR SELECT USING (society_id = get_current_society_id());

CREATE POLICY assets_write ON assets
  FOR ALL USING (
    society_id = get_current_society_id()
    AND get_current_user_role() IN ('admin', 'accountant')
  );

-- ============================================================
-- 8. SOCIETY_SETTINGS — only admin can modify
-- ============================================================
DROP POLICY IF EXISTS society_settings_select ON society_settings;
DROP POLICY IF EXISTS society_settings_write  ON society_settings;

CREATE POLICY society_settings_select ON society_settings
  FOR SELECT USING (id = get_current_society_id());

CREATE POLICY society_settings_write ON society_settings
  FOR ALL USING (
    id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

-- ============================================================
-- 9. SOCIETY_USERS — admin can manage users in their society
-- ============================================================
DROP POLICY IF EXISTS society_users_select ON society_users;
DROP POLICY IF EXISTS society_users_write  ON society_users;

CREATE POLICY society_users_select ON society_users
  FOR SELECT USING (society_id = get_current_society_id());

CREATE POLICY society_users_write ON society_users
  FOR ALL USING (
    society_id = get_current_society_id()
    AND get_current_user_role() = 'admin'
  );

-- ============================================================
-- 10. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vouchers_society_date    ON vouchers(society_id, date);
CREATE INDEX IF NOT EXISTS idx_vouchers_society_debit   ON vouchers(society_id, "debitAccountId");
CREATE INDEX IF NOT EXISTS idx_vouchers_society_credit  ON vouchers(society_id, "creditAccountId");
CREATE INDEX IF NOT EXISTS idx_vouchers_society_deleted ON vouchers(society_id, "isDeleted");
CREATE INDEX IF NOT EXISTS idx_members_society          ON members(society_id);
CREATE INDEX IF NOT EXISTS idx_loans_society_member     ON loans(society_id, "memberId");
CREATE INDEX IF NOT EXISTS idx_accounts_society_code    ON accounts(society_id, code);

-- ============================================================
-- Done! Test with:
-- SELECT * FROM vouchers LIMIT 5; -- should only show your society's data
-- ============================================================
