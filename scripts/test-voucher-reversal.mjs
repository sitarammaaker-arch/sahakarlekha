// Reversal-not-edit (P1 #8 / ECR-08) — asserts the pure helpers mirrored from
// src/contexts/DataContext.tsx (reverseEntryLines, isEditLocked), the same way
// scripts/test-nav.mjs mirrors navVisibility. Run: node scripts/test-voucher-reversal.mjs

// ── Mirror of the pure logic in DataContext ───────────────────────────────────
const reverseEntryLines = (lines) => lines.map(l => ({ ...l, type: l.type === 'Dr' ? 'Cr' : 'Dr' }));
const isEditLocked = (v, approvalRequired) => !!v.reversedBy || (!!approvalRequired && v.approvalStatus === 'approved');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. reverseEntryLines flips every line's side, preserves account + amount.
const lines = [
  { id: 'a', accountId: '5101', type: 'Dr', amount: 100 },
  { id: 'b', accountId: '1101', type: 'Cr', amount: 60 },
  { id: 'c', accountId: '1201', type: 'Cr', amount: 40 },
];
const rev = reverseEntryLines(lines);
ok(rev[0].type === 'Cr' && rev[1].type === 'Dr' && rev[2].type === 'Dr', 'each line side flipped Dr↔Cr');
ok(rev[0].accountId === '5101' && rev[0].amount === 100, 'account + amount preserved on flip');

// 2. A reversal stays balanced: Σ Dr === Σ Cr before and after.
const sum = (ls, t) => ls.filter(l => l.type === t).reduce((s, l) => s + l.amount, 0);
ok(sum(lines, 'Dr') === sum(rev, 'Cr') && sum(lines, 'Cr') === sum(rev, 'Dr'), 'reversal preserves balance (Dr↔Cr totals swap)');
ok(sum(rev, 'Dr') === sum(rev, 'Cr'), 'reversal itself is balanced');

// 3. Double reversal returns to the original sides (involution).
ok(JSON.stringify(reverseEntryLines(rev)) === JSON.stringify(lines), 'reversing twice restores original sides');

// 4. isEditLocked — already-reversed vouchers are always locked.
ok(isEditLocked({ reversedBy: 'v99' }, false) === true, 'reversed voucher is edit-locked (regime off)');
ok(isEditLocked({ reversedBy: 'v99' }, true) === true, 'reversed voucher is edit-locked (regime on)');

// 5. isEditLocked — posted-under-control only under the opt-in approval regime.
ok(isEditLocked({ approvalStatus: 'approved' }, true) === true, 'approved voucher locked WHEN approvalRequired');
ok(isEditLocked({ approvalStatus: 'approved' }, false) === false, 'approved voucher editable when approvalRequired OFF (no regression)');
ok(isEditLocked({ approvalStatus: 'pending' }, true) === false, 'pending voucher not locked');
ok(isEditLocked({ approvalStatus: undefined }, true) === false, 'unstamped voucher not locked');
ok(isEditLocked({}, false) === false, 'plain voucher, default regime → editable');

console.log(`\nVoucher reversal (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
