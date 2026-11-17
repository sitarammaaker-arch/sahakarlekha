// Pins the 2026-11-17 P0 fixes so they cannot quietly regress:
//   BKP-00/BKP-07 — scheduled-backup's hourly "due" mode (migration 174) + the stale-backup alarm.
//   PAY-02        — one salary path per month: trigger on salary_records (migration 175) + pay-post refusal.
// The SQL of both migrations was run end-to-end on Postgres (PGlite) while building; this file pins the shape.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const noComments = (s) => s.replace(/--.*$/gm, '');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── BKP-00 / BKP-07 ─────────────────────────────────────────────────────────────────────────────────
const fn = read('supabase/functions/scheduled-backup/index.ts');
ok(/from '\.\.\/_shared\/backup-due\.mjs'/.test(fn), 'scheduled-backup imports the pure due-picker');
ok(/if \(body\?\.due\)/.test(fn) && /pickDueSocieties\(/.test(fn), 'scheduled-backup has the { due: true } mode');
ok(/Math\.min\(20,/.test(fn), 'a caller cannot ask for more than 20 societies in one call');

const m174 = noComments(read('supabase/migrations/174_backup_hourly_due_and_staleness.sql'));
const d174 = read('supabase/migrations/174_backup_hourly_due_and_staleness_down.sql');
ok(/cron\.schedule\('society-backup-due', '15 \* \* \* \*'/.test(m174), 'the backup runs every hour');
ok(/select command into old_cmd from cron\.job where jobname = 'weekly-society-backup'/.test(m174), 'the new job is built from the old job command (no secret in the repo)');
ok(!/x-backup-secret'\s*,\s*'[A-Za-z0-9]{16,}/.test(read('supabase/migrations/174_backup_hourly_due_and_staleness.sql')), 'no secret value in migration 174');
ok(/raise exception '174: weekly-society-backup command has no body/.test(m174), 'an unexpected cron command stops the migration');
ok(/cron\.unschedule\('weekly-society-backup'\)/.test(m174), 'the weekly all-societies job is removed');
ok(/cron\.schedule\('backup-staleness-daily'/.test(m174), 'the stale-backup alarm is scheduled daily');
ok(/'backup-stale'/.test(m174) && /backup_staleness\(8\)/.test(m174), 'the alarm writes error_log rows for backups older than 8 days');
ok(/a\.after ->> 'trigger' = 'scheduled' and a\.after ->> 'status' is null/.test(m174), 'only successful scheduled backups count (rehearsal rows do not)');
ok(/revoke execute on function public\.backup_staleness\(int\) from public, anon, authenticated/.test(m174)
  && /revoke execute on function public\.log_backup_staleness\(\) from public, anon, authenticated/.test(m174), 'alarm functions are not client-callable');
ok(/cron\.schedule\('weekly-society-backup', '0 2 \* \* 0'/.test(d174) && /drop function if exists public\.log_backup_staleness\(\)/.test(d174), 'down restores the weekly job and drops the alarm');

// ── PAY-02 ──────────────────────────────────────────────────────────────────────────────────────────
const m175 = noComments(read('supabase/migrations/175_salary_one_path_per_month.sql'));
const d175 = read('supabase/migrations/175_salary_one_path_per_month_down.sql');
ok(/before insert or update of month on public\.salary_records/.test(m175), 'trigger guards new slips and month changes');
ok(/r\.state::text in \('approved', 'locked', 'posted', 'paid'\)/.test(m175), 'a run that is (or will be) posted blocks the month');
ok(/exists \(select 1 from public\.salary_records s where s\.id = new\.id\)/.test(m175), 'editing an existing slip is not blocked');
ok(/to_regclass\('pay_calc\.payroll_run'\) is null/.test(m175), 'skipped where the payroll schema is absent');
ok(/revoke execute on function public\._salary_slip_refuse_if_payroll_run\(\) from public, anon, authenticated/.test(m175), 'trigger function is not client-callable');
ok(/drop trigger if exists salary_slip_refuse_if_payroll_run/.test(d175), 'down drops the trigger');

const post = read('supabase/functions/pay-post/index.ts');
const guardAt = post.indexOf("code: 'PAY-POST-SALARY-SLIPS'");
ok(guardAt > 0, 'pay-post refuses a month already booked by salary slips');
ok(guardAt > 0 && guardAt < post.indexOf("'post_voucher', payload"), 'the refusal happens before anything is posted');
ok(/not coalesce\(v\."isDeleted", false\)/.test(post), 'only slips with a live accrual voucher count');

// The Salary page's existing failure path is what undoes the accrual voucher when the trigger refuses.
const dc = read('src/contexts/DataContext.tsx');
const add = dc.slice(dc.indexOf('const addSalaryRecord = useCallback'), dc.indexOf('const updateSalaryRecord = useCallback'));
ok(/supabase\.from\('salary_records'\)\.upsert\(withSoc\(record\)\)/.test(add) && /cancelLinkedVouchers\(\[record\.accrualVoucherId\]/.test(add),
  'a refused slip save cancels its accrual voucher and rolls the slip back (RULE 1)');

console.log(`backup + salary P0 guards: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
