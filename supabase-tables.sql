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
  -- ECR-06 S4 (migration 046): the CHECK mirrors the UserRole union (types/index.ts) — all 16
  -- assignable names. The original 3-name list didn't even include 'auditor'.
  role text not null check (role in (
    'admin', 'accountant', 'viewer', 'auditor',
    'manager', 'secretary', 'cashier', 'storeKeeper', 'procurementOfficer',
    'salesOperator', 'internalAuditor', 'externalCA', 'boardMember', 'chairman',
    'employee', 'dataEntry'
  )),
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
-- ECR-22: Reverse Charge Mechanism flag (recipient self-assesses GST on this inward supply).
alter table purchases add column if not exists "rcmApplicable" boolean default false;
alter table purchases add column if not exists "supplierId" text;
alter table purchases add column if not exists "taxVoucherIds" jsonb default '[]';

-- Vouchers: multi-line support (Phase 1 - Path B)
alter table vouchers add column if not exists lines jsonb default '[]';
alter table vouchers add column if not exists "refType" text;
alter table vouchers add column if not exists "refId" text;
-- Engine-voucher origin tag (Phase 3.3). Sent in the base upsert, so the column MUST exist.
alter table vouchers add column if not exists origin text;

-- Vouchers: bill-wise settlement (Tally "Against Reference").
-- A bill-receipt voucher stores which sale invoices it settles, and by how much.
alter table vouchers add column if not exists "billAllocations" jsonb;

-- Optional accounting DIMENSION (additive). Patched in the extras step, never the base
-- upsert, so existing societies keep working even before this migration runs. Labour tags
-- vouchers by work order / cost centre; other society types leave them null.
alter table vouchers add column if not exists "workOrderId" text;
alter table vouchers add column if not exists "costCentreId" text;

-- Vouchers: approval workflow + compound grouping columns
alter table vouchers add column if not exists "groupId" text;
alter table vouchers add column if not exists "approvalStatus" text default 'approved';
alter table vouchers add column if not exists "approvalRemarks" text;
alter table vouchers add column if not exists "approvedBy" text;
alter table vouchers add column if not exists "approvedAt" text;

-- ECR-08 (P1 #8): reversal-not-edit. reversalOf = the original this voucher reverses;
-- reversedBy = the reversal voucher id set on the original. Written via targeted best-effort
-- .update() (like the delete columns), so base upserts stay safe before this runs.
alter table vouchers add column if not exists "reversalOf" text;
alter table vouchers add column if not exists "reversedBy" text;

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

-- 14. Suppliers — table created in STEP 6 above.
-- T-12: the duplicate `create table if not exists suppliers (...)` that used to sit here
-- was a no-op (STEP 6 wins) AND it disagreed with STEP 6: it dropped `not null` on `name`.
-- A reader could not tell which definition was live. Removed; the RLS/index/ALTER lines
-- below are idempotent and stay.
alter table suppliers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='allow_all') then
    create policy "allow_all" on suppliers for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_suppliers_society on suppliers(society_id);
alter table suppliers add column if not exists "nameHi" text;

-- 15. Customers — table created in STEP 6 above.
-- T-12: the duplicate `create table if not exists customers (...)` that used to sit here
-- was a no-op AND it disagreed with STEP 6 twice: it dropped `not null` on `name` and it
-- omitted `gstNo` entirely. Removed; the idempotent lines below stay.
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
-- Optional accounting dimension, denormalized from the parent voucher (additive; nullable).
alter table voucher_entries add column if not exists "workOrderId" text;
alter table voucher_entries add column if not exists "costCentreId" text;
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

-- ── ECR-11: per-type approval matrix on society_settings ─────────────────────
-- Voucher types that always require maker-checker approval (regardless of amount).
-- Stored as a JSON array of VoucherType strings. Safe to run before the UI is used —
-- the column stays NULL until an admin configures per-type rules.
alter table society_settings add column if not exists "approvalVoucherTypes" jsonb;
-- alter table salary_records    add column if not exists society_id text default 'SOC001';

-- ── ECR-20: godown storage-loss norm on society_settings ─────────────────────
-- Permitted storage-loss (driage/shrinkage) %; items above it are flagged. NULL = no norm.
alter table society_settings add column if not exists "storageLossNormPct" numeric;

-- ── STEP 15: platform_admins — super admin table (cross-society access) ──────
create table if not exists platform_admins (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  name text not null default 'Platform Admin',
  is_active boolean not null default true,
  created_at timestamptz default now()
);
-- No RLS — only accessible via service role / security definer functions
-- Insert your super admin email (replace with actual email):
-- insert into platform_admins (email, name) values ('superadmin@sahakarlekha.com', 'Super Admin')
-- on conflict (email) do nothing;

-- ── STEP 16: subscription fields on society_settings ─────────────────────────
alter table society_settings add column if not exists plan text default 'trial';
alter table society_settings add column if not exists trial_ends_at timestamptz default (now() + interval '30 days');
alter table society_settings add column if not exists plan_expires_at timestamptz;
alter table society_settings add column if not exists is_locked boolean default false;
alter table society_settings add column if not exists subscription_notes text;
alter table society_settings add column if not exists created_at timestamptz default now();

-- ── STEP 17b: Board of Directors & Signing Authority ─────────────────────────
alter table society_settings add column if not exists "boardType" text default 'bod';
alter table society_settings add column if not exists "boardMembers" jsonb default '[]';
alter table society_settings add column if not exists signatories jsonb default '{}';

-- ── Approval-gating (maker-checker) opt-in ──────────────────────────────────
-- When true, PENDING vouchers are held out of the ledger/reports until approved.
-- REJECTED vouchers are always excluded (client-report fix) regardless of this flag.
-- Default false ⇒ no behaviour change for existing societies. Client reads
-- society.approvalRequired ?? false, so it degrades gracefully before this runs.
alter table society_settings add column if not exists "approvalRequired" boolean default false;

-- ECR-11: approval matrix — manual vouchers with amount ≥ this need approval. NULL/0 = off.
alter table society_settings add column if not exists "approvalThresholdAmount" numeric;

-- ECR-16 (MS-11): cap on share-transfer premium as % of face value transferred.
-- NULL/0 ⇒ no premium allowed (statutory default — transfers at face value).
alter table society_settings add column if not exists "maxSharePremiumPercent" numeric;

-- ECR-07 (P1 #7): period lock / back-dating prevention. periodLockDate is an ISO
-- date; vouchers dated ON or BEFORE it are in a locked period and cannot be added
-- or edited. NULL/empty ⇒ no period lock (default) — behaviour unchanged.
alter table society_settings add column if not exists "periodLockDate" text;
alter table society_settings add column if not exists "periodLockBy" text;

-- T-12 (ADR-0003): per-tenant Activities-layer cutover flag. true ⇒ this society resolves its
-- capabilities from declared activities (within entitlement), gated by hasCutoverParity so it can
-- never hide a module. NULL/false ⇒ type-template behaviour (default). Flipped per tenant only
-- AFTER an empty-diff backfill of society_activities. See migration 036.
alter table society_settings add column if not exists "activitiesCutoverEnabled" boolean default false;

-- T-09 (ADR-0001): per-tenant ledger read cut. true ⇒ getTrialBalance is served from the event
-- journal, but ONLY when ledgerParity holds at runtime (else it falls back to the voucher-state
-- compute), so a flip can never break a report. NULL/false ⇒ voucher-state (default). See migration 037.
alter table society_settings add column if not exists "ledgerReadsEnabled" boolean default false;
-- T-20 (UCAS CM-1): per-tenant statutory appropriation posting (migration 049). Default off.
alter table society_settings add column if not exists "statutoryAppropriation" boolean default false;

-- ECR-07 dual-control: FY unlock must be requested by one admin and approved by
-- another. These hold the open request until a second admin finalises it.
alter table society_settings add column if not exists "fyUnlockRequestedBy" text;
alter table society_settings add column if not exists "fyUnlockRequestedAt" text;

-- ECR-13: which external notification channels the society enabled (in-app always on).
alter table society_settings add column if not exists "notificationChannels" jsonb;

-- ── P0 #2: Soft-delete parent records ───────────────────────────────────────
-- Members / purchases / assets / audit-objections are now ARCHIVED (isDeleted=true)
-- instead of hard-deleted, so statutory registers persist and deletes are auditable
-- & restorable. The app removes them from in-memory state on delete and filters
-- isDeleted out on load, so archived rows never surface. REQUIRED for the soft-delete
-- to persist — until this runs, a delete's update() will error (surfaced as a toast).
alter table members          add column if not exists "isDeleted" boolean default false;
alter table purchases        add column if not exists "isDeleted" boolean default false;
alter table assets           add column if not exists "isDeleted" boolean default false;
alter table audit_objections add column if not exists "isDeleted" boolean default false;
-- ECR-02: the loan register (कर्ज रजिस्टर) is now soft-deleted too (was hard-deleted).
alter table loans            add column if not exists "isDeleted" boolean default false;
-- ECR-02: the employee master (वेतन रजिस्टर) is now soft-deleted (was hard-deleted).
alter table employees        add column if not exists "isDeleted" boolean default false;
-- ECR-02: the sale row is now soft-deleted (was hard-deleted), symmetric with purchases.
alter table sales            add column if not exists "isDeleted" boolean default false;

-- ── P0 #3: Append-only (WORM) audit log ─────────────────────────────────────
-- One immutable trail of who/what/when/before/after/reason across all mutations.
-- WORM = INSERT + SELECT policies only; NO update/delete policy ⇒ rows can never be
-- changed or removed (append-only, non-repudiable). Client writes fire-and-forget, so
-- until this runs the app simply logs a console warning — no user-facing effect.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  society_id text not null default 'SOC001',
  actor_name text,
  actor_email text,
  actor_role text,
  entity_type text not null,
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  reason text,
  source text default 'app',
  created_at timestamptz not null default now()
);
create index if not exists audit_log_scope_idx on audit_log (society_id, entity_type, created_at desc);
alter table audit_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_insert') then
    create policy "audit_insert" on audit_log for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_select') then
    create policy "audit_select" on audit_log for select using (true);
  end if;
  -- Intentionally NO update/delete policy ⇒ audit_log is WORM (append-only).
end $$;

-- ── STEP 17c: Asset Register — ICAI AS-6 compliance fields ──────────────────
alter table assets add column if not exists "depreciationMethod" text default 'SLM';
alter table assets add column if not exists "depreciationPostedFY" jsonb default '[]';
alter table assets add column if not exists "usefulLife" numeric;
alter table assets add column if not exists "residualValue" numeric default 0;
alter table assets add column if not exists "disposalDate" text;
alter table assets add column if not exists "saleProceeds" numeric default 0;

-- ── STEP 17d: Stock Group for Closing Stock Report ──────────────────────────
alter table stock_items add column if not exists "stockGroup" text default 'General';

-- ── STEP 17e: Per-item Sales / Purchase A/c routing ─────────────────────────
-- Lets each StockItem post to a specific income/expense ledger so reports
-- show per-category Sales / Purchases lines instead of one lumped account.
alter table stock_items add column if not exists "salesAccountId" text;
alter table stock_items add column if not exists "purchaseAccountId" text;

-- ── STEP 17f: Tally-style comprehensive Customer master ─────────────────────
-- Lets the user register both simple individual customers and full B2B / society
-- customers with complete GST + address + banking + credit-term info, so Sale
-- Invoices can render a proper Bill To block with CGST/SGST vs IGST routing.
-- All columns optional — old simple-name customers continue to work.
alter table customers add column if not exists "legalName"        text;
alter table customers add column if not exists "tradeName"        text;
alter table customers add column if not exists "mailingName"      text;
alter table customers add column if not exists "customerType"     text;
alter table customers add column if not exists "addressLine1"     text;
alter table customers add column if not exists "addressLine2"     text;
alter table customers add column if not exists "city"             text;
alter table customers add column if not exists "state"            text;
alter table customers add column if not exists "pincode"          text;
alter table customers add column if not exists "country"          text default 'India';
alter table customers add column if not exists "mobile"           text;
alter table customers add column if not exists "landline"         text;
alter table customers add column if not exists "email"            text;
alter table customers add column if not exists "website"          text;
alter table customers add column if not exists "contactPerson"    text;
alter table customers add column if not exists "contactDesignation" text;
alter table customers add column if not exists "gstin"            text;
alter table customers add column if not exists "pan"              text;
alter table customers add column if not exists "registrationType" text;
alter table customers add column if not exists "placeOfSupply"    text;
alter table customers add column if not exists "tdsApplicable"    boolean default false;
alter table customers add column if not exists "tcsApplicable"    boolean default false;
alter table customers add column if not exists "bankName"         text;
alter table customers add column if not exists "accountNo"        text;
alter table customers add column if not exists "ifsc"             text;
alter table customers add column if not exists "branch"           text;
alter table customers add column if not exists "upiId"            text;
alter table customers add column if not exists "creditDays"       numeric default 0;
alter table customers add column if not exists "creditLimit"      numeric default 0;
alter table customers add column if not exists "discountPercent"  numeric default 0;
alter table customers add column if not exists "openingBalance"   numeric default 0;
alter table customers add column if not exists "openingBalanceType" text default 'debit';
alter table customers add column if not exists "notes"            text;

-- ── STEP 17g: Tally-style comprehensive Supplier master ─────────────────────
-- Parallel to STEP 17f (Customer). Lets supplier registration capture full
-- business / GST / banking / TDS details so Purchase Records, payment vouchers
-- and TDS returns can be rendered without manual re-entry every time.
alter table suppliers add column if not exists "legalName"        text;
alter table suppliers add column if not exists "tradeName"        text;
alter table suppliers add column if not exists "mailingName"      text;
alter table suppliers add column if not exists "supplierType"     text;
alter table suppliers add column if not exists "addressLine1"     text;
alter table suppliers add column if not exists "addressLine2"     text;
alter table suppliers add column if not exists "city"             text;
alter table suppliers add column if not exists "state"            text;
alter table suppliers add column if not exists "pincode"          text;
alter table suppliers add column if not exists "country"          text default 'India';
alter table suppliers add column if not exists "mobile"           text;
alter table suppliers add column if not exists "landline"         text;
alter table suppliers add column if not exists "email"            text;
alter table suppliers add column if not exists "website"          text;
alter table suppliers add column if not exists "contactPerson"    text;
alter table suppliers add column if not exists "contactDesignation" text;
alter table suppliers add column if not exists "salesRep"         text;
alter table suppliers add column if not exists "gstin"            text;
alter table suppliers add column if not exists "pan"              text;
alter table suppliers add column if not exists "registrationType" text;
alter table suppliers add column if not exists "placeOfSupply"    text;
alter table suppliers add column if not exists "tdsApplicable"    boolean default false;
alter table suppliers add column if not exists "tdsSection"       text;
alter table suppliers add column if not exists "tcsApplicable"    boolean default false;
alter table suppliers add column if not exists "bankName"         text;
alter table suppliers add column if not exists "accountNo"        text;
alter table suppliers add column if not exists "ifsc"             text;
alter table suppliers add column if not exists "branch"           text;
alter table suppliers add column if not exists "upiId"            text;
alter table suppliers add column if not exists "beneficiaryName"  text;
alter table suppliers add column if not exists "creditDays"       numeric default 0;
alter table suppliers add column if not exists "creditLimit"      numeric default 0;
alter table suppliers add column if not exists "discountPercent"  numeric default 0;
alter table suppliers add column if not exists "openingBalance"   numeric default 0;
alter table suppliers add column if not exists "openingBalanceType" text default 'credit';
alter table suppliers add column if not exists "notes"            text;

-- ── STEP 17: get_all_societies() — SECURITY DEFINER bypasses RLS ─────────────
-- Super admin calls this to see all societies regardless of society_id filter.
-- Return shape MATCHES the deployed production definition (Item #4 drift reconcile,
-- 2026-07-12): the tenant key is aliased society_id -> `id`, and registrationNo /
-- societyType (camelCase columns on society_settings) -> registration_no /
-- society_type; trial/expiry are returned as `date`. The client
-- (SuperAdminDashboard) normalizes `id`/snake_case back. Keep this in lock-step
-- with prod so a future create-or-replace does not 42P13 on a return-type change.
-- is_platform_admin() — authoritative super-admin predicate (migration 019). SECURITY DEFINER so
-- it reads RLS-locked platform_admins, keyed on the caller's VERIFIED JWT email (unspoofable). The
-- three cross-tenant RPCs below gate on it, and the client's checkSuperAdmin() uses it. EXECUTE is
-- authenticated-only. Keep this definition in sync with prod — a re-run must NOT drop the gate.
create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1 from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and is_active = true
  );
$$;
revoke execute on function is_platform_admin() from public, anon;
grant  execute on function is_platform_admin() to authenticated;

-- Each of the three super-admin RPCs (migration 020) gates on is_platform_admin() and raises 42501
-- for non-admins; EXECUTE is revoked from public/anon and granted to authenticated. Do NOT drop the
-- gate or re-grant to public here — that re-opens P0-1 (any anon reading every tenant).
create or replace function get_all_societies()
returns table (
  id                text,
  name              text,
  registration_no   text,
  society_type      text,
  district          text,
  state             text,
  plan              text,
  trial_ends_at     date,
  plan_expires_at   date,
  is_locked         boolean,
  subscription_notes text,
  created_at        timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select
      ss.society_id, ss.name, ss."registrationNo", ss."societyType",
      ss.district, ss.state, ss.plan,
      ss.trial_ends_at::date, ss.plan_expires_at::date,   -- cols are timestamptz; return type is date (021)
      ss.is_locked, ss.subscription_notes, ss.created_at
    from society_settings ss
    order by ss.created_at desc;
end;
$$;

-- ── STEP 18: get_society_user_counts() — user count per society ───────────────
create or replace function get_society_user_counts()
returns table (society_id text, user_count bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select su.society_id::text, count(*) as user_count   -- society_id is uuid; return type is text (021)
    from society_users su
    where su.is_active = true
    group by su.society_id;
end;
$$;

-- ── STEP 19: update_society_subscription() — super admin updates plan ─────────
create or replace function update_society_subscription(
  p_society_id        text,
  p_plan              text,
  p_plan_expires_at   timestamptz,
  p_is_locked         boolean,
  p_notes             text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update society_settings set
    plan               = p_plan,
    plan_expires_at    = p_plan_expires_at,
    is_locked          = p_is_locked,
    subscription_notes = p_notes
  where society_id = p_society_id;
end;
$$;

revoke execute on function get_all_societies()                                      from public, anon;
revoke execute on function get_society_user_counts()                                from public, anon;
revoke execute on function update_society_subscription(text, text, timestamptz, boolean, text) from public, anon;
grant  execute on function get_all_societies()                                      to authenticated;
grant  execute on function get_society_user_counts()                                to authenticated;
grant  execute on function update_society_subscription(text, text, timestamptz, boolean, text) to authenticated;

-- ── STEP 20: guide course completion certificates ────────────────────────────
-- Lightweight, password-less learner records for the public /guide course.
-- Reading the course needs no account; only claiming a certificate stores
-- name + email (a lead) and makes verification server-authoritative.
create table if not exists guide_certificates (
  cert_no       text primary key,            -- e.g. SL-20260618-YAF6P7
  holder_name   text        not null,
  email         text,
  society_name  text,
  parts_passed  int         not null default 0,
  issued_at     timestamptz not null default now()
);

-- RLS on, NO policies: direct anon access is denied, so emails / leads are never
-- selectable from the client. All access goes through the definer RPCs below.
alter table guide_certificates enable row level security;

-- Issue / re-claim a certificate (anon allowed via security definer).
create or replace function issue_certificate(
  p_cert_no      text,
  p_holder_name  text,
  p_email        text,
  p_society_name text,
  p_parts_passed int
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into guide_certificates(cert_no, holder_name, email, society_name, parts_passed)
  values (
    p_cert_no,
    btrim(p_holder_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_society_name, '')), ''),
    coalesce(p_parts_passed, 0)
  )
  on conflict (cert_no) do update set
    holder_name  = excluded.holder_name,
    email        = coalesce(excluded.email, guide_certificates.email),
    society_name = coalesce(excluded.society_name, guide_certificates.society_name),
    parts_passed = greatest(excluded.parts_passed, guide_certificates.parts_passed);
end;
$$;

-- Verify a certificate. Returns ONLY non-PII fields (never the email), and only
-- when the number AND holder name match (case / whitespace insensitive).
create or replace function verify_certificate(p_cert_no text, p_name text)
returns table(holder_name text, issued_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select holder_name, issued_at
  from guide_certificates
  where upper(replace(cert_no, ' ', '')) = upper(replace(coalesce(p_cert_no, ''), ' ', ''))
    and lower(btrim(regexp_replace(holder_name, '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

grant execute on function issue_certificate(text, text, text, text, int) to anon, authenticated;
grant execute on function verify_certificate(text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy / Milk society — daily collection register (member-wise qty/fat/SNF/payout)
-- RUN THIS BLOCK once in the Supabase SQL editor to enable the Milk Collection module.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists milk_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  shift text,
  "memberId" text,
  "memberName" text,
  qty numeric,
  fat numeric,
  snf numeric,
  rate numeric,
  amount numeric,
  "createdAt" timestamp default now()
);
-- Society-scoped RLS (mirrors the society_rw policy used by all data tables)
alter table public.milk_entries enable row level security;
drop policy if exists "society_rw" on public.milk_entries;
create policy "society_rw" on public.milk_entries for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- Dairy D2 (additive): quality / centre / rate-chart / capture-source columns.
alter table public.milk_entries add column if not exists "centreId" text;
alter table public.milk_entries add column if not exists clr numeric;
alter table public.milk_entries add column if not exists water numeric;
alter table public.milk_entries add column if not exists "qualityDecision" text;
alter table public.milk_entries add column if not exists "rateChartId" text;
alter table public.milk_entries add column if not exists source text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Capability-Based Navigation (C3) — per-society capability grant/revoke rows.
-- The single relational source for what a society MAY use beyond its type template.
--   mode   : 'grant' (entitle) | 'revoke' (admin-hide within entitlement)
--   source : 'admin' | 'plan' | 'plugin' | 'state' | 'trial' | 'system'  (precedence + audit)
--   expires_at : null = permanent; set for trials / time-bound entitlements
-- Type-template capabilities stay in CODE (not materialised here) → most societies have 0 rows.
-- Read-only plumbing in C3 (no writers yet); the admin editor (C6) writes source='admin' rows.
-- RUN THIS BLOCK once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists society_capabilities (
  id text primary key,
  society_id text not null default 'SOC001',
  capability text not null,
  mode text not null default 'grant',
  source text not null default 'admin',
  expires_at timestamptz,
  granted_by text,
  created_at timestamptz default now(),
  unique (society_id, capability, source)
);
create index if not exists idx_society_capabilities_society on society_capabilities(society_id);
create index if not exists idx_society_capabilities_capability on society_capabilities(capability);
-- Society-scoped RLS (mirrors the society_rw policy used by all data tables)
alter table public.society_capabilities enable row level security;

-- C6.3 + C6.4 — SERVER-SIDE TRUST + AUTHORIZATION (the DB is the authority, not client code).
-- READS stay open to any society member (entitlement resolution must see every source). WRITES are:
--   • restricted to source='admin', mode='revoke' (C6.3 — the only rows a client may create), AND
--   • allowed ONLY for a Society ADMINISTRATOR of that society (C6.4 — is_society_admin()).
-- So accountant/operator/viewer are rejected at the database even via direct API; entitlement
-- sources (plan/plugin/state/trial/system) remain server/service-role only. Idempotent: re-runnable.
drop policy if exists "society_rw"                on public.society_capabilities;
drop policy if exists "cap_select"                on public.society_capabilities;
drop policy if exists "cap_insert_admin_revoke"   on public.society_capabilities;
drop policy if exists "cap_update_admin_revoke"   on public.society_capabilities;
drop policy if exists "cap_delete_admin"          on public.society_capabilities;

-- READ: any society member (resolver needs all sources visible).
create policy "cap_select" on public.society_capabilities for select to authenticated
  using (society_id::text in (select public.current_user_society_ids()));

-- INSERT: only a society ADMIN may create an admin 'hide' row.
create policy "cap_insert_admin_revoke" on public.society_capabilities for insert to authenticated
  with check (
    public.is_society_admin(society_id::text)
    and source = 'admin' and mode = 'revoke'
  );

-- UPDATE: only a society ADMIN, only an existing admin row, staying admin/revoke.
create policy "cap_update_admin_revoke" on public.society_capabilities for update to authenticated
  using (
    public.is_society_admin(society_id::text)
    and source = 'admin'
  )
  with check (
    public.is_society_admin(society_id::text)
    and source = 'admin' and mode = 'revoke'
  );

-- DELETE: only a society ADMIN may remove an admin row (re-enable). Entitlement rows are untouchable.
create policy "cap_delete_admin" on public.society_capabilities for delete to authenticated
  using (
    public.is_society_admin(society_id::text)
    and source = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement ERP — Phase 1.0 (Farmer → ProcurementLot → lot.created event).
-- Minimal vertical slice: farmer master, lots, and an append-only event ledger.
-- Loads are error-tolerant; the app works before this block is run.
-- RUN THIS BLOCK once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_farmers (
  id text primary key,
  society_id text not null default 'SOC001',
  "farmerCode" text,
  "farmerName" text,
  "fatherName" text,
  mobile text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
-- Procurement CONFIG masters (Marketing M1a). Owned by MarketingDataContext (config, not the
-- event-sourced chain). Additive; safe to re-run.
create table if not exists procurement_crops (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  code text,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_crops_society on procurement_crops(society_id);
create table if not exists procurement_varieties (
  id text primary key,
  society_id text not null default 'SOC001',
  "cropId" text,
  name text,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_varieties_society on procurement_varieties(society_id);
-- Procurement CONFIG masters (Marketing M1b): season, agency, centre. Owned by MarketingDataContext.
create table if not exists procurement_seasons (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  "cropYear" text,
  "startDate" text,
  "endDate" text,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_seasons_society on procurement_seasons(society_id);
create table if not exists procurement_agencies (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  code text,
  kind text,
  "nameHi" text,
  "commissionRate" numeric,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_agencies_society on procurement_agencies(society_id);
-- M3d: per-agency commission % (for the already-shipped table).
alter table procurement_agencies add column if not exists "commissionRate" numeric;
create table if not exists procurement_centres (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  code text,
  "agencyId" text,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_centres_society on procurement_centres(society_id);
-- Procurement CONFIG master (Marketing M1c): effective-dated MSP rate per crop+season.
create table if not exists procurement_msp_rates (
  id text primary key,
  society_id text not null default 'SOC001',
  "cropId" text,
  "seasonId" text,
  rate jsonb,
  "effectiveFrom" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_msp_rates_society on procurement_msp_rates(society_id);
-- RLS for the Marketing procurement-master tables (M1a/M1b/M1c) — society-scoped, matching the
-- procurement_* `society_rw` convention. REQUIRED: RLS is enabled on new public tables, so without
-- these policies every insert is rejected ("new row violates row-level security policy").
alter table public.procurement_crops enable row level security;
alter table public.procurement_varieties enable row level security;
alter table public.procurement_seasons enable row level security;
alter table public.procurement_agencies enable row level security;
alter table public.procurement_centres enable row level security;
alter table public.procurement_msp_rates enable row level security;
drop policy if exists "society_rw" on public.procurement_crops;
drop policy if exists "society_rw" on public.procurement_varieties;
drop policy if exists "society_rw" on public.procurement_seasons;
drop policy if exists "society_rw" on public.procurement_agencies;
drop policy if exists "society_rw" on public.procurement_centres;
drop policy if exists "society_rw" on public.procurement_msp_rates;
create policy "society_rw" on public.procurement_crops for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_varieties for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_seasons for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_agencies for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_centres for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_msp_rates for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- Procurement CONFIG masters (Marketing M1d): deduction rules, quality specs, bardana types.
-- Consumed by quality (M2) & settlement (M3). RLS policies bundled (see the M1a–c RLS lesson).
create table if not exists procurement_deduction_rules (
  id text primary key,
  society_id text not null default 'SOC001',
  code text,
  basis text,
  rate jsonb,
  "accountId" text,
  name text,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_deduction_rules_society on procurement_deduction_rules(society_id);
-- M3b: dedicated ledger each deduction rule credits at settlement (for the already-shipped table).
alter table procurement_deduction_rules add column if not exists "accountId" text;
create table if not exists procurement_quality_specs (
  id text primary key,
  society_id text not null default 'SOC001',
  "cropId" text,
  "seasonId" text,
  parameter text,
  "maxLimit" numeric,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_quality_specs_society on procurement_quality_specs(society_id);
create table if not exists procurement_bardana_types (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  "capacityKg" numeric,
  "nameHi" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_procurement_bardana_types_society on procurement_bardana_types(society_id);
alter table public.procurement_deduction_rules enable row level security;
alter table public.procurement_quality_specs enable row level security;
alter table public.procurement_bardana_types enable row level security;
drop policy if exists "society_rw" on public.procurement_deduction_rules;
drop policy if exists "society_rw" on public.procurement_quality_specs;
drop policy if exists "society_rw" on public.procurement_bardana_types;
create policy "society_rw" on public.procurement_deduction_rules for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_quality_specs for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_bardana_types for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- Marketing Transport (T1): transporter master. RLS bundled (society_rw convention).
create table if not exists marketing_transporters (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  "nameHi" text,
  "vehicleNo" text,
  phone text,
  "ratePerQtl" numeric,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_marketing_transporters_society on marketing_transporters(society_id);
alter table public.marketing_transporters enable row level security;
drop policy if exists "society_rw" on public.marketing_transporters;
create policy "society_rw" on public.marketing_transporters for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create table if not exists procurement_lots (
  id text primary key,
  society_id text not null default 'SOC001',
  "centreId" text,
  "seasonId" text,
  "cropId" text,
  "varietyId" text,
  "farmerId" text,
  "arhtiyaId" text,
  quantity jsonb,
  "mspRate" jsonb,
  "operationalStatus" text,
  "financialStatus" text,
  "reconciliationStatus" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create table if not exists procurement_events (
  id text primary key,
  society_id text not null default 'SOC001',
  name text not null,
  "correlationId" text,
  "occurredAt" timestamptz,
  "recordedAt" timestamptz default now(),
  actor text,
  payload jsonb
);
-- Society-scoped RLS (mirrors the society_rw policy used by all data tables)
alter table public.procurement_farmers enable row level security;
alter table public.procurement_lots enable row level security;
alter table public.procurement_events enable row level security;
drop policy if exists "society_rw" on public.procurement_farmers;
drop policy if exists "society_rw" on public.procurement_lots;
drop policy if exists "society_rw" on public.procurement_events;
create policy "society_rw" on public.procurement_farmers for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_lots for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_events for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement Phase 2.1 — Quality Inspection (pure recording): a quality test + the
-- measured moisture value per lot. Loosely coupled by lotId; loads are error-tolerant.
-- RUN THIS BLOCK once in the Supabase SQL editor BEFORE the commit-transaction function
-- (which now references these tables).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_quality_tests (
  id text primary key,
  society_id text not null default 'SOC001',
  "lotId" text,
  result text,
  "inspectedBy" text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create table if not exists procurement_moisture_records (
  id text primary key,
  society_id text not null default 'SOC001',
  "lotId" text,
  moisture jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_quality_tests enable row level security;
alter table public.procurement_moisture_records enable row level security;
drop policy if exists "society_rw" on public.procurement_quality_tests;
drop policy if exists "society_rw" on public.procurement_moisture_records;
create policy "society_rw" on public.procurement_quality_tests for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create policy "society_rw" on public.procurement_moisture_records for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- Phase 2.1.1 — business invariant (AUTHORITATIVE): one QualityTest + one MoistureRecord per lot.
-- The commit RPC stays INSERT-only; a duplicate "lotId" violates these unique indexes, so the
-- INSERT fails and the whole transaction rolls back atomically — duplicates are blocked even if
-- the UI / DataContext is bypassed. NOTE: assumes no existing duplicate "lotId" rows; if any
-- exist they must be removed before these indexes can be created.
create unique index if not exists procurement_quality_tests_lot_uniq on public.procurement_quality_tests ("lotId");
create unique index if not exists procurement_moisture_records_lot_uniq on public.procurement_moisture_records ("lotId");

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement Phase 2.2 — J-Form (a business DOCUMENT only; NOT an accounting event — no
-- voucher / intent / posting). gross/deductions/net are document figures, not ledger postings.
-- Business invariant (AUTHORITATIVE): one J-Form per lot — the unique index on "lotId" makes the
-- INSERT-only commit fail + roll back atomically on a duplicate. RUN this block once in the
-- Supabase SQL editor BEFORE the commit-transaction function (which now references this table).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_jforms (
  id text primary key,
  society_id text not null default 'SOC001',
  "lotId" text,
  "documentNo" text,
  gross jsonb,
  deductions jsonb,
  net jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_jforms enable row level security;
drop policy if exists "society_rw" on public.procurement_jforms;
create policy "society_rw" on public.procurement_jforms for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_jforms_lot_uniq on public.procurement_jforms ("lotId");

-- Phase 2.3 — J-Form document numbering is DB-owned (single source of truth). A per-society
-- counter, incremented atomically inside the commit transaction (row-lock serializes concurrent
-- generators; rolls back with the transaction). The (society_id, "documentNo") unique index is the
-- AUTHORITATIVE final guard against duplicate official numbers. The client never generates J000n.
create table if not exists procurement_jform_counters (
  society_id text primary key,
  last_no integer not null default 0
);
alter table public.procurement_jform_counters enable row level security;
drop policy if exists "society_rw" on public.procurement_jform_counters;
create policy "society_rw" on public.procurement_jform_counters for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_jforms_docno_uniq on public.procurement_jforms (society_id, "documentNo");
-- T-05: typed money columns (promote J-Form gross/deductions/net JSONB → integer-paise + currency).
-- Unlike settlements, J-Form rows are written ONLY by procurement_commit_transaction, so the
-- typed columns are derived SERVER-SIDE inside that function; migration 042 backfills existing rows.
alter table public.procurement_jforms add column if not exists "grossAmountMinor"      bigint;
alter table public.procurement_jforms add column if not exists "grossCurrency"         text;
alter table public.procurement_jforms add column if not exists "deductionsAmountMinor" bigint;
alter table public.procurement_jforms add column if not exists "deductionsCurrency"    text;
alter table public.procurement_jforms add column if not exists "netAmountMinor"        bigint;
alter table public.procurement_jforms add column if not exists "netCurrency"           text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement Phase 3.0 — Financial Intent (a business OBJECT only; NOT accounting — no posting /
-- engine / voucher / ledger). Business invariant (AUTHORITATIVE): one Financial Intent per J-Form —
-- the unique index on "jformId" makes the INSERT-only commit fail + roll back atomically on a
-- duplicate. RUN this block once BEFORE the commit-transaction function (which now references it).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_financial_intents (
  id text primary key,
  society_id text not null default 'SOC001',
  "lotId" text,
  "jformId" text,
  "intentType" text,
  amount jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_financial_intents enable row level security;
drop policy if exists "society_rw" on public.procurement_financial_intents;
create policy "society_rw" on public.procurement_financial_intents for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_financial_intents_jform_uniq on public.procurement_financial_intents ("jformId");
-- T-05: typed money columns (amount JSONB → integer-paise + currency), derived SERVER-SIDE by
-- procurement_commit_transaction; migration 043 backfills existing rows.
alter table public.procurement_financial_intents add column if not exists "amountAmountMinor" bigint;
alter table public.procurement_financial_intents add column if not exists "amountCurrency"    text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement Phase 3.1 — Posting Request (a business OBJECT only; NOT posting / ledger /
-- accounting / voucher). Business invariant (AUTHORITATIVE): one Posting Request per Financial
-- Intent — the unique index on "financialIntentId" makes the INSERT-only commit fail + roll back
-- atomically on a duplicate. RUN this block once BEFORE the commit-transaction function.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_posting_requests (
  id text primary key,
  society_id text not null default 'SOC001',
  "lotId" text,
  "jformId" text,
  "financialIntentId" text,
  "requestType" text,
  amount jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_posting_requests enable row level security;
drop policy if exists "society_rw" on public.procurement_posting_requests;
create policy "society_rw" on public.procurement_posting_requests for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_posting_requests_intent_uniq on public.procurement_posting_requests ("financialIntentId");
-- T-05: typed money columns (amount JSONB → integer-paise + currency), derived SERVER-SIDE by
-- procurement_commit_transaction; migration 043 backfills existing rows.
alter table public.procurement_posting_requests add column if not exists "amountAmountMinor" bigint;
alter table public.procurement_posting_requests add column if not exists "amountCurrency"    text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement Phase 3.2 — Posting Rule Result (a business OBJECT only; NOT posting / ledger /
-- voucher). Stores the resolved legs (data) for a Posting Request. Business invariant
-- (AUTHORITATIVE): one result per Posting Request — the unique index on "postingRequestId" makes the
-- INSERT-only commit fail + roll back atomically on a duplicate. RUN once BEFORE the commit function.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_posting_rule_results (
  id text primary key,
  society_id text not null default 'SOC001',
  "postingRequestId" text,
  "lotId" text,
  "jformId" text,
  "financialIntentId" text,
  "requestType" text,
  profile text,
  legs jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_posting_rule_results enable row level security;
drop policy if exists "society_rw" on public.procurement_posting_rule_results;
create policy "society_rw" on public.procurement_posting_rule_results for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_posting_rule_results_request_uniq on public.procurement_posting_rule_results ("postingRequestId");

-- ─────────────────────────────────────────────────────────────────────────────
-- Farmer Settlement — the AUTHORITATIVE business document for procurement settlement.
-- Business state (gross, deduction lines, netPayable, settlementNo, approval metadata) is stored
-- here permanently and NEVER reconstructed from vouchers; only "amountPaid" advances as payments
-- post. One settlement per Engine Voucher (the unique index on "engineVoucherId" is the AUTHORITATIVE
-- guard). "settlementNo" is DB-owned & gap-free (per-society counter, assigned at approval inside the
-- commit transaction — same model as J-Form documentNo). RUN this block once BEFORE the commit function.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists procurement_settlements (
  id text primary key,
  society_id text not null default 'SOC001',
  "settlementNo" text,
  "engineVoucherId" text,
  status text,
  gross jsonb,
  "deductionLines" jsonb,
  "netPayable" jsonb,
  "amountPaid" jsonb,
  "settlementVoucherId" text,
  "approvedAt" timestamptz,
  "approvedBy" text,
  "createdBy" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
alter table public.procurement_settlements enable row level security;
drop policy if exists "society_rw" on public.procurement_settlements;
create policy "society_rw" on public.procurement_settlements for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists procurement_settlements_ev_uniq on public.procurement_settlements ("engineVoucherId");
create unique index if not exists procurement_settlements_no_uniq on public.procurement_settlements (society_id, "settlementNo");
-- T-05: typed money columns (promote gross/netPayable/amountPaid JSONB → integer-paise + currency).
-- The client dual-writes these alongside the JSONB; migration 017 backfills existing rows.
alter table public.procurement_settlements add column if not exists "grossAmountMinor"      bigint;
alter table public.procurement_settlements add column if not exists "grossCurrency"         text;
alter table public.procurement_settlements add column if not exists "netPayableAmountMinor" bigint;
alter table public.procurement_settlements add column if not exists "netPayableCurrency"    text;
alter table public.procurement_settlements add column if not exists "amountPaidAmountMinor" bigint;
alter table public.procurement_settlements add column if not exists "amountPaidCurrency"    text;

-- Per-society settlement-number counter (row-locked inside the commit transaction → concurrency-safe;
-- rolls back with the transaction). The client never generates STLnnnnnn.
create table if not exists procurement_settlement_counters (
  society_id text primary key,
  last_no integer not null default 0
);
alter table public.procurement_settlement_counters enable row level security;
drop policy if exists "society_rw" on public.procurement_settlement_counters;
create policy "society_rw" on public.procurement_settlement_counters for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Housing cooperative — Flats/Units register (master data; no accounting in V1).
-- Plain society-scoped table (client upserts directly, like members). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists housing_flats (
  id text primary key,
  society_id text not null default 'SOC001',
  "flatNo" text,
  "blockNo" text,
  "memberId" text,
  "ownerType" text,
  area numeric,
  "monthlyMaintenance" numeric,
  "registrationDate" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
-- Housing H1 — flat-master expansion (additive; run on existing deployments).
alter table public.housing_flats add column if not exists floor text;
alter table public.housing_flats add column if not exists "unitType" text;
alter table public.housing_flats add column if not exists "associateMemberId" text;
alter table public.housing_flats add column if not exists occupancy text;
-- Housing H2a — owner-member receivable sub-ledger (leaf under 3303).
alter table public.housing_flats add column if not exists "receivableAccountId" text;
alter table public.housing_flats enable row level security;
drop policy if exists "society_rw" on public.housing_flats;
create policy "society_rw" on public.housing_flats for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Housing — Maintenance bills (one ACTIVE bill per flat per period). Each bill posts a
-- receivable voucher (Dr 3303 / Cr 4101), refType='maintenance.bill', refId=bill.id. RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists maintenance_bills (
  id text primary key,
  society_id text not null default 'SOC001',
  "billNo" text,
  "flatId" text,
  "flatNo" text,
  "memberId" text,
  period text,
  date text,
  amount numeric,
  "voucherId" text,
  "paidAmount" numeric default 0,
  status text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
-- Housing H2a — account the demand debited (owner-member sub-ledger); collection credits the same.
alter table public.maintenance_bills add column if not exists "receivableAccountId" text;
-- Housing H2b — per-charge-head breakdown of the bill.
alter table public.maintenance_bills add column if not exists lines jsonb;
alter table public.maintenance_bills enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Housing H2b — society-wide maintenance charge-head schedule. Each head posts to its own
-- target account (income 41xx / fund 1202,1204 / pass-through 2207) on the demand voucher. RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists housing_charge_heads (
  id text primary key,
  society_id text not null default 'SOC001',
  code text,
  "nameHi" text,
  "nameEn" text,
  "accountId" text,
  "isFund" boolean default false,
  basis text,
  rate numeric default 0,
  "order" numeric default 0,
  "isActive" boolean default true,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.housing_charge_heads enable row level security;
drop policy if exists "society_rw" on public.housing_charge_heads;
create policy "society_rw" on public.housing_charge_heads for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- per-flat charge override map (by chargeHeadId; 0 = head not applicable)
alter table public.housing_flats add column if not exists "chargeOverrides" jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- Housing H3b — fund investments (FDR/bond that earmarks a reserve fund's corpus). Posting is
-- Dr investment asset / Cr bank; the fund account itself is unchanged. RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists housing_fund_investments (
  id text primary key,
  society_id text not null default 'SOC001',
  "fundAccountId" text,
  "investmentAccountId" text,
  instrument text,
  institution text,
  amount numeric,
  date text,
  "maturityDate" text,
  "interestRate" numeric,
  "voucherId" text,
  "redemptionVoucherId" text,
  status text default 'active',
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.housing_fund_investments enable row level security;
drop policy if exists "society_rw" on public.housing_fund_investments;
create policy "society_rw" on public.housing_fund_investments for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Housing H5 — operational & governance registers (complaints, parking, transfers). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists housing_complaints (
  id text primary key,
  society_id text not null default 'SOC001',
  "complaintNo" text, "flatId" text, "flatNo" text, "memberId" text,
  category text, title text, description text, "raisedDate" text,
  status text default 'open', resolution text, "resolvedDate" text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_complaints enable row level security;
drop policy if exists "society_rw" on public.housing_complaints;
create policy "society_rw" on public.housing_complaints for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

create table if not exists housing_parking (
  id text primary key,
  society_id text not null default 'SOC001',
  "slotNo" text, "flatId" text, "flatNo" text, "memberId" text,
  "vehicleType" text, "vehicleNo" text, "monthlyCharge" numeric,
  status text default 'allotted',
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_parking enable row level security;
drop policy if exists "society_rw" on public.housing_parking;
create policy "society_rw" on public.housing_parking for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

create table if not exists housing_transfers (
  id text primary key,
  society_id text not null default 'SOC001',
  "flatId" text, "flatNo" text, "fromMemberId" text, "toMemberId" text,
  date text, "transferFee" numeric, premium numeric, "voucherId" text, remarks text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_transfers enable row level security;
drop policy if exists "society_rw" on public.housing_transfers;
create policy "society_rw" on public.housing_transfers for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
drop policy if exists "society_rw" on public.maintenance_bills;
create policy "society_rw" on public.maintenance_bills for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create unique index if not exists maintenance_bills_flat_period_uniq on public.maintenance_bills ("flatId", period) where ("isDeleted" = false);

-- Housing R1 — society_id load-path indexes (parity with vouchers/sales/members etc.), plus
-- integrity guards on slot / complaint numbering. RUN once.
create index if not exists idx_housing_flats_society on public.housing_flats (society_id);
create index if not exists idx_maintenance_bills_society_period on public.maintenance_bills (society_id, period);
create index if not exists idx_housing_charge_heads_society on public.housing_charge_heads (society_id);
create index if not exists idx_housing_fund_investments_society on public.housing_fund_investments (society_id);
create index if not exists idx_housing_complaints_society on public.housing_complaints (society_id);
create index if not exists idx_housing_parking_society on public.housing_parking (society_id);
create index if not exists idx_housing_transfers_society on public.housing_transfers (society_id);
create unique index if not exists housing_parking_slot_uniq on public.housing_parking (society_id, "slotNo") where ("isDeleted" = false);
create unique index if not exists housing_complaints_no_uniq on public.housing_complaints (society_id, "complaintNo") where ("isDeleted" = false);

-- Housing R2 — GST on maintenance (society toggle + rate; per charge-head taxable flag & kind),
-- and governance resolution reference on transfers. RUN once.
alter table public.society_settings add column if not exists "maintenanceGstEnabled" boolean default false;
alter table public.society_settings add column if not exists "maintenanceGstRate" numeric default 18;
alter table public.housing_charge_heads add column if not exists gstable boolean default false;
alter table public.housing_charge_heads add column if not exists kind text;
alter table public.housing_transfers add column if not exists "resolutionNo" text;
alter table public.housing_transfers add column if not exists "resolutionDate" text;

-- Housing R3 — share certificate & nomination as per-flat properties, + transfer basis. RUN once.
alter table public.housing_flats add column if not exists "shareCertNo" text;
alter table public.housing_flats add column if not exists "shareCount" numeric;
alter table public.housing_flats add column if not exists "shareFaceValue" numeric;
alter table public.housing_flats add column if not exists "nomineeName" text;
alter table public.housing_flats add column if not exists "nomineeRelation" text;
alter table public.housing_flats add column if not exists "nomineePhone" text;
alter table public.housing_transfers add column if not exists "transferType" text;

-- Housing R4 — insurance policy register + AMC/vendor-contract register. RUN once.
create table if not exists housing_insurance (
  id text primary key, society_id text not null default 'SOC001',
  "policyNo" text, insurer text, "coverageType" text, "sumInsured" numeric, premium numeric,
  "startDate" text, "expiryDate" text, remarks text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_insurance enable row level security;
drop policy if exists "society_rw" on public.housing_insurance;
create policy "society_rw" on public.housing_insurance for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_housing_insurance_society on public.housing_insurance (society_id);

create table if not exists housing_amc (
  id text primary key, society_id text not null default 'SOC001',
  "contractNo" text, vendor text, equipment text, amount numeric,
  "startDate" text, "expiryDate" text, remarks text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_amc enable row level security;
drop policy if exists "society_rw" on public.housing_amc;
create policy "society_rw" on public.housing_amc for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_housing_amc_society on public.housing_amc (society_id);

-- Housing R5 — legal / statutory document register (NOC, occupancy cert, notices). RUN once.
create table if not exists housing_documents (
  id text primary key, society_id text not null default 'SOC001',
  "docType" text, title text, reference text, authority text,
  date text, "expiryDate" text, status text, remarks text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_documents enable row level security;
drop policy if exists "society_rw" on public.housing_documents;
create policy "society_rw" on public.housing_documents for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_housing_documents_society on public.housing_documents (society_id);

-- Housing — building / wing / tower master (multi-tower societies) + optional flat link. RUN once.
create table if not exists housing_buildings (
  id text primary key, society_id text not null default 'SOC001',
  name text, address text, floors numeric, "totalUnits" numeric, remarks text,
  "isDeleted" boolean default false, "createdAt" timestamptz default now()
);
alter table public.housing_buildings enable row level security;
drop policy if exists "society_rw" on public.housing_buildings;
create policy "society_rw" on public.housing_buildings for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_housing_buildings_society on public.housing_buildings (society_id);
alter table public.housing_flats add column if not exists "buildingId" text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Work Orders / labour-contract register (master data; no
-- accounting in V1). Plain society-scoped table (client upserts directly). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists work_orders (
  id text primary key,
  society_id text not null default 'SOC001',
  "workOrderNo" text,
  "clientName" text,
  description text,
  "contractValue" numeric,
  "startDate" text,
  "endDate" text,
  status text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
-- Work Order → Department link (V2): which department/principal-employer awarded this order.
alter table public.work_orders add column if not exists "departmentId" text;
alter table public.work_orders enable row level security;
drop policy if exists "society_rw" on public.work_orders;
create policy "society_rw" on public.work_orders for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Muster Roll / attendance-&-wage-basis register (master
-- data; no accounting in V1, wage payment is a separate feature). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists muster_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  "workOrderId" text,
  period text,
  "memberId" text,
  "daysWorked" numeric,
  "dailyWage" numeric,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
-- Wage Payment (V3): mark a muster entry paid + link its wage-payment voucher.
alter table public.muster_entries add column if not exists paid boolean default false;
alter table public.muster_entries add column if not exists "paymentVoucherId" text;
-- Wage Accrual (V4): mark the wages-payable liability booked + link the accrual voucher.
alter table public.muster_entries add column if not exists accrued boolean default false;
alter table public.muster_entries add column if not exists "accrualVoucherId" text;
-- Partial Wage Payment (V5): cumulative amount paid (supports per-labourer + instalment).
alter table public.muster_entries add column if not exists "paidAmount" numeric default 0;
-- Wage Basis (V6): daily / piece / hourly — wage stays qty×rate, only the meaning changes.
alter table public.muster_entries add column if not exists "workBasis" text;
alter table public.muster_entries enable row level security;
drop policy if exists "society_rw" on public.muster_entries;
create policy "society_rw" on public.muster_entries for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Worker master (members / non-members / contract workers).
-- Master data only (no accounting). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists workers (
  id text primary key,
  society_id text not null default 'SOC001',
  "workerCode" text,
  name text,
  "workerType" text,
  "memberId" text,
  category text,
  phone text,
  "defaultDailyWage" numeric,
  "idProofType" text,
  "idProofNo" text,
  status text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.workers enable row level security;
drop policy if exists "society_rw" on public.workers;
create policy "society_rw" on public.workers for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- B1: statutory & payout identifiers (CLRA Form XIII / EPF / ESI / NEFT). RUN once.
alter table public.workers add column if not exists "uan" text;
alter table public.workers add column if not exists "esiIp" text;
alter table public.workers add column if not exists "pan" text;
alter table public.workers add column if not exists "aadhaar" text;
alter table public.workers add column if not exists "bankAccountNo" text;
alter table public.workers add column if not exists "ifsc" text;
alter table public.workers add column if not exists "dateOfBirth" text;
alter table public.workers add column if not exists "gender" text;
alter table public.workers add column if not exists "fatherHusbandName" text;
alter table public.workers add column if not exists "joiningDate" text;
alter table public.workers add column if not exists "permanentAddress" text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Department / Principal-Employer master (the client that awards
-- work orders; a debtor with an auto receivable sub-ledger under 3303). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists departments (
  id text primary key,
  society_id text not null default 'SOC001',
  "departmentCode" text,
  name text,
  "departmentType" text,
  "accountId" text,
  "contactPerson" text,
  phone text,
  address text,
  gstin text,
  "tdsApplicable" boolean default false,
  "openingBalance" numeric,
  status text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.departments enable row level security;
drop policy if exists "society_rw" on public.departments;
create policy "society_rw" on public.departments for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Department Bills (income side; raised on a department, posts
-- Dr receivable / Cr 4203 Labour Charges; collection reduces receivable). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists department_bills (
  id text primary key,
  society_id text not null default 'SOC001',
  "billNo" text,
  "departmentId" text,
  "workOrderId" text,
  "billType" text,
  date text,
  amount numeric,
  "paidAmount" numeric default 0,
  status text,
  "voucherId" text,
  narration text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.department_bills enable row level security;
drop policy if exists "society_rw" on public.department_bills;
create policy "society_rw" on public.department_bills for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — Worker Advances (asset 3304; given to workers, recovered over
-- time). RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists worker_advances (
  id text primary key,
  society_id text not null default 'SOC001',
  "advanceNo" text,
  "workerId" text,
  date text,
  amount numeric,
  recovered numeric default 0,
  status text,
  mode text,
  "voucherId" text,
  narration text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.worker_advances enable row level security;
drop policy if exists "society_rw" on public.worker_advances;
create policy "society_rw" on public.worker_advances for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Labour cooperative — monthly EPF/ESI processing runs (computed from muster wages).
-- RUN once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists pf_esi_runs (
  id text primary key,
  society_id text not null default 'SOC001',
  period text,
  "grossWages" numeric,
  "epfEmployee" numeric,
  "epfEmployer" numeric,
  "esiEmployee" numeric,
  "esiEmployer" numeric,
  status text,
  "voucherId" text,
  "depositVoucherId" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.pf_esi_runs enable row level security;
drop policy if exists "society_rw" on public.pf_esi_runs;
create policy "society_rw" on public.pf_esi_runs for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- B2: employer EDLI 0.5% + admin 0.5% (the extra 1% of EPF wages). RUN once.
alter table public.pf_esi_runs add column if not exists "epfAdminEdli" numeric;

-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement — generic BUSINESS TRANSACTION boundary (M1 fix). ONE plpgsql
-- transaction: every supplied collection commits together, or nothing does — a
-- ProcurementLot can never exist in the cloud without its immutable creation event.
--
-- PAYLOAD ENVELOPE: { transactionType, transactionId, transactionVersion, lots[], events[], …future collections }.
--   transactionType    — the business operation, e.g. 'lot.create', 'jform.generate',
--                       'dispatch.create', 'payment.release', 'claim.raise', …
--   transactionId       — one immutable id per business transaction (future audit-ledger /
--                       financial-engine / document-store / posting / integration linkage).
--   transactionVersion  — payload-schema version (today: 1). Reserved so the server can keep
--                       older clients working if the envelope ever evolves. No behaviour use yet.
-- Phase-1 processes only lots[] + events[]; the envelope fields are RESERVED metadata
-- (read by future handlers — no behaviour change here).
--
-- STABLE SIGNATURE: future phases add optional keys (jforms / documents / claims /
-- dispatches / payments / financialIntents / postingRequests / …) with new internal
-- handlers; the RPC name and the client contract never change. SECURITY INVOKER, so the
-- existing society_rw RLS still applies. RUN THIS BLOCK once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────
-- D1(A): returns jsonb now (return-type change requires drop+create). Name, the (jsonb) input
-- signature, the payload envelope, the metadata, and the atomicity model are all unchanged.
drop function if exists public.procurement_commit_transaction(jsonb);
create function public.procurement_commit_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec jsonb;
  v_sid text;
  v_no integer;
  v_doc text;
  v_payload jsonb;
  v_docmap jsonb := '{}'::jsonb;   -- jformId -> generated documentNo
  v_result jsonb := '[]'::jsonb;   -- [{ id, lotId, documentNo }] returned to the client
  v_stl text;                      -- generated settlementNo (this transaction)
  v_stlmap jsonb := '{}'::jsonb;   -- settlementId -> generated settlementNo
  v_settle_result jsonb := '[]'::jsonb;  -- [{ id, settlementNo }] returned to the client
begin
  if p_payload ? 'lots' then
    for rec in select value from jsonb_array_elements(p_payload->'lots') loop
      insert into procurement_lots (id, society_id, "centreId", "seasonId", "cropId", "varietyId", "farmerId", "arhtiyaId", quantity, "mspRate", "operationalStatus", "financialStatus", "reconciliationStatus", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'centreId', rec->>'seasonId', rec->>'cropId', rec->>'varietyId', rec->>'farmerId', rec->>'arhtiyaId', rec->'quantity', rec->'mspRate', rec->>'operationalStatus', rec->>'financialStatus', rec->>'reconciliationStatus', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'qualityTests' then
    for rec in select value from jsonb_array_elements(p_payload->'qualityTests') loop
      insert into procurement_quality_tests (id, society_id, "lotId", result, "inspectedBy", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'result', rec->>'inspectedBy', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'moistureRecords' then
    for rec in select value from jsonb_array_elements(p_payload->'moistureRecords') loop
      insert into procurement_moisture_records (id, society_id, "lotId", moisture, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->'moisture', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'jforms' then
    for rec in select value from jsonb_array_elements(p_payload->'jforms') loop
      v_sid := rec->>'society_id';
      -- DB-owned numbering: atomic per-society counter (row-locked → concurrency-safe).
      insert into procurement_jform_counters (society_id, last_no) values (v_sid, 1)
        on conflict (society_id) do update set last_no = procurement_jform_counters.last_no + 1
        returning last_no into v_no;
      v_doc := 'J' || lpad(v_no::text, 4, '0');
      insert into procurement_jforms (id, society_id, "lotId", "documentNo", gross, deductions, net,
        "grossAmountMinor", "grossCurrency", "deductionsAmountMinor", "deductionsCurrency", "netAmountMinor", "netCurrency",
        "createdAt", "updatedAt")
      values (rec->>'id', v_sid, rec->>'lotId', v_doc, rec->'gross', rec->'deductions', rec->'net',
        -- T-05 dual-write, derived server-side from the SAME payload (NULL-safe: absent money
        -- object → NULL typed columns → the client dual-read falls back to the JSONB).
        (round(((rec->'gross'->>'amount')::numeric)      * 100))::bigint, case when rec ? 'gross'      then coalesce(rec->'gross'->>'currency', 'INR')      end,
        (round(((rec->'deductions'->>'amount')::numeric) * 100))::bigint, case when rec ? 'deductions' then coalesce(rec->'deductions'->>'currency', 'INR') end,
        (round(((rec->'net'->>'amount')::numeric)        * 100))::bigint, case when rec ? 'net'        then coalesce(rec->'net'->>'currency', 'INR')        end,
        (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
      v_docmap := v_docmap || jsonb_build_object(rec->>'id', v_doc);
      v_result := v_result || jsonb_build_object('id', rec->>'id', 'lotId', rec->>'lotId', 'documentNo', v_doc);
    end loop;
  end if;
  if p_payload ? 'financialIntents' then
    for rec in select value from jsonb_array_elements(p_payload->'financialIntents') loop
      insert into procurement_financial_intents (id, society_id, "lotId", "jformId", "intentType", amount,
        "amountAmountMinor", "amountCurrency", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'jformId', rec->>'intentType', rec->'amount',
        -- T-05 dual-write, derived server-side from the SAME payload (NULL-safe).
        (round(((rec->'amount'->>'amount')::numeric) * 100))::bigint, case when rec ? 'amount' then coalesce(rec->'amount'->>'currency', 'INR') end,
        (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'postingRequests' then
    for rec in select value from jsonb_array_elements(p_payload->'postingRequests') loop
      insert into procurement_posting_requests (id, society_id, "lotId", "jformId", "financialIntentId", "requestType", amount,
        "amountAmountMinor", "amountCurrency", "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'lotId', rec->>'jformId', rec->>'financialIntentId', rec->>'requestType', rec->'amount',
        -- T-05 dual-write, derived server-side from the SAME payload (NULL-safe).
        (round(((rec->'amount'->>'amount')::numeric) * 100))::bigint, case when rec ? 'amount' then coalesce(rec->'amount'->>'currency', 'INR') end,
        (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'postingRuleResults' then
    for rec in select value from jsonb_array_elements(p_payload->'postingRuleResults') loop
      insert into procurement_posting_rule_results (id, society_id, "postingRequestId", "lotId", "jformId", "financialIntentId", "requestType", profile, legs, "createdAt", "updatedAt")
      values (rec->>'id', rec->>'society_id', rec->>'postingRequestId', rec->>'lotId', rec->>'jformId', rec->>'financialIntentId', rec->>'requestType', rec->>'profile', rec->'legs', (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz);
    end loop;
  end if;
  if p_payload ? 'settlements' then
    for rec in select value from jsonb_array_elements(p_payload->'settlements') loop
      v_sid := rec->>'society_id';
      -- DB-owned numbering: assign a gap-free per-society number only at approval (when the row
      -- becomes 'approved' and has no number yet). Row-locked counter → concurrency-safe.
      if (rec->>'status') = 'approved' and (rec->>'settlementNo') is null then
        insert into procurement_settlement_counters (society_id, last_no) values (v_sid, 1)
          on conflict (society_id) do update set last_no = procurement_settlement_counters.last_no + 1
          returning last_no into v_no;
        v_stl := 'STL' || lpad(v_no::text, 6, '0');
      else
        v_stl := rec->>'settlementNo';
      end if;
      insert into procurement_settlements (id, society_id, "settlementNo", "engineVoucherId", status, gross, "deductionLines", "netPayable", "amountPaid", "settlementVoucherId", "approvedAt", "approvedBy", "createdBy", "isDeleted", "createdAt", "updatedAt")
      values (rec->>'id', v_sid, v_stl, rec->>'engineVoucherId', rec->>'status', rec->'gross', rec->'deductionLines', rec->'netPayable', rec->'amountPaid', rec->>'settlementVoucherId', (rec->>'approvedAt')::timestamptz, rec->>'approvedBy', rec->>'createdBy', coalesce((rec->>'isDeleted')::boolean, false), (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz)
      on conflict (id) do update set
        "settlementNo" = excluded."settlementNo", status = excluded.status, gross = excluded.gross,
        "deductionLines" = excluded."deductionLines", "netPayable" = excluded."netPayable",
        "amountPaid" = excluded."amountPaid", "settlementVoucherId" = excluded."settlementVoucherId",
        "approvedAt" = excluded."approvedAt", "approvedBy" = excluded."approvedBy",
        "isDeleted" = excluded."isDeleted", "updatedAt" = excluded."updatedAt";
      v_stlmap := v_stlmap || jsonb_build_object(rec->>'id', v_stl);
      v_settle_result := v_settle_result || jsonb_build_object('id', rec->>'id', 'settlementNo', v_stl);
    end loop;
  end if;
  if p_payload ? 'events' then
    for rec in select value from jsonb_array_elements(p_payload->'events') loop
      v_payload := rec->'payload';
      -- D2(ii): stamp the DB-generated number into the immutable event so it can never diverge.
      if v_payload ? 'jformId' and v_docmap ? (v_payload->>'jformId') then
        v_payload := jsonb_set(v_payload, '{documentNo}', v_docmap->(v_payload->>'jformId'));
      end if;
      if v_payload ? 'settlementId' and v_stlmap ? (v_payload->>'settlementId') then
        v_payload := jsonb_set(v_payload, '{settlementNo}', v_stlmap->(v_payload->>'settlementId'));
      end if;
      insert into procurement_events (id, society_id, name, "correlationId", "occurredAt", "recordedAt", actor, payload)
      values (rec->>'id', rec->>'society_id', rec->>'name', rec->>'correlationId', (rec->>'occurredAt')::timestamptz, (rec->>'recordedAt')::timestamptz, rec->>'actor', v_payload);
    end loop;
  end if;
  return jsonb_build_object('jforms', v_result, 'settlements', v_settle_result);
end;
$$;
grant execute on function public.procurement_commit_transaction(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy cooperative (Delivery D1) — Fat + SNF two-axis milk rate charts.
-- Effective-dated & immutable-by-convention: a rate revision is a NEW row with a
-- later "effectiveFrom". fatBands/snfBands/matrix are stored as JSON.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists dairy_rate_charts (
  id text primary key,
  society_id text not null default 'SOC001',
  name text,
  basis text,
  "effectiveFrom" text,
  season text,
  "fatBands" jsonb,
  "snfBands" jsonb,
  matrix jsonb,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.dairy_rate_charts enable row level security;
drop policy if exists "society_rw" on public.dairy_rate_charts;
create policy "society_rw" on public.dairy_rate_charts for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_dairy_rate_charts_society on public.dairy_rate_charts (society_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy cooperative (Delivery D3) — per-member, per-cycle farmer settlements.
-- SSOT for the payout amounts: gross (accepted milk value) − deductionLines
-- (recoveries) = netPayable; amountPaid advances as payments post. On approval a
-- compound voucher posts Dr milk-cost / Cr payable(net) / Cr recoveries.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists dairy_settlements (
  id text primary key,
  society_id text not null default 'SOC001',
  "settlementNo" text,
  "memberId" text,
  "memberName" text,
  "from" text,
  "to" text,
  gross numeric,
  "deductionLines" jsonb,
  "netPayable" numeric,
  "amountPaid" numeric default 0,
  status text,
  "voucherId" text,
  "approvedAt" timestamptz,
  "approvedBy" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.dairy_settlements enable row level security;
drop policy if exists "society_rw" on public.dairy_settlements;
create policy "society_rw" on public.dairy_settlements for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_dairy_settlements_society on public.dairy_settlements (society_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy cooperative (Delivery D4) — milk dispatch to the Union (revenue side).
-- Recording a dispatch posts Dr Union Receivable (3303) / Cr Milk Sales — Bulk
-- (4106); union payments received advance "amountReceived".
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists dairy_dispatches (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  shift text,
  "unionName" text,
  qty numeric,
  fat numeric,
  snf numeric,
  rate numeric,
  amount numeric,
  shortage numeric,
  "vehicleNo" text,
  remarks text,
  "voucherId" text,
  "amountReceived" numeric default 0,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.dairy_dispatches enable row level security;
drop policy if exists "society_rw" on public.dairy_dispatches;
create policy "society_rw" on public.dairy_dispatches for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_dairy_dispatches_society on public.dairy_dispatches (society_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy cooperative (Delivery D4b) — feed / medicine / AI issued to a member on
-- credit. Posts Dr Member Input Receivable (3305) / Cr income (e.g. 4103). The
-- member's outstanding is DERIVED (issues − settlement input-recoveries).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists dairy_input_issues (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  "memberId" text,
  "memberName" text,
  "inputType" text,
  "itemName" text,
  qty numeric,
  amount numeric,
  "incomeAccountId" text,
  "voucherId" text,
  remarks text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.dairy_input_issues enable row level security;
drop policy if exists "society_rw" on public.dairy_input_issues;
create policy "society_rw" on public.dairy_input_issues for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_dairy_input_issues_society on public.dairy_input_issues (society_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dairy cooperative (Delivery D6) — year-end patronage BONUS / DIVIDEND runs.
-- Governance-gated (resolutionNo mandatory at approval). Approval posts Dr
-- distribution equity / Cr payable (total); payments advance amountPaid. Per-member
-- breakdown stored in "lines".
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists dairy_distributions (
  id text primary key,
  society_id text not null default 'SOC001',
  kind text,
  "from" text,
  "to" text,
  "fyLabel" text,
  basis text,
  rate numeric,
  "resolutionNo" text,
  "resolutionDate" text,
  lines jsonb,
  total numeric,
  status text,
  "amountPaid" numeric default 0,
  "voucherId" text,
  "approvedAt" timestamptz,
  "approvedBy" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table public.dairy_distributions enable row level security;
drop policy if exists "society_rw" on public.dairy_distributions;
create policy "society_rw" on public.dairy_distributions for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
create index if not exists idx_dairy_distributions_society on public.dairy_distributions (society_id);

-- ── Consumer C2 — multi-tier pricing ─────────────────────────────────────────
-- Effective-dated TIER OVERRIDES (member/wholesale/promo) on top of the base retail
-- price, which stays on stock_items.saleRate (single source of truth). RLS bundled.
create table if not exists consumer_price_lists (
  id text primary key,
  society_id text not null default 'SOC001',
  "itemId" text,
  tier text,
  price numeric,
  "effectiveFrom" text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);
create index if not exists idx_consumer_price_lists_society on public.consumer_price_lists (society_id);
alter table public.consumer_price_lists enable row level security;
drop policy if exists "society_rw" on public.consumer_price_lists;
create policy "society_rw" on public.consumer_price_lists for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- Record the member on a retail-counter sale (member pricing + future patronage). Additive, nullable.
alter table sales add column if not exists "memberId" text;

-- ── Consumer C3 — member store credit ────────────────────────────────────────
-- Per-member credit limit (0/null = no cap; the POS warns, never blocks). The receivable
-- control account is created at runtime via addAccount (no table); recoveries are tagged
-- vouchers (refType 'consumer.member.recovery'); per-member outstanding is derived.
alter table members add column if not exists "creditLimit" numeric;

-- ECR-16 (member lifecycle): reason + date for the last lifecycle change (resigned/
-- expelled/deceased/reactivated). The `status` column is text, so the widened enum
-- ('resigned'|'expelled'|'deceased') needs no column change. Written via targeted
-- best-effort .update(), so the base member upsert stays safe before this runs.
alter table members add column if not exists "statusReason" text;
alter table members add column if not exists "statusChangedAt" text;

-- ECR-16 (multiple nominees): a member may nominate several nominees, each with a
-- benefit share (%). Rides the whole-member upsert like other member columns.
alter table members add column if not exists "nominees" jsonb default '[]';

-- ECR-16 (member KYC): Aadhaar / PAN (PII — displayed masked) + verification status.
alter table members add column if not exists "aadhaar" text;
alter table members add column if not exists "pan" text;
alter table members add column if not exists "kycStatus" text;

-- ECR-16 (share certificate lifecycle): issued → reissued (loss/damage) → cancelled.
alter table members add column if not exists "shareCertStatus" text;
alter table members add column if not exists "shareCertIssuedAt" text;
alter table members add column if not exists "shareCertReason" text;

-- ── Consumer C4 — patronage rebate ───────────────────────────────────────────
-- Year-end member rebate on purchases (draft → approved, resolution-gated). The
-- distribution/payable accounts are created at runtime via addAccount (no table). RLS bundled.
-- ("from"/"to" are quoted — reserved words.)
create table if not exists consumer_patronage_runs (
  id text primary key,
  society_id text not null default 'SOC001',
  "fyLabel" text,
  "from" text,
  "to" text,
  "ratePct" numeric,
  "resolutionNo" text,
  "resolutionDate" text,
  lines jsonb default '[]',
  total numeric,
  status text,
  "amountPaid" numeric default 0,
  "voucherId" text,
  "approvedAt" text,
  "approvedBy" text,
  "isDeleted" boolean default false,
  "createdAt" text
);
create index if not exists idx_consumer_patronage_runs_society on public.consumer_patronage_runs (society_id);
alter table public.consumer_patronage_runs enable row level security;
drop policy if exists "society_rw" on public.consumer_patronage_runs;
create policy "society_rw" on public.consumer_patronage_runs for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));
-- Consumer C7 — reuse the patronage runs table for share DIVIDEND too (kind discriminator).
alter table consumer_patronage_runs add column if not exists kind text;

-- Consumer C8 — batch / expiry on stock movements (esp. expiry/damage write-offs). Additive.
alter table stock_movements add column if not exists "batchNo" text;
alter table stock_movements add column if not exists "expiryDate" text;

-- ── Consumer C-PO — Purchase Order + GRN (approval-driven procurement) ────────
-- PO/GRN are tracking documents; goods receipt creates the real Purchase (invoice)
-- via addPurchase (existing sales/purchases tables). RLS bundled.
create table if not exists consumer_purchase_orders (
  id text primary key,
  society_id text not null default 'SOC001',
  "poNo" text,
  date text,
  "supplierId" text,
  "supplierName" text,
  "supplierPhone" text,
  "expectedDate" text,
  items jsonb default '[]',
  total numeric,
  status text,
  "approvedBy" text,
  "approvedAt" text,
  "resolutionNo" text,
  "receivedAt" text,
  "purchaseId" text,
  "purchaseNo" text,
  notes text,
  "isDeleted" boolean default false,
  "createdAt" text
);
create index if not exists idx_consumer_purchase_orders_society on public.consumer_purchase_orders (society_id);
alter table public.consumer_purchase_orders enable row level security;
drop policy if exists "society_rw" on public.consumer_purchase_orders;
create policy "society_rw" on public.consumer_purchase_orders for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── Consumer — Sales Return (credit note) ────────────────────────────────────
-- Reverses a posted sale (full/partial). Accounting is done via the core voucher
-- engine (Dr Sales Return + Dr GST 2201 / Cr refund a/c); this table is the source
-- document + register. Goods go back via a positive stock_movements adjustment.
create table if not exists sales_returns (
  id text primary key,
  society_id text not null default 'SOC001',
  "returnNo" text,
  date text,
  "originalSaleId" text,
  "saleNo" text,
  "customerName" text,
  "memberId" text,
  "customerId" text,
  items jsonb default '[]',
  "netAmount" numeric,
  "cgstAmount" numeric,
  "sgstAmount" numeric,
  "igstAmount" numeric,
  "taxAmount" numeric,
  "grandTotal" numeric,
  "refundMode" text,
  "bankAccountId" text,
  "voucherId" text,
  "isDeleted" boolean default false,
  "createdBy" text,
  "createdAt" text
);
create index if not exists idx_sales_returns_society on public.sales_returns (society_id);
alter table public.sales_returns enable row level security;
drop policy if exists "society_rw" on public.sales_returns;
create policy "society_rw" on public.sales_returns for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── Consumer — Purchase Return (debit note) ──────────────────────────────────
-- Reverses a posted purchase (full/partial). Accounting via the core voucher engine
-- (Cr Purchases per-item + Cr GST ITC 3310 / Dr supplier|cash|bank); this table is the
-- source document + register. Goods leave via a negative stock_movements adjustment.
create table if not exists purchase_returns (
  id text primary key,
  society_id text not null default 'SOC001',
  "returnNo" text,
  date text,
  "originalPurchaseId" text,
  "purchaseNo" text,
  "supplierName" text,
  "supplierId" text,
  items jsonb default '[]',
  "netAmount" numeric,
  "cgstAmount" numeric,
  "sgstAmount" numeric,
  "igstAmount" numeric,
  "taxAmount" numeric,
  "grandTotal" numeric,
  "refundMode" text,
  "bankAccountId" text,
  "voucherId" text,
  "isDeleted" boolean default false,
  "createdBy" text,
  "createdAt" text
);
create index if not exists idx_purchase_returns_society on public.purchase_returns (society_id);
alter table public.purchase_returns enable row level security;
drop policy if exists "society_rw" on public.purchase_returns;
create policy "society_rw" on public.purchase_returns for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── Feature 6 — Server-side document numbering: per-society UNIQUE guard ──────
-- The DB physically rejects a duplicate document number within a society, so two
-- devices (tills) can never persist the same SL/PUR/SRET/PRET/voucher number.
-- The client detects the 23505 violation, bumps to the next number, and retries.
-- ⚠️ These indexes fail to BUILD if existing data already has duplicates — run the
-- pre-check queries in the completion report FIRST and de-dupe if any are found.
-- (NULL numbers are treated as distinct by Postgres, so legacy null rows are fine.)
create unique index if not exists uniq_sales_society_no on public.sales (society_id, "saleNo");
create unique index if not exists uniq_purchases_society_no on public.purchases (society_id, "purchaseNo");
create unique index if not exists uniq_sales_returns_society_no on public.sales_returns (society_id, "returnNo");
create unique index if not exists uniq_purchase_returns_society_no on public.purchase_returns (society_id, "returnNo");
create unique index if not exists uniq_vouchers_society_no on public.vouchers (society_id, "voucherNo");

-- ── Bank Reconciliation — saved month-end sign-off (audit trail) ─────────────
-- A completed BRS snapshot: book balance + uncleared items vs entered statement
-- balance, who reconciled and when. Reprintable audit evidence. RLS bundled.
create table if not exists bank_reconciliations (
  id text primary key,
  society_id text not null default 'SOC001',
  "bankAccountId" text,
  "bankAccountName" text,
  "asOfDate" text,
  "statementBalance" numeric,
  "bookBalance" numeric,
  "unclearedDepositsTotal" numeric,
  "unclearedPaymentsTotal" numeric,
  "unclearedDepositIds" jsonb default '[]',
  "unclearedPaymentIds" jsonb default '[]',
  difference numeric,
  "isReconciled" boolean default false,
  "reconciledBy" text,
  "reconciledAt" text,
  "isDeleted" boolean default false
);
create index if not exists idx_bank_reconciliations_society on public.bank_reconciliations (society_id);
alter table public.bank_reconciliations enable row level security;
drop policy if exists "society_rw" on public.bank_reconciliations;
create policy "society_rw" on public.bank_reconciliations for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── TDS — persist manually-added deductions + challans (fixes RULE-1 data loss) ──
-- Auto-imported purchase TDS is derived (not stored here); these tables hold the
-- MANUAL entries (salary/rent/professional) + challan deposits the register adds.
create table if not exists tds_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  "deducteePan" text,
  "deducteeName" text,
  "deducteeType" text,
  section text,
  "natureOfPayment" text,
  "grossAmount" numeric,
  "tdsRate" numeric,
  "tdsAmount" numeric,
  "challanId" text,
  "voucherId" text,
  "purchaseId" text,
  quarter text,
  "financialYear" text,
  status text,
  "isDeleted" boolean default false,
  "createdAt" text
);
create index if not exists idx_tds_entries_society on public.tds_entries (society_id);
alter table public.tds_entries enable row level security;
drop policy if exists "society_rw" on public.tds_entries;
create policy "society_rw" on public.tds_entries for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

create table if not exists tds_challans (
  id text primary key,
  society_id text not null default 'SOC001',
  "bsrCode" text,
  "challanDate" text,
  "challanSerial" text,
  amount numeric,
  "bankName" text,
  quarter text,
  "financialYear" text,
  status text,
  "isDeleted" boolean default false,
  "createdAt" text
);
create index if not exists idx_tds_challans_society on public.tds_challans (society_id);
alter table public.tds_challans enable row level security;
drop policy if exists "society_rw" on public.tds_challans;
create policy "society_rw" on public.tds_challans for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── TDS — challan<->entry links (makes 26Q tie deductees to real challans) ────
-- Keyed by the stable entry id ('pur-<purchaseId>' for auto entries, uuid for
-- manual). Composite PK so the same entryId can exist per society. Resolved onto
-- entries at render — no change to the 26Q generator.
create table if not exists tds_challan_links (
  society_id text not null default 'SOC001',
  "entryId" text not null,
  "challanId" text,
  primary key (society_id, "entryId")
);
create index if not exists idx_tds_challan_links_society on public.tds_challan_links (society_id);
alter table public.tds_challan_links enable row level security;
drop policy if exists "society_rw" on public.tds_challan_links;
create policy "society_rw" on public.tds_challan_links for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- ── e-Way Bill — transporter details (additive; makes the NIC JSON portal-valid) ──
-- Consignee (to*) is re-resolved live from the customer/supplier master, so only
-- the manually-entered transporter fields need persisting on the saved bill.
alter table eway_bills add column if not exists "partyGst" text;
alter table eway_bills add column if not exists "transporterName" text;
alter table eway_bills add column if not exists "transporterGstin" text;
alter table eway_bills add column if not exists "transDocNo" text;
alter table eway_bills add column if not exists "transDocDate" text;

-- ── Payroll accrual — link a salary record to its accrual voucher (additive) ──
-- On processing, salary posts Dr Salary Expense 5201 / Cr Salary Payable 2103; payment
-- later clears the liability. This column tracks the accrual voucher for update/delete.
alter table salary_records add column if not exists "accrualVoucherId" text;

-- ══ Deposits module (Core for Credit/PACS) — SB / FD / RD / Pigmy ═════════════
-- A member deposit is a LIABILITY (society owes the member). Balances sit in COA
-- 2107 (Savings/Member Deposits) / 2108 (Fixed Deposits). Each cash movement also
-- posts a voucher; these tables are the deposit sub-ledger. RLS = app-layer (society_id).
create table if not exists deposit_accounts (
  id text primary key,
  society_id text not null default 'SOC001',
  "accountNo" text,
  "memberId" text,
  "depositType" text,
  "openDate" text,
  balance numeric default 0,
  "interestRate" numeric,
  "maturityDate" text,
  "installmentAmount" numeric,
  status text default 'active',
  "createdAt" timestamp default now()
);
create table if not exists deposit_transactions (
  id text primary key,
  society_id text not null default 'SOC001',
  "depositAccountId" text,
  date text,
  "txnType" text,
  amount numeric,
  mode text,
  "voucherId" text,
  "balanceAfter" numeric,
  "createdAt" timestamp default now()
);
create index if not exists deposit_txn_acct_idx on deposit_transactions (society_id, "depositAccountId", date);
alter table deposit_accounts enable row level security;
alter table deposit_transactions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='deposit_accounts' and policyname='allow_all') then
    create policy "allow_all" on deposit_accounts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='deposit_transactions' and policyname='allow_all') then
    create policy "allow_all" on deposit_transactions for all using (true) with check (true);
  end if;
end $$;

-- Deposits — Pigmy daily-collection agent (slice 5)
alter table deposit_accounts add column if not exists "agent" text;

-- ══ Payroll statutory engine (ECR-14) — PF / ESI / PT / TDS ═══════════════════
-- Salary slips carry the statutory breakdown (deductions still holds the total);
-- employees carry PF/ESI applicability + UAN / ESI numbers.
alter table salary_records add column if not exists "pfEmployee" numeric;
alter table salary_records add column if not exists "pfEmployer" numeric;
alter table salary_records add column if not exists "esiEmployee" numeric;
alter table salary_records add column if not exists "esiEmployer" numeric;
alter table salary_records add column if not exists "pt" numeric;
alter table salary_records add column if not exists "tds" numeric;
alter table employees add column if not exists "pfApplicable" boolean;
alter table employees add column if not exists "esiApplicable" boolean;
alter table employees add column if not exists "uan" text;
alter table employees add column if not exists "esiNo" text;

-- Payroll — employee PAN for Form 24Q (ECR-14 slice 4)
alter table employees add column if not exists "pan" text;

-- ══ Compliance calendar — filed tracking (ECR-13 slice 2) ═════════════════════
-- Marks a statutory calendar item (e.g. "tds-2024-04") as filed so it stops
-- showing as overdue/due. RLS = app-layer (society_id).
create table if not exists compliance_filings (
  id text primary key,
  society_id text not null default 'SOC001',
  "itemId" text,
  "filedAt" text,
  "filedBy" text,
  note text
);
create index if not exists compliance_filings_scope_idx on compliance_filings (society_id, "itemId");
alter table compliance_filings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='compliance_filings' and policyname='allow_all') then
    create policy "allow_all" on compliance_filings for all using (true) with check (true);
  end if;
end $$;

-- ECR-15 (asset acquisition auto-posting): links the capitalization voucher (Dr Fixed-Asset / Cr Cash-Bank).
alter table assets add column if not exists "acquisitionVoucherId" text;
-- P0-3 (L3): ids of the asset's depreciation + disposal vouchers, so deleteAsset cancels
-- exactly them (not a fragile narration-substring match that collides AST/0001 with AST/00010).
alter table assets add column if not exists "voucherIds" jsonb default '[]';

-- ECR-12 (two-factor auth): per-user TOTP enrolment. mfa_secret is the base32
-- authenticator seed; only set once the user confirms a code. Login is not yet
-- gated on MFA (later slice), so these default to off / null.
alter table society_users add column if not exists mfa_enabled boolean default false;
alter table society_users add column if not exists mfa_secret text;
alter table society_users add column if not exists mfa_enrolled_at timestamptz;

-- ── ECR-12 slice 3: server-side TOTP verification + secret lockdown ───────────
-- The authenticator secret must NEVER reach the client. It lives in user_mfa
-- (RLS on, no policies/grants → not readable or writable by anon/authenticated),
-- and every verification runs server-side via SECURITY DEFINER functions.
-- (society_users.mfa_secret from slice 1 is now deprecated/unused — safe to keep
--  empty; you may DROP it once no legacy secrets remain.)
create extension if not exists pgcrypto with schema extensions;

create table if not exists user_mfa (
  email       text primary key,
  secret      text not null,
  enrolled_at timestamptz default now()
);
alter table user_mfa enable row level security;   -- no policies → clients blocked
revoke all on user_mfa from anon, authenticated;

-- RFC 4648 base32 decode → bytea.
create or replace function base32_decode(p_in text)
returns bytea language plpgsql immutable as $fn$
declare
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s text := upper(regexp_replace(coalesce(p_in, ''), '[^A-Za-z2-7]', '', 'g'));
  bits int := 0;
  val  int := 0;
  idx  int;
  out  bytea := ''::bytea;
  i    int;
begin
  for i in 1..length(s) loop
    idx := position(substr(s, i, 1) in alphabet) - 1;
    if idx < 0 then continue; end if;
    val := (val << 5) | idx;
    bits := bits + 5;
    if bits >= 8 then
      bits := bits - 8;
      out := out || set_byte('\x00'::bytea, 0, (val >> bits) & 255);
      val := val & ((1 << bits) - 1);
    end if;
  end loop;
  return out;
end;
$fn$;

-- RFC 6238 TOTP match with ±window skew. p_at = unix seconds.
create or replace function app_totp_matches(p_secret text, p_code text, p_at bigint, p_window int default 1)
returns boolean language plpgsql
set search_path = public, extensions as $fn$
declare
  key     bytea;
  counter bigint;
  c       bigint;
  w       int;
  msg     bytea;
  hs      bytea;
  offs    int;
  bin     bigint;
  expected text;
begin
  if p_secret is null or p_code !~ '^\d{6}$' then
    return false;
  end if;
  key := base32_decode(p_secret);
  counter := floor(p_at / 30);
  for w in -p_window..p_window loop
    c := counter + w;
    if c < 0 then continue; end if;
    msg := '\x0000000000000000'::bytea;
    msg := set_byte(msg, 0, ((c >> 56) & 255)::int);
    msg := set_byte(msg, 1, ((c >> 48) & 255)::int);
    msg := set_byte(msg, 2, ((c >> 40) & 255)::int);
    msg := set_byte(msg, 3, ((c >> 32) & 255)::int);
    msg := set_byte(msg, 4, ((c >> 24) & 255)::int);
    msg := set_byte(msg, 5, ((c >> 16) & 255)::int);
    msg := set_byte(msg, 6, ((c >>  8) & 255)::int);
    msg := set_byte(msg, 7, ( c        & 255)::int);
    hs := hmac(msg, key, 'sha1');
    offs := get_byte(hs, length(hs) - 1) & 15;
    bin := ((get_byte(hs, offs)     & 127)::bigint << 24)
         | ((get_byte(hs, offs + 1) & 255)::bigint << 16)
         | ((get_byte(hs, offs + 2) & 255)::bigint <<  8)
         |  (get_byte(hs, offs + 3) & 255)::bigint;
    expected := lpad((bin % 1000000)::text, 6, '0');
    if expected = p_code then
      return true;
    end if;
  end loop;
  return false;
end;
$fn$;

-- Enrol: verify the first code against the given secret, then store it (locked
-- table) and flip the flag. Client never writes the secret directly.
create or replace function app_mfa_enroll(p_email text, p_secret text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
begin
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (p_email, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update society_users set mfa_enabled = true where email = p_email;
  return true;
end;
$fn$;

-- Login: verify a code against the stored secret (secret stays server-side).
create or replace function app_verify_mfa(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare sec text;
begin
  select m.secret into sec
    from user_mfa m join society_users u on u.email = m.email
   where m.email = p_email and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if sec is null then return false; end if;
  return app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
end;
$fn$;

-- Disable: verify a current code, then remove the secret and clear the flag.
create or replace function app_mfa_disable(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare sec text;
begin
  select secret into sec from user_mfa where email = p_email limit 1;
  if sec is null then return false; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  delete from user_mfa where email = p_email;
  update society_users set mfa_enabled = false where email = p_email;
  return true;
end;
$fn$;

-- Admin reset: an active admin clears a locked-out member's 2FA (lost device).
-- The target must belong to the SAME society as the admin. No code needed — the
-- user then logs in without 2FA and can re-enrol.
create or replace function app_mfa_admin_reset(p_admin_email text, p_target_email text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare allowed boolean;
begin
  select exists(
    select 1
      from society_users a
      join society_users t on t.society_id = a.society_id
     where a.email = p_admin_email and a.role = 'admin' and a.is_active = true
       and t.email = p_target_email
  ) into allowed;
  if not allowed then return false; end if;
  delete from user_mfa where email = p_target_email;
  update society_users set mfa_enabled = false where email = p_target_email;
  return true;
end;
$fn$;

-- ── ECR-12 deferred B: one-time backup / recovery codes ──────────────────────
-- Only sha256 hashes are stored (locked table); each code works once. Lets a
-- user log in if they lose their authenticator, without an admin reset.
create table if not exists user_mfa_recovery (
  id        bigint generated always as identity primary key,
  email     text not null,
  code_hash text not null,
  used_at   timestamptz
);
alter table user_mfa_recovery enable row level security;   -- no policies → blocked
revoke all on user_mfa_recovery from anon, authenticated;
create index if not exists idx_user_mfa_recovery_email on user_mfa_recovery(email);

-- Generate a fresh set of 8 codes (after verifying a current TOTP). Returns the
-- plaintext codes ONCE; only their hashes are stored. Replaces any prior set.
create or replace function app_mfa_gen_recovery(p_email text, p_code text)
returns text[] language plpgsql security definer
set search_path = public, extensions as $fn$
declare sec text; codes text[] := '{}'; c text; i int;
begin
  select m.secret into sec from user_mfa m join society_users u on u.email = m.email
    where m.email = p_email and u.is_active = true and u.mfa_enabled = true limit 1;
  if sec is null then return null; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return null;
  end if;
  delete from user_mfa_recovery where email = p_email;
  for i in 1..8 loop
    c := substr(encode(gen_random_bytes(8), 'hex'), 1, 10);   -- 10 lowercase hex chars
    codes := array_append(codes, c);
    insert into user_mfa_recovery (email, code_hash)
      values (p_email, encode(digest(c, 'sha256'), 'hex'));
  end loop;
  return codes;
end;
$fn$;

-- Verify + consume a recovery code at login (one-time). Separators/case ignored.
create or replace function app_verify_recovery(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare norm text; h text; rid bigint;
begin
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
    join society_users u on u.email = r.email
   where r.email = p_email and r.used_at is null and r.code_hash = h
     and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  return true;
end;
$fn$;

grant execute on function app_mfa_enroll(text, text, text)  to anon, authenticated;
grant execute on function app_verify_mfa(text, text)        to anon, authenticated;
grant execute on function app_mfa_disable(text, text)       to anon, authenticated;
grant execute on function app_mfa_admin_reset(text, text)   to anon, authenticated;
grant execute on function app_mfa_gen_recovery(text, text)  to anon, authenticated;
grant execute on function app_verify_recovery(text, text)   to anon, authenticated;

-- RFC 6238 SELF-TEST — run this once after creating the functions. Expected:
-- t59 = t1234567890 = t1111111111 = true, and wrong = false.
--   select
--     app_totp_matches('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','287082',59,0)         as t59,
--     app_totp_matches('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','005924',1234567890,0) as t1234567890,
--     app_totp_matches('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','050471',1111111111,0) as t1111111111,
--     app_totp_matches('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','000000',59,0)         as wrong;

-- ── ECR-17 multi-branch (Phase 1) ────────────────────────────────────────────
-- Branch master (each society has one Head Office). Vouchers carry a branchId;
-- reports view per-branch or consolidated. Unbranched legacy vouchers → Head Office.
create table if not exists branches (
  id text primary key,
  society_id text,
  name text not null,
  code text,
  "isHeadOffice" boolean default false,
  address text,
  "isActive" boolean default true,
  "createdAt" timestamptz default now()
);
alter table branches enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='branches' and policyname='allow_all_branches') then
    create policy "allow_all_branches" on branches for all using (true) with check (true);
  end if;
end $$;

-- Voucher branch dimension (overlay column — patched in step-2, base save never fails).
alter table vouchers add column if not exists "branchId" text;

-- ── ECR-17 Phase 3: godown-wise stock ────────────────────────────────────────
create table if not exists godowns (
  id text primary key,
  society_id text,
  name text not null,
  code text,
  "branchId" text,
  address text,
  "capacityMT" numeric,
  "isActive" boolean default true,
  "createdAt" timestamptz default now()
);
alter table godowns enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='godowns' and policyname='allow_all_godowns') then
    create policy "allow_all_godowns" on godowns for all using (true) with check (true);
  end if;
end $$;

-- Stock movements carry the godown (overlay — patched in step-2, base save never fails).
alter table stock_movements add column if not exists "godownId" text;

-- ── ECR-17 Phase 4: branch scope on sales / purchases / members ───────────────
-- Overlay columns — stamped from the active branch and patched in step-2, so the
-- base upsert never fails before this migration runs (RULE 1).
alter table sales     add column if not exists "branchId" text;
alter table purchases add column if not exists "branchId" text;
alter table members   add column if not exists "branchId" text;

-- ── ECR-17 Phase 4b: RBAC branch-restriction ─────────────────────────────────
-- A user with branch_id set is restricted to that branch (sees/enters only its
-- data); NULL = society-wide (admin / consolidated). Assigned in User Management.
alter table society_users add column if not exists branch_id text;

-- ── ECR-21 Phase 3: goods-receipt variance approval ───────────────────────────
-- Stamped only when a receipt is posted despite a 3-way match exception.
alter table consumer_purchase_orders add column if not exists "varianceStatus" text;
alter table consumer_purchase_orders add column if not exists "varianceReason" text;
alter table consumer_purchase_orders add column if not exists "varianceApprovedBy" text;

-- ── T-12: three tables the app has always used, with no DDL in this repo ─────────────
-- DataContext.tsx loads and upserts `recoverables`, `kachi_aarat_entries` and
-- `p7_entries`, but their schema lived nowhere. Wherever they exist today they were
-- created by hand. Columns below are derived from src/types/index.ts (Recoverable,
-- KachiAaratEntry, P7Entry) plus `withSoc` (which stamps society_id on every upsert).
--
-- NOTE ON DELETION: all three are HARD-deleted by DataContext (`.delete()`), even though
-- Recoverable and KachiAaratEntry carry an `isDeleted` field. The column is created for
-- row fidelity, but the export registry does NOT declare a softDeleteField for them —
-- claiming soft-delete where the code hard-deletes would be a lie. See RULE 5.

create table if not exists recoverables (
  id text primary key,
  society_id text not null default 'SOC001',
  "partyName" text,
  category text,
  "legalStage" text,
  "openingBalance" numeric default 0,
  additions numeric default 0,
  recoveries numeric default 0,
  "fyStartDate" text,
  narration text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table recoverables enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='recoverables' and policyname='allow_all') then
    create policy "allow_all" on recoverables for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_recoverables_society on recoverables(society_id);

create table if not exists kachi_aarat_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  date text,
  "fyStartDate" text,
  crop text,
  "partyName" text,
  "businessValue" numeric default 0,
  "damiEarned" numeric default 0,
  narration text,
  "isDeleted" boolean default false,
  "createdAt" timestamptz default now()
);
alter table kachi_aarat_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='kachi_aarat_entries' and policyname='allow_all') then
    create policy "allow_all" on kachi_aarat_entries for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_kachi_aarat_entries_society on kachi_aarat_entries(society_id);

create table if not exists p7_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  "fyStartDate" text,
  "rentedGodownCount" numeric default 0,
  "rentedCapacityMT" numeric default 0,
  "godownRentPaid" numeric default 0,
  "truckCount" numeric default 0,
  "transportChargesPaid" numeric default 0,
  "sugarCattleFeedSales" numeric default 0,
  "consumerProductSales" numeric default 0,
  narration text,
  "createdAt" timestamptz default now()
);
alter table p7_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='p7_entries' and policyname='allow_all') then
    create policy "allow_all" on p7_entries for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_p7_entries_society on p7_entries(society_id);

-- ── T-01 (ADR-0009 / Canonical CL-5, gap IRR-4): the jurisdiction key ────────────────
-- Every financial row must carry (society_id, jurisdiction). society_id already exists (the
-- tenant); jurisdiction is the residency / consolidation scope, resolved from the society's
-- `state` by resolveJurisdiction() in src/lib/jurisdiction.ts — the SINGLE source of truth,
-- deliberately NOT reimplemented in SQL, which is why the column is not value-backfilled
-- here (an app routine that runs the same resolver backfills existing rows in the follow-on).
--
-- REQUIRED MIGRATION — run this in the Supabase SQL Editor. Purely additive (nullable), so
-- nothing breaks before it runs. Per RULE 1, the app does NOT yet write this column — the
-- write-path stamping ships only AFTER this migration is applied — so no upsert can fail on
-- a missing column in the meantime. This block covers the canonical financial spine; the
-- remaining domain tables (housing / dairy / marketing / consumer / procurement / deposits)
-- get the column in the same additive way when their write paths are wired.
alter table accounts         add column if not exists jurisdiction text;
alter table vouchers         add column if not exists jurisdiction text;
alter table voucher_entries  add column if not exists jurisdiction text;
alter table members          add column if not exists jurisdiction text;
alter table loans            add column if not exists jurisdiction text;
alter table kcc_loans        add column if not exists jurisdiction text;
alter table assets           add column if not exists jurisdiction text;
alter table stock_items      add column if not exists jurisdiction text;
alter table stock_movements  add column if not exists jurisdiction text;
alter table sales            add column if not exists jurisdiction text;
alter table purchases        add column if not exists jurisdiction text;
alter table employees        add column if not exists jurisdiction text;
alter table salary_records   add column if not exists jurisdiction text;
alter table suppliers        add column if not exists jurisdiction text;
alter table customers        add column if not exists jurisdiction text;
alter table audit_objections add column if not exists jurisdiction text;
alter table budgets          add column if not exists jurisdiction text;
create index if not exists vouchers_jurisdiction_idx        on vouchers (society_id, jurisdiction);
create index if not exists voucher_entries_jurisdiction_idx on voucher_entries (society_id, jurisdiction);
create index if not exists members_jurisdiction_idx         on members (society_id, jurisdiction);

-- T-01 (continued — write-path stamping): the app stamps (society_id, jurisdiction) on every
-- write through ONE chokepoint (withSoc → stampTenant), which writes to EVERY tenant-scoped
-- table. So every table that has `society_id` must also have `jurisdiction`, or those upserts
-- would fail on a missing column (RULE 1). This dynamic block adds it to all of them at once,
-- idempotently — a superset of the explicit list above, and self-maintaining as tables are
-- added. REQUIRED before the withSoc change goes live.
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'society_id'
  loop
    execute format('alter table public.%I add column if not exists jurisdiction text', r.table_name);
  end loop;
end $$;

-- ── T-03 (ADR-0005 / CA-03): server-authoritative gapless document numbering ─────────
-- Statutory audit requires GAPLESS, non-duplicated numbers. Client-side numbering from
-- in-memory/localStorage state gaps and collides across devices. The database issues the
-- next number for a (society, book, financial-year) ATOMICALLY, so two concurrent tills can
-- never mint the same number or leave a gap. The client calls next_document_number() and
-- formats the result (src/lib/documentNumber.ts). Additive + idempotent; the RPC is unused
-- until the save-path cutover (which assigns the number at durable append — pairs with T-06),
-- so running this now changes nothing.
create table if not exists document_sequences (
  society_id  text not null,
  book        text not null,          -- register/voucher-type key, e.g. 'receipt','payment','journal'
  fy          text not null,          -- financial year, e.g. '2025-26'
  last_number bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (society_id, book, fy)
);
alter table document_sequences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='document_sequences' and policyname='allow_all') then
    create policy "allow_all" on document_sequences for all using (true) with check (true);
  end if;
end $$;

-- Atomic issue: increment and return the next number in ONE statement. `on conflict do
-- update ... returning` takes the row lock and returns the post-increment value, so
-- concurrent callers get consecutive numbers (1,2,3…) — never a duplicate, never a gap.
create or replace function next_document_number(p_society_id text, p_book text, p_fy text)
returns bigint
language sql
as $$
  insert into document_sequences (society_id, book, fy, last_number, updated_at)
  values (p_society_id, p_book, p_fy, 1, now())
  on conflict (society_id, book, fy)
  do update set last_number = document_sequences.last_number + 1, updated_at = now()
  returning last_number;
$$;

-- ── T-10 (ADR-0003, gap BA-1): the Activities layer ──────────────────────────────────
-- A society declares MANY business activities (a Multipurpose PACS runs credit + dairy + a
-- fair-price shop at once). Each row is one declared activity; the catalog of what can be
-- declared, and the activity→capability map, live in code (src/lib/navigation/activities.ts,
-- activityCapabilities.ts). The resolver (T-11) unions these into capabilities WITHIN
-- entitlement. Additive + dormant: nothing reads or writes this table until T-11/T-12, so
-- running this migration changes nothing. `jurisdiction` mirrors T-01; `config` is edge
-- config (rate-chart refs etc.), the one legitimate JSONB per the Canonical Model.
create table if not exists society_activities (
  id           text primary key,
  society_id   text not null default 'SOC001',
  jurisdiction text,
  activity     text not null,                     -- Activity code (see activities.ts)
  status       text not null default 'active',    -- active | paused | retired
  enabled_at   timestamptz not null default now(),
  disabled_at  timestamptz,
  config       jsonb default '{}',
  "isDeleted"  boolean default false,
  unique (society_id, activity)
);
alter table society_activities enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='society_activities' and policyname='allow_all') then
    create policy "allow_all" on society_activities for all using (true) with check (true);
  end if;
end $$;
create index if not exists idx_society_activities_society on society_activities(society_id);

-- ── T-06 (ADR-0001 / INV-1): the append-only EVENT JOURNAL — the system of record ────
-- Financial truth is an append-only stream of immutable events; balances/registers/reports
-- are PROJECTIONS derived by replay (src/lib/ledger/*). A correction is a NEW reversing event
-- (reversal_of), never a mutation or a delete — which retires the RULE 1 divergence class.
-- WORM like audit_log: INSERT + SELECT only, no UPDATE/DELETE. Additive + DORMANT — nothing
-- writes or reads it until the dual-write cutover (T-06 live / T-09), so this changes nothing.
create table if not exists ledger_events (
  event_id       text primary key,
  event_type     text not null,                      -- past-tense fact, e.g. 'voucher.posted'
  schema_version int  not null default 1,
  society_id     text not null default 'SOC001',     -- tenant
  jurisdiction   text,
  aggregate_type text not null,                       -- 'voucher' | 'member' | ...
  aggregate_id   text not null,
  sequence       bigint not null,                     -- per-(tenant, aggregate) ordering, 1-based
  occurred_at    timestamptz not null default now(),
  producer_kind  text not null default 'human',       -- human | agent | import | integration (AI-A)
  producer_id    text,
  on_behalf_of   text,
  reversal_of    text,                                -- event_id this reverses (CL-2)
  payload        jsonb not null,
  created_at     timestamptz not null default now()
);
-- Gapless per-aggregate ordering: no two events share a (tenant, aggregate, sequence).
create unique index if not exists ledger_events_aggregate_seq
  on ledger_events (society_id, aggregate_type, aggregate_id, sequence);
create index if not exists ledger_events_scope
  on ledger_events (society_id, aggregate_type, aggregate_id, sequence);
alter table ledger_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ledger_events' and policyname='ledger_events_insert') then
    create policy "ledger_events_insert" on ledger_events for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ledger_events' and policyname='ledger_events_select') then
    create policy "ledger_events_select" on ledger_events for select using (true);
  end if;
  -- Intentionally NO update/delete policy ⇒ ledger_events is WORM (append-only, CL-2).
end $$;
