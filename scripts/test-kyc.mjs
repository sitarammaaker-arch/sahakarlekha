// Member KYC (ECR-16) — asserts the pure helpers of src/lib/kycUtils.ts, mirrored here
// as scripts/test-nav.mjs mirrors navVisibility. Run: node scripts/test-kyc.mjs

// ── Mirror of the pure logic in src/lib/kycUtils.ts ───────────────────────────
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
function validateKyc(aadhaar, pan) {
  const a = (aadhaar || '').replace(/\s/g, '');
  if (a && !AADHAAR_RE.test(a)) return { ok: false, error: 'aadhaar' };
  const p = (pan || '').toUpperCase().trim();
  if (p && !PAN_RE.test(p)) return { ok: false, error: 'pan' };
  return { ok: true };
}
function maskId(value) {
  const v = (value || '').trim();
  if (v.length <= 4) return v;
  return `${'X'.repeat(v.length - 4)}${v.slice(-4)}`;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Empty is allowed (KYC optional).
ok(validateKyc('', '').ok, 'empty aadhaar+pan allowed');
ok(validateKyc(undefined, undefined).ok, 'undefined allowed');

// 2. Aadhaar: exactly 12 digits (spaces tolerated).
ok(validateKyc('123456789012', '').ok, '12-digit aadhaar valid');
ok(validateKyc('1234 5678 9012', '').ok, 'spaced 12-digit aadhaar valid');
ok(!validateKyc('12345', '').ok, 'short aadhaar rejected');
ok(!validateKyc('12345678901a', '').ok, 'non-numeric aadhaar rejected');

// 3. PAN: ABCDE1234F (case-insensitive input).
ok(validateKyc('', 'ABCDE1234F').ok, 'valid PAN accepted');
ok(validateKyc('', 'abcde1234f').ok, 'lowercase PAN normalised + accepted');
ok(!validateKyc('', 'ABCD1234F').ok, 'malformed PAN rejected');
ok(!validateKyc('', '12345ABCDF').ok, 'wrong-order PAN rejected');

// 4. Both provided + valid.
ok(validateKyc('123456789012', 'ABCDE1234F').ok, 'valid aadhaar + pan');

// 5. Masking shows only last 4.
ok(maskId('123456789012') === 'XXXXXXXX9012', 'aadhaar masked to last 4');
ok(maskId('ABCDE1234F') === 'XXXXXX234F', 'pan masked to last 4');
ok(maskId('') === '' && maskId('12') === '12', 'short/empty values pass through');

console.log(`\nKYC (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
