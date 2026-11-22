// DB-03 (product audit 2026-11-17) · migration 200: vouchers (debit, credit) and voucher_entries name an account of the
// SAME society — (accountId, society_id) → accounts(id, society_id), the key voucher_lines / account_roles already have.
// PGlite run (scratchpad pg/t200.mjs, 2026-11-22): a missing or other-society account is refused, an account in use
// cannot be deleted, null accounts / unused-account deletes / other-column updates pass, re-run and down work, and an
// existing orphan makes VALIDATE fail with nothing left behind.
// Run: node scripts/test-db03-voucher-account-fks.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const up = read('supabase/migrations/200_voucher_account_foreign_keys.sql');
const down = read('supabase/migrations/200_voucher_account_foreign_keys_down.sql');
const code = up.replace(/--.*$/gm, '');

const FKS = [
  ['vouchers', 'vouchers_debit_account_fkey', '"debitAccountId"'],
  ['vouchers', 'vouchers_credit_account_fkey', '"creditAccountId"'],
  ['voucher_entries', 'voucher_entries_account_fkey', '"accountId"'],
];
for (const [tbl, name, col] of FKS) {
  const drop = code.indexOf(`alter table public.${tbl} drop constraint if exists ${name};`);
  const add = code.indexOf(`add constraint ${name}\n  foreign key (${col}, society_id) references public.accounts (id, society_id) not valid;`);
  const val = code.indexOf(`alter table public.${tbl} validate constraint ${name};`);
  ok(drop >= 0 && add > drop && val > add, `${name}: (${col}, society_id) → accounts(id, society_id), drop-if-exists → add NOT VALID → validate`);
}
ok(!/on delete/i.test(code), 'no ON DELETE action: an account in use cannot be deleted (RULE 3 — rename, never hard-delete)');
for (const ix of ['idx_vouchers_debit_account', 'idx_vouchers_credit_account', 'idx_ve_account_society']) ok(new RegExp(`create index if not exists ${ix} +on public\\.`).test(code), `index ${ix} (an account delete does not scan every voucher)`);
ok(!/references public\.(members|societies)/.test(code), 'member / society keys are NOT in this migration (memberId \'\' values, restore deletes members, uuid vs text) — follow-up');
ok(code.includes("insert into public.app_migrations (version, name) values ('200', 'voucher_account_foreign_keys')"), 'registers itself');
ok(FKS.every(([, n]) => down.includes(`drop constraint if exists ${n};`)) && down.includes("delete from public.app_migrations where version = '200';") && (down.match(/drop index if exists/g) || []).length === 3, 'down drops the keys, the indexes and the row');

// the same key already exists on voucher_lines / account_roles in production (so no new way for a save to fail)
const snap = read('supabase/schema/production-schema.txt');
ok(snap.includes('voucher_lines_account_fkey FOREIGN KEY (account_id, society_id) REFERENCES accounts(id, society_id)') && snap.includes('account_roles_account_fkey FOREIGN KEY (account_id, society_id) REFERENCES accounts(id, society_id)'), 'voucher_lines and account_roles already carry this key in production');
// merge_accounts re-points vouchers before deleting the merged account
const m153 = read('supabase/migrations/153_opening_event_id_per_society.sql');
ok(m153.indexOf('"debitAccountId"  = case when "debitAccountId"  = p_remove') > 0 && m153.indexOf('update public.voucher_entries set "accountId" = p_keep') < m153.indexOf('delete from public.accounts where id = p_remove'), 'merge_accounts re-points vouchers and entries before deleting the merged account');
// restore inserts accounts before vouchers
ok(/dependsOn:\s*\['society', 'account', 'member'\]/.test(read('src/lib/export/entities/core.ts')), 'restore order: vouchers depend on accounts');

// a refused save says why, in Hindi
const helper = read('src/lib/vouchers/checkErrors.ts');
ok(FKS.every(([, n]) => helper.includes(`'${n}'`)) && helper.includes('/foreign key constraint/i.test(s)'), 'checkErrors.ts turns these three FK refusals into a Hindi reason');

console.log(`DB-03 voucher account FKs (200): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
