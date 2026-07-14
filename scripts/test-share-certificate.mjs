// Share certificate lifecycle (ECR-16) — imports the REAL validateCertificate from
// src/lib/shareCertUtils.ts via the '@/' loader. Run: node scripts/test-share-certificate.mjs
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

const { validateCertificate } = await import(abs('../src/lib/shareCertUtils.ts'));

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
