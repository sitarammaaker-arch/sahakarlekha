// Voucher rebuild engine (journal-first-write slice 2) — imports the REAL vouchersFromJournal +
// the event-build core, and proves the ROUND TRIP: a voucher → its journal event → rebuilt row
// reproduces the voucher. This is what makes the vouchers table a derivable projection of the
// journal (the prerequisite for journal-first writes). Run: node scripts/test-ledger-voucher-rebuild.mjs
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

const { vouchersFromJournal, voucherFromCurrent } = await import(abs('../src/lib/ledger/voucherRebuild.ts'));
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const CTX = (id, at) => ({ eventId: id, occurredAt: at });
const HUMAN = { kind: 'human', id: 'tester' };
// Build a voucher.<type> event carrying a voucher's legs + full meta (mirrors DataContext's sites).
const evt = (v, type, seq, at) => buildEvent({
  eventType: type, tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: v.id,
  sequence: seq, producer: HUMAN,
  payload: { lines: type === 'voucher.reversed' || type === 'voucher.cancelled' ? voucherReversalLines(v) : voucherPostingLines(v), ...voucherEventMeta(v) },
}, CTX(`e-${v.id}-${seq}`, at));

// ── 1. ROUND TRIP — a posted voucher rebuilds to itself ───────────────────────
const v1 = { id: 'v1', voucherNo: 'CV/2026/27/007', type: 'payment', date: '2026-06-01',
  debitAccountId: '5101', creditAccountId: '1001', amount: 2500.50, narration: 'Feed purchase',
  createdAt: '2026-06-01T09:15:00Z', createdBy: 'सुनीता', memberId: 'M-3', branchId: 'BR-2' };
const [r1] = vouchersFromJournal([evt(v1, 'voucher.posted', 1, '2026-06-01T00:00:00Z')]);
ok(r1.id === 'v1' && r1.voucherNo === 'CV/2026/27/007' && r1.type === 'payment', 'rebuild: id/voucherNo/type');
ok(r1.date === '2026-06-01' && r1.narration === 'Feed purchase' && r1.createdAt === '2026-06-01T09:15:00Z', 'rebuild: date/narration/createdAt');
ok(r1.createdBy === 'सुनीता' && r1.memberId === 'M-3' && r1.branchId === 'BR-2', 'rebuild: createdBy/memberId/branchId (slice-1 fields)');
ok(r1.amount === 2500.50, 'rebuild: amount in rupees, exact (₹2500.50)');
ok(r1.debitAccountId === '5101' && r1.creditAccountId === '1001', 'rebuild: legacy single Dr/Cr accounts from the first Dr/Cr leg');
ok(Array.isArray(r1.lines) && r1.lines.length === 2, 'rebuild: 2 lines');
ok(r1.lines.find((l) => l.accountId === '5101').type === 'Dr' && r1.lines.find((l) => l.accountId === '5101').amount === 2500.50, 'rebuild: Dr line 5101 ₹2500.50');
ok(r1.lines.find((l) => l.accountId === '1001').type === 'Cr' && r1.lines.every((l) => l.id === `v1-L${r1.lines.indexOf(l)}`), 'rebuild: Cr line + deterministic line ids');

// ── 2. Multi-line voucher round-trips (legs preserved exactly) ────────────────
const vm = { id: 'vm', voucherNo: 'JV/1', type: 'journal', date: '2026-06-02', amount: 100,
  narration: '', createdAt: '2026-06-02T00:00:00Z', createdBy: 'a',
  lines: [ { id: 'x', accountId: '1001', type: 'Dr', amount: 60 }, { id: 'y', accountId: '1002', type: 'Dr', amount: 40 }, { id: 'z', accountId: '4101', type: 'Cr', amount: 100 } ] };
const [rm] = vouchersFromJournal([evt(vm, 'voucher.posted', 1, '2026-06-02T00:00:00Z')]);
ok(rm.lines.length === 3 && rm.lines.filter((l) => l.type === 'Dr').length === 2, 'multi-line: 3 lines, 2 Dr');
ok(rm.lines.reduce((s, l) => s + (l.type === 'Dr' ? l.amount : -l.amount), 0) === 0, 'multi-line: rebuilt lines balance');

// ── 3. Cancelled aggregate → absent (no live row) ─────────────────────────────
const rows3 = vouchersFromJournal([evt(v1, 'voucher.posted', 1, '2026-06-01T00:00:00Z'), evt(v1, 'voucher.cancelled', 2, '2026-06-03T00:00:00Z')]);
ok(rows3.length === 0, 'cancelled voucher is absent from the rebuilt rows');

// ── 4. Edited aggregate → the NEW legs/amount win (latest reposted) ───────────
const vOld = { ...v1, amount: 1000, debitAccountId: '5101', creditAccountId: '1001' };
const vNew = { ...v1, amount: 1500, debitAccountId: '5101', creditAccountId: '1001' };
const [r4] = vouchersFromJournal([
  evt(vOld, 'voucher.posted', 1, '2026-06-01T00:00:00Z'),
  evt(vOld, 'voucher.reversed', 2, '2026-06-04T00:00:00Z'),
  buildEvent({ eventType: 'voucher.reposted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: 'v1', sequence: 3, producer: HUMAN, payload: { lines: voucherPostingLines(vNew), ...voucherEventMeta(vNew) } }, CTX('e-v1-rp', '2026-06-04T00:00:01Z')),
]);
ok(r4.amount === 1500 && r4.lines.find((l) => l.accountId === '5101').amount === 1500, 'edited voucher rebuilds to the NEW amount (1500)');

// ── 5. Empty journal → no rows; a bare voucher defaults cleanly ───────────────
ok(vouchersFromJournal([]).length === 0, 'empty journal → no rows');
const bare = voucherFromCurrent({ id: 'b', date: '2026-01-01', voucherNo: '', narration: '', createdAt: '', memberId: '', amount: 0, legs: [], type: '', branchId: '', createdBy: '' });
ok(bare.type === 'journal' && bare.debitAccountId === '' && bare.creditAccountId === '' && bare.lines === undefined && bare.memberId === undefined && bare.branchId === undefined, 'bare current-voucher → safe defaults (unknown type→journal, no legs→no lines, empty→undefined)');

console.log(`\nVoucher rebuild engine (journal-first-write slice 2): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
