-- =============================================
-- Sahakarlekha - Complete Supabase Schema
-- Column names match TypeScript field names exactly
-- Run in Supabase SQL Editor (fresh setup)
-- =============================================

-- ── STEP 1: Drop existing tables (if rebuilding fresh) ───────────────────────
-- Uncomment these lines only if you want to start fresh:
-- drop table if exists salary_records cascade;
-- drop table if exists employees cascade;
-- drop table if exists purchases cascade;
-- drop table if exists sales cascade;
-- drop table if exists stock_movements cascade;
-- drop table if exists stock_items cascade;
-- drop table if exists audit_objections cascade;
-- drop table if exists assets cascade;
-- drop table if exists loans cascade;
-- drop table if exists vouchers cascade;
-- drop table if exists members cascade;
-- drop table if exists accounts cascade;
-- drop table if exists society_settings cascade;
-- drop table if exists society_users cascade;
-- drop table if exists societies cascade;


-- ── STEP 2: Multi-Society tables ─────────────────────────────────────────────

create table if not exists societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_hi text,
  registration_no text unique not null,
  address text,
  district text not null,
  state text not null,
  phone text,
  financial_year text default '2024-25',
  created_at timestamp default now()
);

create table if not exists society_users (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) on delete cascade,
  name text not null,
  email text unique not null,
  password text not null,
  role text not null check (role in ('admin', 'accountant', 'viewer')),
  is_active boolean default true,
  created_at timestamp default now()
);


-- ── STEP 3: Data tables (column names match TypeScript camelCase) ─────────────
-- NOTE: Quoted identifiers ("voucherNo") preserve camelCase in PostgreSQL.
-- This ensures Supabase stores/returns the exact same keys the app sends.

-- 1. Society Settings
create table if not exists society_settings (
  id text primary key default 'main',
  society_id text not null default 'SOC001',
  name text,
  "nameHi" text,
  "registrationNo" text,
  "financialYear" text,
  "financialYearStart" text,
  address text,
  district text,
  state text,
  "pinCode" text,
  phone text,
  email text,
  "previousFinancialYear" text,
  "previousYearBalances" jsonb default '{}',
  "societyType" text default 'marketing_processing'
);

-- 2. Accounts (Ledger Heads)
create table if not exists accounts (
  id text primary key,
  society_id text not null default 'SOC001',
  name text not null,
  "nameHi" text,
  type text not null,
  "openingBalance" numeric default 0,
  "openingBalanceType" text default 'debit',
  "isSystem" boolean default false,
  "parentId" text,
  "isGroup" boolean default false
);

-- 3. Members
create table if not exists members (
  id text primary key,
  society_id text not null default 'SOC001',
  "memberId" text,
  name text,
  "fatherName" text,
  address text,
  phone text,
  "shareCapital" numeric default 0,
  "admissionFee" numeric default 0,
  "memberType" text default 'member',
  "joinDate" text,
  status text default 'active',
  "shareCertNo" text,
  "shareCount" numeric,
  "shareFaceValue" numeric,
  "nomineeName" text,
  "nomineeRelation" text,
  "nomineePhone" text,
  "createdAt" timestamp default now()
);

-- 4. Vouchers
create table if not exists vouchers (
  id text primary key,
  society_id text not null default 'SOC001',
  "voucherNo" text,
  date text,
  type text,
  "debitAccountId" text,
  "creditAccountId" text,
  amount numeric default 0,
  narration text,
  "memberId" text,
  "isDeleted" boolean default false,
  "deletedAt" text,
  "deletedBy" text,
  "deletedReason" text,
  "createdAt" timestamp default now(),
  "createdBy" text
);

-- 5. Loans
create table if not exists loans (
  id text primary key,
  society_id text not null default 'SOC001',
  "loanNo" text,
  "memberId" text,
  "loanType" text,
  purpose text,
  amount numeric,
  "interestRate" numeric,
  "disbursementDate" text,
  "dueDate" text,
  "repaidAmount" numeric default 0,
  status text,
  security text,
  "createdAt" timestamp default now()
);

-- 6. Assets
create table if not exists assets (
  id text primary key,
  society_id text not null default 'SOC001',
  "assetNo" text,
  name text,
  category text,
  "purchaseDate" text,
  cost numeric,
  "depreciationRate" numeric,
  location text,
  description text,
  status text default 'active'
);

-- 7. Audit Objections
create table if not exists audit_objections (
  id text primary key,
  society_id text not null default 'SOC001',
  "objectionNo" text,
  "auditYear" text,
  "paraNo" text,
  category text,
  objection text,
  "amountInvolved" numeric default 0,
  "dueDate" text,
  "actionTaken" text,
  "rectifiedDate" text,
  status text,
  remarks text,
  "createdAt" timestamp default now()
);

-- 8. Stock Items
create table if not exists stock_items (
  id text primary key,
  society_id text not null default 'SOC001',
  "itemCode" text,
  name text,
  "nameHi" text,
  unit text,
  "openingStock" numeric default 0,
  "currentStock" numeric default 0,
  "purchaseRate" numeric default 0,
  "saleRate" numeric default 0,
  "isActive" boolean default true
);

-- 9. Stock Movements
create table if not exists stock_movements (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  "itemId" text,
  type text,
  qty numeric,
  rate numeric,
  amount numeric,
  "referenceNo" text,
  narration text,
  "createdAt" timestamp default now()
);

-- 10. Sales
create table if not exists sales (
  id text primary key,
  society_id text not null default 'SOC001',
  "saleNo" text,
  date text,
  "customerName" text,
  "customerPhone" text,
  items jsonb default '[]',
  "totalAmount" numeric,
  discount numeric default 0,
  "netAmount" numeric,
  "paymentMode" text,
  "voucherId" text,
  narration text,
  "createdAt" timestamp default now(),
  "createdBy" text
);

-- 11. Purchases
create table if not exists purchases (
  id text primary key,
  society_id text not null default 'SOC001',
  "purchaseNo" text,
  date text,
  "supplierName" text,
  "supplierPhone" text,
  items jsonb default '[]',
  "totalAmount" numeric,
  discount numeric default 0,
  "netAmount" numeric,
  "paymentMode" text,
  "voucherId" text,
  narration text,
  "createdAt" timestamp default now(),
  "createdBy" text
);

-- 12. Employees
create table if not exists employees (
  id text primary key,
  society_id text not null default 'SOC001',
  "empNo" text,
  name text,
  "nameHi" text,
  designation text,
  "joinDate" text,
  "basicSalary" numeric,
  phone text,
  "bankAccount" text,
  status text default 'active'
);

-- 13. Salary Records
create table if not exists salary_records (
  id text primary key,
  society_id text not null default 'SOC001',
  "slipNo" text,
  "employeeId" text,
  month text,
  "basicSalary" numeric,
  allowances numeric default 0,
  deductions numeric default 0,
  "netSalary" numeric,
  "paymentMode" text,
  "voucherId" text,
  "isPaid" boolean default false,
  "paidDate" text,
  "createdAt" timestamp default now()
);


-- ── STEP 4: Enable Row Level Security ────────────────────────────────────────
alter table societies enable row level security;
alter table society_users enable row level security;
alter table society_settings enable row level security;
alter table accounts enable row level security;
alter table members enable row level security;
alter table vouchers enable row level security;
alter table loans enable row level security;
alter table assets enable row level security;
alter table audit_objections enable row level security;
alter table stock_items enable row level security;
alter table stock_movements enable row level security;
alter table sales enable row level security;
alter table purchases enable row level security;
alter table employees enable row level security;
alter table salary_records enable row level security;


-- ── STEP 5: RLS Policies (allow all — add proper auth policies later) ────────
do $$ begin
  -- societies
  if not exists (select 1 from pg_policies where tablename='societies' and policyname='allow_all_societies') then
    create policy "allow_all_societies" on societies for all using (true) with check (true);
  end if;
  -- society_users
  if not exists (select 1 from pg_policies where tablename='society_users' and policyname='allow_all_society_users') then
    create policy "allow_all_society_users" on society_users for all using (true) with check (true);
  end if;
  -- data tables
  if not exists (select 1 from pg_policies where tablename='society_settings' and policyname='allow_all') then
    create policy "allow_all" on society_settings for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='accounts' and policyname='allow_all') then
    create policy "allow_all" on accounts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='members' and policyname='allow_all') then
    create policy "allow_all" on members for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='vouchers' and policyname='allow_all') then
    create policy "allow_all" on vouchers for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='loans' and policyname='allow_all') then
    create policy "allow_all" on loans for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='assets' and policyname='allow_all') then
    create policy "allow_all" on assets for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='audit_objections' and policyname='allow_all') then
    create policy "allow_all" on audit_objections for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='stock_items' and policyname='allow_all') then
    create policy "allow_all" on stock_items for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='stock_movements' and policyname='allow_all') then
    create policy "allow_all" on stock_movements for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='sales' and policyname='allow_all') then
    create policy "allow_all" on sales for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='purchases' and policyname='allow_all') then
    create policy "allow_all" on purchases for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='employees' and policyname='allow_all') then
    create policy "allow_all" on employees for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='salary_records' and policyname='allow_all') then
    create policy "allow_all" on salary_records for all using (true) with check (true);
  end if;
end $$;


-- ── STEP 6: New tables (suppliers, customers) ────────────────────────────────

-- 14. Suppliers
create table if not exists suppliers (
  id text primary key,
  society_id text not null default 'SOC001',
  "supplierCode" text,
  name text not null,
  address text,
  "gstNo" text,
  phone text,
  "accountId" text,        -- references accounts.id (app-level FK)
  "isActive" boolean default true,
  "createdAt" timestamp default now()
);

-- 15. Customers
create table if not exists customers (
  id text primary key,
  society_id text not null default 'SOC001',
  "customerCode" text,
  name text not null,
  address text,
  "gstNo" text,
  phone text,
  "accountId" text,        -- references accounts.id (app-level FK)
  "isActive" boolean default true,
  "createdAt" timestamp default now()
);

alter table suppliers enable row level security;
alter table customers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='allow_all') then
    create policy "allow_all" on suppliers for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='allow_all') then
    create policy "allow_all" on customers for all using (true) with check (true);
  end if;
end $$;


-- ── STEP 7: Add missing columns to existing tables (Phase 2/3 additions) ─────
-- Run these on existing databases to bring schema up to date.

-- Voucher: bank reconciliation + edit history fields
alter table vouchers add column if not exists "isCleared" boolean default false;
alter table vouchers add column if not exists "clearedDate" text;
alter table vouchers add column if not exists "editHistory" jsonb default '[]';

-- Sales: GST fields
alter table sales add column if not exists "cgstPct" numeric default 0;
alter table sales add column if not exists "sgstPct" numeric default 0;
alter table sales add column if not exists "igstPct" numeric default 0;
alter table sales add column if not exists "cgstAmount" numeric default 0;
alter table sales add column if not exists "sgstAmount" numeric default 0;
alter table sales add column if not exists "igstAmount" numeric default 0;
alter table sales add column if not exists "taxAmount" numeric default 0;
alter table sales add column if not exists "grandTotal" numeric default 0;
alter table sales add column if not exists "customerId" text;
alter table sales add column if not exists "gstVoucherIds" jsonb default '[]';

-- Purchases: GST + TDS fields
alter table purchases add column if not exists "cgstPct" numeric default 0;
alter table purchases add column if not exists "sgstPct" numeric default 0;
alter table purchases add column if not exists "igstPct" numeric default 0;
alter table purchases add column if not exists "tdsPct" numeric default 0;
alter table purchases add column if not exists "cgstAmount" numeric default 0;
alter table purchases add column if not exists "sgstAmount" numeric default 0;
alter table purchases add column if not exists "igstAmount" numeric default 0;
alter table purchases add column if not exists "tdsAmount" numeric default 0;
alter table purchases add column if not exists "taxAmount" numeric default 0;
alter table purchases add column if not exists "grandTotal" numeric default 0;
alter table purchases add column if not exists "supplierId" text;
alter table purchases add column if not exists "taxVoucherIds" jsonb default '[]';

-- Salary Records: allowances breakdown
alter table salary_records add column if not exists "hraAllowance" numeric default 0;
alter table salary_records add column if not exists "taAllowance" numeric default 0;
alter table salary_records add column if not exists "daAllowance" numeric default 0;
alter table salary_records add column if not exists "otherAllowances" numeric default 0;
alter table salary_records add column if not exists "pfDeduction" numeric default 0;
alter table salary_records add column if not exists "taxDeduction" numeric default 0;
alter table salary_records add column if not exists "otherDeductions" numeric default 0;
alter table salary_records add column if not exists "createdBy" text;
alter table salary_records add column if not exists narration text;


-- ── STEP 8: Performance indexes ───────────────────────────────────────────────
create index if not exists idx_vouchers_society_date     on vouchers(society_id, date);
create index if not exists idx_vouchers_society_type     on vouchers(society_id, type);
create index if not exists idx_vouchers_debit_acc        on vouchers("debitAccountId");
create index if not exists idx_vouchers_credit_acc       on vouchers("creditAccountId");
create index if not exists idx_vouchers_is_deleted       on vouchers("isDeleted");
create index if not exists idx_members_society           on members(society_id);
create index if not exists idx_loans_member              on loans("memberId");
create index if not exists idx_stock_movements_item      on stock_movements("itemId");
create index if not exists idx_sales_society_date        on sales(society_id, date);
create index if not exists idx_purchases_society_date    on purchases(society_id, date);
create index if not exists idx_salary_records_employee   on salary_records("employeeId");


-- ── STEP 9: App-level FK integrity notes ─────────────────────────────────────
-- NOTE: Hard DB-level FKs are intentionally omitted because:
-- 1. Account IDs are text (seeded from app, not auto-generated UUIDs)
-- 2. Soft-delete pattern: records may reference logically-deleted entities
-- 3. localStorage-first sync: FK violations possible during partial sync
--
-- App-level FK invariants enforced in DataContext.tsx:
--   vouchers.debitAccountId   → accounts.id  (validated in addVoucher)
--   vouchers.creditAccountId  → accounts.id  (validated in addVoucher)
--   stock_movements.itemId    → stock_items.id (cascades on deleteStockItem)
--   salary_records.employeeId → employees.id  (validated in addSalaryRecord)
--   loans.memberId            → members.id    (validated in addLoan)
--   suppliers.accountId       → accounts.id   (cascades on deleteSupplier)
--   customers.accountId       → accounts.id   (cascades on deleteCustomer)


-- ── MIGRATION: If you have existing tables with old snake_case columns ────────
-- Run these ALTER statements to fix existing tables instead of dropping them.
-- Only needed if you ran the OLD supabase-tables.sql before.
--
-- alter table society_settings  add column if not exists society_id text default 'SOC001';
-- alter table accounts          add column if not exists society_id text default 'SOC001';
-- alter table members           add column if not exists society_id text default 'SOC001';
-- alter table vouchers          add column if not exists society_id text default 'SOC001';
-- alter table loans             add column if not exists society_id text default 'SOC001';
-- alter table assets            add column if not exists society_id text default 'SOC001';
-- alter table audit_objections  add column if not exists society_id text default 'SOC001';
-- alter table stock_items       add column if not exists society_id text default 'SOC001';
-- alter table stock_movements   add column if not exists society_id text default 'SOC001';
-- alter table sales             add column if not exists society_id text default 'SOC001';
-- alter table purchases         add column if not exists society_id text default 'SOC001';
-- alter table employees         add column if not exists society_id text default 'SOC001';
-- alter table salary_records    add column if not exists society_id text default 'SOC001';
