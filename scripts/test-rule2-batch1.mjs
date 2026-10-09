// RULE 2 batch 1 (2026-10-09) — pages that computed the same figure as another page, differently.
// Found by the duplicate-page audit; each fix makes the page use the ONE shared rule.
//   1. Day Book openings signed like the Cash / Bank Book (accountBook: debit +, else −)
//   2. Sale / Purchase list totals = bill amount (grandTotal) like the registers, + branch scope
//   3. Inventory / role dashboard stock value over ACTIVE items like Stock Valuation / Trading A/c
//   4. KCC page overdue = the interest run's effectiveLoanStatus (not a Date-object compare)
//   5. Depreciation Schedule: per-asset NBV from the asset's own accumulated depreciation; deductions in-FY
//   6. Housing fund spend refuses more than the fund holds (same guard as the Fund Register path)
//   7. Audit Certificate / Reserve Fund / Profit Distribution read the shared getAccountBalance
// Behaviour checked through the REAL lib functions where one exists; wiring checked in the source.
//
// Run: node scripts/test-rule2-batch1.mjs   (npm run test:rule2-batch1)
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
const { accumulatedDepThrough, calcDepForFY, wdvAccumulatedBefore } = await imp('lib/depreciation.ts');
const { effectiveLoanStatus, kccAsAccruable } = await imp('lib/loans/interestAccrual.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Day Book
const day = read('pages/DayBook.tsx');
ok(/a\.openingBalanceType === 'debit' \? \(a\.openingBalance \|\| 0\) : -\(a\.openingBalance \|\| 0\)/.test(day), 'Day Book: signed opening (debit +, else −) — the Cash/Bank Book rule');
ok(!/\?\.openingBalance \|\| 0\) : 0;/.test(day), 'Day Book: no raw (unsigned) cash opening left');

// 2. Sale / Purchase lists
for (const f of ['pages/SaleManagement.tsx', 'pages/PurchaseManagement.tsx']) {
  const s = read(f);
  ok(/const billAmt = \(x: \{ grandTotal\?: number; netAmount: number \}\) => x\.grandTotal \?\? x\.netAmount;/.test(s) && !/\.reduce\(\(s, (sale|p)\) => s \+ (sale|p)\.netAmount, 0\)/.test(s), `${f}: totals are bill amounts (grandTotal), not the pre-GST taxable value`);
  ok(/if \(!matchesActiveBranch\((s|p)\.branchId\)\) return false;/.test(s), `${f}: branch scope like the register`);
}

// 3. Stock value over active items
ok(/stockItems\.filter\(item => item\.isActive\)\.reduce\(/.test(read('pages/Inventory.tsx')), 'Inventory: stock value over active items');
ok(/const liveItems = \(stockItems \|\| \[\]\)\.filter\(it => it\.isActive\);/.test(read('pages/RoleDashboard.tsx')), 'Role dashboard: stock value over active items');

// 4. KCC overdue = the interest run's rule
const kcc = { id: 'k', loanNo: 'KCC-1', memberId: 'm', drawnAmount: 50000, repaidAmount: 0, outstandingAmount: 50000, interestRate: 7, dueDate: '2026-10-09', status: 'active' };
ok(effectiveLoanStatus(kccAsAccruable(kcc), '2026-10-09') === 'active', 'due TODAY → not overdue yet (the page used to say overdue on the due day)');
ok(effectiveLoanStatus(kccAsAccruable(kcc), '2026-10-10') === 'overdue', 'the day after → overdue');
ok(effectiveLoanStatus(kccAsAccruable({ ...kcc, status: 'overdue', dueDate: '2027-03-31' }), '2026-10-09') === 'overdue', 'hand-marked overdue is honoured (the page ignored it)');
const kp = read('pages/KccLoan.tsx');
ok(/effectiveLoanStatus\(kccAsAccruable\(loan\), todayStr\(\)\)/.test(kp) && !/new Date\(loan\.dueDate\) < new Date\(\)/.test(kp), 'KCC page uses effectiveLoanStatus, not a Date compare');

// 5. Depreciation
const a1 = { id: 'a1', category: 'Furniture', cost: 100000, residualValue: 0, depreciationRate: 10, depreciationMethod: 'WDV', purchaseDate: '2024-04-01', status: 'active' };
const exp = wdvAccumulatedBefore(a1, '2026-27') + calcDepForFY(a1, '2026-27', wdvAccumulatedBefore(a1, '2026-27'));
ok(Math.abs(accumulatedDepThrough(a1, '2026-27') - exp) < 0.01 && exp > 0, 'accumulatedDepThrough = prior years + this FY (the posting functions)');
const s1 = { ...a1, depreciationMethod: 'SLM', purchaseDate: '2025-04-01' };
ok(Math.abs(accumulatedDepThrough(s1, '2026-27') - (calcDepForFY(s1, '2025-26') + calcDepForFY(s1, '2026-27'))) < 0.01, 'SLM: sum of each year since purchase');
ok(accumulatedDepThrough({ ...a1, purchaseDate: '2027-05-01' }, '2026-27') === 0, 'not yet bought → 0');
const ds = read('pages/DepreciationSchedule.tsx');
ok(/a\.cost - accumulatedDepThrough\(a, fy\)/.test(ds) && !/getAccumDepTotal/.test(ds), "per-asset NBV uses the asset's OWN accumulated depreciation (not the category ledger)");
ok(/a\.disposalDate >= fyDates\.start && a\.disposalDate <= fyDates\.end/.test(ds), 'deductions = disposals during this FY');

// 6. Housing fund guard
const hd = read('contexts/HousingDataContext.tsx');
ok(/if \(!data\.toFund\) \{\s*const corpus = buildFundStatement\(fund, vouchers\.filter\(isCountedVoucher\)\)\.closing;\s*if \(data\.amount > corpus \+ 0\.005\)/.test(hd), 'housing fund spend refuses more than the fund holds (same rule as DataContext)');

// 7. Shared balance
for (const f of ['pages/AuditCertificate.tsx', 'pages/ReserveFund.tsx', 'pages/ProfitDistribution.tsx']) {
  const s = read(f);
  ok(/const getBalance = \(id: string\) => -getAccountBalance\(id\);/.test(s) && !/let bal = acc\.openingBalanceType === 'credit'/.test(s), `${f}: balance from the shared getAccountBalance (no local voucher loop)`);
}

console.log(`RULE 2 batch 1: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
