// NABARD MIS returns for PACS (CAS-2b slice 1): Annexure VII (overdue ageing), XVII (concise
// Balance Sheet), XVIII (ratios) — read off the CAS Balance Sheet, per the Hand Book on MIS for PACS.
// Run: node scripts/test-cas-mis.mjs
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
const M = await imp('src/lib/cas/pacsMis.ts');
const { balanceSheetLeaves } = await imp('src/lib/balanceSheetLeaves.ts');
const S = await imp('src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const near = (a, b) => a != null && Math.abs(a - b) < 0.011;

const { accounts } = S.migrateAccounts(S.SOCIETY_TEMPLATES.pacs.map((a) => ({ ...a })));
const leaves = accounts.filter((a) => !a.isGroup);
const TB = (bal) => leaves.map((a) => ({ account: a, netBalance: bal[a.id] ?? 0 }));
const bsOf = (bal, netProfit = 0) => {
  const lv = balanceSheetLeaves(TB(bal), { closingStockPosted: true, physicalClosingStock: 0, netProfit });
  return C.buildCasBalanceSheet({ ...lv, unpostedStock: 0, netProfit, overdueInterestReceivable: 0 });
};

// ── 1. Annexure XVII position + XVIII ratios (hand-worked) ──
// Share 1,00,000 + reserve 20,000; SB deposits 50,000; DCCB borrowing 30,000.
// Cash 10,000; bank 20,000; KCC loans 1,50,000; NSC 20,000.
{
  const bs = bsOf({ '1102': -100000, '1201': -20000, '2107': -50000, '2301': -30000, '3301': 10000, '3302': 20000, '3303': 150000, '3207': 20000 });
  ok(near(bs.totalAssets, 200000) && near(bs.totalLiabilities, 200000), 'fixture balances');
  const p = M.misPosition(bs);
  ok(near(p.equity, 120000), `equity = share capital + reserves (${p.equity})`);
  ok(near(p.borrowings, 30000) && near(p.deposits, 50000), 'borrowings / deposits from their CAS sections');
  ok(near(p.workingFunds, 200000), `working funds = BS total − contra − loss (${p.workingFunds})`);
  ok(near(p.loans, 150000) && near(p.investments, 20000), 'loans (gross) / investments');
  const rows = new Map(bs.assets.flatMap((s) => s.rows).map((r) => [r.id, r.amount]));
  ok(rows.get('A2') === 20000, 'bank head sits on the A2 line (fixture premise)');
  // RWA = cash 0% + bank 22.5% (split not held) + KCC 100% + NSC 2.5% = 4,500 + 1,50,000 + 500.
  const rwa = M.riskWeightedAssets(bs);
  ok(near(rwa.total, 155000), `risk-weighted assets per the Handbook worksheet (${rwa.total})`);
  ok(rwa.assumptions.length === 1 && /22\.5%/.test(rwa.assumptions[0]), 'the one assumption used (bank split) is disclosed');
  const r = M.misRatios(bs, 5000);
  ok(near(r.capitalAdequacy, 77.42), `CAR = owned funds / RWA (${r.capitalAdequacy})`);
  ok(near(r.creditDeposit, 300), `CD = loans / deposits (${r.creditDeposit})`);
  ok(near(r.returnOnAssets, 2.5), `ROA = net profit / working funds (${r.returnOnAssets})`);
  ok(r.npaRatio === null, 'NPA ratio withheld until the PACS NPA norms are in the app — never guessed');
  ok(M.misRatios(bsOf({ '1102': -1000, '3301': 1000 }), 0).creditDeposit === null, 'CD ratio is null (not ∞/0) with no deposits');
}
// A loss: equity and working funds both net of the accumulated loss.
{
  const bs = bsOf({ '1102': -100000, '3301': 90000 }, -10000);
  const p = M.misPosition(bs);
  ok(near(p.equity, 90000) && near(p.workingFunds, 90000), `loss deducted from equity and working funds (${p.equity}, ${p.workingFunds})`);
}
// Averages.
{
  const a = M.averagePosition([{ equity: 100, borrowings: 0, deposits: 10, workingFunds: 200, loans: 50, investments: 0 }, { equity: 200, borrowings: 0, deposits: 30, workingFunds: 400, loans: 70, investments: 0 }]);
  ok(a.equity === 150 && a.deposits === 20 && a.workingFunds === 300 && a.loans === 60, 'monthly average of month-end positions');
  ok(M.averagePosition([]) === null, 'no month ended yet ⇒ no average (not zeros)');
}

// ── 2. Annexure VII — ageing since the due date ──
{
  const L = (id, amount, repaid, dueDate, status = 'active') => ({ id, loanNo: id, memberId: 'm', amount, repaidAmount: repaid, interestRate: 7, dueDate, status });
  const asOf = '2027-03-31';
  const t = M.overdueClassification({
    asOf,
    memberLoans: [
      L('a', 10000, 4000, '2025-01-15'),            // 2.2 y  → 1–3, outstanding 6,000
      L('b', 5000, 0, '2026-10-01'),                // 0.5 y  → <1
      L('c', 5000, 5000, '2020-01-01'),             // fully repaid → not overdue
      L('d', 8000, 0, '2027-06-30'),                // not yet due → not overdue
      L('e', 3000, 0, '2027-06-30', 'overdue'),     // marked overdue, due not passed → <1
      L('f', 2000, 0, '2022-03-30', 'cleared'),     // cleared → excluded
    ],
    kcc: [L('k1', 7000, 0, '2020-01-01'), L('k2', 1000, 0, '2023-06-01')], // 7.2 y → >6 ; 3.8 y → 3–4
  });
  ok(t.others.y1to3 === 6000 && t.others.lt1 === 8000, `member loans aged by due date (1–3: ${t.others.y1to3}, <1: ${t.others.lt1})`);
  ok(t.stAgri.gt6 === 7000 && t.stAgri.y3to4 === 1000, 'KCC → Short Term Agricultural, aged');
  ok(t.total.lt1 === 8000 && t.total.y1to3 === 6000 && t.total.y3to4 === 1000 && t.total.gt6 === 7000, 'total row = sum of rows');
  ok(t.stNonAgri.lt1 === 0 && t.mtltAgri.gt6 === 0, 'rows the books cannot tag stay empty (never guessed)');
  ok(M.bucketFor('2021-01-01', asOf) === 'gt6' && M.bucketFor('2021-06-01', asOf) === 'y5to6' && M.bucketFor('2026-04-01', asOf) === 'lt1' && M.bucketFor(undefined, asOf) === 'lt1', 'bucket edges');
}

// ── 3. Wiring ──
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cs = read('src/components/cas/CasStatements.tsx');
ok(/misPosition\(bsAt\(m\.to\)\)/.test(cs) && /buildCasBalanceSheet\(\{ assetLeaves: lv\.assetLeaves/.test(cs), 'XVII month-ends use the same leaves rule + CAS builder as Annexure IV (RULE 2)');
ok(/misRatios\(bs, appPL\.netProfit\)/.test(cs), 'XVIII ratios read the Annexure IV sheet and the app net profit');
ok(/overdueClassification\(\{ memberLoans: loans\.filter\(\(l\) => !l\.isDeleted\), kcc: kccAccruables\(kccLoans\)/.test(cs), 'VII excludes deleted loans (RULE 5), KCC via the shared accruable adapter');
ok(/<CasMis hi=\{hi\} \{\.\.\.data\.mis\} \/>/.test(cs), 'MIS returns rendered on the CAS screen');

console.log(`CAS MIS: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
