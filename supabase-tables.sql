-- =============================================
-- Sahakarlekha - Complete Supabase Schema
-- Column names match TypeScript field names exactly
-- Run in Supabase SQL Editor (fresh setup)
-- =============================================

-- ── FRESH RESET (Phase 1 migration) ─────────────────────────────────────────
-- Uncomment ALL lines below ONLY if doing a complete fresh reset:
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
-- drop table if exists suppliers cascade;
-- drop table if exists customers cascade;

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
  "customerId" text,
  items jsonb default '[]',
  "totalAmount" numeric,
  discount numeric default 0,
  "netAmount" numeric,
  "cgstPct" numeric default 0,
  "sgstPct" numeric default 0,
  "igstPct" numeric default 0,
  "tdsPct" numeric default 0,
  "cgstAmount" numeric default 0,
  "sgstAmount" numeric default 0,
  "igstAmount" numeric default 0,
  "tdsAmount" numeric default 0,
  "taxAmount" numeric default 0,
  "grandTotal" numeric default 0,
  "paymentMode" text,
  "voucherId" text,
  "gstVoucherIds" jsonb default '[]',
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
  "supplierId" text,
  items jsonb default '[]',
  "totalAmount" numeric,
  discount numeric default 0,
  "netAmount" numeric,
  "cgstPct" numeric default 0,
  "sgstPct" numeric default 0,
  "igstPct" numeric default 0,
  "tdsPct" numeric default 0,
  "cgstAmount" numeric default 0,
  "sgstAmount" numeric default 0,
  "igstAmount" numeric default 0,
  "tdsAmount" numeric default 0,
  "taxAmount" numeric default 0,
  "grandTotal" numeric default 0,
  "paymentMode" text,
  "voucherId" text,
  "taxVoucherIds" jsonb default '[]',
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

-- Vouchers: multi-line support (Phase 1 - Path B)
alter table vouchers add column if not exists lines jsonb default '[]';
alter table vouchers add column if not exists "refType" text;
alter table vouchers add column if not exists "refId" text;

-- Vouchers: approval workflow + compound grouping columns
alter table vouchers add column if not exists "groupId" text;
alter table vouchers add column if not exists "approvalStatus" text default 'approved';
alter table vouchers add column if not exists "approvalRemarks" text;
alter table vouchers add column if not exists "approvedBy" text;
alter table vouchers add column if not exists "approvedAt" text;

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

-- 14. Suppliers
create table if not exists suppliers (
  id text primary key,
  society_id text not null default 'SOC001',
  "supplierCode" text,
  name text,
  address text,
  "gstNo" text,
  phone text,
  "accountId" text,
  "isActive" boolean default true,
  "createdAt" timestamp default now()
);
alter table suppliers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='allow_all') then
    create policy "allow_all" on suppliers for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_suppliers_society on suppliers(society_id);
alter table suppliers add column if not exists "nameHi" text;

-- 15. Customers
create table if not exists customers (
  id text primary key,
  society_id text not null default 'SOC001',
  "customerCode" text,
  name text,
  address text,
  phone text,
  "accountId" text,
  "isActive" boolean default true,
  "createdAt" timestamp default now()
);
alter table customers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='allow_all') then
    create policy "allow_all" on customers for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_customers_society on customers(society_id);
alter table customers add column if not exists "nameHi" text;


-- ── STEP 9: Standalone module tables (meeting_register, kcc_loans, budgets, eway_bills, elections) ─

-- 16. Meeting Register
create table if not exists meeting_register (
  id text primary key,
  society_id text not null default 'SOC001',
  "meetingNo" text,
  type text,
  date text,
  time text,
  venue text,
  agenda text,
  attendees text,
  resolutions text,
  minutes text,
  status text default 'scheduled',
  "createdAt" text
);
alter table meeting_register enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='meeting_register' and policyname='allow_all') then
    create policy "allow_all" on meeting_register for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_meeting_register_society on meeting_register(society_id);

-- 17. KCC Loans
create table if not exists kcc_loans (
  id text primary key,
  society_id text not null default 'SOC001',
  "loanNo" text,
  "memberId" text,
  "memberName" text,
  "cropName" text,
  "cropSeason" text,
  "landAreaHectares" numeric default 0,
  "sanctionedAmount" numeric default 0,
  "drawnAmount" numeric default 0,
  "repaidAmount" numeric default 0,
  "outstandingAmount" numeric default 0,
  "interestRate" numeric default 7,
  "disbursementDate" text,
  "dueDate" text,
  status text default 'active',
  "voucherId" text,
  narration text,
  "createdAt" text,
  "createdBy" text
);
alter table kcc_loans enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='kcc_loans' and policyname='allow_all') then
    create policy "allow_all" on kcc_loans for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_kcc_loans_society on kcc_loans(society_id);

-- 18. Budgets
create table if not exists budgets (
  id text primary key,
  society_id text not null default 'SOC001',
  "financialYear" text,
  heads jsonb default '[]',
  "approvedBy" text,
  "approvedAt" text,
  "createdAt" text,
  "createdBy" text
);
alter table budgets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='budgets' and policyname='allow_all') then
    create policy "allow_all" on budgets for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_budgets_society on budgets(society_id);

-- 19. e-Way Bills
create table if not exists eway_bills (
  id text primary key,
  society_id text not null default 'SOC001',
  type text,
  "docNo" text,
  date text,
  "partyName" text,
  "partyGst" text,
  items jsonb default '[]',
  "totalTaxable" numeric default 0,
  "totalGst" numeric default 0,
  "grandTotal" numeric default 0,
  "transportMode" text,
  "vehicleNo" text,
  distance numeric default 0,
  "ewbNo" text
);
alter table eway_bills enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='eway_bills' and policyname='allow_all') then
    create policy "allow_all" on eway_bills for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_eway_bills_society on eway_bills(society_id);

-- 20. Elections
create table if not exists elections (
  id text primary key,
  society_id text not null default 'SOC001',
  "electionNo" text,
  title text,
  post text,
  "electionDate" text,
  "nominationDeadline" text,
  status text default 'upcoming',
  candidates jsonb default '[]',
  "totalVoters" integer default 0,
  "votesCast" integer default 0,
  "winnerId" text,
  remarks text,
  "createdAt" text,
  "createdBy" text
);
alter table elections enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='elections' and policyname='allow_all') then
    create policy "allow_all" on elections for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_elections_society on elections(society_id);


-- ── STEP 10: App-level FK integrity notes ─────────────────────────────────────
-- NOTE: Hard DB-level FKs are intentionally omitted because:
-- 1. Account IDs are text (seeded from app, not auto-generated UUIDs)
-- 2. Soft-delete pattern: records may reference logically-deleted entities
-- 3. Supabase-primary sync: App validates FK integrity before inserting
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


-- ── STEP 11: HSN Master + Customer gstNo ──────────────────────────────────────
create table if not exists hsn_master (
  id text primary key,
  society_id text not null default 'SOC001',
  code text not null,
  description text,
  type text default 'HSN',  -- HSN or SAC
  "gstRate" numeric default 0,
  cess numeric default 0,
  "createdAt" text
);
alter table hsn_master enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='hsn_master' and policyname='allow_all') then
    create policy "allow_all" on hsn_master for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_hsn_master_society on hsn_master(society_id);

-- Add gstNo to customers table
alter table customers add column if not exists "gstNo" text;

-- ── STEP 12: voucher_entries — proper relational double-entry ledger ──────────
-- Each voucher gets N rows here (one per Dr/Cr leg).
-- App calculations still run in JS via getVoucherLines(); this table enables
-- SQL-level queries, future Supabase RPCs, and proper relational auditing.

create table if not exists voucher_entries (
  id text primary key,
  "voucherId" text not null references vouchers(id) on delete cascade,
  "accountId" text not null,
  dr numeric not null default 0,
  cr numeric not null default 0,
  narration text,
  society_id text not null default 'SOC001'
);
alter table voucher_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='voucher_entries' and policyname='allow_all') then
    create policy "allow_all" on voucher_entries for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_ve_voucher on voucher_entries("voucherId");
create index if not exists idx_ve_account on voucher_entries("accountId");
create index if not exists idx_ve_society on voucher_entries(society_id);

-- ── STEP 13: subtype column on accounts ─────────────────────────────────────
alter table accounts add column if not exists subtype text;

-- ── STEP 14: societyType on society_settings ────────────────────────────────
alter table society_settings add column if not exists "societyType" text default 'marketing_processing';
-- alter table salary_records    add column if not exists society_id text default 'SOC001';
