// Report comparatives (ECR-19). Imports the REAL src/lib/reportComparative.ts via the '@/'
// loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-report-comparative.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { comparative, buildComparativeMap, isEmptyPeriod, deltaProfitLoss, isEmptyPL } = await import(abs('../src/lib/reportComparative.ts'));

const r2 = (n) => Math.round(n * 100) / 100; // test-only fixture helper (used by an assertion)

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Growth: 120 vs 100 → +20, +20%.
let x = comparative(120, 100);
ok(x.variance === 20 && x.variancePct === 20, 'growth: +20 / +20%');

// 2. Decline: 80 vs 100 → -20, -20%.
x = comparative(80, 100);
ok(x.variance === -20 && x.variancePct === -20, 'decline: -20 / -20%');

// 3. Prior 0, current > 0 → variance = current, pct = null (undefined %).
x = comparative(50, 0);
ok(x.variance === 50 && x.variancePct === null, 'from-zero: pct undefined');

// 4. Both 0 → 0 variance, 0%.
x = comparative(0, 0);
ok(x.variance === 0 && x.variancePct === 0, 'both zero → 0 / 0%');

// 5. Negative prior (net credit): -100 → -50 → variance +50, pct uses |prior|.
x = comparative(-50, -100);
ok(x.variance === 50 && x.variancePct === 50, 'negative prior uses |prior| for %');

// 6. Rounding to 2dp.
x = comparative(100.005, 33.331);
ok(x.variance === r2(100.005 - 33.331), 'variance rounded to paise');

// 7. buildComparativeMap unions keys, missing side = 0.
const m = buildComparativeMap({ a: 100, b: 50 }, { a: 80, c: 30 });
ok(m.a.variance === 20 && m.b.prior === 0 && m.b.variance === 50 && m.c.current === 0 && m.c.variance === -30, 'map unions keys, missing = 0');

// 8. isEmptyPeriod: all-zero (or near-zero) → true; any real figure → false.
ok(isEmptyPeriod({ a: 0, b: 0.004 }) === true, 'empty period detected');
ok(isEmptyPeriod({ a: 0, b: 100 }) === false, 'non-empty period detected');
ok(isEmptyPeriod({}) === true, 'empty map → empty period');

// 9. Balance-sheet prior-column gating: a non-empty computed prior is used; an
//    all-zero computed prior falls back to the saved snapshot (mirrors the page).
const priorComputed = { '3301': 50000, '1102': -50000 };
const snapshot = { '1102': -40000 };
ok((!isEmptyPeriod(priorComputed) ? priorComputed : snapshot) === priorComputed, 'non-empty computed prior is used');
ok((!isEmptyPeriod({ '3301': 0, '1102': 0 }) ? { x: 1 } : snapshot) === snapshot, 'empty computed prior → snapshot fallback');

// ── deltaProfitLoss: prior-FY P&L = cumulative(end) − cumulative(start) ──────

// 10. Prior-FY P&L isolated as the delta of two cumulative statements.
const plEnd   = { incomeItems: [{ name: 'Sales', nameHi: 'बिक्री', amount: 100 }, { name: 'Interest', nameHi: 'ब्याज', amount: 20 }], expenseItems: [{ name: 'Rent', nameHi: 'किराया', amount: 30 }], totalIncome: 120, totalExpenses: 30, netProfit: 90 };
const plStart = { incomeItems: [{ name: 'Sales', nameHi: 'बिक्री', amount: 40 }], expenseItems: [{ name: 'Rent', nameHi: 'किराया', amount: 10 }], totalIncome: 40, totalExpenses: 10, netProfit: 30 };
const d = deltaProfitLoss(plEnd, plStart);
ok(d.totalIncome === 80 && d.totalExpenses === 20 && d.netProfit === 60, 'period P&L = 120−40 income, 30−10 exp, netProfit 60');
ok(d.incomeItems.find(i => i.name === 'Sales').amount === 60, 'Sales flow this period = 100 − 40 = 60');
ok(d.incomeItems.find(i => i.name === 'Interest').amount === 20, 'a head only in end period keeps its full amount');
ok(d.incomeItems.find(i => i.name === 'Interest').nameHi === 'ब्याज', 'nameHi preserved');

// 11. A head that only existed in the earlier cumulative → negative (reversed/closed) is dropped if it nets to itself.
const d2 = deltaProfitLoss({ incomeItems: [], expenseItems: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 }, { incomeItems: [{ name: 'X', nameHi: 'X', amount: 50 }], expenseItems: [], totalIncome: 50, totalExpenses: 0, netProfit: 50 });
ok(d2.incomeItems.find(i => i.name === 'X').amount === -50, 'head present only in start → −50 (net reduction)');
ok(d2.totalIncome === -50, 'delta totals go negative correctly');

// 12. isEmptyPL gating.
ok(isEmptyPL({ incomeItems: [], expenseItems: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 }) === true, 'empty P&L detected → snapshot fallback');
ok(isEmptyPL(plEnd) === false, 'non-empty P&L detected');

console.log(`\nReport comparative (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
