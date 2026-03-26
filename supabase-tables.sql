-- =============================================
-- Sahakarlekha - Supabase Database Tables
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Society Settings
create table if not exists society_settings (
  id text primary key default 'main',
  name text, name_hi text, registration_no text,
  financial_year text, financial_year_start text,
  address text, district text, state text,
  pin_code text, phone text, email text,
  previous_financial_year text,
  previous_year_balances jsonb default '{}'
);

-- 2. Accounts (Ledger Heads)
create table if not exists accounts (
  id text primary key,
  name text not null, name_hi text,
  type text not null,
  opening_balance numeric default 0,
  opening_balance_type text default 'debit',
  is_system boolean default false,
  is_active boolean default true
);

-- 3. Members
create table if not exists members (
  id text primary key,
  member_no text, name text, name_hi text,
  phone text, address text, village text,
  share_amount numeric default 0,
  loan_amount numeric default 0,
  join_date text, is_active boolean default true,
  created_at timestamp default now()
);

-- 4. Vouchers
create table if not exists vouchers (
  id text primary key,
  voucher_no text, date text, type text,
  debit_account_id text, credit_account_id text,
  amount numeric default 0, narration text,
  member_id text,
  is_deleted boolean default false,
  deleted_at text, deleted_by text, deleted_reason text,
  created_at timestamp default now(),
  created_by text
);

-- 5. Loans
create table if not exists loans (
  id text primary key,
  loan_no text, member_id text, member_name text,
  loan_type text, principal_amount numeric,
  interest_rate numeric, tenure_months integer,
  disbursement_date text, status text,
  repaid_amount numeric default 0,
  created_at timestamp default now()
);

-- 6. Assets
create table if not exists assets (
  id text primary key,
  asset_no text, name text, name_hi text,
  category text, purchase_date text,
  purchase_value numeric, current_value numeric,
  depreciation_rate numeric, location text,
  is_active boolean default true
);

-- 7. Audit Objections
create table if not exists audit_objections (
  id text primary key,
  objection_no text, audit_year text,
  objection_date text, auditor_name text,
  description text, amount numeric,
  status text, reply text, reply_date text,
  created_at timestamp default now()
);

-- 8. Stock Items
create table if not exists stock_items (
  id text primary key,
  item_code text, name text, name_hi text,
  unit text, opening_stock numeric default 0,
  current_stock numeric default 0,
  purchase_rate numeric default 0,
  sale_rate numeric default 0,
  is_active boolean default true
);

-- 9. Stock Movements
create table if not exists stock_movements (
  id text primary key,
  item_id text, type text,
  quantity numeric, rate numeric,
  reference_id text, narration text,
  created_at timestamp default now(),
  created_by text
);

-- 10. Sales
create table if not exists sales (
  id text primary key,
  sale_no text, date text,
  customer_name text, customer_phone text,
  items jsonb default '[]',
  total_amount numeric, discount numeric default 0,
  net_amount numeric, payment_mode text,
  voucher_id text, narration text,
  created_at timestamp default now(),
  created_by text
);

-- 11. Purchases
create table if not exists purchases (
  id text primary key,
  purchase_no text, date text,
  supplier_name text, supplier_phone text,
  items jsonb default '[]',
  total_amount numeric, discount numeric default 0,
  net_amount numeric, payment_mode text,
  voucher_id text, narration text,
  created_at timestamp default now(),
  created_by text
);

-- 12. Employees
create table if not exists employees (
  id text primary key,
  emp_no text, name text, name_hi text,
  designation text, join_date text,
  basic_salary numeric, phone text,
  bank_account text, status text
);

-- 13. Salary Records
create table if not exists salary_records (
  id text primary key,
  slip_no text, employee_id text,
  month text, basic_salary numeric,
  allowances numeric default 0,
  deductions numeric default 0,
  net_salary numeric, payment_mode text,
  voucher_id text, is_paid boolean default false,
  paid_date text, created_at timestamp default now()
);

-- Enable Row Level Security (allow all for now — add auth later)
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

-- Allow all operations (public access for now)
create policy "Allow all" on society_settings for all using (true) with check (true);
create policy "Allow all" on accounts for all using (true) with check (true);
create policy "Allow all" on members for all using (true) with check (true);
create policy "Allow all" on vouchers for all using (true) with check (true);
create policy "Allow all" on loans for all using (true) with check (true);
create policy "Allow all" on assets for all using (true) with check (true);
create policy "Allow all" on audit_objections for all using (true) with check (true);
create policy "Allow all" on stock_items for all using (true) with check (true);
create policy "Allow all" on stock_movements for all using (true) with check (true);
create policy "Allow all" on sales for all using (true) with check (true);
create policy "Allow all" on purchases for all using (true) with check (true);
create policy "Allow all" on employees for all using (true) with check (true);
create policy "Allow all" on salary_records for all using (true) with check (true);
