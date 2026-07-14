// Ledger report adapters + per-report parity (T-09, runbook §2c) — imports the REAL reports.ts /
// reportParity.ts via the '@/' loader. Proves (a) the projections map onto the app's report shapes in
// rupees, and (b) each comparator catches the divergences the trial-balance parity gate CANNOT see:
// a moved row, a wrong particular, a shifted running balance, a mis-classified R&P line.
// Run: node scripts/test-ledger-report-parity.mjs
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

const { ledgerCashBookEntries, ledgerBankBookEntries, ledgerMemberLedgerEntries, ledgerReceiptsPaymentsData } =
  await import(abs('../src/lib/ledger/reports.ts'));
const { cashBookParity, bankBookParity, memberLedgerParity, receiptsPaymentsParity } =
  await import(abs('../src/lib/ledger/reportParity.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const HUMAN = { kind: 'human', id: 't' };
const leg = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const CASH = '1001', BANK = '1002', SALES = '4101', EXP = '5101', SHARE = '1102';
const accounts = [
  { id: CASH, name: 'Cash', nameHi: 'नकद', type: 'asset' },
  { id: BANK, name: 'Bank', nameHi: 'बैंक', type: 'asset' },
  { id: SALES, name: 'Sales', nameHi: 'बिक्री', type: 'income', parentId: '4100' },
  { id: EXP, name: 'Expenses', nameHi: 'व्यय', type: 'expense', parentId: '5100' },
  { id: SHARE, name: 'Share Capital', nameHi: 'शेयर पूंजी', type: 'liability', parentId: '3100' },
];
const ev = (id, eventType, lines, meta = {}, seq = 1) =>
  buildEvent(
    { eventType, tenantId: 'SOC001', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN,
      payload: { lines, voucherNo: meta.voucherNo ?? id, narration: meta.narration ?? '', createdAt: meta.createdAt ?? '', date: meta.date ?? '2025-06-01', amount: meta.amount ?? 0, memberId: meta.memberId ?? '' } },
    { eventId: `e-${id}-${seq}-${eventType}`, occurredAt: `${meta.date ?? '2025-06-01'}T00:00:00Z` },
  );

// ── Adapters: the projections, in the app's report shapes (rupees) ───────────────────────────────
const journal = [
  ev('v1', 'voucher.posted', [leg(CASH, 'Dr', 100050), leg(SALES, 'Cr', 100050)], { date: '2025-06-01', narration: 'Cash sale', voucherNo: 'RV-1', amount: 1000.5 }),
  ev('v2', 'voucher.posted', [leg(CASH, 'Cr', 20000), leg(EXP, 'Dr', 20000)], { date: '2025-06-02', voucherNo: 'PV-1', amount: 200 }),
  ev('v3', 'voucher.posted', [leg(BANK, 'Dr', 500000), leg(SHARE, 'Cr', 500000)], { date: '2025-06-03', voucherNo: 'RV-2', amount: 5000, memberId: 'm1' }),
];

const cb = ledgerCashBookEntries(journal, CASH, accounts, { openingMinor: 50000 });
ok(cb.length === 2, 'cash book: a row per cash voucher');
ok(cb[0].amount === 1000.5 && cb[0].runningBalance === 1500.5 && cb[0].type === 'receipt', 'cash book: paise → rupees, opening seeds the running balance');
ok(cb[0].particulars === 'Cash sale' && cb[1].particulars === 'Expenses', 'cash book: particulars = narration, else the contra account');
ok(cb[1].type === 'payment' && cb[1].runningBalance === 1300.5, 'cash book: a Cr on cash is a payment and subtracts');

const bb = ledgerBankBookEntries(journal, BANK, accounts, { openingMinor: 0 });
ok(bb.length === 1 && bb[0].type === 'deposit' && bb[0].amount === 5000, 'bank book: a Dr on bank is a deposit (not a "receipt")');

const ml = ledgerMemberLedgerEntries(journal, 'm1', SHARE, { openingMinor: 0, joinDate: '2025-04-01' });
ok(ml.length === 1 && ml[0].credit === 5000 && ml[0].debit === 0 && ml[0].balance === 5000, 'member ledger: a Cr to share capital is a credit, in rupees');

const rp = ledgerReceiptsPaymentsData(journal, accounts, CASH, new Set([BANK]), { openingCashMinor: 50000, openingBankMinor: 0 });
ok(rp.openingCash === 500 && rp.closingCash === 1300.5, 'R&P: opening + closing cash in rupees');
ok(rp.closingBank === 5000, 'R&P: closing bank follows the bank legs');
ok(rp.receipts.length === 2 && rp.payments.length === 1, 'R&P: non-cash Cr legs are receipts, non-cash Dr legs are payments');
ok(rp.receipts.find((r) => r.accountId === SHARE)?.nature === 'capital', 'R&P: share capital is classified CAPITAL (shared classifier)');
ok(rp.receipts.find((r) => r.accountId === SALES)?.nature === 'revenue', 'R&P: sales is classified REVENUE');

// ── Parity: identical reports match; every kind of divergence is caught ──────────────────────────
const clone = (x) => JSON.parse(JSON.stringify(x));

ok(cashBookParity(cb, clone(cb)).matches, 'cash book parity: an identical report matches');
ok(bankBookParity(bb, clone(bb)).matches, 'bank book parity: an identical report matches');
ok(memberLedgerParity(ml, clone(ml)).matches, 'member ledger parity: an identical report matches');
ok(receiptsPaymentsParity(rp, clone(rp)).matches, 'R&P parity: an identical report matches');

const missingRow = cashBookParity(cb, cb.slice(0, 1));
ok(!missingRow.matches && missingRow.diffs[0].field === 'cashBook.rowCount', 'cash book parity: a missing row is caught (rowCount)');

const wrongParticulars = clone(cb); wrongParticulars[1].particulars = 'Something else';
const wp = cashBookParity(wrongParticulars, cb);
ok(!wp.matches && wp.diffs.some((d) => d.field === 'cashBook[1].particulars'), 'cash book parity: a wrong particular is caught — the TB gate cannot see this');

const wrongRunning = clone(cb); wrongRunning[1].runningBalance = 1300.49;
ok(!cashBookParity(wrongRunning, cb).matches, 'cash book parity: a running balance off by a paisa is caught');

const reordered = [cb[1], cb[0]];
ok(!cashBookParity(reordered, cb).matches, 'cash book parity: a re-ORDERED cash book is caught (order is the running balance)');

const paisaNoise = clone(cb); paisaNoise[0].runningBalance = 1500.5 + 1e-9;
ok(cashBookParity(paisaNoise, cb).matches, 'cash book parity: float display noise below half a paisa is NOT a diff');

const wrongBalance = clone(ml); wrongBalance[0].balance = 4999;
ok(!memberLedgerParity(wrongBalance, ml).matches, 'member ledger parity: a wrong running balance is caught');

const shuffledRp = clone(rp); shuffledRp.receipts.reverse();
ok(receiptsPaymentsParity(shuffledRp, rp).matches, 'R&P parity: line items are an unordered set — a different order still matches');

const wrongNature = clone(rp); wrongNature.receipts.find((r) => r.accountId === SHARE).nature = 'revenue';
const wn = receiptsPaymentsParity(wrongNature, rp);
ok(!wn.matches && wn.diffs.some((d) => d.field === `receipts[${SHARE}].nature`), 'R&P parity: a mis-classified capital/revenue line is caught');

const droppedLine = clone(rp); droppedLine.payments = [];
const dl = receiptsPaymentsParity(droppedLine, rp);
ok(!dl.matches && dl.diffs.some((d) => d.field === `payments[${EXP}]` && d.ledger === 'missing'), 'R&P parity: a dropped payment line is caught');

const wrongClosing = clone(rp); wrongClosing.closingBank = 4999.99;
const wc = receiptsPaymentsParity(wrongClosing, rp);
ok(!wc.matches && wc.diffs.some((d) => d.field === 'closingBank'), 'R&P parity: a wrong closing bank is caught');

const many = clone(cb).concat(clone(cb)).concat(clone(cb));
ok(cashBookParity(many.map((r) => ({ ...r, voucherNo: 'X' })), many).diffs.length <= 10, 'parity diffs are capped (a diagnostic, not a dump)');

console.log(`\nLedger report adapters + per-report parity (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
