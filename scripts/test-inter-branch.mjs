// Inter-branch accounting (ECR-17 Phase 2) — mirrors src/lib/interBranch.ts.
// Run: node scripts/test-inter-branch.mjs
const r2 = (n) => Math.round(n * 100) / 100;
const INTER_BRANCH_CONTROL_ID = '2110';
function buildInterBranchTransfer(input) {
  const amt = r2(Math.max(0, input.amount || 0));
  const control = input.controlAccountId || INTER_BRANCH_CONTROL_ID;
  return {
    from: { branchId: input.fromBranchId, lines: [ { accountId: control, type: 'Dr', amount: amt }, { accountId: input.fromAccountId, type: 'Cr', amount: amt } ] },
    to: { branchId: input.toBranchId, lines: [ { accountId: input.toAccountId, type: 'Dr', amount: amt }, { accountId: control, type: 'Cr', amount: amt } ] },
  };
}
const legDr = (leg) => r2(leg.lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0));
const legCr = (leg) => r2(leg.lines.filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0));
const legsBalanced = (t) => legDr(t.from) === legCr(t.from) && legDr(t.to) === legCr(t.to);
function controlNet(t, control = INTER_BRANCH_CONTROL_ID) {
  let net = 0;
  for (const leg of [t.from, t.to]) for (const l of leg.lines) if (l.accountId === control) net += l.type === 'Dr' ? l.amount : -l.amount;
  return r2(net);
}
// Net movement of a cash/bank account across both legs.
function acctNet(t, id) { let net = 0; for (const leg of [t.from, t.to]) for (const l of leg.lines) if (l.accountId === id) net += l.type === 'Dr' ? l.amount : -l.amount; return r2(net); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const t = buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 5000, fromAccountId: '3301', toAccountId: '3301' });

// 1. From branch: Dr Control / Cr Cash.
ok(t.from.branchId === 'A' && t.from.lines[0].accountId === '2110' && t.from.lines[0].type === 'Dr' && t.from.lines[1].accountId === '3301' && t.from.lines[1].type === 'Cr', 'from leg: Dr Control / Cr Cash, branch A');
// 2. To branch: Dr Cash / Cr Control.
ok(t.to.branchId === 'B' && t.to.lines[0].accountId === '3301' && t.to.lines[0].type === 'Dr' && t.to.lines[1].accountId === '2110' && t.to.lines[1].type === 'Cr', 'to leg: Dr Cash / Cr Control, branch B');
// 3. Each leg balances.
ok(legsBalanced(t), 'each leg balances (Dr = Cr)');
// 4. Control nets to zero consolidated.
ok(controlNet(t) === 0, 'inter-branch control nets to zero');
// 5. Cash nets to zero consolidated (transfer within the society).
ok(acctNet(t, '3301') === 0, 'consolidated cash unchanged (nets to zero)');
// 6. Different modes: from bank, to cash → each account moves but control still nets zero.
const t2 = buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 1000, fromAccountId: '3302', toAccountId: '3301' });
ok(controlNet(t2) === 0 && legsBalanced(t2), 'cross-mode transfer: legs balance + control net zero');
ok(acctNet(t2, '3302') === -1000 && acctNet(t2, '3301') === 1000, 'bank −1000, cash +1000 (real movement, total assets unchanged)');
// 7. Rounding.
ok(buildInterBranchTransfer({ fromBranchId: 'A', toBranchId: 'B', amount: 100.005, fromAccountId: 'x', toAccountId: 'x' }).from.lines[0].amount === 100.01, 'amount rounded to paise');

console.log(`\nInter-branch (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
