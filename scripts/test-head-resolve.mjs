// Head resolvers for ids whose MEANING differs between charts (src/lib/accounting/headResolve.ts) and their wiring.
//   2108  Fixed Deposits (PACS)           vs  Advance Maintenance Collected (housing)  — and absent from most societies
//   2207  Professional Tax Payable (CMS…) vs  Property Tax Payable (housing)
// Pins: the exact id wins only when it really is that head; otherwise a liability leaf named for it; otherwise null
// (the caller refuses — nothing is posted to a guess); DataContext uses the resolvers, not the bare ids.
// Run: node scripts/test-head-resolve.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
const S = await import(pathToFileURL(path.join(SRC, 'lib/storage.ts')).href);
const H = await import(pathToFileURL(path.join(SRC, 'lib/accounting/headResolve.ts')).href);
const D = await import(pathToFileURL(path.join(SRC, 'lib/depositEngine.ts')).href);
const A = await import(pathToFileURL(path.join(SRC, 'lib/payroll/accrualLines.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const chart = (type) => S.migrateAccounts(S.SOCIETY_TEMPLATES[type].map((a) => ({ ...a }))).accounts;
const without = (accs, id) => accs.filter((a) => a.id !== id);
const addLiab = (accs, name, nameHi = '') => [...accs, { id: 'u-' + name.length, name, nameHi, type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isGroup: false, parentId: '2100' }];

// ── Fixed deposits ────────────────────────────────────────────────────────────────────────────────────
ok(H.fixedDepositAccountId(chart('pacs')) === '2108', 'PACS chart: FD resolves to 2108 (Fixed Deposits from Members)');
ok(H.fixedDepositAccountId(chart('housing')) === null, 'housing chart: 2108 is Advance Maintenance Collected → FD does NOT resolve to it');
ok(H.fixedDepositAccountId(without(chart('marketing_processing'), '2108')) === null, 'a CMS-chart society that never got 2108 → null (nothing is posted)');
const cmsWithFd = addLiab(without(chart('marketing_processing'), '2108'), 'Fixed Deposits from Members', 'सदस्य सावधि जमा');
ok(H.fixedDepositAccountId(cmsWithFd) === 'u-' + 'Fixed Deposits from Members'.length, 'once a "Fixed Deposits from Members" liability is added (any id), FD resolves to it');
ok(H.fixedDepositAccountId(addLiab(chart('housing'), 'Fixed Deposits from Members')) !== '2108', 'housing + an added FD head → resolves to the added head, never to 2108');
ok(H.fixedDepositAccountId([{ id: '3205', name: 'FDR', nameHi: '', type: 'asset', isGroup: false }]) === null, 'an FDR *asset* (the society\'s own investment) is not the deposit liability');
ok(H.fixedDepositAccountId([{ id: '2108', name: 'Fixed Deposits from Members', nameHi: '', type: 'liability', isGroup: true }]) === null, 'a group head is not postable');
ok(H.fixedDepositAccountId([{ id: '2108', name: 'Security Deposits - Fixed', nameHi: '', type: 'liability', isGroup: false }]) === null, 'a security-deposit head is excluded even if it says "Fixed"');
ok(H.fixedDepositAccountId([{ id: '2299', name: 'Term Deposits from Members', nameHi: '', type: 'liability', isGroup: false }]) === '2299', 'a "Term Deposits" liability counts');
ok(H.fixedDepositAccountId([{ id: '2108', name: 'x', nameHi: 'सदस्य सावधि जमा', type: 'liability', isGroup: false }]) === '2108', 'the Hindi name alone is enough');
ok(H.fixedDepositAccountId([]) === null, 'empty chart → null');

// ── Professional tax ──────────────────────────────────────────────────────────────────────────────────
ok(H.professionalTaxAccountId(chart('marketing_processing')) === '2207', 'CMS chart: PT resolves to 2207 (Professional Tax Payable)');
ok(H.professionalTaxAccountId(chart('pacs')) !== null, 'PACS chart: has a Professional Tax Payable head');
ok(H.professionalTaxAccountId(chart('housing')) === null, 'housing chart: 2207 is Property Tax Payable → PT does NOT resolve to it');
const housingWithPt = addLiab(chart('housing'), 'Professional Tax Payable', 'देय व्यावसायिक कर');
ok(H.professionalTaxAccountId(housingWithPt) === 'u-' + 'Professional Tax Payable'.length, 'housing + an added Professional Tax Payable → that head');
ok(H.professionalTaxAccountId([{ id: '5602', name: 'Professional Tax / Local Levies', nameHi: '', type: 'expense', isGroup: false }]) === null, 'the Professional Tax EXPENSE head is not the payable');
ok(H.professionalTaxAccountId([{ id: '2207', name: 'Property Tax Payable', nameHi: 'देय संपत्ति कर', type: 'liability', isGroup: false }]) === null, 'Property Tax Payable is never PT');

// ── Deposit engine ────────────────────────────────────────────────────────────────────────────────────
ok(D.depositLiabilityAccount('FD') === '2108' && D.depositLiabilityAccount('SB') === '2107', 'the chart-blind id convention is unchanged');
ok(D.resolveDepositLiabilityAccount('FD', chart('pacs')) === '2108', 'FD in a PACS chart → 2108');
ok(D.resolveDepositLiabilityAccount('FD', chart('housing')) === null, 'FD in a housing chart → null');
for (const t of ['SB', 'RD', 'PIGMY']) ok(D.resolveDepositLiabilityAccount(t, chart('marketing_processing')) === '2107', `${t} in a CMS chart → 2107`);
ok(D.resolveDepositLiabilityAccount('SB', without(chart('marketing_processing'), '2107')) === null, 'SB with no 2107 → null (not a blind "2107")');
ok(D.resolveDepositLiabilityAccount('SB', [{ id: '2107', name: 'Member Deposits', nameHi: '', type: 'expense', isGroup: false }]) === null, '2107 that is not a liability → null');

// ── Salary accrual uses the resolved PT head ──────────────────────────────────────────────────────────
const rec = { basicSalary: 20000, allowances: 5000, pfEmployee: 1800, pfEmployer: 1800, pt: 200, tds: 500, netSalary: 22500 };
ok(A.salaryAccrualLines(rec, '2103').lines.some((l) => l.accountId === '2207' && l.amount === 200), 'default PT head stays 2207');
const withHead = A.salaryAccrualLines(rec, '2103', undefined, { ptPayable: 'u-pt' });
ok(withHead.lines.some((l) => l.accountId === 'u-pt' && l.amount === 200) && !withHead.lines.some((l) => l.accountId === '2207'), 'a resolved PT head replaces 2207');
ok(withHead.balanced, 'the booking still balances with the resolved head');

// ── DataContext wiring ────────────────────────────────────────────────────────────────────────────────
const dc = readFileSync(path.join(SRC, 'contexts/DataContext.tsx'), 'utf8');
ok(!/depositLiabilityAccount\(/.test(dc), 'DataContext no longer picks a deposit liability by bare id');
ok((dc.match(/resolveDepositLiabilityAccount\(/g) || []).length >= 3, 'DataContext resolves the deposit liability in open / deposit / interest');
ok(/MISSING_HEAD_TOAST\.pt/.test(dc) && (dc.match(/professionalTaxAccountId\(/g) || []).length >= 3, 'DataContext resolves the PT head in add + update and refuses when it is missing');
ok(!/accountId: '2207'/.test(dc), 'no bare 2207 PT line is built in DataContext');
const open = dc.slice(dc.indexOf('const addDepositAccount'), dc.indexOf('const postDepositTransaction'));
ok(open.indexOf('resolveDepositLiabilityAccount(') > 0 && open.indexOf('resolveDepositLiabilityAccount(') < open.indexOf('const acct: DepositAccount = {'), 'addDepositAccount refuses BEFORE it creates the account');

console.log(`head resolve: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
