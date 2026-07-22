// Payroll stage plan — idempotent, resumable pipeline stepping (Phase-5 §2/§3, ADR-R3).
// Proves stage order, sharding, the resume point (nextIncomplete), completion, and that a
// recorded step is a no-op (exactly-once). Imports the real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-stage-plan.mjs   (npm run test:pay-stage-plan)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/runtime/stagePlan.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { PAYROLL_STAGES, stageKey, shardCount, allSteps, nextIncomplete, isComplete, remainingCount, isStepDone } = m;

let pass = 0, fail = 0;
const ok = (c, m2) => { if (c) pass++; else { fail++; console.error('  ✗', m2); } };

const RUN = 'run-abc';
// execute is sharded (3 shards); everything else is single-shard.
const plan = { runId: RUN, shards: { execute: 3 } };

// 1. stages
ok(PAYROLL_STAGES.length === 12, '12 pipeline stages');
ok(PAYROLL_STAGES.includes('freeze_snapshot'), 'freeze_snapshot boundary present');
ok(PAYROLL_STAGES[0] === 'load_config' && PAYROLL_STAGES[PAYROLL_STAGES.length - 1] === 'persist', 'load_config first, persist last');

// 2. keys + shards
ok(stageKey(RUN, 'execute', 2) === 'run-abc|execute|2', 'stageKey format');
ok(shardCount(plan, 'execute') === 3 && shardCount(plan, 'validate') === 1, 'shardCount: execute=3, default=1');
ok(shardCount({ runId: RUN, shards: { execute: 0 } }, 'execute') === 1, 'shardCount clamps < 1 to 1');

// 3. allSteps: 11 single-shard stages + 3 execute shards = 14
ok(allSteps(plan).length === 14, 'allSteps = 14 (11 + 3 execute shards)');

// 4. resume from empty → first step
const empty = new Set();
ok(nextIncomplete(plan, empty)?.key === stageKey(RUN, 'load_config', 0), 'nextIncomplete(empty) = load_config#0');
ok(remainingCount(plan, empty) === 14, 'remainingCount(empty) = 14');
ok(!isComplete(plan, empty), 'empty is not complete');

// 5. progressive completion + idempotency
const done = new Set();
let step, guard = 0;
const order = [];
while ((step = nextIncomplete(plan, done)) && guard++ < 100) {
  order.push(`${step.stage}#${step.shard}`);
  // idempotency: before recording, it's not done; recording once is enough
  ok(!isStepDone(done, RUN, step.stage, step.shard), `step ${step.stage}#${step.shard} not yet done`);
  done.add(step.key);
  ok(isStepDone(done, RUN, step.stage, step.shard), `step ${step.stage}#${step.shard} now done (idempotent guard)`);
}
ok(order.length === 14, 'stepped through all 14 in order');
// execute's 3 shards come before 'events', after 'plan'
const iPlan = order.indexOf('plan#0');
const iEvents = order.indexOf('events#0');
const execIdx = ['execute#0', 'execute#1', 'execute#2'].map((s) => order.indexOf(s));
ok(execIdx.every((i) => i > iPlan && i < iEvents), 'all execute shards run after plan and before events');
ok(isComplete(plan, done), 'all steps complete');
ok(nextIncomplete(plan, done) === null, 'nextIncomplete = null when complete');

// 6. resume mid-execute (crash after execute#0)
const partial = new Set(
  [...PAYROLL_STAGES.slice(0, PAYROLL_STAGES.indexOf('execute')).map((s) => stageKey(RUN, s, 0)), stageKey(RUN, 'execute', 0)],
);
ok(nextIncomplete(plan, partial)?.key === stageKey(RUN, 'execute', 1), 'resume after execute#0 → execute#1 (not restart)');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay stage-plan — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
