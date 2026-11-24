// Godown shortage / excess (HAFED Accounts Manual 1976, paras 9.19, 9.25, 10.20).
// Imports the REAL src/lib/godownShortage.ts via the "@/" loader.
// Run: node scripts/test-godown-shortage.mjs
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

const L = await import(abs('../src/lib/godownShortage.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── validateAdjustment ──
const v = (o) => L.validateAdjustment({ rate: 10, ...o }, false);
ok(v({ qty: 0, reason: 'damage' }) !== null, 'zero qty refused');
ok(v({ qty: -5 }) !== null, 'a reason is required');
ok(v({ qty: -5, reason: 'excess' }) !== null, 'excess does not fit a decrease');
ok(v({ qty: 5, reason: 'damage' }) !== null, 'damage does not fit an increase');
ok(v({ qty: 5, reason: 'shortageRecoverable', person: 'Ram' }) !== null, 'recoverable shortage needs a decrease');
ok(v({ qty: -5, reason: 'shortageReversal' }) !== null, 'reversal is not picked by hand');
ok(v({ qty: -5, reason: 'shortageRecoverable', person: '  ' }) !== null, 'recoverable shortage needs a person');
ok(v({ qty: -5, reason: 'shortageRecoverable', person: 'Ram', rate: 0 }) !== null, 'recoverable shortage needs a cost');
ok(v({ qty: -5, reason: 'shortageRecoverable', person: 'Ram' }) === null, 'valid recoverable shortage');
ok(v({ qty: -5, reason: 'normalLoss' }) === null, 'valid normal loss');
ok(v({ qty: 3, reason: 'excess' }) === null, 'valid excess');
ok(v({ qty: 3, reason: 'other' }) === null && v({ qty: -3, reason: 'other' }) === null, 'other fits both ways');

ok(L.shortageAmount(-3, 1283.3333) === 3850, 'amount rounded to paise: 3 × 1283.3333 = 3850.00');
ok(L.shortageAmount(-0.5, 10.005) === 5, 'half a unit');

// ── finding the heads ──
const chart = [
  { id: '3300', name: 'Current Assets', nameHi: '', type: 'asset', isGroup: true, openingBalance: 0, openingBalanceType: 'debit' },
  { id: '4100', name: 'Trading Income', nameHi: '', type: 'income', isGroup: true, openingBalance: 0, openingBalanceType: 'credit' },
  { id: '4101', name: 'Fertilizer Sales', nameHi: '', type: 'income', parentId: '4100', openingBalance: 0, openingBalanceType: 'credit' },
  { id: '5100', name: 'Direct Expenses', nameHi: '', type: 'expense', isGroup: true, openingBalance: 0, openingBalanceType: 'debit' },
  { id: '5101', name: 'Purchases', nameHi: '', type: 'expense', parentId: '5100', openingBalance: 0, openingBalanceType: 'debit' },
];
ok(L.currentAssetsParent(chart) === '3300', 'current assets = 3300');
ok(L.tradingIncomeParent(chart) === '4100', 'trading income = 4101\'s group');
ok(L.directExpenseParent(chart) === '5100', 'direct expense = 5101\'s group');
ok(L.findWriteOffAccount(chart) === null, 'no wastage head → create one');
ok(L.findWriteOffAccount([...chart, { id: '5108', name: 'Wastage', nameHi: '', type: 'expense', parentId: '5100', openingBalance: 0, openingBalanceType: 'debit' }])?.id === '5108', '5108 used when it is a ledger');
ok(L.findWriteOffAccount([...chart, { id: 'x', name: 'Godown Shortage', nameHi: '', type: 'expense', parentId: '5100', openingBalance: 0, openingBalanceType: 'debit' }])?.id === 'x', 'a head named shortage is used');
ok(L.findWriteOffAccount([...chart, { id: '5108', name: 'Wastage', nameHi: '', type: 'expense', isGroup: true, openingBalance: 0, openingBalanceType: 'debit' }]) === null, 'a GROUP 5108 is never posted to');

const G = { id: 'G', name: 'Shortage Recoverable', nameHi: 'स्टॉक घटत वसूली योग्य', type: 'asset', isGroup: true, parentId: '3300', openingBalance: 0, openingBalanceType: 'debit' };
const P1 = { id: 'P1', name: 'Ram Singh', nameHi: '', type: 'asset', parentId: 'G', openingBalance: 0, openingBalanceType: 'debit' };
const P2 = { id: 'P2', name: 'Shyam', nameHi: '', type: 'asset', parentId: 'G', openingBalance: 100, openingBalanceType: 'debit' };
const SBS = { id: 'S', name: 'Sales by Shortage', nameHi: 'घटत से बिक्री', type: 'income', parentId: '4100', openingBalance: 0, openingBalanceType: 'credit' };
const acc = [...chart, G, P1, P2, SBS];
ok(L.findShortageGroup(acc)?.id === 'G', 'group found by name');
ok(L.findPersonLedger(acc, 'G', '  ram   SINGH ')?.id === 'P1', 'person found ignoring case and spaces');
ok(L.findPersonLedger(acc, '3300', 'Ram Singh') === undefined, 'person only under the group');
ok(L.findSalesByShortage(acc)?.id === 'S', 'sales by shortage found');

// ── register ──
const mv = (o) => ({ id: o.id, date: o.date, itemId: 'I1', type: 'adjustment', qty: o.qty, rate: 10, amount: o.amount ?? Math.abs(o.qty) * 10, referenceNo: o.ref ?? '', narration: '', createdAt: '', ...o.extra });
const movements = [
  mv({ id: 'a', date: '2026-05-01', qty: -3, ref: 'JV-1', extra: { reason: 'shortageRecoverable', responsiblePerson: 'Ram Singh', godownId: 'GD1' } }),
  mv({ id: 'b', date: '2026-05-02', qty: -2, extra: { reason: 'normalLoss' } }),
  mv({ id: 'c', date: '2026-05-03', qty: 4, extra: { reason: 'excess' } }),
  mv({ id: 'd', date: '2026-05-04', qty: -1 }),                                   // old manual adjustment, no reason
  mv({ id: 'e', date: '2026-05-05', qty: -5, ref: 'TRF/1' }),                      // transfer leg — not in the register
  mv({ id: 'f', date: '2026-05-05', qty: 2, ref: 'SR/1', amount: 20 }),            // return — not in the register
  mv({ id: 'g', date: '2026-05-06', qty: -6, ref: 'JV-2', extra: { reason: 'shortageRecoverable', responsiblePerson: 'Shyam' } }),
  mv({ id: 'h', date: '2026-05-07', qty: 6, ref: 'JV-2', extra: { reason: 'shortageReversal', responsiblePerson: 'Shyam' } }),
  { ...mv({ id: 'z', date: '2026-04-01', qty: -1, extra: { reason: 'damage' } }), type: 'sale' },   // not an adjustment
];
const vouchers = [
  { id: 'v1', voucherNo: 'JV-1', type: 'journal', date: '2026-05-01', debitAccountId: 'P1', creditAccountId: 'S', amount: 30, narration: '', createdAt: '', createdBy: '' },
  { id: 'v2', voucherNo: 'JV-2', type: 'journal', date: '2026-05-06', debitAccountId: 'P2', creditAccountId: 'S', amount: 60, narration: '', createdAt: '', createdBy: '', isDeleted: true },
  { id: 'v3', voucherNo: 'RV-1', type: 'receipt', date: '2026-05-10', debitAccountId: '3301', creditAccountId: 'P1', amount: 10, narration: '', createdAt: '', createdBy: '' },
  { id: 'v4', voucherNo: 'RV-2', type: 'receipt', date: '2026-05-11', debitAccountId: '3301', creditAccountId: 'P1', amount: 5, narration: '', createdAt: '', createdBy: '', approvalStatus: 'pending' },
  { id: 'v5', voucherNo: 'JV-3', type: 'journal', date: '2026-06-01', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdAt: '', createdBy: '',
    lines: [{ id: 'l1', accountId: '5108', type: 'Dr', amount: 20 }, { id: 'l2', accountId: 'P1', type: 'Cr', amount: 20 }] },
];
const reg = L.buildShortageRegister({ movements, stockItems: [{ id: 'I1', name: 'Urea', unit: 'bag' }], godowns: [{ id: 'GD1', name: 'Main' }], vouchers, accounts: acc });
ok(reg.rows.length === 6, `6 manual rows (got ${reg.rows.length})`);
ok(!reg.rows.some(r => r.id === 'e' || r.id === 'f' || r.id === 'z'), 'transfer, return and non-adjustment left out');
const ra = reg.rows.find(r => r.id === 'a');
ok(ra.godownName === 'Main' && ra.person === 'Ram Singh' && ra.voucherNo === 'JV-1' && ra.value === 30 && !ra.reversed, 'recoverable row carries godown, person, voucher, value');
ok(reg.rows.find(r => r.id === 'g').reversed === true, 'a reversed shortage is marked');
ok(reg.rows.find(r => r.id === 'd').reason === undefined, 'an old adjustment shows with no reason');
ok(reg.totals.decreaseValue === 60, `decrease = 30 + 20 + 10 (reversed one left out), got ${reg.totals.decreaseValue}`);
ok(reg.totals.increaseValue === 40, `increase = excess 40 (reversal left out), got ${reg.totals.increaseValue}`);
ok(reg.totals.recoverableValue === 30, 'recoverable = 30');
const p1 = reg.persons.find(p => p.accountId === 'P1');
ok(p1 && p1.booked === 30 && p1.cleared === 30 && p1.outstanding === 0, `Ram: booked 30, cleared 10 receipt + 20 write-off (pending receipt ignored) → 0; got ${JSON.stringify(p1)}`);
const p2 = reg.persons.find(p => p.accountId === 'P2');
ok(p2 && p2.booked === 100 && p2.outstanding === 100, 'Shyam: the cancelled voucher does not count; opening 100 does');
ok(reg.totals.outstanding === 100, 'total outstanding 100');

const reg2 = L.buildShortageRegister({ movements, stockItems: [], godowns: [], vouchers, accounts: acc, from: '2026-05-02', to: '2026-05-10' });
ok(reg2.rows.every(r => r.date >= '2026-05-02' && r.date <= '2026-05-10'), 'date range filters the rows');
ok(reg2.persons.find(p => p.accountId === 'P1').outstanding === 20, 'dues as at the end date (write-off on 06-01 not yet)');
ok(L.buildShortageRegister({ movements: [], stockItems: [], godowns: [], vouchers, accounts: chart }).persons.length === 0, 'no group → no persons');

ok(L.reasonLabel(undefined, true) === 'कारण दर्ज नहीं' && L.reasonLabel('damage', false).startsWith('Damage'), 'labels');

console.log(`\nGodown shortage: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
