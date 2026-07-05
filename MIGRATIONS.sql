-- ============================================================================
-- SahakarLekha — consolidated migration script (2026 feature run)
-- ============================================================================
-- Every schema change added across the GST / returns / bank-reconciliation / TDS /
-- e-Way / payroll-accrual / document-numbering work, in one ordered, IDEMPOTENT
-- script. Safe to run OR re-run — every statement is `if not exists` / additive, so
-- re-running an already-applied migration is a harmless no-op.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and Run.
-- If you have already applied some of these piecemeal, running this still succeeds
-- (no-ops the applied ones). The only part that can fail is the UNIQUE indexes in
-- Section 2 — and only if pre-existing duplicate document numbers exist; Section 2
-- de-dupes first, inside a transaction, so it is self-correcting.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Additive tables & columns (idempotent; order-independent)
-- ─────────────────────────────────────────────────────────────────────────────

-- Consumer — Sales Return (credit note)
create table if not exists sales_returns (
  id text primary key,
  society_id text not null default 'SOC001',
  "returnNo" text, date text,
  "originalSaleId" text, "saleNo" text,
  "customerName" text, "memberId" text, "customerId" text,
  items jsonb default '[]',
  "netAmount" numeric, "cgstAmount" numeric, "sgstAmount" numeric,
  "igstAmount" numeric, "taxAmount" numeric, "grandTotal" numeric,
  "refundMode" text, "bankAccountId" text, "voucherId" text,
  "isDeleted" boolean default false, "createdBy" text, "createdAt" text
);
create index if not exists idx_sales_returns_society on public.sales_returns (society_id);
alter table public.sales_returns enable row level security;
drop policy if exists "society_rw" on public.sales_returns;
create policy "society_rw" on public.sales_returns for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- Consumer — Purchase Return (debit note)
create table if not exists purchase_returns (
  id text primary key,
  society_id text not null default 'SOC001',
  "returnNo" text, date text,
  "originalPurchaseId" text, "purchaseNo" text,
  "supplierName" text, "supplierId" text,
  items jsonb default '[]',
  "netAmount" numeric, "cgstAmount" numeric, "sgstAmount" numeric,
  "igstAmount" numeric, "taxAmount" numeric, "grandTotal" numeric,
  "refundMode" text, "bankAccountId" text, "voucherId" text,
  "isDeleted" boolean default false, "createdBy" text, "createdAt" text
);
create index if not exists idx_purchase_returns_society on public.purchase_returns (society_id);
alter table public.purchase_returns enable row level security;
drop policy if exists "society_rw" on public.purchase_returns;
create policy "society_rw" on public.purchase_returns for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- Bank Reconciliation — saved month-end sign-off
create table if not exists bank_reconciliations (
  id text primary key,
  society_id text not null default 'SOC001',
  "bankAccountId" text, "bankAccountName" text, "asOfDate" text,
  "statementBalance" numeric, "bookBalance" numeric,
  "unclearedDepositsTotal" numeric, "unclearedPaymentsTotal" numeric,
  "unclearedDepositIds" jsonb default '[]', "unclearedPaymentIds" jsonb default '[]',
  difference numeric, "isReconciled" boolean default false,
  "reconciledBy" text, "reconciledAt" text, "isDeleted" boolean default false
);
create index if not exists idx_bank_reconciliations_society on public.bank_reconciliations (society_id);
alter table public.bank_reconciliations enable row level security;
drop policy if exists "society_rw" on public.bank_reconciliations;
create policy "society_rw" on public.bank_reconciliations for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- TDS — persist manual entries
create table if not exists tds_entries (
  id text primary key,
  society_id text not null default 'SOC001',
  date text, "deducteePan" text, "deducteeName" text, "deducteeType" text,
  section text, "natureOfPayment" text, "grossAmount" numeric, "tdsRate" numeric,
  "tdsAmount" numeric, "challanId" text, "voucherId" text, "purchaseId" text,
  quarter text, "financialYear" text, status text, "isDeleted" boolean default false, "createdAt" text
);
create index if not exists idx_tds_entries_society on public.tds_entries (society_id);
alter table public.tds_entries enable row level security;
drop policy if exists "society_rw" on public.tds_entries;
create policy "society_rw" on public.tds_entries for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- TDS — persist challans
create table if not exists tds_challans (
  id text primary key,
  society_id text not null default 'SOC001',
  "bsrCode" text, "challanDate" text, "challanSerial" text, amount numeric,
  "bankName" text, quarter text, "financialYear" text, status text,
  "isDeleted" boolean default false, "createdAt" text
);
create index if not exists idx_tds_challans_society on public.tds_challans (society_id);
alter table public.tds_challans enable row level security;
drop policy if exists "society_rw" on public.tds_challans;
create policy "society_rw" on public.tds_challans for all to authenticated
  using (society_id::text in (select public.current_user_society_ids()))
  with check (society_id::text in (select public.current_user_society_ids()));

-- TDS — challan<->entry links (for accurate 26Q)
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

-- e-Way Bill — transporter columns (portal-valid JSON)
alter table eway_bills add column if not exists "partyGst" text;
alter table eway_bills add column if not exists "transporterName" text;
alter table eway_bills add column if not exists "transporterGstin" text;
alter table eway_bills add column if not exists "transDocNo" text;
alter table eway_bills add column if not exists "transDocDate" text;

-- Payroll — accrual voucher link
alter table salary_records add column if not exists "accrualVoucherId" text;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Document-number UNIQUE guards (de-dupe first, then build)
-- ─────────────────────────────────────────────────────────────────────────────
-- These indexes make duplicate document numbers physically impossible per society.
-- They FAIL to build if pre-existing duplicates exist, so the de-dupe below runs
-- first (a no-op if your data is already clean) — renumbering any duplicate to the
-- next free number in its own PREFIX/FY series. All wrapped in ONE transaction, so
-- a failure rolls back cleanly with zero changes. (If you already built these
-- indexes earlier this session, this whole section is a no-op.)

begin;

-- VOUCHERS
with r as (select id, society_id, regexp_replace("voucherNo",'/[0-9]+$','') head,
       (regexp_match("voucherNo",'/([0-9]+)$'))[1]::int seq,
       row_number() over (partition by society_id,"voucherNo" order by id) rn
     from vouchers where "voucherNo" ~ '/[0-9]+$'),
mx as (select society_id, head, max(seq) m from r group by society_id, head),
nn as (select r.id, r.head, (mx.m + row_number() over (partition by r.society_id, r.head order by r.seq, r.id)) ns
       from r join mx on mx.society_id=r.society_id and mx.head=r.head where r.rn>1)
update vouchers v set "voucherNo"=nn.head||'/'||lpad(nn.ns::text, greatest(3,length(nn.ns::text)), '0') from nn where v.id=nn.id;

-- SALES
with r as (select id, society_id, regexp_replace("saleNo",'/[0-9]+$','') head,
       (regexp_match("saleNo",'/([0-9]+)$'))[1]::int seq,
       row_number() over (partition by society_id,"saleNo" order by id) rn
     from sales where "saleNo" ~ '/[0-9]+$'),
mx as (select society_id, head, max(seq) m from r group by society_id, head),
nn as (select r.id, r.head, (mx.m + row_number() over (partition by r.society_id, r.head order by r.seq, r.id)) ns
       from r join mx on mx.society_id=r.society_id and mx.head=r.head where r.rn>1)
update sales v set "saleNo"=nn.head||'/'||lpad(nn.ns::text, greatest(3,length(nn.ns::text)), '0') from nn where v.id=nn.id;

-- PURCHASES
with r as (select id, society_id, regexp_replace("purchaseNo",'/[0-9]+$','') head,
       (regexp_match("purchaseNo",'/([0-9]+)$'))[1]::int seq,
       row_number() over (partition by society_id,"purchaseNo" order by id) rn
     from purchases where "purchaseNo" ~ '/[0-9]+$'),
mx as (select society_id, head, max(seq) m from r group by society_id, head),
nn as (select r.id, r.head, (mx.m + row_number() over (partition by r.society_id, r.head order by r.seq, r.id)) ns
       from r join mx on mx.society_id=r.society_id and mx.head=r.head where r.rn>1)
update purchases v set "purchaseNo"=nn.head||'/'||lpad(nn.ns::text, greatest(3,length(nn.ns::text)), '0') from nn where v.id=nn.id;

-- SALES_RETURNS
with r as (select id, society_id, regexp_replace("returnNo",'/[0-9]+$','') head,
       (regexp_match("returnNo",'/([0-9]+)$'))[1]::int seq,
       row_number() over (partition by society_id,"returnNo" order by id) rn
     from sales_returns where "returnNo" ~ '/[0-9]+$'),
mx as (select society_id, head, max(seq) m from r group by society_id, head),
nn as (select r.id, r.head, (mx.m + row_number() over (partition by r.society_id, r.head order by r.seq, r.id)) ns
       from r join mx on mx.society_id=r.society_id and mx.head=r.head where r.rn>1)
update sales_returns v set "returnNo"=nn.head||'/'||lpad(nn.ns::text, greatest(3,length(nn.ns::text)), '0') from nn where v.id=nn.id;

-- PURCHASE_RETURNS
with r as (select id, society_id, regexp_replace("returnNo",'/[0-9]+$','') head,
       (regexp_match("returnNo",'/([0-9]+)$'))[1]::int seq,
       row_number() over (partition by society_id,"returnNo" order by id) rn
     from purchase_returns where "returnNo" ~ '/[0-9]+$'),
mx as (select society_id, head, max(seq) m from r group by society_id, head),
nn as (select r.id, r.head, (mx.m + row_number() over (partition by r.society_id, r.head order by r.seq, r.id)) ns
       from r join mx on mx.society_id=r.society_id and mx.head=r.head where r.rn>1)
update purchase_returns v set "returnNo"=nn.head||'/'||lpad(nn.ns::text, greatest(3,length(nn.ns::text)), '0') from nn where v.id=nn.id;

create unique index if not exists uniq_vouchers_society_no         on public.vouchers        (society_id, "voucherNo");
create unique index if not exists uniq_sales_society_no            on public.sales           (society_id, "saleNo");
create unique index if not exists uniq_purchases_society_no        on public.purchases       (society_id, "purchaseNo");
create unique index if not exists uniq_sales_returns_society_no    on public.sales_returns   (society_id, "returnNo");
create unique index if not exists uniq_purchase_returns_society_no on public.purchase_returns (society_id, "returnNo");

commit;

-- Done. Verify (optional): should return 5 rows.
--   select indexname from pg_indexes where indexname like 'uniq_%_society_no';
