// Payroll event envelope (Phase-4 pay_event / Phase-5 §8). Proves validation, the pay_event
// shape, gapless-sequence helpers, append-only reversal, and — tying brick 1 + 2 together — that
// a run's event stream replays through the state machine to the right lifecycle state.
//
// Imports the real TypeScript via Node 24 type-stripping.
// Run: node scripts/test-pay-event.mjs   (npm run test:pay-event)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ev, rs;
try {
  ev = await import(abs('../src/lib/pay/runtime/payEvent.ts'));
  rs = await import(abs('../src/lib/pay/runtime/runState.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { buildPayEvent, isReversal, nextSequence, assertGaplessSequence, reversePayEvent } = ev;
const { replayRunState } = rs;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const throws = (fn, re, m) => { try { fn(); fail++; console.error('  ✗ (did not throw)', m); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', m, '::', e.message); } } };

const SOC = '11111111-1111-1111-1111-111111111111';
const RUN = '22222222-2222-2222-2222-222222222222';
const human = { kind: 'human', actorEmail: 'clerk@society.com' };
const ctx = (n) => ({ eventId: `evt-${n}`, occurredAt: '2026-04-30T10:00:00.000Z' });
const mk = (seq, type, producer = human, extra = {}) =>
  buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: seq, eventType: type, producer, ...extra }, ctx(seq));

// 1. valid build → shape
const e1 = mk(1, 'initiated');
ok(e1.aggregateType === 'pay_run', "aggregateType is 'pay_run'");
ok(e1.schemaVersion === 1, 'schemaVersion defaults to 1');
ok(e1.producerKind === 'human' && e1.actorEmail === 'clerk@society.com', 'producer mapped to producerKind + actorEmail');
ok(e1.eventId === 'evt-1' && e1.occurredAt === '2026-04-30T10:00:00.000Z', 'injected id/time used (deterministic)');
ok(!isReversal(e1), 'a normal event is not a reversal');

// 2. AI attribution (producer kind + onBehalfOf, ADR-0010)
const eAI = mk(2, 'calculated', { kind: 'agent', actorEmail: 'ai@sahakarlekha', onBehalfOf: 'clerk@society.com' });
ok(eAI.producerKind === 'agent' && eAI.onBehalfOf === 'clerk@society.com', 'AI agent event attributed with onBehalfOf');

// 3. validation throws
throws(() => buildPayEvent({ societyId: '', aggregateId: RUN, sequence: 1, eventType: 'initiated', producer: human }, ctx(1)), /societyId is required/, 'missing societyId');
throws(() => buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: 1, eventType: 'initiated', producer: { kind: 'human', actorEmail: '' } }, ctx(1)), /actorEmail is required/, 'missing actorEmail');
throws(() => buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: 1, eventType: 'initiated', producer: { kind: 'robot', actorEmail: 'x@y' } }, ctx(1)), /producer.kind must be/, 'bad producer kind');
throws(() => buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: 1, eventType: 'exploded', producer: human }, ctx(1)), /eventType must be a PayEventType/, 'bad eventType');
throws(() => buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: 0, eventType: 'initiated', producer: human }, ctx(1)), /sequence must be a positive integer/, 'sequence < 1');
throws(() => buildPayEvent({ societyId: SOC, aggregateId: RUN, sequence: 2, eventType: 'reversed', producer: human }, ctx(2)), /'reversed' event must carry reversalOf/, "'reversed' without reversalOf");

// 4. gapless-sequence helpers
const stream = [mk(1, 'initiated'), mk(2, 'verified'), mk(3, 'approved')];
ok(nextSequence(stream, RUN) === 4, 'nextSequence = max+1');
ok(nextSequence([], RUN) === 1, 'nextSequence of empty = 1');
assertGaplessSequence(stream, RUN); ok(true, 'gapless stream passes assertGaplessSequence');
throws(() => assertGaplessSequence([mk(1, 'initiated'), mk(3, 'approved')], RUN), /not gapless/, 'a gap is caught');
throws(() => assertGaplessSequence([mk(1, 'initiated'), mk(1, 'verified')], RUN), /not gapless/, 'a duplicate is caught');

// 5. append-only reversal
const posted = mk(5, 'posted');
const rev = reversePayEvent(posted, ctx(6), { sequence: 6, producer: human, reason: 'wrong period' });
ok(rev.eventType === 'reversed' && rev.reversalOf === posted.eventId && isReversal(rev), 'reversal points at the original, is append-only');
ok(rev.sequence === 6 && posted.sequence === 5, 'reversal is a NEW later-sequence event (original retained)');

// 6. brick 1 + 2 integration: a run's event stream replays to the right state
const lifecycle = [mk(1, 'initiated'), mk(2, 'calculated'), mk(3, 'verified'), mk(4, 'approved'), mk(5, 'locked'), mk(6, 'posted'), mk(7, 'paid')];
ok(replayRunState(lifecycle.map((e) => e.eventType)) === 'paid', 'run event stream replays through the state machine → paid');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay event — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
