// PERF-01 (product audit 2026-11-17): the voucher list filtered, sorted and rendered every voucher on every render
// (and looked up each row's accounts in the whole chart); Ledger Heads rebuilt ~605 rows on every keystroke in its
// dialogs (LIVE-07). Now: a memoised, searchable voucher list shown 50 per page, and memoised Ledger Heads rows.
// Run: node scripts/test-perf01-voucher-list.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const L = await import(pathToFileURL(join(ROOT, 'src/lib/voucherListView.ts')).href);

// ── 1. search ──
{
  const v = { id: '1', voucherNo: 'RV/2026-27/0042', narration: 'Rent received from shop', amount: 5000, type: 'receipt', date: '2026-07-01' };
  ok(L.matchesVoucherQuery(v, '') && L.matchesVoucherQuery(v, '   '), 'an empty query matches everything');
  ok(L.matchesVoucherQuery(v, 'rent') && L.matchesVoucherQuery(v, 'RENT'), 'case-insensitive narration match');
  ok(L.matchesVoucherQuery(v, '0042') && L.matchesVoucherQuery(v, 'receipt'), 'voucher no. and type match');
  ok(L.matchesVoucherQuery(v, 'rent 5000') && !L.matchesVoucherQuery(v, 'rent 6000'), 'every word must match ("rent 5000" finds it, "rent 6000" does not)');
  ok(L.matchesVoucherQuery(v, '5,000'), 'an amount typed with Indian commas still matches');
  ok(L.matchesVoucherQuery(v, 'cash', ['Cash in Hand', 'Rent Income']) && !L.matchesVoucherQuery(v, 'bank', ['Cash in Hand']), 'account names of the voucher legs are searched');
  ok(L.matchesVoucherQuery(v, '2026-07'), 'the date matches');
}

// ── 2. paging ──
{
  const list = Array.from({ length: 123 }, (_, i) => i + 1);
  const p1 = L.pageOf(list, 1);
  ok(L.VOUCHER_PAGE_SIZE === 50 && p1.rows.length === 50 && p1.rows[0] === 1 && p1.pages === 3 && p1.from === 1 && p1.to === 50, 'page 1 = rows 1–50 of 3 pages');
  const p3 = L.pageOf(list, 3);
  ok(p3.rows.length === 23 && p3.from === 101 && p3.to === 123 && p3.total === 123, 'the last page holds the remainder');
  ok(L.pageOf(list, 9).page === 3 && L.pageOf(list, 0).page === 1 && L.pageOf(list, NaN).page === 1, 'an out-of-range page clamps (a shrinking list never shows a blank page)');
  const e = L.pageOf([], 1);
  ok(e.rows.length === 0 && e.pages === 1 && e.from === 0 && e.to === 0, 'an empty list is one empty page');
}

// ── 3. the voucher page uses them ──
{
  const s = read('src/pages/Vouchers.tsx');
  ok(s.includes('const branchVouchers = useMemo(() => vouchers.filter(v => matchesActiveBranch(v.branchId)), [vouchers, matchesActiveBranch]);'), 'branch filter is memoised (not redone on each keystroke in the entry form)');
  ok(/const sortedVouchers = useMemo\(\(\) => branchVouchers[\s\S]{0,400}\[branchVouchers, showCancelled, deferredListQuery, accountById\]\);/.test(s), 'filter + search + sort is one memoised pass');
  ok(s.includes('const deferredListQuery = useDeferredValue(listQuery);'), 'the search box stays responsive (deferred query)');
  ok(s.includes('{listSlice.rows.map(v => {') && !s.includes('{sortedVouchers.map(v => {'), 'only one page of rows is rendered');
  ok(s.includes('const debitAcc = accountById.get(drLines[0]?.accountId);') && !/accounts\.find\(a => a\.id === drLines\[0\]/.test(s), 'row accounts come from a Map (no scan of the whole chart per row)');
  ok(s.includes('listSlice.rows.filter(bulkCancellable) : [];'), 'bulk "select all" selects only the rows on screen, never hidden ones');
  ok(s.includes('useEffect(() => { setListPage(1); }, [deferredListQuery, showCancelled]);'), 'a new search or the cancelled toggle goes back to page 1');
  ok(s.includes("'← पिछला'") && s.includes("'अगला →'"), 'Hindi-first pager');
}

// ── 4. Ledger Heads rows are memoised with stable handlers ──
{
  const s = read('src/pages/LedgerHeads.tsx');
  ok(s.includes('const LedgerHeadRows = React.memo(function LedgerHeadRows('), 'the ~605 rows are a React.memo component');
  ok(s.includes('<LedgerHeadRows rows={displayList} hi={hi} onEdit={onEditRow} onDelete={onDeleteRow} />'), 'the page renders them with the memoised displayList');
  ok(s.includes('const onEditRow = useCallback((acc: LedgerAccount) => rowActions.current.openEdit(acc), []);') && s.includes('rowActions.current = { openEdit, handleDeleteClick };'), 'handlers are stable (empty deps) yet always call the latest function — memo is not defeated');
  ok(!/\{displayList\.map\(\(\{ acc, depth \}\) => \(/.test(s), 'no inline row map left in the page');
}

console.log(`PERF-01 voucher list: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
