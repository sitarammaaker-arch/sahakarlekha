// RULE 2 batch 3 (2026-10-09) — the remaining "same figure, two rules" pairs from the duplicate-page audit.
//   1. Role dashboard "Balance Sheet" card = the Dashboard tally (balanceSheetTallied, FY end, 1 paisa); loan totals non-cleared
//   2. Aging Analysis = FIFO ageing of the party LEDGER balance (opening incl., approved vouchers, branch, as-on, advance)
//   3. One appropriation rule for Reserve Fund + Profit Distribution (fund set, "already appropriated": not cancelled /
//      not rejected — a pending one still blocks a double post)
//   4. Labour PF/ESI reads the dated rule table (lib/rules/epfEsi) like Salary / Payroll; ceiling change in-month day-weighted
// Behaviour through the REAL lib functions; wiring in the source (house style).
//
// Run: node scripts/test-rule2-batch3.mjs   (npm run test:rule2-batch3)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const { fifoAging } = await imp('lib/reports/fifoAging.ts');
const { appropriationFunds, appropriatedToFunds, postedAppropriation } = await imp('lib/distribution/dividendRuns.ts');
const { resolveStatutory } = await imp('lib/rules/epfEsi.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.005;

// 1. Dashboards
const rd = read('pages/RoleDashboard.tsx'), db = read('pages/Dashboard.tsx');
ok(/balanceSheetTallied\(getTrialBalance\(fyEnd\)/.test(rd) && !/Math\.abs\(tbDr - tbCr\) < 1/.test(rd), 'role dashboard: the Balance Sheet card uses the shared tally, not TB Dr = Cr ±₹1');
ok(/balanceSheetTallied\(tb, \{/.test(db), 'Dashboard uses the same balanceSheetTallied');
ok(/loans\.filter\(l => l\.status !== 'cleared'\)\.reduce\(\(s, l\) => s \+ loanOutstanding\(l\), 0\);\n/.test(db) && !/const totalOutstanding = loans\.reduce/.test(db), 'Dashboard "Total Outstanding" = non-cleared loans, like the ceiling check / role dashboard');

// 2. FIFO ageing
const asOf = '2026-10-09';
const a1 = fifoAging([{ date: '2026-05-01', signed: 10000 }, { date: '2026-10-01', signed: -4000 }], asOf);
ok(near(a1.total, 6000) && near(a1.b91_180, 6000) && a1.b0_30 === 0, 'a recent receipt reduces the OLD invoice (no negative 0–30 bucket)');
const a2 = fifoAging([{ date: '2026-01-01', signed: 5000 }, { date: '2026-09-20', signed: 3000 }, { date: '2026-10-05', signed: -6000 }], asOf);
ok(near(a2.total, 2000) && near(a2.b0_30, 2000) && near(a2.bOver180, 0), 'payment clears the oldest first; the remainder keeps its own (recent) date');
const a3 = fifoAging([{ date: '2026-09-01', signed: 1000 }, { date: '2026-09-15', signed: -1500 }], asOf);
ok(near(a3.total, -500) && near(a3.advance, 500) && a3.b0_30 === 0 && a3.b31_60 === 0, 'over-payment → advance, never negative buckets');
ok(near(fifoAging([{ date: '2026-09-01', signed: 1000 }, { date: '2026-12-01', signed: -1000 }], asOf).total, 1000), 'entries after the as-on date are ignored');
const ag = read('pages/AgingAnalysis.tsx');
ok(/isCountedVoucher\(v\) && opts\.inScope\(v\.branchId\) && v\.date <= opts\.asOf/.test(ag), 'Aging: approved vouchers only, active branch, up to the as-on date');
ok(/opts\.openingsInScope && acc\.openingBalance/.test(ag) && /fifoAging\(entries, opts\.asOf\)/.test(ag), 'Aging includes the opening balance and ages with FIFO');
ok(/to="\/bills-outstanding"/.test(ag), 'Aging links to the bill-wise view');

// 3. Appropriation
const accts = [{ id: '1201', parentId: '1200', openingBalanceType: 'credit' }, { id: '1208', parentId: '1200', openingBalanceType: 'credit' }, { id: '1211', parentId: '1200', openingBalanceType: 'debit' }, { id: 'X', parentId: '3400', openingBalanceType: 'credit', subtype: 'reserve' }];
ok(appropriationFunds(accts).map(a => a.id).join() === '1201', 'funds = credit ledgers under 1200, not 1208 / debit-side / a reserve-subtype outside 1200');
const mk = (id, amt, extra = {}) => ({ id, voucherNo: id, date: '2027-03-31', type: 'journal', debitAccountId: '1208', creditAccountId: '1201', amount: amt, narration: 'Reserve Fund 2026-27', ...extra });
const vs = [mk('a', 1000), mk('b', 500, { approvalStatus: 'pending' }), mk('c', 700, { approvalStatus: 'rejected' }), mk('d', 300, { isDeleted: true })];
ok(near(appropriatedToFunds(vs, ['1201'], '2026-27'), 1500), 'already appropriated = live + pending; rejected and cancelled excluded');
ok(postedAppropriation([mk('c', 700, { approvalStatus: 'rejected' })], '1208', '1201', '2026-27') === undefined, 'a REJECTED appropriation no longer blocks posting');
ok(postedAppropriation([mk('b', 500, { approvalStatus: 'pending' })], '1208', '1201', '2026-27')?.id === 'b', 'a PENDING one still counts — no double post while it waits');
ok(/appropriationFunds\(accounts\)/.test(read('pages/ReserveFund.tsx')) && /postedAppropriation\(vouchers, ACC_NET_SURPLUS, f\.id, fy\)/.test(read('pages/ReserveFund.tsx')), 'Reserve Fund uses the shared rule');
ok(/appropriatedToFunds\(vouchers, fundAccountIds, fy\)/.test(read('pages/ProfitDistribution.tsx')), 'Profit Distribution uses the shared rule');

// 4. Labour PF/ESI
const lab = read('contexts/LabourDataContext.tsx');
ok(/export function pfEsiDefaultsFor\(period: string\): PfEsiConfig \{\s*const law = resolveStatutory\(`\$\{period\}-01`\);/.test(lab), 'labour basis comes from the dated rule table');
const sep = resolveStatutory('2026-09-01');
ok(sep.pfCeilingSegments.length >= 1 && sep.pfWageCeiling > 0, 'the rule table resolves a September 2026 basis');
ok(/s \+ Math\.min\(wage, g\.value\) \* g\.days, 0\) \/ segDays/.test(lab), 'an in-month ceiling change is day-weighted (Salary rule)');
ok(/epfWage: epfBase/.test(lab) && /Math\.round\(w\.epfWage\)/.test(read('pages/PfEsi.tsx')), 'the ECR file uses the PF wage the run posts');
for (const f of ['pages/WageSlip.tsx', 'pages/StatutoryReconciliation.tsx', 'pages/PfEsi.tsx']) {
  ok(/pfEsiDefaultsFor\(/.test(read(f)) && !/computePfEsi\(period, PF_ESI_DEFAULTS\)/.test(read(f)), `${f}: dated basis, not the hard-coded defaults`);
}

console.log(`RULE 2 batch 3: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
