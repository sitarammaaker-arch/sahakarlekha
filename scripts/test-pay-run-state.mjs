// Payroll run state machine (Phase-5 §8). Proves the legal transition shape, the terminal
// states, the event→state mapping, idempotent replay, and that illegal sequences throw.
//
// Imports the real TypeScript source via Node's native type-stripping (Node 23.6+/24).
//
// Run: node scripts/test-pay-run-state.mjs   (npm run test:pay-run-state)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/runtime/runState.ts'));
} catch (e) {
  console.error('Could not import runState.ts (needs Node 23.6+/24 type-stripping):', e.message);
  process.exit(1);
}
const { canTransition, assertTransition, isTerminal, stateAfterEvent, replayRunState, RUN_STATES, TERMINAL_STATES, INITIAL_STATE } = m;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

// 1. state set
ok(RUN_STATES.length === 8, '8 run states');
ok(INITIAL_STATE === 'draft', 'initial state is draft');
ok(TERMINAL_STATES.includes('cancelled') && TERMINAL_STATES.includes('rolled_back'), 'terminal = cancelled + rolled_back');

// 2. legal transitions
ok(canTransition('draft', 'verified'), 'draft → verified');
ok(canTransition('verified', 'approved'), 'verified → approved');
ok(canTransition('verified', 'draft'), 'verified → draft (reject)');
ok(canTransition('approved', 'locked'), 'approved → locked');
ok(canTransition('approved', 'verified'), 'approved → verified (reject)');
ok(canTransition('locked', 'posted'), 'locked → posted');
ok(canTransition('posted', 'paid'), 'posted → paid');
ok(canTransition('posted', 'rolled_back'), 'posted → rolled_back');
ok(canTransition('paid', 'rolled_back'), 'paid → rolled_back');

// 3. illegal transitions
ok(!canTransition('draft', 'posted'), 'draft ↛ posted (must go through the chain)');
ok(!canTransition('locked', 'paid'), 'locked ↛ paid (must post first)');
ok(!canTransition('cancelled', 'draft'), 'cancelled is terminal');
ok(!canTransition('rolled_back', 'posted'), 'rolled_back is terminal');
ok(!canTransition('paid', 'posted'), 'paid ↛ posted (no going back)');

// 4. isTerminal
ok(isTerminal('cancelled') && isTerminal('rolled_back'), 'cancelled/rolled_back terminal');
ok(!isTerminal('draft') && !isTerminal('posted'), 'draft/posted not terminal');

// 5. assertTransition throws on illegal
throws(() => assertTransition('draft', 'posted'), /illegal transition draft → posted/, 'assertTransition blocks illegal');

// 6. event → state mapping + idempotent replay
ok(stateAfterEvent('draft', 'calculated') === 'draft', "'calculated' does not move the lifecycle");
ok(stateAfterEvent('draft', 'verified') === 'verified', "event 'verified' → verified");
ok(stateAfterEvent('draft', 'initiated') === 'draft', "re-'initiated' on draft is idempotent");
ok(stateAfterEvent('posted', 'reversed') === 'rolled_back', "event 'reversed' → rolled_back");
throws(() => stateAfterEvent('draft', 'posted'), /illegal transition draft → posted/, 'illegal event sequence throws');

// 7. full lifecycle replay
const happy = ['initiated', 'calculated', 'verified', 'approved', 'locked', 'posted', 'paid'];
ok(replayRunState(happy) === 'paid', 'replay happy path → paid');
const cancelled = ['initiated', 'verified', 'cancelled'];
ok(replayRunState(cancelled) === 'cancelled', 'replay cancel path → cancelled');
const rolledBack = ['initiated', 'verified', 'approved', 'locked', 'posted', 'reversed'];
ok(replayRunState(rolledBack) === 'rolled_back', 'replay reversal path → rolled_back');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay run-state — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
