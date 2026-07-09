// Share certificate lifecycle (ECR-16) — asserts the pure validateCertificate mirrored
// from src/lib/shareCertUtils.ts. Run: node scripts/test-share-certificate.mjs

// ── Mirror of the pure logic in src/lib/shareCertUtils.ts ─────────────────────
function validateCertificate(input) {
  const { status, certNo, count, reason } = input;
  if (status === 'issued' || status === 'reissued') {
    if (!certNo?.trim()) return { ok: false, error: 'certNo' };
    if (!(Number(count) > 0)) return { ok: false, error: 'count' };
  }
  if ((status === 'reissued' || status === 'cancelled') && !reason?.trim()) {
    return { ok: false, error: 'reason' };
  }
  return { ok: true };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Issue needs cert no + positive count; no reason needed.
ok(validateCertificate({ status: 'issued', certNo: 'SC/001', count: 10 }).ok, 'issue with cert no + count valid');
ok(!validateCertificate({ status: 'issued', certNo: '', count: 10 }).ok, 'issue without cert no rejected');
ok(!validateCertificate({ status: 'issued', certNo: 'SC/001', count: 0 }).ok, 'issue with 0 count rejected');
ok(validateCertificate({ status: 'issued', certNo: 'SC/001', count: 10 }).ok === true, 'issue needs no reason');

// 2. Reissue needs cert no + count AND a reason.
ok(validateCertificate({ status: 'reissued', certNo: 'SC/002', count: 10, reason: 'lost' }).ok, 'reissue with reason valid');
ok(!validateCertificate({ status: 'reissued', certNo: 'SC/002', count: 10 }).ok, 'reissue without reason rejected');
ok(!validateCertificate({ status: 'reissued', certNo: '', count: 10, reason: 'lost' }).ok, 'reissue without cert no rejected');

// 3. Cancel needs only a reason (no cert-no/count requirement).
ok(validateCertificate({ status: 'cancelled', reason: 'member exit' }).ok, 'cancel with reason valid');
ok(!validateCertificate({ status: 'cancelled', reason: '' }).ok, 'cancel without reason rejected');
ok(!validateCertificate({ status: 'cancelled' }).ok, 'cancel without reason (undefined) rejected');

console.log(`\nShare certificate (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
