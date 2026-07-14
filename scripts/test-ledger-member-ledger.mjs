// Member share-capital ledger projection (T-09) — imports the REAL projectMemberLedger via the '@/'
// loader and proves it reproduces getMemberLedger from the journal: per-member filter, credit/debit,
// running balance, the OB row, cancelled/edited resolution. NOT wired. Run: node scripts/test-ledger-member-ledger.mjs
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

const { projectMemberLedger } = await import(abs('../src/lib/ledger/memberLedger.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 't' };
const leg = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const SC = '1102';
const row = (rows, id) => rows.find((r) => r.id === id);
// deposit: Dr cash / Cr share-cap ; withdrawal: Dr share-cap / Cr cash. amount in rupees in payload.
const ev = (id, lines, meta, eventType = 'voucher.posted', seq = 1, at = '2025-06-01T00:00:00Z') =>
  buildEvent({ eventType, tenantId: 'SOC001', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines, voucherNo: meta.voucherNo ?? id, narration: meta.narration ?? '', createdAt: meta.createdAt ?? '', date: meta.date ?? '2025-06-01', memberId: meta.memberId, amount: meta.amount } }, { eventId: `e-${id}-${seq}-${eventType}`, occurredAt: at });
const deposit = (id, member, rupees, meta = {}) => ev(id, [leg('1001', 'Dr', rupees * 100), leg(SC, 'Cr', rupees * 100)], { memberId: member, amount: rupees, ...meta });
const withdrawal = (id, member, rupees, meta = {}) => ev(id, [leg(SC, 'Dr', rupees * 100), leg('1001', 'Cr', rupees * 100)], { memberId: member, amount: rupees, ...meta });
const book = (events, member, opts = {}) => projectMemberLedger(events, member, SC, { openingMinor: 0, joinDate: '2025-04-01', ...opts });

// 1. Two deposits → credit rows, running balance, no OB (a Cr-to-share-capital voucher exists).
const b1 = book([deposit('d1', 'M1', 1000, { narration: 'Share deposit', date: '2025-06-01' }), deposit('d2', 'M1', 500, { date: '2025-06-02' })], 'M1');
ok(b1.length === 2 && !b1.some((r) => r.id === 'ob'), 'deposits present, no OB row when a share-capital voucher exists');
ok(b1[0].creditMinor === 100000 && b1[0].balanceMinor === 100000 && b1[0].particulars === 'Share deposit', 'first deposit: credit 100000, running 100000, narration particulars');
ok(b1[1].balanceMinor === 150000 && b1[1].debitMinor === 0, 'running balance folds the second deposit (150000)');

// 2. OB row when the member has opening share capital but NO share-capital voucher.
const b2 = book([], 'M2', { openingMinor: 50000, joinDate: '2025-04-15' });
ok(b2.length === 1 && b2[0].id === 'ob' && b2[0].creditMinor === 50000 && b2[0].date === '2025-04-15', 'OB row shown for opening capital with no voucher');

// 3. Per-member filter — another member's vouchers are excluded.
const b3 = book([deposit('d1', 'M1', 1000), deposit('dx', 'M9', 9999)], 'M1');
ok(b3.length === 1 && b3[0].id === 'd1', 'only the requested member’s vouchers appear');

// 4. Withdrawal (Dr share-capital) → debit, balance decreases; with an OB (no Cr voucher).
const b4 = book([withdrawal('w1', 'M3', 200, { date: '2025-06-05' })], 'M3', { openingMinor: 100000 });
ok(row(b4, 'ob') && row(b4, 'w1').debitMinor === 20000 && row(b4, 'w1').balanceMinor === 80000, 'withdrawal debits and reduces the balance (100000 − 20000)');
ok(row(b4, 'w1').particulars === 'Share withdrawal', 'withdrawal default particulars');

// 5. A cancelled deposit is excluded.
const b5 = book([deposit('d1', 'M1', 1000), ev('dc', [leg('1001', 'Dr', 500), leg(SC, 'Cr', 500)], { memberId: 'M1', amount: 5 }), ev('dc', [leg('1001', 'Cr', 500), leg(SC, 'Dr', 500)], { memberId: 'M1', amount: 5 }, 'voucher.cancelled', 2)], 'M1');
ok(b5.length === 1 && b5[0].id === 'd1', 'a cancelled share-capital voucher is excluded');

// 6. A voucher for the member that does NOT touch share capital is excluded.
const b6 = book([deposit('d1', 'M1', 1000), ev('other', [leg('1001', 'Dr', 300), leg('4101', 'Cr', 300)], { memberId: 'M1', amount: 3 })], 'M1');
ok(b6.length === 1 && b6[0].id === 'd1', 'a non-share-capital voucher for the member is excluded');

console.log(`\nMember ledger projection (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
