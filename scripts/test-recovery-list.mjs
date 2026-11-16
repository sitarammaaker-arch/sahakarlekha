// Monthly recovery list (2026-11-16) — imports the REAL helpers via the '@/' loader.
//
// Guards:
//   - compulsory deposit due = the same arrears the collection sheet shows, as of the month's last day;
//   - loan principal due = equal monthly instalments fallen due − principal repaid, never above the outstanding;
//     nothing in the disbursement month; the whole outstanding from the due month on;
//   - cleared / deleted loans and closed deposit accounts never appear;
//   - interest comes only from what the caller says is accrued and unpaid; a member who owes nothing is left out;
//   - the table's totals equal the sum of its rows, and its notes say the list is a demand only.
//
// Run: node scripts/test-recovery-list.mjs   (npm run test:recovery-list)
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
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const R = await import(abs('../src/lib/recoveryList.ts'));
const CD = await import(abs('../src/lib/compulsoryDeposit.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Month helpers.
ok(R.monthEnd('2026-11') === '2026-11-30' && R.monthEnd('2026-02') === '2026-02-28' && R.monthEnd('2028-02') === '2028-02-29' && R.monthEnd('2026-12') === '2026-12-31', 'monthEnd, including a leap February');
ok(R.monthLabel('2026-11', false) === 'November 2026' && R.monthLabel('2026-11', true) === 'नवंबर 2026', 'monthLabel in both languages');

// 2. Loan instalment: 12,000 disbursed 2026-04-10, due 2027-04-10 → 12 instalments of 1,000 from May.
const loan = (o = {}) => ({ id: 'L1', loanNo: 'LN/001', memberId: 'm1', amount: 12000, repaidAmount: 0, disbursementDate: '2026-04-10', dueDate: '2027-04-10', status: 'active', ...o });
ok(R.loanInstalmentCount(loan()) === 12 && R.loanInstalment(loan()) === 1000, '12 equal instalments of 1,000');
ok(R.loanPrincipalDue(loan(), '2026-03') === 0, 'nothing before disbursement');
ok(R.loanPrincipalDue(loan(), '2026-04') === 0, 'nothing in the month of disbursement');
ok(R.loanPrincipalDue(loan(), '2026-05') === 1000, 'first instalment the month after');
ok(R.loanPrincipalDue(loan(), '2026-07') === 3000, 'three missed instalments add up');
ok(R.loanPrincipalDue(loan({ repaidAmount: 2000 }), '2026-07') === 1000, 'repaid principal is taken off');
ok(R.loanPrincipalDue(loan({ repaidAmount: 5000 }), '2026-07') === 0, 'paid ahead → nothing due, never negative');
ok(R.loanPrincipalDue(loan({ repaidAmount: 11500 }), '2027-01') === 0, 'paid ahead near the end → nothing due yet');
ok(R.loanPrincipalDue(loan({ repaidAmount: 11500 }), '2027-04') === 500, 'from the due month the whole outstanding is due');
ok(R.loanPrincipalDue(loan({ repaidAmount: 4000 }), '2027-09') === 8000, 'after the due date: all of the outstanding');
ok(R.loanPrincipalDue(loan({ status: 'cleared', repaidAmount: 12000 }), '2026-07') === 0, 'a cleared loan owes nothing');
ok(R.loanPrincipalDue(loan({ isDeleted: true }), '2026-07') === 0, 'a deleted loan owes nothing');
ok(R.loanPrincipalDue(loan({ repaidAmount: 12000 }), '2026-07') === 0, 'fully repaid owes nothing even if the status was not updated');
ok(R.loanPrincipalDue(loan({ status: 'overdue' }), '2026-07') === 3000, 'an overdue loan is still listed');
// Uneven division: 10,000 over 3 months → 3,333.33 a month, and the last month takes the remainder.
const l3 = loan({ amount: 10000, dueDate: '2026-07-10' });
ok(R.loanInstalment(l3) === 3333.33, 'instalment rounded to paise');
ok(R.loanPrincipalDue(l3, '2026-05') === 3333.33 && R.loanPrincipalDue(l3, '2026-06') === 6666.66 && R.loanPrincipalDue(l3, '2026-07') === 10000, 'the due month collects the rounding remainder');
ok(R.loanInstalmentCount({ disbursementDate: '2026-04-10', dueDate: '2026-04-25' }) === 1, 'a loan due in the same month is one instalment');
ok(R.loanInstalmentCount({ disbursementDate: '2026-04-10', dueDate: '' }) === 1, 'no due date → one instalment');

// 2b. A monthly instalment FIXED on the loan (column 170) replaces the derived one; a loan without one is unchanged.
ok(R.hasFixedInstalment({ monthlyInstallment: 1500 }) && !R.hasFixedInstalment({}) && !R.hasFixedInstalment({ monthlyInstallment: null }) && !R.hasFixedInstalment({ monthlyInstallment: 0 }), 'fixed = a positive amount; missing / null / 0 = not fixed');
ok(R.loanInstalment(loan({ monthlyInstallment: 1500 })) === 1500 && R.derivedLoanInstalment(loan({ monthlyInstallment: 1500 })) === 1000, 'the fixed instalment wins over the derived 1,000');
ok(R.loanInstalment(loan()) === 1000 && R.loanInstalment(loan({ monthlyInstallment: null })) === 1000 && R.loanInstalment(loan({ monthlyInstallment: 0 })) === 1000, 'no fixed instalment → derived, exactly as before');
ok(R.loanInstalment(loan({ monthlyInstallment: 99999 })) === 12000, 'an instalment above the loan is capped at the loan');
const fx = loan({ monthlyInstallment: 1500 });
ok(R.loanPrincipalDue(fx, '2026-04') === 0 && R.loanPrincipalDue(fx, '2026-05') === 1500 && R.loanPrincipalDue(fx, '2026-07') === 4500, 'fixed 1,500 a month from the month after disbursement');
ok(R.loanPrincipalDue(loan({ monthlyInstallment: 1500, repaidAmount: 3000 }), '2026-07') === 1500, 'principal repaid is taken off the fixed schedule too');
ok(R.loanPrincipalDue(fx, '2026-12') === 12000, 'fixed 1,500 × 8 months reaches the whole loan — never more than the outstanding');
ok(R.loanPrincipalDue(loan({ monthlyInstallment: 500, repaidAmount: 1000 }), '2026-07') === 500, 'a small fixed instalment: 3 × 500 due, 1,000 repaid → 500');
ok(R.loanPrincipalDue(loan({ monthlyInstallment: 500, repaidAmount: 1000 }), '2027-04') === 11000, 'a small instalment does not stretch the term: from the due month the whole outstanding is due');
ok(R.loanPrincipalDue(loan({ monthlyInstallment: 1500, status: 'cleared', repaidAmount: 12000 }), '2026-07') === 0, 'a cleared loan owes nothing, fixed instalment or not');
const fixedRows = R.recoveryRows({ month: '2026-07', depositAccounts: [], depositTransactions: [], loans: [fx, loan({ id: 'L9', loanNo: 'LN/009', memberId: 'm9' })], interestDueOf: () => 0 });
ok(fixedRows.find((r) => r.memberId === 'm1').loanPrincipal === 4500 && fixedRows.find((r) => r.memberId === 'm9').loanPrincipal === 3000, 'in one list: a fixed-instalment loan and a derived one, each by its own rule');

// 3. Rows.
const depositAccounts = [
  { id: 'a1', memberId: 'm1', depositType: 'CD', status: 'active', openDate: '2026-09-05', installmentAmount: 500 },
  { id: 'a2', memberId: 'm2', depositType: 'CD', status: 'active', openDate: '2026-11-01', installmentAmount: 300 },
  { id: 'a3', memberId: 'm3', depositType: 'CD', status: 'closed', openDate: '2026-04-01', installmentAmount: 400 },
  { id: 'a4', memberId: 'm4', depositType: 'SB', status: 'active', openDate: '2026-04-01', installmentAmount: 900 },
];
const depositTransactions = [
  { depositAccountId: 'a1', date: '2026-09-05', txnType: 'open', amount: 500 },
  { depositAccountId: 'a2', date: '2026-11-01', txnType: 'open', amount: 300 },
];
const loans = [
  loan(),                                                              // m1: 7 instalments by Nov = 7,000
  loan({ id: 'L2', loanNo: 'LN/002', memberId: 'm5', amount: 6000, disbursementDate: '2026-10-01', dueDate: '2027-04-01' }),   // m5: 1,000
  loan({ id: 'L3', loanNo: 'LN/003', memberId: 'm6', status: 'cleared', repaidAmount: 12000 }),
  loan({ id: 'L4', loanNo: 'LN/004', memberId: 'm1', amount: 2400, disbursementDate: '2026-10-15', dueDate: '2027-10-15' }),   // m1 second loan: 200
];
const interest = { L1: 150.5, L2: 0, L3: 99, L4: 10 };
const rows = R.recoveryRows({ month: '2026-11', depositAccounts, depositTransactions, loans, interestDueOf: (id) => interest[id] ?? 0 });
const by = Object.fromEntries(rows.map((r) => [r.memberId, r]));
ok(Object.keys(by).sort().join() === 'm1,m5', 'only members who owe something: m2 is paid up, m3 closed, m4 savings only, m6 cleared');
ok(by.m1.compulsoryDeposit === 1000, 'm1 compulsory deposit: Sep–Nov due 1,500, paid 500');
ok(by.m1.compulsoryDeposit === CD.compulsoryArrears(depositAccounts[0], depositTransactions, '2026-11-30').arrears, 'same figure as the collection sheet');
ok(by.m1.loanPrincipal === 7200 && by.m1.loanInterest === 160.5 && by.m1.loanNos.join() === 'LN/001,LN/004', 'm1: two loans added together');
ok(by.m1.total === 8360.5, 'm1 total = deposit + principal + interest');
ok(by.m5.compulsoryDeposit === 0 && by.m5.loanPrincipal === 1000 && by.m5.loanInterest === 0 && by.m5.total === 1000, 'm5: a loan only');
ok(!rows.some((r) => r.memberId === 'm6'), 'interest on a cleared loan is not demanded');
// A loan with only interest due (principal paid ahead) still appears.
const intOnly = R.recoveryRows({ month: '2026-05', depositAccounts: [], depositTransactions: [], loans: [loan({ repaidAmount: 5000 })], interestDueOf: () => 75 });
ok(intOnly.length === 1 && intOnly[0].loanPrincipal === 0 && intOnly[0].loanInterest === 75 && intOnly[0].total === 75, 'interest alone puts the member on the list');
ok(R.recoveryRows({ month: '2026-11', depositAccounts: [], depositTransactions: [], loans: [], interestDueOf: () => 0 }).length === 0, 'nothing owed → empty list');
// An earlier month shows that month's position, not today's.
const sep = R.recoveryRows({ month: '2026-09', depositAccounts, depositTransactions, loans, interestDueOf: () => 0 });
ok(sep.length === 1 && sep[0].memberId === 'm1' && sep[0].compulsoryDeposit === 0 && sep[0].loanPrincipal === 5000, 'September: deposit paid for the month, five loan instalments, later loans not yet disbursed');

// 4. Table.
const names = { m1: { memberNo: 'M010', name: 'Member Ten' }, m5: { memberNo: 'M002', name: 'Member Two' } };
const t = R.recoveryListTable(rows, '2026-11', (id) => names[id]);
ok(t.columns.length === 8 && t.rowsEn.length === 2, 'eight columns, one row per member');
ok(t.rowsEn[0][1] === 'M002' && t.rowsEn[1][1] === 'M010' && t.rowsEn[0][0] === 1 && t.rowsEn[1][0] === 2, 'sorted by member number, serial numbers follow');
const tot = R.recoveryTotals(rows);
ok(tot.compulsoryDeposit === 1000 && tot.loanPrincipal === 8200 && tot.loanInterest === 160.5 && tot.total === 9360.5, 'totals');
ok(t.totals[4] === tot.compulsoryDeposit && t.totals[5] === tot.loanPrincipal && t.totals[6] === tot.loanInterest && t.totals[7] === tot.total, 'the totals row is the sum of the rows');
ok(tot.total === Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100, 'grand total = sum of member totals');
ok(/November 2026/.test(t.subtitle) && /2026-11-30/.test(t.subtitle), 'subtitle names the month and the as-on date');
ok(t.notes.some((n) => /demand only/i.test(n.en) && /केवल माँग/.test(n.hi)), 'says it is a demand only');
ok(t.notes.some((n) => /monthly instalment entered on the loan/i.test(n.en) && /equal monthly instalments/i.test(n.en) && /ऋण पर दर्ज मासिक किस्त/.test(n.hi)), 'says the instalment is the one on the loan, and how it is derived where none is entered');
ok(t.notes.some((n) => /not yet accrued is not included/i.test(n.en)), 'says un-accrued interest is not included');

// 5. Items (the unit the recovery is posted in) — and the rows are built from them.
const input = { month: '2026-11', depositAccounts: depositAccounts.map((a) => ({ ...a, accountNo: 'CD/' + a.id })), depositTransactions, loans, interestDueOf: (id) => interest[id] ?? 0 };
const items = R.recoveryItems(input);
ok(items.map((i) => i.key).join() === 'cd:a1,loan:L1,loan:L2,loan:L4', 'one item per compulsory deposit account and per loan with something due');
const cdItem = items[0], l1 = items[1];
ok(cdItem.kind === 'cd' && cdItem.depositAccountId === 'a1' && cdItem.due === 1000 && cdItem.label === 'CD/a1', 'deposit item carries its account and what is due');
ok(l1.kind === 'loan' && l1.loanId === 'L1' && l1.principalDue === 7000 && l1.interestDue === 150.5 && l1.label === 'LN/001', 'loan item carries principal and interest due separately');
const sumItems = items.reduce((s, i) => s + (i.kind === 'cd' ? i.due : i.principalDue + i.interestDue), 0);
ok(Math.round(sumItems * 100) / 100 === R.recoveryTotals(R.recoveryRows(input)).total, 'the items add up to the list total — one source for both');

// 6. Posting plan: what was typed → what gets posted.
const def = R.defaultRecoveryEntries(items);
ok(def['cd:a1'].deposit === 1000 && def['loan:L1'].principal === 7000 && def['loan:L1'].interest === 150.5, 'the recording step starts with exactly what is due');
const full = R.recoveryPostPlan(items, def);
ok(full.actions.length === 4 && full.total === R.recoveryTotals(R.recoveryRows(input)).total, 'posting everything due = the list total');
const a1 = full.actions.find((a) => a.key === 'cd:a1'), aL1 = full.actions.find((a) => a.key === 'loan:L1');
ok(a1.kind === 'cd' && a1.depositAccountId === 'a1' && a1.amount === 1000, 'deposit action: account + amount');
ok(aL1.kind === 'loan' && aL1.loanId === 'L1' && aL1.total === 7150.5 && aL1.interest === 150.5, 'loan action: total = principal + interest, interest stated');
// Partial / nothing received.
const part = R.recoveryPostPlan(items, { 'cd:a1': { deposit: '500' }, 'loan:L1': { principal: '1000', interest: '' }, 'loan:L2': { principal: 0, interest: 0 }, 'loan:L4': { principal: '', interest: '10' } });
ok(part.actions.length === 3 && part.total === 1510, 'typed strings are read as amounts; an item with nothing entered posts nothing');
ok(!part.actions.some((a) => a.key === 'loan:L2'), 'zero received → no entry');
ok(part.actions.find((a) => a.key === 'loan:L4').total === 10 && part.actions.find((a) => a.key === 'loan:L4').interest === 10, 'interest alone is a valid recovery');
const junk = R.recoveryPostPlan(items, { 'cd:a1': { deposit: '-50' }, 'loan:L1': { principal: 'abc', interest: undefined }, 'nope': { deposit: 999 } });
ok(junk.actions.length === 0 && junk.total === 0, 'negative, non-numeric and unknown-item entries post nothing');
ok(R.recoveryPostPlan(items, {}).actions.length === 0, 'nothing entered → nothing posted');
ok(R.recoveryPostPlan(items, { 'cd:a1': { deposit: 100.456 } }).actions[0].amount === 100.46, 'amounts rounded to paise');

// A principal above the loan's outstanding is caught before anything is posted, with the loan named.
const outstanding = { L1: 12000, L2: 6000, L4: 2400 };
ok(R.recoveryEntryProblems(items, def, (id) => outstanding[id]).length === 0, 'what is due never exceeds the outstanding');
ok(R.recoveryEntryProblems(items, { ...def, 'loan:L1': { principal: 12000.01 } }, (id) => outstanding[id]).join() === 'LN/001', 'principal above the outstanding is named');
ok(R.recoveryEntryProblems(items, { ...def, 'loan:L1': { principal: 12000, interest: 99999 } }, (id) => outstanding[id]).length === 0, 'extra interest is never a problem — only principal is capped');
ok(R.recoveryEntryProblems(items, { 'cd:a1': { deposit: 999999 } }, (id) => outstanding[id]).length === 0, 'a deposit has no upper limit');

// 7. Wiring: the screen posts through the two existing routines — never its own vouchers.
const { readFileSync } = await import('node:fs');
// Normalise line endings: a Windows checkout has CRLF, and the patterns below span lines.
const src = (f) => readFileSync(pathResolve(HERE, '..', f), 'utf8').replace(/\r\n/g, '\n');
const dep = src('src/pages/Deposits.tsx');
const post = dep.slice(dep.indexOf('const postRecovery = () => {'), dep.indexOf('// ── Deposit / Withdraw dialog'));
ok(/postDepositTransaction\(a\.depositAccountId, 'deposit', a\.amount, rlMode, rlDate\)/.test(post), 'compulsory deposit goes through postDepositTransaction');
ok(/recordRepayment\(loan, a\.total, a\.interest, rlMode, rlDate, \{ silent: true \}\)/.test(post), 'loan goes through the shared repayment routine');
ok(/const recordRepayment = useLoanRepayment\(/.test(dep) && !/addVoucher/.test(dep), 'the Deposits screen makes no voucher of its own');
ok(/if \(done > 0\) setRlPosting\(false\);/.test(post) && /failed > 0\) toast\(/.test(post) && /failedLabels\.join\(', '\)/.test(post), 'success is claimed only for what posted; what did not post is named');
ok(post.indexOf('recoveryEntryProblems(') > 0 && post.indexOf('recoveryEntryProblems(') < post.indexOf('for (const a of rlPlan.actions)'), 'entries are checked before the first posting');
ok(/\{canEdit && <Button size="sm" className="gap-1" onClick=\{startRlPosting\}/.test(dep), 'recording is offered only to a user who may edit');
const hook = src('src/hooks/useLoanRepayment.ts');
ok(/if \(society\.fyLocked\)[^\n]*return false;/.test(hook) && /return true;\n  \};\n  return recordRepayment;/.test(hook), 'shared repayment: FY-lock guard, true only at the end');
ok(/const recordRepayment = useLoanRepayment\(dueOf\);/.test(src('src/pages/LoanRegister.tsx')), 'Loan Register uses the same routine');

// 8. Monthly instalment (column 170): RULE 1 wiring, migration, form.
const dcx = src('src/contexts/DataContext.tsx').replace(/\r\n/g, '\n');
const addL = dcx.slice(dcx.indexOf('const addLoan = useCallback('), dcx.indexOf('// M16: Create disbursement voucher'));
const updL = dcx.slice(dcx.indexOf('const updateLoan = useCallback('), dcx.indexOf('const deleteLoan = useCallback('));
const svI = dcx.slice(dcx.indexOf('const saveLoanInstalment ='), dcx.indexOf('const addLoan = useCallback('));
ok(/monthlyInstallment: loanInstalmentToSave, \.\.\.loanBase \} = loanToSave;/.test(addL) && /upsert\(withSoc\(loanBase\)\)/.test(addL), 'addLoan: the instalment is not in the base upsert');
ok(/if \(!error && loanInstalmentToSave\) saveLoanInstalment\(newLoan\.id, loanInstalmentToSave, null\);/.test(addL), 'addLoan: instalment saved in step 2, only when one was entered');
ok(/monthlyInstallment: updatedInstalment, \.\.\.updatedBase \} = updated;/.test(updL) && /upsert\(withSoc\(updatedBase\)\)/.test(updL), 'updateLoan: the instalment is not in the base upsert');
ok(/if \(!error && instalmentChanged && \(updatedInstalment \?\? null\) !== \(before\.monthlyInstallment \?\? null\)\) saveLoanInstalment\(/.test(updL), 'updateLoan: step 2 only when the instalment really changed (no write, no error, on a database without the column)');
ok(/\.update\(\{ monthlyInstallment \}\)\.eq\('id', loanId\)\.eq\('society_id', societyIdRef\.current\)/.test(svI) && !/sureties/.test(svI.slice(0, svI.indexOf('const cleanInstalment'))), 'its own update — never in the same write as the sureties');
ok(/monthlyInstallment: restore \} : l\)\)/.test(svI) && /migration 170/.test(svI) && /variant: 'destructive', duration: 15000/.test(svI), 'a failed step 2 restores the screen and names migration 170');
ok(/if \(instalment === null \|\| instalment <= amount \+ 0\.005\) return false;/.test(svI) && /refuseBadInstalment\(cleanInstalment\(data\.monthlyInstallment\), data\.amount\)/.test(addL), 'an instalment above the loan amount is refused before the loan is created');
const mig170 = src('supabase/migrations/170_loan_monthly_instalment.sql');
ok(/alter table public\.loans add column if not exists "monthlyInstallment" numeric;/.test(mig170) && /^begin;/m.test(mig170) && /^commit;/m.test(mig170), 'migration 170 adds the column, idempotently, in a transaction');
ok(/drop column if exists "monthlyInstallment";/.test(src('supabase/migrations/170_loan_monthly_instalment_down.sql')) && /alter table loans add column if not exists "monthlyInstallment" numeric;/.test(src('supabase-tables.sql')), 'down migration and supabase-tables.sql know the column');
ok(/money\('monthlyInstallment', 'Monthly Instalment', 'मासिक किस्त'\)/.test(src('src/lib/export/entities/lending.ts')), 'export registry carries the column (a backup keeps it)');
const lrx = src('src/pages/LoanRegister.tsx');
ok((lrx.match(/monthlyInstallment: Number\(form\.monthlyInstallment\) > 0 \? Number\(form\.monthlyInstallment\) : null,/g) || []).length === 2 && (lrx.match(/if \(instalmentError\(\)\) return;/g) || []).length === 2, 'the loan form passes the instalment on add and edit, blank as "not fixed"');
ok(/monthlyInstallment: Number\(l\.monthlyInstallment\) > 0 \? String\(l\.monthlyInstallment\) : '',/.test(lrx), 'the edit form loads it');

console.log(`\nrecovery-list: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
