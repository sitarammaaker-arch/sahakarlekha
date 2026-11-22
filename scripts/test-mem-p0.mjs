// MEM-01..05 (product audit 2026-11-17) — the member / share P0s.
//   MEM-01  old members enter the share register with no ledger entry (by rule) and nothing said the opening balance
//           was missing → Share Register banner with the exact gap at FY start.
//   MEM-02  Reverse worked on a member's system share vouchers → refused (guardMemberShareVoucher).
//   MEM-03  those vouchers were editable from the Vouchers page → refused; the member edit itself passes viaParent.
//   MEM-04  share operations ignored a late refusal (share capital moved, voucher rolled back) → moved back.
//   MEM-05  a duplicate dividend-run save was read as "table missing" and a SECOND dividend journal posted → refused.
// Run: node scripts/test-mem-p0.mjs
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
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {}; export const supabaseLoose = supabase;' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const { isMemberShareVoucher } = await imp('src/lib/members/memberShareVoucher.ts');
const { classifyRunSaveError } = await imp('src/lib/distribution/runSaveError.ts');
const { historicalShareGap } = await imp('src/lib/members/historicalShareGap.ts');
const dc = read('src/contexts/DataContext.tsx');

// ── MEM-02 / MEM-03: which vouchers are a member's system share vouchers ──
{
  const v = (o) => ({ id: 'v', voucherNo: 'V', type: 'receipt', date: '2026-05-01', amount: 500, narration: '', debitAccountId: '3301', creditAccountId: '1102', memberId: 'M1', ...o });
  ok(isMemberShareVoucher(v({})), 'a joining / additional share receipt (Cr 1102, member) is one');
  ok(isMemberShareVoucher(v({ debitAccountId: '1102', creditAccountId: '3301' })), 'a refund / share operation (Dr 1102) is one');
  ok(isMemberShareVoucher(v({ creditAccountId: '4407' })), 'an admission-fee receipt (Cr 4407) is one');
  ok(isMemberShareVoucher(v({ debitAccountId: '2111', creditAccountId: '3301', refType: 'share.refund.pay' })), 'a share-refund PAYMENT (no 1102 leg) is one, by its refType');
  ok(isMemberShareVoucher(v({ debitAccountId: '9999', refType: 'share.transfer' })), 'a share-transfer half is one');
  ok(!isMemberShareVoucher(v({ origin: 'manual' })), 'a hand-made voucher never moved the register — it stays editable');
  ok(!isMemberShareVoucher(v({ memberId: undefined })), 'no member → not one');
  ok(!isMemberShareVoucher(v({ creditAccountId: '4401' })), 'a member\'s other receipt (not 1102 / 4407) is not one');
  ok(/if \(!opts\?\.viaParent && guardMemberShareVoucher\(id, \{ hi: 'बदला', en: 'changed' \}\)\) return false;/.test(dc), 'MEM-03: updateVoucher refuses it (unless viaParent)');
  ok(/if \(!opts\?\.engine && guardMemberShareVoucher\(id, \{ hi: 'reverse', en: 'reversed' \}\)\) return null;/.test(dc), 'MEM-02: reverseVoucher refuses it');
  ok(/narration: `\$\{kind\} updated for \$\{updatedMember\.name\}` \}, \{ viaParent: true \}\);/.test(dc), 'the member edit (the owning screen) still re-syncs its own voucher');
}

// ── MEM-04: share operations put the member back on a late refusal ──
{
  ok(/const undoShareDeltas = \(deltas: \{ memberId: string; deltaMinor: number \}\[\], forward: Promise<boolean>/.test(dc), 'one undo helper, written strictly after the forward member save');
  const undo = dc.slice(dc.indexOf('const undoShareDeltas'), dc.indexOf('const approveShareRefund'));
  ok(/forward\.then\(\(ok\) => \{\s*if \(!ok\) return;/.test(undo), 'no second undo when the forward save already failed and rolled itself back');
  ok(/membersRef\.current\.find\(m => m\.id === d\.memberId\)/.test(undo) && /subMinor\(toMinor\(cur\.shareCapital \|\| 0\), d\.deltaMinor\)/.test(undo), 'the delta is taken back from the LATEST row');
  const fnBody = (name) => dc.slice(dc.indexOf(`const ${name} = useCallback(`), dc.indexOf('\n  }, [', dc.indexOf(`const ${name} = useCallback(`)));
  for (const fn of ['approveShareRefund', 'shareOperation', 'purchaseShareCapital']) {
    const b = fnBody(fn);
    ok(/onFailed: \(\) => undoShareDeltas\(/.test(b) && /markForward\(!error\)/.test(b) && /markForward\(false\)/.test(b), `${fn}: a late refusal undoes the share move (forward resolved on every path)`);
  }
  const t = fnBody('transferShareCapital');
  ok((t.match(/\{ onFailed: onRefused \}/g) || []).length === 3, 'transferShareCapital: all three vouchers report a refusal');
  ok(/if \(refusedOnce\) return;/.test(t) && /cancelLinkedVouchers\(live, 'Share transfer voucher refused by the server/.test(t), 'once: both members back, the other halves unwound');
  ok(/markForward\(true\);/.test(t) && (t.match(/markForward\(false\)/g) || []).length >= 4, 'the transfer\'s forward is resolved on every path');
  ok(/onSaved: \(\) => toastRef\.current\(\{ title: tr\('✅ शेयर वापसी का भुगतान'/.test(fnBody('payShareRefund')), 'payShareRefund: "paid" only once the server has it');
}

// ── MEM-05: a duplicate run never posts a second dividend ──
{
  ok(classifyRunSaveError({ code: '23505', error: 'duplicate key value violates unique constraint "member_distribution_runs_live_uq"' }) === 'duplicate', 'a unique violation naming the table is a DUPLICATE, not "table missing" (the bug)');
  ok(classifyRunSaveError({ error: 'duplicate key value violates unique constraint "member_distribution_runs_x"' }) === 'duplicate', 'even without the code');
  ok(classifyRunSaveError({ code: '42P01', error: 'relation "public.member_distribution_runs" does not exist' }) === 'table-missing', 'an undefined table is "table missing"');
  ok(classifyRunSaveError({ code: 'PGRST205', error: "Could not find the table 'public.member_distribution_runs' in the schema cache" }) === 'table-missing', 'not in the schema cache is "table missing"');
  ok(classifyRunSaveError({ error: 'network error' }) === 'other', 'anything else is "other" (posts nothing)');
  const pd = read('src/pages/ProfitDistribution.tsx');
  ok(/const failure = saved\.ok \? null : classifyRunSaveError\(saved\);/.test(pd) && !/\/member_distribution_runs\|does not exist/.test(pd), 'ProfitDistribution classifies the failure (the loose regex is gone)');
  ok(/if \(failure === 'duplicate'\) \{[\s\S]{0,900}?return;/.test(pd), 'a duplicate stops before any voucher is posted');
  ok(/code: \(error as \{ code\?: string \}\)\.code/.test(read('src/hooks/useDistributionRuns.ts')), 'saveRun returns the error code');
}

// ── MEM-01: the gap is shown, with the amount ──
{
  const m = (o) => ({ shareCapital: 1000, approvalStatus: 'approved', status: 'active', joinDate: '2010-05-01', ...o });
  const g = historicalShareGap([m({}), m({ shareCapital: 500 }), m({ joinDate: '2026-06-01', shareCapital: 9000 }), m({ approvalStatus: 'pending' }), m({ isDeleted: true })], '2026-27', 500);
  ok(g.members === 2 && g.registerAmount === 1500 && g.ledgerAtFyStart === 500 && g.gap === 1000, 'old members ₹1,500 vs ₹500 in 1102 at FY start → gap ₹1,000 (this year\'s joiner, pending and deleted left out)');
  ok(historicalShareGap([m({})], '2026-27', 1000).gap === 0, 'no gap when the opening balance holds it');
  ok(historicalShareGap([m({})], '2026-27', 5000).gap === 0, 'never a negative gap');
  ok(historicalShareGap([m({ admissionDate: '2026-07-01', joinDate: '2010-01-01' })], '2026-27', 0).members === 0, 'the admission date wins over the join date (the Members page writes it)');
  const sr = read('src/pages/ShareRegister.tsx');
  ok(/data-testid="historical-share-gap"/.test(sr) && /to="\/opening-balances"/.test(sr) && /बही में नहीं है/.test(sr), 'the Share Register shows the gap with a link to Opening Balances (Hindi first)');
  ok(/getTrialBalance\(dayBefore\)\.find\(b => b\.account\.id === '1102'\)/.test(sr), 'the ledger side is 1102 at the day before the FY start');
}

console.log(`MEM-01..05: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
