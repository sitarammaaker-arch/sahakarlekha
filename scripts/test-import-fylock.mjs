// Importer FY-lock guard (RULE 6 / gap EXP-17, partial).
//
// Every state-changing action must refuse when the financial year is audit-locked. Two of
// the four bulk-import handlers (accounts, members) were missing that guard: the underlying
// add* functions bail silently when locked, so the import loop would fire a toast per row
// AND report "N imported" while nothing was written — the same "reported success, data was
// not there" class as the opening-balances localStorage bug.
//
// This is a SOURCE assertion: it proves each handler checks society.fyLocked BEFORE its
// write loop. The runtime behaviour (a locked society, an attempted import) needs a session
// and is not exercised here.
//
// Run: node scripts/test-import-fylock.mjs   (npm run test:import-fylock)

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMPORTER = pathResolve(HERE, '..', 'src', 'pages', 'UniversalImporter.tsx');
const src = readFileSync(IMPORTER, 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Each bulk-import handler, and the loop that writes its rows. The guard must sit between
// the two: `society.fyLocked` has to appear after the handler opens and before it writes.
const handlers = [
  { name: 'handleAccountImport', loop: 'for (const row of validRows)' },
  { name: 'handleMemberImport', loop: 'for (const row of validRows)' },
  { name: 'handleObImport', loop: 'for (const entry of entries)' },
  { name: 'handleVoucherImport', loop: 'for (const row of validRows)' },
];

for (const h of handlers) {
  const start = src.indexOf(`function ${h.name}(`);
  ok(start !== -1, `${h.name} exists`);
  if (start === -1) continue;

  // The first write loop AFTER this handler opens.
  const loopAt = src.indexOf(h.loop, start);
  ok(loopAt !== -1, `${h.name} has its write loop (${h.loop})`);
  if (loopAt === -1) continue;

  const head = src.slice(start, loopAt);
  ok(/if \(society\.fyLocked\)/.test(head),
    `${h.name} checks society.fyLocked BEFORE it writes (RULE 6)`);
  // And it returns out — the guard is a bail, not a log.
  const guardIdx = head.indexOf('society.fyLocked');
  ok(head.slice(guardIdx).includes('return'),
    `${h.name}'s FY-lock guard bails (returns), it does not merely warn`);
}

// The guard must precede the FIRST write in each handler — a guard placed after the loop
// would be theatre. Verified above by slicing handler-open → loop. Belt to that braces: the
// four guards are really four distinct sites, not one counted four times.
const guardCount = (src.match(/if \(society\.fyLocked\)/g) || []).length;
ok(guardCount >= 4, `at least four FY-lock guards are present (found ${guardCount})`);

console.log(`\nImporter FY-lock: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
