// Analytics metrics (ECR-24). Imports the REAL src/lib/analyticsMetrics.ts via the '@/'
// loader (was a self-contained mirror before) — so this validates the actual code.
// Run: node scripts/test-analytics-metrics.mjs
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

const { fyMonths, monthlySeries, growthPct, momGrowth, topN, ratios, priorFy, fyRange, sumInRange, withCumulative } = await import(abs('../src/lib/analyticsMetrics.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. fyMonths — Apr→Mar ordering, year rollover, keys.
{
  const m = fyMonths('2024-25');
  ok(m.length === 12, 'fyMonths → 12 months');
  ok(m[0].key === '2024-04' && m[0].label === 'Apr', 'first = Apr 2024');
  ok(m[8].key === '2024-12' && m[8].label === 'Dec', '9th = Dec 2024');
  ok(m[9].key === '2025-01' && m[9].label === 'Jan', '10th = Jan 2025 (year rolls over)');
  ok(m[11].key === '2025-03' && m[11].label === 'Mar', 'last = Mar 2025');
  ok(fyMonths('').length === 0 && fyMonths('garbage').length === 0, 'bad FY → empty (no crash)');
}

// 2. monthlySeries — buckets by YYYY-MM, ignores out-of-FY, sums.
{
  const sales = [
    { date: '2024-04-10', amount: 100 }, { date: '2024-04-25', amount: 50 }, // Apr = 150
    { date: '2025-01-05', amount: 200 },                                     // Jan = 200
    { date: '2023-12-31', amount: 999 },                                     // out of FY → ignored
  ];
  const purchases = [{ date: '2024-04-01', amount: 80 }];
  const rows = monthlySeries('2024-25', { sales, purchases });
  ok(rows.length === 12, 'series → 12 rows');
  ok(rows[0].sales === 150 && rows[0].purchases === 80, 'Apr sales 150, purchases 80');
  ok(rows[9].sales === 200, 'Jan sales 200');
  ok(rows.reduce((s, r) => s + r.sales, 0) === 350, 'out-of-FY sale excluded (total 350)');
  ok(rows[1].sales === 0 && rows[1].purchases === 0, 'empty month → 0s');
}

// 3. growthPct — zero-base guard.
ok(growthPct(150, 100) === 50, 'growth 100→150 = +50%');
ok(growthPct(80, 100) === -20, 'growth 100→80 = -20%');
ok(growthPct(100, 0) === 100, 'growth from 0 → +100% (guard)');
ok(growthPct(0, 0) === 0, 'growth 0→0 = 0%');
ok(growthPct(50, -100) === 150, 'negative base uses magnitude: (50−(−100))/100 = +150%');

// 4. momGrowth — last non-zero vs previous month.
{
  const rows = [{ sales: 100 }, { sales: 120 }, { sales: 0 }]; // last non-zero = idx1 (120) vs idx0 (100)
  ok(momGrowth(rows, 'sales') === 20, 'MoM = last-nonzero(120) vs prev(100) = +20%');
  ok(momGrowth([{ sales: 100 }], 'sales') === 0, 'single point → 0');
  ok(momGrowth([{ sales: 0 }, { sales: 0 }], 'sales') === 0, 'all zero → 0');
}

// 5. topN — sorted desc, zero dropped, sliced.
{
  const items = [{ name: 'A', amount: 30 }, { name: 'B', amount: 90 }, { name: 'C', amount: 0 }, { name: 'D', amount: 60 }];
  const t = topN(items, 2);
  ok(t.length === 2 && t[0].name === 'B' && t[1].name === 'D', 'top 2 = B(90), D(60)');
  ok(topN(items, 10).length === 3, 'zero-amount C dropped (3 non-zero)');
}

// 6. ratios — P&L-clean, zero-denominator guard.
{
  const r = ratios({ sales: 1000, grossProfit: 300, totalIncome: 1200, totalExpenses: 900 });
  ok(r.grossMarginPct === 30, 'gross margin 300/1000 = 30%');
  ok(r.surplusMarginPct === 25, 'surplus margin (1200-900)/1200 = 25%');
  ok(r.expenseRatioPct === 75, 'expense ratio 900/1200 = 75%');
  const z = ratios({ sales: 0, grossProfit: 0, totalIncome: 0, totalExpenses: 0 });
  ok(z.grossMarginPct === 0 && z.surplusMarginPct === 0 && z.expenseRatioPct === 0, 'zero denominators → 0 (no NaN)');
}

// 7. priorFy — year decrement + wrap.
ok(priorFy('2024-25') === '2023-24', 'priorFy 2024-25 → 2023-24');
ok(priorFy('2000-01') === '1999-00', 'priorFy 2000-01 → 1999-00 (wrap to 00)');
ok(priorFy('bad') === '', 'priorFy bad → empty');

// 8. fyRange — Apr 1 to Mar 31.
{
  const r = fyRange('2024-25');
  ok(r.start === '2024-04-01' && r.end === '2025-03-31', 'fyRange 2024-25 = 2024-04-01 .. 2025-03-31');
  ok(fyRange('x').start === '', 'fyRange bad → empty');
}

// 9. sumInRange — inclusive bounds, string compare.
{
  const items = [
    { date: '2024-04-01', amount: 10 }, // in (boundary start)
    { date: '2025-03-31', amount: 20 }, // in (boundary end)
    { date: '2024-03-31', amount: 99 }, // before → out
    { date: '2025-04-01', amount: 99 }, // after → out
  ];
  ok(sumInRange(items, '2024-04-01', '2025-03-31') === 30, 'sumInRange includes both boundaries, excludes outside (30)');
  ok(sumInRange(items, '', '2025-03-31') === 0, 'empty bound → 0');
}

// 10. withCumulative — running total with opening.
{
  const rows = [{ label: 'Apr', net: 100 }, { label: 'May', net: -30 }, { label: 'Jun', net: 50 }];
  const out = withCumulative(rows, 'net', 'balance', 1000);
  ok(out[0].balance === 1100 && out[1].balance === 1070 && out[2].balance === 1120, 'cumulative: 1000→1100→1070→1120');
  ok(out[0].label === 'Apr' && out[0].net === 100, 'original fields preserved');
  const noOpen = withCumulative([{ n: 2 }, { n: 3 }], 'n', 'c');
  ok(noOpen[1].c === 5, 'no opening → runs from 0');
}

// 11. YoY via sumInRange over both FYs.
{
  const sales = [{ date: '2024-06-10', amount: 500 }, { date: '2023-06-10', amount: 400 }];
  const cur = sumInRange(sales, ...Object.values(fyRange('2024-25')));
  const prev = sumInRange(sales, ...Object.values(fyRange('2023-24')));
  ok(cur === 500 && prev === 400, 'YoY buckets: current FY 500, prior FY 400');
  ok(growthPct(cur, prev) === 25, 'YoY growth 400→500 = +25%');
}

console.log(`\nAnalytics metrics (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
