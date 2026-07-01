// Unit tests for Housing H2a — per-member receivable sub-ledger resolution and the
// collection-credit decision. A faithful JS mirror of the pure logic in
// src/contexts/HousingDataContext.tsx (generateMaintenanceBills.resolveReceivable and
// recordMaintenanceCollection.creditAcc). tsc guarantees the TS compiles; this pins the
// behaviour. Run: node scripts/test-housing.mjs   (exit 1 on any failure)

// ── Mirror: resolveReceivable (find-or-create, deduped per owner within AND across runs) ──
// 3303 stays a leaf control; vacant flats (no owner) fall back to it. Otherwise reuse the
// member's sub-ledger recorded on any of their flats (if it still exists in the chart), else
// create a fresh leaf under 3303. A per-run cache prevents duplicate creates in one bill-run.
function makeResolver({ flats, accounts, createAccount }) {
  const recCache = new Map();
  return function resolveReceivable(memberId) {
    if (!memberId) return '3303';
    if (recCache.has(memberId)) return recCache.get(memberId);
    const existing = flats.find(f => !f.isDeleted && f.memberId === memberId && f.receivableAccountId && accounts.some(a => a.id === f.receivableAccountId))?.receivableAccountId;
    let accId = existing;
    if (!accId) accId = createAccount(memberId);
    recCache.set(memberId, accId);
    return accId;
  };
}
// Mirror: collection credits the exact account the demand debited; legacy bills (no link) → 3303.
const collectionCredit = (bill) => bill.receivableAccountId || '3303';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Vacant flat → 3303 control, no sub-ledger created
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: '4101' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  ok(resolve(undefined) === '3303', 'vacant flat (no owner) posts to 3303 control');
  ok(created === 0, 'vacant flat creates no sub-ledger');
}

// 2. New member → one sub-ledger created
{
  let created = 0;
  const accounts = [{ id: '3303' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  const a = resolve('m1');
  ok(a === 'MR-1', 'new member gets a fresh sub-ledger');
  ok(created === 1, 'exactly one sub-ledger created for a new member');
}

// 3. Same member twice in one run → deduped by the per-run cache (one create)
{
  let created = 0;
  const accounts = [{ id: '3303' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  const a = resolve('m1');
  const b = resolve('m1');
  ok(a === b, 'same member resolves to the same sub-ledger within a run');
  ok(created === 1, 'member owning two flats → only ONE sub-ledger created in a run');
}

// 4. Cross-run reuse: member already has a sub-ledger on a flat, and it still exists in the chart
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: 'MR-9' }];
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: false }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return `MR-NEW`; } });
  ok(resolve('m1') === 'MR-9', 'reuses the member sub-ledger recorded on a prior flat');
  ok(created === 0, 'no new sub-ledger when a valid one already exists');
}

// 5. Stale link: stored receivableAccountId points to a now-missing account → create fresh
{
  let created = 0;
  const accounts = [{ id: '3303' }];   // MR-9 no longer in the chart
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: false }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return 'MR-FRESH'; } });
  ok(resolve('m1') === 'MR-FRESH', 'stale sub-ledger link → a fresh one is created');
  ok(created === 1, 'stale link triggers exactly one create');
}

// 6. Deleted flat is not a source of reuse
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: 'MR-9' }];
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: true }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return 'MR-NEW'; } });
  ok(resolve('m1') === 'MR-NEW', 'soft-deleted flat is ignored when resolving reuse');
  ok(created === 1, 'deleted-flat link is not reused');
}

// 7. Demand posting is balanced: Dr receivable == Cr 4101 == amount
{
  const amount = 1500;
  const rec = 'MR-1';
  const lines = [{ accountId: rec, type: 'Dr', amount }, { accountId: '4101', type: 'Cr', amount }];
  const dr = lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
  const cr = lines.filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
  ok(dr === cr && dr === amount, 'demand voucher is balanced (Dr receivable = Cr 4101 = amount)');
  ok(lines[0].accountId === rec, 'demand debits the resolved receivable, not 3303, for an owned flat');
}

// 8. Collection credits the account the demand debited; legacy bills fall back to 3303
{
  ok(collectionCredit({ receivableAccountId: 'MR-7' }) === 'MR-7', 'collection credits the member sub-ledger the demand used');
  ok(collectionCredit({ receivableAccountId: undefined }) === '3303', 'legacy bill (Dr 3303) → collection credits 3303 (back-compat)');
  ok(collectionCredit({}) === '3303', 'bill with no receivable link → 3303 control');
}

// ── Mirror: src/lib/housing/billing.ts (H2b multi-charge-head bill computation) ──
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function chargeHeadAmount(head, flat) {
  const override = flat.chargeOverrides ? flat.chargeOverrides[head.id] : undefined;
  if (override !== undefined && override !== null) return round2(Math.max(0, override));
  const base = head.basis === 'per_sqft' ? head.rate * (flat.area || 0) : head.rate;
  return round2(Math.max(0, base || 0));
}
function computeBillLines(flat, heads) {
  return heads.filter(h => !h.isDeleted && h.isActive !== false).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(h => ({ chargeHeadId: h.id, name: h.nameEn || h.nameHi, accountId: h.accountId, isFund: !!h.isFund, amount: chargeHeadAmount(h, flat) }))
    .filter(l => l.amount > 0);
}
const billTotal = (lines) => round2(lines.reduce((s, l) => s + l.amount, 0));
function demandLegs(receivableAccountId, lines) {
  const total = billTotal(lines);
  if (total <= 0) return [];
  const byAcc = new Map();
  for (const l of lines) byAcc.set(l.accountId, round2((byAcc.get(l.accountId) || 0) + l.amount));
  const legs = [{ accountId: receivableAccountId, type: 'Dr', amount: total }];
  for (const [accountId, amount] of byAcc) legs.push({ accountId, type: 'Cr', amount });
  return legs;
}

const HEADS = [
  { id: 'svc',  nameEn: 'Service',  accountId: '4101', basis: 'fixed',    rate: 1000, order: 1 },
  { id: 'watr', nameEn: 'Water',    accountId: '4102', basis: 'per_sqft', rate: 2,    order: 2 },
  { id: 'sink', nameEn: 'Sinking',  accountId: '1202', basis: 'fixed',    rate: 500,  order: 3, isFund: true },
  { id: 'park', nameEn: 'Parking',  accountId: '4103', basis: 'fixed',    rate: 300,  order: 4 },
];

// 9. Per-flat lines from the schedule (fixed + per_sqft), positive only, in order
{
  const flat = { area: 850 };
  const lines = computeBillLines(flat, HEADS);
  ok(lines.length === 4, 'all four active heads produce a line');
  ok(lines[1].amount === 1700, 'per_sqft head bills rate × area (2 × 850 = 1700)');
  ok(billTotal(lines) === 3500, 'bill total sums heads (1000+1700+500+300)');
  ok(lines[2].isFund === true, 'fund head keeps its isFund flag for direct-to-fund routing');
}

// 10. Demand legs are balanced: Dr receivable(total) / Cr each head account (fund direct)
{
  const lines = computeBillLines({ area: 850 }, HEADS);
  const legs = demandLegs('MR-1', lines);
  const dr = legs.filter(l => l.type === 'Dr');
  const cr = legs.filter(l => l.type === 'Cr');
  ok(dr.length === 1 && dr[0].accountId === 'MR-1' && dr[0].amount === 3500, 'single Dr to the member receivable for the total');
  ok(cr.reduce((s, l) => s + l.amount, 0) === 3500, 'Σ Cr equals the total (balanced)');
  ok(cr.some(l => l.accountId === '1202' && l.amount === 500), 'sinking-fund contribution credited directly to fund 1202, not income');
  ok(cr.some(l => l.accountId === '4101'), 'service charge credited to income 4101');
}

// 11. Per-flat override: 0 excludes a head; a value replaces the schedule amount
{
  const flat = { area: 850, chargeOverrides: { park: 0, svc: 1200 } };
  const lines = computeBillLines(flat, HEADS);
  ok(!lines.some(l => l.chargeHeadId === 'park'), 'override 0 excludes the parking head for this flat');
  ok(lines.find(l => l.chargeHeadId === 'svc').amount === 1200, 'override replaces the schedule amount (service 1200)');
}

// 12. Inactive / deleted heads are excluded
{
  const heads = [
    { id: 'a', nameEn: 'A', accountId: '4101', basis: 'fixed', rate: 100, isActive: false },
    { id: 'b', nameEn: 'B', accountId: '4101', basis: 'fixed', rate: 200, isDeleted: true },
    { id: 'c', nameEn: 'C', accountId: '4101', basis: 'fixed', rate: 300 },
  ];
  const lines = computeBillLines({}, heads);
  ok(lines.length === 1 && lines[0].chargeHeadId === 'c', 'inactive and deleted heads are excluded');
}

// 13. Two heads on the same account collapse into one Cr leg
{
  const heads = [
    { id: 'a', nameEn: 'A', accountId: '4101', basis: 'fixed', rate: 100, order: 1 },
    { id: 'b', nameEn: 'B', accountId: '4101', basis: 'fixed', rate: 250, order: 2 },
  ];
  const legs = demandLegs('MR-1', computeBillLines({}, heads));
  const cr = legs.filter(l => l.type === 'Cr');
  ok(cr.length === 1 && cr[0].accountId === '4101' && cr[0].amount === 350, 'same-account heads grouped into one Cr leg (350)');
}

// 14. Zero/empty bill → no legs (caller skips posting)
{
  ok(demandLegs('MR-1', []).length === 0, 'empty bill produces no demand legs');
  ok(demandLegs('MR-1', computeBillLines({ area: 0 }, [{ id: 'w', nameEn: 'W', accountId: '4102', basis: 'per_sqft', rate: 2 }])).length === 0, 'per_sqft head on a zero-area flat produces no posting');
}

// ── Mirror: src/lib/housing/statement.ts (H2c member maintenance statement) ──
function buildMemberStatement(bills, vouchers) {
  const activeBills = bills.filter(b => !b.isDeleted);
  const billIds = new Set(activeBills.map(b => b.id));
  const raw = [];
  for (const b of activeBills) raw.push({ date: b.date, kind: 'demand', ref: b.billNo, particulars: `Maintenance ${b.period}`, debit: round2(b.amount), credit: 0, billId: b.id });
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    if (v.refType !== 'maintenance.receipt' || !v.refId || !billIds.has(v.refId)) continue;
    raw.push({ date: v.date, kind: 'receipt', ref: v.voucherNo, particulars: v.narration || 'Receipt', debit: 0, credit: round2(v.amount), billId: v.refId });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'demand' ? -1 : 1));
  let bal = 0;
  const rows = raw.map(r => { bal = round2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
  const totalDemanded = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalReceived = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDemanded, totalReceived, outstanding: round2(totalDemanded - totalReceived) };
}

// 15. Statement: demands + linked receipts, chronological running outstanding
{
  const bills = [
    { id: 'b1', billNo: '2026-07/A-101', period: '2026-07', date: '2026-07-01', amount: 1500 },
    { id: 'b2', billNo: '2026-08/A-101', period: '2026-08', date: '2026-08-01', amount: 1000 },
  ];
  const vouchers = [
    { voucherNo: 'RCP-1', refType: 'maintenance.receipt', refId: 'b1', date: '2026-07-10', amount: 500 },
    { voucherNo: 'X', refType: 'sale', refId: 'b1', date: '2026-07-11', amount: 999 }, // unrelated
  ];
  const s = buildMemberStatement(bills, vouchers);
  ok(s.rows.length === 3, 'statement has two demands + one linked receipt');
  ok(s.totalDemanded === 2500 && s.totalReceived === 500, 'totals sum demands and receipts');
  ok(s.outstanding === 2000, 'outstanding = demanded − received');
  ok(s.rows[s.rows.length - 1].balance === 2000, 'running balance ends at the outstanding');
  ok(!s.rows.some(r => r.ref === 'X'), 'non-maintenance-receipt vouchers are excluded');
}

// 16. Soft-deleted bills/receipts excluded; receipt for an unknown bill ignored
{
  const bills = [
    { id: 'b1', billNo: 'B1', period: '2026-07', date: '2026-07-01', amount: 1500 },
    { id: 'b2', billNo: 'B2', period: '2026-07', date: '2026-07-01', amount: 800, isDeleted: true },
  ];
  const vouchers = [
    { voucherNo: 'R1', refType: 'maintenance.receipt', refId: 'b1', date: '2026-07-05', amount: 300, isDeleted: true },
    { voucherNo: 'R2', refType: 'maintenance.receipt', refId: 'bX', date: '2026-07-06', amount: 100 },
  ];
  const s = buildMemberStatement(bills, vouchers);
  ok(s.rows.length === 1 && s.rows[0].ref === 'B1', 'deleted bill, deleted receipt, and orphan receipt all excluded');
  ok(s.outstanding === 1500, 'outstanding reflects only the live demand');
}

// 17. Same-day demand is ordered before its receipt
{
  const bills = [{ id: 'b1', billNo: 'B1', period: '2026-07', date: '2026-07-01', amount: 1000 }];
  const vouchers = [{ voucherNo: 'R1', refType: 'maintenance.receipt', refId: 'b1', date: '2026-07-01', amount: 400 }];
  const s = buildMemberStatement(bills, vouchers);
  ok(s.rows[0].kind === 'demand' && s.rows[1].kind === 'receipt', 'same-day: demand before receipt');
  ok(s.rows[0].balance === 1000 && s.rows[1].balance === 600, 'running balance steps 1000 → 600');
}

// ── Mirror: src/lib/housing/funds.ts (H3 fund/reserve statement) ──
function getLines(v) {
  if (v.lines && v.lines.length > 0) return v.lines;
  const out = [];
  if (v.debitAccountId && v.amount > 0) out.push({ accountId: v.debitAccountId, type: 'Dr', amount: v.amount });
  if (v.creditAccountId && v.amount > 0) out.push({ accountId: v.creditAccountId, type: 'Cr', amount: v.amount });
  return out;
}
function isFundAccount(a) { return !a.isGroup && a.subtype === 'reserve'; }
function buildFundStatement(fund, vouchers) {
  const opening = fund.openingBalanceType === 'credit' ? round2(fund.openingBalance || 0) : round2(-(fund.openingBalance || 0));
  const raw = [];
  for (const v of vouchers) {
    if (v.isDeleted) continue;
    for (const l of getLines(v)) {
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

// 18. isFundAccount picks non-group reserve accounts only
{
  ok(isFundAccount({ subtype: 'reserve' }) === true, 'reserve account is a fund');
  ok(isFundAccount({ subtype: 'reserve', isGroup: true }) === false, 'group reserve is not a postable fund');
  ok(isFundAccount({ subtype: 'surplus' }) === false, 'net surplus is not a fund');
  ok(isFundAccount({ subtype: 'current_asset' }) === false, 'non-reserve account is not a fund');
}

// 19. Fund statement: opening + contributions + interest − utilisation = closing (ties to corpus)
{
  const fund = { id: '1202', openingBalance: 10000, openingBalanceType: 'credit' };
  const vouchers = [
    { voucherNo: 'JV1', date: '2026-07-01', refType: 'maintenance.bill', lines: [{ accountId: '3303', type: 'Dr', amount: 500 }, { accountId: '1202', type: 'Cr', amount: 500 }] }, // billing contribution
    { voucherNo: 'RC1', date: '2026-07-05', refType: 'fund.contribution', lines: [{ accountId: '3301', type: 'Dr', amount: 2000 }, { accountId: '1202', type: 'Cr', amount: 2000 }] }, // manual top-up
    { voucherNo: 'IN1', date: '2026-07-10', refType: 'fund.interest', lines: [{ accountId: '3302', type: 'Dr', amount: 800 }, { accountId: '1202', type: 'Cr', amount: 800 }] }, // FDR interest
    { voucherNo: 'UT1', date: '2026-07-20', refType: 'fund.utilisation', lines: [{ accountId: '1202', type: 'Dr', amount: 3000 }, { accountId: '3302', type: 'Cr', amount: 3000 }] }, // spend
  ];
  const s = buildFundStatement(fund, vouchers);
  ok(s.opening === 10000, 'opening reads the fund credit balance');
  ok(s.contributions === 2500, 'contributions = billing split + manual top-up (500 + 2000)');
  ok(s.interest === 800, 'interest = fund.interest credits only');
  ok(s.utilisation === 3000, 'utilisation = debits to the fund');
  ok(s.closing === 10300, 'closing = 10000 + 2500 + 800 − 3000');
  ok(s.rows[s.rows.length - 1].balance === 10300, 'running corpus ends at closing');
}

// 20. Debit-balance opening is negated; deleted vouchers excluded
{
  const fund = { id: '1202', openingBalance: 500, openingBalanceType: 'debit' };
  const vouchers = [
    { voucherNo: 'X', date: '2026-07-01', refType: 'fund.contribution', isDeleted: true, lines: [{ accountId: '1202', type: 'Cr', amount: 1000 }] },
    { voucherNo: 'Y', date: '2026-07-02', refType: 'fund.contribution', lines: [{ accountId: '1202', type: 'Cr', amount: 1000 }] },
  ];
  const s = buildFundStatement(fund, vouchers);
  ok(s.opening === -500, 'debit opening balance is negated for a credit-corpus fund');
  ok(s.contributions === 1000 && s.closing === 500, 'deleted voucher excluded; closing = -500 + 1000');
}

console.log(`[housing-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
