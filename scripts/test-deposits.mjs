// Deposits engine (Deposits module — SB/FD/RD/Pigmy) — asserts the pure helpers mirrored
// from src/lib/depositEngine.ts. Run: node scripts/test-deposits.mjs

// ── Mirror of the pure logic in src/lib/depositEngine.ts ──────────────────────
const depositLiabilityAccount = (type) => (type === 'FD' ? '2108' : '2107');
function depositPosting(txnType, acc) {
  if (txnType === 'withdraw' || txnType === 'closure') return { debitAccountId: acc.liability, creditAccountId: acc.cashBank, sign: -1 };
  return { debitAccountId: acc.cashBank, creditAccountId: acc.liability, sign: 1 };
}
const applyDepositTxn = (balance, txnType, amount) => Math.round((balance + ((txnType === 'withdraw' || txnType === 'closure') ? -1 : 1) * amount) * 100) / 100;
function validateDepositTxn(txnType, amount, balance) {
  if (!(amount > 0)) return { ok: false, error: 'amt' };
  if (txnType === 'withdraw' && amount > balance) return { ok: false, error: 'overbalance' };
  return { ok: true };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Liability account per product: FD → 2108, everything else → 2107.
ok(depositLiabilityAccount('FD') === '2108', 'FD sits in 2108');
for (const t of ['SB', 'RD', 'PIGMY']) ok(depositLiabilityAccount(t) === '2107', `${t} sits in 2107`);

// 2. Deposit/open: Dr Cash-Bank / Cr liability (+). Withdraw: Dr liability / Cr Cash-Bank (−).
const acc = { liability: '2107', cashBank: '3301' };
const dep = depositPosting('deposit', acc);
ok(dep.debitAccountId === '3301' && dep.creditAccountId === '2107' && dep.sign === 1, 'deposit → Dr cash / Cr liability (+)');
const opn = depositPosting('open', acc);
ok(opn.debitAccountId === '3301' && opn.creditAccountId === '2107' && opn.sign === 1, 'open → Dr cash / Cr liability (+)');
const wd = depositPosting('withdraw', acc);
ok(wd.debitAccountId === '2107' && wd.creditAccountId === '3301' && wd.sign === -1, 'withdraw → Dr liability / Cr cash (−)');

// 3. Every posting is a balanced Dr/Cr pair touching the liability account.
for (const t of ['open', 'deposit', 'withdraw']) {
  const p = depositPosting(t, acc);
  ok(p.debitAccountId !== p.creditAccountId, `${t} debit ≠ credit`);
  ok(p.debitAccountId === '2107' || p.creditAccountId === '2107', `${t} touches the liability`);
}

// 4. Balance math.
ok(applyDepositTxn(0, 'open', 5000) === 5000, 'open 5000 → 5000');
ok(applyDepositTxn(5000, 'deposit', 2500) === 7500, 'deposit 2500 → 7500');
ok(applyDepositTxn(7500, 'withdraw', 3000) === 4500, 'withdraw 3000 → 4500');
ok(applyDepositTxn(4500, 'withdraw', 4500) === 0, 'full withdraw → 0');
ok(applyDepositTxn(100.1, 'deposit', 0.15) === 100.25, 'rounding to 2dp');

// 4b. Closure pays out like a withdrawal (Dr liability / Cr cash; balance → 0).
const cl = depositPosting('closure', acc);
ok(cl.debitAccountId === '2107' && cl.creditAccountId === '3301' && cl.sign === -1, 'closure → Dr liability / Cr cash (−)');
ok(applyDepositTxn(4500, 'closure', 4500) === 0, 'closure of full balance → 0');
ok(applyDepositTxn(0, 'closure', 0) === 0, 'closing a zero-balance account → 0');
ok(applyDepositTxn(5000, 'interest', 250) === 5250, 'interest credits the balance (+)');

// 5. Validation: positive amount; withdrawal cannot exceed balance.
ok(!validateDepositTxn('deposit', 0, 1000).ok, 'zero amount rejected');
ok(!validateDepositTxn('deposit', -5, 1000).ok, 'negative amount rejected');
ok(validateDepositTxn('deposit', 100000, 1000).ok, 'any positive deposit allowed (no upper bound)');
ok(validateDepositTxn('withdraw', 1000, 1000).ok, 'withdraw equal to balance allowed');
ok(!validateDepositTxn('withdraw', 1001, 1000).ok, 'over-balance withdrawal rejected');

console.log(`\nDeposits engine (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
