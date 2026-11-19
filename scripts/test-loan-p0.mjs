// LOAN-01..05 (product audit 2026-11-17) — member loans and KCC.
//   LOAN-01  overlapping accrual periods were both accepted (the "posted" check matched only the exact start date)
//            → a loan with a LIVE accrual overlapping the window is left out (loansAccruedInPeriod).
//   LOAN-02  an accrual for any period used TODAY's outstanding → the outstanding AS ON the period end
//            (loanOutstandingAt: repayments dated after it are added back).
//   LOAN-03  a repayment taken while the accrual list had failed to load booked accrued interest to income twice
//            → useLoanAccruals reports `ready`; interest is refused until it is.
//   LOAN-04  a repayment cancelled from the Vouchers page (the documented undo) left repaidAmount up; reverse / edit
//            moved the ledger alone → the register follows a confirmed cancel; reverse / edit refused.
//   LOAN-05  a late refusal never reached the register → onFailed withdraws the other voucher and moves it back.
// Run: node scripts/test-loan-p0.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const L = await imp('src/lib/loans/interestAccrual.ts');

const isIncome = (id) => id === '4408' || id === '4409';
const loan = { id: 'LN1', loanNo: 'L/1', memberId: 'M1', amount: 10000, repaidAmount: 6000, interestRate: 12, status: 'active', disbursementDate: '2026-04-01' };
const rcpt = (id, date, principal, interestRec = 0, income = 0, extra = {}) => ({
  id, date, amount: principal + interestRec + income, refType: 'loan.repayment', refId: 'LN1',
  lines: [{ accountId: '3301', type: 'Dr', amount: principal + interestRec + income }, { accountId: '3304', type: 'Cr', amount: principal },
    ...(interestRec ? [{ accountId: '3313', type: 'Cr', amount: interestRec }] : []), ...(income ? [{ accountId: '4408', type: 'Cr', amount: income }] : [])],
  ...extra,
});

// ── LOAN-04 helper: the principal of a receipt ──
{
  ok(L.loanRepaymentPrincipal(rcpt('r', '2026-06-15', 4000, 150, 50), isIncome) === 4000, 'principal = Cr legs that are neither 3313 nor income');
  ok(L.loanRepaymentPrincipal(rcpt('r', '2026-06-15', 0, 0, 300), isIncome) === 0, 'an interest-only receipt has no principal');
}

// ── LOAN-02: outstanding as on a date ──
{
  const vouchers = [rcpt('r1', '2026-06-15', 4000, 0, 200), rcpt('r2', '2026-05-10', 2000), rcpt('r3', '2026-08-01', 999, 0, 0, { isDeleted: true })];
  ok(L.loanOutstandingAt(loan, '2026-05-31', vouchers, isIncome) === 8000, 'on 31 May: today\'s 4,000 + the 4,000 repaid on 15 June (the cancelled one ignored)');
  ok(L.loanOutstandingAt(loan, '2026-07-01', vouchers, isIncome) === 4000, 'on 1 July: today\'s 4,000');
  ok(L.loanOutstandingAt(loan, '2026-05-01', vouchers, isIncome) === 10000, 'on 1 May: before both repayments → the full 10,000');
  const cleared = { ...loan, repaidAmount: 10000, status: 'cleared' };
  const rows = L.accrualRows([cleared], '2026-05-31', 30, '365', undefined, (l) => L.loanOutstandingAt(l, '2026-05-31', [rcpt('r9', '2026-06-20', 5000)], isIncome));
  ok(rows.length === 1 && rows[0].outstanding === 5000 && rows[0].interest > 0, 'a loan cleared since still owes the period\'s interest, on what it owed then');
  ok(L.accrualRows([cleared], '2026-05-31', 30).length === 0, 'without outstandingOf, the old behaviour (today\'s figure) is unchanged');
}

// ── LOAN-01: overlapping periods ──
{
  const acc = (id, loanId, from, to, voucherId, extra = {}) => ({ id, loanId, memberId: 'M1', periodFrom: from, periodTo: to, days: 30, outstanding: 1, ratePa: 12, amount: 10, overdue: false, recovered: 0, voucherId, ...extra });
  const vouchers = [{ id: 'J1', amount: 10 }, { id: 'J2', amount: 10, isDeleted: true }, { id: 'J3', amount: 10 }];
  const accruals = [acc('a1', 'LN1', '2026-04-01', '2026-04-30', 'J1'), acc('a2', 'LN2', '2026-04-01', '2026-04-30', 'J2'), acc('a3', 'LN3', '2026-03-01', '2026-03-31', 'J3'), acc('a4', 'LN4', '2026-04-10', '2026-04-20', null)];
  const hit = L.loansAccruedInPeriod(accruals, vouchers, '2026-04-15', '2026-05-14');
  ok(hit.has('LN1'), 'a live accrual 1–30 April overlaps 15 April–14 May → that loan is left out');
  ok(!hit.has('LN2'), 'an accrual whose journal was cancelled does not count');
  ok(!hit.has('LN3'), 'March does not overlap');
  ok(!hit.has('LN4'), 'an accrual never linked to a journal does not count');
  const li = read('src/pages/LoanInterest.tsx');
  ok(/const accrual = useMemo\(\(\) => accrualAll\.filter\(r => !alreadyAccrued\.has\(r\.loanId\)\)/.test(li) && /const kccAccrual = useMemo\(\(\) => kccAccrualAll\.filter\(r => !alreadyAccrued\.has\(r\.loanId\)\)/.test(li), 'Loan Interest drops overlapping loans (member loans and KCC)');
  ok(/data-testid="accrual-overlap-skipped"/.test(li), 'and says how many were left out');
  ok(/loanOutstandingAt\(l, toDate, vouchers, isIncomeAcc\)/.test(li), 'and accrues on the outstanding as on the period end');
}

// ── LOAN-03: interest refused until the accruals are really loaded ──
{
  const h = read('src/hooks/useLoanAccruals.ts');
  ok(/return \{ accruals, loaded, failed, ready: loaded && !failed, saveAccruals \};/.test(h), 'useLoanAccruals reports ready (loaded and not failed)');
  const rep = read('src/hooks/useLoanRepayment.ts');
  ok(/if \(interest > 0 && !accrualsReady\) \{[\s\S]{0,700}?return false;/.test(rep), 'member-loan repayment: interest refused while the accruals are not ready');
  ok(/useLoanRepayment\(dueOf, accrualsReady\)/.test(read('src/pages/LoanRegister.tsx')) && /accrualsReady\);/.test(read('src/pages/Deposits.tsx')), 'both callers pass it');
  ok(/if \(interest > 0 && !accrualsReady\) \{/.test(read('src/pages/KccLoan.tsx')), 'KCC repayment: the same refusal');
}

// ── LOAN-04: the register follows a confirmed cancel; reverse / edit refused ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok((dc.match(/if \(!opts\?\.viaParent\) loanFollowsCancel\(current\);/g) || []).length === 3, 'every confirmed cancel path (posting service, journal-first, default) lets the register follow — direct cancels only');
  const f = dc.slice(dc.indexOf('const loanFollowsCancel = '), dc.indexOf('const cancelVoucher = useCallback('));
  ok(/loanRepaymentPrincipal\(v,/.test(f) && /updateLoanRef\.current\(loan\.id, \{ repaidAmount: back/.test(f), 'member loan: principal back on the loan');
  ok(/from\('kcc_loans'\)\.update\(patch\)/.test(f) && /outstandingAmount: out/.test(f), 'KCC: repaid down, outstanding up');
  ok(/x\.groupId === v\.groupId && x\.refType === REF_LOAN_INTEREST_RELEASE/.test(f), 'the repayment\'s own reserve release is cancelled with it');
  ok(/updateLoanRef\.current = updateLoan;/.test(dc), 'the ref points at updateLoan');
  ok(/if \(!opts\?\.viaParent && guardLoanVoucher\(id, \{ hi: 'बदला', en: 'changed' \}\)\) return false;/.test(dc) && /if \(!opts\?\.engine && guardLoanVoucher\(id, \{ hi: 'reverse', en: 'reversed' \}\)\) return null;/.test(dc), 'loan vouchers cannot be reversed or edited from the Vouchers page');
}

// ── LOAN-05: a late refusal reaches the register ──
{
  const rep = read('src/hooks/useLoanRepayment.ts');
  ok((rep.match(/\{ onFailed: onLateRefusal \}/g) || []).length === 2 && (rep.match(/groupId,\n/g) || []).length >= 2, 'member loan: receipt and release both report a late refusal and share a groupId');
  ok(/if \(refusedOnce\) return;/.test(rep) && /updateLoan\(cur\.id, \{ repaidAmount: back/.test(rep) && /loansLatest\.current\.find/.test(rep), 'once: the other voucher withdrawn, repaidAmount back from the LATEST row');
  ok(/cancelVoucher\(receiptId, 'Reserve release failed — auto-cancelled', user\?\.name \?\? 'System', \{ viaParent: true \}\)/.test(rep), 'the routine\'s own auto-cancel is viaParent (the register must not "follow" a loan it never moved)');
  const k = read('src/pages/KccLoan.tsx');
  ok((k.match(/\{ onFailed: onLateRefusal \}/g) || []).length === 2 && /if \(loanMoved && principal > 0\)/.test(k), 'KCC: the same, moving back only a row that was moved');
  ok((k.match(/auto-cancelled', user\?\.name \|\| 'System', \{ viaParent: true \}\)/g) || []).length === 3, 'KCC: all three auto-cancels are viaParent');
}

console.log(`LOAN-01..05: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
