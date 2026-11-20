-- 190 · RPT-12 (product audit 2026-11-17) — a TDS challan keeps what of its total was interest and late fee / other.
--
-- The challan dialog split the total into TDS + interest + other only inside the voucher (Dr TDS Payable / Dr penalty);
-- the challan row kept the total alone, and the TDS Register's "Deposited" card added that total — interest and late
-- fee counted as TDS deposited (₹5,120 shown against ₹5,000 of TDS). The two amounts now live on the challan; the app
-- totals deposited TDS as amount − interest − other (lib/tax/challanPosting.challanTdsPart). The app writes them in a
-- second update, so a challan still saves before this runs. Production 2026-11-20: tds_challans has 0 rows.
-- Undo: 190_tds_challan_interest_other_down.sql.

begin;

alter table public.tds_challans add column if not exists "interestAmount" numeric not null default 0;
alter table public.tds_challans add column if not exists "otherAmount" numeric not null default 0;

insert into public.app_migrations (version, name) values ('190', 'tds_challan_interest_other')
  on conflict (version) do nothing;

commit;
