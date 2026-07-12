// Event ledger core — envelope + append/replay (T-06 / ADR-0001, INV-1; CL-2/CL-4).
//
// Proves the properties the whole event-sourced design rests on:
//   • an event is a validated, deterministic envelope (a bad event of record is refused);
//   • a REVERSING event nets out its original EXACTLY, and BOTH stay in the log — a correction
//     is never a mutation or a delete (CL-2, the RULE-1 fix);
//   • replay is deterministic and order-independent → state is a rebuildable projection (CL-4);
//   • balances are exact integer paise (composes T-02) — no float decides whether books balance.
//
// Run: node scripts/test-ledger-event.mjs   (npm run test:ledger-event)

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
      export async function resolve(spec, ctx, next) {
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
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ev, rp;
try {
  ev = await import(abs('../src/lib/ledger/event.ts'));
  rp = await import(abs('../src/lib/ledger/replay.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ledger modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildEvent, reverseEvent, isReversal } = ev;
const { replay, replayBalances } = rp;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const HUMAN = { kind: 'human', id: 'u1' };
const ctx = (id, at) => ({ eventId: id, occurredAt: at });
const post = (id, seq, accountId, drCr, amountMinor) => buildEvent(
  { eventType: 'voucher.posted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'V1', sequence: seq, producer: HUMAN, payload: { accountId, drCr, amountMinor } },
  ctx(id, '2026-07-12T00:00:00Z'),
);

// ── 1. ENVELOPE — validated + deterministic ──────────────────────────────────
const e1 = post('e1', 1, '1001', 'Dr', 10000);
ok(e1.eventId === 'e1' && e1.eventType === 'voucher.posted' && e1.sequence === 1, 'buildEvent shapes the envelope');
ok(e1.producer.kind === 'human' && e1.schemaVersion === 1, 'producer + default schemaVersion recorded');
ok(JSON.stringify(post('e1', 1, '1001', 'Dr', 10000)) === JSON.stringify(e1), 'the event is deterministic given (input, ctx)');

for (const [bad, why] of [
  [() => buildEvent({ eventType: '', tenantId: 'S', aggregateType: 'v', aggregateId: 'V', sequence: 1, producer: HUMAN, payload: {} }, ctx('x', 't')), 'empty eventType'],
  [() => buildEvent({ eventType: 'x', tenantId: '', aggregateType: 'v', aggregateId: 'V', sequence: 1, producer: HUMAN, payload: {} }, ctx('x', 't')), 'empty tenantId'],
  [() => buildEvent({ eventType: 'x', tenantId: 'S', aggregateType: 'v', aggregateId: 'V', sequence: 0, producer: HUMAN, payload: {} }, ctx('x', 't')), 'sequence < 1'],
  [() => buildEvent({ eventType: 'x', tenantId: 'S', aggregateType: 'v', aggregateId: 'V', sequence: 1, producer: { kind: 'robot' }, payload: {} }, ctx('x', 't')), 'bad producer kind'],
]) {
  let threw = false; try { bad(); } catch { threw = true; }
  ok(threw, `a malformed envelope is refused (${why})`);
}

// AI attribution: an agent event records the human it acted for (AI-A2).
const agentEvt = buildEvent({ eventType: 'voucher.posted', tenantId: 'S', aggregateType: 'voucher', aggregateId: 'V', sequence: 1, producer: { kind: 'agent', id: 'assistant', onBehalfOf: 'u1' }, payload: {} }, ctx('a', 't'));
ok(agentEvt.producer.kind === 'agent' && agentEvt.producer.onBehalfOf === 'u1', 'an AI-agent event is attributed to the agent AND the human it acted for');

// ── 2. REVERSAL nets out — the original is NEVER deleted (CL-2) ───────────────
const rev = reverseEvent(e1, ctx('e2', '2026-07-12T01:00:00Z'), { sequence: 2, producer: HUMAN, payload: { accountId: '1001', drCr: 'Cr', amountMinor: 10000 }, reason: 'entry error' });
ok(isReversal(rev) && rev.reversalOf === 'e1', 'the reversal references the original event id');
ok(rev.eventType === 'voucher.reversed' && rev.sequence === 2, 'the reversal is a NEW event with a later sequence (appended, not a delete)');
ok(rev.payload.reason === 'entry error', 'the reversal records WHY (CL-7)');
ok(!isReversal(e1), 'the original is not a reversal');

const afterReversal = replayBalances([e1, rev]);
ok(afterReversal['1001'] === 0, 'a reversal nets the original to zero on replay — WITHOUT deleting it');
const log = [e1, rev];
ok(log.length === 2 && log.includes(e1), 'both events remain in the log (append-only, CL-2)');

// ── 3. REPLAY — deterministic projection, exact paise (CL-4, T-02) ───────────
const A = post('a1', 1, '1001', 'Dr', 33333);   // ₹333.33
const B = post('b1', 2, '1001', 'Dr', 33333);
const C = post('c1', 3, '4101', 'Cr', 66666);   // ₹666.66
const bal = replayBalances([C, A, B]);           // out of order on purpose
ok(bal['1001'] === 66666 && bal['4101'] === -66666, 'replay sorts by sequence and reproduces exact balances regardless of input order');
ok(replayBalances([A]).c1 === undefined && Object.keys(replayBalances([A, B, C])).length === 2, 'balances are keyed by account');

// The generic fold: state is whatever the reducer builds — a projection over the log.
const count = replay([A, B, C], (n) => n + 1, 0);
ok(count === 3, 'the generic replay folds the log into any projection');

ok(replayBalances([]) && Object.keys(replayBalances([])).length === 0, 'an empty log projects to empty state');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
for (const f of ['event.ts', 'replay.ts']) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'ledger', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', 'crypto.randomUUID']) {
    ok(!code.includes(forbidden), `ledger/${f} is pure & deterministic (no "${forbidden}")`);
  }
}

console.log(`\nEvent ledger core: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
