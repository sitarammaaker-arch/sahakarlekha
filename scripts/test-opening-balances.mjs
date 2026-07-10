// Opening balances (ECR-09 carry-forward + T-04 import mapping) — mirrors src/lib/openingBalances.ts.
// Run: node scripts/test-opening-balances.mjs  (npm run test:ob)

function carryForwardOpenings(previousYearBalances) {
  return Object.entries(previousYearBalances || {})
    .filter(([, v]) => Math.abs(v || 0) > 0.005)
    .map(([accountId, v]) => ({ accountId, amount: Math.round(Math.abs(v) * 100) / 100, type: v >= 0 ? 'debit' : 'credit' }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

// T-04 mirror.
const normName = (s) => (s || '').toLowerCase().trim();
function mapImportedOpenings(rows, accounts) {
  const byName = new Map(accounts.map(a => [normName(a.name), a.id]));
  const resolved = new Map();
  const unmatched = [];
  for (const row of rows) {
    const id = byName.get(normName(row.account_name));
    if (!id) { unmatched.push(row.account_name); continue; }
    const amount = Math.round((parseFloat(row.opening_balance) || 0) * 100) / 100;
    const type = normName(row.balance_type) === 'credit' ? 'credit' : 'debit';
    resolved.set(id, { accountId: id, amount, type });
  }
  return { entries: [...resolved.values()].sort((a, b) => a.accountId.localeCompare(b.accountId)), unmatched };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Positive → debit, negative → credit.
const e = carryForwardOpenings({ '3301': 50000, '2103': -20000 });
ok(e.length === 2, 'two non-zero entries');
const cash = e.find(x => x.accountId === '3301');
const pay = e.find(x => x.accountId === '2103');
ok(cash.amount === 50000 && cash.type === 'debit', 'positive → debit (₹50000)');
ok(pay.amount === 20000 && pay.type === 'credit', 'negative → credit magnitude (₹20000)');

// 2. Zeros / tiny values dropped.
ok(carryForwardOpenings({ '1101': 0, '1102': 0.004, '1103': 100 }).length === 1, 'zero + sub-paisa dropped, real kept');
ok(carryForwardOpenings({ '1103': 100 })[0].accountId === '1103', 'the kept account is the non-zero one');

// 3. Empty / undefined → empty.
ok(carryForwardOpenings({}).length === 0 && carryForwardOpenings(undefined).length === 0, 'empty/undefined → no entries');

// 4. Sorted by account id.
const sorted = carryForwardOpenings({ '3301': 10, '1101': 20, '2103': -5 });
ok(sorted.map(x => x.accountId).join(',') === '1101,2103,3301', 'entries sorted by account id');

// 5. Rounding to 2dp.
ok(carryForwardOpenings({ '1101': -33333.335 })[0].amount === 33333.34, 'rounds magnitude to 2dp');

// 6. Total debit == total credit when the prior closing tallied (identity check).
const tally = carryForwardOpenings({ '3301': 70000, '3100': 30000, '1102': -60000, '2103': -40000 });
const dr = tally.filter(x => x.type === 'debit').reduce((s, x) => s + x.amount, 0);
const cr = tally.filter(x => x.type === 'credit').reduce((s, x) => s + x.amount, 0);
ok(dr === cr && dr === 100000, 'balanced prior closing carries balanced (Dr 100000 = Cr 100000)');

// ── T-04: Universal Importer → opening balances ─────────────────────────────────
const CHART = [
  { id: '3301', name: 'Cash in Hand' },
  { id: '3302', name: 'Bank Account' },
  { id: '2103', name: 'Sundry Creditors' },
];
const row = (n, b, t) => ({ account_name: n, opening_balance: b, balance_type: t });

// 7. Names resolve to account ids; Dr/Cr normalised; amounts parsed.
const m1 = mapImportedOpenings([row('Cash in Hand', '50000', 'Debit'), row('Sundry Creditors', '20000', 'Credit')], CHART);
ok(m1.entries.length === 2 && m1.unmatched.length === 0, 'both rows resolve');
ok(m1.entries[0].accountId === '2103' && m1.entries[0].type === 'credit' && m1.entries[0].amount === 20000, 'creditor → credit 20000');
ok(m1.entries[1].accountId === '3301' && m1.entries[1].type === 'debit' && m1.entries[1].amount === 50000, 'cash → debit 50000');

// 8. Name matching is case/whitespace-insensitive (same rule as validateObRow).
const m2 = mapImportedOpenings([row('  cash IN hand ', '100', 'DEBIT')], CHART);
ok(m2.entries.length === 1 && m2.entries[0].accountId === '3301', 'name match ignores case + surrounding space');
ok(m2.entries[0].type === 'debit', 'balance_type match ignores case');

// 9. THE OLD BUG'S SHAPE: an unresolvable account must be REPORTED, never silently dropped.
//    The pre-T-04 code did `if (!acct) continue;` and told the user everything imported.
const m3 = mapImportedOpenings([row('Cash in Hand', '10', 'Debit'), row('Ghost Account', '999', 'Debit')], CHART);
ok(m3.entries.length === 1, 'only the resolvable row becomes an entry');
ok(m3.unmatched.length === 1 && m3.unmatched[0] === 'Ghost Account', 'unresolvable account is surfaced, not swallowed');

// 10. Anything not literally "credit" is a debit — no third state can reach the ledger.
ok(mapImportedOpenings([row('Cash in Hand', '1', 'xyz')], CHART).entries[0].type === 'debit', 'unknown balance_type falls back to debit');

// 11. Amounts round to 2dp; unparseable → 0 (validator blocks these upstream).
ok(mapImportedOpenings([row('Cash in Hand', '33333.335', 'Debit')], CHART).entries[0].amount === 33333.34, 'amount rounds to 2dp');
ok(mapImportedOpenings([row('Cash in Hand', 'abc', 'Debit')], CHART).entries[0].amount === 0, 'unparseable amount → 0');

// 12. Duplicate account names: last row wins (mirrors the old keyed-by-accountId map).
const m4 = mapImportedOpenings([row('Cash in Hand', '100', 'Debit'), row('Cash in Hand', '200', 'Credit')], CHART);
ok(m4.entries.length === 1 && m4.entries[0].amount === 200 && m4.entries[0].type === 'credit', 'duplicate name → last row wins');

// 13. Empty input is a no-op, not a crash.
ok(mapImportedOpenings([], CHART).entries.length === 0 && mapImportedOpenings([], CHART).unmatched.length === 0, 'empty rows → no entries, no unmatched');

// 14. Entries are shaped exactly like carryForwardOpenings output (same OpeningEntry contract).
const shape = m1.entries[0];
ok(Object.keys(shape).sort().join(',') === 'accountId,amount,type', 'entry shape matches OpeningEntry');

console.log(`\nOpening balances (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
