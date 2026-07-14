// Receipts & Payments projection (T-09) — imports the REAL projectReceiptsPayments via the '@/'
// loader and proves it reproduces getReceiptsPayments from the journal: non-cash leg → receipt(Cr)/
// payment(Dr), capital/revenue via the shared classifier, cash↔bank contra excluded, closing = opening
// + cash/bank legs, cancelled/edited resolution, asOf. NOT wired. Run: node scripts/test-ledger-receipts-payments.mjs
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

const { projectReceiptsPayments } = await import(abs('../src/lib/ledger/receiptsPayments.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 't' };
const leg = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const CASH = '1001', BANK = '1002';
const accounts = [
  { id: '1001', name: 'Cash', type: 'asset' }, { id: '1002', name: 'Bank', type: 'asset' },
  { id: '4101', name: 'Sales', type: 'income', parentId: '4100' },
  { id: '5101', name: 'Salaries', type: 'expense', parentId: '5100' },
  { id: '3101', name: 'Share Capital', type: 'equity' },
];
const ev = (id, lines, meta = {}, eventType = 'voucher.posted', seq = 1, at = '2025-06-01T00:00:00Z') =>
  buildEvent({ eventType, tenantId: 'SOC001', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines, voucherNo: id, narration: meta.narration ?? '', date: meta.date ?? '2025-06-01' } }, { eventId: `e-${id}-${seq}-${eventType}`, occurredAt: at });
const rp = (events, opts = {}) => projectReceiptsPayments(events, accounts, CASH, new Set([BANK]), { openingCashMinor: 0, openingBankMinor: 0, ...opts });
const find = (arr, id) => arr.find((x) => x.accountId === id);

// 1. Cash sale → receipt Sales; closing cash rises.
const r1 = rp([ev('s1', [leg(CASH, 'Dr', 100000), leg('4101', 'Cr', 100000)])]);
ok(r1.receipts.length === 1 && find(r1.receipts, '4101').amountMinor === 100000, 'cash sale → a Sales receipt of 100000');
ok(r1.payments.length === 0 && r1.closingCashMinor === 100000, 'closing cash = opening + the Dr cash leg');

// 2. Cash expense → payment; closing cash falls.
const r2 = rp([ev('e1', [leg('5101', 'Dr', 30000), leg(CASH, 'Cr', 30000)])]);
ok(find(r2.payments, '5101').amountMinor === 30000 && r2.closingCashMinor === -30000, 'cash expense → a Salaries payment; closing cash falls');

// 3. Split receipt (Dr cash + Dr bank / Cr sales) → ONE Sales receipt; both cash and bank rise.
const r3 = rp([ev('s2', [leg(CASH, 'Dr', 60000), leg(BANK, 'Dr', 40000), leg('4101', 'Cr', 100000)])]);
ok(find(r3.receipts, '4101').amountMinor === 100000 && r3.receipts.length === 1, 'split receipt books the counterparty once');
ok(r3.closingCashMinor === 60000 && r3.closingBankMinor === 40000, 'cash + bank both rise by their legs');

// 4. Capital vs revenue via the shared classifier (equity = capital, income = revenue).
const r4 = rp([ev('c1', [leg(CASH, 'Dr', 500000), leg('3101', 'Cr', 500000)])]);
ok(find(r4.receipts, '3101').nature === 'capital' && find(r1.receipts, '4101').nature === 'revenue', 'equity receipt = capital, income receipt = revenue');

// 5. A cash↔bank contra has no non-cash leg → no receipt/payment, but balances move.
const r5 = rp([ev('t1', [leg(BANK, 'Dr', 20000), leg(CASH, 'Cr', 20000)])]);
ok(r5.receipts.length === 0 && r5.payments.length === 0, 'cash↔bank contra → no receipt/payment');
ok(r5.closingCashMinor === -20000 && r5.closingBankMinor === 20000, 'contra shifts cash → bank');

// 6. A voucher with no cash/bank leg is excluded entirely.
ok(rp([ev('j1', [leg('5101', 'Dr', 10000), leg('4101', 'Cr', 10000)])]).receipts.length === 0, 'a non-cash/bank voucher is not an R&P entry');

// 7. Cancelled voucher excluded; edited uses reposted legs.
const r7 = rp([ev('x', [leg(CASH, 'Dr', 100000), leg('4101', 'Cr', 100000)]), ev('x', [leg(CASH, 'Cr', 100000), leg('4101', 'Dr', 100000)], {}, 'voucher.cancelled', 2)]);
ok(r7.receipts.length === 0 && r7.closingCashMinor === 0, 'a cancelled cash sale drops out of R&P');
const r7b = rp([ev('y', [leg(CASH, 'Dr', 100000), leg('4101', 'Cr', 100000)]), ev('y', [leg(CASH, 'Cr', 100000), leg('4101', 'Dr', 100000)], {}, 'voucher.reversed', 2), ev('y', [leg(CASH, 'Dr', 150000), leg('4101', 'Cr', 150000)], {}, 'voucher.reposted', 3)]);
ok(find(r7b.receipts, '4101').amountMinor === 150000, 'edited cash sale uses the reposted amount');

// 8. Opening seeds closing; asOf excludes later vouchers.
const r8 = rp([ev('later', [leg(CASH, 'Dr', 999999), leg('4101', 'Cr', 999999)], { date: '2025-09-01' })], { openingCashMinor: 50000, asOf: '2025-06-30' });
ok(r8.openingCashMinor === 50000 && r8.closingCashMinor === 50000 && r8.receipts.length === 0, 'opening seeds closing; a post-asOf voucher is excluded');

console.log(`\nReceipts & Payments projection (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
