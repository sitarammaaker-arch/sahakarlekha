#!/usr/bin/env node
// Payroll → ledger posting stays OFF until the Phase-3 posting service (M0 finding R23).
// CI-safe static + unit checks: each of pay-post / pay-pay / pay-rollback refuses unless
// PAY_LEDGER_POSTING_ENABLED=true, BEFORE any auth or DB work; the UI gate is wired (and ON since R4).
//
// Run: node scripts/test-pay-ledger-gate.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(pathResolve(HERE, '..', rel), 'utf8');
const gate = await import(pathToFileURL(pathResolve(HERE, '../src/lib/payroll/ledgerPostingGate.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

console.log('Server kill-switch');
for (const fn of ['pay-post', 'pay-pay', 'pay-rollback']) {
  const src = read(`supabase/functions/${fn}/index.ts`);
  const at = src.indexOf("Deno.env.get('PAY_LEDGER_POSTING_ENABLED')");
  ok(`${fn}: checks PAY_LEDGER_POSTING_ENABLED`, at > 0);
  ok(`${fn}: only the exact value 'true' enables it`, /\(Deno\.env\.get\('PAY_LEDGER_POSTING_ENABLED'\) \?\? ''\)\.toLowerCase\(\) !== 'true'\)/.test(src));
  ok(`${fn}: refuses with 503 + code PAY_LEDGER_POSTING_DISABLED`, /return json\(503, \{ error: '[^']*बही-posting अभी बंद है[^']*', code: 'PAY_LEDGER_POSTING_DISABLED' \}, CORS\)/.test(src));
  const firstWork = Math.min(...['getUser(', 'postgres(', 'req.json(', 'createClient('].map((k) => src.indexOf(k, src.indexOf('Deno.serve'))).filter((i) => i > 0));
  ok(`${fn}: the check runs before any auth, body or DB work`, at > 0 && at < firstWork);
}

console.log('UI gate');
// R4 (2026-10-06): the UI constant is ON; the server secret is the real switch (checked above: 503 before any auth/DB work).
ok('PAY_LEDGER_POSTING_ENABLED (UI) is true — R4', gate.PAY_LEDGER_POSTING_ENABLED === true);
ok('post / pay / rollback are ledger actions and offered', ['post', 'pay', 'rollback'].every((a) => gate.isLedgerAction(a) && !gate.ledgerPostingBlocked(a)));
ok('verify / approve / lock / cancel are not blocked', ['verify', 'approve', 'lock', 'cancel'].every((a) => !gate.ledgerPostingBlocked(a)));
ok('Hindi-first message', /बही-posting अभी बंद है/.test(gate.LEDGER_POSTING_OFF_HI) && gate.LEDGER_POSTING_OFF_EN.length > 0);

const ui = read('src/pages/Payroll.tsx');
const dt = ui.slice(ui.indexOf('const doTransition = async'), ui.indexOf('setTransitioning(runId);', ui.indexOf('const doTransition = async')));
ok('doTransition refuses a blocked ledger action before invoking any function', /if \(ledgerPostingBlocked\(action\)\)/.test(dt) && /return;/.test(dt));
ok('the next-action button is disabled for a blocked ledger action', /disabled=\{transitioning === r\.run_id \|\| ledgerPostingBlocked\(nextAction\(r\.state\)!\.action\)\}/.test(ui));
ok('the Reverse button is disabled while posting is off', /disabled=\{transitioning === r\.run_id \|\| ledgerPostingBlocked\('rollback'\)\}/.test(ui));
const dtFull = ui.slice(ui.indexOf('const doTransition = async'), ui.indexOf('const nameOf =', ui.indexOf('const doTransition = async')));
ok('after a successful post / pay / reverse the page reloads, so reports show the server books (not stale memory)', /if \(isFinancial\) setTimeout\(\(\) => window\.location\.reload\(\), \d+\)/.test(dtFull));
ok('the reload comes AFTER the error return (a failed action must not reload)', dtFull.indexOf('Action failed') > 0 && dtFull.indexOf('Action failed') < dtFull.indexOf('window.location.reload()'));

console.log(`\nPayroll ledger gate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
