// DEP-02 / DEP-03 (product audit 2026-11-17) — deposits.
//   DEP-02  a voucher the server refused LATE left the passbook line and the balance moved. Closed by the DEP-01 work
//           (PR #885): every deposit movement's voucher carries onFailed → the one undo (passbook line removed,
//           account back, the cloud balance written back). Pinned here so it cannot regress.
//   DEP-03  two windows could both withdraw the same balance: the balance was saved as a whole-row upsert of what
//           each screen had READ, so the second write simply overwrote the first. Now a compare-and-set: the balance is
//           written only while the cloud still holds the balance the movement started from; no row matched ⇒ the
//           whole movement is undone and the clerk is told to refresh.
// Run: node scripts/test-dep-p0.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const dc = readFileSync(pathResolve(ROOT, 'src/contexts/DataContext.tsx'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const between = (a, b) => dc.slice(dc.indexOf(a), dc.indexOf(b, dc.indexOf(a)));

// ── DEP-02: every deposit voucher answers a late refusal with the one undo ──
{
  const leg = between('const postDepositLeg = ', 'const commitDepositMovement = ');
  const intr = between('const postDepositInterest = useCallback(', 'const closeDepositAccount = useCallback(');
  for (const [name, body] of [['postDepositLeg (open / deposit / withdraw / closure)', leg], ['postDepositInterest', intr]]) {
    ok(/\{ onFailed: \(\) => \{ if \(pending\) pending\.undo\('voucher'\); else refusedEarly = true; \} \}/.test(body), `${name}: a late refusal runs the movement's undo`);
    ok(/if \(!voucher\?\.id \|\| refusedEarly\) return null;/.test(body), `${name}: a refusal before the movement started records nothing`);
  }
  const undo = between('const makeDepositUndo = ', 'const postDepositLeg = ');
  ok(/setDepositTransactionsState\(prev => prev\.filter\(t => t\.id !== id\)\)/.test(undo) && /from\('deposit_transactions'\)\.delete\(\)\.eq\('id', id\)/.test(undo), 'the undo removes the passbook line (screen + cloud)');
  ok(/onUndone\?\.\(\);/.test(undo) && /if \(done\) return;\s*done = true;/.test(undo), 'and puts the account back — once');
}

// ── DEP-03: compare-and-set on the balance ──
{
  const commit = between('const commitDepositMovement = ', 'const addDepositAccount = ');
  ok(!/from\('deposit_accounts'\)\.upsert\(/.test(commit), 'no whole-row upsert of a read balance in the movement path');
  ok(/from\('deposit_accounts'\)\.update\(withSoc\(updated\)\)\.eq\('id', id\)\.eq\('balance', before\.balance\)\.select\('id'\)/.test(commit), 'the new balance is written only where the cloud still holds the starting balance');
  ok(/else if \(!data \|\| data\.length === 0\) \{[\s\S]{0,400}?leg\.undo\('balance',/.test(commit), 'no row matched (another movement got there first) ⇒ the whole movement is undone');
  ok(/शेष बदल चुका है। पेज refresh करके दोबारा करें/.test(commit) && /refresh the page and enter it again/.test(commit), 'the clerk is told why, Hindi first (RULE 7)');
  ok(/const writeBackBefore = \(\) => supabase\.from\('deposit_accounts'\)\.update\(withSoc\(before\)\)\.eq\('id', id\)\.eq\('balance', updatedBalance\)/.test(commit), 'the undo write-back never overwrites a later movement from another window');
  for (const fn of ['postDepositTransaction', 'postDepositInterest', 'closeDepositAccount']) {
    ok(/commitDepositMovement\(/.test(between(`const ${fn} = useCallback(`, '\n  }, [')), `${fn} goes through the compare-and-set path`);
  }
}

console.log(`DEP-02/03 deposits: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
