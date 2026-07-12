// Event stream + signed webhooks (T-25 / API Constitution EVT-1..7; AUTH-5).
//
// Proves the outbound-integration contract:
//   • one outbound event per committed ledger fact, wire shape ≠ storage, reversal carried (EVT-1/2/5);
//   • at-least-once + consumer idempotency by eventId (EVT-3);
//   • per-aggregate ordering, not global (EVT-3);
//   • replay from a durable cursor (EVT-4);
//   • no event carries data the consumer isn't entitled to — capability + tenant + jurisdiction (EVT-6);
//   • webhooks are signed & tamper-evident with the secret NEVER in this layer (EVT-6/AUTH-5).
//
// Run: node scripts/test-event-stream.mjs   (npm run test:event-stream)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let O, W;
try {
  O = await import(abs('../src/lib/api/outbox.ts'));
  W = await import(abs('../src/lib/api/webhookSignature.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the event-stream modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { projectOutboundEvent, dedupeByEventId, aggregateKey, eventsAfter, advanceCursor, isInAggregateOrder, isDeliverable } = O;
const { canonicalize, signEvent, verifyEvent } = W;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A committed ledger event (T-06 shape).
const ledgerEvent = {
  eventId: 'E1', eventType: 'voucher.posted', schemaVersion: 1, tenantId: 'SOC-1', jurisdiction: 'Haryana',
  aggregateType: 'voucher', aggregateId: 'V1', sequence: 1, occurredAt: '2026-07-12T00:00:00Z',
  producer: { kind: 'human', id: 'u1' }, payload: { total: 5000 },
};

// ── 1. PROJECTION — committed fact → outbound contract envelope (EVT-1/2/5) ───
const out = projectOutboundEvent(ledgerEvent);
ok(out.eventId === 'E1' && out.aggregate.type === 'voucher' && out.aggregate.id === 'V1' && out.schemaVersion === 1,
  'the outbound envelope carries a versioned, domain-shaped contract (not the storage shape)');
ok(out.producer.kind === 'human' && out.producer.id === 'u1' && out.producer.onBehalfOf === null,
  'the producer (attribution) is projected');
ok(!('reversalOf' in out), 'a non-reversing event has no reversalOf');
const rev = projectOutboundEvent({ ...ledgerEvent, eventId: 'E2', eventType: 'voucher.reversed', sequence: 2, reversalOf: 'E1' });
ok(rev.reversalOf === 'E1', 'a correction is a new event that references the original (EVT-5 / CL-2)');

// ── 2. CONSUMER IDEMPOTENCY — dedup by eventId (EVT-3) ───────────────────────
const stream = [out, rev, out]; // at-least-once may redeliver E1
const deduped = dedupeByEventId(stream, new Set());
ok(deduped.length === 2 && deduped[0].eventId === 'E1' && deduped[1].eventId === 'E2',
  'duplicate deliveries of the same eventId are collapsed, order preserved');
ok(dedupeByEventId(stream, new Set(['E1'])).every((e) => e.eventId !== 'E1'),
  'an event already seen by the consumer is dropped (at-least-once + idempotent)');

// ── 3. PER-AGGREGATE ORDERING, replay from cursor (EVT-3/EVT-4) ───────────────
const v1a = out;                                   // voucher V1 seq 1
const v1b = { ...out, eventId: 'E2', sequence: 2 };  // voucher V1 seq 2
const m1  = { ...out, eventId: 'E3', aggregate: { type: 'member', id: 'M1' }, sequence: 1, eventType: 'member.admitted' };
ok(isInAggregateOrder([v1a, m1, v1b]), 'interleaved aggregates are fine as long as each aggregate is in order (no global order, EVT-3)');
ok(!isInAggregateOrder([v1b, v1a]), 'a lower sequence after a higher one FOR THE SAME aggregate breaks ordering');
ok(aggregateKey(v1a) !== aggregateKey(m1), 'ordering scope is per (tenant, aggregate)');

const all = [v1a, v1b, m1];
const fresh = eventsAfter(all, {});
ok(fresh.length === 3, 'replaying from an empty cursor yields the whole stream (EVT-4)');
const cursor = advanceCursor({}, [v1a, m1]);          // delivered V1#1 and M1#1
const remaining = eventsAfter(all, cursor);
ok(remaining.length === 1 && remaining[0].eventId === 'E2',
  'after a cursor advance, only not-yet-delivered per-aggregate events remain — resume delivers each fact once');
ok(advanceCursor(cursor, [v1b])[aggregateKey(v1b)] === 2, 'the cursor holds the max delivered sequence per aggregate');

// ── 4. ENTITLEMENT-GATED DELIVERY (EVT-6) ────────────────────────────────────
const capFor = (t) => (t === 'voucher.posted' || t === 'voucher.reversed' ? 'gst' : null);
const subFull = { tenantId: 'SOC-1', jurisdiction: 'Haryana', scopes: ['gst'] };
ok(isDeliverable(out, subFull, capFor), 'a consumer holding the required capability receives the event');
ok(!isDeliverable(out, { ...subFull, scopes: ['lending'] }, capFor),
  'a consumer WITHOUT the data-class capability does not receive the event (EVT-6)');
ok(!isDeliverable(out, { ...subFull, tenantId: 'SOC-2' }, capFor), 'no cross-tenant delivery');
ok(!isDeliverable(out, { ...subFull, jurisdiction: 'Punjab' }, capFor), 'no cross-jurisdiction delivery (API-P6)');
ok(isDeliverable(m1, { ...subFull, scopes: [] }, capFor), 'an event with no capability gate is delivered within tenant/jurisdiction');

// ── 5. SIGNING — canonical, tamper-evident, secret injected (EVT-6/AUTH-5) ────
// key-sorted canonicalization is order-independent.
ok(canonicalize({ b: 1, a: 2 }) === canonicalize({ a: 2, b: 1 }), 'canonicalization is key-order independent');
ok(canonicalize({ a: undefined, b: 1 }) === '{"b":1}', 'undefined properties are dropped, like JSON');
// A trivial deterministic HMAC stand-in (the real primitive is injected by the wire layer).
const fakeHmac = (msg, keyId) => keyId + ':' + msg.length + ':' + [...msg].reduce((a, c) => (a + c.charCodeAt(0)) % 100000, 0);
const env = signEvent(out, 'key-1', '2026-07-12T00:00:00Z', fakeHmac);
ok(env.keyId === 'key-1' && env.algorithm === 'HMAC-SHA256' && env.signedAt === '2026-07-12T00:00:00Z' && env.signature.length > 0,
  'signing yields a verifiable envelope (algorithm, keyId, signedAt, signature)');
ok(verifyEvent(out, env, fakeHmac), 'a untampered event verifies against its signature');
ok(!verifyEvent({ ...out, payload: { total: 9999 } }, env, fakeHmac), 'a tampered payload fails verification (tamper-evident)');
ok(!verifyEvent(out, { ...env, signedAt: '2026-07-12T09:00:00Z' }, fakeHmac), 'a changed signedAt fails — the timestamp is bound into the signature');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['outbox.ts', 'outbox'], ['webhookSignature.ts', 'webhookSignature']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'api', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', 'crypto']) {
    ok(!code.includes(forbidden), `api/${sub} is pure & holds no secret/clock/crypto (no "${forbidden}")`);
  }
}

console.log(`\nEvent stream + signed webhooks: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
