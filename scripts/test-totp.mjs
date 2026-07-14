// TOTP engine (ECR-12) — imports the REAL src/lib/totp.ts via the '@/' loader.
// Validates against the official RFC 6238 Appendix-B test vectors (SHA1, seed
// "12345678901234567890"). Run: node scripts/test-totp.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { webcrypto } from 'node:crypto';

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

const { base32Encode, base32Decode, totp, verifyTotp, otpauthUri } = await import(abs('../src/lib/totp.ts'));

// Fixture constant the assertions use (mirrors the engine's 30s step).
const STEP = 30;

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
