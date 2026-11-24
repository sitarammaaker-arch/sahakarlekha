-- 207 down · removes the attachment table, its storage policies and the bucket record.
-- WARNING: run only before any society has added a bill. Files already in 'voucher-docs' must be removed through the
-- Storage API / dashboard first (Supabase refuses to delete a bucket record that still holds objects).
begin;

drop policy if exists "voucher_docs_select" on storage.objects;
drop policy if exists "voucher_docs_insert" on storage.objects;
drop policy if exists "voucher_docs_delete" on storage.objects;
delete from storage.buckets where id = 'voucher-docs';

delete from public.restore_tables where table_name = 'voucher_attachments';
drop table if exists public.voucher_attachments;

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '207';

commit;
