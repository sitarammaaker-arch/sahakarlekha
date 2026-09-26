// Member Portal S4b — PARITY: the member's dairy / housing / consumer figures (buildVerticalViews)
// must equal what the STAFF functions produce from the same rows (RULE 2), including when the RPC
// hands numbers back as strings (Postgres numeric → JSON). Plus static guards on the UI wiring.
// Run: node scripts/test-member-portal-verticals.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
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
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const { buildVerticalViews } = await imp('src/lib/memberPortalVerticals.ts');
const { buildMemberPassbook } = await imp('src/lib/dairy/registers.ts');
const { memberInputOutstanding } = await imp('src/lib/dairy/inputs.ts');
const { buildMemberStatement } = await imp('src/lib/housing/statement.ts');
const { memberOutstanding, memberAgeing } = await imp('src/lib/consumer/credit.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const M = 'm1';
const asOf = '2026-09-26';

// ── Fixtures, typed the way the staff contexts hold them ──
const milk = [
  { id: 'e1', date: '2026-04-01', shift: 'morning', memberId: M, qty: 5.5, fat: 4.2, snf: 8.5, rate: 42, amount: 231 },
  { id: 'e2', date: '2026-04-01', shift: 'evening', memberId: M, qty: 4, fat: 4.0, snf: 8.4, rate: 40, amount: 160 },
  { id: 'e3', date: '2026-04-02', shift: 'morning', memberId: M, qty: 6.25, fat: 4.5, snf: 8.6, rate: 44.5, amount: 278.13 },
];
const settlements = [
  { id: 's1', memberId: M, from: '2026-04-01', to: '2026-04-10', gross: 669.13, netPayable: 569.13, amountPaid: 300, status: 'approved',
    deductionLines: [{ accountId: '3305', amount: 80 }, { accountId: '4999', amount: 20 }] },
  { id: 's2', memberId: M, from: '2026-04-11', to: '2026-04-20', gross: 500, netPayable: 500, amountPaid: 500, status: 'approved', deductionLines: [] },
];
const issues = [
  { id: 'i1', date: '2026-04-03', memberId: M, inputType: 'feed', itemName: 'पशु आहार', qty: 2, amount: 150 },
  { id: 'i2', date: '2026-04-05', memberId: M, inputType: 'medicine', itemName: 'दवा', amount: 45.5 },
];
const bills = [
  { id: 'b1', billNo: 'MB/1', memberId: M, flatNo: 'A-1', period: '2026-04', date: '2026-04-01', amount: 1500, paidAmount: 1500 },
  { id: 'b2', billNo: 'MB/2', memberId: M, flatNo: 'A-1', period: '2026-05', date: '2026-05-01', amount: 1500, paidAmount: 0 },
];
const mVouchers = [
  { id: 'v1', voucherNo: 'RV/9', date: '2026-04-10', amount: 1500, narration: 'Maintenance', refType: 'maintenance.receipt', refId: 'b1' },
  { id: 'v2', voucherNo: 'JV/3', date: '2026-06-01', amount: 30, narration: 'Interest', refType: 'maintenance.interest', refId: 'b2' },
];
const sales = [
  { id: 'c1', saleNo: 'S/1', memberId: M, paymentMode: 'credit', date: '2026-05-01', grandTotal: 1200, netAmount: 1100 },
  { id: 'c2', saleNo: 'S/2', memberId: M, paymentMode: 'credit', date: '2026-09-10', grandTotal: 0, netAmount: 800 },
  { id: 'c3', saleNo: 'S/3', memberId: M, paymentMode: 'credit', date: '2026-07-15', grandTotal: 650.5, netAmount: 600 },
];
const recoveries = [{ id: 'r1', memberId: M, amount: 700 }];
const returns = [{ id: 'x1', memberId: M, grandTotal: 100, refundMode: 'credit-adjust' }];

// The RPC returns numerics as strings sometimes — feed the view the stringified payload.
const strNums = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])));
const payload = {
  milkFrom: '2026-03-01',
  milkEntries: strNums(milk),
  dairySettlements: settlements.map((s) => ({ ...strNums([s])[0], deductionLines: s.deductionLines.map((l) => ({ ...l, amount: String(l.amount) })) })),
  dairyInputIssues: strNums(issues),
  dairyInputAccounts: [{ id: '3305', name: 'Member Input Receivable', nameHi: 'सदस्य आदान प्राप्य', subtype: null }],
  dairyDistributions: [{ id: 'd1', kind: 'bonus', fyLabel: '2025-26', line: { memberId: M, base: '1200.5', amount: '360.15' } }],
  maintenanceBills: strNums(bills),
  maintenanceVouchers: strNums(mVouchers),
  housingFlats: [{ id: 'f1', flatNo: '101', blockNo: 'A', area: '850', monthlyMaintenance: '1500' }],
  creditSales: strNums(sales),
  creditRecoveries: strNums(recoveries),
  creditReturns: strNums(returns),
  patronageRuns: [{ id: 'p1', kind: 'patronage', from: '2025-04-01', to: '2026-03-31', line: { memberId: M, base: '12000', amount: '240' } }],
};

const views = buildVerticalViews(M, payload, asOf);

// ── Dairy parity ──
const staffPass = buildMemberPassbook(milk, settlements, M);
for (const k of ['totalQty', 'totalGross', 'totalNet', 'totalPaid', 'totalOutstanding']) ok(views.dairy.passbook[k] === staffPass[k], `dairy passbook.${k}: portal ${views.dairy.passbook[k]} = staff ${staffPass[k]}`);
ok(views.dairy.passbook.collections.length === 3 && views.dairy.passbook.settlements.length === 2, 'dairy rows carried through');
const staffInputs = memberInputOutstanding(issues, settlements, M, '3305');
ok(same(views.dairy.inputs, staffInputs), `dairy inputs: portal ${JSON.stringify(views.dairy.inputs)} = staff ${JSON.stringify(staffInputs)}`);
ok(views.dairy.inputs.recovered === 80, 'input recovered counts ONLY deduction lines crediting 3305');
ok(views.dairy.distributions[0].amount === 360.15 && views.dairy.distributions[0].period === '2025-26', 'dairy bonus line: own amount + FY label');
// The resolver is honoured: without the input account, recovered falls to 0 exactly as staff does.
const noAcct = buildVerticalViews(M, { ...payload, dairyInputAccounts: [] }, asOf);
ok(same(noAcct.dairy.inputs, memberInputOutstanding(issues, settlements, M, '')), 'missing input account → same as staff with no account');
// Resolver by Hindi name when the id differs (custom chart).
const hiName = buildVerticalViews(M, { ...payload, dairySettlements: [{ ...payload.dairySettlements[0], deductionLines: [{ accountId: 'X9', amount: '80' }] }], dairyInputAccounts: [{ id: 'X9', name: 'x', nameHi: 'सदस्य आदान प्राप्य' }] }, asOf);
ok(hiName.dairy.inputs.recovered === 80, 'input account resolved by Hindi name like resolveMemberInputReceivableAccountId');

// ── Housing parity ──
const staffStmt = buildMemberStatement(bills, mVouchers);
ok(same(views.housing.statement, staffStmt), `housing statement identical to staff (outstanding ${views.housing.statement.outstanding} = ${staffStmt.outstanding})`);
ok(views.housing.statement.outstanding === 1530, 'housing outstanding = 1500 + 30 interest');
ok(views.housing.flats[0].flatNo === '101' && views.housing.flats[0].monthlyMaintenance === 1500, 'flat carried + coerced');

// ── Consumer parity ──
const staffOut = memberOutstanding(sales, recoveries, M, returns);
const staffAge = memberAgeing(sales, recoveries, M, asOf, returns);
ok(views.consumer.outstanding === staffOut, `consumer outstanding: portal ${views.consumer.outstanding} = staff ${staffOut}`);
ok(same(views.consumer.ageing, staffAge), `consumer ageing identical to staff (${JSON.stringify(staffAge)})`);
ok(views.consumer.creditSales.find((s) => s.id === 'c2').amount === 800, 'sale with grandTotal 0 falls back to netAmount (same rule as saleTotal)');
ok(views.consumer.distributions[0].amount === 240 && views.consumer.distributions[0].period === '2025-04-01 – 2026-03-31', 'patronage line: own amount + period');

// ── Only-applicable verticals ──
const empty = buildVerticalViews(M, {}, asOf);
ok(empty.dairy === null && empty.housing === null && empty.consumer === null, '064-only payload → no vertical sections (no crash)');
const onlyHousing = buildVerticalViews(M, { maintenanceBills: payload.maintenanceBills }, asOf);
ok(onlyHousing.housing && onlyHousing.dairy === null && onlyHousing.consumer === null, 'a housing member sees only housing');

// ── Static guards ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const lib = strip('src/lib/memberPortalVerticals.ts');
for (const fn of ['buildMemberPassbook', 'memberInputOutstanding', 'resolveMemberInputReceivableAccountId', 'buildMemberStatement', 'memberOutstanding', 'memberAgeing']) {
  ok(new RegExp(`import \\{[^}]*\\b${fn}\\b[^}]*\\} from '\\./`).test(lib) && new RegExp(`${fn}\\(`).test(lib), `view uses the staff function ${fn}`);
}
const ui = strip('src/components/member-portal/PortalVerticals.tsx');
ok(!/\.reduce\(/.test(ui), 'UI computes no totals of its own (all from the staff functions)');
// Flat label matches the staff Member Statement exactly: "flatNo · blockNo" (was "block-flat", giving "A1-A-101").
const staffStmtPage = strip('src/pages/MemberStatement.tsx');
ok(/\{f\.flatNo\}\{f\.blockNo \? ` · \$\{f\.blockNo\}` : ''\}/.test(staffStmtPage), 'staff flat label is flatNo · blockNo');
ok(/`\$\{f\.flatNo\}\$\{f\.blockNo \? ` · \$\{f\.blockNo\}` : ''\}`/.test(ui) && !/\[f\.blockNo, f\.flatNo\]/.test(ui), 'portal flat label = staff format');
// KYC status shown in Hindi on the Hindi page.
const portalPage = strip('src/pages/MemberPortal.tsx');
ok(/verified: 'सत्यापित'/.test(portalPage) && /KYC_HI\[m\.kycStatus\]/.test(portalPage), 'KYC status translated in Hindi');
const page = strip('src/pages/MemberPortal.tsx');
ok(/buildVerticalViews\(snapshot\.member\.id/.test(page) && /<PortalVerticals views=\{vv\}/.test(page), 'MemberPortal renders the vertical views');

console.log(`member-portal verticals (S4b): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
