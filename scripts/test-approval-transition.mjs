// Approval state machine (ECR-11) — imports the REAL src/lib/approvalTransition.ts via the '@/' loader.
// Run: node scripts/test-approval-transition.mjs
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

const { canApprovalTransition } = await import(abs('../src/lib/approvalTransition.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Only pending → terminal is allowed.
ok(canApprovalTransition('pending', 'approved'), 'pending → approved allowed');
ok(canApprovalTransition('pending', 'rejected'), 'pending → rejected allowed');

// 2. Terminal states cannot transition again (no re-approve / re-reject / flip).
ok(!canApprovalTransition('approved', 'approved'), 'approved → approved blocked (no double-approve)');
ok(!canApprovalTransition('approved', 'rejected'), 'approved → rejected blocked');
ok(!canApprovalTransition('rejected', 'approved'), 'rejected → approved blocked (no silent re-post)');
ok(!canApprovalTransition('rejected', 'rejected'), 'rejected → rejected blocked');

// 3. A voucher not in the workflow (undefined status) is not transitionable here.
ok(!canApprovalTransition(undefined, 'approved'), 'undefined (non-workflow) → approved blocked');
ok(!canApprovalTransition(undefined, 'rejected'), 'undefined (non-workflow) → rejected blocked');

console.log(`\nApproval state machine (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
