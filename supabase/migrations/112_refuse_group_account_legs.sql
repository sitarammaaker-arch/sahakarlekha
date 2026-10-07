-- 112 · The database itself refuses a voucher leg that posts to a GROUP account.
--
-- WHY: a group account is a heading; its balance is invisible to every report (the trial balance skips
-- groups, so the amount lands in a synthetic "[Deleted]" row typed liability and the surplus is misstated —
-- Assandh 2026-10-02: 5 accounts, ₹8.99 L; Kisan Samriddhi: 1). The app already refuses it (addVoucher /
-- updateVoucher → blockGroupPosting, #655), but every server path trusts the client's account ids:
-- post_voucher, post_stock_document, edit_voucher, approve_voucher all INSERT into voucher_lines. A stale
-- tab, an import, a restored backup or a future client bug could still write such a leg.
--
-- WHAT: one BEFORE INSERT trigger on voucher_lines — it covers every server path at once, with no
-- rewrite of the large posting functions. The refusal carries the same `post_voucher:<code>` shape the
-- client already turns into a Hindi message (postVoucherMessages.ts → group_account).
--
-- NOT HERE: existing rows are never touched (insert-only trigger). One consequence, by design: EDITING an
-- old voucher whose leg points at a group re-inserts that leg and is refused until the leg is moved to a
-- ledger under the group — preview_112 lists those vouchers first. An account flipped to group AFTER
-- postings is guarded separately in Ledger Heads / updateAccount.
--
-- Idempotent. Undo: 112_refuse_group_account_legs_down.sql.

begin;

create or replace function public.tg_refuse_group_account_leg()
returns trigger language plpgsql security definer
set search_path = public as $fn$
begin
  if exists (
    select 1 from public.accounts a
     where a.society_id::text = new.society_id::text
       and a.id = new.account_id
       and coalesce(a."isGroup", false)
  ) then
    raise exception 'post_voucher:group_account'
      using hint = 'Account ' || new.account_id || ' is a group; post to a ledger under it.';
  end if;
  return new;
end;
$fn$;
revoke execute on function public.tg_refuse_group_account_leg() from public, anon, authenticated;

drop trigger if exists trg_refuse_group_account_leg on public.voucher_lines;
create trigger trg_refuse_group_account_leg
  before insert on public.voucher_lines
  for each row execute function public.tg_refuse_group_account_leg();

insert into public.app_migrations (version, name) values ('112', 'refuse_group_account_legs')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
