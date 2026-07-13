-- 032 down · collapse the 4 society_settings policies back into ONE `society_settings_member`
--            FOR ALL policy (tenant-only) — restores pre-032 behaviour (any member may write).
-- Reads the tenant predicate back from the surviving society_settings_select policy so the exact
-- expression is reused verbatim. Run at once if admins cannot save settings after 032.

do $$
declare q text;
begin
  select qual into q from pg_policies
   where schemaname = 'public' and tablename = 'society_settings'
     and policyname = 'society_settings_select';

  if q is null then
    raise notice 'society_settings_select not found (already collapsed?) — skipping';
    return;
  end if;

  drop policy if exists society_settings_select on public.society_settings;
  drop policy if exists society_settings_insert on public.society_settings;
  drop policy if exists society_settings_update on public.society_settings;
  drop policy if exists society_settings_delete on public.society_settings;

  execute format('create policy society_settings_member on public.society_settings for all using (%s) with check (%s)', q, q);

  raise notice 'society_settings collapsed back to society_settings_member FOR ALL';
end $$;
