// Share refund as an approved payable (src/lib/shares/refundPayable.ts) and its wiring.
//   approve: Dr Share Capital 1102 / Cr Share Refund Payable      pay: Dr Share Refund Payable / Cr Cash-Bank
// The outstanding comes from live vouchers; no timeline / set-off rule is encoded.
// Run: node scripts/test-share-refund-payable.mjs
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
const R = await import(pathToFileURL(path.join(SRC, 'lib/shares/refundPayable.ts')).href);
const H = await import(pathToFileURL(path.join(SRC, 'lib/accounting/headResolve.ts')).href);
const M = await import(pathToFileURL(path.join(SRC, 'lib/money.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const shape = (r) => r.lines.map((l) => `${l.type} ${l.accountId} ${l.amount}`);
const balanced = (lines) => lines.reduce((a, l) => a + (l.type === 'Dr' ? 1 : -1) * M.toMinor(l.amount), 0) === 0;

// ── approval ──────────────────────────────────────────────────────────────────────────────────────────
const ap = { amount: 500, shareCapital: 1000, shareCapAccountId: '1102', payableAccountId: '2111', resolution: 'Res-12' };
let r = R.buildShareRefundApproval(ap);
ok(r.ok && JSON.stringify(shape(r)) === JSON.stringify(['Dr 1102 500', 'Cr 2111 500']), 'approval: Dr Share Capital / Cr Share Refund Payable');
ok(r.ok && balanced(r.lines) && r.amount === 500, 'approval balances');
ok(R.buildShareRefundApproval({ ...ap, amount: 1000 }).ok === true, 'the whole holding can be approved');
ok(R.buildShareRefundApproval({ ...ap, amount: 0.1 + 0.2 }).ok === true && R.buildShareRefundApproval({ ...ap, amount: 0.1 + 0.2 }).amount === 0.3, 'float-safe: 0.1 + 0.2 → 0.3');
const aerr = (o) => { const x = R.buildShareRefundApproval({ ...ap, ...o }); return x.ok === false ? x.error : 'OK'; };
ok(aerr({ amount: 0 }) === 'amount' && aerr({ amount: -1 }) === 'amount', 'zero / negative approval refused');
ok(aerr({ amount: 1000.01 }) === 'exceeds_capital', 'more than the share capital refused');
ok(aerr({ payableAccountId: null }) === 'no_payable_head', 'no payable head refused');
ok(aerr({ resolution: '  ' }) === 'resolution' && aerr({ resolution: '' }) === 'resolution', 'no resolution reference refused');
ok(new Set(R.buildShareRefundApproval(ap).lines.map((l) => l.id)).size === 2, 'each line has its own id');

// ── payment ───────────────────────────────────────────────────────────────────────────────────────────
const pay = { amount: 200, outstanding: 500, payableAccountId: '2111', cashBankAccountId: '1101' };
r = R.buildShareRefundPayment(pay);
ok(r.ok && JSON.stringify(shape(r)) === JSON.stringify(['Dr 2111 200', 'Cr 1101 200']) && balanced(r.lines), 'payment: Dr Share Refund Payable / Cr Cash-Bank');
ok(R.buildShareRefundPayment({ ...pay, amount: 500 }).ok === true, 'the whole outstanding can be paid');
const perr = (o) => { const x = R.buildShareRefundPayment({ ...pay, ...o }); return x.ok === false ? x.error : 'OK'; };
ok(perr({ amount: 0 }) === 'amount', 'zero payment refused');
ok(perr({ amount: 500.01 }) === 'exceeds_outstanding' && perr({ outstanding: 0 }) === 'exceeds_outstanding', 'payment beyond the outstanding refused');
ok(perr({ payableAccountId: undefined }) === 'no_payable_head', 'no payable head refused');
ok(perr({ cashBankAccountId: '' }) === 'no_bank', 'no cash/bank refused');
ok(Object.keys(R.SHARE_REFUND_MESSAGE).sort().join() === 'amount,exceeds_capital,exceeds_outstanding,no_bank,resolution', 'a Hindi message exists for every refusal except the missing head (its own toast)');
ok(typeof H.MISSING_HEAD_TOAST.shareRefund.title === 'string', 'the missing-head toast exists');

// ── outstanding from live vouchers ────────────────────────────────────────────────────────────────────
const V = (refType, amount, extra = {}) => ({ memberId: 'm1', refType, amount, ...extra });
const A = R.SHARE_REFUND_APPROVE_REF, P = R.SHARE_REFUND_PAY_REF;
ok(R.shareRefundOutstanding([], 'm1') === 0, 'no vouchers → 0');
ok(R.shareRefundOutstanding([V(A, 500)], 'm1') === 500, 'approved 500 → 500 outstanding');
ok(R.shareRefundOutstanding([V(A, 500), V(P, 200)], 'm1') === 300, 'approved 500, paid 200 → 300');
ok(R.shareRefundOutstanding([V(A, 500), V(P, 200), V(P, 300)], 'm1') === 0, 'fully paid → 0');
ok(R.shareRefundOutstanding([V(A, 500), V(A, 100, { isDeleted: true }), V(P, 200, { isDeleted: true })], 'm1') === 500, 'cancelled vouchers drop out (approval and payment)');
ok(R.shareRefundOutstanding([V(A, 500), { memberId: 'm2', refType: A, amount: 900 }], 'm1') === 500, 'another member\'s vouchers are ignored');
ok(R.shareRefundOutstanding([V(P, 50)], 'm1') === 0, 'never negative');
ok(R.shareRefundOutstanding([V(A, 0.1), V(A, 0.2)], 'm1') === 0.3, 'paise-exact sums');
ok(R.shareRefundOutstanding([V('share.refund', 99), { memberId: 'm1', amount: 99 }], 'm1') === 0, 'other vouchers of the member do not count');

// ── resolver against the real charts ──────────────────────────────────────────────────────────────────
const chart = (t) => S.migrateAccounts(S.SOCIETY_TEMPLATES[t].map((a) => ({ ...a }))).accounts;
for (const t of Object.keys(S.SOCIETY_TEMPLATES)) {
  ok(H.shareRefundPayableAccountId(chart(t)) === '2111', `${t}: Share Refund Payable resolves to 2111`);
}
ok(H.shareRefundPayableAccountId([]) === null, 'empty chart → null');
ok(H.shareRefundPayableAccountId([{ id: '1102', name: 'Share Capital', nameHi: '', type: 'equity', isGroup: false }]) === null, 'Share Capital itself is not the payable');
ok(H.shareRefundPayableAccountId([{ id: '2111', name: 'Share Refund Payable', nameHi: '', type: 'liability', isGroup: true }]) === null, 'a group head is not postable');
ok(H.shareRefundPayableAccountId([{ id: '2111', name: 'Other', nameHi: '', type: 'liability', isGroup: false }, { id: 'u5', name: 'Refund of Share Capital Payable', nameHi: '', type: 'liability', isGroup: false }]) === 'u5', 'if 2111 is something else, a named liability by any id is used');

// ── wiring ────────────────────────────────────────────────────────────────────────────────────────────
const dc = readFileSync(path.join(SRC, 'contexts/DataContext.tsx'), 'utf8');
const approve = dc.slice(dc.indexOf('const approveShareRefund'), dc.indexOf('const payShareRefund'));
const payFn = dc.slice(dc.indexOf('const payShareRefund'), dc.indexOf('const shareOperation'));
ok(/guardFYLocked\(\)/.test(approve) && /guardFYLocked\(\)/.test(payFn), 'both guard the FY lock (RULE 6)');
ok(/guardPeriodLock\(date\)/.test(approve) && /guardPeriodLock\(date\)/.test(payFn), 'both guard the period lock');
ok(/shareRefundPayableAccountId\(accounts\)/.test(approve) && /MISSING_HEAD_TOAST\.shareRefund/.test(approve), 'approval refuses with the Hindi toast when the head is missing');
ok(approve.indexOf('addVoucher(') < approve.indexOf("from('members')"), 'the voucher is created before the member row is touched');
ok(/cancelVoucher\(v\.id/.test(approve) && /before : m/.test(approve), 'a failed member save restores the member AND cancels the voucher (RULE 1)');
ok(/refType: SHARE_REFUND_APPROVE_REF/.test(approve) && /refType: SHARE_REFUND_PAY_REF/.test(payFn), 'vouchers carry their refType');
ok(!/from\('members'\)/.test(payFn), 'payment does not touch the member row (shareCapital already reduced at approval)');
ok(/vouchersRef\.current, memberId/.test(payFn), 'payment limit is read from live vouchers');
ok((dc.match(/approveShareRefund, payShareRefund,/g) || []).length === 2, 'both are in the context value and deps list');
ok(/refundShareCapital = useCallback/.test(dc) && /debitAccountId: ACCOUNT_IDS\.SHARE_CAP, creditAccountId: creditAcc/.test(dc), 'one-step refundShareCapital is unchanged');
const sr = readFileSync(path.join(SRC, 'pages/ShareRegister.tsx'), 'utf8');
ok(/<ShareRefundPayableButtons /.test(sr) && /shareRefundOutstanding\(vouchers, m\.id\)/.test(sr), 'ShareRegister shows the approve / pay buttons with the outstanding');
ok(/kind="refund" onSubmit=\{refundShareCapital\}/.test(sr), 'the existing one-step Refund button stays');

console.log(`share refund payable: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;   // not process.exit(): it races the register() loader worker on Windows (#670)
