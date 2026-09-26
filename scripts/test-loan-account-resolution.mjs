// H2-0a — member-loan / KCC postings land in the RIGHT ledger heads, on every shipped chart.
// The old `find(a => a.id === X || /name/.test(a.name))` returned the first account (by id order)
// matching EITHER test: interest → 2208 Interest Payable (liability), KCC principal → 2305 DCCB
// borrowing (liability), PACS member-loan principal → 3303 KCC head. This pins the fix.
// Run: node scripts/test-loan-account-resolution.mjs
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
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const R = await imp('src/lib/loans/accounts.ts');
const S = await imp('src/lib/storage.ts');
const charts = {
  CMS: S.CMS_SOCIETY_ACCOUNTS, PACS: S.PACS_SOCIETY_ACCOUNTS, CONSUMER: S.CONSUMER_SOCIETY_ACCOUNTS,
  DAIRY: (await imp('src/lib/templates/dairy.ts')).DAIRY_SOCIETY_ACCOUNTS,
  HOUSING: (await imp('src/lib/templates/housing.ts')).HOUSING_SOCIETY_ACCOUNTS,
  SUGAR: (await imp('src/lib/templates/sugar.ts')).SUGAR_SOCIETY_ACCOUNTS,
};

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const byId = (chart, id) => chart.find((a) => a.id === id);
const oldInterest = (c) => c.find((a) => a.id === '4408' || /interest/i.test(a.name))?.id || '4408';
const oldKcc = (c) => c.find((a) => a.id === '3313' || a.name.toLowerCase().includes('kcc') || a.name.toLowerCase().includes('crop loan'))?.id || '3313';
const sorted = (c) => [...c].sort((a, b) => a.id.localeCompare(b.id));   // accounts load `order by id`

for (const [name, raw] of Object.entries(charts)) {
  const c = sorted(raw);
  const i = R.interestIncomeAccountId(c), k = R.kccLoanAccountId(c), m = R.memberLoanAccountId(c);
  const ia = byId(c, i), ka = byId(c, k), ma = byId(c, m);
  ok(!ia || ia.type === 'income', `${name}: interest → income head (${i}${ia ? ' ' + ia.name : ''})`);
  ok(!ka || ka.type === 'asset', `${name}: KCC principal → asset head (${k}${ka ? ' ' + ka.name : ''})`);
  ok(!ma || ma.type === 'asset', `${name}: member-loan principal → asset head (${m}${ma ? ' ' + ma.name : ''})`);
  ok(![i, k, m].some((id) => ['2208', '2305'].includes(id)), `${name}: never 2208 Interest Payable / 2305 DCCB borrowing`);
  if (byId(c, '4408')) ok(i === '4408', `${name}: 4408 wins when present`);
  if (byId(c, '3304')) ok(m === '3304', `${name}: 3304 wins for member loans when present`);
}
// The defect existed on the standard chart (so the fix is not theoretical):
const cms = sorted(charts.CMS);
ok(oldInterest(cms) === '2208', 'old code on the CMS chart: interest → 2208 Interest Payable (the bug)');
ok(oldKcc(cms) === '2305', 'old code on the CMS chart: KCC principal → 2305 DCCB borrowing (the bug)');
const pacs = sorted(charts.PACS);
ok(R.kccLoanAccountId(pacs) === '3303' && R.memberLoanAccountId(pacs) === '3304', 'PACS: KCC → 3303 Short-term Loans (KCC), member loans → 3304');
ok(R.kccLoanAccountId(cms) === '3304', 'CMS (no KCC asset head): KCC → 3304 Loans & Advances');
// Group accounts / Hindi-only names
ok(R.interestIncomeAccountId([{ id: '4400', name: 'Interest & Other Income', type: 'income', isGroup: true }, { id: '4999', name: 'X', nameHi: 'ऋण पर ब्याज', type: 'income' }]) === '4999', 'group heads skipped; Hindi name matched');

// Wired: no old pattern left on the pages.
for (const f of ['src/pages/LoanRegister.tsx', 'src/pages/KccLoan.tsx']) {
  const s = readFileSync(pathResolve(ROOT, f), 'utf8');
  ok(!/a\.id === '4408' \|\|/.test(s) && !/a\.id === '3313' \|\|/.test(s) && !/a\.id === '3304' \|\|/.test(s), `${f}: no "id || name" first-match lookups left`);
  ok(/interestIncomeAccountId\(accounts\)/.test(s), `${f}: interest via the shared resolver`);
}
const kcc = readFileSync(pathResolve(ROOT, 'src/pages/KccLoan.tsx'), 'utf8');
ok((kcc.match(/kccLoanAccountId\(accounts\)/g) || []).length === 2, 'KCC disbursement AND repayment use the asset resolver');
ok(/if \(!voucherId\) \{[\s\S]{0,400}?KCC ऋण दर्ज नहीं हुआ[\s\S]{0,300}?return;/.test(kcc), 'KCC: no disbursement voucher ⇒ no loan');
ok(/if \(!voucherId\) \{[\s\S]{0,400}?चुकौती दर्ज नहीं हुई[\s\S]{0,300}?return;/.test(kcc), 'KCC: refused receipt ⇒ loan unchanged');
ok((kcc.match(/cancelVoucher\(voucherId,/g) || []).length >= 2, 'KCC: a failed loan save cancels the voucher it posted (RULE 1)');
ok(!/best-effort; loan record still updates/.test(kcc), 'no "best-effort, loan still updates" path left');

console.log(`loan account resolution: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
