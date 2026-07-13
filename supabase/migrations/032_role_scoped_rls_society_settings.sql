-- 032 · admin-only writes on society_settings (governance config). Audit P0-3, Layer B / SB2 slice 4.
--
-- society_settings carried ONE `society_settings_member` FOR ALL policy (tenant-only), so ANY member
-- of the society — viewer or accountant included — could write governance config: period-lock,
-- FY-lock/unlock, approval matrix, board members, signatories, premium cap. The app already treats
-- this row as "Admin-only" (see src/lib/export/entities/core.ts) but nothing enforced it.
--
-- Split that one policy into four command-scoped policies, matching the existing admin-gate style used
-- by societies / society_users / society_capabilities (server-side is_society_admin(), NOT the JWT
-- claim — so it is not spoofable via localStorage and needs no token refresh):
--   SELECT              → tenant only (every role reads; DataContext loads settings for all users)
--   INSERT/UPDATE/DELETE → is_society_admin((society_id)::text)  (admin of that society only)
--
-- The tenant SELECT predicate is READ from the existing policy and reused verbatim (never guessed).
-- Idempotent (skips if already split). Paired with a DataContext RULE-1 rollback so a non-admin's
-- now-rejected write restores local state instead of silently diverging. Reversible via _down.

do $$
declare q text;
begin
  select qual into q from pg_policies
   where schemaname = 'public' and tablename = 'society_settings'
     and policyname = 'society_settings_member' and cmd = 'ALL';

  if q is null then
    raise notice 'society_settings_member FOR ALL not found (already split?) — skipping';
    return;
  end if;

  drop policy society_settings_member on public.society_settings;

  execute format('create policy society_settings_select on public.society_settings for select using (%s)', q);

  create policy society_settings_insert on public.society_settings
    for insert with check (is_society_admin((society_id)::text));

  create policy society_settings_update on public.society_settings
    for update using (is_society_admin((society_id)::text))
             with check (is_society_admin((society_id)::text));

  create policy society_settings_delete on public.society_settings
    for delete using (is_society_admin((society_id)::text));

  raise notice 'society_settings split: select(tenant) + insert/update/delete(admin-only)';
end $$;
