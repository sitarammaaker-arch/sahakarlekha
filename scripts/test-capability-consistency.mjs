// Capability Consistency Test — production safety net (development-time only).
//
// PURPOSE: guarantee that future developers cannot silently introduce capability
// mismatches between the four surfaces that must always agree:
//   1. ProtectedRoute routes (App.tsx)        — what is reachable
//   2. MODULE_CATALOG (navigation engine SSOT) — what the engine knows about
//   3. Sidebar navigation                      — what is shown
//   4. Global Search                           — what is reachable via search
//
// RUNTIME IMPACT: none. This is a separate Node process that only READS source
// files and IMPORTS real modules. It writes nothing, generates no cache, and does
// not depend on the running application. Run: node scripts/test-capability-consistency.mjs
//
// SOURCING POLICY (least-parsing): real runtime modules are imported whenever
// possible (MODULE_CATALOG, getVisibleGroups). Source text is parsed ONLY for the
// three surfaces that expose no importable data — App.tsx route JSX, GlobalSearch
// string literals, and Sidebar structure.
//
// FAIL-CLOSED: if MODULE_CATALOG (or the nav engine) cannot be imported, the test
// prints why and exits 1. It never falls back to parsing the catalog.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — the single place to maintain when the project evolves.
// All verification logic below consumes this object; no constants are scattered.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Routes intentionally NOT in MODULE_CATALOG but legitimately reachable for all
  // societies (ungated by design). A ProtectedRoute absent from the catalog is only
  // allowed if it appears here. Keep this list as small as possible.
  UNIVERSAL_ROUTES: [],

  // Anti-false-positive sentinels: a known route that MUST appear in each dataset,
  // proving the import/parse actually produced data (not an empty/malformed result).
  SENTINEL_ROUTES: {
    protectedRoutes: '/dashboard',
    catalog: '/dashboard',
    visibleGroups: '/dashboard',
  },

  // Known Global Search navigation targets that MUST be present (sentinel for the
  // search-target parse).
  REQUIRED_GLOBAL_SEARCH_TARGETS: ['/vouchers'],

  // Real runtime modules to import (relative to project root).
  MODULES: {
    moduleCatalog: 'src/lib/navigation/moduleCatalog.ts',
    navVisibility: 'src/lib/navigation/navVisibility.ts',
  },

  // Source files parsed as text (no importable data exists for these).
  SOURCE_FILES: {
    app: 'src/App.tsx',
    globalSearch: 'src/components/GlobalSearch.tsx',
    sidebar: 'src/components/layout/Sidebar.tsx',
  },
};

// Project root = parent of this script's directory (scripts/..). Path-independent
// of the current working directory for determinism.
const ROOT = new URL('..', import.meta.url);
const abs = (rel) => new URL(rel, ROOT);
const readSource = (rel) => readFileSync(fileURLToPath(abs(rel)), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Reporter — three explicit levels. WARNING never suppresses FAIL.
// ─────────────────────────────────────────────────────────────────────────────
const report = { pass: 0, warn: [], fail: [] };
const pass = (msg) => { report.pass++; console.log('  PASS   ', msg); };
const warn = (msg) => { report.warn.push(msg); console.log('  WARNING', msg); };
const fail = (msg) => { report.fail.push(msg); console.error('  FAIL   ', msg); };
// ok(cond): PASS when true, FAIL when false.
const ok = (cond, msg) => { if (cond) pass(msg); else fail(msg); };

// ─────────────────────────────────────────────────────────────────────────────
// Pure comparison helpers (self-tested below before use).
// ─────────────────────────────────────────────────────────────────────────────
/** Values that appear more than once. */
function duplicates(arr) {
  const seen = new Set(), dup = new Set();
  for (const v of arr) { if (seen.has(v)) dup.add(v); else seen.add(v); }
  return [...dup];
}
/** Items not present in `allowed` (a Set). */
function missingFrom(items, allowed) {
  return items.filter((x) => !allowed.has(x));
}
/** For each catalog route: how many app routes map to it → orphans (0) and dups (>1). */
function mapExactlyOnce(catalogRoutes, appPaths) {
  const orphans = [], dupMapped = [];
  for (const route of catalogRoutes) {
    const n = appPaths.filter((p) => p === route).length;
    if (n === 0) orphans.push(route);
    else if (n > 1) dupMapped.push(route);
  }
  return { orphans, dupMapped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-test: prove every comparison helper detects drift before trusting it.
// Runs on synthetic inputs only; touches no project data.
// ─────────────────────────────────────────────────────────────────────────────
function selfTest() {
  const errs = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  if (!eq(duplicates(['a', 'b', 'a']), ['a'])) errs.push('duplicates() should detect a repeated value');
  if (duplicates(['a', 'b']).length !== 0) errs.push('duplicates() should be empty when unique');

  if (!eq(missingFrom(['/x', '/y'], new Set(['/y'])), ['/x'])) errs.push('missingFrom() should flag the missing item');
  if (missingFrom(['/y'], new Set(['/y'])).length !== 0) errs.push('missingFrom() should be empty when covered');

  const m = mapExactlyOnce(['/a', '/b'], ['/a', '/a']); // /a duplicated, /b orphaned
  if (!eq(m.orphans, ['/b'])) errs.push('mapExactlyOnce() should detect an orphan catalog route');
  if (!eq(m.dupMapped, ['/a'])) errs.push('mapExactlyOnce() should detect a duplicate mapping');
  const clean = mapExactlyOnce(['/a', '/b'], ['/a', '/b']);
  if (clean.orphans.length || clean.dupMapped.length) errs.push('mapExactlyOnce() should pass a 1:1 mapping');

  if (errs.length) {
    console.error('SELF-TEST FAILED — the test harness itself is broken:');
    for (const e of errs) console.error('  FAIL   ', e);
    return false;
  }
  console.log('  PASS    self-test: comparison helpers detect drift');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text extractors (only for surfaces with no importable data).
// Each returns a list; callers guard for emptiness + sentinels so a broken parse
// fails loudly instead of passing vacuously.
// ─────────────────────────────────────────────────────────────────────────────
/** All <Route path="..." element={<ProtectedRoute>...} paths in App.tsx. */
function extractProtectedRoutePaths(appSrc) {
  const re = /<Route\s+path="([^"]+)"\s+element=\{<ProtectedRoute>/g;
  const out = [];
  let m;
  while ((m = re.exec(appSrc)) !== null) out.push(m[1]);
  return out;
}
/** Count of <ProtectedRoute> opening tags — cross-check against extracted paths. */
function countProtectedRouteTags(appSrc) {
  return (appSrc.match(/<ProtectedRoute>/g) || []).length;
}
/** GlobalSearch navigation targets: go('/path') / navigate('/path') string literals. */
function extractGlobalSearchTargets(searchSrc) {
  const re = /(?:go|navigate)\(\s*'([^']+)'\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(searchSrc)) !== null) out.push(m[1].split('?')[0].split('#')[0]);
  return [...new Set(out)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Capability Consistency Test\n');

  if (!selfTest()) process.exit(1);

  // Enable Node to resolve the codebase's extensionless relative TypeScript imports
  // (e.g. import { MODULE_CATALOG } from './moduleCatalog'). In-process, in-file loader
  // via a data: URL — no extra files, no dependencies, no runtime edits.
  register(
    'data:text/javascript,' +
      encodeURIComponent(`
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
      `),
  );

  // FAIL-CLOSED import of the real runtime modules. No catalog parsing fallback.
  let MODULE_CATALOG, getVisibleGroups;
  try {
    ({ MODULE_CATALOG } = await import(abs(CONFIG.MODULES.moduleCatalog).href));
    ({ getVisibleGroups } = await import(abs(CONFIG.MODULES.navVisibility).href));
  } catch (e) {
    console.error('\nFAIL    Could not import the real navigation modules.');
    console.error('        ' + String(e && e.message ? e.message : e).split('\n')[0]);
    console.error('        This test imports TypeScript directly and requires Node with native');
    console.error('        TypeScript support (Node >= 23.6, or >= 22.6 with --experimental-strip-types).');
    console.error('        Refusing to fall back to parsing the catalog. Failing closed.');
    process.exit(1);
  }
  if (!Array.isArray(MODULE_CATALOG) || typeof getVisibleGroups !== 'function') {
    console.error('\nFAIL    Imported modules did not expose the expected shape (MODULE_CATALOG / getVisibleGroups).');
    process.exit(1);
  }

  // ── Build datasets ──────────────────────────────────────────────────────────
  const catalogRoutes = MODULE_CATALOG.map((m) => m.route);
  const catalogIds = MODULE_CATALOG.map((m) => m.id);
  const catalogRouteSet = new Set(catalogRoutes);
  const universalSet = new Set(CONFIG.UNIVERSAL_ROUTES);
  const allowedSet = new Set([...catalogRoutes, ...CONFIG.UNIVERSAL_ROUTES]);

  const appSrc = readSource(CONFIG.SOURCE_FILES.app);
  const protectedPaths = extractProtectedRoutePaths(appSrc);
  const protectedTagCount = countProtectedRouteTags(appSrc);

  const searchSrc = readSource(CONFIG.SOURCE_FILES.globalSearch);
  const searchTargets = extractGlobalSearchTargets(searchSrc);

  const sidebarSrc = readSource(CONFIG.SOURCE_FILES.sidebar);

  // getVisibleGroups output under a super-admin context = every catalog module.
  const superAdminCtx = { societyType: 'other', capabilities: new Set(), hasRole: () => true, superAdminShowAll: true };
  const visibleRoutes = getVisibleGroups(superAdminCtx).flatMap((g) => g.items.map((i) => i.route));

  // ── Anti-false-positive guards (extraction sanity) ───────────────────────────
  console.log('\n[ extraction sanity ]');
  ok(MODULE_CATALOG.length > 0, `MODULE_CATALOG imported (${MODULE_CATALOG.length} modules)`);
  ok(protectedPaths.length > 0, `ProtectedRoute paths extracted (${protectedPaths.length})`);
  ok(
    protectedPaths.length === protectedTagCount,
    `ProtectedRoute path count (${protectedPaths.length}) matches <ProtectedRoute> tag count (${protectedTagCount}) — parser not drifting`,
  );
  ok(searchTargets.length > 0, `GlobalSearch targets extracted (${searchTargets.length})`);
  ok(visibleRoutes.length > 0, `getVisibleGroups() produced routes (${visibleRoutes.length})`);

  // ── Sentinels (a known route must appear in each dataset) ────────────────────
  console.log('\n[ sentinels ]');
  ok(protectedPaths.includes(CONFIG.SENTINEL_ROUTES.protectedRoutes), `sentinel ${CONFIG.SENTINEL_ROUTES.protectedRoutes} present in ProtectedRoute paths`);
  ok(catalogRouteSet.has(CONFIG.SENTINEL_ROUTES.catalog), `sentinel ${CONFIG.SENTINEL_ROUTES.catalog} present in MODULE_CATALOG`);
  ok(visibleRoutes.includes(CONFIG.SENTINEL_ROUTES.visibleGroups), `sentinel ${CONFIG.SENTINEL_ROUTES.visibleGroups} present in getVisibleGroups() output`);
  for (const t of CONFIG.REQUIRED_GLOBAL_SEARCH_TARGETS) {
    ok(searchTargets.includes(t), `required GlobalSearch target ${t} present`);
  }

  // ── Check 1: Route coverage ──────────────────────────────────────────────────
  console.log('\n[ 1. route coverage ]');
  const uncovered = missingFrom(protectedPaths, allowedSet);
  ok(uncovered.length === 0, uncovered.length === 0
    ? 'every ProtectedRoute is in MODULE_CATALOG or UNIVERSAL_ROUTES'
    : `ProtectedRoute(s) not in catalog or allow-list: ${uncovered.join(', ')}`);

  // ── Check 2: Catalog coverage (orphans + duplicate mappings) ─────────────────
  console.log('\n[ 2. catalog coverage ]');
  const { orphans, dupMapped } = mapExactlyOnce(catalogRoutes, protectedPaths);
  ok(orphans.length === 0, orphans.length === 0
    ? 'every catalog route is reachable by an application route'
    : `orphan catalog route(s) with no ProtectedRoute: ${orphans.join(', ')}`);
  ok(dupMapped.length === 0, dupMapped.length === 0
    ? 'every catalog route maps to exactly one application route'
    : `catalog route(s) mapped by multiple application routes: ${dupMapped.join(', ')}`);

  // ── Check 3: Sidebar consistency ─────────────────────────────────────────────
  console.log('\n[ 3. sidebar consistency ]');
  ok(/useNavigation/.test(sidebarSrc), 'Sidebar sources its items from useNavigation (catalog-driven)');
  const hardcodedLinks = (sidebarSrc.match(/to="\/[^"]*"/g) || []);
  ok(hardcodedLinks.length === 0, hardcodedLinks.length === 0
    ? 'Sidebar has no hardcoded route links (cannot render off-catalog items)'
    : `Sidebar contains hardcoded route link(s): ${hardcodedLinks.join(', ')}`);
  const visibleOffCatalog = missingFrom(visibleRoutes, catalogRouteSet);
  ok(visibleOffCatalog.length === 0, visibleOffCatalog.length === 0
    ? 'getVisibleGroups() emits only catalog routes (engine is catalog-bound)'
    : `getVisibleGroups() emitted non-catalog route(s): ${visibleOffCatalog.join(', ')}`);

  // ── Check 4: Global Search consistency ───────────────────────────────────────
  console.log('\n[ 4. global search consistency ]');
  const searchOffCatalog = missingFrom(searchTargets, allowedSet);
  ok(searchOffCatalog.length === 0, searchOffCatalog.length === 0
    ? 'every GlobalSearch target is in MODULE_CATALOG or UNIVERSAL_ROUTES'
    : `GlobalSearch target(s) not in catalog or allow-list: ${searchOffCatalog.join(', ')}`);

  // ── Check 5: Duplicate detection ─────────────────────────────────────────────
  console.log('\n[ 5. duplicate detection ]');
  const dupAppPaths = duplicates(protectedPaths);
  const dupCatalogIds = duplicates(catalogIds);
  const dupCatalogRoutes = duplicates(catalogRoutes);
  ok(dupAppPaths.length === 0, dupAppPaths.length === 0 ? 'no duplicate ProtectedRoute paths' : `duplicate ProtectedRoute path(s): ${dupAppPaths.join(', ')}`);
  ok(dupCatalogIds.length === 0, dupCatalogIds.length === 0 ? 'no duplicate catalog module ids' : `duplicate catalog id(s): ${dupCatalogIds.join(', ')}`);
  ok(dupCatalogRoutes.length === 0, dupCatalogRoutes.length === 0 ? 'no duplicate catalog routes' : `duplicate catalog route(s): ${dupCatalogRoutes.join(', ')}`);

  // ── Check 6: Allow-list discipline ───────────────────────────────────────────
  // A UNIVERSAL_ROUTES entry that is also in the catalog is contradictory/masking → FAIL.
  // A UNIVERSAL_ROUTES entry that matches no ProtectedRoute is stale (harmless) → WARNING.
  console.log('\n[ 6. allow-list discipline ]');
  const protectedSet = new Set(protectedPaths);
  for (const r of CONFIG.UNIVERSAL_ROUTES) {
    if (catalogRouteSet.has(r)) {
      fail(`UNIVERSAL_ROUTES entry ${r} is ALSO in MODULE_CATALOG (contradictory — it would mask a real catalog route)`);
    } else if (!protectedSet.has(r)) {
      warn(`UNIVERSAL_ROUTES entry ${r} matches no ProtectedRoute (stale allow-list entry — safe to remove)`);
    } else {
      pass(`UNIVERSAL_ROUTES entry ${r} is a real, intentionally-universal ProtectedRoute`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`${report.pass} PASS, ${report.warn.length} WARNING, ${report.fail.length} FAIL`);
  if (report.fail.length) {
    console.error('\nRESULT: FAIL — capability consistency violation(s) detected (see FAIL lines above).');
    process.exit(1);
  }
  if (report.warn.length) {
    console.log('\nRESULT: PASS (with warnings) — no consistency violations; warnings are advisory.');
  } else {
    console.log('\nRESULT: PASS — all surfaces are consistent.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('\nFAIL    Unexpected error while running the consistency test:');
  console.error('        ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 3).join('\n        '));
  process.exit(1);
});
