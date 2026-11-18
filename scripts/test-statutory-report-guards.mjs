// Statutory report P0s (audit 2026-11-17): RPT-01 … RPT-06.
// Run: node scripts/test-statutory-report-guards.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const G = await imp('src/lib/gstLedgerTie.ts');
const T = await imp('src/lib/tdsLedgerTie.ts');
const Q = await imp('src/lib/tds26q.ts');
const D = await imp('src/lib/depositLiabilityName.ts');
const F = await imp('src/lib/stateAuditFormats.ts');
const S = await imp('src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const V = (id, date, lines, extra = {}) => ({ id, voucherNo: id, date, narration: id, lines: lines.map(([accountId, type, amount]) => ({ accountId, type, amount })), ...extra });

// ── RPT-01: GST in the ledger the report does not count ──
{
  const chart = [{ id: '2291', name: 'Output CGST', type: 'liability' }, { id: 'X1', name: 'Output GST Payable (manual)', type: 'liability' }, { id: '2297', name: 'RCM Payable', type: 'liability' }, { id: '3391', name: 'Input CGST', type: 'asset' }];
  const ids = G.gstLedgerIds(chart);
  ok(ids.output.has('2201') && ids.output.has('2291') && ids.output.has('X1') && !ids.output.has('2297'), 'output GST ledgers found (reverse charge excluded)');
  const vs = [
    V('sale1', '2026-05-01', [['3301', 'Dr', 118], ['4101', 'Cr', 100], ['2291', 'Cr', 18]]),
    V('bill1', '2026-05-02', [['3309', 'Dr', 1180], ['4401', 'Cr', 1000], ['2291', 'Cr', 90], ['2292', 'Cr', 90]]),
    V('jv1', '2026-05-03', [['5201', 'Dr', 50], ['3391', 'Dr', 9], ['3301', 'Cr', 59]]),
    V('setoff', '2026-05-31', [['2291', 'Dr', 9], ['3391', 'Cr', 9]]),
    V('paid', '2026-06-10', [['2291', 'Dr', 99], ['3302-01', 'Cr', 99]]),
    V('gone', '2026-05-04', [['3301', 'Dr', 59], ['2291', 'Cr', 9], ['4401', 'Cr', 50]], { isDeleted: true }),
    V('pend', '2026-05-05', [['3301', 'Dr', 59], ['2291', 'Cr', 9], ['4401', 'Cr', 50]], { approvalStatus: 'pending' }),
    V('late', '2026-07-05', [['3301', 'Dr', 59], ['2291', 'Cr', 9], ['4401', 'Cr', 50]]),
  ];
  const tie = G.gstLedgerTie(vs, ids, new Set(['sale1']), '2026-04-01', '2026-06-30');
  ok(tie.outputNotInReport === 180 && tie.outputRows.length === 1 && tie.outputRows[0].voucherId === 'bill1', 'a maintenance bill (no sale row): its output GST is reported as missing from GSTR');
  ok(tie.inputNotInReport === 9 && tie.inputRows[0].voucherId === 'jv1', 'ITC claimed by a journal is reported as missing');
  ok(!tie.outputRows.some((r) => ['setoff', 'paid', 'gone', 'pend', 'late', 'sale1'].includes(r.voucherId)), 'settlements, payments, cancelled, pending, out-of-period and counted vouchers are not flagged');
  const page = read('src/pages/GstSummary.tsx');
  ok(/gstLedgerTie\(tieVouchers, gstLedgerIds\(accounts\), counted, fromDate, toDate\)/.test(page) && /data-testid="gst-ledger-gap"/.test(page), 'GST Summary shows the ledger gap');
  ok(/x\.gstVoucherIds/.test(page) && /x\.taxVoucherIds/.test(page) && /v\.refId && docIds\.has\(v\.refId\)/.test(page), 'GST Summary counts a document main voucher, its tax journals and refId-linked vouchers');
}

// ── RPT-02: a sale / purchase voucher cannot be reversed or edited from Vouchers ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok(/const guardStockDocumentVoucher = /.test(dc) && /x\.gstVoucherIds \?\? \[\]\)\.includes\(id\)/.test(dc) && /x\.taxVoucherIds \?\? \[\]\)\.includes\(id\)/.test(dc), 'the guard covers the main voucher and the tax journals');
  ok(/if \(!opts\?\.engine && guardStockDocumentVoucher\(id, \{ hi: 'reverse', en: 'reversed' \}\)\) return null;/.test(dc), 'reverseVoucher refuses a live sale / purchase voucher');
  ok(/if \(!opts\?\.viaParent && guardStockDocumentVoucher\(id, \{ hi: 'बदला', en: 'changed' \}\)\) return false;/.test(dc), 'updateVoucher refuses it unless the parent screen edits it');
}

// ── RPT-03: 26Q — challan in the next quarter, no invented challan ──
{
  const soc = { tan: 'ABCD12345E', entityPan: 'ABCDE1234F', name: 'S', address: 'A', state: 'hr', pinCode: '1', phone: '1', email: 'e' };
  const E = (id, challanId, amt = 100) => ({ id, date: '2027-03-20', deducteePan: 'ABCDE1234F', deducteeName: id, deducteeType: 'firm', section: '194C', natureOfPayment: 'x', grossAmount: amt * 50, tdsRate: 2, tdsAmount: amt, quarter: 'Q4', financialYear: '2026-27', status: 'pending', challanId, createdAt: '' });
  const chMar = { id: 'c1', bsrCode: '1234567', challanDate: '2027-03-25', challanSerial: '1', amount: 100, quarter: 'Q4', financialYear: '2026-27', status: 'paid' };
  const chApr = { id: 'c2', bsrCode: '1234567', challanDate: '2027-04-07', challanSerial: '2', amount: 200, quarter: 'Q1', financialYear: '2027-28', status: 'paid' };
  const entries = [E('a', 'c1'), E('b', 'c2'), E('c', 'c2')];
  const lines = Q.generate26QText({ entries, challans: [chMar, chApr], society: soc, quarter: 'Q4', financialYear: '2026-27' }).split('\n');
  ok(lines.filter((l) => l.startsWith('DD|')).length === 3 && lines[0].split('|')[4] === '3', 'a deductee whose challan was deposited in April stays in the Q4 file (header 3, detail 3)');
  ok(lines.filter((l) => l.startsWith('CH|')).length === 2, 'the April challan is written for Q4');
  const withUnlinked = [...entries, E('d', undefined), E('e', 'missing')];
  ok(!/\|0000000\|/.test(Q.generate26QText({ entries: withUnlinked, challans: [chMar, chApr], society: soc, quarter: 'Q4', financialYear: '2026-27' })), 'no invented challan (BSR 0000000) is ever written');
  const errs = Q.validate26QQuarter(withUnlinked, [chMar, chApr], 'Q4', '2026-27');
  ok(errs.length === 1 && /^2 TDS entries have no deposited challan/.test(errs[0]), 'an unlinked entry, or one whose challan is missing, refuses the export');
  ok(Q.validate26QQuarter(entries, [chMar, chApr], 'Q4', '2026-27').length === 0, 'all linked → no refusal');
  const page = read('src/pages/TdsRegister.tsx');
  ok(/entriesFor26Q\(quarterEntries, activeChallans\)/.test(page) && /validate26QQuarter\(q26\.entries, q26\.challans, selectedQuarter, fy\)/.test(page), 'TDS Register passes all challans and refuses unlinked TDS');
}

// ── RPT-04: TDS Register ↔ TDS Payable ──
{
  const vs = [
    V('pur1', '2027-01-10', [['5101', 'Dr', 1000], ['2202', 'Cr', 10], ['2101', 'Cr', 990]]),
    V('jv', '2027-01-15', [['5401', 'Dr', 500], ['2202', 'Cr', 50], ['3301', 'Cr', 450]]),
    V('challan', '2027-02-07', [['2202', 'Dr', 60], ['3302-01', 'Cr', 60]]),
  ];
  const tie = T.tdsLedgerTie(vs, '2202', new Set(['pur1']), [{ id: 'm1', deducteeName: 'Typed row', date: '2027-02-01', tdsAmount: 75 }], '2027-01-01', '2027-03-31');
  ok(tie.ledgerNotInRegister === 50 && tie.ledgerRows.length === 1 && tie.ledgerRows[0].id === 'jv', 'a journal crediting TDS Payable with no register row is listed');
  ok(tie.registerNotInLedger === 75 && tie.registerRows[0].id === 'm1', 'a register row typed by hand (posts nothing) is listed');
  ok(T.tdsLedgerTie(vs, null, new Set(), [], '2027-01-01', '2027-03-31').ledgerRows.length === 0, 'no TDS head → no ledger rows (and no crash)');
  ok(JSON.stringify(T.quarterRange('2026-27', 'Q4')) === JSON.stringify({ from: '2027-01-01', to: '2027-03-31' }) && T.quarterRange('2026-27', 'Q1').from === '2026-04-01', 'quarter ranges');
  ok(/data-testid="tds-ledger-gap"/.test(read('src/pages/TdsRegister.tsx')), 'TDS Register shows the gap');
}

// ── RPT-05: schedule lines print the society's own account name ──
{
  const accounts = S.PACS_SOCIETY_ACCOUNTS.map((a) => ({ ...a }));
  const kcc = accounts.find((a) => a.id === '3303'), npa = accounts.find((a) => a.id === '3316');
  ok(!!kcc && /KCC/.test(kcc.name) && !!npa && /NPA/.test(npa.name), 'fixture: the PACS chart reuses 3303 (KCC) and 3316 (NPA)');
  const TB = [{ account: kcc, netBalance: 5000 }, { account: npa, netBalance: 700 }];
  const ctx = { trialBalance: TB, accounts, previousYearBalances: {}, netProfit: 0, grossProfit: 0, reserveFundPct: 25, totalIncome: 0, totalExpenses: 0, totalMembers: 0, activeMembers: 0, totalShareCapital: 0 };
  const items = F.resolveAllSchedules(F.getStateAuditFormat('hr'), ctx).flatMap((s) => s.items);
  const one = (id) => items.find((i) => i.source.kind === 'account' && i.source.accountIds.length === 1 && i.source.accountIds[0] === id);
  ok(one('3303')?.label === kcc.name && one('3303')?.currentYear === 5000, `3303 prints as "${one('3303')?.label}", not "Sundry Debtors"`);
  ok(one('3316')?.label === npa.name && one('3316')?.labelHi === npa.nameHi, `3316 prints as "${one('3316')?.label}", not "Stock in Transit"`);
}

// ── RPT-06: Federation "Deposits" ──
{
  const yes = ['Member Deposits', 'Fixed Deposits from Members', 'Member Savings Deposits', 'Recurring Deposits (RD)', 'सदस्य जमा', 'Pigmy Collection'];
  const no = ['Loan from DCCB/NABARD', 'Overdue Interest Reserve', 'Provision for Standard Assets', 'Charan Singh Gurdeep Singh Bani', 'Hafed Fertilizer Div (FD) A/c', 'HRDF Payable', 'Deposit Loan from DCCB', 'जमा ऋण (DCCB)'];
  ok(yes.every(D.isDepositLiabilityName), 'deposit ledgers are counted');
  ok(no.every((n) => !D.isDepositLiabilityName(n)), 'loans, provisions, reserves and party names are not (the old /deposit|fd|rd/ counted most of them)');
  const fed = read('src/pages/FederationReport.tsx');
  ok(/isDepositLiabilityName\(a\.name\)/.test(fed) && !/\/deposit\|fd\|rd\/i/.test(fed), 'Federation return uses the helper');
}

console.log(`statutory report guards (RPT-01…06): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
