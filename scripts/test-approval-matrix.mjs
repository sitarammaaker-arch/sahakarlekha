// Approval matrix (ECR-11) — asserts the pure requiresApproval predicate mirrored from
// src/contexts/DataContext.tsx, plus the manual-only stamping rule. Run: node scripts/test-approval-matrix.mjs

// ── Mirror of the pure predicate in DataContext ───────────────────────────────
const requiresApproval = (amount, opts) =>
  !!opts.approvalRequired || (!!opts.threshold && opts.threshold > 0 && (amount || 0) >= opts.threshold);

// Mirror of the addVoucher stamping guard: only origin==='manual' + no preset status.
function stampedStatus(data, cfg) {
  const needs = data.origin === 'manual' && data.approvalStatus === undefined &&
    requiresApproval(data.amount, { approvalRequired: cfg.approvalRequired, threshold: cfg.approvalThresholdAmount });
  return needs ? 'pending' : data.approvalStatus;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Predicate — all-manual flag holds everything.
ok(requiresApproval(10, { approvalRequired: true }), 'approvalRequired holds any amount');
ok(requiresApproval(0, { approvalRequired: true }), 'approvalRequired holds even 0');

// 2. Predicate — threshold boundary.
ok(!requiresApproval(4999, { threshold: 5000 }), 'below threshold → no approval');
ok(requiresApproval(5000, { threshold: 5000 }), 'at threshold → approval (>=)');
ok(requiresApproval(9999, { threshold: 5000 }), 'above threshold → approval');

// 3. Predicate — no rules configured → never.
ok(!requiresApproval(1000000, {}), 'no flag + no threshold → no approval');
ok(!requiresApproval(1000000, { threshold: 0 }), 'threshold 0 → off');

// 4. Stamping — ONLY manual vouchers are held (the P0 #1 safety).
const cfg = { approvalThresholdAmount: 5000 };
ok(stampedStatus({ origin: 'manual', amount: 6000, approvalStatus: undefined }, cfg) === 'pending', 'manual ≥ threshold → pending');
ok(stampedStatus({ origin: 'manual', amount: 100, approvalStatus: undefined }, cfg) === undefined, 'manual < threshold → not held');
ok(stampedStatus({ origin: undefined, amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'auto voucher (undefined origin) NEVER held');
ok(stampedStatus({ origin: 'engine', amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'engine voucher NEVER held');
ok(stampedStatus({ origin: 'auto', amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'auto-tagged voucher NEVER held');

// 5. Stamping — a caller-set status is respected (e.g. explicit "submit for approval").
ok(stampedStatus({ origin: 'manual', amount: 100, approvalStatus: 'pending' }, cfg) === 'pending', 'explicit pending kept');
ok(stampedStatus({ origin: 'manual', amount: 6000, approvalStatus: 'approved' }, cfg) === 'approved', 'preset status not overwritten by matrix');

// 6. Default config (nothing set) → manual vouchers pass through untouched (no regression).
ok(stampedStatus({ origin: 'manual', amount: 999999, approvalStatus: undefined }, {}) === undefined, 'no config → manual voucher not held (unchanged behaviour)');

console.log(`\nApproval matrix (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
