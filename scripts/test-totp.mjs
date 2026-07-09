// TOTP engine (ECR-12) — mirrors src/lib/totp.ts. Validates against the official
// RFC 6238 Appendix-B test vectors (SHA1, seed "12345678901234567890").
// Run: node scripts/test-totp.mjs
import { webcrypto } from 'node:crypto';
const subtle = webcrypto.subtle;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30, DIGITS = 6;

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}
function counterBytes(counter) {
  const buf = new Uint8Array(8); let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  return buf;
}
async function hmacSha1(key, msg) {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, msg));
}
async function hotp(secretB32, counter, digits = DIGITS) {
  const hs = await hmacSha1(base32Decode(secretB32), counterBytes(counter));
  const offset = hs[hs.length - 1] & 0x0f;
  const bin = ((hs[offset] & 0x7f) << 24) | ((hs[offset + 1] & 0xff) << 16)
    | ((hs[offset + 2] & 0xff) << 8) | (hs[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}
function totp(secretB32, atMs, step = STEP, digits = DIGITS) {
  return hotp(secretB32, Math.floor(atMs / 1000 / step), digits);
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function verifyTotp(secretB32, token, atMs, window = 1, step = STEP, digits = DIGITS) {
  const t = (token || '').trim();
  if (!secretB32 || !new RegExp(`^\\d{${digits}}$`).test(t)) return false;
  const counter = Math.floor(atMs / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const c = counter + w;
    if (c < 0) continue;
    if (safeEqual(await hotp(secretB32, c, digits), t)) return true;
  }
  return false;
}
function otpauthUri(secretB32, account, issuer = 'SahakarLekha') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// RFC 6238 seed for SHA1 = ASCII "12345678901234567890" (20 bytes).
const SEED = base32Encode(new Uint8Array([...'12345678901234567890'].map(c => c.charCodeAt(0))));
ok(SEED === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'seed base32 matches RFC known value');

// 1. Official RFC 6238 vectors (8-digit codes), truncated to our 6 digits (last 6).
const VECTORS = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];
for (const [t, expected] of VECTORS) {
  const code = await totp(SEED, t * 1000);
  ok(code === expected, `RFC vector T=${t} → ${expected} (got ${code})`);
}

// 2. base32 round-trip.
const raw = new Uint8Array([0, 1, 2, 253, 254, 255, 42, 7]);
ok(base32Decode(base32Encode(raw)).join(',') === raw.join(','), 'base32 encode→decode round-trips');
ok(base32Decode('gez dgn bv').length > 0, 'base32Decode tolerates spaces/lowercase');

// 3. verify accepts the live code and rejects a wrong one.
const now = 1234567890 * 1000;
ok(await verifyTotp(SEED, '005924', now), 'verify accepts the current code');
ok(!(await verifyTotp(SEED, '000000', now)), 'verify rejects a wrong code');
ok(!(await verifyTotp(SEED, '5924', now)), 'verify rejects a short (non-6-digit) code');
ok(!(await verifyTotp(SEED, 'abcdef', now)), 'verify rejects non-numeric');
ok(!(await verifyTotp('', '005924', now)), 'verify rejects empty secret');

// 4. clock-skew window: previous/next step code passes with window=1, fails with window=0.
const prevCode = await totp(SEED, now - STEP * 1000);
ok(await verifyTotp(SEED, prevCode, now, 1), 'previous-step code passes within ±1 window');
ok(!(await verifyTotp(SEED, prevCode, now, 0)), 'previous-step code fails with window=0');

// 5. otpauth URI carries the secret + issuer, well-formed for authenticator apps.
const uri = otpauthUri(SEED, 'admin@society.com');
ok(uri.startsWith('otpauth://totp/'), 'otpauth URI scheme');
ok(uri.includes(`secret=${SEED}`) && uri.includes('issuer=SahakarLekha'), 'otpauth URI has secret + issuer');
ok(uri.includes('algorithm=SHA1') && uri.includes('digits=6') && uri.includes('period=30'), 'otpauth URI params match engine');

// 6. generated secrets are distinct base32 of expected length.
const s1 = base32Encode(webcrypto.getRandomValues(new Uint8Array(20)));
const s2 = base32Encode(webcrypto.getRandomValues(new Uint8Array(20)));
ok(s1.length === 32 && /^[A-Z2-7]+$/.test(s1), '160-bit secret → 32 base32 chars');
ok(s1 !== s2, 'two generated secrets differ');

// 7. Login-enforcement building block (ECR-12 slice 2): a code minted from a
//    secret verifies against that secret, and a code from a different secret does not.
const loginSecret = base32Encode(webcrypto.getRandomValues(new Uint8Array(20)));
const at = 1700000000 * 1000;
const liveCode = await totp(loginSecret, at);
ok(await verifyTotp(loginSecret, liveCode, at), 'login: a code minted from the secret verifies');
const otherSecret = base32Encode(webcrypto.getRandomValues(new Uint8Array(20)));
const foreignCode = await totp(otherSecret, at);
ok(!(await verifyTotp(loginSecret, foreignCode, at)) || foreignCode === liveCode, 'login: a code from a different secret is rejected');

console.log(`\nTOTP (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
