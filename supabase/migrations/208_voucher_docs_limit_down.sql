-- 208 down · removes the bill-copy storage limit: the two insert policies go back to their migration-207 form and the
-- three functions are dropped. Bills already stored are untouched.
begin;

drop policy if exists voucher_attachments_tenant_insert on public.voucher_attachments;
create policy voucher_attachments_tenant_insert on public.voucher_attachments for insert
  with check (society_id in (select public.current_user_society_ids()) and public.jwt_can_write());

drop policy if exists "voucher_docs_insert" on storage.objects;
create policy "voucher_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'voucher-docs' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

drop function if exists public.voucher_docs_usage();
drop function if exists public.voucher_docs_used_bytes(text);
drop function if exists public.voucher_docs_limit_bytes(text);

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '208';

commit;
