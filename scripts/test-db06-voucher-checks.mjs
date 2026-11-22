// DB-06 (product audit 2026-11-17) · migration 199: CHECK rules on vouchers and voucher_entries.
// PGlite run (scratchpad pg/t199.mjs, 2026-11-22): negative amount, unknown / missing type, unknown approval status,
// non-ISO / missing date, two-sided or negative entry are all refused; valid rows pass; re-run is safe; down drops
// them; a pre-existing bad row makes VALIDATE fail and nothing is left behind.
// This test keeps the migration's allowed values in step with the app's types — a new VoucherType added in src/types
// without a migration would otherwise make every save of that type fail at the database.
// Run: node scripts/test-db06-voucher-checks.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const up = read('supabase/migrations/199_voucher_check_constraints.sql');
const down = read('supabase/migrations/199_voucher_check_constraints_down.sql');
const code = up.replace(/--.*$/gm, '');
const types = read('src/types/index.ts');

const NAMES = ['vouchers_amount_nonneg', 'vouchers_type_known', 'vouchers_approval_status_known', 'vouchers_date_iso', 'voucher_entries_amounts'];

// 1. each rule: dropped-if-exists (re-runnable), added NOT VALID, then validated
for (const n of NAMES) {
  const drop = code.indexOf(`drop constraint if exists ${n};`), add = code.indexOf(`add constraint ${n}\n`), val = code.indexOf(`validate constraint ${n};`);
  ok(drop >= 0 && add > drop && val > add, `${n}: drop-if-exists → add → validate`);
}
ok((code.match(/\) not valid;/g) || []).length === NAMES.length, 'every constraint is added NOT VALID (no long lock), then validated');

// 2. allowed voucher types == the app's VoucherType
const appTypes = (types.match(/export type VoucherType\s*=\s*([^;]+);/)?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
const dbTypes = (code.match(/type is not null and type in \(([^)]+)\)/)?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
ok(appTypes.length === 8 && JSON.stringify(appTypes) === JSON.stringify(dbTypes), `voucher types in 199 match src/types VoucherType (app ${appTypes.join(',')} | db ${dbTypes.join(',')})`);

// 3. approval statuses == the app's
const appStatus = (types.match(/approvalStatus\?:\s*([^;]+);/)?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
const dbStatus = (code.match(/"approvalStatus" in \(([^)]+)\)/)?.[1] ?? '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
ok(appStatus.length === 3 && JSON.stringify(appStatus) === JSON.stringify(dbStatus) && code.includes('"approvalStatus" is null or'), `approval statuses match the app, null allowed (${dbStatus.join(',')})`);

// 4. the shapes
ok(code.includes("check (amount >= 0)"), 'amount may not be negative');
ok(code.includes("date is not null and date ~ '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$'"), "date must be 'YYYY-MM-DD' (reports compare it as text)");
ok(code.includes('check (dr >= 0 and cr >= 0 and not (dr > 0 and cr > 0))'), 'an entry is one-sided and non-negative — the same rule as voucher_lines_amounts');
ok(read('supabase/schema/production-schema.txt').includes('voucher_lines_amounts CHECK (((dr_minor >= 0) AND (cr_minor >= 0) AND (NOT ((dr_minor > 0) AND (cr_minor > 0)))))'), 'voucher_lines already carries that rule in production');

// 5. self-registers; down undoes all five
ok(code.includes("insert into public.app_migrations (version, name) values ('199', 'voucher_check_constraints')"), 'registers itself');
ok(NAMES.every((n) => down.includes(`drop constraint if exists ${n};`)) && down.includes("delete from public.app_migrations where version = '199';"), 'down drops all five and forgets the row');

// 6. the app never writes a voucher date with a time part (the CHECK would refuse it)
ok(!/date:\s*new Date\(\)\.toISOString\(\)\s*[,}]/.test(read('src/contexts/DataContext.tsx')), 'DataContext never stamps a voucher date as a full ISO timestamp');

// 7. a refused save says WHY in Hindi: every constraint has a reason, and the voucher toast runs the message through it
const helper = read('src/lib/vouchers/checkErrors.ts');
const keys = [...helper.matchAll(/^\s{2}([a-z_]+):\s*'/gm)].map((m) => m[1]).sort();
ok(JSON.stringify(keys) === JSON.stringify([...NAMES].sort()), `checkErrors.ts has a Hindi reason for exactly the five constraints (${keys.join(',')})`);
ok(helper.includes('if (!/check constraint/i.test(s)) return s;'), 'any other error text passes through unchanged');
const dc = read('src/contexts/DataContext.tsx');
const toastAt = dc.indexOf('const toastVoucherNotSaved = (msg: string) =>');
ok(toastAt > 0 && dc.slice(toastAt, toastAt + 600).split('voucherCheckErrorText(msg)').length === 3, 'toastVoucherNotSaved shows voucherCheckErrorText(msg) in both languages');

console.log(`DB-06 voucher checks (199): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
