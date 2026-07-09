// Opening-balance carry-forward (ECR-09) — mirrors src/lib/openingBalances.ts.
// Run: node scripts/test-opening-balances.mjs

function carryForwardOpenings(previousYearBalances) {
  return Object.entries(previousYearBalances || {})
    .filter(([, v]) => Math.abs(v || 0) > 0.005)
    .map(([accountId, v]) => ({ accountId, amount: Math.round(Math.abs(v) * 100) / 100, type: v >= 0 ? 'debit' : 'credit' }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
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

console.log(`\nOpening balances carry (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
