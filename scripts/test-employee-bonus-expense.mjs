// Employee bonus = an EXPENSE deducted before net profit (Haryana Co-operative Societies Act 1984,
// s.87 Explanation (i)), not an appropriation of net surplus. Legacy (Dr 1208) years keep working
// and are subtracted once; new (Dr 5207) postings are already inside net profit and are NOT
// subtracted again. The bonus is dated inside its FY. The confirm dialog shows what really posts.
// Run: node scripts/test-employee-bonus-expense.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const pd = strip('src/pages/ProfitDistribution.tsx');
ok(/const ACC_BONUS_EXPENSE = '5207';/.test(pd), 'bonus expense head 5207');
const post = pd.slice(pd.indexOf('if (!bonusPosted && bonusAmount > 0) {'), pd.indexOf('setConfirmOpen(false);', pd.indexOf('if (!bonusPosted && bonusAmount > 0) {')));
ok(/debitAccountId: ACC_BONUS_EXPENSE,\s*creditAccountId: ACC_BONUS_PAYABLE/.test(post), 'posts Dr 5207 Employee Bonus / Cr 2103');
ok(!/debitAccountId: ACC_NET_SURPLUS/.test(post), 'no longer an appropriation of net surplus (Dr 1208)');
ok(/s\.87 Explanation \(i\)/.test(post), 'narration cites s.87 Explanation (i)');
ok(/const bonusDate = fyEnd && today > fyEnd \? fyEnd : today;/.test(post) && /date: bonusDate/.test(post), 'dated inside its FY (FY end once the year is over)');
ok(/const legacyBonusVoucher\s+= usePosted\(vouchers, ACC_NET_SURPLUS, ACC_BONUS_PAYABLE, fy\)/.test(pd) && /const expenseBonusVoucher\s+= usePosted\(vouchers, ACC_BONUS_EXPENSE, ACC_BONUS_PAYABLE, fy\)/.test(pd), 'recognises both legacy and expense postings');
ok(/const postedBonus\s+= legacyBonusVoucher\?\.amount \|\| 0;/.test(pd), 'only a LEGACY bonus is subtracted from distributable (an expense is already in net profit)');
ok(/Dr 5207 Employee Bonus \(expense\)/.test(pd) && /Cr 2103 Salary \/ Staff Payable/.test(pd) && !/Dr 1208 Net Surplus &nbsp;\{fmt\(bonusAmount\)\}/.test(pd), 'confirm dialog shows what really posts (it used to show Cr 5207 while posting Cr 2103)');
ok(/संचय \/ शिक्षा निधि आवंटन से पहले पोस्ट करें/.test(readFileSync(pathResolve(ROOT, 'src/pages/ProfitDistribution.tsx'), 'utf8')), 'user told to post the bonus before reserve / education appropriation');

// 5207 reaches every society
const st = readFileSync(pathResolve(ROOT, 'src/lib/storage.ts'), 'utf8');
const toAdd = st.slice(st.indexOf('const ACCOUNTS_TO_ADD'), st.indexOf('];', st.indexOf('const ACCOUNTS_TO_ADD')));
ok(/id: '5207', name: 'Employee Bonus'[^\n]*type: 'expense'/.test(toAdd), '5207 Employee Bonus (expense) is auto-added to every society');

console.log(`employee bonus as expense: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
