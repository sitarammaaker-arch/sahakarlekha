-- 167 down · remove payouts, TDS rules, PAN/bank details and clawbacks; restore 166's cancel and status list.
-- DESTRUCTIVE. If any commission is already 'paid', restoring the 166 status CHECK fails and the whole transaction
-- rolls back — on purpose: payouts that happened must not be erased by an undo.
begin;

drop function if exists public.partner_payouts(uuid);
drop function if exists public.admin_payouts_list();
drop function if exists public.admin_payout_record(uuid, date, bigint[], bigint, text, text, text);
drop function if exists public.admin_payout_preview(uuid, date);
drop function if exists public.admin_tds_rule_add(date, numeric, numeric, bigint, text, text, text);
drop function if exists public.admin_tds_rules_list();
drop function if exists public.admin_partner_payment_details_set(uuid, text, text, text, text, text, text, text);
drop function if exists public.admin_partner_payment_details_get(uuid);
drop function if exists public._partner_payout_calc(uuid, date, bigint[]);
drop function if exists public._partner_fy(date);

alter table public.partner_commissions drop constraint if exists partner_commissions_payout_fk;
drop table if exists public.partner_clawbacks;
drop table if exists public.partner_payout_items;
drop table if exists public.partner_payouts;
drop table if exists public.partner_tds_rules;
drop table if exists public.partner_payment_details;
alter table public.partner_commissions drop column if exists payout_id;

alter table public.partner_commissions drop constraint if exists partner_commissions_status_check;
alter table public.partner_commissions add constraint partner_commissions_status_check
  check (status in ('no_rule','pending','cancelled'));

-- 166's cancel, verbatim
create or replace function public.admin_commission_cancel(p_id bigint, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    return jsonb_build_object('ok', false, 'error_code', 'reason_required');
  end if;
  select status into v_status from public.partner_commissions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error_code', 'already_cancelled');
  end if;
  update public.partner_commissions
     set status = 'cancelled', cancel_reason = v_reason, cancelled_at = now(),
         cancelled_by = coalesce(auth.jwt() ->> 'email', 'platform-admin'), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.admin_commission_cancel(bigint, text) from public, anon;
grant execute on function public.admin_commission_cancel(bigint, text) to authenticated;

delete from public.app_migrations where version = '167';

commit;

notify pgrst, 'reload schema';
