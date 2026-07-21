// Run aggregate projection (Phase-5 §8/§9). Proves the event stream folds to the run's current
// state + timeline + reversal awareness, is order-independent, and refuses a bad stream (empty,
// multi-run, non-gapless). Composes bricks 1+2. Imports real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-run-aggregate.mjs   (npm run test:pay-run-aggregate)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ra, ev;
try {
  ra = await import(abs('../src/lib/pay/runtime/runAggregate.ts'));
  ev = await import(abs('../src/lib/pay/runtime/payEvent.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { projectRunAggregate } = ra;
const { buildPayEvent, reversePayEvent } = ev;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const throws = (fn, re, m) => { try { fn(); fail++; console.error('  ✗ (did not throw)', m); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', m, '::', e.message); } } };

const SOC = 'soc-1', RUN = 'run-1';
const human = { kind: 'human', actorEmail: 'clerk@society.com' };
const mk = (seq, type, extra = {}) =>
  buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: seq, eventType: type, producer: human, ...extra },
                { eventId: `evt-${seq}`, occurredAt: `2026-04-30T10:0${seq}:00.000Z` });

// 1. happy lifecycle → paid
const happy = [mk(1, 'initiated'), mk(2, 'calculated'), mk(3, 'verified'), mk(4, 'approved'), mk(5, 'locked'), mk(6, 'posted'), mk(7, 'paid')];
const a = projectRunAggregate(happy);
ok(a.runId === RUN && a.societyId === SOC, 'runId + societyId projected');
ok(a.currentState === 'paid', 'currentState = paid');
ok(a.lastSequence === 7 && a.eventCount === 7, 'lastSequence + eventCount');
ok(a.postedAt === '2026-04-30T10:06:00.000Z' && a.paidAt === '2026-04-30T10:07:00.000Z', 'postedAt/paidAt captured');
ok(a.reversalCount === 0 && a.reversedEventIds.length === 0, 'no reversals');
ok(a.isTerminal === false, 'paid is NOT terminal (can still be rolled back)');
ok(a.timeline.length === 7 && a.timeline[5].state === 'posted', 'timeline records per-event state');

// 2. order-independence
const shuffled = [happy[3], happy[0], happy[6], happy[1], happy[5], happy[2], happy[4]];
const b = projectRunAggregate(shuffled);
ok(b.currentState === 'paid' && b.lastSequence === 7, 'order-independent (shuffled → same result)');

// 3. reversal → rolled_back
const posted = mk(6, 'posted');
const toPosted = [mk(1, 'initiated'), mk(2, 'verified'), mk(3, 'approved'), mk(4, 'locked'), mk(5, 'calculated'), posted];
const rev = reversePayEvent(posted, { eventId: 'evt-7', occurredAt: '2026-04-30T11:00:00.000Z' }, { sequence: 7, producer: human, reason: 'wrong period' });
const c = projectRunAggregate([...toPosted, rev]);
ok(c.currentState === 'rolled_back', 'posted + reversed → rolled_back');
ok(c.reversalCount === 1 && c.reversedEventIds.includes(posted.eventId), 'reversal recorded, original marked reversed');
ok(c.reversedAt === '2026-04-30T11:00:00.000Z', 'reversedAt captured');
ok(c.isTerminal === true, 'rolled_back is terminal');

// 4. cancel → cancelled
const cancelled = projectRunAggregate([mk(1, 'initiated'), mk(2, 'verified'), mk(3, 'cancelled')]);
ok(cancelled.currentState === 'cancelled' && cancelled.cancelledAt && cancelled.isTerminal === true, 'cancel path → cancelled (terminal)');

// 5. refusals
throws(() => projectRunAggregate([]), /at least one event/, 'empty stream refused');
throws(() => projectRunAggregate([mk(1, 'initiated'), mk(3, 'verified')]), /not gapless/, 'non-gapless refused');
const otherRun = buildPayEvent({ societyId: SOC, aggregateId: 'run-2', sequence: 2, eventType: 'verified', producer: human }, { eventId: 'x', occurredAt: '2026-04-30T10:00:00.000Z' });
throws(() => projectRunAggregate([mk(1, 'initiated'), otherRun]), /span more than one run/, 'multi-run stream refused');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay run-aggregate — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
