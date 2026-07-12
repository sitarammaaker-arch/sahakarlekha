// Federation graph + consolidation as re-projection (T-34 / ADR-0009; INV-6).
//
// Proves:
//   • the tier graph is validated — no cycles, parents exist, children roll up into HIGHER tiers;
//   • consolidation rolls up the subtree as a re-projection over already-projected aggregates
//     (exact money), so residency is honored — totals roll up, data scopes down;
//   • inter-entity balances net out; a primary→district→state roll-up reconciles (INV-6).
//
// Run: node scripts/test-federation.mjs   (npm run test:federation)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// consolidation.ts imports '../money' and './graph' (relative, no ext) — resolve them.
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
      for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
        const u = new URL(cand, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  }
`));

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let G, C;
try {
  G = await import(abs('../src/lib/federation/graph.ts'));
  C = await import(abs('../src/lib/federation/consolidation.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the federation modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { validateGraph, descendants, subtree, ancestorPath } = G;
const { consolidate, eliminateInterEntity, isResidencySafe, rollUp } = C;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A small pyramid: 2 primaries → 1 district → 1 state (apex).
const nodes = [
  { id: 'state-HR', tier: 'state', jurisdiction: 'Haryana' },
  { id: 'dist-1', tier: 'district', jurisdiction: 'Haryana', parentId: 'state-HR' },
  { id: 'pacs-1', tier: 'primary', jurisdiction: 'Haryana', parentId: 'dist-1' },
  { id: 'pacs-2', tier: 'primary', jurisdiction: 'Haryana', parentId: 'dist-1' },
];

// ── 1. GRAPH VALIDATION (INV-6) ──────────────────────────────────────────────
ok(validateGraph(nodes).ok, 'a well-formed pyramid validates');
const inverted = [{ id: 'a', tier: 'state', jurisdiction: 'HR', parentId: 'b' }, { id: 'b', tier: 'primary', jurisdiction: 'HR' }];
ok(!validateGraph(inverted).ok, 'a state rolling up into a primary is rejected (tiers must point up)');
const cyclic = [{ id: 'a', tier: 'district', jurisdiction: 'HR', parentId: 'b' }, { id: 'b', tier: 'district', jurisdiction: 'HR', parentId: 'a' }];
ok(!validateGraph(cyclic).ok, 'a cycle is detected');
ok(!validateGraph([{ id: 'x', tier: 'primary', jurisdiction: 'HR', parentId: 'ghost' }]).ok, 'an unknown parent is rejected');

// ── 2. TRAVERSALS ────────────────────────────────────────────────────────────
ok(descendants(nodes, 'dist-1').map((n) => n.id).sort().join(',') === 'pacs-1,pacs-2', 'descendants of the district are its two primaries');
ok(descendants(nodes, 'state-HR').length === 3, 'descendants of the state are the district + both primaries');
ok(subtree(nodes, 'dist-1').map((n) => n.id).sort().join(',') === 'dist-1,pacs-1,pacs-2', 'the subtree includes the root');
ok(ancestorPath(nodes, 'pacs-1').map((n) => n.id).join(',') === 'dist-1,state-HR', 'a primary’s lineage is district → state');

// ── 3. CONSOLIDATION as re-projection (exact money) ──────────────────────────
const contributions = {
  'pacs-1': { societyId: 'pacs-1', jurisdiction: 'Haryana', balances: { '4101': 500000, '5101': -300000 } },
  'pacs-2': { societyId: 'pacs-2', jurisdiction: 'Haryana', balances: { '4101': 250000, '1101': 100000 } },
  'dist-1': { societyId: 'dist-1', jurisdiction: 'Haryana', balances: { '4101': 100000 } },
};
const distRoll = rollUp(nodes, 'dist-1', contributions);
ok(distRoll['4101'] === 850000 && distRoll['5101'] === -300000 && distRoll['1101'] === 100000,
  'the district roll-up sums each account across its subtree exactly (primary→district, INV-6)');
// a direct consolidate matches.
ok(consolidate([contributions['pacs-1'], contributions['pacs-2']])['4101'] === 750000, 'consolidate sums per account');

// ── 4. INTER-ENTITY ELIMINATION ──────────────────────────────────────────────
// suppose 100000 of dist-1's 4101 is an intra-group transfer to be eliminated.
const eliminated = eliminateInterEntity(distRoll, [{ accountId: '4101', amount: 100000 }]);
ok(eliminated['4101'] === 750000, 'an intra-group balance nets out of the consolidated total (inter-entity awareness)');
ok(eliminated['1101'] === 100000, 'unrelated accounts are unaffected by elimination');

// ── 5. RESIDENCY-SAFE (aggregates only) ──────────────────────────────────────
ok(isResidencySafe(Object.values(contributions)), 'contributions of integer-minor aggregates are residency-safe (totals roll up, PII stays down)');
ok(!isResidencySafe([{ societyId: 's', jurisdiction: 'HR', balances: { name: 'Rajesh' } }]),
  'a contribution carrying a non-aggregate (e.g. a name) is NOT residency-safe — raw PII must never roll up');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['graph.ts', 'graph'], ['consolidation.ts', 'consolidation']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'federation', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `federation/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nFederation graph + consolidation: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
