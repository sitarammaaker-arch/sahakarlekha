// Audit Schedules (State format) tie to the Balance Sheet and the Trading A/c (RULE 2).
// Regression for Rania FY 2026-27 (prod, after the agent-model correction): the schedules left out
// closing stock and Hafed Marketing Division, printed totals of "—" next to non-zero lines, an
// Income total that was not the sum of its lines, and a Trading schedule that did not foot.
// Run: node scripts/test-audit-schedule-tie.mjs
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
const F = await imp('src/lib/stateAuditFormats.ts');
const { tieSchedules } = await imp('src/lib/auditScheduleTie.ts');
const { balanceSheetLeaves } = await imp('src/lib/balanceSheetLeaves.ts');
const S = await imp('src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const near = (a, b) => Math.abs(a - b) < 0.011;

// The real marketing chart + Rania's own heads.
const chart = S.CMS_SOCIETY_ACCOUNTS.map((a) => ({ ...a }));
const custom = [
  { id: 'HAFED', name: 'Hafed Marketing Division', nameHi: 'हैफेड', type: 'liability', isGroup: false },            // an orphan head (BS "OTHER")
  { id: 'SR', name: 'Sales Return', nameHi: 'बिक्री वापसी', type: 'income', isGroup: false, parentId: '4100' },
  { id: 'CGP', name: 'Consumer Goods Purchase', nameHi: 'उपभोक्ता माल क्रय', type: 'expense', isGroup: false, parentId: '5100', subtype: 'direct_expense' },
];
const accounts = [...chart, ...custom];
const A = (id) => accounts.find((a) => a.id === id);
const row = (id, net, openingDebit = 0) => ({ account: A(id), netBalance: net, openingDebit, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0 });
const TB = [
  row('1102', -63150), row('2105', -294200), row('2201', -270), row('HAFED', -11188.80),
  row('4103', -8100), row('SR', 2700), row('4407', -4440),
  row('3301', 73260), row('3310', 532.80), row('3308', 294200), row('3403', 0), row('CGP', 10656),
];
ok(near(TB.reduce((t, b) => t + b.netBalance, 0), 0), 'fixture: Rania Trial Balance balances');

const netProfit = 4524;
const trading = { totalSales: 5400, totalOpeningStock: 0, totalPurchases: 10656, totalDirectExp: 0, totalClosingStock: 5340, grossProfit: 84 };
const leaves = balanceSheetLeaves(TB, { closingStockPosted: false, physicalClosingStock: 5340, netProfit });
const format = F.getStateAuditFormat('hr');
const ctx = { trialBalance: TB, accounts, previousYearBalances: {}, netProfit, grossProfit: 84, reserveFundPct: 25, totalIncome: 4524, totalExpenses: 0, totalMembers: 0, activeMembers: 0, totalShareCapital: 0 };
const { schedules, ties } = tieSchedules(F.resolveAllSchedules(format, ctx), { accounts, leaves, trialBalance: TB, trading, netProfit, previousYearBalances: {} });
const sch = (id) => schedules.find((s) => s.id === id);
const total = (id) => sch(id).items.find((i) => i.isTotal).currentYear;
const line = (id, label) => sch(id).items.find((i) => i.label === label)?.currentYear;

ok(ties.ok && near(ties.liabilities, 373332.80) && near(ties.assets, 373332.80), `schedules tie to the Balance Sheet: liabilities ${ties.liabilities}, assets ${ties.assets}`);
ok(near(total('sch-I'), 63150), 'I: share capital');
ok(near(total('sch-II'), 4524), `II: total = current-year surplus 4,524 (was "—") — ${total('sch-II')}`);
ok(near(line('sch-VII', 'Hafed Marketing Division'), 11188.80) && near(total('sch-VII'), 305658.80), `VII: Hafed Marketing Division included; total ${total('sch-VII')}`);
ok(near(line('sch-VI', 'Closing Stock'), 5340) && near(line('sch-VI', 'MSP Receivable'), 294200) && near(total('sch-VI'), 373332.80), `VI: closing stock + MSP receivable included; total ${total('sch-VI')}`);
for (const s of schedules.filter((x) => x.id !== 'sch-X')) {
  const t = s.items.find((i) => i.isTotal);
  if (!t) continue;
  const sum = s.items.filter((i) => !i.isTotal).reduce((a, i) => a + i.currentYear, 0);
  ok(near(t.currentYear, sum), `${s.id}: total = sum of its lines (${t.currentYear} vs ${sum})`);
}
ok(near(total('sch-VIII'), 9840) && near(line('sch-VIII', 'Sales Return'), -2700), `VIII: every income ledger, total 8,100 − 2,700 + 4,440 = 9,840 (was 4,524) — ${total('sch-VIII')}`);
ok(near(total('sch-IX'), 10656), 'IX: total 10,656 (was "—")');
const x = sch('sch-X').items, xv = (id) => x.find((i) => i.id === id).currentYear;
ok(near(xv('X-1'), 5400), 'X: sales net of returns (5,400, was 8,100)');
ok(near(xv('X-1') + xv('X-close') - xv('X-open') - xv('X-2') - xv('X-dexp'), xv('X-3')) && near(xv('X-3'), 84), 'X: lines foot to gross profit 84');
ok(near(x.find((i) => i.isTotal).currentYear, 4524), 'X: net profit 4,524');

// Every Balance Sheet leaf lands in exactly one schedule.
{
  const ids = schedules.filter((s) => ['sch-I', 'sch-II', 'sch-III', 'sch-IV', 'sch-V', 'sch-VI', 'sch-VII'].includes(s.id))
    .flatMap((s) => s.items.filter((i) => !i.isTotal && i.source.kind === 'account' && Math.abs(i.currentYear) > 0.005).flatMap((i) => i.source.accountIds));
  ok(ids.length === new Set(ids).size, 'no ledger counted in two schedules');
}
// Punjab / other states reuse the same line items → the same tie.
{
  const pb = tieSchedules(F.resolveAllSchedules(F.getStateAuditFormat('pb'), ctx), { accounts, leaves, trialBalance: TB, trading, netProfit, previousYearBalances: {} });
  ok(pb.ties.ok, 'Punjab format ties too');
}

const page = fs.readFileSync(path.join(ROOT, 'src/pages/AuditSchedules.tsx'), 'utf8');
ok(/getTrialBalance\(fyEnd\)/.test(page) && /balanceSheetLeaves\(trialBalance, \{ closingStockPosted: tr\.closingStockPosted/.test(page) && /tieSchedules\(resolveAllSchedules\(format, ctx\)/.test(page), 'page: FY-end, Balance Sheet leaves, tied schedules (screen, PDF, Excel, CSV)');
ok(/Schedules do not tie to the Balance Sheet/.test(page), 'page reports a tie failure instead of hiding it');

console.log(`Audit schedule tie: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
