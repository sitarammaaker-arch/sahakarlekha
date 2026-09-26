// Option C — Loan Interest page vs the rest of the app (RULE 2 / RULE 6 / false-success toast).
//  - Outstanding comes from the ONE formula (loanOutstanding); the 0-clamp is for INTEREST only.
//  - The page's card is the interest-bearing outstanding (active loans), labelled so, not a second
//    "total outstanding" that disagrees with the Loan Register.
//  - Posting checks FY lock first and never toasts success for a voucher addVoucher refused.
//  - Loan Register: repaid can't exceed the loan, principal can't exceed outstanding, and a refused
//    receipt voucher leaves the loan unchanged.
// Run: node scripts/test-loan-interest-consistency.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const li = strip('src/pages/LoanInterest.tsx');
// H2-1: the rows now come from the shared accrual lib, which uses the shared loanOutstanding.
const acc = strip('src/lib/loans/interestAccrual.ts');
ok(/import \{ loanOutstanding \} from '\.\.\/memberSnapshot'/.test(acc) && /accrualRows\(activeLoans, toDate, days\)/.test(li), 'LoanInterest rows via the shared accrual lib (shared loanOutstanding)');
ok(!/l(oan)?\.amount - \(l(oan)?\.repaidAmount/.test(li), 'no private outstanding formula left on the page');
ok(/const outstanding = Math\.max\(0, loanOutstanding\(l\)\)/.test(acc), 'interest rows: shared formula, clamped at 0 for interest only');
ok(/'ब्याज योग्य बकाया'/.test(li) && /value=\{fmt\(rows\.reduce\(\(s, r\) => s \+ r\.outstanding, 0\)\)\}/.test(li), 'card = interest-bearing outstanding (sum of the rows), labelled so');
ok(!/'कुल बकाया'/.test(li), 'no second "कुल बकाया" that disagrees with the Loan Register');
const post = li.slice(li.indexOf('const handlePost'), li.indexOf('const csvHeaders'));
ok(/if \(society\.fyLocked\)/.test(post) && post.indexOf('society.fyLocked') < post.indexOf('addVoucher('), 'FY-lock checked before posting (RULE 6)');
ok(/const v = addVoucher\(/.test(post) && /if \(!v\?\.id\)/.test(post), 'refused voucher detected');
ok(post.indexOf('if (!v?.id)') < post.indexOf('ब्याज जर्नल पोस्ट हो गया'), 'success toast only after the voucher exists');
ok(/अतिदेय ब्याज संचय" \(2211\)/.test(li) && /धारा 87 व्याख्या/.test(li), 'page states the s.87 overdue-interest treatment (H2-1 supersedes the interim note)');

const lr = strip('src/pages/LoanRegister.tsx');
const add = lr.slice(lr.indexOf('const handleAdd'), lr.indexOf('addLoan({'));
const edt = lr.slice(lr.indexOf('const handleEdit'), lr.indexOf('updateLoan(editLoan.id'));
for (const [name, blk] of [['add', add], ['edit', edt]]) ok(/\(Number\(form\.repaidAmount\) \|\| 0\) > Number\(form\.amount\) \+ 0\.005/.test(blk), `${name}: repaid > loan amount is refused`);
const rep = lr.slice(lr.indexOf('const recordRepayment'), lr.indexOf('updateLoan(loan.id'));
ok(/if \(principal > loanOutstanding\(loan\) \+ 0\.005\)/.test(rep), 'repayment: principal can\'t exceed outstanding');
ok(/posted = !!v\?\.id/.test(rep) && /if \(!posted\)[\s\S]*?return;/.test(rep), 'refused receipt voucher → loan left unchanged');
ok(!/catch \{ \/\* best-effort/.test(readFileSync(pathResolve(ROOT, 'src/pages/LoanRegister.tsx'), 'utf8')), 'no "best-effort, loan still updates" path');
ok(/const overPrincipal = principal > outstanding \+ 0\.005/.test(lr) && /\|\| overPrincipal\} onClick/.test(lr), 'repay dialog blocks + explains over-principal');

// The shared formula stays unclamped (a negative balance must stay visible where it is shown).
ok(/return loan\.amount - loan\.repaidAmount;/.test(strip('src/lib/memberSnapshot.ts')), 'loanOutstanding itself is unchanged');

console.log(`loan interest consistency: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
