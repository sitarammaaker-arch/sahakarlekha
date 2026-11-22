// DB-02 (product audit 2026-11-17): vouchers, members, voucher_entries … have a single-column text primary key, so an
// id is unique across ALL societies. That is safe only while every id is unguessable and collision-free:
//   • read-only prod 2026-11-22: of 98 such tables, every id is a UUID or built from UUIDs (vouchers 'payrun-<uuid>-…',
//     voucher_entries '<uuid>-<uuid>', voucher_lines '<uuid>-<uuid>-dr', society_activities '<uuid>:<activity>') —
//     except hsn_master, whose ids were `hsn_${Date.now()}`: two societies saving in the same millisecond collide and
//     the second save fails (KCC / Budget / Election / E-Way Bill used the same pattern; a KCC collision would leave
//     the disbursement voucher posted with no loan).
//   • restore (178 restore_commit) already refuses a row that belongs to another society (restore:foreign_row).
// So the composite-key rewrite is not needed; the rule is: a row id that reaches the database is crypto-random.
// This test holds the client to it.
// Run: node scripts/test-db02-unguessable-ids.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) files.push(p); } };
walk(join(ROOT, 'src'));

// 1. no id built from the clock or Math.random
const TIME_ID = /\b(id|Id)\s*[:=]\s*`[^`]*\$\{\s*(Date\.now\(\)|Math\.random\(\))/;
const RANDOM_ID = /\b(id|Id)\s*[:=]\s*(String\()?(Date\.now\(\)|Math\.random\(\))/;
const offenders = [];
for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (TIME_ID.test(l) || RANDOM_ID.test(l)) offenders.push(`${relative(ROOT, f)}:${i + 1}`); });
ok(offenders.length === 0, `no row id is built from Date.now() / Math.random() — use crypto.randomUUID() (${offenders.join(', ')})`);

// 2. the five pages that had it now use crypto.randomUUID
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
for (const [rel, prefix] of [['src/pages/HsnMaster.tsx', 'hsn_'], ['src/pages/HsnMaster.tsx', 'hsn_seed_'], ['src/pages/BudgetModule.tsx', 'bgt_'], ['src/pages/ElectionModule.tsx', 'elec_'], ['src/pages/EWayBill.tsx', 'ewb_'], ['src/pages/KccLoan.tsx', 'kcc_']]) {
  ok(read(rel).includes('`' + prefix + '${crypto.randomUUID()}`'), `${rel}: ${prefix} id is crypto-random`);
}

// 3. the legacy-auth temporary password is crypto-random too (it is discarded for a reset, but must not be guessable)
const auth = read('src/contexts/AuthContext.tsx');
ok(auth.includes('`Temp_${crypto.randomUUID()}`') && !/tempPassword\s*=\s*`[^`]*Math\.random/.test(auth), 'temp password uses crypto.randomUUID, not Math.random');

// 4. restore still refuses another society's row (the other half of why single-column keys are safe)
ok(read('supabase/migrations/178_restore_commit_server.sql').includes('restore:foreign_row'), '178 restore_commit refuses a row that belongs to another society');

console.log(`DB-02 unguessable ids: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
