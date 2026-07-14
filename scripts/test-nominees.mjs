// Nominees (ECR-16 — multiple nominees) — imports the REAL helpers from
// src/lib/nomineeUtils.ts via the '@/' loader. Run: node scripts/test-nominees.mjs
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

const { nomineeShareTotal, validateNominees } = await import(abs('../src/lib/nomineeUtils.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Empty list is allowed here (mandatory-at-least-one is caller-enforced).
ok(validateNominees([]).ok === true, 'empty nominee list is valid at lib level');
ok(nomineeShareTotal([]) === 0 && nomineeShareTotal(undefined) === 0, 'total of empty/undefined is 0');

// 2. A well-formed single nominee at 100%.
ok(validateNominees([{ name: 'A', relation: 'son', sharePercent: 100 }]).ok, 'single 100% nominee valid');

// 3. Two nominees summing to 100.
const two = [{ name: 'A', relation: 'son', sharePercent: 60 }, { name: 'B', relation: 'daughter', sharePercent: 40 }];
ok(validateNominees(two).ok && nomineeShareTotal(two) === 100, 'two nominees summing to 100 valid');

// 4. Under 100% is allowed (partial nomination); over 100% is rejected.
ok(validateNominees([{ name: 'A', relation: 'son', sharePercent: 50 }]).ok, 'partial (<100%) allowed');
const over = [{ name: 'A', relation: 'son', sharePercent: 60 }, { name: 'B', relation: 'wife', sharePercent: 50 }];
ok(!validateNominees(over).ok && validateNominees(over).total === 110, 'total >100% rejected');

// 5. Missing name / relation / non-positive share rejected.
ok(!validateNominees([{ name: '', relation: 'son', sharePercent: 100 }]).ok, 'missing name rejected');
ok(!validateNominees([{ name: 'A', relation: '', sharePercent: 100 }]).ok, 'missing relation rejected');
ok(!validateNominees([{ name: 'A', relation: 'son', sharePercent: 0 }]).ok, 'zero share rejected');

// 6. Fractional shares total correctly (rounding).
ok(nomineeShareTotal([{ sharePercent: 33.33 }, { sharePercent: 33.33 }, { sharePercent: 33.34 }]) === 100, 'fractional shares sum to 100');

console.log(`\nNominees (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
