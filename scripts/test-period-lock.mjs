// Period-lock / back-dating prevention (P1 #7 / ECR-07) — imports the REAL src/lib/periodLock.ts
// (extracted from DataContext) via the '@/' loader, so it validates the ACTUAL predicate. Was a mirror.
// Run: node scripts/test-period-lock.mjs
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

const { isPeriodLocked } = await import(abs('../src/lib/periodLock.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const LOCK = '2025-05-31';

// 1. Dates on/before the lock are blocked.
ok(isPeriodLocked('2025-05-31', LOCK) === true, 'exactly the lock date is locked (inclusive)');
ok(isPeriodLocked('2025-05-01', LOCK) === true, 'date before lock is locked');
ok(isPeriodLocked('2024-12-31', LOCK) === true, 'prior-year date is locked');

// 2. Dates after the lock stay open.
ok(isPeriodLocked('2025-06-01', LOCK) === false, 'day after lock is open');
ok(isPeriodLocked('2026-01-01', LOCK) === false, 'later date is open');

// 3. No lock set → never blocked (backward-compatible default).
ok(isPeriodLocked('2020-01-01', undefined) === false, 'undefined lock → open');
ok(isPeriodLocked('2020-01-01', '') === false, 'empty lock → open');

// 4. Missing entity date → not blocked (guard only acts on a real date).
ok(isPeriodLocked(undefined, LOCK) === false, 'undefined date → not blocked');
ok(isPeriodLocked('', LOCK) === false, 'empty date → not blocked');

// 5. Guard semantics — edit checks BOTH existing and incoming dates (any locked ⇒ block).
const editBlocked = (existing, incoming, lock) => [existing, incoming].some(d => isPeriodLocked(d, lock));
ok(editBlocked('2025-05-10', '2025-07-01', LOCK) === true, 'editing a voucher already in the locked period is blocked');
ok(editBlocked('2025-07-10', '2025-05-01', LOCK) === true, 'back-dating an open voucher into the locked period is blocked');
ok(editBlocked('2025-07-10', '2025-08-01', LOCK) === false, 'editing wholly within the open period is allowed');
ok(editBlocked('2025-07-10', undefined, LOCK) === false, 'edit with unchanged (open) date and no new date is allowed');

console.log(`\nPeriod lock (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
