// Integrity-safe sync + conflict + numbering reservation (T-33 / TASK3.6 §21; RULE 1, RULE 6).
//
// Proves the market-gap differentiator — sync that never loses or corrupts field work:
//   • numbering reservation-blocks tile the sequence gaplessly & collision-free; offline assignment
//     is fail-closed on exhaustion; unused numbers are reclaimable (gapless);
//   • conflict policy never drops — apply / skip_duplicate / reject_locked / needs_human;
//   • the sync engine fails closed (retains) and NO entry silently diverges (accountsForAll).
//
// Run: node scripts/test-sync-engine.mjs   (npm run test:sync-engine)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// syncEngine.ts imports './captureQueue' and './conflict' (relative, no ext) — resolve them.
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

let R, C, S, Q;
try {
  R = await import(abs('../src/lib/offline/reservation.ts'));
  C = await import(abs('../src/lib/offline/conflict.ts'));
  S = await import(abs('../src/lib/offline/syncEngine.ts'));
  Q = await import(abs('../src/lib/offline/captureQueue.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the sync modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { reserveBlock, assignFromBlock, unusedNumbers, blocksOverlap, isGaplessCoverage, blockSize } = R;
const { resolveConflict, isRetained } = C;
const { planSync, applyDecisions, accountsForAll } = S;
const { enqueue } = Q;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. RESERVATION BLOCKS — gapless, collision-free, fail-closed ─────────────
let hw = 0;
const r1 = reserveBlock(hw, 5, 'RV', '2025-26', 'dev-A'); // [1..5]
hw = r1.highWater;
const r2 = reserveBlock(hw, 5, 'RV', '2025-26', 'dev-B'); // [6..10]
hw = r2.highWater;
ok(r1.block.start === 1 && r1.block.end === 5 && r2.block.start === 6 && r2.block.end === 10, 'blocks are issued contiguously after the high-water mark');
ok(!blocksOverlap(r1.block, r2.block), 'two devices’ blocks never overlap (no cross-device collision)');
ok(isGaplessCoverage([r2.block, r1.block]), 'the issued blocks tile the sequence with no gap and no overlap');
ok(!isGaplessCoverage([r1.block, reserveBlock(hw + 2, 3, 'RV', '2025-26', 'dev-C').block]), 'a gap in issuance is detected');

// offline assignment, fail-closed on exhaustion
let blk = r1.block;
const seqs = [];
for (let i = 0; i < blockSize(blk); i++) { const a = assignFromBlock(blk); if (a.ok) { seqs.push(a.seq); blk = a.block; } }
ok(JSON.stringify(seqs) === JSON.stringify([1, 2, 3, 4, 5]), 'a device assigns its block’s numbers in order, offline');
ok(!assignFromBlock(blk).ok, 'an exhausted block fails closed — a new block must be requested (never reuse/overflow)');
// unused numbers are reclaimable → gapless
let partial = reserveBlock(10, 5, 'RV', '2025-26', 'dev-D').block; // [11..15]
const a1 = assignFromBlock(partial); partial = a1.block; // used 11 only
ok(JSON.stringify(unusedNumbers(partial)) === JSON.stringify([12, 13, 14, 15]), 'the reserved-but-unused tail is reported for the server to reclaim (keeps the committed sequence gapless)');

// ── 2. CONFLICT POLICY — never drops (TASK3.6 §21) ───────────────────────────
const server = { syncedLocalIds: new Set(['dup-1']), currentVersion: 7 };
ok(resolveConflict({ localId: 'new-1', kind: 'collection' }, server) === 'apply', 'an independent new capture applies (append)');
ok(resolveConflict({ localId: 'dup-1', kind: 'collection' }, server) === 'skip_duplicate', 'an already-applied localId is an idempotent replay, not a second post');
ok(resolveConflict({ localId: 'lk-1', kind: 'receipt', targetPeriodLocked: true }, server) === 'reject_locked', 'a capture into a locked period is rejected (RULE 6), not forced');
ok(resolveConflict({ localId: 'st-1', kind: 'collection', baseVersion: 5 }, server) === 'needs_human', 'a stale-base edit needs human resolution — never clobbered by last-write-wins');
ok(resolveConflict({ localId: 'ok-1', kind: 'collection', baseVersion: 7 }, server) === 'apply', 'an up-to-date-base edit applies');
ok(isRetained('reject_locked') && isRetained('needs_human') && !isRetained('apply') && !isRetained('skip_duplicate'),
  'reject_locked & needs_human are retained locally; apply & skip_duplicate are resolved — no outcome drops data');

// ── 3. SYNC ENGINE — fail closed + no silent divergence (RULE 1) ─────────────
// build a durable queue with 4 captures
let queue = [];
for (const [id, k] of [['new-1', 'collection'], ['dup-1', 'collection'], ['lk-1', 'receipt'], ['st-1', 'collection']]) {
  queue = enqueue(queue, { localId: id, kind: k, capturedAt: '2026-07-12T06:30:00Z', payload: {} }).queue;
}
const entries = [
  { localId: 'new-1', kind: 'collection' },
  { localId: 'dup-1', kind: 'collection' },
  { localId: 'lk-1', kind: 'receipt', targetPeriodLocked: true },
  { localId: 'st-1', kind: 'collection', baseVersion: 5 },
];
const decisions = planSync(entries, server);
const after = applyDecisions(queue, decisions);
ok(after.find((e) => e.localId === 'new-1').status === 'synced', 'an applied capture is marked synced');
ok(after.find((e) => e.localId === 'dup-1').status === 'synced', 'a duplicate is resolved (already committed server-side)');
const lk = after.find((e) => e.localId === 'lk-1');
ok(lk.status === 'failed' && /locked/.test(lk.lastError), 'a locked-period capture is RETAINED locally (failed), not dropped');
const st = after.find((e) => e.localId === 'st-1');
ok(st.status === 'failed' && /human/.test(st.lastError), 'a needs-human conflict is retained for resolution');
ok(accountsForAll(queue, after), 'EVERY entry present before the sync is accounted for after — no silent divergence (RULE 1/§21)');
// a partially-successful sync still drops nothing.
ok(after.length === queue.length, 'the sync never removes an entry from the durable queue (fail closed)');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['reservation.ts', 'reservation'], ['conflict.ts', 'conflict'], ['syncEngine.ts', 'syncEngine']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'offline', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'indexedDB', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `offline/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nIntegrity-safe sync + conflict + reservation: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
