// Migration 198 (founder decision 2026-11-22): remove the orphan 'SOC001' rows — 377 accounts + 9 account_reclass_log —
// that the old `default 'SOC001'` (dropped by 197, DB-04) let in. PGlite (scratchpad pg/t198.mjs): up backs up then
// deletes only SOC001 rows; down restores them; a referenced SOC001 account makes the guard refuse and nothing is deleted.
// Run: node scripts/test-soc001-orphans.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const up = read('supabase/migrations/198_remove_soc001_orphans.sql');
const down = read('supabase/migrations/198_remove_soc001_orphans_down.sql');
const code = up.replace(/--.*$/gm, '');

// back up before deleting
const backupAt = code.indexOf("insert into public._soc001_orphans_backup (tbl, row_data)\n  select 'accounts'");
const deleteAt = code.indexOf("delete from public.accounts where society_id = 'SOC001';");
ok(backupAt > 0 && deleteAt > backupAt, 'every accounts row is copied into the backup BEFORE it is deleted');
ok(code.indexOf("select 'account_reclass_log', to_jsonb(l)") > 0 && code.indexOf("delete from public.account_reclass_log where society_id = 'SOC001';") > code.indexOf("select 'account_reclass_log', to_jsonb(l)"), 'same for account_reclass_log');
// only SOC001
const deletes = [...code.matchAll(/delete from public\.([a-z_]+) where ([^;]+);/g)];
ok(deletes.length === 2 && deletes.every((m) => m[2].trim() === "society_id = 'SOC001'"), 'exactly two deletes, both limited to society_id = SOC001 (nothing else can go)');
// guard
ok(/if exists \(select 1 from public\.voucher_lines where society_id = 'SOC001'\)[\s\S]*account_roles[\s\S]*voucher_entries[\s\S]*raise exception/.test(code) && code.indexOf('raise exception') < backupAt, 'a guard refuses (before any write) if a voucher line, account role or entry points at SOC001');
// backup table is private
ok(code.includes('alter table public._soc001_orphans_backup enable row level security;') && code.includes('revoke all on public._soc001_orphans_backup from public, anon, authenticated;'), 'the backup table is readable by no API role (RLS on, no policy, grants revoked)');
ok(code.includes("insert into public.app_migrations (version, name) values ('198', 'remove_soc001_orphans')"), 'registers itself');
// undo
ok(down.includes('jsonb_populate_record(null::public.accounts, b.row_data)') && down.includes('jsonb_populate_record(null::public.account_reclass_log, b.row_data)') && (down.match(/on conflict do nothing;/g) || []).length === 2, 'down restores both tables from the backup (idempotent)');
ok(down.includes("delete from public.app_migrations where version = '198';") && !/drop table/i.test(down), 'down forgets the row and keeps the backup table');
// the default that let them in is gone (197)
ok(read('supabase/migrations/197_no_soc001_default.sql').includes('alter column society_id drop default'), '197 removed the default, so no new SOC001 rows can arrive');

console.log(`SOC001 orphans (198): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
