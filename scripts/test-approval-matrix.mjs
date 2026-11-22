// Approval matrix (ECR-11) — imports the REAL requiresApproval predicate from
// src/lib/approvalMatrix.ts via the '@/' loader, plus the manual-only stamping rule.
// Run: node scripts/test-approval-matrix.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { requiresApproval } = await import(abs('../src/lib/approvalMatrix.ts'));

// Mirror of the addVoucher stamping guard: only origin==='manual' + no preset status.
function stampedStatus(data, cfg) {
  const needs = data.origin === 'manual' && data.approvalStatus === undefined &&
    requiresApproval(data.amount, data.type, { approvalRequired: cfg.approvalRequired, threshold: cfg.approvalThresholdAmount, types: cfg.approvalVoucherTypes });
  return needs ? 'pending' : data.approvalStatus;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Predicate — all-manual flag holds everything.
ok(requiresApproval(10, 'journal', { approvalRequired: true }), 'approvalRequired holds any amount');
ok(requiresApproval(0, 'journal', { approvalRequired: true }), 'approvalRequired holds even 0');

// 2. Predicate — threshold boundary.
ok(!requiresApproval(4999, 'journal', { threshold: 5000 }), 'below threshold → no approval');
ok(requiresApproval(5000, 'journal', { threshold: 5000 }), 'at threshold → approval (>=)');
ok(requiresApproval(9999, 'journal', { threshold: 5000 }), 'above threshold → approval');

// 3. Predicate — no rules configured → never.
ok(!requiresApproval(1000000, 'journal', {}), 'no flag + no threshold + no types → no approval');
ok(!requiresApproval(1000000, 'journal', { threshold: 0 }), 'threshold 0 → off');

// 3b. Predicate — per-TYPE axis (ECR-11 new): a listed type is held regardless of amount.
ok(requiresApproval(1, 'journal', { types: ['journal', 'contra'] }), 'listed type (journal) held even at ₹1');
ok(requiresApproval(1, 'contra', { types: ['journal', 'contra'] }), 'listed type (contra) held even at ₹1');
ok(!requiresApproval(1, 'receipt', { types: ['journal', 'contra'] }), 'unlisted type (receipt) below threshold → not held');
ok(!requiresApproval(1, 'journal', { types: [] }), 'empty types list → no type rule');
ok(!requiresApproval(1, undefined, { types: ['journal'] }), 'no voucher type → type rule cannot match');
// type axis composes with threshold (OR): unlisted type still held if amount ≥ threshold.
ok(requiresApproval(6000, 'receipt', { threshold: 5000, types: ['journal'] }), 'unlisted type but ≥ threshold → held (OR)');

// 4. Stamping — ONLY manual vouchers are held (the P0 #1 safety).
const cfg = { approvalThresholdAmount: 5000 };
ok(stampedStatus({ origin: 'manual', type: 'payment', amount: 6000, approvalStatus: undefined }, cfg) === 'pending', 'manual ≥ threshold → pending');
ok(stampedStatus({ origin: 'manual', type: 'payment', amount: 100, approvalStatus: undefined }, cfg) === undefined, 'manual < threshold → not held');
ok(stampedStatus({ origin: undefined, type: 'payment', amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'auto voucher (undefined origin) NEVER held');
ok(stampedStatus({ origin: 'engine', type: 'payment', amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'engine voucher NEVER held');
ok(stampedStatus({ origin: 'auto', type: 'payment', amount: 6000, approvalStatus: undefined }, cfg) === undefined, 'auto-tagged voucher NEVER held');

// 4b. Stamping — per-type rule holds a small manual voucher of a listed type.
const cfgType = { approvalVoucherTypes: ['journal'] };
ok(stampedStatus({ origin: 'manual', type: 'journal', amount: 1, approvalStatus: undefined }, cfgType) === 'pending', 'manual journal (listed type) → pending even at ₹1');
ok(stampedStatus({ origin: 'manual', type: 'receipt', amount: 1, approvalStatus: undefined }, cfgType) === undefined, 'manual receipt (unlisted) → not held');
ok(stampedStatus({ origin: 'engine', type: 'journal', amount: 1, approvalStatus: undefined }, cfgType) === undefined, 'engine journal (listed type) still NEVER held');

// 5. Stamping — a caller-set status is respected (e.g. explicit "submit for approval").
ok(stampedStatus({ origin: 'manual', type: 'payment', amount: 100, approvalStatus: 'pending' }, cfg) === 'pending', 'explicit pending kept');
ok(stampedStatus({ origin: 'manual', type: 'payment', amount: 6000, approvalStatus: 'approved' }, cfg) === 'approved', 'preset status not overwritten by matrix');

// 6. Default config (nothing set) → manual vouchers pass through untouched (no regression).
ok(stampedStatus({ origin: 'manual', type: 'journal', amount: 999999, approvalStatus: undefined }, {}) === undefined, 'no config → manual voucher not held (unchanged behaviour)');

// 7. Bill-wise settlement (receipt/payment against bills) — a PENDING or REJECTED voucher must not
//    settle a bill; only counted (approved / un-gated) vouchers do. Restores outstanding on reject.
const { getBillSettledMap, getPartyUnallocated, getOpenPurchaseBills } = await import(abs('../src/lib/billUtils.ts'));
const alloc = [{ billId: 'P1', amount: 1000, method: 'against' }, { amount: 50, method: 'on-account' }];
const bv = (approvalStatus, extra = {}) => ({ id: 'v' + (approvalStatus ?? 'none'), refType: 'bill-payment', refId: 'S1', billAllocations: alloc, approvalStatus, ...extra });
ok((getBillSettledMap([bv('pending')]).P1 || 0) === 0, 'pending bill-payment does NOT settle the bill');
ok((getBillSettledMap([bv('rejected')]).P1 || 0) === 0, 'rejected bill-payment does NOT settle the bill (outstanding restored)');
ok(getBillSettledMap([bv('approved')]).P1 === 1000, 'approved bill-payment settles the bill');
ok(getBillSettledMap([bv(undefined)]).P1 === 1000, 'un-gated (no approval status) bill-payment settles the bill');
ok((getBillSettledMap([bv('approved', { isDeleted: true })]).P1 || 0) === 0, 'deleted bill-payment does not settle');
ok(getPartyUnallocated([bv('pending'), bv('rejected')], 'bill-payment', 'S1') === 0, 'pending/rejected on-account/advance not counted');
ok(getPartyUnallocated([bv('approved')], 'bill-payment', 'S1') === 50, 'approved on-account counted');
const purchase = { id: 'P1', supplierId: 'S1', paymentMode: 'credit', grandTotal: 1000 };
ok(getOpenPurchaseBills([purchase], [bv('pending')], 'S1').length === 1, 'bill stays OPEN while its payment is pending');
ok(getOpenPurchaseBills([purchase], [bv('rejected')], 'S1').length === 1, 'bill re-opens after its payment is rejected');
ok(getOpenPurchaseBills([purchase], [bv('approved')], 'S1').length === 0, 'bill closes once its payment is approved');

// 8. Source pins — user-created voucher creators must carry origin:'manual' (else the matrix is bypassed).
import { readFileSync } from 'node:fs';
const src = (rel) => readFileSync(pathResolve(HERE, rel), 'utf8');
const dc = src('../src/contexts/DataContext.tsx');
for (const ref of ['bill-receipt', 'bill-payment']) {
  const i = dc.indexOf(`refType: '${ref}'`);
  ok(i > 0 && /origin: 'manual'/.test(dc.slice(i, i + 200)), `${ref} voucher carries origin:'manual'`);
}
for (const f of ['CashBook', 'BankBook']) {
  const t = src(`../src/pages/${f}.tsx`);
  const i = t.indexOf('addVoucher({');
  ok(i > 0 && /origin: 'manual'/.test(t.slice(i, i + 600)), `${f} quick entry carries origin:'manual'`);
}


console.log(`\nApproval matrix (pure): ${pass} passed, ${fail} failed`);
process.exitCode = fail > 0 ? 1 : 0;
