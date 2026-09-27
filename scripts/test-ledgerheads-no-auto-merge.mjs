// Ledger Heads — opening the page must NEVER merge or delete accounts (RM-01 class, follows #531/#532).
//
// An earlier load-time useEffect called mergeAccounts for every same-name + same-type duplicate,
// re-pointing historical vouchers and deleting accounts with no confirmation. This pins that:
//   - the page has no effect / ref that could auto-merge, and does not even take mergeAccounts from useData;
//   - duplicates are still DETECTED and shown whenever they exist (not only when the FY is locked);
//   - the Merge button is disabled (mergeAccounts is not journal-safe yet).
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

ok(!/\bmergeAccounts\b/.test(SRC), 'LedgerHeads does not reference mergeAccounts at all (no auto or implicit merge path)');
ok(!/\buseEffect\s*\(/.test(SRC), 'LedgerHeads has no useEffect (nothing runs a mutation on page open)');
ok(!/autoMerged/.test(SRC), 'auto-merge ref removed');
ok(!/\bdeleteAccount\s*\(\s*(?:dup|sorted|group)/.test(SRC), 'no duplicate-driven deleteAccount call');

ok(/const duplicateGroups = useMemo\(/.test(SRC), 'duplicates are still detected (read-only useMemo)');
ok(/\$\{a\.name\.trim\(\)\.toLowerCase\(\)\}\|\$\{a\.type\}/.test(SRC), 'duplicate key stays name + TYPE (same name, different type is never a duplicate)');
ok(/\{duplicateGroups\.length > 0 && \(/.test(SRC), 'banner shows whenever duplicates exist');
ok(!/society\.fyLocked && duplicateGroups/.test(SRC), 'banner is no longer gated on FY lock');

const btnIdx = SRC.indexOf("{hi ? 'मर्ज करें' : 'Merge'}");
const btnOpen = SRC.lastIndexOf('<Button', btnIdx);
const BTN = btnIdx > 0 && btnOpen > 0 ? SRC.slice(btnOpen, btnIdx) : '';
ok(BTN !== '', 'Merge button still rendered');
ok(/\bdisabled\b/.test(BTN) && !/onClick/.test(BTN), 'Merge button is disabled and has no onClick');

console.log(`ledgerheads-no-auto-merge: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
