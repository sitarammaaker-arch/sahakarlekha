// LIVE / NEW batch (product audit 2026-11-17): NEW-08 loan toast after the save, NEW-09 plan_allows server-only,
// NEW-10 paged TDS / bank-reconciliation loads, LIVE-02 voucher-number field, LIVE-03 cancel dialog names the voucher,
// LIVE-04 glossary strip language, LIVE-06 why Save is disabled, LIVE-07 ledger-head code, LIVE-08 ₹ in the ledger,
// LIVE-09 a lock date older than every voucher is called out, LIVE-10 feedback button on a phone.
// NEW-05 (budget sign, RPT-21/22) and NEW-06 (deposit undo, DEP-01) were already fixed; NEW-07's code no longer exists.
// Run: node scripts/test-live-new-batch.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountDataProvider } from './lib/provider-harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };
const qerr = console.error; console.error = () => {};

// ── NEW-08 on the real provider: onSaved only after the write lands ──
{
  const h = await mountDataProvider({ seed: { loans: [{ id: 'l1', loanNo: 'LN/1', memberId: 'm1', memberName: 'Ram', amount: 1000, purpose: 'Crop', status: 'active', society_id: 'SOC-H' }] } });
  const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
  let saved = 0, ret;
  h.respond((q) => (q.table === 'loans' && q.op === 'update' ? { data: null, error: { message: 'refused' } } : undefined));
  await run(() => { ret = h.ctx().updateLoan('l1', { purpose: 'Dairy' }, { onSaved: () => { saved++; } }); });
  ok(ret === true && saved === 0 && h.destructive().length === 1, 'NEW-08: a refused loan edit never calls onSaved (no "Loan updated" over the red toast)');
  h.reset();
  await run(() => { ret = h.ctx().updateLoan('l1', { purpose: 'Dairy' }, { onSaved: () => { saved++; } }); });
  ok(ret === true && saved === 1, 'NEW-08: an accepted loan edit calls onSaved once');
  const pg = read('src/pages/LoanRegister.tsx');
  ok(pg.includes("onSaved: () => toast({ title: hi ? 'ऋण अपडेट किया गया' : 'Loan updated' }),") && !/\}\);\n\s*toast\(\{ title: hi \? 'ऋण अपडेट किया गया'/.test(pg), 'NEW-08: the page toasts "Loan updated" only from onSaved');
}
console.error = qerr;

// ── NEW-09 ──
{
  const m = read('supabase/migrations/193_plan_allows_server_only.sql');
  ok(m.includes('revoke execute on function public.plan_allows(text, text) from authenticated;') && /values \('193', /.test(m), 'NEW-09: 193 removes authenticated EXECUTE on plan_allows and registers itself');
  ok(read('supabase/migrations/193_plan_allows_server_only_down.sql').includes('grant execute on function public.plan_allows(text, text) to authenticated;'), 'NEW-09: down restores the grant');
}

// ── NEW-10 ──
{
  const t = read('src/pages/TdsRegister.tsx');
  ok(t.includes("fetchAllPaged<TdsEntry>('tds_entries', user.societyId)") && t.includes("fetchAllPaged<TdsChallan>('tds_challans', user.societyId)") && t.includes("fetchAllPaged<TdsChallanLink>('tds_challan_links', user.societyId, ['entryId'])"), 'NEW-10: TDS entries, challans and links page past 1,000 rows (links ordered by their unique entryId)');
  ok(!/supabase\.from\('tds_(entries|challans|challan_links)'\)\.select\('\*'\)/.test(t), 'NEW-10: no plain capped select left in the TDS register');
  ok(read('src/pages/BankReconciliation.tsx').includes("fetchAllPaged<BankReconciliationRecord>('bank_reconciliations', user.societyId)"), 'NEW-10: bank reconciliations page too');
}

// ── LIVE items ──
{
  const v = read('src/pages/Vouchers.tsx');
  ok(!v.includes('getNextVoucherNo(') && (v.match(/placeholder=\{autoNoLabel\}/g) || []).length === 2 && v.includes("const autoNoLabel = language === 'hi' ? 'सेव पर मिलेगा' : 'Auto on save';"), 'LIVE-02: the number field no longer shows a local guess — "number on save" in both forms');
  ok(v.includes('const cv = vouchers.find(v => v.id === cancelId);') && v.includes('{cv.voucherNo}</span>') && v.includes('{fmtDate(cv.date)}'), 'LIVE-03: the cancel dialog shows the voucher number, date and amount');
  ok(v.includes("To save, make Dr and Cr equal") && v.includes("To save, fill an account and amount in at least one Dr and one Cr line."), 'LIVE-06: the expert form says why Save is disabled');
  ok(read('src/components/glossary/ModuleGlossaryBar.tsx').includes('label={L(t.hindiName || t.englishName, t.englishName || t.hindiName)}'), 'LIVE-04: glossary terms follow the screen language');
  ok(read('src/pages/LedgerHeads.tsx').includes("{editAccount ? (accountCode(editAccount) || '—') : ''}") && !read('src/pages/LedgerHeads.tsx').includes('{editAccount?.id}</span>'), 'LIVE-07: the edit dialog shows the readable code, not the UUID');
  const l = read('src/pages/Ledger.tsx');
  ok(!l.includes('Rs. {') && (l.match(/₹\{fmt\(/g) || []).length >= 8, 'LIVE-08: the ledger uses ₹ like every other screen');
  const s = read('src/pages/SocietySetup.tsx');
  ok(s.includes('const earliestVoucherDate = useMemo(') && s.includes('society.periodLockDate < earliestVoucherDate') && s.includes('the lock does not stop any entry yet'), 'LIVE-09: a lock date before the earliest voucher is called out');
  ok(read('src/components/FeedbackFab.tsx').includes('fixed bottom-3 right-3 sm:bottom-5 sm:right-5') && read('src/components/FeedbackFab.tsx').includes('p-2.5 sm:px-4 sm:py-3'), 'LIVE-10: smaller corner button on a phone');
}

console.log(`LIVE/NEW batch: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
