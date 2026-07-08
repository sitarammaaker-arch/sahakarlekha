// Voucher overlay-persistence (P0 #6 / ECR-04) — asserts the PURE helpers of
// src/lib/voucherPersistence.ts, mirrored here as scripts/test-nav.mjs mirrors navVisibility.
// Run: node scripts/test-voucher-persistence.mjs (exit 1 on any failure).

// ── Mirror of the pure logic in src/lib/voucherPersistence.ts ─────────────────
const CRITICAL_OVERLAY_KEYS = ['approvalStatus', 'approvalRemarks', 'approvedBy', 'approvedAt', 'editHistory'];
const OPTIONAL_OVERLAY_KEYS = ['lines', 'refType', 'refId', 'isCleared', 'clearedDate', 'groupId', 'billAllocations', 'workOrderId', 'costCentreId'];
function splitVoucherExtras(v) {
  const pick = (keys) => { const out = {}; for (const k of keys) if (v[k] !== undefined) out[k] = v[k]; return out; };
  const critical = pick(CRITICAL_OVERLAY_KEYS);
  const optional = pick(OPTIONAL_OVERLAY_KEYS);
  return { critical, optional, hasCritical: Object.keys(critical).length > 0 };
}
function extrasFailureToast(hasCritical, message) {
  if (hasCritical) return { title: '❌ Approval/audit data cloud par save NAHI hua', description: `…: ${message}. …`, variant: 'destructive', duration: 14000 };
  return { title: '⚠️ Voucher saved partially', description: `…: ${message}. …`, variant: 'default', duration: 8000 };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Split routes control/audit overlays to critical, cosmetic to optional.
const v = {
  id: 'v1', voucherNo: 'JV/2025-26/001', amount: 100,          // base cols — must NOT appear in either bucket
  approvalStatus: 'approved', approvedBy: 'Admin', editHistory: [{ at: 't' }],
  lines: [{ accountId: '1101' }], refType: 'sale', costCentreId: 'cc1',
};
const s = splitVoucherExtras(v);
ok(s.critical.approvalStatus === 'approved' && s.critical.approvedBy === 'Admin' && Array.isArray(s.critical.editHistory), 'control/audit overlays → critical');
ok(s.optional.lines && s.optional.refType === 'sale' && s.optional.costCentreId === 'cc1', 'cosmetic/routing overlays → optional');
ok(s.critical.lines === undefined && s.optional.approvalStatus === undefined, 'buckets are disjoint');
ok(s.critical.id === undefined && s.optional.id === undefined && s.critical.amount === undefined, 'base columns excluded from both buckets');
ok(s.hasCritical === true, 'hasCritical true when any critical overlay present');

// 2. Present-only — undefined overlays are omitted (never overwrite a stored column with null).
const s2 = splitVoucherExtras({ approvalStatus: undefined, approvalRemarks: 'note', lines: undefined });
ok(s2.critical.approvalStatus === undefined && s2.critical.approvalRemarks === 'note', 'undefined critical omitted, defined kept');
ok(s2.optional.lines === undefined && Object.keys(s2.optional).length === 0, 'undefined optional omitted');
ok(s2.hasCritical === true, 'hasCritical reflects a defined critical key');

// 3. Cosmetic-only voucher → no critical bucket.
const s3 = splitVoucherExtras({ lines: [{ accountId: '5101' }], workOrderId: 'wo1' });
ok(s3.hasCritical === false, 'cosmetic-only → hasCritical false');
ok(Object.keys(s3.critical).length === 0, 'no critical overlays picked');

// 4. Empty voucher → nothing to patch.
const s4 = splitVoucherExtras({ id: 'x', amount: 5 });
ok(!s4.hasCritical && Object.keys(s4.critical).length === 0 && Object.keys(s4.optional).length === 0, 'no overlays → both buckets empty');

// 5. Toast severity — critical loss is LOUD (destructive, long), cosmetic stays mild.
const tc = extrasFailureToast(true, 'schema cache miss');
ok(tc.variant === 'destructive' && tc.duration >= 12000, 'critical failure → destructive + long toast');
ok(tc.description.includes('schema cache miss'), 'critical toast carries the underlying error');
const to = extrasFailureToast(false, 'col missing');
ok(to.variant === 'default' && to.duration <= 8000, 'cosmetic-only failure → mild toast (unchanged UX)');

console.log(`\nVoucher overlay persistence (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
