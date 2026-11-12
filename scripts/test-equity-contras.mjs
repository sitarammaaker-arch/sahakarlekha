// A Dr balance on the P&L account (a brought-forward deficit) or on an appropriation contra (dividend / rebate /
// education-fund contribution given out) is a DEDUCTION from Reserves & Surplus, never an asset (2026-11-12 chart
// audit, F-08 / F-09). It used to be carried to the asset side: both Balance Sheet totals were overstated by it,
// it printed under Current Assets as "Reserves & Surplus (Dr balances)", and the Audit Schedules — built from the
// same leaves — disagreed with the Balance Sheet page, which nets the deficit.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

await import('./gen-migration-163.mjs');   // registers the '@/…' loader
const imp = (p) => import(new URL('../src/' + p, import.meta.url).href);
const S = await imp('lib/storage.ts');
const B = await imp('lib/balanceSheetLeaves.ts');
const L = await imp('lib/reports/balanceSheetLayout.ts');
const R = await imp('lib/accountRoles.ts');
const F = await imp('lib/funds.ts');
void path; void fileURLToPath;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.01;

const chart = S.fullChartForType('marketing_processing');
const by = (id) => chart.find((a) => a.id === id);
const row = (id, net) => ({ account: by(id), openingDebit: 0, openingCredit: 0, transactionDebit: Math.max(net, 0), transactionCredit: Math.max(-net, 0), netBalance: net });

// ── Which ledgers ────────────────────────────────────────────────────────────────────────────────────────────
ok(['1211', '4406', '5311'].every((id) => R.isAppropriationContra(by(id))), '1211, 4406 and 5311 are appropriation contras');
ok(!R.isAppropriationContra(by('1208')) && R.isSurplusAccount(by('1208')), '1208 is the P&L balance, handled as such');
ok(['1201', '1203', '1102', '2101-01', '3301'].every((id) => !R.isAppropriationContra(by(id))), 'a fund, share capital, a creditor and cash are not');
const dairy = S.fullChartForType('dairy');
ok(R.isAppropriationContra(dairy.find((a) => a.id === '1210')), 'dairy 1210 Patronage Bonus Distribution is one too');

// ── Books: capital 1,00,000 Cr; statutory reserve 50,000 Cr; a brought-forward deficit 8,000 Dr on 1208;
//    education-fund contribution 1,000 Dr and patronage rebate 2,000 Dr given out; cash 1,39,000 Dr. Net profit 0.
const tb = [row('1102', -100000), row('1201', -50000), row('1208', 8000), row('5311', 1000), row('4406', 2000), row('3301', 139000)];
const opts = { closingStockPosted: true, physicalClosingStock: 0, netProfit: 0 };
const lv = B.balanceSheetLeaves(tb, opts, chart);
ok(!lv.assetLeaves.some((b) => ['1208', '5311', '4406'].includes(b.account.id)), 'none of them is on the asset side');
ok(['1208', '5311', '4406'].every((id) => lv.capLiabLeaves.some((b) => b.account.id === id)), 'all three stay on the capital side');
ok(near(lv.totalAssets, 139000) && near(lv.totalLiabilities, 139000), `both totals are the true 1,39,000 (were 1,50,000) — ${lv.totalAssets} / ${lv.totalLiabilities}`);

const layout = L.buildBalanceSheetLayout({ accounts: chart, assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: lv.unpostedStock, netProfit: 0 });
const liabRows = layout.liabilities.sections.flatMap((s) => s.rows);
const assetRows = layout.assets.sections.flatMap((s) => s.rows);
const reserves = layout.liabilities.sections.find((s) => s.rows.some((r) => r.accountId === '1201'));
ok(near(layout.liabilities.total, 139000) && near(layout.assets.total, 139000), `the Balance Sheet page totals agree with the leaves (${layout.liabilities.total} / ${layout.assets.total})`);
ok(!assetRows.some((r) => /Dr balances/.test(r.label)) && !assetRows.some((r) => ['5311', '4406', '1208'].includes(r.accountId)), 'no "Reserves & Surplus (Dr balances)" line under assets any more');
const edu = liabRows.find((r) => r.accountId === '5311'), reb = liabRows.find((r) => r.accountId === '4406');
ok(edu && near(edu.amount, -1000) && /^Less: /.test(edu.label) && edu.tone === 'less' && /^घटाएँ: /.test(edu.labelHi), 'the education-fund contribution is a "Less:" line of Reserves & Surplus (−1,000)');
ok(reb && near(reb.amount, -2000) && /^Less: /.test(reb.label), 'so is the patronage rebate (−2,000)');
ok(reserves.rows.includes(edu) && reserves.rows.includes(reb), 'both sit inside the Reserves & Surplus head');
const pl = liabRows.find((r) => r.key === 'pl');
ok(pl && near(pl.amount, -8000) && /deficit/.test(pl.label), 'the deficit is still the one "Less: Profit & Loss A/c (deficit)" line (−8,000)');
ok(near(reserves.total, 50000 - 1000 - 2000 - 8000), `Reserves & Surplus nets to 39,000 (${reserves.total})`);

// ── What must NOT change ─────────────────────────────────────────────────────────────────────────────────────
// A Cr balance on a contra (1211 credited with a declared dividend) is on the capital side, as before, positive.
const lvCr = B.balanceSheetLeaves([row('1102', -1000), row('1211', -300), row('3301', 1300)], opts, chart);
ok(lvCr.capLiabLeaves.some((b) => b.account.id === '1211') && near(lvCr.totalLiabilities, 1300) && near(lvCr.totalAssets, 1300), 'a Cr balance on 1211 is unchanged');
// Share capital or a creditor gone Dr is NOT a deduction of reserves — it still goes to the asset side, flagged.
const lvOdd = B.balanceSheetLeaves([row('1102', 500), row('2101-01', 200), row('1201', -700)], opts, chart);
ok(lvOdd.assetLeaves.some((b) => b.account.id === '1102') && lvOdd.assetLeaves.some((b) => b.account.id === '2101-01'), 'share capital / a creditor gone Dr still shows on the asset side (a reversed balance to check)');
// With no Dr contra and no deficit the leaves are byte-identical to the old rule.
const plain = [row('1102', -1000), row('1201', -200), row('1208', -50), row('3301', 1250)];
const old = (() => {
  const cap = plain.filter((b) => b.account.type !== 'asset'), ast = plain.filter((b) => b.account.type === 'asset');
  return { assetLeaves: [...ast.filter((b) => b.netBalance >= 0), ...cap.filter((b) => b.netBalance > 0)], capLiabLeaves: cap.filter((b) => b.netBalance <= 0) };
})();
const now = B.balanceSheetLeaves(plain, opts, chart);
ok(JSON.stringify(now.assetLeaves) === JSON.stringify(old.assetLeaves) && JSON.stringify(now.capLiabLeaves) === JSON.stringify(old.capLiabLeaves), 'books without a deficit or a Dr contra give the same leaves as before');
ok(B.balanceSheetTallied(tb, opts), 'the dashboards\' "Balance Sheet tallied" test still passes on the same books');

// ── Fund Register ────────────────────────────────────────────────────────────────────────────────────────────
const funds = chart.filter((a) => F.isFundAccount(a)).map((a) => a.id);
ok(!funds.includes('1211') && !funds.includes('4406') && !funds.includes('5311'), 'the Fund Register no longer lists the appropriation contras as funds');
ok(['1201', '1203', '1205'].every((id) => funds.includes(id)), 'the real funds are still listed');

console.log(`Equity contras: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
