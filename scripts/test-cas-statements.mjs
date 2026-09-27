// NABARD CAS statements (Annexure II / III / IV) — a reporting layer that must NEVER drop or
// double-count a rupee: CAS Balance Sheet balances and ties to the app's Balance Sheet (after the
// CAS presentation moves), CAS P&L net profit = the app's net profit, CAS Trading gross profit =
// sales + closing − opening − purchases. Random books, the real PACS chart.
// Run: node scripts/test-cas-statements.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const C = await imp('src/lib/cas/pacsCas.ts');
const { balanceSheetLeaves } = await imp('src/lib/balanceSheetLeaves.ts');
const S = await imp('src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const near = (a, b) => Math.abs(a - b) < 0.011;
const r2 = (n) => Math.round(n * 100) / 100;

const { accounts } = S.migrateAccounts(S.SOCIETY_TEMPLATES.pacs.map((a) => ({ ...a })));
const leaves = accounts.filter((a) => !a.isGroup);

// ── 1. Mapping integrity ──
for (const defs of [[C.CAS_BS_LIABILITIES, C.CAS_BS_ASSETS], [C.CAS_PL_EXPENDITURE, C.CAS_PL_INCOME], [C.CAS_TRADING_DR, C.CAS_TRADING_CR]]) {
  const ids = defs.flat().flatMap((s) => s.lines).flatMap((l) => l.ids ?? []);
  ok(ids.length === new Set(ids).size, `no head mapped to two lines (${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ') || 'none'})`);
}
for (const side of [C.CAS_BS_LIABILITIES, C.CAS_BS_ASSETS, C.CAS_PL_EXPENDITURE, C.CAS_PL_INCOME, C.CAS_TRADING_DR, C.CAS_TRADING_CR]) {
  ok(side.flatMap((s) => s.lines).filter((l) => l.catchAll).length === 1, 'each side has exactly one "Others" catch-all');
}
const bsIds = new Set([...C.CAS_BS_LIABILITIES, ...C.CAS_BS_ASSETS].flatMap((s) => s.lines).flatMap((l) => l.ids ?? []));
for (const id of ['1101', '1102', '1201', '1202', '2104', '2101', '2107', '2108', '2304', '2305', '3301', '3302', '3303', '3304', '3305', '3104', '3110', '3205', '3207', '3208', '3307', '3311']) ok(bsIds.has(id), `PACS head ${id} maps to its CAS line`);

// ── 2. Random books on the real PACS chart ──
let seed = 17; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const TB = (bal) => leaves.map((a) => ({ account: a, netBalance: bal[a.id] ?? 0 }));
const randomBooks = () => {
  const bal = {};
  for (const a of leaves) {
    if (rnd() < 0.45) continue;
    const mag = Math.round(rnd() * 5e6) / 100;
    const normalDr = a.type === 'asset' || a.type === 'expense';
    let v = normalDr ? mag : -mag;
    if (rnd() < 0.06) v = -v;                                  // abnormal balance (sign reclass path)
    bal[a.id] = v;
  }
  const plug = r2(-Object.values(bal).reduce((t, v) => t + v, 0));   // balance the TB through cash
  bal['3301'] = r2((bal['3301'] ?? 0) + plug);
  return bal;
};
let bsBad = 0, plBad = 0, trBad = 0, tieBad = 0, bsChecked = 0;
for (let t = 0; t < 400; t++) {
  const bal = randomBooks();
  const tb = TB(bal);
  const hasTrading = rnd() < 0.7;
  const gp = hasTrading ? r2(rnd() * 20000 - 5000) : 0;
  // The app's own P&L formula (DataContext.getProfitLoss), replicated for the tie.
  const inc = tb.filter((b) => b.account.type === 'income' && (!hasTrading || b.account.parentId !== '4100')).reduce((s, b) => s - b.netBalance, 0);
  const exp = tb.filter((b) => b.account.type === 'expense' && (!hasTrading || b.account.parentId !== '5100')).reduce((s, b) => s + b.netBalance, 0);
  const appNet = r2(inc - exp + gp);
  const pl = C.buildCasProfitLoss(tb, { hasTrading, grossProfit: gp });
  if (!near(pl.netProfit, appNet)) plBad++;
  const plTotalExp = pl.expenditure.reduce((s, x) => s + x.total, 0);
  if (!near(plTotalExp, pl.total)) plBad++;                     // both sides of Annexure III equal

  // Balance Sheet: net profit that makes the sheet balance is −Σ(income+expense) (no stock here).
  const npForBs = r2(-tb.filter((b) => b.account.type === 'income' || b.account.type === 'expense').reduce((s, b) => s + b.netBalance, 0));
  const lv = balanceSheetLeaves(tb, { closingStockPosted: true, physicalClosingStock: 0, netProfit: npForBs });
  if (!near(lv.totalAssets, lv.totalLiabilities)) { bsBad++; continue; }  // the generator must give a balanced app sheet
  bsChecked++;
  const overdue = r2(rnd() * 3000);
  const bs = C.buildCasBalanceSheet({ assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: 0, netProfit: npForBs, overdueInterestReceivable: overdue });
  if (!near(bs.totalAssets, bs.totalLiabilities)) bsBad++;
  if (!C.casBalanceSheetTies(bs, lv)) tieBad++;
  const rows = bs.assets.flatMap((s) => s.rows);
  const rec = r2((bal['3313'] > 0 ? bal['3313'] : 0) + (bal['3312'] > 0 ? bal['3312'] : 0));
  const od = rows.find((r) => r.id === 'A8-1a-iii').amount, std = rows.find((r) => r.id === 'A8-1a-i').amount;
  if (!near(od + std, rec) || od > rec + 0.01 || od < -0.001) bsBad++;
  const oirRow = rows.find((r) => r.id === 'A8-1b').amount;
  if (!near(oirRow, -(bal['2211'] < 0 ? -bal['2211'] : 0))) bsBad++;

  // Trading
  const op = r2(rnd() * 10000), cl = r2(rnd() * 10000);
  const tr = C.buildCasTrading(tb, { openingStock: op, closingStock: cl });
  const sales = tb.filter((b) => b.account.parentId === '4100').reduce((s, b) => s - b.netBalance, 0);
  const purch = tb.filter((b) => b.account.parentId === '5100' && b.account.id !== '5150').reduce((s, b) => s + b.netBalance, 0);
  if (!near(tr.grossProfit, r2(sales + cl - op - purch))) trBad++;
  if (!near(tr.debit.reduce((s, x) => s + x.total, 0), tr.total)) trBad++;
}
ok(bsChecked === 400, `every random book reached the Balance Sheet checks (${bsChecked}/400)`);
ok(bsBad === 0, `400 random books: CAS Balance Sheet balances; receivable split + OIR presentation exact (${bsBad} bad)`);
ok(tieBad === 0, `400 random books: CAS Balance Sheet ties to the app's (${tieBad} bad)`);
ok(plBad === 0, `400 random books: CAS P&L net profit = app net profit; both sides equal (${plBad} bad)`);
ok(trBad === 0, `400 random books: CAS Trading gross profit exact; both sides equal (${trBad} bad)`);

// ── 3. Presentation specifics ──
{
  const bal = { '1102': -50000, '2211': -1200, '3313': 3000, '3301': 48200 };
  const tb = TB(bal);
  const lv = balanceSheetLeaves(tb, { closingStockPosted: true, physicalClosingStock: 0, netProfit: 0 });
  const bs = C.buildCasBalanceSheet({ ...lv, unpostedStock: 0, netProfit: 0, overdueInterestReceivable: 1000 });
  const rows = bs.assets.flatMap((s) => s.rows);
  ok(rows.find((r) => r.id === 'A8-1a-iii').amount === 1000 && rows.find((r) => r.id === 'A8-1a-i').amount === 2000, '3313 split: overdue 1000 / standard 2000');
  ok(rows.find((r) => r.id === 'A8-1b').amount === -1200 && bs.overdueInterestProvision === 1200, 'OIR (2211) shown as Less: on the asset side (D2)');
  ok(!bs.liabilities.flatMap((s) => s.rows).some((r) => r.heads.some((h) => h.id === '2211')), 'OIR not on the liability side');
  ok(bs.totalAssets === 50000 && bs.totalLiabilities === 50000, 'sheet balances at 50,000 (51,200 − 1,200)');
  const capped = C.buildCasBalanceSheet({ ...lv, unpostedStock: 0, netProfit: 0, overdueInterestReceivable: 9999 });
  ok(capped.assets.flatMap((s) => s.rows).find((r) => r.id === 'A8-1a-iii').amount === 3000, 'overdue receivable never exceeds the 3313 balance');
}
{
  const tb = TB({ '1102': -1000, '9999': -300, '3301': 1300 });   // 9999 Suspense has no CAS line
  const lv = balanceSheetLeaves(tb, { closingStockPosted: true, physicalClosingStock: 0, netProfit: 0 });
  const bs = C.buildCasBalanceSheet({ ...lv, unpostedStock: 0, netProfit: 0, overdueInterestReceivable: 0 });
  const others = bs.liabilities.flatMap((s) => s.rows).find((r) => r.id === 'L7v');
  ok(others.heads.some((h) => h.id === '9999') && others.amount === 300, 'an unmapped head lands in "Others" and is listed — never dropped');
}
{
  const tb = TB({ '1102': -1000, '1208': 400, '3301': 600 });      // accumulated loss
  const lv = balanceSheetLeaves(tb, { closingStockPosted: true, physicalClosingStock: 0, netProfit: 0 });
  const bs = C.buildCasBalanceSheet({ ...lv, unpostedStock: 0, netProfit: 0, overdueInterestReceivable: 0 });
  ok(bs.assets.flatMap((s) => s.rows).find((r) => r.id === 'A8-11').amount === 400 && bs.liabilities.flatMap((s) => s.rows).find((r) => r.id === 'L3').amount === 0, 'a loss shows as "P&L (if balance is loss)" on the asset side');
  ok(bs.totalAssets === 1000 && bs.totalLiabilities === 1000 && C.casBalanceSheetTies(bs, lv), 'loss case balances and ties');
}

// ── 3b. Annexure I — Trial Balance (monthly) ──
{
  let bad = 0, rowsBad = 0;
  for (let t = 0; t < 200; t++) {
    const open = randomBooks();                        // balances before the month
    const mv = {};                                     // balanced month movements
    for (const a of leaves) if (rnd() < 0.3) mv[a.id] = { dr: r2(rnd() * 5000), cr: r2(rnd() * 5000) };
    const drT = Object.values(mv).reduce((s, m) => s + m.dr, 0), crT = Object.values(mv).reduce((s, m) => s + m.cr, 0);
    mv['3301'] = { dr: r2((mv['3301']?.dr ?? 0) + Math.max(0, crT - drT)), cr: r2((mv['3301']?.cr ?? 0) + Math.max(0, drT - crT)) };
    const base = { transactionDebit: 0, transactionCredit: 0 };
    const prevTb = leaves.map((a) => ({ account: a, openingDebit: 0, openingCredit: 0, ...base, netBalance: open[a.id] ?? 0 }));
    const endTb = leaves.map((a) => { const m = mv[a.id] ?? { dr: 0, cr: 0 }; return { account: a, openingDebit: 0, openingCredit: 0, transactionDebit: m.dr, transactionCredit: m.cr, netBalance: r2((open[a.id] ?? 0) + m.dr - m.cr) }; });
    const tb = C.buildCasTrialBalance(endTb, prevTb, { hasTrading: rnd() < 0.5 });
    if (!near(tb.totals.liabilitiesIncome, tb.totals.assetsExpenditure)) bad++;
    // every row's closing = the natural closing of its heads
    for (const [side, cred] of [[tb.liabilitiesIncome, true], [tb.assetsExpenditure, false]]) for (const r of side) {
      const want = r.heads.reduce((s, h) => s + (cred ? -1 : 1) * (endTb.find((b) => b.account.id === h.id).netBalance), 0);
      if (!near(r.closing, want)) rowsBad++;
    }
  }
  ok(bad === 0, `200 random months: CAS Trial Balance — both sides equal (${bad} bad)`);
  ok(rowsBad === 0, `every TB row: opening ± month movement = its heads' closing (${rowsBad} bad)`);
  const lines = C.buildCasTrialBalance(
    [{ account: leaves.find((a) => a.id === '2211'), openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 500, netBalance: -500 },
     { account: leaves.find((a) => a.id === '3313'), openingDebit: 0, openingCredit: 0, transactionDebit: 500, transactionCredit: 0, netBalance: 500 }],
    [], { hasTrading: true });
  ok(lines.liabilitiesIncome[0].id === 'TB-OIR' && lines.liabilitiesIncome[0].closing === 500 && lines.assetsExpenditure[0].id === 'TB-INT', 'OIR and interest receivable keep their own CAS GL lines in the TB');
}

// ── 3b. Rania shape (prod, 2026-09): wheat procured straight into stock (Dr 3400 / Cr party) ──
{
  // Sales 8,100 less Sales Return 2,700 (a head under 4100); Non-PDS purchases 10,656; wheat
  // 2,94,200 procured to stock and still unsold (= closing stock). App GP = 5,400 + 2,94,200
  // − 10,656 − 2,94,200 = −5,256. Without the procured line CAS showed +2,88,944.
  const tb = TB({ '4101': -8100, '5112': 10656 });
  const ret = { account: { id: 'SR-UUID', name: 'Sales Return', type: 'income', parentId: '4100', isGroup: false }, netBalance: 2700 };
  const t = C.buildCasTrading([...tb, ret], { openingStock: 0, closingStock: 294200, procuredToStock: 294200 });
  ok(near(t.grossProfit, -5256), `procured-to-stock goods are a Trading purchase: GP −5,256 (${t.grossProfit})`);
  ok(near(t.debit.reduce((x, s) => x + s.total, 0), t.total), 'Trading both sides equal with a gross loss');
  ok(t.debit.flatMap((s) => s.rows).find((r) => r.id === 'TD2p').amount === 294200, 'procured goods on their own CAS purchase line');
  const legacy = C.buildCasTrading(TB({ '4101': -1000, '5101': 100 }), { openingStock: 0, closingStock: 300, purchaseGrossUp: 300 });
  ok(near(legacy.grossProfit, 1000 + 300 - 400) && legacy.debit.flatMap((s) => s.rows).find((r) => r.id === 'TD2x').amount === 400, 'LEGACY closing journal: 5101 shown gross (net + gross-up)');
}

// ── 4. Wiring ──
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
ok(/balanceSheetLeaves\(trialBalance, \{ closingStockPosted, physicalClosingStock, netProfit \}\)/.test(read('src/pages/BalanceSheet.tsx')) && !/const typeAssetLeaf/.test(read('src/pages/BalanceSheet.tsx')), 'BalanceSheet page uses the shared leaves rule (no private copy)');
const as = read('src/pages/AuditSchedules.tsx');
ok(/const isPacs = society\.societyType === 'pacs'/.test(as) && /isPacs && view === 'cas' \? <CasStatements/.test(as), 'CAS view offered to PACS societies only');
ok(/statutoryLimits\(society\.state,/.test(as) && /scheduleLimitsLine\(society, limits, format, hi\)/.test(as), 'Audit Schedules shows the text-verified statutory limits (RULE 2)');
const cs = read('src/components/cas/CasStatements.tsx');
ok(/\.has\('inventory_sales'\)/.test(cs) && /society\.state, declaredActivities\(societyActivities\), society\.activitiesCutoverEnabled/.test(cs), 'trading decision uses the same resolution as getProfitLoss');
ok(/loanInterestDue\(id, accruals, vouchers\)/.test(cs), 'overdue interest receivable from the same loanInterestDue as the repay dialogs');
ok(/casBalanceSheetTies\(bs, data\.leaves\)/.test(cs) && /near\(pl\.netProfit, data\.appNet\)/.test(cs) && /near\(trading\.grossProfit, data\.appGross\)/.test(cs), 'screen shows a tie check for all three statements');
ok(/procuredToStock: tr\.procuredToStock, purchaseGrossUp: tr\.legacyPurchaseGrossUp/.test(cs), 'CAS Trading takes the procured-to-stock and legacy gross-up figures from getTradingAccount (RULE 2)');
ok(/buildCasTrialBalance\(getTrialBalance\(m\.to\), getTrialBalance\(dayBefore\(m\.from\)\), \{ hasTrading \}\)/.test(cs), 'Annexure I built from month-end vs day-before-month trial balances');

console.log(`CAS statements: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
