// DEP-01 (audit 2026-11-17): a deposit movement = voucher + passbook line + account balance. If ANY of the three
// fails, all three are undone — a cash voucher left after "Transaction not saved" makes the clerk pay out twice.
// Pins the wiring in DataContext so it cannot quietly regress.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dc = readFileSync(resolve(ROOT, 'src/contexts/DataContext.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const between = (a, b) => { const i = dc.indexOf(a); const j = dc.indexOf(b, i + 1); return i >= 0 && j > i ? dc.slice(i, j) : ''; };

const undo = between('const makeDepositUndo = ', 'const postDepositLeg = ');
ok(undo.length > 0, 'makeDepositUndo exists');
ok(/if \(done\) return;\s*done = true;/.test(undo), 'the undo runs at most once');
ok(/if \(voucherId && why !== 'voucher'\) cancelLinkedVouchers\(\[voucherId\]/.test(undo), 'the voucher is cancelled unless the server already refused it');
ok(/from\('deposit_transactions'\)\.delete\(\)\.eq\('id', id\)/.test(undo), 'the passbook line is removed from the cloud');
ok(/onUndone\?\.\(\)/.test(undo), 'the caller restores its account');

const leg = between('const postDepositLeg = ', 'const commitDepositMovement = ');
ok(/\{ onFailed: \(\) => \{ if \(pending\) pending\.undo\('voucher'\)/.test(leg), 'a voucher the server refuses later undoes the movement (X-1)');
ok(/leg\.undo\('passbook', error\.message\)/.test(leg), 'a passbook line that does not save undoes the movement');
ok(/else if \(leg\.isDone\(\)\)/.test(leg), 'a passbook line that lands after the undo is deleted again');

const commit = between('const commitDepositMovement = ', 'const addDepositAccount = ');
ok(/leg\.undo\('balance', error\.message\)/.test(commit), 'a balance that does not save undoes the movement');
ok(/if \(undone\) writeBackBefore\(\)/.test(commit) && /if \(balanceSaved\) writeBackBefore\(\)/.test(commit), 'the cloud balance is put back whichever save finishes last');

const txn = between('const postDepositTransaction = useCallback', 'const postDepositInterest = useCallback');
const intr = between('const postDepositInterest = useCallback', 'const closeDepositAccount = useCallback');
const close = between('const closeDepositAccount = useCallback', 'const getDepositTransactions = useCallback');
const open = between('const addDepositAccount = useCallback', 'const postDepositTransaction = useCallback');
ok(/commitDepositMovement\(/.test(txn), 'deposit / withdrawal use the one movement path');
ok(/commitDepositMovement\(/.test(intr) && /\{ onFailed: /.test(intr) && /leg\.undo\('passbook'/.test(intr), 'interest uses the one movement path');
ok(/commitDepositMovement\(/.test(close), 'closure uses the one movement path');
ok(/persist\(withBal, leg\.undo\)/.test(open) && /undoLeg\?\.\('balance', error\.message\)/.test(open), 'a failed account save undoes the opening deposit');
for (const [name, body] of [['deposit/withdraw', txn], ['interest', intr], ['closure', close]]) {
  ok(!/from\('deposit_accounts'\)\.upsert\(withSoc\(updated\)\)/.test(body), `${name}: no separate balance upsert that could skip the undo`);
}

console.log(`deposit undo (DEP-01): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
