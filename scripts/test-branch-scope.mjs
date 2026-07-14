// Multi-branch scoping (ECR-17 Phase 1) — imports the REAL src/lib/branchScope.ts via the '@/' loader.
// Run: node scripts/test-branch-scope.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { ALL_BRANCHES, matchesBranch, filterByBranch, branchToStamp, resolveActiveBranch } = await import(abs('../src/lib/branchScope.ts'));

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

// 6. ECR-17 Phase 4b — a branch-restricted user can never leave their branch.
ok(resolveActiveBranch('b2', ALL_BRANCHES) === 'b2', 'restricted user: request "all" collapses to home branch');
ok(resolveActiveBranch('b2', HO) === 'b2', 'restricted user: request another branch collapses to home branch');
ok(resolveActiveBranch('b2', 'b2') === 'b2', 'restricted user: request own branch stays');
ok(resolveActiveBranch(undefined, 'b2') === 'b2', 'unrestricted user: request honoured');
ok(resolveActiveBranch(undefined, ALL_BRANCHES) === ALL_BRANCHES, 'unrestricted user: "all" honoured');
ok(resolveActiveBranch('', HO) === HO, 'empty restriction = unrestricted → request honoured');

console.log(`\nBranch scope (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
