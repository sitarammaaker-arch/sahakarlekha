// Durable persistence for the offline capture queue (T-32 wiring — captureStore.ts).
//
// Proves the durable local-store half:
//   • a queue round-trips through localStorage exactly (survives app restart);
//   • a missing store loads as empty (not corrupt);
//   • a corrupt store SURFACES (corrupt: true), never silently coerced to empty (RULE 1);
//   • it composes with the pure captureQueue mutations (enqueue/markSynced/markFailed).
//
// Run: node scripts/test-capture-store.mjs   (npm run test:capture-store)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// captureStore.ts imports './captureQueue' (relative, no ext) — resolve it.
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
      for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
        const u = new URL(cand, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  }
`));

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let S, Q;
try {
  S = await import(abs('../src/lib/offline/captureStore.ts'));
  Q = await import(abs('../src/lib/offline/captureQueue.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the captureStore modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { loadCaptureQueue, saveCaptureQueue, CAPTURE_QUEUE_KEY } = S;
const { enqueue, markSynced, markFailed } = Q;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A minimal in-memory Storage mock (the app injects real localStorage).
const mkStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _raw: m,
  };
};

const cap = (localId, kind = 'collection') => ({ localId, kind, capturedAt: '2026-07-12T06:30:00Z', payload: { qty: 5 } });

// ── 1. ROUND-TRIP — survives restart ─────────────────────────────────────────
const store = mkStore();
let queue = [];
queue = enqueue(queue, cap('c1')).queue;
queue = enqueue(queue, cap('r1', 'receipt')).queue;
queue = markFailed(queue, 'c1', 'offline');
saveCaptureQueue(queue, store);
ok(store.getItem(CAPTURE_QUEUE_KEY) != null, 'saving writes to the durable store under the capture-queue key');
const loaded = loadCaptureQueue(store);
ok(!loaded.corrupt && JSON.stringify(loaded.queue) === JSON.stringify(queue),
  'the queue round-trips through localStorage exactly (survives app restart)');
ok(loaded.queue.find((e) => e.localId === 'c1').status === 'failed', 'per-entry status (failed) is preserved across persistence');

// simulate a "restart": a fresh store handle over the same underlying map, mutate, re-persist.
queue = markSynced(loaded.queue, 'c1');
saveCaptureQueue(queue, store);
ok(loadCaptureQueue(store).queue.find((e) => e.localId === 'c1').status === 'synced', 'a later save overwrites the durable store with the new state');

// ── 2. MISSING store — empty, not corrupt ────────────────────────────────────
const empty = loadCaptureQueue(mkStore());
ok(empty.queue.length === 0 && empty.corrupt === false, 'a store with no queue loads as empty (not corrupt)');

// ── 3. CORRUPTION SURFACES — never silently drops (RULE 1) ────────────────────
const bad = mkStore();
bad.setItem(CAPTURE_QUEUE_KEY, '{not valid json');
const badLoad = loadCaptureQueue(bad);
ok(badLoad.corrupt === true && badLoad.queue.length === 0, 'an unparseable store loads empty WITH corrupt=true (surfaced, not silently coerced)');
const badShape = mkStore();
badShape.setItem(CAPTURE_QUEUE_KEY, JSON.stringify([{ localId: 'x', kind: 'BAD', status: 'pending', capturedAt: '2026', attempts: 0 }]));
ok(loadCaptureQueue(badShape).corrupt === true, 'a malformed entry surfaces corruption rather than loading a bad queue');

// ── 4. STORAGE FAILURE is swallowed (in-memory stays authoritative) ──────────
const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('quota'); } };
let threw = false;
try { saveCaptureQueue(queue, throwing); const r = loadCaptureQueue(throwing); ok(r.queue.length === 0 && !r.corrupt, 'an inaccessible store (private mode) loads empty without flagging corruption'); }
catch { threw = true; }
ok(!threw, 'a storage exception on save/load never throws — the in-memory queue is never lost');

// ── 5. captureStore adds no logic of its own beyond persistence (thin adapter) ─
const code = readFileSync(pathResolve(SRC, 'lib', 'offline', 'captureStore.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(code.includes('serializeQueue') && code.includes('deserializeQueue'), 'it reuses the pure captureQueue serialize/deserialize (no duplicate logic)');
ok(!/JSON\.parse|JSON\.stringify/.test(code), 'it does not re-implement (de)serialization — that lives in the pure core');

console.log(`\nOffline capture-queue persistence: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
