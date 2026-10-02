#!/usr/bin/env node
// H / RULE 3 · a voucher a LIVE module document links to is cancelled only through that document.
// Generalises the returns (#620) and share-transfer (#621) prod findings to every domain module:
// each domain context registers an owner check; cancelVoucher refuses unless the module asks
// (viaParent); an orphan voucher (document gone) stays cancellable for cleanup.
// Run: node scripts/test-h-voucher-ownership.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { findVoucherOwner, docLinksVoucher } = await import(pathToFileURL(resolve(root, 'src/lib/voucherOwnership.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const read = p => readFileSync(resolve(root, p), 'utf8');

// ── pure ──
ok('links via voucherId', docLinksVoucher({ voucherId: 'v1' }, 'v1'));
ok('links via any …VoucherId field (paymentVoucherId, redemptionVoucherId)', docLinksVoucher({ paymentVoucherId: 'v2' }, 'v2') && docLinksVoucher({ redemptionVoucherId: 'v3' }, 'v3'));
ok('links via …VoucherIds arrays', docLinksVoucher({ receiptVoucherIds: ['a', 'v4'] }, 'v4'));
ok('no link → false; other ids ignored', !docLinksVoucher({ voucherId: 'x', memberId: 'v5' }, 'v5'));
const groups = [{ label: 'मेंटेनेंस बिल', docs: [{ id: 'b1', voucherId: 'v1' }, { id: 'b2', voucherId: 'v9', isDeleted: true }, { id: 'b3', voucherId: 'v8', status: 'cancelled' }] }];
ok('live document owns its voucher → its label', findVoucherOwner(groups, 'v1') === 'मेंटेनेंस बिल');
ok('deleted document does not own (orphan stays cancellable)', findVoucherOwner(groups, 'v9') === null);
ok('cancelled-status document does not own', findVoucherOwner(groups, 'v8') === null);
ok('unknown voucher → null', findVoucherOwner(groups, 'zz') === null);

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
const cv = dc.slice(dc.indexOf('const cancelVoucher = useCallback'), dc.indexOf('const cancelVoucher = useCallback') + 3800);
ok('DataContext exposes registerVoucherOwner', /registerVoucherOwner: \(key: string, check: VoucherOwnerCheck\) => \(\) => void;/.test(dc) && /cancelVoucher, registerVoucherOwner, reverseVoucher/.test(dc));
ok('cancelVoucher consults every owner unless viaParent', /if \(!opts\?\.viaParent\) \{\s*for \(const check of voucherOwnersRef\.current\.values\(\)\)[\s\S]{0,400}return false;/.test(cv));
ok('…after the already-cancelled no-op', cv.indexOf('if (current.isDeleted) return true;') < cv.indexOf('voucherOwnersRef.current.values()'));
for (const [ctx, key, arrays] of [
  ['Consumer', 'consumer', ['salesReturns', 'purchaseReturns', 'patronageRuns', 'purchaseOrders']],
  ['Dairy', 'dairy', ['settlements', 'dispatches', 'inputIssues', 'distributions']],
  ['Housing', 'housing', ['maintenanceBills', 'fundInvestments', 'transfers']],
  ['Labour', 'labour', ['departmentBills', 'workerAdvances', 'pfEsiRuns']]]) {
  const s = read(`src/contexts/${ctx}DataContext.tsx`);
  ok(`${ctx} registers its documents (${arrays.join(', ')})`, s.includes(`registerVoucherOwner('${key}'`) && arrays.every(a => s.includes(`docs: ${a} }`)));
}
for (const ctx of ['Consumer', 'Dairy', 'Housing', 'Labour', 'Marketing']) {
  const s = read(`src/contexts/${ctx}DataContext.tsx`);
  const calls = [...s.matchAll(/cancelVoucher\((?!.*useData)[^;]*\)/g)].map(m => m[0]).filter(c => !c.includes('= useData'));
  const missing = calls.filter(c => !c.includes('{ viaParent: true }'));
  ok(`${ctx}: every module-initiated cancel passes viaParent (${calls.length})`, calls.length > 0 && missing.length === 0);
}

console.log(`\nH voucher ownership: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
