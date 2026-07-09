// Cooperative fund statement (ECR-27) — mirrors src/lib/funds.ts.
// Run: node scripts/test-funds.mjs
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Mirror of getVoucherLines: explicit lines[] if present, else legacy Dr/Cr.
function getVoucherLines(v) {
  if (v.lines && v.lines.length) return v.lines;
  return [
    { accountId: v.debitAccountId, type: 'Dr', amount: v.amount },
    { accountId: v.creditAccountId, type: 'Cr', amount: v.amount },
  ];
}
function isFundAccount(a) { return !a.isGroup && a.subtype === 'reserve'; }

function buildFundStatement(fund, vouchers) {
  const opening = fund.openingBalanceType === 'credit' ? round2(fund.openingBalance || 0) : round2(-(fund.openingBalance || 0));
  const raw = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    for (const l of getVoucherLines(v)) {
      if (l.accountId !== fund.id) continue;
      const kind = l.type === 'Dr' ? 'utilisation' : (v.refType === 'fund.interest' ? 'interest' : 'contribution');
      raw.push({ date: v.date, ref: v.voucherNo, kind, particulars: v.narration || kind, credit: l.type === 'Cr' ? round2(l.amount) : 0, debit: l.type === 'Dr' ? round2(l.amount) : 0 });
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));
  let bal = opening;
  const rows = raw.map(r => { bal = round2(bal + r.credit - r.debit); return { ...r, balance: bal }; });
  const contributions = round2(rows.filter(r => r.kind === 'contribution').reduce((s, r) => s + r.credit, 0));
  const interest = round2(rows.filter(r => r.kind === 'interest').reduce((s, r) => s + r.credit, 0));
  const utilisation = round2(rows.filter(r => r.kind === 'utilisation').reduce((s, r) => s + r.debit, 0));
  const closing = round2(opening + contributions + interest - utilisation);
  return { opening, contributions, interest, utilisation, closing, rows };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const fund = { id: '1201', name: 'Reserve Fund', isGroup: false, subtype: 'reserve', openingBalance: 10000, openingBalanceType: 'credit' };

// 1. isFundAccount.
ok(isFundAccount(fund), 'reserve non-group account → fund');
ok(!isFundAccount({ ...fund, isGroup: true }), 'group account → not a fund');
ok(!isFundAccount({ ...fund, subtype: 'bank' }), 'non-reserve subtype → not a fund');

// 2. Empty history → closing == opening.
{
  const s = buildFundStatement(fund, []);
  ok(s.opening === 10000 && s.closing === 10000, 'no movement: closing = opening = 10000');
  ok(s.rows.length === 0, 'no rows');
}

// 3. Appropriation (Cr fund) = contribution; utilisation (Dr fund) reduces corpus.
{
  const vouchers = [
    { voucherNo: 'JV/1', date: '2024-04-30', creditAccountId: '1201', debitAccountId: '1208', amount: 5000, narration: 'Reserve appropriation FY 2024-25' },
    { voucherNo: 'JV/2', date: '2024-09-15', debitAccountId: '1201', creditAccountId: '3302', amount: 3000, narration: 'Building repair', refType: 'fund.utilisation' },
  ];
  const s = buildFundStatement(fund, vouchers);
  ok(s.contributions === 5000, 'appropriation (Cr) counted as contribution 5000');
  ok(s.utilisation === 3000, 'utilisation (Dr) 3000');
  ok(s.closing === 12000, 'closing = 10000 + 5000 − 3000 = 12000');
  ok(s.rows.length === 2 && s.rows[0].balance === 15000 && s.rows[1].balance === 12000, 'running balance 15000 → 12000');
}

// 4. Interest via refType 'fund.interest' is its own bucket.
{
  const vouchers = [{ voucherNo: 'JV/3', date: '2024-06-01', creditAccountId: '1201', debitAccountId: '4301', amount: 800, refType: 'fund.interest', narration: 'FDR interest' }];
  const s = buildFundStatement(fund, vouchers);
  ok(s.interest === 800 && s.contributions === 0, 'interest bucketed separately (800), not a contribution');
  ok(s.closing === 10800, 'closing = 10000 + 800');
}

// 5. Deleted vouchers ignored; multi-line voucher picks the fund leg only.
{
  const vouchers = [
    { voucherNo: 'JV/4', date: '2024-05-01', creditAccountId: '1201', debitAccountId: '1208', amount: 999, isDeleted: true, narration: 'cancelled' },
    { voucherNo: 'JV/5', date: '2024-05-02', narration: 'multi', lines: [
      { accountId: '1208', type: 'Dr', amount: 2000 }, { accountId: '1201', type: 'Cr', amount: 2000 },
    ] },
  ];
  const s = buildFundStatement(fund, vouchers);
  ok(s.contributions === 2000, 'deleted ignored; multi-line fund Cr leg = 2000');
  ok(s.closing === 12000, 'closing = 10000 + 2000');
}

// 6. Debit-opening fund (e.g. Dividend Distribution 1211) → negative opening.
{
  const dd = { id: '1211', isGroup: false, subtype: 'reserve', openingBalance: 500, openingBalanceType: 'debit' };
  const s = buildFundStatement(dd, []);
  ok(s.opening === -500, 'debit-opening fund → opening −500');
}

console.log(`\nFunds (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
