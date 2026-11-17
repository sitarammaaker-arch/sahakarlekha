// Year-end and payroll-voucher P0s (audit 2026-11-17):
//   YE-03  — year-close vouchers cannot be edited / cancelled / reversed (app guard + migration 176).
//   PAY-01 — payroll-run vouchers cannot be edited / reversed from the Vouchers screen (app guard + migration 176).
//   YE-02  — the server's year close counts stock ledgers at any depth under 3400 (migration 177).
// The SQL of 176/177 was run end-to-end on Postgres (PGlite) while building (177: 300 in a nested ledger stayed
// 300 after the close; with 091 alone it became 600). This file pins the shape and the pure helper.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const noComments = (s) => s.replace(/--.*$/gm, '');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const S = await import(pathToFileURL(resolve(ROOT, 'src/lib/systemOwnedVoucher.ts')).href);

// ── pure helper ─────────────────────────────────────────────────────────────────────────────────────
ok(S.systemOwnedVoucherKind({ id: 'x', refType: 'fy.close' }) === 'year-close', 'the year-close sweep is system-owned');
ok(S.systemOwnedVoucherKind({ id: 'x', refType: 'fy.close.stock' }) === 'year-close', 'the closing-stock journal is system-owned');
ok(S.systemOwnedVoucherKind({ id: 'payrun-1f2e-accrual' }) === 'payroll-run' && S.systemOwnedVoucherKind({ id: 'payrun-1f2e-payment' }) === 'payroll-run', 'payroll-run vouchers are system-owned');
ok(S.systemOwnedVoucherKind({ id: 'payrun-1f2e', refType: 'sale' }) === null && S.systemOwnedVoucherKind({ id: 'v1', refType: 'fy.closed-books' }) === null, 'look-alikes are not');
ok(S.systemOwnedVoucherKind(null) === null && S.systemOwnedVoucherKind({ id: 'v1' }) === null, 'ordinary vouchers are not');
ok(/1208/.test(S.systemOwnedVoucherMessage('year-close', 'रद्द', true).description) && /Rollback/.test(S.systemOwnedVoucherMessage('payroll-run', 'बदला', true).description), 'messages explain why');

// ── app wiring ──────────────────────────────────────────────────────────────────────────────────────
const dc = read('src/contexts/DataContext.tsx');
const body = (start, end) => dc.slice(dc.indexOf(start), dc.indexOf(end, dc.indexOf(start)));
const upd = body('const updateVoucher = useCallback', 'if (guardFYLocked())');
ok(/guardSystemOwnedVoucher\(id, \{ hi: 'बदला', en: 'changed' \}\)/.test(upd), 'updateVoucher refuses system-owned vouchers (even viaParent)');
ok(/if \(guardSystemOwnedVoucher\(id, \{ hi: 'रद्द', en: 'cancelled' \}\)\) return false;/.test(dc), 'cancelVoucher refuses system-owned vouchers (even viaParent)');
ok(/if \(guardSystemOwnedVoucher\(id, \{ hi: 'reverse', en: 'reversed' \}\)\) return null;/.test(dc), 'reverseVoucher refuses system-owned vouchers');

// ── migration 176 ───────────────────────────────────────────────────────────────────────────────────
const m176 = noComments(read('supabase/migrations/176_system_owned_vouchers_immutable.sql'));
const d176 = read('supabase/migrations/176_system_owned_vouchers_immutable_down.sql');
ok(/before insert or update on public\.vouchers/.test(m176), '176: a trigger on vouchers');
ok(/when coalesce\(p_ref, ''\) = 'fy\.close' or coalesce\(p_ref, ''\) like 'fy\.close\.%' then 'year_close'/.test(m176), '176: both year-close vouchers are covered');
ok(/'\^payrun-\.\+-\(accrual\|payment\)\$'/.test(m176), '176: payroll-run vouchers are covered');
ok(/kind = 'year_close' and \(money_changed or new\."isDeleted" is distinct from old\."isDeleted"\)/.test(m176), '176: a year-close voucher cannot be cancelled');
ok(/kind = 'payroll_run' and money_changed/.test(m176) && !/kind = 'payroll_run' and \(money_changed or new\."isDeleted"/.test(m176), '176: payroll vouchers stay cancellable (pay-rollback cancels them through cancel_voucher)');
ok(/new\."reversedBy" is distinct from old\."reversedBy"/.test(m176) && /new\."reversalOf"/.test(m176), '176: reversal links are refused both ways');
ok(/current_setting\('sahakarlekha\.allow_system_voucher_change', true\)/.test(m176), '176: a deliberate repair by hand is possible');
ok(/revoke execute on function public\._refuse_system_voucher_change\(\) from public, anon, authenticated/.test(m176), '176: trigger function not client-callable');
ok(/drop trigger if exists refuse_system_voucher_change on public\.vouchers/.test(d176), '176 down drops the trigger');

// ── migration 177 ───────────────────────────────────────────────────────────────────────────────────
const m091 = read('supabase/migrations/091_close_financial_year.sql');
const m177 = read('supabase/migrations/177_close_fy_nested_stock.sql');
const d177 = read('supabase/migrations/177_close_fy_nested_stock_down.sql');
ok(/with recursive tree\(id\) as \(\s*select '3400'::text\s*union\s*select c\.id from public\.accounts c join tree on c\."parentId" = tree\.id where c\.society_id::text = v_sid\)/.test(m177), '177: stock ledgers are found at any depth under 3400');
ok(!/\(a\.id = '3400' or a\."parentId" = '3400'\)/.test(noComments(m177)), '177: the direct-children-only filter is gone');
const fn = (s) => s.slice(s.indexOf('create or replace function public.close_financial_year'), s.indexOf("grant  execute on function public.close_financial_year"));
const strip177 = fn(m177).replace(/\n\s*-- YE-02[^\n]*\n\s*and a\.id in \(with recursive[\s\S]*?select id from tree\);/, ` and (a.id = '3400' or a."parentId" = '3400');`);
ok(strip177.replace(/\s+/g, ' ') === fn(m091).replace(/\s+/g, ' '), '177: apart from the stock filter, the function is exactly 091');
ok(fn(d177).replace(/\s+/g, ' ') === fn(m091).replace(/\s+/g, ' '), '177 down restores 091 exactly');
ok(/grant  execute on function public\.close_financial_year\(text, text, bigint\) to authenticated/.test(m177), '177 keeps the grant');

console.log(`year-end + payroll voucher guards: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
