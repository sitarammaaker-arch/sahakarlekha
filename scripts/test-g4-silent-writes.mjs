#!/usr/bin/env node
// G4 / RULE 1 · no Supabase write in the data contexts may fail with a console line only.
// A write handler of the shape `.then(({ error }) => { if (error) console.warn(...); })` is the
// forbidden "silent console.warn" pattern: the failure never reaches the user or the operator.
// Partial (step-2) writes must at least reportError; base writes must also roll back + toast.
// Run: node scripts/test-g4-silent-writes.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const SILENT = /\.then\(\(\{ error(?:: (\w+))? \}\) => \{\s*if \((\w+)\) console\.(warn|error)\([^;]*\);\s*\}\)/g;
const ctxDir = resolve(root, 'src/contexts');
for (const f of readdirSync(ctxDir).filter(n => n.endsWith('.tsx'))) {
  const s = readFileSync(resolve(ctxDir, f), 'utf8');
  const hits = [...s.matchAll(SILENT)].map(m => s.slice(0, m.index).split('\n').length);
  ok(`${f}: no console-only write failure handlers${hits.length ? ' (lines ' + hits.join(', ') + ')' : ''}`, hits.length === 0);
}

const dc = readFileSync(resolve(ctxDir, 'DataContext.tsx'), 'utf8');
// DEP-01 (2026-11-17): a failed passbook write now undoes the WHOLE movement through makeDepositUndo, which removes
// the line (screen + cloud), cancels the voucher, restores the balance and shows the destructive toast.
const dep = [...dc.matchAll(/supabase\.from\('deposit_transactions'\)\.upsert\(withSoc\(txn\)\)[\s\S]{0,400}?leg\.undo\('passbook', error\.message\)/g)].map(m => m[0]);
const undoFn = dc.slice(dc.indexOf('const makeDepositUndo = '), dc.indexOf('const postDepositLeg = '));
ok('both deposit passbook writes roll back + report + toast', dep.length === 2 && dep.every(b => /reportError\('deposit-txn-save'/.test(b))
  && /setDepositTransactionsState\(prev => prev\.filter/.test(undoFn) && /variant: 'destructive'/.test(undoFn));
const ctrl = dc.slice(dc.indexOf("supabase.from('accounts').upsert(withSoc(control))"), dc.indexOf("supabase.from('accounts').upsert(withSoc(control))") + 1000);
ok('inter-branch control account write rolls back + reports + toasts', /setAccountsState\(prev => prev\.filter/.test(ctrl) && /reportError\('control-account-save'/.test(ctrl) && /destructive/.test(ctrl));
const audit = readFileSync(resolve(root, 'src/lib/auditLog.ts'), 'utf8');
ok('audit-trail write failures are reported off-device', (audit.match(/reportAuditFailure\(/g) || []).length === 3 && /m\.reportError\('audit-write'/.test(audit));

console.log(`\nG4 silent writes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
