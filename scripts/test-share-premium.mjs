// Share-transfer premium cap (ECR-16 / MS-11) — imports the REAL src/lib/sharePremium.ts (extracted
// from DataContext.transferShareCapital + the ShareRegister UI) via the '@/' loader, so it validates
// the ACTUAL cap logic both sites now share. Was a mirror. Run: node scripts/test-share-premium.mjs
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

const { premiumCap, premiumAllowed } = await import(abs('../src/lib/sharePremium.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. No premium → always allowed (existing behaviour unchanged, cap irrelevant).
ok(premiumAllowed(0, 1000, 0), 'zero premium allowed even with 0% cap');
ok(premiumAllowed(0, 1000, 10), 'zero premium allowed with a cap set');

// 2. Cap 0 / undefined → any premium blocked (statutory default).
ok(!premiumAllowed(1, 1000, 0), 'premium blocked when cap is 0%');
ok(!premiumAllowed(100, 1000, undefined), 'premium blocked when cap undefined');

// 3. Cap value → premium allowed up to the cap, blocked above.
ok(premiumCap(1000, 10) === 100, '10% of ₹1000 = ₹100 cap');
ok(premiumAllowed(100, 1000, 10), 'premium exactly at cap allowed');
ok(premiumAllowed(50, 1000, 10), 'premium below cap allowed');
ok(!premiumAllowed(150, 1000, 10), 'premium above cap blocked');

// 4. Cap scales with the face amount.
ok(premiumCap(2000, 5) === 100, '5% of ₹2000 = ₹100');
ok(premiumAllowed(100, 2000, 5) && !premiumAllowed(101, 2000, 5), 'cap tracks face amount');

// 5. Fractional cap rounds to 2dp.
ok(premiumCap(333.33, 7.5) === 25, '7.5% of 333.33 ≈ ₹25.00 (2dp)');

console.log(`\nShare-transfer premium cap (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
