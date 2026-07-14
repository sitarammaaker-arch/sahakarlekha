// Segregation of Duties — maker ≠ checker (ECR-06) — imports the REAL src/lib/sod.ts
// via the '@/' loader. Run: node scripts/test-sod.mjs
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

const { isRealMaker, isSelfApproval } = await import(abs('../src/lib/sod.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Same real person makes + approves → blocked (self-approval).
ok(isSelfApproval('Ramesh Kumar', 'Ramesh Kumar'), 'same maker & approver → self-approval');
// 2. Different people → allowed.
ok(!isSelfApproval('Ramesh Kumar', 'Suresh Rao'), 'different maker & approver → not self-approval');
// 3. Case / whitespace insensitive.
ok(isSelfApproval('  Ramesh Kumar ', 'ramesh kumar'), 'case & whitespace insensitive match');
// 4. System/auto/engine makers are never self-approval (admin must approve machine entries).
ok(!isSelfApproval('System', 'System'), "'System' maker → not self-approval");
ok(!isSelfApproval('System (repair)', 'System (repair)'), "'System (repair)' maker → not self-approval");
ok(!isSelfApproval('', ''), 'empty maker → not self-approval');
ok(!isSelfApproval(undefined, 'Ramesh Kumar'), 'undefined maker → not self-approval');
ok(!isSelfApproval(null, 'Ramesh Kumar'), 'null maker → not self-approval');
// 5. Real maker but approver blank → not equal → allowed (no identity to compare).
ok(!isSelfApproval('Ramesh Kumar', ''), 'real maker, blank approver → not self-approval');
ok(!isSelfApproval('Ramesh Kumar', undefined), 'real maker, undefined approver → not self-approval');
// 6. isRealMaker guard.
ok(isRealMaker('Ramesh Kumar') === true, 'named maker is real');
ok(isRealMaker('system') === false, 'system (any case) is not real');
ok(isRealMaker('  ') === false, 'whitespace-only maker is not real');

console.log(`\nSoD maker≠checker (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
