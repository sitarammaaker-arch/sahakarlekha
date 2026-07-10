// Restore dependency resolver (T-30 / gap EXP-03).
//
// The plan this file tests is the one every later restore stage obeys. If the order is
// wrong, a restore inserts a voucher before the member it points at, reports success, and
// the books are quietly wrong. If `voucher_entry` slips into the plan, a restore imports
// last year's arithmetic instead of recomputing it.
//
// So the tests are in three registers:
//   1. against the REAL registry — the order and the accounting must hold today;
//   2. against SYNTHETIC registries — cycles, dangling parents, and a flipped policy;
//   3. against the GUARD ITSELF — break it, and confirm it goes red.
//
// Run: node scripts/test-restore-dag.mjs   (npm run test:restore-dag)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }

      export async function load(url, ctx, next) {
        if (url === SUPABASE) {
          return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let dag, reg;
try {
  dag = await import(abs('../src/lib/restore/dag.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the restore DAG.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const {
  planRestore, restoreOrder, isRestorable, assertDependencyClosure, assertNeverInserted,
  describePlan, NEVER_INSERT_KEYS, RestorePlanError,
} = dag;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, msg, match) => {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  ok(e instanceof RestorePlanError && (!match || e.message.includes(match)),
    `${msg} (got: ${e ? e.message.slice(0, 80) : 'no throw'})`);
  return e;
};

/** A synthetic descriptor with only the fields the graph functions read. */
const ent = (key, dependsOn = [], backupPolicy = 'full', scope = 'society') =>
  ({ key, dependsOn, backupPolicy, scope });

// ── 1. THE REAL REGISTRY ─────────────────────────────────────────────────────

const plan = planRestore(REGISTRY);

ok(plan.insert.length === 84, `84 collections are inserted (got ${plan.insert.length})`);
ok(plan.skipped.length === 9, `9 are skipped with a reason (got ${plan.skipped.length})`);
ok(plan.insert.length + plan.skipped.length === REGISTRY.length,
  'every declared entity is either inserted or explained — no entity vanishes from a restore');

// No entity is both inserted and skipped.
const insertKeys = new Set(plan.insert.map(e => e.key));
ok(plan.skipped.every(s => !insertKeys.has(s.key)), 'nothing is both inserted and skipped');

// Acceptance 2: voucher_entry NEVER appears in the insert plan.
ok(!insertKeys.has('voucher_entry'),
  'voucher_entry is NEVER inserted — the posting engine regenerates it (T-33)');
ok(!insertKeys.has('audit_log'), 'audit_log is never inserted — it is WORM');
ok(!insertKeys.has('guide_certificate'), 'guide_certificate is never inserted — it is third-party evidence');

const reasons = Object.fromEntries(plan.skipped.map(s => [s.key, s.reason]));
ok(reasons.voucher_entry === 'replay', 'voucher_entry is skipped for the RIGHT reason: replay');
ok(reasons.audit_log === 'sidecar', 'audit_log is skipped as sidecar evidence');
ok(plan.skipped.filter(s => s.reason === 'exclude').length === 6, 'six entities never left the society');
ok(plan.skipped.every(s => s.explanation.length > 10), 'every skip carries an operator-readable explanation');

// Acceptance 1: dependency-first, and deterministic.
const position = new Map(plan.insert.map((e, i) => [e.key, i]));
let violations = [];
for (const e of plan.insert) {
  for (const dep of e.dependsOn) {
    if (!position.has(dep)) continue;              // non-restorable deps are closure's job
    if (position.get(dep) > position.get(e.key)) violations.push(`${e.key} before its parent ${dep}`);
  }
}
ok(violations.length === 0, `every dependency precedes its dependent (${violations.slice(0, 3).join('; ')})`);

const again = planRestore(REGISTRY);
ok(JSON.stringify(again.insert.map(e => e.key)) === JSON.stringify(plan.insert.map(e => e.key)),
  'the order is deterministic across runs');

// `society` is the root of almost everything, so it must come before its dependents.
const societyPos = position.get('society');
ok(societyPos !== undefined && plan.insert
  .filter(e => e.dependsOn.includes('society'))
  .every(e => position.get(e.key) > societyPos),
  'society is inserted before everything that depends on it');

// Teardown is the exact reverse: Replace mode deletes children before parents.
ok(JSON.stringify(plan.teardown.map(e => e.key)) === JSON.stringify([...plan.insert].reverse().map(e => e.key)),
  'teardown is the exact reverse of insert — children are deleted before their parents');

// The closure holds today. This is the assertion that fails the build the day it stops.
let closureErr = null;
try { assertDependencyClosure(REGISTRY); } catch (e) { closureErr = e; }
ok(closureErr === null, `every dependency of a restorable entity is itself restorable (${closureErr?.message ?? ''})`);

ok(describePlan(plan, false).includes('84 collections'), 'the summary names the real count');
ok(describePlan(plan, true).includes('84'), 'and says so in Hindi too');

// ── 2. SYNTHETIC GRAPHS ──────────────────────────────────────────────────────

// Ordering must survive a dependency that routes THROUGH a non-restorable entity. This is
// why restoreOrder sorts the whole graph and filters after, rather than sorting a subgraph:
// filtering first would drop the a→b edge and lose the a-after-c ordering entirely.
const throughSidecar = [
  ent('a', ['b']),
  ent('b', ['c'], 'sidecar'),
  ent('c', []),
];
const chain = restoreOrder(throughSidecar).map(e => e.key);
ok(JSON.stringify(chain) === JSON.stringify(['c', 'a']),
  `a transitive dependency through a skipped entity still orders correctly (got ${chain.join(',')})`);

// A cycle is a hard error, not a plausible order.
throws(() => restoreOrder([ent('x', ['y']), ent('y', ['x'])]), 'a dependency cycle is a hard error', 'cycle');
throws(() => planRestore([ent('x', ['y']), ent('y', ['x'])]), 'planRestore refuses a cyclic registry', 'cycle');

// A restorable entity whose parent is never restored = a dangling reference the restore
// would call a success.
throws(() => assertDependencyClosure([ent('child', ['ghost']), ent('ghost', [], 'sidecar')]),
  'a full entity depending on a sidecar one is refused', 'child → ghost');
throws(() => assertDependencyClosure([ent('child', ['secret']), ent('secret', [], 'exclude')]),
  'a full entity depending on an excluded one is refused');
throws(() => assertDependencyClosure([ent('child', ['shared']), ent('shared', [], 'full', 'global')]),
  'a full entity depending on a global-scope one is refused');

// An unresolved dep is validateRegistry's problem, not the DAG's — it must not be mistaken
// for a broken closure.
let e2 = null;
try { assertDependencyClosure([ent('child', ['nowhere'])]); } catch (err) { e2 = err; }
ok(e2 === null, 'an unresolved dependency is left to validateRegistry, not misreported as a closure break');

// Scope and policy both gate insertability.
ok(isRestorable(ent('a')) === true, 'a society-scoped full entity is restorable');
ok(isRestorable(ent('a', [], 'full', 'global')) === false, 'a global-scope entity is not restorable');
ok(isRestorable(ent('a', [], 'replay')) === false, 'a replay entity is not restorable');

ok(planRestore([]).insert.length === 0, 'an empty registry plans an empty restore');

// planRestore's "every entity accounted for" assertion has NO test here, on purpose.
// `isRestorable` and `skipReasonFor` are complements by construction, so no input can make
// them disagree — only an edit to one of them can. Verified by sabotage: deleting the
// `replay` branch of skipReasonFor makes it throw `84 inserted + 8 skipped ≠ 93 declared`.
// A test that could not fail would be worse than this comment.

// Shuffling declaration order may change tie-breaks, but never the dependency ordering.
const shuffled = [...REGISTRY].reverse();
const shufPos = new Map(restoreOrder(shuffled).map((e, i) => [e.key, i]));
violations = [];
for (const e of REGISTRY) {
  if (!shufPos.has(e.key)) continue;
  for (const dep of e.dependsOn) {
    if (shufPos.has(dep) && shufPos.get(dep) > shufPos.get(e.key)) violations.push(`${e.key}→${dep}`);
  }
}
ok(violations.length === 0, `dependency order survives a reordered registry (${violations.slice(0, 3).join(';')})`);

// ── 3. THE GUARD ITSELF ──────────────────────────────────────────────────────
//
// NEVER_INSERT_KEYS is deliberately NOT derived from backupPolicy. A derived guard is empty
// exactly when the policy is wrong, so it would pass at the only moment it mattered. These
// two tests are the reason that list exists.

ok(NEVER_INSERT_KEYS.includes('voucher_entry'), 'voucher_entry is named on the never-insert list');
ok(Object.isFrozen(NEVER_INSERT_KEYS), 'the never-insert list cannot be mutated at runtime');

// FORWARD: a hand-built plan that smuggles voucher_entry in must be rejected.
throws(
  () => assertNeverInserted({ insert: [ent('voucher_entry')], teardown: [], skipped: [] }, REGISTRY),
  'a plan containing voucher_entry is rejected',
  'must never be inserted',
);

// THE SABOTAGE a derived guard would sleep through: flip voucher_entry's policy to 'full'.
// It now reads as ordinary data. A guard that computed its exclusions from `backupPolicy`
// would have nothing left to exclude, find no violation, and pass.
const sabotaged = REGISTRY.map(e => (e.key === 'voucher_entry' ? { ...e, backupPolicy: 'full' } : e));
ok(isRestorable(sabotaged.find(e => e.key === 'voucher_entry')) === true,
  'the sabotage really applied — voucher_entry now reads as restorable');

// Through planRestore the FORWARD check fires: the flipped entity lands in `insert`, and
// the independent key list catches it there.
const err = throws(() => planRestore(sabotaged),
  'flipping voucher_entry to `full` is caught by planRestore',
  'must never be inserted');
ok(err?.detail === 'voucher_entry', 'and the error names the entity that must not be written');

const sabotaged2 = REGISTRY.map(e => (e.key === 'audit_log' ? { ...e, backupPolicy: 'full' } : e));
throws(() => planRestore(sabotaged2), 'flipping audit_log to `full` is caught too', 'must never be inserted');

// BACKWARD, tested directly. `planRestore` can never reach this branch — its plan IS
// `filter(isRestorable)`, so a flipped policy always trips the forward check first. The
// branch exists for a caller that assembles a plan some other way, and this is the only
// honest way to exercise it: hand it an empty plan over a sabotaged registry.
const backward = throws(
  () => assertNeverInserted({ insert: [], teardown: [], skipped: [] }, sabotaged),
  'a policy flip is caught even by a plan that happens not to contain the entity',
  'become restorable',
);
ok(backward?.detail === 'voucher_entry', 'and the backward check names it too');

// And with the real registry, an empty plan is fine — the guard does not fire on nothing.
let quiet = null;
try { assertNeverInserted({ insert: [], teardown: [], skipped: [] }, REGISTRY); } catch (e3) { quiet = e3; }
ok(quiet === null, 'the guard stays silent when policies are correct');

// ── 4. PURITY (acceptance 3) ─────────────────────────────────────────────────
//
// The plan must be computable with no database, no clock and no browser. Every later stage
// depends on being able to show the operator the plan BEFORE anything is written.

const source = readFileSync(pathResolve(SRC, 'lib', 'restore', 'dag.ts'), 'utf8');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!source.includes(forbidden), `dag.ts performs no I/O and is deterministic (found "${forbidden}")`);
}
ok(!/^import .*['"](?!\.\.\/export\/registry\.types)/m.test(source.split('\n').filter(l => l.startsWith('import')).join('\n')) ||
   source.split('\n').filter(l => l.startsWith('import')).every(l => l.includes('registry.types')),
  'dag.ts imports nothing but the registry types');

console.log(`\nRestore DAG: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
