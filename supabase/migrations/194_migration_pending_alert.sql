-- 194 · OPS-02 (product audit 2026-11-17) — alert when the live code needs a migration production has not run.
--
-- Migrations are pasted into the SQL Editor by hand. Code that needs migration N can go live before N is run: #904 was
-- merged before 185, and a rollback file was once run in production by mistake. Each build now ships
-- /migrations.json, the numbered migrations it expects (scripts/migration-manifest.mjs). Every 30 min the email-health
-- function compares it with public.app_migrations and passes the missing versions in p_site.missing_migrations,
-- but only once the build is 2 h old. This makes claim_email_health_alert() raise an alert for them; the email names
-- each missing file. Repo and production matched exactly on 2026-11-21 (112 = 112).
-- The same 6-hour cadence and the same recovered email apply: running the migration clears it.
-- Undo: 194_migration_pending_alert_down.sql (the 192 claim).
begin;

create or replace function public.claim_email_health_alert(p_site jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h      jsonb := public.email_health();
  v_open   public.email_health_alerts%rowtype;
  v_action text := 'none';
  v_to     text[];
begin
  if p_site is not null then
    v_h := v_h || jsonb_build_object('site', p_site);
    if coalesce((p_site ->> 'ok')::boolean, true) = false then
      v_h := jsonb_set(v_h, '{level}', '"alert"');
    end if;
    -- 194 · OPS-02: the live build expects migrations production has not run (the function waits 2 h after the deploy).
    if jsonb_typeof(p_site -> 'missing_migrations') = 'array' and jsonb_array_length(p_site -> 'missing_migrations') > 0 then
      v_h := jsonb_set(v_h, '{level}', '"alert"');
    end if;
  end if;

  select * into v_open from public.email_health_alerts
   where resolved_at is null order by sent_at desc limit 1 for update;

  if v_h ->> 'level' = 'alert' then
    if v_open.id is null or v_open.sent_at < now() - interval '6 hours' then
      insert into public.email_health_alerts (level, summary) values ('alert', v_h);
      v_action := 'alert';
    end if;
  elsif v_h ->> 'level' = 'ok' and v_open.id is not null then
    update public.email_health_alerts set resolved_at = now() where resolved_at is null;
    v_action := 'recovered';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_to
    from public.platform_admins where is_active and coalesce(trim(email), '') <> '';
  return jsonb_build_object('action', v_action, 'health', v_h, 'recipients', to_jsonb(v_to));
end;
$$;
revoke execute on function public.claim_email_health_alert(jsonb) from public, anon, authenticated;
grant execute on function public.claim_email_health_alert(jsonb) to service_role;

insert into public.app_migrations (version, name) values ('194', 'migration_pending_alert')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: has_check = true | mig = 1):
--   select position('missing_migrations' in pg_get_functiondef('public.claim_email_health_alert(jsonb)'::regprocedure)) > 0 as has_check,
--          (select count(*) from public.app_migrations where version = '194') as mig;
