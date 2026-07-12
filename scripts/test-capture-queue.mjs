// Offline field capture — durable local queue (T-32 / TASK3.6; RULE 1 offline).
//
// Proves the field secretary loses nothing offline:
//   • capture is fail-closed and idempotent — out-of-scope kinds refused, a re-capture never dups;
//   • an entry is NEVER dropped — a failed sync stays queued for retry (RULE 1 offline);
//   • the queue survives app restart — serialize/deserialize round-trips 1:1;
//   • a corrupt store SURFACES an error instead of silently losing field work.
//
// Run: node scripts/test-capture-queue.mjs   (npm run test:capture-queue)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/offline/captureQueue.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the captureQueue module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { enqueue, pendingEntries, markSynced, markFailed, serializeQueue, deserializeQueue } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const cap = (localId, kind = 'collection') => ({ localId, kind, capturedAt: '2026-07-12T06:30:00Z', payload: { qty: 10 } });

// ── 1. FAIL-CLOSED CAPTURE + scope (TASK3.6) ─────────────────────────────────
let q = [];
const e1 = enqueue(q, cap('c1'));
ok(e1.ok && e1.queue.length === 1 && e1.queue[0].status === 'pending' && e1.queue[0].attempts === 0, 'a valid collection capture is queued as pending');
q = e1.queue;
ok(!enqueue(q, cap('c2', 'voucher')).ok, 'an out-of-scope kind (voucher) is refused — offline scope is collection/receipt only');
ok(!enqueue(q, { localId: '', kind: 'receipt', capturedAt: '2026-07-12T06:30:00Z', payload: {} }).ok, 'a capture with no localId is refused');
ok(!enqueue(q, { localId: 'x', kind: 'receipt', capturedAt: 'nope', payload: {} }).ok, 'a capture with an invalid timestamp is refused');

// ── 2. IDEMPOTENT — a re-capture of the same localId never duplicates ─────────
q = enqueue(q, cap('r1', 'receipt')).queue;
const dup = enqueue(q, cap('c1'));  // c1 already present
ok(dup.ok && dup.queue.length === 2, 'a re-capture of an existing localId is a no-op, not a duplicate (idempotent)');

// ── 3. NEVER DROPPED — a failed sync stays queued for retry (RULE 1 offline) ──
ok(pendingEntries(q).length === 2, 'both entries are pending sync');
q = markFailed(q, 'c1', 'network down');
const c1 = q.find((e) => e.localId === 'c1');
ok(c1.status === 'failed' && c1.attempts === 1 && c1.lastError === 'network down', 'a failed sync increments attempts and records the error');
ok(pendingEntries(q).some((e) => e.localId === 'c1'), 'a FAILED entry is still awaiting sync — never dropped');
q = markFailed(q, 'c1', 'still down');
ok(q.find((e) => e.localId === 'c1').attempts === 2, 'a second failure increments again — the entry persists across retries');
q = markSynced(q, 'c1');
const synced = q.find((e) => e.localId === 'c1');
ok(synced.status === 'synced' && synced.lastError === undefined, 'a successful sync marks the entry synced and clears the error');
ok(pendingEntries(q).length === 1 && pendingEntries(q)[0].localId === 'r1', 'only not-yet-synced entries remain pending');

// ── 4. SURVIVES RESTART — serialize/deserialize round-trips 1:1 ──────────────
const blob = serializeQueue(q);
const restored = deserializeQueue(blob);
ok(restored.ok && JSON.stringify(restored.queue) === JSON.stringify(q), 'the queue round-trips exactly through the durable store (survives app restart)');
ok(deserializeQueue(serializeQueue([])).ok && deserializeQueue(serializeQueue([])).queue.length === 0, 'an empty queue round-trips to empty');

// ── 5. CORRUPTION SURFACES — never silently lose field work (RULE 1) ─────────
ok(!deserializeQueue('{not json').ok, 'an unparseable store is refused, not coerced to empty');
ok(!deserializeQueue('{"a":1}').ok, 'a non-array store is refused');
ok(!deserializeQueue(JSON.stringify([{ localId: 'x', kind: 'BAD', status: 'pending', capturedAt: '2026-07-12', attempts: 0 }])).ok,
  'a malformed entry fails the whole load — a corrupt queue surfaces instead of dropping entries');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'offline', 'captureQueue.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'indexedDB', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `captureQueue is pure & does no I/O (no "${forbidden}")`);
}

console.log(`\nOffline capture queue: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
