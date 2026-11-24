-- 207 · Bill copy with the voucher (वाउचर के साथ बिल की कॉपी).
--
-- WHY: an auditor asks for the bill behind every payment voucher, and the HAFED Accounts Manual (1976) keeps every
-- voucher with its supporting document. The portal could not hold a document at all — users kept paper files apart
-- from the books (user-journey audit 2026-11-22: "Document attachments on vouchers: not found").
--
-- WHAT:
--   (1) table voucher_attachments — one row per file: which voucher, where it is stored, who added it. Kept APART from
--       vouchers on purpose: a posting-service society may not write the vouchers table directly (migration 105), and a
--       file never changes the ledger. Removing a file is a soft delete (isDeleted) so the audit trail stays; the file
--       itself is kept.
--   (2) a PRIVATE storage bucket 'voucher-docs' — 5 MB per file, JPG / PNG / WEBP / PDF only. Path
--       `<society id>/<voucher id>/<attachment id>.<ext>`; the first folder is what the policies check.
--   (3) storage policies, the same shape as member-photos (migration 119): a society's own users read; its writers add;
--       its writers may remove (the app removes a file only when its row failed to save — an orphan). No update.
--   (4) the table joins the restore allowlist (restore_tables) and carries the row change log.
--
-- Run BEFORE deploying the code. Reversible: 207_voucher_attachments_down.sql.

begin;

create table if not exists public.voucher_attachments (
  id            text primary key,
  society_id    text not null,
  "voucherId"   text not null,
  path          text not null,
  "fileName"    text,
  "mimeType"    text,
  "sizeBytes"   bigint,
  "uploadedBy"  text,
  "uploadedAt"  timestamptz not null default now(),
  "isDeleted"   boolean not null default false,
  "deletedAt"   timestamptz,
  "deletedBy"   text
);

create index if not exists voucher_attachments_society_uploaded_idx on public.voucher_attachments (society_id, "uploadedAt", id);
create index if not exists voucher_attachments_voucher_idx on public.voucher_attachments (society_id, "voucherId");

alter table public.voucher_attachments enable row level security;
grant select, insert, update, delete on public.voucher_attachments to authenticated;
grant all on public.voucher_attachments to service_role;

drop policy if exists voucher_attachments_tenant_select on public.voucher_attachments;
create policy voucher_attachments_tenant_select on public.voucher_attachments for select
  using (society_id in (select public.current_user_society_ids()));
drop policy if exists voucher_attachments_tenant_insert on public.voucher_attachments;
create policy voucher_attachments_tenant_insert on public.voucher_attachments for insert
  with check (society_id in (select public.current_user_society_ids()) and public.jwt_can_write());
drop policy if exists voucher_attachments_tenant_update on public.voucher_attachments;
create policy voucher_attachments_tenant_update on public.voucher_attachments for update
  using (society_id in (select public.current_user_society_ids()) and public.jwt_can_write())
  with check (society_id in (select public.current_user_society_ids()) and public.jwt_can_write());
drop policy if exists voucher_attachments_tenant_delete on public.voucher_attachments;
create policy voucher_attachments_tenant_delete on public.voucher_attachments for delete
  using (society_id in (select public.current_user_society_ids()) and public.jwt_can_delete());

drop trigger if exists change_log_row on public.voucher_attachments;
create trigger change_log_row after insert or delete or update on public.voucher_attachments
  for each row when (current_user = 'authenticated') execute function public._change_log_row();

insert into public.restore_tables (table_name) values ('voucher_attachments') on conflict do nothing;

-- (2) the private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voucher-docs', 'voucher-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- (3) storage policies
drop policy if exists "voucher_docs_select" on storage.objects;
create policy "voucher_docs_select" on storage.objects for select to authenticated
  using (bucket_id = 'voucher-docs' and (storage.foldername(name))[1] in (select public.current_user_society_ids()));

drop policy if exists "voucher_docs_insert" on storage.objects;
create policy "voucher_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'voucher-docs' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

drop policy if exists "voucher_docs_delete" on storage.objects;
create policy "voucher_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'voucher-docs' and (storage.foldername(name))[1] in (select public.current_user_society_ids()) and public.jwt_can_write());

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('207', 'voucher_attachments')
  on conflict do nothing;

commit;

-- VERIFY: expect table_exists = 1, policies = 4, bucket_private = true, storage_policies = 3, restorable = 1.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'voucher_attachments') as table_exists,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'voucher_attachments') as policies,
  (select not public from storage.buckets where id = 'voucher-docs') as bucket_private,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'voucher_docs_%') as storage_policies,
  (select count(*) from public.restore_tables where table_name = 'voucher_attachments') as restorable;
