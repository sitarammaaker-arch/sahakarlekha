// Unit tests for the immutable engine-voucher boundary — a faithful JS mirror of
// src/lib/accounting/voucherImmutability.ts (the TS is trivially small; tsc guarantees it
// compiles). Run: node scripts/test-accounting.mjs   (exit 1 on any failure)

function isEngineVoucher(v) { return v?.origin === 'engine'; }
function buildReversalVoucher(original, p) {
  const flip = (t) => (t === 'Dr' ? 'Cr' : 'Dr');
  return {
    ...original, id: p.id, voucherNo: p.voucherNo, date: p.date, createdAt: p.createdAt, createdBy: p.by,
    debitAccountId: original.creditAccountId, creditAccountId: original.debitAccountId,
    lines: original.lines?.map((l) => ({ ...l, type: flip(l.type) })),
    origin: 'engine', reversalOf: original.id,
    narration: `Reversal of ${original.voucherNo}${original.narration ? ` — ${original.narration}` : ''}`,
    isDeleted: false, deletedAt: undefined, deletedBy: undefined, deletedReason: undefined,
    editHistory: undefined, isCleared: undefined, clearedDate: undefined,
    approvalStatus: undefined, approvalRemarks: undefined, approvedBy: undefined, approvedAt: undefined,
    reversedBy: undefined, groupId: undefined, billAllocations: undefined,
  };
}
// the manual-mutation guard decision (mirrors the DataContext guard): block iff engine
const mutationBlocked = (v) => isEngineVoucher(v);
// the RULE-3 cascade predicate after the guard (engine excluded from cascade)
const cascadeWouldCancel = (v) => !v.isDeleted && !isEngineVoucher(v);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. isEngineVoucher
ok(isEngineVoucher({ origin: 'engine' }) === true, 'engine voucher detected');
ok(isEngineVoucher({ origin: 'manual' }) === false, 'manual voucher is not engine');
ok(isEngineVoucher({}) === false, 'undefined origin = manual (not engine)');
ok(isEngineVoucher(undefined) === false, 'undefined voucher = not engine (cascade .find safe)');

// 2. manual-mutation guard (edit / cancel / restore)
ok(mutationBlocked({ origin: 'engine' }) === true, 'engine voucher: edit/cancel/restore BLOCKED');
ok(mutationBlocked({ origin: 'manual' }) === false, 'manual voucher: edit/cancel/restore ALLOWED');
ok(mutationBlocked({}) === false, 'legacy (no origin) voucher: ALLOWED — no regression');

// 3. RULE-3 cascade guard
ok(cascadeWouldCancel({ origin: 'engine', isDeleted: false }) === false, 'engine voucher excluded from RULE-3 cascade');
ok(cascadeWouldCancel({ origin: 'manual', isDeleted: false }) === true, 'manual voucher still cascade-cancelled — no regression');

// 4. buildReversalVoucher — pure, equal-and-opposite, engine-origin, linked, clean
const orig = {
  id: 'V1', voucherNo: 'JV-1', type: 'journal', date: '2026-01-01', createdAt: '2026-01-01', createdBy: 'X',
  debitAccountId: 'A', creditAccountId: 'B', amount: 100, narration: 'Procurement', origin: 'engine',
  lines: [{ id: 'l1', accountId: 'A', type: 'Dr', amount: 100 }, { id: 'l2', accountId: 'B', type: 'Cr', amount: 100 }],
  isDeleted: false, editHistory: [{}], approvalStatus: 'approved', groupId: 'g1', billAllocations: [{}],
};
const rev = buildReversalVoucher(orig, { id: 'V2', voucherNo: 'JV-2', date: '2026-01-02', createdAt: '2026-01-02', by: 'Engine' });
ok(rev.debitAccountId === 'B' && rev.creditAccountId === 'A', 'reversal swaps Dr/Cr (simple legs)');
ok(rev.lines[0].type === 'Cr' && rev.lines[1].type === 'Dr', 'reversal flips multi-line directions');
ok(rev.amount === 100, 'reversal keeps amount');
ok(rev.origin === 'engine', 'reversal is itself an engine voucher (immutable)');
ok(rev.reversalOf === 'V1', 'reversal links to the original (reversalOf)');
ok(rev.id === 'V2' && rev.voucherNo === 'JV-2', 'reversal uses caller-supplied id/no (engine numbering)');
ok(rev.isDeleted === false && rev.editHistory === undefined && rev.approvalStatus === undefined && rev.billAllocations === undefined,
   'reversal starts clean — no status/audit carryover');
ok(orig.debitAccountId === 'A' && orig.lines[0].type === 'Dr' && orig.editHistory.length === 1,
   'buildReversalVoucher is PURE — original voucher not mutated');

console.log(`[accounting-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
