-- 176 · year-close and payroll-run vouchers cannot be changed from the app (audit YE-03 / PAY-01, 2026-11-17).
--
-- YE-03: close_financial_year (091) posts two vouchers with origin 'system' — refType 'fy.close' (the income /
-- expense sweep into 1208, dated the next year's first day) and 'fy.close.stock' (the closing-stock journal).
-- The server refused edit / cancel / reverse only for origin 'engine' (078/095/103/127), so the sweep could be
-- cancelled: the whole closed year's income and expense came back into the current year, the year stayed
-- 'closed' and the close could not be run again.
--
-- PAY-01: payroll-run vouchers ('payrun-<runId>-accrual' / '-payment', posted by pay-post / pay-pay) could be
-- edited or reversed from the Vouchers screen while the run stayed 'posted'; a reversal made pay-rollback fail
-- for ever. pay-rollback itself CANCELS these vouchers through cancel_voucher as the user, so cancelling stays
-- allowed here for payroll vouchers (the app blocks it everywhere except Payroll's own Rollback); editing the
-- money and linking a reversal are refused.
--
-- vouchers BEFORE UPDATE:
--   fy.close / fy.close.*  — any change to isDeleted, amount, lines, date, Dr/Cr account or reversedBy is refused.
--   payrun-*-accrual/-payment — any change to amount, lines, date, Dr/Cr account or reversedBy is refused.
-- vouchers BEFORE INSERT: a voucher whose reversalOf points at one of these is refused.
--
-- Deliberate repair by hand (SQL editor): `set local sahakarlekha.allow_system_voucher_change = 'on';` inside the
-- transaction. No client path can set it (PostgREST runs no SET; no function sets it).
-- The app refuses the same changes earlier, with a Hindi message (src/lib/systemOwnedVoucher.ts).
-- Idempotent. Undo: 176_system_owned_vouchers_immutable_down.sql.

begin;

create or replace function public._is_system_owned_voucher(p_id text, p_ref text)
returns text language sql immutable as $fn$
  select case
    when coalesce(p_ref, '') = 'fy.close' or coalesce(p_ref, '') like 'fy.close.%' then 'year_close'
    when coalesce(p_id, '') ~ '^payrun-.+-(accrual|payment)$' then 'payroll_run'
  end;
$fn$;

create or replace function public._refuse_system_voucher_change()
returns trigger language plpgsql security definer
set search_path = public as $fn$
declare kind text; money_changed boolean;
begin
  if coalesce(current_setting('sahakarlekha.allow_system_voucher_change', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new."reversalOf", '') <> '' then
      select public._is_system_owned_voucher(v.id, v."refType") into kind from public.vouchers v where v.id = new."reversalOf";
      if kind is not null then
        raise exception 'post_voucher:system_voucher — वर्ष-समापन / Payroll run के वाउचर को reverse नहीं किया जा सकता। / A year-close or payroll-run voucher cannot be reversed.';
      end if;
    end if;
    return new;
  end if;

  kind := public._is_system_owned_voucher(old.id, old."refType");
  if kind is null then
    return new;
  end if;

  money_changed :=
       new.amount is distinct from old.amount
    or new.lines is distinct from old.lines
    or new.date is distinct from old.date
    or new."debitAccountId" is distinct from old."debitAccountId"
    or new."creditAccountId" is distinct from old."creditAccountId"
    or new."reversedBy" is distinct from old."reversedBy";

  if kind = 'year_close' and (money_changed or new."isDeleted" is distinct from old."isDeleted") then
    raise exception 'post_voucher:system_voucher — यह वर्ष-समापन का वाउचर है; इसे बदलने या रद्द करने से बंद वर्ष चालू वर्ष में लौट आएगा। सुधार चालू वर्ष में नए वाउचर से करें। / Year-close vouchers cannot be changed or cancelled.';
  end if;
  if kind = 'payroll_run' and money_changed then
    raise exception 'post_voucher:system_voucher — यह Payroll run का वाउचर है; इसे Payroll पेज पर Rollback से ही बदला जा सकता है। / Payroll-run vouchers change only through payroll rollback.';
  end if;
  return new;
end;
$fn$;
revoke execute on function public._refuse_system_voucher_change() from public, anon, authenticated;

drop trigger if exists refuse_system_voucher_change on public.vouchers;
create trigger refuse_system_voucher_change
  before insert or update on public.vouchers
  for each row execute function public._refuse_system_voucher_change();

insert into public.app_migrations (version, name) values ('176', 'system_owned_vouchers_immutable')
  on conflict (version) do nothing;

commit;
