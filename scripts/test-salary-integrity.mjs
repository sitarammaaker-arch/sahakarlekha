// Salary audit fixes (2026-11-11): the seven defects found in the salary path, each pinned.
//   1 salary TDS (192) out of the 26Q file           2 both salary vouchers guarded on the Vouchers page
//   3 never PAID without the payment voucher          4 never a slip without its accrual voucher
//   5 no "Credit" payment                             6 no delete of a slip whose TDS is on a challan
//   7 reminders / digest skip deleted employees (migration 162)
// Run: node scripts/test-salary-integrity.mjs   (npm run test:salary-integrity)
import { readFileSync } from 'node:fs';
import { entriesFor26Q, SALARY_TDS_SECTION } from '../src/lib/tds26q.ts';
import { checkSlipsAgainstLedger } from '../src/lib/statutoryReconciliation.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');

// ── 1. 26Q leaves salary TDS out ─────────────────────────────────────────────
{
  const E = (id, section, challanId) => ({ id, section, challanId, tdsAmount: 100, quarter: 'Q3', financialYear: '2026-27' });
  const C = (id) => ({ id, quarter: 'Q3', financialYear: '2026-27', amount: 100, status: 'paid' });
  const entries = [E('sal-1', '192', 'c-sal'), E('sal-2', '192'), E('pur-1', '194Q', 'c-mix'), E('sal-3', '192', 'c-mix'), E('pur-2', '194C', 'c-pur')];
  const challans = [C('c-sal'), C('c-mix'), C('c-pur'), C('c-free')];
  const r = entriesFor26Q(entries, challans);
  ok(SALARY_TDS_SECTION === '192', 'salary TDS is section 192');
  ok(r.entries.map((e) => e.id).join() === 'pur-1,pur-2', 'no section-192 entry reaches 26Q');
  ok(r.challans.map((c) => c.id).join() === 'c-mix,c-pur,c-free', 'a salary-only challan is left out; mixed and unlinked challans stay');
  ok(entriesFor26Q([E('sal-9', '192')], []).entries.length === 0, 'a quarter with only salary TDS has nothing for 26Q');
  const tr = read('src/pages/TdsRegister.tsx');
  const h = tr.slice(tr.indexOf('const handleExport26Q = () => {'), tr.indexOf('download26Q(text'));
  ok(/const q26 = entriesFor26Q\(quarterEntries, quarterChallans\);/.test(h) && /validate26QData\(q26\.entries, q26\.challans, society\)/.test(h) && /entries: q26\.entries,\s+challans: q26\.challans,/.test(h), '26Q export validates and writes only the 26Q set');
  ok(!/validate26QData\(quarterEntries/.test(tr) && !/entries: quarterEntries,/.test(tr), 'the unfiltered quarter is never passed to 26Q');
}

const dc = read('src/contexts/DataContext.tsx');
const fn = (name) => { const a = dc.indexOf(`const ${name} = useCallback(`); return a < 0 ? '' : dc.slice(a, dc.indexOf('\n  }, [', a)); };

// ── 2. Both salary vouchers are owned by the slip ────────────────────────────
{
  ok(/const guardSalaryVoucher = \(id: string, what: string\): boolean => \{\s+const slip = salaryRecordsRef\.current\.find\(r => r\.voucherId === id \|\| r\.accrualVoucherId === id\);/.test(dc), 'guard knows the payment AND the accrual voucher');
  ok(/if \(!opts\?\.viaParent && guardSalaryVoucher\(id, 'बदला'\)\) return false;/.test(fn('updateVoucher')), 'edit from the Vouchers page refused');
  ok(/if \(!opts\?\.viaParent && guardSalaryVoucher\(id, 'रद्द'\)\) return false;/.test(fn('cancelVoucher')), 'cancel from the Vouchers page refused');
  ok(/if \(guardSalaryVoucher\(id, 'reverse'\)\) return null;/.test(fn('reverseVoucher')), 'reverse refused');
  ok(!/linkedSalary = salaryRecordsRef\.current\.find\(r => r\.voucherId === id\)/.test(dc), 'the old payment-only check is gone');
  const up = fn('updateSalaryRecord');
  ok((up.match(/\}, \{ viaParent: true \}\)\) return false;/g) || []).length === 2, "the Salary page's own two re-syncs pass the guard (viaParent)");
  ok(/updateVoucher: \(id: string, data: [^\n]*, opts\?: \{ viaParent\?: boolean \}\) => boolean;/.test(dc), 'updateVoucher takes viaParent in its type');
}

// ── 3. Never PAID without the payment voucher; 5. no Credit ──────────────────
{
  const up = fn('updateSalaryRecord');
  ok(/useCallback\(\(id: string, data: Partial<SalaryRecord>\): boolean =>/.test(dc) && /updateSalaryRecord: \(id: string, data: Partial<SalaryRecord>\) => boolean;/.test(dc), 'updateSalaryRecord tells the page whether it saved');
  const b = up.slice(up.indexOf("if (merged.paymentMode === 'credit')"), up.indexOf('merged.voucherId = newV.id;'));
  ok(b.length > 0 && /return false;/.test(b) && /if \(!newV\.id\) \{[\s\S]*return false;\s*\}/.test(b), 'a refused payment voucher → slip stays unpaid (return false before any state change)');
  ok(up.indexOf("if (merged.paymentMode === 'credit')") < up.indexOf('const newV = addVoucher('), 'Credit refused before any voucher');
  ok(/return true;\s*$/.test(up), 'a saved edit returns true');
  ok(/if \(!oldRecord\.voucherId && merged\.voucherId\) cancelLinkedVouchers\(\[merged\.voucherId\]/.test(up), 'a failed cloud save cancels the payment voucher it made (RULE 1/3)');
  const sm = read('src/pages/SalaryManagement.tsx');
  const dlg = sm.slice(sm.indexOf('<Select value={markPaidMode}'), sm.indexOf('</Select>', sm.indexOf('<Select value={markPaidMode}')));
  ok(dlg.length > 0 && !/<SelectItem value="credit">/.test(dlg), 'no Credit choice in the Mark Paid dialog');
  ok(/setMarkPaidMode\(record\.paymentMode === 'credit' \? 'bank' : record\.paymentMode\)/.test(sm), 'an old Credit row opens the dialog on Bank');
  ok(/const ok = updateSalaryRecord\(markPaidId, [^\n]*\);\s+if \(!ok\) return;/.test(sm), 'Mark Paid toasts success only when saved');
}

// ── 4. Never a slip without its accrual ──────────────────────────────────────
{
  const add = fn('addSalaryRecord');
  const netGate = add.indexOf('if (!((base.netSalary || 0) > 0)) {');
  const accGate = add.indexOf('if (!accrualVoucherId) {');
  const firstState = add.search(/salaryRecordsRef\.current = \[/);
  ok(netGate > 0 && netGate < firstState, 'net ≤ 0 refused before any state change');
  ok(accGate > 0 && accGate < firstState && /return \{ \.\.\.data, id: '' \} as unknown as SalaryRecord;/.test(add.slice(accGate, firstState)), 'no accrual voucher → no slip');
  ok(!/accrual best-effort; record still saves/.test(add), 'the "save anyway" path is gone');
  ok(/if \(record\.accrualVoucherId\) cancelLinkedVouchers\(\[record\.accrualVoucherId\]/.test(add), 'a failed cloud save cancels its accrual voucher');
  const sm = read('src/pages/SalaryManagement.tsx');
  ok(/const saved = addSalaryRecord\(salaryRecordFromRow\(row\)\);\s+if \(!saved\.id\) return;/.test(sm), 'Process marks a row done only when saved');
  ok(/if \(addSalaryRecord\(salaryRecordFromRow\(row\)\)\.id\) done\.add\(row\.employee\.id\)/.test(sm) && /done\.has\(r\.employee\.id\) \? \{ \.\.\.r, processed: true \} : r/.test(sm), 'Process All marks only the saved rows');
}

// ── 6. Challan-linked slip is not deleted ────────────────────────────────────
{
  const a = dc.indexOf('const deleteSalaryRecord = useCallback(');
  const del = dc.slice(a, dc.indexOf('  // ── Suppliers', a));
  const local = del.indexOf('storage.getTdsChallanLinks().some(l => l.entryId === tdsEntryId)');
  const server = del.indexOf(".from('tds_challan_links').select('entryId')");
  const remove = del.indexOf('const removeSlip = () => {');
  const firstState = del.indexOf('setSalaryRecordsState(prev => prev.filter(r => r.id !== id));');
  ok(/const tdsEntryId = `sal-\$\{id\}`;/.test(del), 'the TDS Register entry id of a slip');
  ok(local > 0 && server > local && remove > server && firstState > remove, 'cached and server link checks run before the slip is removed');
  ok(/if \(!linkErr && linked && linked\.length > 0\) \{ challanLinkedToast\(\); return; \}/.test(del), 'a linked slip is refused with a toast');
}

// ── 7. Migration 162 ─────────────────────────────────────────────────────────
{
  const up = read('supabase/migrations/162_employee_reminders_skip_deleted.sql');
  const down = read('supabase/migrations/162_employee_reminders_skip_deleted_down.sql');
  const OLD = "exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active'),";
  const NEW = "exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active' and not coalesce(e.\"isDeleted\", false)),";
  const fns = (sql) => [...sql.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/g)].map((m) => m[0]);
  const u = fns(up), d = fns(down);
  ok(u.length === 2 && d.length === 2, 'both functions in up and down');
  ok(u.every((f) => f.includes(NEW) && !f.includes(OLD)) && d.every((f) => f.includes(OLD)), 'up filters deleted employees; down is the old body');
  ok(u.map((f) => f.replace(NEW, OLD)).join('\n') === d.join('\n'), 'up = down with only the isDeleted filter added');
  ok(/compliance_reminder_targets\(\)/.test(u[0]) && /weekly_digest_targets\(p_day date\)/.test(u[1]), 'the reminder and the digest function');
  ok(/values \('162', 'employee_reminders_skip_deleted'\)/.test(code(up)) && /delete from public\.app_migrations where version = '162'/.test(down), '162 ledger insert / down delete');
}

// ── 8. Follow-up risks (2026-11-11, second pass) ─────────────────────────────
{
  const add = fn('addSalaryRecord');
  ok(/const dropSlipWithoutAccrual = \(\) => \{/.test(add) && /\}, \{ onFailed: dropSlipWithoutAccrual \}\);/.test(add), 'a server refusal of the accrual later removes the slip too');
  ok(/if \(!salaryRecordsRef\.current\.some\(r => r\.id === base\.id\)\) return;/.test(add) && /from\('salary_records'\)\.delete\(\)\.eq\('id', base\.id\)/.test(add), '…only if the slip is still there, and from the cloud as well');
  const up = fn('updateSalaryRecord');
  ok(/onFailed: \(\) => \{[\s\S]*isPaid: false, paidDate: undefined, voucherId: undefined/.test(up), 'a server refusal of the payment later makes the slip unpaid again');
  ok(/const nextPaid = data\.isPaid \?\? oldRecord\.isPaid;/.test(up) && /if \(oldRecord\.isPaid && !nextPaid && oldRecord\.voucherId\) \{/.test(up) && !/!data\.isPaid/.test(up), 'an edit that omits isPaid never un-pays a slip');
  ok(/const bankChanged = data\.bankAccountId !== undefined && data\.bankAccountId !== oldRecord\.bankAccountId;/.test(up) && /if \(amountChanged \|\| dateChanged \|\| modeChanged \|\| bankChanged\) \{/.test(up), 'changing only the paying bank re-syncs the payment voucher');

  // Slip ↔ ledger check
  const V = (id, lines, isDeleted = false) => ({ id, voucherNo: id, isDeleted, lines });
  const L = (accountId, type, amount) => ({ accountId, type, amount });
  const vouchers = [
    V('a1', [L('5201', 'Dr', 11300), L('2103', 'Cr', 8800), L('2203', 'Cr', 2400), L('2204', 'Cr', 100)]),
    V('a2', [L('5201', 'Dr', 1000), L('2103', 'Cr', 1000)]),
    V('a3', [L('5201', 'Dr', 1000), L('2103', 'Cr', 1000)], true),
  ];
  const slip = (id, accrualVoucherId, pf = 0, esi = 0) => ({ id, slipNo: id, accrualVoucherId, pfEmployee: pf / 2, pfEmployer: pf / 2, esiEmployee: esi / 2, esiEmployer: esi / 2 });
  const issues = checkSlipsAgainstLedger([slip('ok', 'a1', 2400, 100), slip('pf', 'a2', 1200), slip('gone', 'a3'), slip('legacy', undefined), slip('nov', undefined, 600), slip('miss', 'zz')], vouchers);
  const k = (id) => issues.filter((i) => i.slipId === id).map((i) => i.kind).join();
  ok(k('ok') === '', 'a slip that matches its voucher raises nothing');
  ok(k('pf') === 'pf_mismatch' && issues.find((i) => i.slipId === 'pf').ledger === 0, 'PF on the slip but not in 2203 → pf_mismatch');
  ok(k('gone') === 'voucher_cancelled', 'cancelled accrual voucher is reported');
  ok(k('legacy') === '', 'an old net-only slip without an accrual is not an error');
  ok(k('nov') === 'no_voucher' && k('miss') === 'no_voucher', 'PF/ESI with no (or a missing) accrual voucher is reported');
  const sr = read('src/pages/StatutoryReconciliation.tsx');
  ok(/checkSlipsAgainstLedger\(salaryRecords\.filter\(r => r\.month === period\), vouchers\)/.test(sr), 'the page runs the check for the chosen month');

  // Register export
  const sm = read('src/pages/SalaryManagement.tsx');
  const reg = sm.slice(sm.indexOf('const salaryRegisterRows = () => {'), sm.indexOf('const handleSalaryCSV'));
  ok(/filteredHistory\.map\(/.test(reg) && !/salaryRecords\.map\(/.test(reg), 'the register export follows the on-screen filters');
  ok(['Gross', 'PF (Emp)', 'ESI (Emp)', 'PT', 'TDS', 'Total Deductions', 'Net Salary', 'PF (Employer)', 'ESI (Employer)'].every((h) => reg.includes(`'${h}'`)), 'and carries the full breakdown');

  // Export entity = real table
  const ent = read('src/lib/export/entities/payroll.ts');
  const blk = ent.slice(ent.indexOf('const salaryRecord'), ent.indexOf('const worker'));
  const cols = [...blk.matchAll(/(?:c|money|internal)\('([a-zA-Z]+)'/g)].map((m) => m[1]);
  const real = ['id', 'slipNo', 'employeeId', 'month', 'basicSalary', 'allowances', 'deductions', 'netSalary', 'paymentMode', 'voucherId', 'isPaid', 'paidDate', 'createdAt', 'accrualVoucherId', 'pfEmployee', 'pfEmployer', 'esiEmployee', 'esiEmployer', 'pt', 'tds', 'bankAccountId'];
  ok(cols.every((c) => real.includes(c)) && real.every((r) => cols.includes(r)), `salary export columns = the salary_records columns (${cols.filter((c) => !real.includes(c)).join(',') || 'ok'})`);
}

console.log(`salary-integrity: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
