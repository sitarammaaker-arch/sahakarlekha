// Member KYC (ECR-16) — imports the REAL helpers from src/lib/kycUtils.ts via the '@/'
// loader. Run: node scripts/test-kyc.mjs
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

const { validateKyc, maskId } = await import(abs('../src/lib/kycUtils.ts'));

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
