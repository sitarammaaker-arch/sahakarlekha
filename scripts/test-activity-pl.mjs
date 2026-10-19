// Activity-wise Income & Expenditure (CM-PACS Phase 2).
//
// Guards: vouchers tagged costCentreId='act:<activity>' land in that activity's column, untagged / unknown
// tags in "common"; income = Cr−Dr, expense = Dr−Cr, in paise; only income/expense accounts count; the FY
// window is applied; column nets sum to the total. activityChoices puts the society's activities first and
// offers the rest. And the tag-on-edit guards (RULE 1): migration 127 re-issues edit_voucher (095) and
// save_pending_voucher (104) with ONLY the costCentreId changes (proved by re-deriving 127's bodies from
// 095/104), its down restores them byte-for-byte; the client sends the tag only when it changed and only
// once voucher_edit_capabilities() (127) answers — before that the edit would revert on refresh.
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


import { readFileSync, readdirSync } from 'node:fs';
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

// ── Tag on edit (RULE 1) ────────────────────────────────────────────────────────────────────────────
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mig = (f) => read(`../supabase/migrations/${f}`);
const slice = (src, a, b) => { const i = src.indexOf(a); const j = i < 0 ? -1 : src.indexOf(b, i); return j < 0 ? null : src.slice(i, j + b.length); };
const EV = ['CREATE OR REPLACE FUNCTION public.edit_voucher', '$function$\n;'];
const SP = ['create or replace function public.save_pending_voucher', '$$;'];
const sub = (s, a, b, n) => (s.split(a).length - 1 === n ? s.split(a).join(b) : null);
const up127 = mig('127_voucher_activity_tag_edit.sql'), down127 = mig('127_voucher_activity_tag_edit_down.sql');
const ev095 = slice(mig('095_edit_voucher_reversal_lock.sql'), ...EV), sp104 = slice(mig('104_save_pending_voucher.sql'), ...SP);
// 127's bodies = 095/104 + exactly these edits, nothing else.
let wantEv = ev095;
for (const [a, b, n] of [
  [`'memberId', 'lines', 'editHistory');`, `'memberId', 'lines', 'editHistory', 'costCentreId');`, 1],
  [`"editHistory" = v_new."editHistory"\n  where t.id = v_id;`, `"editHistory" = v_new."editHistory",\n    "costCentreId" = v_new."costCentreId"\n  where t.id = v_id;`, 1],
  [`v_cur."costCentreId"`, `v_new."costCentreId"`, 2],
]) wantEv = wantEv && sub(wantEv, a, b, n);
const wantSp = sp104 && sub(sp104, `"editHistory" = v_new."editHistory"\n    where t.id = v_id;`, `"editHistory" = v_new."editHistory",\n      "costCentreId" = v_new."costCentreId"\n    where t.id = v_id;`, 1);
ok(!!wantEv && slice(up127, ...EV) === wantEv, '127 edit_voucher = 095 + costCentreId (whitelist, vouchers UPDATE, lines/entries from v_new) — nothing else');
ok(!!wantSp && slice(up127, ...SP) === wantSp, '127 save_pending_voucher = 104 + costCentreId in the pending-edit UPDATE — nothing else');
ok(slice(down127, ...EV) === ev095 && slice(down127, ...SP) === sp104, '127 down restores the 095 / 104 bodies byte-for-byte');
ok(/create or replace function public\.voucher_edit_capabilities\(\)/.test(up127) && /drop function if exists public\.voucher_edit_capabilities\(\)/.test(down127),
  '127 adds the capability probe; its down drops it (the app re-locks the picker)');
ok(/values \('127', 'voucher_activity_tag_edit'\)/.test(up127) && /delete from public\.app_migrations where version = '127'/.test(down127), '127 ledger insert / down delete');
// No later migration redefines the two functions (else 127 would not be the live body).
const later = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(f => /^\d{3}_/.test(f) && f > '127_voucher_activity_tag_edit_down.sql' && f.endsWith('.sql'));
ok(later.every(f => !/function public\.(edit_voucher|save_pending_voucher)\(/i.test(mig(f))), `no migration after 127 redefines edit_voucher / save_pending_voucher (${later.join(', ') || 'none'})`);

// Client: the tag goes to the server only when changed, and only once 127 is live.
const vouchersSrc = read('../src/pages/Vouchers.tsx');
const updateCalls = vouchersSrc.split('updateVoucher(editId, {').slice(1).map(s => s.slice(0, s.indexOf('});')));
ok(updateCalls.length === 2, 'Vouchers.tsx has the two edit calls this guard inspects');
ok(updateCalls.every(c => c.includes('...editActivityField') && !/costCentreId:/.test(c)), 'both edit calls send the tag only through editActivityField');
ok(/const editActivityField = editActivity !== editActivityOrig \?/.test(vouchersSrc), 'editActivityField is empty unless the tag changed');
ok(/setEditActivityLocked\(!canEditVoucherActivity\(\)/.test(vouchersSrc), 'the edit picker is locked unless canEditVoucherActivity()');
const dc = read('../src/contexts/DataContext.tsx');
ok(dc.includes(`supabase.rpc('voucher_edit_capabilities')`), 'DataContext probes voucher_edit_capabilities (mig 127)');
ok(/tagChanged && postingServiceRef\.current && !activityTagEditableRef\.current\) \{/.test(dc), 'updateVoucher refuses a tag change through the posting service before 127');
ok((dc.match(/buildEditVoucherPayload\(updatedVoucher, \{ withActivityTag: tagChanged \}\)/g) ?? []).length === 2, 'edit_voucher + save_pending_voucher payloads carry the tag only when it changed');
const P = await import(abs('../src/lib/ledger/postVoucherClient.ts'));
const ev0 = { id: 'v1', type: 'journal', date: '2026-10-01', debitAccountId: '5701', creditAccountId: '3301', amount: 10, costCentreId: 'act:transport' };
ok(!('costCentreId' in P.buildEditVoucherPayload(ev0).p_voucher), 'payload without withActivityTag omits costCentreId');
ok(P.buildEditVoucherPayload(ev0, { withActivityTag: true }).p_voucher.costCentreId === 'act:transport', 'withActivityTag sends the tag');
ok(P.buildEditVoucherPayload({ ...ev0, costCentreId: undefined }, { withActivityTag: true }).p_voucher.costCentreId === '', "a cleared tag is sent as '' (undefined would be dropped)");

console.log(`\nactivity-pl: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
