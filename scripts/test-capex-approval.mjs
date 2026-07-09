// Capex approval visibility (ECR-15) — mirrors src/lib/capexApproval.ts.
// Run: node scripts/test-capex-approval.mjs
function capexPendingAssets(assets, pendingVoucherIds) {
  return (assets || [])
    .filter((a) => !a.isDeleted && !!a.acquisitionVoucherId && pendingVoucherIds.has(a.acquisitionVoucherId))
    .map((a) => ({ id: a.id, name: a.name }));
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const pending = new Set(['v-pending-1', 'v-pending-2']);
const assets = [
  { id: 'a', name: 'New Tractor', acquisitionVoucherId: 'v-pending-1' },   // acquisition pending → flagged
  { id: 'b', name: 'Office PC', acquisitionVoucherId: 'v-approved-9' },    // acquisition approved → not flagged
  { id: 'c', name: 'Opening Building' },                                   // no acquisition voucher (register-only) → not
  { id: 'd', name: 'Archived', acquisitionVoucherId: 'v-pending-2', isDeleted: true }, // archived → excluded
  { id: 'e', name: 'New Van', acquisitionVoucherId: 'v-pending-2' },       // acquisition pending → flagged
];

const res = capexPendingAssets(assets, pending);
ok(res.length === 2, 'exactly 2 pending-capex assets (Tractor, Van)');
ok(res.some(r => r.id === 'a') && res.some(r => r.id === 'e'), 'Tractor + Van flagged');
ok(!res.some(r => ['b', 'c', 'd'].includes(r.id)), 'approved / no-voucher / archived not flagged');
ok(capexPendingAssets([], pending).length === 0, 'empty assets → none');
ok(capexPendingAssets(assets, new Set()).length === 0, 'no pending vouchers → none');
ok(capexPendingAssets(null, pending).length === 0, 'null assets → none');

console.log(`\nCapex approval (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
