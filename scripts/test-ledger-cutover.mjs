// Cutover gate — flipping the source of truth to the ledger, SAFELY (T-09 / ADR-0001; MR-1; RULE 1).
//
// The one property that must never break: a tenant reads from the LEDGER only when the ledger
// PROVABLY equals the current books (parity) AND the flag is on. So an empty or lagging journal
// can never become the read source — which is why this can be shipped before the journal is
// populated without any risk of a report showing zero.
//
// Run: node scripts/test-ledger-cutover.mjs   (npm run test:ledger-cutover)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ev, pj, cut;
try {
  ev = await import(abs('../src/lib/ledger/event.ts'));
  pj = await import(abs('../src/lib/ledger/projections.ts'));
  cut = await import(abs('../src/lib/ledger/cutover.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the cutover modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildEvent } = ev;
const { projectTrialBalance } = pj;
const { trialBalanceToMap, checkParity, readSource } = cut;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 'u1' };
const line = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const voucher = (id, lines) => buildEvent(
  { eventType: 'voucher.posted', tenantId: 'S', aggregateType: 'voucher', aggregateId: id, sequence: 1, producer: HUMAN, payload: { lines } },
  { eventId: id, occurredAt: '2026-04-01T00:00:00Z' },
);

// The current state-derived report, as a balance map (the live adapter would build this).
const STATE = { '1001': 100000, '4101': -100000 };

// ── 1. PARITY — ledger reproduces state exactly ⇒ empty diff ─────────────────
const ledgerTb = projectTrialBalance([voucher('v1', [line('1001', 'Dr', 100000), line('4101', 'Cr', 100000)])]);
const ledgerMap = trialBalanceToMap(ledgerTb);
const good = checkParity(ledgerMap, STATE);
ok(good.parity && good.differences.length === 0, 'a ledger that reproduces the state report exactly → parity, empty diff');

// A mismatch is caught, with BOTH figures named for reconciliation.
const bad = checkParity({ '1001': 90000, '4101': -100000 }, STATE);
ok(!bad.parity && bad.differences.length === 1, 'a mismatched account → parity FALSE with one difference');
ok(bad.differences[0].accountId === '1001' && bad.differences[0].ledgerMinor === 90000 && bad.differences[0].stateMinor === 100000,
  'the difference names the account and both figures (ledger vs state)');

// An account present in the ledger but missing from state (or vice versa) is a diff vs zero.
ok(!checkParity({ '9999': 1 }, {}).parity, 'a ledger account absent from state fails parity (compared against zero)');
ok(checkParity({}, {}).parity, 'empty vs empty is trivially parity');

// ── 2. READ SOURCE — the gate + rollback (the safety property) ───────────────
ok(readSource({ ledgerFlag: true, parityPassed: true }) === 'ledger', 'flag ON + parity PASSED → read the LEDGER (the flip)');
ok(readSource({ ledgerFlag: true, parityPassed: false }) === 'state', 'flag ON but parity NOT passed → stay on STATE (never flip to an unverified ledger)');
ok(readSource({ ledgerFlag: false, parityPassed: true }) === 'state', 'flag OFF → stay on STATE even if parity passed (instant rollback)');
ok(readSource({ ledgerFlag: false, parityPassed: false }) === 'state', 'default (flag off, unverified) → STATE (the current behaviour)');

// ── 3. THE EMPTY-JOURNAL CASE — why this ships safely NOW ─────────────────────
// The journal is dormant/empty today. Parity of an empty projection against real books fails,
// so readSource stays on STATE — no report can show zero.
const emptyLedgerMap = trialBalanceToMap(projectTrialBalance([]));
const emptyParity = checkParity(emptyLedgerMap, STATE);
ok(!emptyParity.parity, 'an EMPTY journal does not match the real books → parity FALSE');
ok(readSource({ ledgerFlag: true, parityPassed: emptyParity.parity }) === 'state',
  'so even with the flag ON, an empty journal keeps the tenant on STATE — the flip cannot break reports');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'ledger', 'cutover.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `cutover.ts is pure & deterministic (no "${forbidden}")`);
}

console.log(`\nCutover parity gate: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
