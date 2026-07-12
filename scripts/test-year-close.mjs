// Year-end close & opening balances (T-22 / TASK4.2 §7/§18; CL-1/CL-2; RULE 6).
//
// Proves the FY lifecycle on the ledger:
//   • the closing trial balance is the projection as-of FY-end (audited closing);
//   • nominal accounts close to the net result (income − expense), real accounts carry forward;
//   • the opening balances BALANCE (Σ Dr === Σ Cr) — opening = prior audited closing, DERIVED;
//   • a prior-period adjustment is a NEW event — the closed year's as-of closing is immutable (CL-2).
//
// Run: node scripts/test-year-close.mjs   (npm run test:year-close)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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

let yc, ev, pj, money;
try {
  yc = await import(abs('../src/lib/rules/yearClose.ts'));
  ev = await import(abs('../src/lib/ledger/event.ts'));
  pj = await import(abs('../src/lib/ledger/projections.ts'));
  money = await import(abs('../src/lib/money.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the year-close modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { computeYearClose, openingBalanceLines } = yc;
const { buildEvent } = ev;
const { projectTrialBalance } = pj;
const { toMinor, sumMinor } = money;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 'u1' };
const line = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const voucher = (id, seq, at, lines) => buildEvent(
  { eventType: 'voucher.posted', tenantId: 'S', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines } },
  { eventId: id, occurredAt: at },
);

// Accounts: CASH (real/asset), RESERVE (real/equity, the carry-forward), SALES (nominal/income),
// EXPENSE (nominal/expense).
const NATURE = { CASH: 'real', RESERVE: 'real', SALES: 'nominal', EXPENSE: 'nominal' };
const natureOf = (a) => NATURE[a] ?? 'real';

// FY25-26: cash sale ₹1000, then expense ₹600 → surplus ₹400.
const fy26 = [
  voucher('v1', 1, '2025-06-01T00:00:00Z', [line('CASH', 'Dr', toMinor(1000)), line('SALES', 'Cr', toMinor(1000))]),
  voucher('v2', 2, '2025-08-01T00:00:00Z', [line('EXPENSE', 'Dr', toMinor(600)), line('CASH', 'Cr', toMinor(600))]),
];
const FY_END = '2026-03-31T23:59:59Z';

const close = computeYearClose(fy26, FY_END, natureOf, 'RESERVE');

// ── 1. NET RESULT = income − expense ─────────────────────────────────────────
ok(close.netResultMinor === toMinor(400), 'net result = ₹1000 income − ₹600 expense = ₹400 surplus');

// ── 2. NOMINAL close, REAL carry, OPENING BALANCES ───────────────────────────
ok(close.openingBalances.SALES === undefined && close.openingBalances.EXPENSE === undefined,
  'nominal accounts (Sales, Expense) do NOT carry forward — they close to the net result');
ok(close.openingBalances.CASH === toMinor(400), 'CASH carries forward at its closing net (+₹400)');
ok(close.openingBalances.RESERVE === -toMinor(400), 'the ₹400 surplus is carried to RESERVE (retained earnings, Cr)');

// ── 3. OPENING BALANCES BALANCE (CL-1) ───────────────────────────────────────
const openingTotal = Object.values(close.openingBalances).reduce((s, n) => s + n, 0);
ok(openingTotal === 0, 'the opening balances sum to zero (Dr = Cr) — a balanced opening');

const legs = openingBalanceLines(close.openingBalances);
const dr = sumMinor(legs.filter((l) => l.drCr === 'Dr').map((l) => l.amountMinor));
const cr = sumMinor(legs.filter((l) => l.drCr === 'Cr').map((l) => l.amountMinor));
ok(dr === cr && dr === toMinor(400), 'the opening-balance legs are balanced (Σ Dr === Σ Cr === ₹400)');

// ── 4. OPENING = PRIOR AUDITED CLOSING (derived, reproducible) ───────────────
// Post the opening as the FY26-27 genesis event; its trial balance reproduces the carried set.
const opening = buildEvent(
  { eventType: 'opening.posted', tenantId: 'S', aggregateType: 'opening', aggregateId: 'FY27', sequence: 1, producer: HUMAN, payload: { lines: legs } },
  { eventId: 'open27', occurredAt: '2026-04-01T00:00:00Z' },
);
const openTb = projectTrialBalance([opening]);
ok(openTb.balanced, 'the FY27 opening posts as a balanced event');
ok(openTb.lines.find((l) => l.accountId === 'CASH').netMinor === toMinor(400), 'opening CASH equals the prior FY closing (₹400) — no manual override');
ok(JSON.stringify(computeYearClose(fy26, FY_END, natureOf, 'RESERVE')) === JSON.stringify(close), 'the close is deterministic / reproducible');

// ── 5. PRIOR-PERIOD ADJUSTMENT — closed year is immutable (CL-2) ─────────────
// An adjustment discovered AFTER close is a NEW event dated in the next year. The FY26 closing
// (as-of FY_END) is UNCHANGED; the adjustment flows into the current year.
const adjustment = voucher('adj1', 1, '2026-05-01T00:00:00Z', [line('CASH', 'Dr', toMinor(50)), line('RESERVE', 'Cr', toMinor(50))]);
const closingAfterAdj = projectTrialBalance([...fy26, adjustment], FY_END);
ok(closingAfterAdj.lines.find((l) => l.accountId === 'CASH').netMinor === toMinor(400),
  'the FY26 as-of closing is UNCHANGED by a later adjustment — the closed year is immutable (CL-2)');
const currentYear = projectTrialBalance([...fy26, adjustment]); // no cutoff → includes the adjustment
ok(currentYear.lines.find((l) => l.accountId === 'CASH').netMinor === toMinor(450),
  'the prior-period adjustment flows forward into the current year (as a new event, not a mutation)');

console.log(`\nYear-end close & opening balances: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
