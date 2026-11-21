// X-3 + X-5 (product audit 2026-11-17).
//   X-3  cancelVoucher answers "started" at once; a module that deleted / revised its document right after trusted that
//        and, when the cloud then refused the cancel, the document was gone while its voucher stayed live → the
//        document now changes in onCancelled (after the cloud confirmed), a late refusal leaves it as it was.
//   X-5  a payment / collection / recovery voucher moved a stored figure on its document (paidAmount, recovered,
//        amountReceived…); cancelling it from the Vouchers page left the figure as paid → a follower takes the amount
//        back after every CONFIRMED direct cancel; edit / reverse of such a voucher is refused; vouchers whose document
//        cannot follow (deposit passbook, old wage payments, TDS challans) are changed only through their screen.
// Run: node scripts/test-x3x5-cancel-follow.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── the pure rule ──
{
  const O = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/voucherOwnership.ts')).href);
  ok(O.figureAfterCancel(500, 200) === 300 && O.figureAfterCancel(100.1, 0.1) === 100, 'the cancelled amount comes off the figure (paise exact)');
  ok(O.figureAfterCancel(100, 150) === 0 && O.figureAfterCancel(0.004, 0) === 0, 'never below zero');
}

const dc = read('src/contexts/DataContext.tsx');
// ── DataContext: registry + follow on the confirmed paths ──
{
  ok(/registerVoucherCancelFollower: \(key: string, follower: VoucherCancelFollower\) => \(\) => void;/.test(dc), 'DataContext exposes registerVoucherCancelFollower');
  ok((dc.match(/cancelVoucher, (?:guardPageWrite, )?registerVoucherOwner, registerVoucherCancelFollower, reverseVoucher,/g) || []).length === 2, '…in both context values');
  const cv = dc.slice(dc.indexOf('const cancelVoucher = useCallback('), dc.indexOf('\n  }, []);', dc.indexOf('const cancelVoucher = useCallback(')));
  ok((cv.match(/if \(!opts\?\.viaParent\) \{ loanFollowsCancel\(current\); followCancel\(current\); \}/g) || []).length === 3, 'followers run after a CONFIRMED direct cancel on all three paths (a module cancelling its own document does not)');
  const fc = dc.slice(dc.indexOf('const followCancel = '), dc.indexOf('const followedBy = '));
  ok(fc.includes('fl.refTypes.includes(v.refType)') && fc.includes("reportError('voucher-cancel-follow'"), 'a follower sees only its own refTypes; one failing follower cannot break the cancel');
  const g = dc.slice(dc.indexOf('const guardDocumentOwnedVoucher = '), dc.indexOf('const updateVoucher = useCallback('));
  ok(g.includes('const follower = owner ? null : followedBy(v.refType);') && g.includes('इसे रद्द (cancel) करें'), 'edit / reverse of a followed payment voucher is refused — cancel it instead');
  ok(dc.includes("registerVoucherOwner('deposits'") && dc.includes('docs: depositTransactionsRef.current'), 'deposit vouchers (no refType — the passbook cannot follow) are changed only from Deposits');
  ok(cv.includes("if (current.refType === 'tds.challan' && !opts?.viaParent) {"), 'a TDS challan voucher is cancelled only with its challan');
  ok(read('src/pages/TdsRegister.tsx').includes("{ viaParent: true, onCancelled: () => next(i + 1), onFailed: () => notDeleted(v.voucherNo) }"), 'the TDS Register deletes the challan after each voucher cancel is confirmed');
}

// ── muster wage payments: per-worker lines, followed; old ones fixed ──
{
  const pw = dc.slice(dc.indexOf('const payWages = useCallback('), dc.indexOf('const applyPay = '));
  ok(pw.includes("...allocs.map(a => ({ id: lid(), accountId: a.entry.accrued ? '2109' : '5202', type: 'Dr' as const, amount: a.amount, musterEntryId: a.entry.id }))"), 'a wage payment has one Dr line per worker naming its muster entry (same accounts / total)');
  ok(read('src/types/index.ts').includes('musterEntryId?: string;'), 'VoucherLine carries musterEntryId');
  const mf = dc.slice(dc.indexOf("registerVoucherCancelFollower('muster-payment'"), dc.indexOf('}), [registerVoucherCancelFollower]);', dc.indexOf("registerVoucherCancelFollower('muster-payment'")));
  ok(mf.includes("refTypes: ['wage.payment']") && mf.includes('figureAfterCancel(m.paidAmount || 0, back.get(m.id) || 0)') && mf.includes("from('muster_entries').upsert("), 'a cancelled wage payment gives each worker their amount back (and saves it)');
  ok(dc.includes("registerVoucherOwner('muster-payment'") && dc.includes("(v.lines || []).some(l => l.musterEntryId)) return null;"), 'an old wage payment (no per-worker lines) stays fixed while an entry points at it');
  const um = dc.slice(dc.indexOf('const updateMusterEntry = useCallback('), dc.indexOf('const deleteMusterEntry = useCallback('));
  ok(um.includes("if (wageChanged && old.accrualVoucherId && guardPermission('delete'"), 'a wage change that must cancel the old accrual is asked of a delete role BEFORE anything posts');
  ok(um.includes("'Wage accrual superseded (muster edited)', user?.name || 'System', {\n          viaParent: true,\n          onFailed:"), 'a late refusal of that cancel is shown, not silent');
}

// ── each document follows its own payment voucher ──
{
  const cases = [
    ['Housing', "'housing'", ['maintenance.receipt'], ["refType: 'maintenance.receipt'"], ["from('maintenance_bills').upsert(withSoc(next))"]],
    ['Labour', "'labour'", ['dept.collection', 'worker.advance.recovery'], ["refType: 'dept.collection'", "refType: 'worker.advance.recovery'"], ["from('department_bills').upsert(withSoc(next))", "from('worker_advances').upsert(withSoc(next))"]],
    ['Dairy', "'dairy'", ['dairy.settlement.payment', 'dairy.dispatch.receipt', 'dairy.distribution.payment'], ["refType: 'dairy.settlement.payment'", "refType: 'dairy.dispatch.receipt'", "refType: 'dairy.distribution.payment'"], ['commitSettlement(next, cur);', 'commitDispatch(next, cur);', 'commitDistribution(next, cur);']],
    ['Consumer', "'consumer'", ['consumer.patronage.payment', 'consumer.dividend.payment'], ["'consumer.dividend.payment' : 'consumer.patronage.payment'"], ['commitPatronageRun(next, cur);']],
  ];
  for (const [ctx, key, refTypes, posted, saves] of cases) {
    const s = read(`src/contexts/${ctx}DataContext.tsx`);
    const fl = s.slice(s.indexOf(`registerVoucherCancelFollower(${key}`), s.indexOf('}), [registerVoucherCancelFollower', s.indexOf(`registerVoucherCancelFollower(${key}`)));
    ok(fl.includes(`refTypes: [${refTypes.map(r => `'${r}'`).join(', ')}]`), `${ctx}: follows ${refTypes.join(', ')}`);
    for (const p of posted) ok(s.includes(p), `${ctx}: the payment flow still posts ${p}`);
    for (const sv of saves) ok(fl.includes(sv), `${ctx}: the follower saves (${sv})`);
    ok((fl.match(/figureAfterCancel\(/g) || []).length === refTypes.length - (ctx === 'Consumer' ? 1 : 0), `${ctx}: the voucher's amount comes off the figure`);
  }
  const h = read('src/contexts/HousingDataContext.tsx');
  ok(h.includes('if ((bill.paidAmount || 0) > 0.005) {') && h.indexOf('if ((bill.paidAmount || 0) > 0.005) {') < h.indexOf('const removeBill = () => {'), 'a maintenance bill with collections is not deleted (its receipts would be orphaned) — cancel them first');
}

// ── X-3: the document changes only once the cancel is confirmed ──
{
  for (const f of ['src/contexts/ConsumerDataContext.tsx', 'src/contexts/DairyDataContext.tsx', 'src/contexts/HousingDataContext.tsx', 'src/pages/TdsRegister.tsx']) {
    const s = read(f);
    const early = [...s.matchAll(/!cancelVoucher\([^;]*?\)\) (return|\{)/g)].map(m => m[0]);
    ok(early.length === 0, `${f}: no "if (!cancelVoucher(…)) return" before a document change (found ${early.length})`);
  }
  const c = read('src/contexts/ConsumerDataContext.tsx');
  ok((c.match(/onCancelled: applyEdit, onFailed: withdrawNew \}\)\) withdrawNew\(\);/g) || []).length === 2, 'a revised return applies its figures after the old note is confirmed cancelled; a refusal (now or late) withdraws the new note');
  ok((c.match(/onCancelled: reverseReturn/g) || []).length === 2 && c.includes('onCancelled: markDeleted'), 'deleted returns / patronage runs change after the confirm');
  ok((read('src/contexts/DairyDataContext.tsx').match(/onCancelled: markDeleted/g) || []).length === 4, 'Dairy: all four deletes wait for the confirm');
  const h = read('src/contexts/HousingDataContext.tsx');
  ok(h.includes('onCancelled: removeBill') && h.includes('onCancelled: cancelInvestment') && h.includes('onCancelled: removeRow, onFailed: partly') && h.includes("{ viaParent: true, onCancelled: removeRow });"), 'Housing: bill / investment / transfer rows go after the confirm (investment: both vouchers, in order)');
  ok((dc.match(/onFailed: lateLeft\(/g) || []).length === 2, 'procurement lot cancel names a voucher the cloud refuses later');
}

console.log(`X-3/X-5 cancel follow: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
