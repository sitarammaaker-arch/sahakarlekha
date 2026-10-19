// Activity-wise Income & Expenditure (CM-PACS Phase 2).
//
// Guards: vouchers tagged costCentreId='act:<activity>' land in that activity's column, untagged / unknown
// tags in "common"; income = Cr−Dr, expense = Dr−Cr, in paise; only income/expense accounts count; the FY
// window is applied; column nets sum to the total. activityChoices puts the society's activities first and
// offers the rest. And a source guard: the voucher EDIT path must not send costCentreId while the server's
// edit_voucher (latest: migration 095) ignores it — the edit would show locally and revert on refresh (RULE 1).
//
// Run: node scripts/test-activity-pl.mjs   (npm run test:activity-pl)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;


import { readFileSync } from 'node:fs';
const A = await import(abs('../src/lib/reports/activityPL.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const accounts = [
  { id: '4501', name: 'Freight Income', type: 'income' },
  { id: '4208', name: 'Service Charges', type: 'income' },
  { id: '5701', name: 'Diesel', type: 'expense' },
  { id: '5301', name: 'Office', type: 'expense' },
  { id: '3301', name: 'Cash', type: 'asset' },
];
const v = (id, date, dr, cr, amount, tag) => ({ id, date, type: 'journal', debitAccountId: dr, creditAccountId: cr, amount, ...(tag !== undefined ? { costCentreId: tag } : {}) });
const vouchers = [
  v('a', '2026-05-01', '3301', '4501', 1000.5, A.activityTag('transport')),
  v('b', '2026-05-02', '5701', '3301', 400.25, A.activityTag('transport')),
  v('c', '2026-05-03', '3301', '4208', 300, A.activityTag('common_service_centre')),
  v('d', '2026-05-04', '5301', '3301', 100),                       // untagged → common
  v('e', '2026-05-05', '5301', '3301', 50, 'act:not_a_code'),       // unknown tag → common
  v('f', '2026-05-06', '5301', '3301', 20, 'wo-123'),               // some other dimension → common
  v('g', '2025-03-31', '3301', '4501', 9999, A.activityTag('transport')), // previous FY
  v('h', '2026-05-07', '4501', '3301', 0.5, A.activityTag('transport')),  // freight refund (Dr income)
];
const r = A.computeActivityPL({ vouchers, accounts, from: '2026-04-01', to: '2027-03-31' });

ok(A.activityOfTag('act:transport') === 'transport' && A.activityOfTag('act:nope') === null && A.activityOfTag('transport') === null && A.activityOfTag(undefined) === null, 'tag parsing: only act:<known code>');
ok(JSON.stringify(r.columns) === JSON.stringify(['transport', 'common_service_centre', A.UNALLOCATED]), `columns in catalog order, common last (got ${r.columns})`);
ok(r.income.transport === 100000 && r.expense.transport === 40025 && r.net.transport === 59975, 'transport: income 1000.50 − 0.50 refund, diesel 400.25 → net 599.75 (paise)');
ok(r.income.common_service_centre === 30000 && r.net.common_service_centre === 30000, 'CSC: service charges 300');
ok(r.expense[A.UNALLOCATED] === 17000, 'untagged + unknown tag + other dimension → common (100+50+20)');
ok(!r.rows.some(x => x.accountId === '3301'), 'asset accounts never appear');
ok(r.totalNet === Object.values(r.net).reduce((s, x) => s + x, 0) && r.totalNet === 59975 + 30000 - 17000, 'column nets sum to the total');
ok(r.rows.every(x => x.total === Object.values(x.byColumn).reduce((s, y) => s + y, 0)), 'each row total = sum of its columns');
ok(r.rows.findIndex(x => x.kind === 'expense') > r.rows.findLastIndex(x => x.kind === 'income'), 'income rows before expense rows');
ok(A.computeActivityPL({ vouchers, accounts, from: '2026-04-01', to: '2027-03-31' }).totalIncome === 100000 + 30000, 'previous-FY voucher excluded by the window');
ok(A.computeActivityPL({ vouchers: [], accounts }).columns.length === 0, 'no vouchers → no columns');

const multi = A.activityChoices([], 'multipurpose');
ok(multi.primary.some(a => a.code === 'transport') && multi.primary.some(a => a.code === 'credit_short_term'), 'multipurpose: inferred activities (incl. transport) are primary');
ok(multi.others.some(a => a.code === 'common_service_centre') && multi.others.some(a => a.code === 'warehousing'), 'CSC / warehousing still offered under others');
ok(multi.primary.length + multi.others.length === new Set([...multi.primary, ...multi.others].map(a => a.code)).size, 'no activity offered twice');
const decl = A.activityChoices(['common_service_centre', 'agri_input_retail'], 'multipurpose');
ok(decl.primary.map(a => a.code).join() === 'agri_input_retail,common_service_centre', 'declared activities replace the inferred ones, catalog order');

// Source guard (RULE 1): the edit path must not send the tag while edit_voucher ignores it.
const sql = readFileSync(new URL('../supabase/migrations/095_edit_voucher_reversal_lock.sql', import.meta.url), 'utf8');
const editKeys = /where key in \(([^)]*)\)/.exec(sql)?.[1] ?? '';
const vouchersSrc = readFileSync(new URL('../src/pages/Vouchers.tsx', import.meta.url), 'utf8');
const updateCalls = vouchersSrc.split('updateVoucher(editId, {').slice(1).map(s => s.slice(0, s.indexOf('});')));
ok(updateCalls.length === 2, 'Vouchers.tsx has the two edit calls this guard inspects');
ok(editKeys.includes('costCentreId') || updateCalls.every(c => !/costCentreId|activity/i.test(c)),
  'voucher edit does not send the activity tag (edit_voucher 095 ignores costCentreId) — extend edit_voucher first');

console.log(`\nactivity-pl: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
