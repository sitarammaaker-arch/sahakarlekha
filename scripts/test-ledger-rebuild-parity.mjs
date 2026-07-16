// Rebuild parity (journal-first-write slice 7 pre-flight) — imports the REAL rebuildParity and the
// event-build core, and proves it correctly compares the journal's rebuild against the live vouchers
// table over the JOURNAL-OWNED field set: a perfect match, each diff category, deleted-row exclusion,
// and the two structural blockers. This is the pre-flight that gates the write flip (mirrors
// ledgerParity for the read flip). Run: node scripts/test-ledger-rebuild-parity.mjs
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

const { rebuildParity } = await import(abs('../src/lib/ledger/rebuildParity.ts'));
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const CTX = (id, at) => ({ eventId: id, occurredAt: at });
const HUMAN = { kind: 'human', id: 'tester' };
const evt = (v, type, seq, at) => buildEvent({
  eventType: type, tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: v.id,
  sequence: seq, producer: HUMAN,
  payload: { lines: type === 'voucher.reversed' || type === 'voucher.cancelled' ? voucherReversalLines(v) : voucherPostingLines(v), ...voucherEventMeta(v) },
}, CTX(`e-${v.id}-${seq}`, at));

// A representative live table voucher (all journal-owned fields populated).
const v1 = { id: 'v1', voucherNo: 'CV/2026/27/007', type: 'payment', date: '2026-06-01',
  debitAccountId: '5101', creditAccountId: '1001', amount: 2500.50, narration: 'Feed purchase',
  createdAt: '2026-06-01T09:15:00Z', createdBy: 'सुनीता', memberId: 'M-3', branchId: 'BR-2' };
const postedV1 = evt(v1, 'voucher.posted', 1, '2026-06-01T00:00:00Z');

// ── 1. Perfect parity — the journal rebuilds the table exactly ────────────────
{ const r = rebuildParity([postedV1], [v1]);
  ok(r.matches === true && r.diffs.length === 0, 'identical table + journal ⇒ matches, no diffs');
  ok(r.activeCount === 1 && r.rebuiltCount === 1, 'counts: 1 active, 1 rebuilt'); }

// ── 2. Table-only operational fields are OUT of scope (journal never carries them) ──
{ const withOps = { ...v1, refType: 'purchase', refId: 'P-9', editHistory: [{ editedAt: 'x' }] };
  const r = rebuildParity([postedV1], [withOps]);
  ok(r.matches === true, 'refType/refId/editHistory differences do NOT break parity (not journal-owned)'); }

// ── 3. Owned-field mismatch is caught (amount edited in the table only) ────────
{ const drifted = { ...v1, amount: 9999 };
  const r = rebuildParity([postedV1], [drifted]);
  ok(r.matches === false && r.diffs.length === 1 && r.diffs[0].kind === 'field-mismatch', 'amount drift ⇒ field-mismatch');
  ok(r.diffs[0].fields.some((f) => f.field === 'amount'), 'the diff names the amount field'); }

// ── 4. A posting-line change is caught (paise signature) ──────────────────────
{ const reAccounted = { ...v1, creditAccountId: '1002', lines: undefined };
  const r = rebuildParity([postedV1], [reAccounted]);
  ok(r.matches === false && r.diffs[0].fields.some((f) => f.field === 'lines'), 'a changed Cr account ⇒ lines mismatch'); }

// ── 5. missing-in-journal — a live voucher the journal cannot rebuild (pre-T-06) ──
{ const orphan = { ...v1, id: 'v-orphan', voucherNo: 'OLD/1' };
  const r = rebuildParity([postedV1], [v1, orphan]);
  ok(r.matches === false && r.diffs.length === 1 && r.diffs[0].kind === 'missing-in-journal' && r.diffs[0].voucherId === 'v-orphan',
    'a live voucher with no posting event ⇒ missing-in-journal (a hard flip blocker)'); }

// ── 6. extra-in-journal — the journal rebuilds a row with no live table match ──
{ const r = rebuildParity([postedV1], []);
  ok(r.matches === false && r.diffs.length === 1 && r.diffs[0].kind === 'extra-in-journal' && r.diffs[0].voucherId === 'v1',
    'a rebuilt voucher with no live row ⇒ extra-in-journal'); }

// ── 7. Deleted table rows are excluded; a cancelled aggregate nets to absent ───
{ const cancelledEvents = [postedV1, evt(v1, 'voucher.cancelled', 2, '2026-06-03T00:00:00Z')];
  const deletedRow = { ...v1, isDeleted: true };
  const r = rebuildParity(cancelledEvents, [deletedRow]);
  ok(r.matches === true && r.activeCount === 0 && r.rebuiltCount === 0, 'a cancelled voucher (deleted row + netted journal) ⇒ parity, both sides empty'); }

// ── 8. Edited voucher: table + journal both reflect the NEW amount ⇒ parity ────
{ const vNew = { ...v1, amount: 1500 };
  const events = [
    evt(v1, 'voucher.posted', 1, '2026-06-01T00:00:00Z'),
    evt(v1, 'voucher.reversed', 2, '2026-06-04T00:00:00Z'),
    buildEvent({ eventType: 'voucher.reposted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'v1', sequence: 3, producer: HUMAN, payload: { lines: voucherPostingLines(vNew), ...voucherEventMeta(vNew) } }, CTX('e-v1-rp', '2026-06-04T00:00:01Z')),
  ];
  const r = rebuildParity(events, [vNew]);
  ok(r.matches === true, 'a table row matching the latest reposted legs ⇒ parity'); }

// ── 9. memberId/branchId default '' — an unset table field matches an unset rebuild ──
{ const noMember = { ...v1, memberId: undefined, branchId: undefined };
  const evNoMember = evt(noMember, 'voucher.posted', 1, '2026-06-01T00:00:00Z');
  const r = rebuildParity([evNoMember], [noMember]);
  ok(r.matches === true, 'unset memberId/branchId on both sides ⇒ parity (normalized to "")'); }

console.log(`\nRebuild parity (journal-first-write slice 7 pre-flight): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
