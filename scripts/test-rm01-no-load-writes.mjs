// RM-01 (S0 emergency safety fix) — loading the app must NEVER write accounting data.
//
// Part A reads src/contexts/DataContext.tsx and proves the society-load function (the ONE path behind
// login, refresh/F5, society switch, hydration and the offline/localStorage fallback) contains no
// database write and no voucher-creating call. Part B runs the REAL phantom-voucher diagnostics
// (src/lib/diagnostics/phantomVouchers.ts) on fixtures: it reports, never repairs, and never mutates.
// Part C checks the sale/purchase guards and that the explicit addMember posting path still exists.
// Run: node scripts/test-rm01-no-load-writes.mjs (exit 1 on any failure).
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/** Body of the first `{ … }` block that starts at or after `from` (brace-matched, strings/comments naive-safe enough for this file). */
function blockAfter(src, from) {
  const open = src.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error('unbalanced block');
}
/** Strip // line comments and /* block comments *\/ so prose in comments cannot satisfy or break a check. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ── Part A: the load path writes nothing ────────────────────────────────────────────────────────
const loadStart = SRC.indexOf('const loadFromSupabase = async () =>');
ok(loadStart > 0, 'found the society-load function (loadFromSupabase)');
const LOAD = code(blockAfter(SRC, loadStart));

const WRITE_PATTERNS = [
  [/\.upsert\s*\(/, '.upsert('],
  [/\.insert\s*\(/, '.insert('],
  [/\.update\s*\(/, '.update('],
  [/\.delete\s*\(/, '.delete('],
  [/\baddVoucher\s*\(/, 'addVoucher('],
  [/\bpersistVoucher\s*\(/, 'persistVoucher('],
  [/\bpersistLedgerEvent\s*\(/, 'persistLedgerEvent('],
  [/\bsyncEntries\s*\(/, 'syncEntries('],
  [/\bdeleteEntries\s*\(/, 'deleteEntries('],
  [/\bpersistExtras\s*\(/, 'persistExtras('],
  [/\bpersistMovement\s*\(/, 'persistMovement('],
  [/\bledgerAppendIO\b/, 'ledgerAppendIO'],
  [/\brpc\s*\(/, 'rpc('],
];
for (const [re, label] of WRITE_PATTERNS) ok(!re.test(LOAD), `1-6. load path (login/refresh/member load/society switch/offline/hydration) has no ${label}`);

// Every supabase call left in the load path is a read (.select).
const fromCalls = LOAD.match(/supabase\s*\.from\([^)]*\)\s*\.\s*\w+/g) || [];
ok(fromCalls.length > 0 && fromCalls.every(c => /\.select$/.test(c.replace(/\s+/g, ''))), `load path supabase calls are all .select (${fromCalls.length} calls)`);

// The removed writers are gone by name.
ok(!/Auto-create missing member vouchers/.test(SRC) || !/autoVouchers\.push/.test(code(SRC)), '7. member auto-voucher loop removed (no autoVouchers.push)');
ok(!/newRepairVouchers/.test(code(SRC)), 'sale/purchase REPAIR v2 loop removed (no newRepairVouchers)');
ok(!/duplicateRepairs/.test(code(SRC)), '9. duplicate "repair cleanup" soft-delete removed (existing duplicates left untouched)');
ok(!/voucher_entries: migrated/.test(code(SRC)), 'load-time voucher_entries backfill removed');
ok(!/Account migration sync error/.test(code(SRC)), 'load-time accounts upsert removed (template accounts merge into local state only)');

// Local state is still hydrated from what was read (read-only behaviour kept).
ok(/setSalesState\(\(slData \|\| \[\]\)\.filter\(s => !s\.isDeleted\)\)/.test(LOAD), 'sales state still hydrated from the read (archived filtered)');
ok(/setPurchasesState\(\(puData \|\| \[\]\)\.filter\(p => !p\.isDeleted\)\)/.test(LOAD), 'purchases state still hydrated from the read (archived filtered)');
ok(/storage\.migrateAccounts\(rawAccts\)/.test(LOAD) && /setAccountsState\(baseAccts\)/.test(LOAD), 'accounts: template merge applied to LOCAL state only');

// Offline fallback (catch branch) restores from localStorage without writing.
const catchIdx = LOAD.lastIndexOf('catch (err)');
const OFFLINE = catchIdx > 0 ? blockAfter(LOAD, catchIdx) : '';
ok(OFFLINE.includes('storage.getVouchers()') && !/\.(upsert|insert|update|delete)\s*\(/.test(OFFLINE), '5. offline/localStorage restore reads only');

// ── Part B: diagnostics report, never repair ─────────────────────────────────────────────────────
const { phantomVoucherDiagnostics, findAutoMemberVouchers, findSalePurchaseVoucherGaps } =
  await import(pathToFileURL(pathResolve(HERE, '../src/lib/diagnostics/phantomVouchers.ts')).href);

const deepFreeze = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); return o; };
const members = deepFreeze([
  { id: 'm1', name: 'A' },           // imported share voucher + System duplicate
  { id: 'm2', name: 'B' },           // System voucher only (e.g. explicit addMember receipt)
  { id: 'm3', name: 'C' },           // no voucher at all
  { id: 'm4', name: 'D', isDeleted: true },
]);
const sysShare = (id, mid, amt, extra = {}) => ({ id, voucherNo: `RV/${id}`, date: '1960-04-01', amount: amt, createdBy: 'System', memberId: mid, narration: `Share Capital received from ${mid}`, debitAccountId: '3301', creditAccountId: '1102', ...extra });
const vouchers = deepFreeze([
  { id: 'imp1', voucherNo: 'RV/1', date: '1960-04-01', amount: 100, memberId: 'm1', narration: 'import', lines: [{ accountId: '3301', type: 'Dr', amount: 100 }, { accountId: '1102', type: 'Cr', amount: 100 }] },
  sysShare('s1', 'm1', 100),
  sysShare('s2', 'm2', 50),
  { id: 'a2', voucherNo: 'RV/a2', date: '1960-04-01', amount: 5, createdBy: 'System', memberId: 'm2', narration: 'Admission Fee received from m2', debitAccountId: '3301', creditAccountId: '4407' },
  sysShare('s4', 'm4', 70),
  sysShare('sdel', 'm1', 100, { isDeleted: true }),       // cancelled duplicate — must be ignored
]);

const rows = findAutoMemberVouchers(vouchers, members);
ok(!rows.some(r => r.memberId === 'm3'), '7. existing member with no voucher → nothing auto-created, nothing reported');
const r1 = rows.find(r => r.voucherId === 's1');
ok(r1 && r1.hasOtherPosting === true && r1.kind === 'share_capital', '8. member with an imported voucher + System voucher → reported as likely duplicate');
const r2 = rows.find(r => r.voucherId === 's2');
ok(r2 && r2.hasOtherPosting === false, 'single System share voucher → reported as auto-style, NOT as duplicate');
ok(rows.find(r => r.voucherId === 'a2')?.kind === 'admission_fee', 'admission-fee auto-style voucher classified');
ok(rows.find(r => r.voucherId === 's4')?.memberMissingOrDeleted === true, 'System voucher of a deleted member flagged');
ok(!rows.some(r => r.voucherId === 'sdel'), 'soft-deleted voucher is not reported (already cancelled)');
for (const r of rows) ok(['voucherId', 'memberId', 'narration', 'createdBy', 'date', 'amount'].every(k => k in r), `row ${r.voucherId} carries voucher id, member id, narration, createdBy, date, amount`);

const diag = phantomVoucherDiagnostics({ vouchers, members, sales: [], purchases: [] });
ok(diag.autoMemberVoucherCount === 4 && diag.suspectedDuplicateCount === 1, `summary counts (auto=${diag.autoMemberVoucherCount}, duplicates=${diag.suspectedDuplicateCount})`);
ok(vouchers.length === 6 && vouchers[1].isDeleted === undefined, '9. diagnostics never mutate input (frozen fixtures, unchanged)');

const sales = deepFreeze([{ id: 'sa1', saleNo: 'SL/1', voucherId: 'vs1' }, { id: 'sa2', saleNo: 'SL/2', voucherId: 'gone' }, { id: 'sa3', saleNo: 'SL/3' }]);
const purchases = deepFreeze([{ id: 'pu1', purchaseNo: 'PUR/1', voucherId: 'vp1' }]);
const refV = deepFreeze([
  { id: 'vs1', refType: 'sale', refId: 'sa1', amount: 1 },
  { id: 'vs3', refType: 'sale', refId: 'sa3', amount: 1 },
  { id: 'vs3b', refType: 'sale', refId: 'sa3', amount: 1 },
  { id: 'vp1', refType: 'purchase', refId: 'pu1', amount: 1 },
  { id: 'vorph', refType: 'purchase', refId: 'pu-deleted', amount: 1 },
]);
const gaps = findSalePurchaseVoucherGaps(sales, purchases, refV);
ok(gaps.some(g => g.kind === 'sale_without_voucher' && g.documentNo === 'SL/2'), 'sale whose voucher is missing → reported (not re-created)');
ok(!gaps.some(g => g.documentNo === 'SL/1'), 'sale with a live voucher → not reported');
ok(gaps.filter(g => g.kind === 'duplicate_ref_voucher').length === 2, 'two live vouchers for one sale → both reported as duplicates (none soft-deleted)');
ok(gaps.some(g => g.kind === 'voucher_without_parent' && g.voucherId === 'vorph'), 'voucher whose purchase is gone → reported');

// ── Part C: guards + the explicit posting path ───────────────────────────────────────────────────
// From the arrow's body brace — a parameter type literal (`opts: { quiet?: boolean }`) is not the body.
const fnBody = (name) => code(blockAfter(SRC, SRC.indexOf('=> {', SRC.indexOf(`const ${name} = useCallback(`))));
const ADD_SALE = fnBody('addSale'), ADD_PUR = fnBody('addPurchase'), UPD_SALE = fnBody('updateSale'), UPD_PUR = fnBody('updatePurchase');
ok(/guardVoucherPostable\(data\.date\)/.test(ADD_SALE) && /guardVoucherPostable\(data\.date\)/.test(ADD_PUR), 'addSale/addPurchase refuse up front for addVoucher\'s reasons');
const stopsBeforeStock = (body) => { const g = body.indexOf('if (!newVoucher.id) return'); const st = body.indexOf('data.items.forEach'); return g > 0 && st > g; };
ok(stopsBeforeStock(ADD_SALE) && stopsBeforeStock(ADD_PUR), 'addSale/addPurchase stop before stock/row writes when the voucher is refused (no voucher ⇒ no document)');
// S3-e-1: the old voucher is cancelled through cancelLinkedVouchers (with its journal event).
const preBeforeCancel = (body) => { const g = body.indexOf('guardVoucherPostable(original.date, data.date)'); const c = body.indexOf('cancelLinkedVouchers('); return g > 0 && c > g; };
ok(preBeforeCancel(UPD_SALE) && preBeforeCancel(UPD_PUR), 'updateSale/updatePurchase check refusals BEFORE cancelling the old voucher');
const ADD_MEMBER = fnBody('addMember');
// The receipt logic moved into postJoiningReceipts (one rule for add / approve / import).
const JOIN_RECEIPTS = fnBody('postJoiningReceipts');
ok(/postJoiningReceipts\(newMember/.test(ADD_MEMBER) && /planJoiningReceipts\(/.test(JOIN_RECEIPTS) && /persistVoucher\(/.test(JOIN_RECEIPTS),
  '10. explicit addMember posting path still exists (separate from load)');
ok(/getPhantomVoucherDiagnostics/.test(SRC) && /phantomVoucherDiagnostics\(\{ vouchers, members, sales, purchases \}\)/.test(SRC), 'diagnostics exposed on the context as an on-demand read');

console.log(`\nRM-01 no-load-writes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
