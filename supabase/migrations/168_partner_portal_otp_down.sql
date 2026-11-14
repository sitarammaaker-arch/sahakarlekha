-- 168 down · remove the partner portal login (codes, sessions, change requests) and give the old status-link RPCs
-- back to anon. partner_apply returns to 164's version (email optional). DESTRUCTIVE for pending change requests.
-- Emails marked verified by a partner login stay verified (harmless; 142 owns that table).
begin;

drop function if exists public.admin_detail_request_decide(bigint, text, text);
drop function if exists public.admin_detail_requests_list();
drop function if exists public.admin_partner_welcome_info(uuid);
drop function if exists public.admin_partner_set_email(uuid, text);
drop function if exists public.partner_details_request(text, text, text, text, text, text, text, text);
drop function if exists public.partner_portal(text);
drop function if exists public.partner_logout(text);
drop function if exists public.partner_login_verify(text, text);
drop function if exists public.partner_login_issue(text);
drop function if exists public._partner_from_session(text);
drop function if exists public._partner_norm_email(text);

drop table if exists public.partner_detail_requests;
drop table if exists public.partner_sessions;
drop table if exists public.partner_login_codes;
drop index if exists public.uq_partners_email_live;

-- 164's partner_apply, verbatim
create or replace function public.partner_apply(
  p_name text, p_phone text, p_email text, p_category text,
  p_district text, p_state text, p_note text,
  p_declared_not_public_servant boolean, p_declared_not_proxy boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := public._partner_norm_phone(p_phone);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_token uuid;
begin
  if coalesce(p_declared_not_public_servant, false) is false or coalesce(p_declared_not_proxy, false) is false then
    return jsonb_build_object('ok', false, 'error_code', 'declaration_required');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_name');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_phone');
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_email');
  end if;
  if p_category not in ('creator','accountant','ca','consultant','retired','other') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_category');
  end if;
  if exists (select 1 from public.partners where phone = v_phone and status <> 'rejected') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_phone');
  end if;
  if (select count(*) from public.partners where created_at > now() - interval '1 hour') >= 200 then
    return jsonb_build_object('ok', false, 'error_code', 'rate_limited');
  end if;

  insert into public.partners (name, phone, email, category, district, state, note,
                               declared_not_public_servant, declared_not_proxy)
  values (btrim(p_name), v_phone, v_email, p_category,
          nullif(btrim(coalesce(p_district, '')), ''), nullif(btrim(coalesce(p_state, '')), ''),
          nullif(left(btrim(coalesce(p_note, '')), 1000), ''),
          true, true)
  returning token into v_token;

  return jsonb_build_object('ok', true, 'token', v_token);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error_code', 'duplicate_phone');
end;
$$;

grant execute on function public.partner_status(uuid)      to anon, authenticated;
grant execute on function public.partner_dashboard(uuid)   to anon, authenticated;
grant execute on function public.partner_commissions(uuid) to anon, authenticated;
grant execute on function public.partner_payouts(uuid)     to anon, authenticated;

delete from public.app_migrations where version = '168';

commit;

notify pgrst, 'reload schema';
