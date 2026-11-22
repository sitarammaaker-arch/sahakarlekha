// DB-03 part 2 (product audit 2026-11-17) · migration 201: vouchers.memberId / loans.memberId name a member of the SAME
// society — (memberId, society_id) → members(id, society_id). Founder decision 2026-11-22: the 41 dangling links
// (35 cancelled practice receipts of long-deleted members + 6 memberId '') are cleared after a backup.
// PGlite run (scratchpad pg/t201.mjs, 2026-11-22): dangling links backed up then nulled (re-run adds nothing); '' → null
// by trigger; missing / other-society member refused; a member in use cannot be hard-deleted but can be soft-deleted;
// a Replace restore marks a member in use deleted instead of removing it, and keeps an account only a pending voucher
// names; down puts the 41 values and 188's restore_commit back.
// Run: node scripts/test-db03-member-fks.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const up = read('supabase/migrations/201_member_foreign_keys.sql');
const down = read('supabase/migrations/201_member_foreign_keys_down.sql');
const code = up.replace(/^\s*--.*$/gm, '');
const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.restore_commit('), sql.indexOf('\n$fn$;\n', sql.indexOf('create or replace function public.restore_commit(')) + 7);
const fn188 = fnOf(read('supabase/migrations/188_restore_rederive_financial_years.sql'));
const fn201 = fnOf(up);

// 1. backup BEFORE clearing, and only the dangling / blank links are cleared
const bk = code.indexOf("insert into public._member_ref_backup (tbl, row_id, society_id, old_member_id)\n  select 'vouchers'");
const clr = code.indexOf('update public.vouchers v set "memberId" = null');
ok(bk > 0 && clr > bk && code.indexOf("select 'loans'") < code.indexOf('update public.loans l set "memberId" = null'), 'every cleared link is copied into _member_ref_backup first (vouchers and loans)');
const DANGLING = `(v."memberId" = '' or not exists (select 1 from public.members m where m.id = v."memberId" and m.society_id = v.society_id))`;
ok(code.split(DANGLING).length === 3, 'the clear touches exactly the links the backup copied: blank or pointing at no member of that society');
ok(code.includes('alter table public._member_ref_backup enable row level security;') && code.includes('revoke all on public._member_ref_backup from public, anon, authenticated;'), 'the backup table is readable by no API role');

// 2. '' → null on both tables
ok(code.includes(`if new."memberId" = '' then new."memberId" := null; end if;`) && /create trigger member_id_blank_to_null before insert or update on public\.vouchers/.test(code) && /create trigger member_id_blank_to_null before insert or update on public\.loans/.test(code), "a trigger turns memberId '' into null on vouchers and loans");

// 3. key target + keys (dependants dropped before the unique, so a re-run rebuilds cleanly)
const dv = code.indexOf('alter table public.vouchers drop constraint if exists vouchers_member_fkey;');
const du = code.indexOf('alter table public.members drop constraint if exists members_id_society_key;');
ok(dv > 0 && du > dv && code.includes('add constraint members_id_society_key unique (id, society_id);'), 'members gets unique (id, society_id); the keys are dropped before it (re-runnable)');
for (const [tbl, name] of [['vouchers', 'vouchers_member_fkey'], ['loans', 'loans_member_fkey']]) {
  ok(code.includes(`alter table public.${tbl} add constraint ${name}\n  foreign key ("memberId", society_id) references public.members (id, society_id) not valid;`) && code.indexOf(`validate constraint ${name};`) > code.indexOf(`add constraint ${name}`), `${name}: (memberId, society_id) → members(id, society_id), NOT VALID then validated`);
}
ok(!/on delete/i.test(code), 'no ON DELETE: the app only soft-deletes members, so the key never blocks it');
ok(code.includes('create index if not exists idx_vouchers_member on public.vouchers ("memberId", society_id);') && /create index if not exists idx_loans_member\s+on public\.loans/.test(code), 'indexes on the referencing columns');

// 4. restore_commit = 188's body + only the marked 201 lines
const strip = (s) => s.split('\n').filter((l) => !/201/.test(l)).join('\n');
ok(fn201.includes(`elsif v_t = 'members' then`) && fn201.includes(`update public.members t set "isDeleted" = true`) && fn201.includes(`'membersKept', v_kept_members`), 'restore marks a member a voucher / loan still names as deleted instead of removing it (membersKept)');
ok(fn201.includes('or exists (select 1 from public.vouchers v where v.society_id = t.society_id and t.id in (v."debitAccountId", v."creditAccountId"))') && fn201.includes('and not exists (select 1 from public.voucher_entries e where e.society_id = t.society_id and e."accountId" = t.id);'), "restore keeps an account a voucher (even a pending one) or an entry names — 200's keys would refuse the delete");
const base201 = strip(fn201).replace(/\n\s*elsif v_t = 'members' then[\s\S]*?(?=\n\s*else\n)/, '').replace(/, 'membersKept', v_kept_members/g, '').replace(/ v_kept_members int := 0;/, '');
ok(strip(fn188).replace(/\s+/g, ' ').length > 5000, '188 restore_commit found');
ok(base201.replace(/\s+/g, ' ').replace(/\)\);/g, ');').length >= strip(fn188).replace(/\s+/g, ' ').length - 40 && fn201.split('\n').length - fn188.split('\n').length < 25, 'the rest of restore_commit is 188 unchanged (only marked lines added)');
ok(up.includes('revoke execute on function public.restore_commit(uuid, int, text, text, jsonb) from public, anon;') && up.includes('grant execute on function public.restore_commit(uuid, int, text, text, jsonb) to authenticated;'), 'grants re-stated');
ok(code.includes("insert into public.app_migrations (version, name) values ('201', 'member_foreign_keys')"), 'registers itself');

// 5. down
ok(down.includes(fn188), "down puts 188's restore_commit back verbatim");
ok(down.includes(`update public.vouchers v set "memberId" = b.old_member_id\n  from public._member_ref_backup b where b.tbl = 'vouchers'`) && !/drop table/i.test(down), 'down restores the cleared values from the backup and keeps the backup table');
ok(['vouchers_member_fkey', 'loans_member_fkey', 'members_id_society_key'].every((n) => down.includes(`drop constraint if exists ${n};`)) && down.includes('drop function if exists public._member_id_blank_to_null();') && down.includes("delete from public.app_migrations where version = '201';"), 'down drops keys, unique, trigger function and the row');

// 6. app side
ok(read('src/lib/vouchers/checkErrors.ts').includes(`s.includes('vouchers_member_fkey')) return MISSING_MEMBER;`), 'a refused save names the missing member in Hindi');
ok(read('src/contexts/DataContext.tsx').includes("if (newMember.approvalStatus !== 'pending') postJoiningReceipts(newMember, { quiet: opts.quiet });"), 'the joining receipt is posted only once the member row is in the cloud (no race with the key)');
ok(read('src/lib/restore/serverWriter.ts').includes('membersKept?: number;'), 'the restore result type knows membersKept');

console.log(`DB-03 member keys (201): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
