// Ledger Heads — opening the page must NEVER merge or delete accounts (RM-01 class, follows #531/#532).
//
// An earlier load-time useEffect called mergeAccounts for every same-name + same-type duplicate,
// re-pointing historical vouchers and deleting accounts with no confirmation. This pins that:
//   - the page has no effect / ref that could auto-merge;
//   - duplicates are still DETECTED and shown whenever they exist (not only when the FY is locked);
//   - the Merge button only OPENS a confirmation dialog; mergeAccounts is called in exactly one
//     place — the AlertDialog's confirm handler — and the success toast is gated on its result.
// Run: node scripts/test-ledgerheads-no-auto-merge.mjs (exit 1 on any failure).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(pathResolve(HERE, '../src/pages/LedgerHeads.tsx'), 'utf8');
/** Strip comments (block, JSX-block, and // line) so prose cannot satisfy or break a check. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

ok(!/\buseEffect\s*\(/.test(SRC), 'LedgerHeads has no useEffect (nothing runs a mutation on page open)');
ok(!/autoMerged/.test(SRC), 'auto-merge ref removed');
ok(!/\bdeleteAccount\s*\(\s*(?:dup|sorted|group)/.test(SRC), 'no duplicate-driven deleteAccount call');
ok(!/\bmergeAccounts\s*\(\s*(?:dup|sorted|group)/.test(SRC), 'no duplicate-driven mergeAccounts call');

ok(/const duplicateGroups = useMemo\(/.test(SRC), 'duplicates are still detected (read-only useMemo)');
ok(/\$\{a\.name\.trim\(\)\.toLowerCase\(\)\}\|\$\{a\.type\}/.test(SRC), 'duplicate key stays name + TYPE (same name, different type is never a duplicate)');
ok(/\{duplicateGroups\.length > 0 && \(/.test(SRC), 'banner shows whenever duplicates exist');
ok(!/society\.fyLocked && duplicateGroups/.test(SRC), 'banner is no longer gated on FY lock');

// The Merge button only opens the dialog.
const btnIdx = SRC.indexOf("{hi ? 'मर्ज करें' : 'Merge'}");
const btnOpen = SRC.lastIndexOf('<Button', btnIdx);
const BTN = btnIdx > 0 && btnOpen > 0 ? SRC.slice(btnOpen, btnIdx) : '';
ok(BTN !== '', 'Merge button still rendered');
ok(/onClick=\{\(\) => openMergeDialog\(sorted\)\}/.test(BTN), 'Merge button only opens the confirmation dialog');
ok(!/mergeAccounts|confirmMerge/.test(BTN), 'Merge button never merges directly');

// mergeAccounts is CALLED exactly once — inside confirmMerge.
const calls = [...SRC.matchAll(/\bmergeAccounts\s*\(/g)];
ok(calls.length === 1, `mergeAccounts is called exactly once (found ${calls.length})`);
const cmIdx = SRC.indexOf('const confirmMerge = async () => {');
const cmEnd = SRC.indexOf('\n  };', cmIdx);
const CONFIRM = cmIdx > 0 && cmEnd > cmIdx ? SRC.slice(cmIdx, cmEnd) : '';
ok(CONFIRM !== '' && calls.length === 1 && calls[0].index > cmIdx && calls[0].index < cmEnd, 'the one mergeAccounts call lives in confirmMerge');
ok(/const result = await mergeAccounts\(/.test(CONFIRM) && /if \(!result\) return;/.test(CONFIRM), 'success toast is gated on a non-null merge result');
ok(CONFIRM.indexOf('if (!result) return;') >= 0 && CONFIRM.indexOf('if (!result) return;') < CONFIRM.indexOf('toast('), 'the null check precedes the success toast');

// confirmMerge is reachable only from the AlertDialog confirm action.
const refs = [...SRC.matchAll(/\bconfirmMerge\b/g)].length;
ok(refs === 2, `confirmMerge is defined once and used once (found ${refs} references)`);
ok(/<AlertDialogAction[\s\S]{0,300}onClick=\{e => \{ e\.preventDefault\(\); void confirmMerge\(\); \}\}/.test(SRC), 'confirmMerge is wired to the AlertDialogAction');

// The dialog shows both accounts with balances, the moving voucher count and the cannot-undo warning.
ok(/getAccountBalance\(acc\.id\)/.test(SRC) && /'रखा जाने वाला खाता'/.test(SRC) && /'हटाया जाने वाला खाता'/.test(SRC), 'dialog shows kept + removed accounts with balances');
ok(/liveVoucherRefs\(mergeTarget\.keepId, mergeTarget\.removeId\)/.test(SRC), 'dialog shows how many vouchers move');
ok(/वापस नहीं किया जा सकता/.test(SRC), 'dialog warns the merge cannot be undone');

console.log(`ledgerheads-no-auto-merge: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
