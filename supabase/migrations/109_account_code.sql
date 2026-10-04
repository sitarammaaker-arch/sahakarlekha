-- 109 · Readable ledger code for accounts whose id is a UUID.
-- User-created accounts get crypto.randomUUID() ids (vouchers reference them, so they never change).
-- accounts.code holds a readable code (next free in the parent group's range, e.g. '2112' or
-- '2100-01'), assigned on create and, for existing UUID accounts, by the admin's explicit
-- "कोड दें" button on Ledger Heads. Template accounts keep code NULL — their numeric id IS the code.
-- Additive + idempotent. The partial unique index keeps codes unique within a society
-- (all rows are NULL right after this migration, so it cannot conflict).

begin;

alter table public.accounts add column if not exists code text;

create unique index if not exists accounts_society_code_uniq
  on public.accounts (society_id, code)
  where code is not null;

commit;

notify pgrst, 'reload schema';
