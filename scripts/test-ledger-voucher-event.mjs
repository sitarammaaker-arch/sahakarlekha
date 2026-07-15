// Voucher → ledger-event posting legs (T-06) — imports the REAL voucherPostingLines + the ledger
// projection/build core via the '@/' loader, and proves a voucher.posted event carrying those legs
// is REPLAY-FAITHFUL: projectTrialBalance reconstructs the voucher's balances, exactly in paise, and
// a reversal nets it to zero. Run: node scripts/test-ledger-voucher-event.mjs
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

const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { buildEvent, reverseEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const sum = (legs, side) => legs.filter((l) => l.drCr === side).reduce((s, l) => s + l.amountMinor, 0);
const CTX = (id, at) => ({ eventId: id, occurredAt: at });
const HUMAN = { kind: 'human', id: 'tester' };
const post = (id, seq, lines, at = '2025-04-01T00:00:00Z') =>
  buildEvent({ eventType: 'voucher.posted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines } }, CTX(`e-${id}-${seq}`, at));

// 1. Simple debit/credit/amount voucher → two balanced legs, exact paise.
const legs1 = voucherPostingLines({ id: 'v1', type: 'journal', date: '2025-04-01', debitAccountId: '1001', creditAccountId: '4101', amount: 1000 });
ok(legs1.length === 2, 'simple voucher → 2 legs');
ok(sum(legs1, 'Dr') === 100000 && sum(legs1, 'Cr') === 100000, 'legs balanced in paise (₹1000 = 100000)');
ok(legs1.find((l) => l.accountId === '1001').drCr === 'Dr' && legs1.find((l) => l.accountId === '4101').drCr === 'Cr', 'Dr/Cr sides correct');

// 2. Fractional rupees are exact paise (no float drift).
const legsF = voucherPostingLines({ id: 'vf', debitAccountId: '1001', creditAccountId: '4101', amount: 33.33 });
ok(sum(legsF, 'Dr') === 3333 && sum(legsF, 'Cr') === 3333, '₹33.33 → 3333 paise exactly');

// 3. Multi-line voucher (explicit lines) → balanced legs.
const legsM = voucherPostingLines({ id: 'vm', lines: [
  { id: 'a', accountId: '1001', type: 'Dr', amount: 60 },
  { id: 'b', accountId: '1002', type: 'Dr', amount: 40 },
  { id: 'c', accountId: '4101', type: 'Cr', amount: 100 },
] });
ok(legsM.length === 3 && sum(legsM, 'Dr') === 10000 && sum(legsM, 'Cr') === 10000, 'multi-line voucher → balanced legs');

// 4. REPLAY-FAITHFUL — a voucher.posted event carrying these legs reconstructs the trial balance.
const tb = projectTrialBalance([post('v1', 1, legs1)]);
ok(tb.balanced && tb.totalDrMinor === 100000 && tb.totalCrMinor === 100000, 'projectTrialBalance reconstructs a balanced TB from the event');
ok(tb.lines.find((l) => l.accountId === '1001').drMinor === 100000, 'cash (1001) Dr 100000 reconstructed');
ok(tb.lines.find((l) => l.accountId === '4101').crMinor === 100000, 'income (4101) Cr 100000 reconstructed');

// 5. A reversal (flipped legs) nets the original to zero — both events stay in the log (CL-2).
const posted = post('v1', 1, legs1);
const reversed = reverseEvent(posted, CTX('e-v1-2', '2025-04-02T00:00:00Z'), {
  sequence: 2, producer: HUMAN, reason: 'error',
  payload: { lines: legs1.map((l) => ({ ...l, drCr: l.drCr === 'Dr' ? 'Cr' : 'Dr' })) },
});
const tbNet = projectTrialBalance([posted, reversed]);
ok(tbNet.totalDrMinor === tbNet.totalCrMinor && (tbNet.lines.find((l) => l.accountId === '1001')?.netMinor ?? 0) === 0, 'posted + reversed nets each account to zero (correction, not deletion)');

// 6. voucherReversalLines — same accounts/amounts, Dr/Cr flipped (the cancel/reverse payload).
const revLegs = voucherReversalLines({ id: 'v1', debitAccountId: '1001', creditAccountId: '4101', amount: 1000 });
ok(revLegs.find((l) => l.accountId === '1001').drCr === 'Cr' && revLegs.find((l) => l.accountId === '4101').drCr === 'Dr', 'reversal legs flip each side');
ok(sum(revLegs, 'Dr') === 100000 && sum(revLegs, 'Cr') === 100000, 'reversal legs preserve amounts (still balanced)');

// 7. CANCELLATION replay — a voucher.cancelled event with the reversal legs nets the posted voucher
//    to zero in the journal (mirrors isDeleted + deleteEntries removing it from SQL reports).
const postedC = post('v1', 1, legs1);
const cancelled = buildEvent({ eventType: 'voucher.cancelled', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'v1', sequence: 2, producer: HUMAN, payload: { lines: revLegs } }, CTX('e-v1-c', '2025-04-03T00:00:00Z'));
const tbCancel = projectTrialBalance([postedC, cancelled]);
ok((tbCancel.lines.find((l) => l.accountId === '1001')?.netMinor ?? 0) === 0 && (tbCancel.lines.find((l) => l.accountId === '4101')?.netMinor ?? 0) === 0, 'posted + cancelled nets every account to zero (journal matches the soft-delete)');

// 8. EDIT replay — reverse-old + repost-new nets the journal to the NEW voucher only (T-08). Edit
//    ₹1000 → ₹1500: posted(old) + reversed(old flipped) + reposted(new) leaves only the new balance.
const oldLegs = voucherPostingLines({ id: 'v1', debitAccountId: '1001', creditAccountId: '4101', amount: 1000 });
const newLegs = voucherPostingLines({ id: 'v1', debitAccountId: '1001', creditAccountId: '4101', amount: 1500 });
const tbEdit = projectTrialBalance([
  post('v1', 1, oldLegs),
  buildEvent({ eventType: 'voucher.reversed', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'v1', sequence: 2, producer: HUMAN, payload: { lines: voucherReversalLines({ id: 'v1', debitAccountId: '1001', creditAccountId: '4101', amount: 1000 }) } }, CTX('e-v1-r', '2025-04-04T00:00:00Z')),
  buildEvent({ eventType: 'voucher.reposted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'v1', sequence: 3, producer: HUMAN, payload: { lines: newLegs } }, CTX('e-v1-rp', '2025-04-04T00:00:01Z')),
]);
ok((tbEdit.lines.find((l) => l.accountId === '1001')?.netMinor ?? 0) === 150000, 'after edit, 1001 nets to the NEW amount (150000 Dr)');
ok((tbEdit.lines.find((l) => l.accountId === '4101')?.netMinor ?? 0) === -150000, 'after edit, 4101 nets to the NEW amount (150000 Cr)');
ok(tbEdit.balanced, 'edited journal stays balanced');

// 9. voucherEventMeta (T-09 prereq) — the event payload carries narration + createdAt (needed for the
//    ledgers) plus the base metadata, from one shared shape (RULE 2).
const meta = voucherEventMeta({ id: 'v9', voucherNo: 'JV-9', type: 'journal', amount: 250, date: '2025-07-01', narration: 'Rent paid', createdAt: '2025-07-01T10:30:00Z', memberId: 'M-42', branchId: 'BR-1', createdBy: 'सुनीता' });
ok(meta.narration === 'Rent paid' && meta.createdAt === '2025-07-01T10:30:00Z', 'meta carries narration + createdAt (the ledger fields)');
ok(meta.voucherNo === 'JV-9' && meta.type === 'journal' && meta.amount === 250 && meta.date === '2025-07-01', 'meta carries voucherNo/type/amount/date');
ok(meta.memberId === 'M-42', 'meta carries memberId (the member-ledger filter)');
// Journal-first-write slice 1: the two remaining vouchers-table fields, so the row is fully rebuildable.
ok(meta.branchId === 'BR-1' && meta.createdBy === 'सुनीता', 'meta carries branchId + createdBy (journal-first-write: full row reconstruction)');
const bare = voucherEventMeta({ id: 'v0', voucherNo: 'X', type: 'journal', amount: 0, date: '2025-07-01' });
ok(bare.narration === '' && bare.createdAt === '' && bare.memberId === '', 'missing narration/createdAt/memberId default to empty strings (never undefined)');
ok(bare.branchId === '' && bare.createdBy === '', 'missing branchId/createdBy default to empty strings (branchId "" = Head Office)');

console.log(`\nLedger voucher-event legs (T-06): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
