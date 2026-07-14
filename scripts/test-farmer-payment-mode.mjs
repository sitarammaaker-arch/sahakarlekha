// Farmer-payment credit resolution. Imports the REAL src/lib/procurement/farmerPaymentMode.ts
// via the '@/' loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-farmer-payment-mode.mjs
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

const { resolveFarmerPaymentCredit } = await import(abs('../src/lib/procurement/farmerPaymentMode.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const ids = { cash: '3301', bank: '3302', agency: 'hafed-ctrl' };

ok(resolveFarmerPaymentCredit('cash', ids) === '3301', 'cash → cash account');
ok(resolveFarmerPaymentCredit('bank', ids) === '3302', 'bank → chosen bank account');
ok(resolveFarmerPaymentCredit('agency', ids) === 'hafed-ctrl', 'agency → agency receivable account');
ok(resolveFarmerPaymentCredit('agency', { cash: '3301', bank: '3302' }) === null, 'agency without an account → null (block the post)');
ok(resolveFarmerPaymentCredit('cash', { cash: '', bank: '3302', agency: 'x' }) === null, 'missing cash account → null');
ok(resolveFarmerPaymentCredit('bank', { cash: '3301', bank: '', agency: 'x' }) === null, 'missing bank account → null');

console.log(`\nFarmer payment mode (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
