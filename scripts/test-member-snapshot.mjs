// Member Portal S0 — proves the extracted pure member calculations are a NO-BEHAVIOUR-CHANGE move.
// buildMemberShareLedger is compared against a verbatim copy of the pre-S0 inline body of
// DataContext.getMemberLedger over hand cases + 500 randomised fixtures (since member-area stage A
// only where the legacy OB rule was right; the H-1 opening cases are asserted separately); loanOutstanding /
// kccOutstanding against the inline formulas they replaced. Run: node scripts/test-member-snapshot.mjs
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

const { buildMemberShareLedger, loanOutstanding, kccOutstanding } = await import(abs('../src/lib/memberSnapshot.ts'));
const { toMinor, toRupees, addMinor } = await import(abs('../src/lib/money.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const SC = '1102';

// ── Reference: the pre-S0 inline body of DataContext.getMemberLedger (voucher path), verbatim ──
function legacy(member, activeVouchers) {
  const memberId = member.id;
  const memberVouchers = activeVouchers
    .filter(v => v.memberId === memberId && (v.creditAccountId === SC || v.debitAccountId === SC))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || (a.voucherNo || '').localeCompare(b.voucherNo || '') || a.id.localeCompare(b.id));
  const hasShareCapVoucher = memberVouchers.some(v => v.creditAccountId === SC);
  let balanceMinor = toMinor(hasShareCapVoucher ? 0 : (member.shareCapital || 0));
  const result = [];
  if (!hasShareCapVoucher && (member.shareCapital || 0) > 0) {
    result.push({ id: 'ob', date: member.joinDate, voucherNo: 'OB', particulars: 'Opening Share Capital', credit: member.shareCapital, debit: 0, balance: toRupees(balanceMinor) });
  }
  memberVouchers.forEach(v => {
    const isCredit = v.creditAccountId === SC;
    const credit = isCredit ? v.amount : 0;
    const debit = !isCredit ? v.amount : 0;
    balanceMinor = addMinor(balanceMinor, toMinor(credit), -toMinor(debit));
    result.push({ id: v.id, date: v.date, voucherNo: v.voucherNo, particulars: v.narration || (isCredit ? 'Share deposit received' : 'Share withdrawal'), credit, debit, balance: toRupees(balanceMinor) });
  });
  return result;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const v = (o) => ({ id: o.id, voucherNo: o.no ?? o.id, type: 'receipt', date: o.date, createdAt: o.at ?? `${o.date}T00:00:00Z`, debitAccountId: o.dr, creditAccountId: o.cr, amount: o.amt, narration: o.nar ?? '', memberId: o.m });

// ── Hand cases ──
const M = { id: 'm1', shareCapital: 500, joinDate: '2024-04-01' };
// 1. No vouchers → single OB row.
let r = buildMemberShareLedger(M, [], SC);
ok(r.length === 1 && r[0].voucherNo === 'OB' && r[0].balance === 500, 'OB row only when no share-capital voucher');
ok(same(r, legacy(M, [])), 'OB case matches legacy');
// 2. Zero share capital and no vouchers → empty.
ok(buildMemberShareLedger({ ...M, shareCapital: 0 }, [], SC).length === 0, 'no OB row for zero share capital');
// 3. Credit then refund; admission-fee and other-member vouchers excluded.
const vs = [
  v({ id: 'a', date: '2024-04-01', dr: '1001', cr: SC, amt: 500, m: 'm1' }),
  v({ id: 'b', date: '2024-04-01', dr: '1001', cr: '4201', amt: 10, m: 'm1' }), // admission fee
  v({ id: 'c', date: '2024-05-01', dr: SC, cr: '1001', amt: 200.5, m: 'm1', nar: 'Refund' }),
  v({ id: 'd', date: '2024-05-02', dr: '1001', cr: SC, amt: 999, m: 'm2' }),
];
r = buildMemberShareLedger(M, vs, SC);
ok(r.length === 2 && r[1].balance === 299.5 && r[1].particulars === 'Refund', 'credit − refund running balance, fee/other member excluded');
ok(same(r, legacy(M, vs)), 'mixed case matches legacy');
// 4. Paise exactness: 0.1 + 0.2 must not drift.
const pv = [v({ id: 'p1', date: '2024-04-01', dr: '1001', cr: SC, amt: 0.1, m: 'm1' }), v({ id: 'p2', date: '2024-04-02', dr: '1001', cr: SC, amt: 0.2, m: 'm1' })];
ok(buildMemberShareLedger(M, pv, SC)[1].balance === 0.3, 'paise-exact balance (0.1 + 0.2 = 0.3)');

// ── Randomised parity vs legacy ──
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
for (let t = 0; t < 500; t++) {
  const member = { id: pick(['m1', 'm2']), shareCapital: pick([0, 100, 250.75, 1000]), joinDate: '2024-04-01' };
  const n = Math.floor(rnd() * 12);
  const list = [];
  for (let i = 0; i < n; i++) {
    const toSC = rnd() < 0.5;
    const other = pick(['1001', '1002', '4201']);
    list.push(v({
      id: `v${i}`, no: pick(['R/1', 'R/2', '', 'P/3']), date: pick(['2024-04-01', '2024-06-15', '2025-01-10']),
      at: pick(['2024-01-01T00:00:00Z', '2024-01-01T00:00:01Z']),
      dr: toSC ? other : pick([SC, other]), cr: toSC ? SC : other,
      amt: Math.round(rnd() * 100000) / 100, m: pick(['m1', 'm2', undefined]), nar: pick(['', 'x']),
    }));
  }
  // Member-area stage A (H-1): the legacy rule is kept wherever it was right — no share vouchers, or a
  // joining Cr voucher on/before the join date. Otherwise the OB is the implied opening, and the khata
  // must end on the scalar whenever that opening is non-negative.
  const mine = list.filter(x => x.memberId === member.id && (x.creditAccountId === SC || x.debitAccountId === SC));
  const joining = mine.some(x => x.creditAccountId === SC && x.date <= member.joinDate);
  const got = buildMemberShareLedger(member, list, SC);
  if (mine.length === 0 || joining) {
    if (!same(got, legacy(member, list))) { ok(false, `random fixture #${t} diverges from legacy`); break; }
  } else {
    const net = mine.reduce((s, x) => s + (x.creditAccountId === SC ? toMinor(x.amount) : -toMinor(x.amount)), 0);
    const implied = toMinor(member.shareCapital) - net;
    const end = got.length ? toMinor(got[got.length - 1].balance) : 0;
    if (implied >= 0 && end !== toMinor(member.shareCapital)) { ok(false, `random fixture #${t}: khata ${end} ≠ scalar`); break; }
    if (implied < 0 && got.some(r => r.voucherNo === 'OB')) { ok(false, `random fixture #${t}: OB shown for negative implied opening`); break; }
  }
  ok(true, '');
}

// ── H-1: a member who joined before the vouchers began (OB) and later bought / returned shares ──
// Old member, ₹1,000 opening, buys ₹500 later: scalar 1,500 → khata OB 1,000 + 500 = 1,500 (was 500).
const OLD = { id: 'm1', shareCapital: 1500, joinDate: '2023-04-01' };
r = buildMemberShareLedger(OLD, [v({ id: 'buy', date: '2026-07-01', dr: '1001', cr: SC, amt: 500, m: 'm1' })], SC);
ok(r.length === 2 && r[0].voucherNo === 'OB' && r[0].credit === 1000 && r[1].balance === 1500, `OB kept when a later purchase voucher exists (got ${JSON.stringify(r.map(x => x.balance))})`);
// Old member, ₹1,000 opening, refunded ₹400: scalar 600 → khata OB 1,000 − 400 = 600 (was 200).
r = buildMemberShareLedger({ ...OLD, shareCapital: 600 }, [v({ id: 'ref', date: '2026-07-01', dr: SC, cr: '1001', amt: 400, m: 'm1' })], SC);
ok(r.length === 2 && r[0].credit === 1000 && r[1].balance === 600, `refund not subtracted twice (got ${JSON.stringify(r.map(x => x.balance))})`);
// Joining voucher on the join date + a scalar the vouchers don't explain → no OB, gap stays visible.
r = buildMemberShareLedger({ id: 'm1', shareCapital: 500, joinDate: '2026-08-19' }, [
  v({ id: 'j', date: '2026-08-19', dr: '1001', cr: SC, amt: 400, m: 'm1' }),
  v({ id: 'x', date: '2026-08-19', dr: SC, cr: '3301', amt: 150, m: 'm1' }),
], SC);
ok(r.length === 2 && r[1].balance === 250, 'joining voucher ⇒ no OB; scalar gap (500 vs 250) still shows');
// Vouchers exceed the scalar for an old member → no OB row (negative opening is never invented).
r = buildMemberShareLedger({ ...OLD, shareCapital: 100 }, [v({ id: 'buy2', date: '2026-07-01', dr: '1001', cr: SC, amt: 500, m: 'm1' })], SC);
ok(r.length === 1 && r[0].balance === 500, 'negative implied opening ⇒ no OB, mismatch visible');

// ── Outstanding formulas ──
ok(loanOutstanding({ amount: 10000, repaidAmount: 2500 }) === 7500, 'loan outstanding = amount − repaid');
ok(loanOutstanding({ amount: 100, repaidAmount: 150 }) === -50, 'loan outstanding NOT clamped (matches the replaced inline formula)');
ok(kccOutstanding({ outstandingAmount: 3000, drawnAmount: 9000, repaidAmount: 1000 }) === 3000, 'KCC: stored outstanding wins');
ok(kccOutstanding({ outstandingAmount: 0, drawnAmount: 9000, repaidAmount: 1000 }) === 0, 'KCC: stored 0 is respected (?? not ||)');
ok(kccOutstanding({ outstandingAmount: undefined, drawnAmount: 9000, repaidAmount: 1000 }) === 8000, 'KCC: falls back to drawn − repaid');

console.log(`member-snapshot: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
