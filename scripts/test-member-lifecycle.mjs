// Member lifecycle (ECR-16) — imports the REAL src/lib/memberLifecycle.ts (extracted from
// DataContext) via the '@/' loader, so it validates the ACTUAL transition rule. Was a mirror.
// Run: node scripts/test-member-lifecycle.mjs
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

const { MEMBER_STATUSES, canTransitionMember, isMemberActive } = await import(abs('../src/lib/memberLifecycle.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. The five lifecycle states exist.
ok(MEMBER_STATUSES.length === 5, 'five lifecycle states');

// 2. Normal exits from active are allowed.
ok(canTransitionMember('active', 'resigned'), 'active → resigned allowed');
ok(canTransitionMember('active', 'expelled'), 'active → expelled allowed');
ok(canTransitionMember('active', 'deceased'), 'active → deceased allowed');
ok(canTransitionMember('active', 'inactive'), 'active → inactive (suspend) allowed');

// 3. Reactivation / reinstatement back to active is allowed from non-terminal states.
ok(canTransitionMember('resigned', 'active'), 'resigned → active (rejoin) allowed');
ok(canTransitionMember('expelled', 'active'), 'expelled → active (reinstate) allowed');
ok(canTransitionMember('inactive', 'active'), 'inactive → active (resume) allowed');

// 4. Deceased is terminal — no transition out.
ok(!canTransitionMember('deceased', 'active'), 'deceased → active BLOCKED (terminal)');
ok(!canTransitionMember('deceased', 'resigned'), 'deceased → resigned BLOCKED');
for (const s of MEMBER_STATUSES) ok(!canTransitionMember('deceased', s), `deceased → ${s} blocked`);

// 5. No self-transition (nothing to record).
for (const s of MEMBER_STATUSES) ok(!canTransitionMember(s, s), `${s} → ${s} blocked (no-op)`);

// 6. Unknown target rejected.
ok(!canTransitionMember('active', 'zombie'), 'unknown target status rejected');

// 7. Eligibility invariant — exit states are excluded from dividend/active counts.
ok(isMemberActive('active'), 'active is eligible');
ok(!isMemberActive('inactive') && !isMemberActive('resigned') && !isMemberActive('expelled') && !isMemberActive('deceased'),
  'all non-active states are excluded (dividend/active count unchanged)');

console.log(`\nMember lifecycle (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
