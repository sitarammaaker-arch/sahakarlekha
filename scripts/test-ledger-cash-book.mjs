// Cash/Bank book projection (T-09) — imports the REAL projectCashBook via the '@/' loader and proves
// it reproduces getCashBookEntries from the journal: running balance, receipt/payment, cancelled
// exclusion, edited→reposted legs, (date,createdAt) sort, particulars = narration||contra, and
// from/to-date windowing. NOT wired yet. Run: node scripts/test-ledger-cash-book.mjs
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

const { projectCashBook } = await import(abs('../src/lib/ledger/cashBook.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 't' };
const leg = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const CASH = '1001';
const accounts = [{ id: '1001', name: 'Cash' }, { id: '4101', name: 'Sales' }, { id: '5101', name: 'Expenses' }];
// event helper: eventType, aggregate id, legs, and payload meta
const ev = (id, eventType, lines, meta = {}, seq = 1, at = '2025-06-01T00:00:00Z') =>
  buildEvent(
    { eventType, tenantId: 'SOC001', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines, voucherNo: meta.voucherNo ?? id, narration: meta.narration ?? '', createdAt: meta.createdAt ?? '', date: meta.date ?? '2025-06-01' } },
    { eventId: `e-${id}-${seq}-${eventType}`, occurredAt: at },
  );
const receipt = (id, amt, meta) => ev(id, 'voucher.posted', [leg(CASH, 'Dr', amt), leg('4101', 'Cr', amt)], meta);
const payment = (id, amt, meta) => ev(id, 'voucher.posted', [leg(CASH, 'Cr', amt), leg('5101', 'Dr', amt)], meta);
const book = (events, opts = {}) => projectCashBook(events, CASH, accounts, { openingMinor: 0, ...opts });

// 1. Running balance + receipt/payment + particulars from narration.
const b1 = book([receipt('v1', 100000, { narration: 'Cash sale', date: '2025-06-01' }), receipt('v2', 500000, { date: '2025-06-02' }), payment('v3', 200000, { date: '2025-06-03' })]);
ok(b1.length === 3, 'a row per cash voucher');
ok(b1[0].type === 'receipt' && b1[0].runningBalanceMinor === 100000 && b1[0].particulars === 'Cash sale', 'receipt row: type, running, narration particulars');
ok(b1[1].runningBalanceMinor === 600000 && b1[2].type === 'payment' && b1[2].runningBalanceMinor === 400000, 'running balance accumulates; payment subtracts');

// 2. Opening balance seeds the running total.
ok(book([receipt('v1', 100000)], { openingMinor: 50000 })[0].runningBalanceMinor === 150000, 'opening balance seeds the running total');

// 3. CANCELLED voucher (posted + cancelled) → excluded entirely.
const cancelled = [receipt('v1', 100000), ev('vc', 'voucher.posted', [leg(CASH, 'Dr', 999)], { date: '2025-06-01' }), ev('vc', 'voucher.cancelled', [leg(CASH, 'Cr', 999)], { date: '2025-06-01' }, 2)];
const b3 = book(cancelled);
ok(b3.length === 1 && !b3.some((r) => r.id === 'vc'), 'a cancelled voucher does not appear in the cash book');

// 4. EDITED voucher (posted + reversed + reposted) → one row with the REPOSTED amount.
const edited = [
  ev('ve', 'voucher.posted', [leg(CASH, 'Dr', 100000)], { date: '2025-06-01', narration: 'orig' }),
  ev('ve', 'voucher.reversed', [leg(CASH, 'Cr', 100000)], { date: '2025-06-01' }, 2),
  ev('ve', 'voucher.reposted', [leg(CASH, 'Dr', 150000)], { date: '2025-06-01', narration: 'edited' }, 3),
];
const b4 = book(edited);
ok(b4.length === 1 && b4[0].amountMinor === 150000 && b4[0].particulars === 'edited', 'an edited voucher shows ONE row with the reposted amount + latest narration');

// 5. Sort by (date, createdAt) — same date, earlier createdAt first.
const b5 = book([receipt('late', 100, { date: '2025-06-05', createdAt: '2025-06-05T10:00:00Z' }), receipt('early', 200, { date: '2025-06-05', createdAt: '2025-06-05T08:00:00Z' })]);
ok(b5[0].id === 'early' && b5[1].id === 'late', 'same-date rows sort by createdAt');

// 6. particulars falls back to the contra account name when there is no narration.
ok(book([payment('vp', 100000, { date: '2025-06-01' })])[0].particulars === 'Expenses', 'no narration → particulars is the contra account name');

// 7. from/to-date windowing: pre-from folds into opening (no row); post-to excluded.
const windowed = book([
  receipt('pre', 100000, { date: '2025-05-01' }),   // before fromDate → into opening
  receipt('in', 500000, { date: '2025-06-15' }),    // in range
  receipt('post', 999999, { date: '2025-07-15' }),  // after toDate → excluded
], { fromDate: '2025-06-01', toDate: '2025-06-30' });
ok(windowed.length === 1 && windowed[0].id === 'in', 'only in-range rows appear');
ok(windowed[0].runningBalanceMinor === 600000, 'pre-fromDate movement folded into the opening running balance (100000 + 500000)');

// 8. Deterministic tie-break — two vouchers on the SAME date with the SAME createdAt (the Share
// Capital + Admission Fee pair booked in one member-add) must order by voucherNo, then id, the SAME
// way regardless of the events' array order. Without it, the journal (loaded by occurred_at) and the
// voucher state (createdAt order) sorted this pair differently and the running balance diverged —
// the real cash-book parity failure this fixes. Feed the events in REVERSE and expect voucherNo order.
const tieMeta = { date: '2025-06-01', createdAt: '2025-06-01T10:00:00.000Z' };
const tie = book([
  receipt('vB', 500, { ...tieMeta, voucherNo: 'RV/2026/27/410' }),  // fed first…
  receipt('vA', 25000, { ...tieMeta, voucherNo: 'RV/2026/27/409' }), // …but this sorts before it
]);
ok(tie[0].voucherNo === 'RV/2026/27/409' && tie[1].voucherNo === 'RV/2026/27/410', 'same date+createdAt → ordered by voucherNo, not array order');
ok(tie[0].runningBalanceMinor === 25000 && tie[1].runningBalanceMinor === 25500, 'running balance follows the deterministic order');

console.log(`\nCash book projection (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
