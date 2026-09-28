#!/usr/bin/env node
// M1 apply pre-flight · gate logic + the SQL stays read-only. CI-safe (no DB).
// Run: node scripts/test-m1-apply-preflight.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { evaluateGates, preflightSql } = await import(pathToFileURL(pathResolve(HERE, 'm1-apply-preflight.mjs')).href);
const { assertReadOnlySql } = await import(pathToFileURL(pathResolve(HERE, 'rm02-diagnostics.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const clean = {
  loop_after_rm01: 0, joining_receipts_after_rm01: 4, loop_sample: null,
  has_app_migrations: false, has_financial_years: false, has_account_roles: false, has_account_reclass_log: false, has_report_class: false,
  accounts_pk: 'PRIMARY KEY (id, society_id)', btree_gist_available: true, settings_dup_societies: 0,
  reclass_rows: 12, reclass_rows_with_opening: 0, fy_label_issues: [],
};
const gate = (r, id) => evaluateGates(r).gates.find((g) => g.id === id);

console.log('Gates');
ok('clean production → GO', evaluateGates(clean).go);
ok('a load-loop voucher after RM-01 → NO-GO (G1)', !evaluateGates({ ...clean, loop_after_rm01: 1, loop_sample: 'RV/1' }).go && !gate({ ...clean, loop_after_rm01: 1 }, 'G1').ok);
ok('legitimate joining receipts alone do not fail G1', gate({ ...clean, joining_receipts_after_rm01: 40 }, 'G1').ok);
ok('any 072–075 object already present → NO-GO (G2), named', !evaluateGates({ ...clean, has_financial_years: true }).go && /has_financial_years/.test(gate({ ...clean, has_financial_years: true }, 'G2').detail));
ok('accounts PK on id alone → NO-GO (G3)', !evaluateGates({ ...clean, accounts_pk: 'PRIMARY KEY (id)' }).go);
ok('btree_gist missing → NO-GO (G4)', !evaluateGates({ ...clean, btree_gist_available: false }).go);
ok('duplicate settings rows → NO-GO (G4)', !evaluateGates({ ...clean, settings_dup_societies: 1 }).go);
ok('a 4406/4407 row with an opening balance → NO-GO (G5, 075 would abort)', !evaluateGates({ ...clean, reclass_rows_with_opening: 1 }).go);
const warn = evaluateGates({ ...clean, fy_label_issues: [{ society: 'X', fy: '2021-22', prev: null, last_voucher: '2026-07-09' }] });
ok('FY label issues only WARN (G6) — still GO', warn.go && !warn.gates.find((g) => g.id === 'G6').ok && /X: 2021-22/.test(warn.gates.find((g) => g.id === 'G6').detail));
ok('fy_label_issues as a JSON string is accepted', evaluateGates({ ...clean, fy_label_issues: '[]' }).go);

console.log('SQL');
let ro = true; try { assertReadOnlySql(preflightSql()); } catch (e) { ro = false; console.log('    ', e.message); }
ok('preflight SQL passes the read-only guard', ro);
ok('RM-01 cut-off is injectable and quoted', preflightSql("2026-10-01 00:00:00").includes("'2026-10-01 00:00:00'"));
ok('G1 separates loop vouchers from joining receipts by the member\'s createdAt', /vca > mca \+ interval '10 minutes'/.test(preflightSql()));

console.log(`\nM1 apply pre-flight: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
