// Dual-control FY unlock (ECR-07) — imports the REAL src/lib/dualControlUnlock.ts via the '@/' loader.
// Run: node scripts/test-dual-control-unlock.mjs
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

const { unlockAction, canApproveUnlock } = await import(abs('../src/lib/dualControlUnlock.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Unlocked → nothing to do for anyone.
ok(unlockAction({ locked: false }, 'a@x.com') === 'none', 'unlocked → none');

// 2. Locked, no request → any admin can request.
ok(unlockAction({ locked: true }, 'a@x.com') === 'request', 'locked, no request → request');

// 3. Locked, requested by A → A only sees "awaiting" (cannot self-approve).
ok(unlockAction({ locked: true, requestedBy: 'a@x.com' }, 'a@x.com') === 'awaiting', 'requester sees awaiting');
ok(!canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, 'a@x.com'), 'requester CANNOT approve own request');

// 4. Locked, requested by A → a DIFFERENT admin B can approve.
ok(unlockAction({ locked: true, requestedBy: 'a@x.com' }, 'b@x.com') === 'approve', 'other admin → approve');
ok(canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, 'b@x.com'), 'a second, distinct admin CAN approve');

// 5. Empty/unknown user never approves.
ok(!canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, ''), 'empty user cannot approve');

console.log(`\nDual-control unlock (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
