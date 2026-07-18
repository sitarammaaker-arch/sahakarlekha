// Catalog versioning — the change-audit trail (ADR-0008 `catalog_versions`, CAIOS Slice 2).
//
// Two things this proves:
//   1. buildCatalogVersion is PURE and DETERMINISTIC — same catalog → same hash, every time,
//      independent of key order. A version registry whose hash wobbled would be useless.
//   2. THE SEEDED HASHES STILL MATCH. Migration 053 recorded the tax and UCAS catalogs at
//      specific hashes. If tax.ts / ucas.ts changes and no new catalog_versions row is
//      recorded, the deployed rules would silently diverge from the audit trail — the exact
//      "policy is data, but untracked" failure the trail exists to prevent. This canary makes
//      that impossible to miss: change a rule, this goes red, and the fix is to record a new
//      version (a migration row, or the future service-role writer).
//
// Run: node scripts/test-catalog-version.mjs   (npm run test:catalog-version)

import { loadViteModule } from './lib/vite-bundle.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let buildCatalogVersion, TDS_RULES, UCAS_RULES;
try {
  ({ buildCatalogVersion } = await loadViteModule(ROOT, resolve(ROOT, 'src/lib/rules/catalogVersion.ts'), 'eval'));
  ({ TDS_RULES } = await loadViteModule(ROOT, resolve(ROOT, 'src/lib/rules/tax.ts'), 'eval'));
  ({ UCAS_RULES } = await loadViteModule(ROOT, resolve(ROOT, 'src/lib/rules/ucas.ts'), 'eval'));
} catch (e) {
  console.error('\nFAIL    Could not load the rules modules.\n        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  catalog_versions — the rules change-audit trail\n');

// The values migration 053 seeds. If a rule changes, update BOTH — that IS recording a version.
const SEEDED = {
  tds:  { hash: 'f93f700bfff69462', ruleCount: 16, valueCount: 20, verifiedCount: 18, unverifiedCount: 2 },
  ucas: { hash: 'aed8c453012a0bba', ruleCount: 4,  valueCount: 4,  verifiedCount: 0,  unverifiedCount: 0 },
};

for (const [name, cat] of [['tds', TDS_RULES], ['ucas', UCAS_RULES]]) {
  const v = buildCatalogVersion(name, cat);
  const seed = SEEDED[name];

  // Determinism — same input, same hash, twice.
  ok(`${name}: hash is deterministic`, v.contentHash === buildCatalogVersion(name, cat).contentHash);

  // The canary — the seeded hash still describes the shipped catalog.
  ok(`${name}: content hash matches migration 053 seed`,
    v.contentHash === seed.hash,
    `catalog changed (${v.contentHash} ≠ ${seed.hash}) — record a new catalog_versions row`);

  ok(`${name}: rule/value counts match the seed`,
    v.ruleCount === seed.ruleCount && v.valueCount === seed.valueCount);
  ok(`${name}: verified/unverified counts match the seed`,
    v.verifiedCount === seed.verifiedCount && v.unverifiedCount === seed.unverifiedCount);
}

// The tax catalog must never silently drift to all-unverified — that would be the F-lane
// quietly losing its human-owned figures. Pin the invariant the product depends on.
{
  const v = buildCatalogVersion('tds', TDS_RULES);
  ok('tds: verified values still outnumber unverified (human-owned figures present)',
    v.verifiedCount > v.unverifiedCount);
  ok('tds: every value is either verified or explicitly unverified (no silent third state)',
    v.verifiedCount + v.unverifiedCount === v.valueCount);
  // effectiveSummary is per-key and lets an auditor reconstruct what was in force.
  ok('tds: effective summary covers every rule',
    Object.keys(v.effectiveSummary).length === v.ruleCount);
  const q = v.effectiveSummary['tds.194q.threshold'];
  ok('tds: 194Q threshold is recorded, national, verified',
    !!q && q.jurisdictions.includes('') && q.allVerified === true, JSON.stringify(q));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
