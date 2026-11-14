-- 165 · Referral partners — slice 2: the partner's dashboard and three admin tools (2026-11-14).
--
-- WHAT (still no money — commission is slice 3):
--   Public (anon), keyed by the partner's secret status token (164):
--     partner_dashboard(token)          — the partner's own societies: name, district, when it joined, its plan and
--                                         subscription state, and whether/when it first paid. Nothing else about the
--                                         society — no accounts, members, vouchers or contact details.
--   Platform admin (is_platform_admin(); a non-admin gets an error, never rows):
--     admin_referral_events(society)    — the full attach / change / remove history of one society.
--     admin_partner_rotate_token(id)    — issue a new status link (the old one stops working) if a link leaked.
--   Rejected / suspended partners see no societies — only an approved partner has a dashboard.
--
-- The society side is told up front: the Register page says that giving a code shows that partner the society's
-- name and plan, and the Privacy Policy says the same (section "Referral partner").
--
-- Needs 164. Undo: 165_referral_partner_dashboard_down.sql (drops only these functions; no data).

begin;

create or replace function public.partner_dashboard(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v public.partners%rowtype;
  v_rows jsonb;
begin
  select * into v from public.partners where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  if v.status <> 'approved' then
    return jsonb_build_object('ok', true, 'status', v.status, 'societies', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.joined_at desc), '[]'::jsonb)
    into v_rows
    from (
      select s.name                                    as society_name,
             s.district                                as district,
             a.attributed_at                           as joined_at,
             sub.plan                                  as plan,
             sub.status                                as subscription_status,
             sub.period_end                            as period_end,
             (select min(o.updated_at) from public.orders o
               where o.society_id = a.society_id and o.status = 'paid') as first_paid_at
        from public.referral_attributions a
        join public.societies s on s.id::text = a.society_id
        left join public.subscriptions sub on sub.society_id = a.society_id
       where a.partner_id = v.id
    ) x;

  return jsonb_build_object('ok', true, 'status', v.status, 'societies', v_rows);
end;
$$;

create or replace function public.admin_referral_events(p_society_id text)
returns table (
  id bigint, action text, old_partner_name text, old_code text, new_partner_name text, new_code text,
  source text, reason text, actor text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select e.id, e.action, op.name, op.code, np.name, np.code, e.source, e.reason, e.actor, e.created_at
      from public.referral_attribution_events e
      left join public.partners op on op.id = e.old_partner_id
      left join public.partners np on np.id = e.new_partner_id
     where e.society_id = p_society_id
     order by e.created_at, e.id;
end;
$$;

create or replace function public.admin_partner_rotate_token(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_token uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.partners
     set token = gen_random_uuid(), updated_at = now()
   where id = p_id
  returning token into v_token;
  if v_token is null then
    return jsonb_build_object('ok', false, 'error_code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

-- anon-exec: partner_dashboard — /partner/status opens signed-out; it answers only for the secret 128-bit token and returns that partner's own societies (name, district, plan, paid date — no accounts or contacts).
revoke all on function public.partner_dashboard(uuid) from public;
grant execute on function public.partner_dashboard(uuid) to anon, authenticated;

revoke execute on function public.admin_referral_events(text)    from public, anon;
revoke execute on function public.admin_partner_rotate_token(uuid) from public, anon;
grant execute on function public.admin_referral_events(text)     to authenticated;
grant execute on function public.admin_partner_rotate_token(uuid) to authenticated;

insert into public.app_migrations (version, name) values ('165', 'referral_partner_dashboard')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fns = 3 | anon_dash = true | anon_events = false | anon_rotate = false | mig = 1):
--   select (select count(*) from pg_proc where proname in ('partner_dashboard','admin_referral_events','admin_partner_rotate_token')) as fns,
--          has_function_privilege('anon', 'public.partner_dashboard(uuid)', 'execute') as anon_dash,
--          has_function_privilege('anon', 'public.admin_referral_events(text)', 'execute') as anon_events,
--          has_function_privilege('anon', 'public.admin_partner_rotate_token(uuid)', 'execute') as anon_rotate,
--          (select count(*) from public.app_migrations where version = '165') as mig;
