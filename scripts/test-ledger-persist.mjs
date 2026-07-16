// Authoritative event append (journal-first-write slice 3) — imports the REAL
// persistEventAuthoritative and drives every path with a fake insert/verify IO. This is the
// primitive that makes "a durable, verified journal append IS the save". Run: node scripts/test-ledger-persist.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
        return next(spec, ctx);
      }
    `),
);

const { persistEventAuthoritative, persistEventsAuthoritative } = await import(abs('../src/lib/ledger/persist.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const EV = { eventId: 'e1', eventType: 'voucher.posted', aggregateId: 'v1' };

// Records which IO steps ran, so we can assert ordering/short-circuit.
const io = (opts = {}) => {
  const calls = [];
  return {
    calls,
    insert: async () => { calls.push('insert'); if (opts.insertThrow) throw new Error('boom-insert'); return { error: opts.insertError ?? null }; },
    verify: async (eventId) => { calls.push('verify:' + eventId); if (opts.verifyThrow) throw new Error('boom-verify'); const found = opts.missing ? !opts.missing.includes(eventId) : (opts.found ?? true); return { found, error: opts.verifyError ?? null }; },
    insertMany: async () => { calls.push('insertMany'); if (opts.insertManyThrow) throw new Error('boom-insertMany'); return { error: opts.insertManyError ?? null }; },
  };
};

// 1. Happy path — insert ok + verify found ⇒ ok, both steps ran in order.
{ const x = io(); const r = await persistEventAuthoritative(EV, x);
  ok(r.ok === true && r.error === undefined, 'insert ok + verify found ⇒ ok:true');
  ok(x.calls.join(',') === 'insert,verify:e1', 'runs insert THEN verify'); }

// 2. Insert error ⇒ fail, verify never runs (the append never happened).
{ const x = io({ insertError: 'duplicate key' }); const r = await persistEventAuthoritative(EV, x);
  ok(r.ok === false && r.error === 'duplicate key', 'insert error ⇒ ok:false with the message');
  ok(x.calls.join(',') === 'insert', 'verify is NOT attempted after an insert error'); }

// 3. Insert succeeds but the row is NOT found on verify ⇒ fail (the RLS/cache edge the verify guards).
{ const x = io({ found: false }); const r = await persistEventAuthoritative(EV, x);
  ok(r.ok === false && /did not persist/.test(r.error), 'insert ok but row missing on verify ⇒ ok:false'); }

// 4. Verify error ⇒ fail (can't confirm durability).
{ const r = await persistEventAuthoritative(EV, io({ verifyError: 'network' }));
  ok(r.ok === false && r.error === 'network', 'verify error ⇒ ok:false'); }

// 5. Insert throws (rejection) ⇒ caught, ok:false, never throws to the caller.
{ let threw = false; let r; try { r = await persistEventAuthoritative(EV, io({ insertThrow: true })); } catch { threw = true; }
  ok(!threw && r.ok === false && /boom-insert/.test(r.error), 'insert rejection is caught ⇒ ok:false (never throws)'); }

// 6. Verify throws ⇒ caught, ok:false.
{ const r = await persistEventAuthoritative(EV, io({ verifyThrow: true }));
  ok(r.ok === false && /boom-verify/.test(r.error), 'verify rejection is caught ⇒ ok:false'); }

// ── persistEventsAuthoritative (batch — slice 5: the edit reverse+repost PAIR) ────────────────────
const EV2 = [{ eventId: 'e1' }, { eventId: 'e2' }];

// 7. Zero events ⇒ ok:true, no IO (a postings-neutral edit appends nothing).
{ const x = io(); const r = await persistEventsAuthoritative([], x);
  ok(r.ok === true && x.calls.length === 0, 'empty batch ⇒ ok:true with no IO'); }

// 8. Single event ⇒ delegates to the single primitive (insert+verify, NOT insertMany).
{ const x = io(); const r = await persistEventsAuthoritative([EV], x);
  ok(r.ok === true, 'single-event batch ⇒ ok:true');
  ok(x.calls.join(',') === 'insert,verify:e1', 'single-event batch uses insert+verify, not insertMany'); }

// 9. Pair — insertMany ok + both verify found ⇒ ok, batch inserted THEN each row verified.
{ const x = io(); const r = await persistEventsAuthoritative(EV2, x);
  ok(r.ok === true && r.error === undefined, 'pair: insertMany ok + all rows found ⇒ ok:true');
  ok(x.calls.join(',') === 'insertMany,verify:e1,verify:e2', 'pair runs insertMany THEN verifies every eventId'); }

// 10. Pair — insertMany error ⇒ fail, nothing verified (atomic insert wrote nothing).
{ const x = io({ insertManyError: 'batch conflict' }); const r = await persistEventsAuthoritative(EV2, x);
  ok(r.ok === false && r.error === 'batch conflict', 'pair: insertMany error ⇒ ok:false with the message');
  ok(x.calls.join(',') === 'insertMany', 'no verify after an insertMany error'); }

// 11. Pair — one row missing on verify ⇒ fail (the half-written-pair parity break the verify guards).
{ const x = io({ missing: ['e2'] }); const r = await persistEventsAuthoritative(EV2, x);
  ok(r.ok === false && /e2 not found/.test(r.error), 'pair: a single missing row ⇒ ok:false (never a half-written pair)'); }

// 12. Pair — insertMany throws ⇒ caught, ok:false, never throws to the caller.
{ let threw = false, r; try { r = await persistEventsAuthoritative(EV2, io({ insertManyThrow: true })); } catch { threw = true; }
  ok(!threw && r.ok === false && /boom-insertMany/.test(r.error), 'pair: insertMany rejection is caught ⇒ ok:false'); }

// 13. Pair — no insertMany IO provided ⇒ fail (a multi-event append REQUIRES atomic batch insert).
{ const single = io(); delete single.insertMany; const r = await persistEventsAuthoritative(EV2, single);
  ok(r.ok === false && /requires an insertMany/.test(r.error), 'pair without insertMany IO ⇒ ok:false'); }

console.log(`\nAuthoritative event append (journal-first-write slice 3+5): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
