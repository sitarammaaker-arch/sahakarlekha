-- 208 · A storage limit per society for bill copies (वाउचर बिल — storage सीमा).
--
-- WHY: migration 207 let a society keep bill copies in the private bucket 'voucher-docs' with no ceiling. The founder
-- (2026-11-24) asked for a per-plan limit "as you judge". A typical society keeps ~50 MB of bills a year (photos are
-- shrunk to ~0.3 MB), so the limits only stop misuse; they are far above honest use.
--
-- WHAT:
--   (1) voucher_docs_limit_bytes(society) — the limit from subscriptions.plan. The public plans are Starter / Plus / Pro:
--         starter 2 GB · plus 10 GB · pro 50 GB; trial = Starter (2 GB, the 30-day trial is Starter-equivalent);
--         enterprise (hidden, contact-sales) 200 GB; legacy (the grandfathered free societies) and anything else 5 GB
--       The same numbers are in src/lib/voucherAttachments.ts (BILL_STORAGE_LIMIT_GB); test:voucher-attachments keeps
--       the two in step.
--   (2) voucher_docs_used_bytes(society) — the bytes of every bill row, removed ones included (a removed bill's file is
--       kept for the audit trail, so it still takes space).
--   (3) voucher_docs_usage() — used + limit for the signed-in society, for the app to show and check before uploading.
--   (4) the row insert policy and the storage insert policy now refuse a file that would pass the limit (the row: used +
--       this file > limit; the bucket: already at / over the limit). The app removes an uploaded file whose row is
--       refused, so nothing is left behind.
--
-- Run BEFORE deploying the code. Reversible: 208_voucher_docs_limit_down.sql.

begin;

create or replace function public.voucher_docs_limit_bytes(p_society text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (case coalesce((select s.plan from public.subscriptions s where s.society_id::text = p_society limit 1), 'legacy')
    when 'trial'      then 2
    when 'starter'    then 2
    when 'plus'       then 10
    when 'pro'        then 50
    when 'enterprise' then 200
    else 5
  end)::bigint * 1024 * 1024 * 1024;
$$;

create or replace function public.voucher_docs_used_bytes(p_society text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(a."sizeBytes"), 0)::bigint from public.voucher_attachments a where a.society_id = p_society;
$$;

create or replace function public.voucher_docs_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'used', public.voucher_docs_used_bytes(public.get_current_society_id()),
    'limit', public.voucher_docs_limit_bytes(public.get_current_society_id()));
$$;

revoke execute on function public.voucher_docs_limit_bytes(text) from public, anon;
revoke execute on function public.voucher_docs_used_bytes(text) from public, anon;
revoke execute on function public.voucher_docs_usage() from public, anon;
grant execute on function public.voucher_docs_limit_bytes(text) to authenticated;
grant execute on function public.voucher_docs_used_bytes(text) to authenticated;
grant execute on function public.voucher_docs_usage() to authenticated;

-- (4) the row: this file must fit
drop policy if exists voucher_attachments_tenant_insert on public.voucher_attachments;
create policy voucher_attachments_tenant_insert on public.voucher_attachments for insert
  with check (
    society_id in (select public.current_user_society_ids()) and public.jwt_can_write()
    and public.voucher_docs_used_bytes(society_id) + coalesce("sizeBytes", 0) <= public.voucher_docs_limit_bytes(society_id)
  );

-- (4) the bucket: no upload once the society is at its limit
drop policy if exists "voucher_docs_insert" on storage.objects;
create policy "voucher_docs_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voucher-docs' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write()
    and public.voucher_docs_used_bytes((storage.foldername(name))[1]) < public.voucher_docs_limit_bytes((storage.foldername(name))[1])
  );

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('208', 'voucher_docs_limit')
  on conflict do nothing;

commit;

-- VERIFY: expect functions = 3, default_limit_gb = 5 (a society with no subscription row), limited_policies = 2.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('voucher_docs_limit_bytes', 'voucher_docs_used_bytes', 'voucher_docs_usage') and p.prosecdef) as functions,
  (select public.voucher_docs_limit_bytes('no-such-society') / 1024 / 1024 / 1024) as default_limit_gb,
  (select count(*) from pg_policies where policyname in ('voucher_attachments_tenant_insert', 'voucher_docs_insert')
     and with_check like '%voucher_docs_limit_bytes%') as limited_policies;
