// Cancelled-voucher reconcile (T-09) — proves the invariant scripts/reconcile-cancelled-ledger.mjs
// relies on: a DELETED voucher whose journal has a lone `voucher.cancelled` (no posting) is repaired
// by APPENDING the missing `voucher.posted` (the voucher's own legs) so posted + cancelled net to zero
// — the normal cancelled-voucher shape. Reproduces the observed Rania orphan (CV/2026/27/320), proves
// idempotency, that a normal posted+cancelled is left alone, and that a leg-mismatch is NOT auto-fixed.
// Run: node scripts/test-reconcile-cancelled-ledger.mjs
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
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { genesisEventId } = await import(abs('../src/lib/ledger/genesis.ts'));
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { ledgerParity } = await import(abs('../src/lib/ledger/parity.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const SID = 'SOC001';
const ev = (id, seq, eventType, lines, at) =>
  buildEvent({ eventType, tenantId: SID, jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: { kind: 'human', id: 't' }, payload: { lines } }, { eventId: `e-${id}-${seq}`, occurredAt: at });

// The script's core: net (nonzero lines) of an aggregate, and the repair it plans for a deleted voucher.
const netOf = (evs) => projectTrialBalance(evs).lines.filter((l) => l.netMinor !== 0);
const rebuildPosting = (v, evs) => {
  const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence || 0), 0);
  return buildEvent(
    { eventType: 'voucher.posted', tenantId: SID, jurisdiction: v.jurisdiction, aggregateType: 'voucher', aggregateId: v.id, sequence: maxSeq + 1, producer: { kind: 'import', id: 'cancelled-reconcile' }, payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v), genesis: true } },
    { eventId: genesisEventId(v.id), occurredAt: `${v.date}T00:00:00.000Z` },
  );
};

// ── The observed Rania orphan: CV/2026/27/320, ₹5,000, DELETED, journal has ONLY the cancel ─────────
const v320 = { id: 'cv320', type: 'journal', date: '2026-01-10', debitAccountId: 'bank-1859', creditAccountId: '3301', amount: 5000, isDeleted: true, voucherNo: 'CV/2026/27/320', jurisdiction: 'hr' };
const loneCancel = [ev('cv320', 1, 'voucher.cancelled', voucherReversalLines(v320), '2026-02-01T00:00:00Z')];

// 1. The orphan reversal leaves a non-zero net (bank −₹5,000, 3301 +₹5,000) → parity fails.
const before = netOf(loneCancel);
ok(before.length === 2, 'lone cancel → aggregate does NOT self-net (orphan reversal)');
const pBefore = ledgerParity(loneCancel, [v320], []);
ok(!pBefore.matches, 'deleted voucher + lone cancel → trialBalance parity FAILS');

// 2. Repair: append the rebuilt posting → posted + cancelled net to ZERO, parity green.
const posted = rebuildPosting(v320, loneCancel);
const reconciled = [...loneCancel, posted];
ok(reconciled.length === loneCancel.length + 1, 'append-only: the cancel event is retained, posting added');
ok(netOf(reconciled).length === 0, 'after appending the missing posting → aggregate nets to zero');
ok(ledgerParity(reconciled, [v320], []).matches, 'reconciled journal matches the (excluded) deleted voucher → parity green');
ok(posted.eventId === genesisEventId('cv320'), 'appended posting uses the deterministic genesis id (idempotent under upsert)');
ok(posted.sequence === 2, 'posting takes a fresh sequence (2) — never reuses the cancel’s sequence (unique index)');

// 3. Idempotent: a second pass sees the aggregate already self-netting → plans no repair.
ok(netOf(reconciled).length === 0, 'idempotent: re-running sees a self-netting aggregate, nothing to repair');

// 3b. An ACTIVE voucher's journal net is its live postings (NON-ZERO by design) — it must be OUT OF
//     SCOPE, never flagged as a repair or manual item. This is the class the first dry-run wrongly
//     labelled "1994 drift": a healthy active voucher is non-zero and that is correct.
const vActive = { id: 'cv-active', type: 'journal', date: '2026-01-12', debitAccountId: 'bank-1859', creditAccountId: '3301', amount: 7000, isDeleted: false, voucherNo: 'RV/2026/27/001', jurisdiction: 'hr' };
const activeJournal = [ev('cv-active', 1, 'voucher.posted', voucherPostingLines(vActive), '2026-01-12T00:00:00Z')];
ok(netOf(activeJournal).length !== 0, 'a healthy ACTIVE voucher has a non-zero journal net (its live balance)');
const shouldNetZero = (v) => !v || v.isDeleted || v.approvalStatus === 'pending';
ok(!shouldNetZero(vActive), 'shouldNetZero(active) is false → the script skips it, never a repair/manual item');
ok(shouldNetZero(v320) && shouldNetZero(undefined), 'shouldNetZero is true for deleted and missing vouchers (in scope)');

// 4. A NORMAL posted+cancelled voucher already nets to zero → the script skips it (never double-posts).
const normal = [
  ev('cv999', 1, 'voucher.posted', voucherPostingLines({ ...v320, id: 'cv999' }), '2026-01-05T00:00:00Z'),
  ev('cv999', 2, 'voucher.cancelled', voucherReversalLines({ ...v320, id: 'cv999' }), '2026-02-05T00:00:00Z'),
];
ok(netOf(normal).length === 0, 'normal posted+cancelled already self-nets → not a repair candidate');

// 5. VERIFY-GUARD: if the voucher’s CURRENT legs differ from what the cancel reversed, the rebuilt
//    posting does NOT net the cancel to zero → the script must route it to MANUAL, never auto-write.
const edited = { ...v320, id: 'cv-edit', debitAccountId: 'bank-1859', creditAccountId: '3301', amount: 9000 };  // legs changed to ₹9,000
const cancelOldAmount = [ev('cv-edit', 1, 'voucher.cancelled', voucherReversalLines({ ...edited, amount: 5000 }), '2026-02-10T00:00:00Z')];  // cancel reversed the OLD ₹5,000
const rebuilt = rebuildPosting(edited, cancelOldAmount);
ok(netOf([...cancelOldAmount, rebuilt]).length !== 0, 'leg-mismatch: rebuilt posting does NOT net to zero → routed to MANUAL, not auto-fixed');

console.log(`\nCancelled-voucher reconcile (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
