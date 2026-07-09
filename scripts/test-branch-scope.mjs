// Multi-branch scoping (ECR-17 Phase 1) — mirrors src/lib/branchScope.ts.
// Run: node scripts/test-branch-scope.mjs
const ALL_BRANCHES = 'all';
function matchesBranch(branchId, activeBranchId, headOfficeId) {
  if (!activeBranchId || activeBranchId === ALL_BRANCHES) return true;
  const effective = branchId || headOfficeId || '';
  return effective === activeBranchId;
}
function filterByBranch(records, activeBranchId, headOfficeId) {
  if (!activeBranchId || activeBranchId === ALL_BRANCHES) return records;
  return records.filter(r => matchesBranch(r.branchId, activeBranchId, headOfficeId));
}
function branchToStamp(activeBranchId, headOfficeId) {
  return activeBranchId && activeBranchId !== ALL_BRANCHES ? activeBranchId : headOfficeId;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const HO = 'ho', B2 = 'b2';
const recs = [
  { id: 1, branchId: 'ho' },
  { id: 2, branchId: 'b2' },
  { id: 3, branchId: undefined }, // legacy → head office
  { id: 4, branchId: 'b2' },
];

// 1. 'all' = consolidated → everything.
ok(filterByBranch(recs, ALL_BRANCHES, HO).length === 4, 'all → no filter');
ok(filterByBranch(recs, '', HO).length === 4, 'empty active → no filter');

// 2. Specific branch filters.
ok(filterByBranch(recs, B2, HO).map(r => r.id).join() === '2,4', 'branch b2 → only b2 records');

// 3. Legacy (no branchId) shows under the Head Office.
ok(filterByBranch(recs, HO, HO).map(r => r.id).join() === '1,3', 'head office → its records + legacy unbranched');
ok(matchesBranch(undefined, HO, HO), 'unbranched record matches head office');
ok(!matchesBranch(undefined, B2, HO), 'unbranched record does NOT match a non-head-office branch');

// 4. branchToStamp: active branch, or head office when "all".
ok(branchToStamp(B2, HO) === B2, 'stamp the active branch');
ok(branchToStamp(ALL_BRANCHES, HO) === HO, 'stamp head office when viewing all');
ok(branchToStamp('', HO) === HO, 'stamp head office when no active branch');

// 5. No head office known → unbranched only matches "all".
ok(!matchesBranch(undefined, B2, undefined), 'no HO + unbranched + specific branch → excluded');
ok(matchesBranch('b2', B2, undefined), 'branched record still matches its branch without HO');

console.log(`\nBranch scope (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
