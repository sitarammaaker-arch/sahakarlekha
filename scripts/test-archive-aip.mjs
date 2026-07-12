// OAIS archival packages (T-37 / DP Strategy AR-2, AR-3, AR-5; DP-P1, DP-P5, LT-3).
//
// Proves the archive survives 25 years:
//   • an AIP is self-sufficient — content + representation info + provenance + fixity (AR-2/DP-P1);
//   • preservation hygiene — UTF-8/Devanagari-safe text, ISO-8601 dates (AR-3/LT-3/RULE 8);
//   • fixity is verified — tampering/bit-rot detectable (DP-P5);
//   • forward migration retains the original + provenance; a non-forward migration is refused (AR-5).
//
// Run: node scripts/test-archive-aip.mjs   (npm run test:archive-aip)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// aip.ts imports '../backup/integrity' (relative, no ext) — resolve it.
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

let A;
try {
  A = await import(abs('../src/lib/archive/aip.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the archive/aip module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildAIP, isSelfSufficient, assertPreservationHygiene, verifyFixity, migrateForward } = A;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const rep = { contractVersion: 'v1', rendering: 'PDF/A', encoding: 'UTF-8', dateFormat: 'ISO-8601' };
const aip = buildAIP({
  id: 'aip-FY2025-26', scope: 'FY2025-26',
  content: { events: 'events-blob', statements: 'statements-blob' },
  representation: rep,
  origin: 'SOC-1', ledgerAnchor: 'evt:9999', createdAt: '2026-07-12T00:00:00Z',
  fixity: { events: 'dig-ev-1', statements: 'dig-st-1' },
});

// ── 1. SELF-SUFFICIENT (AR-2/DP-P1) ──────────────────────────────────────────
ok(aip.stage === 'AIP' && aip.provenance.migrations.length === 0, 'buildAIP yields an AIP with an empty migration history');
ok(isSelfSufficient(aip).ok, 'a complete AIP is self-sufficient — a reader needs nothing else');
const noAnchor = { ...aip, provenance: { ...aip.provenance, ledgerAnchor: '' } };
ok(!isSelfSufficient(noAnchor).ok && isSelfSufficient(noAnchor).missing.includes('provenance.ledgerAnchor'),
  'an AIP with no ledger anchor is NOT self-sufficient (legal admissibility, AR-7)');
const noFixity = { ...aip, fixity: { events: 'dig-ev-1' } };
ok(!isSelfSufficient(noFixity).ok && isSelfSufficient(noFixity).missing.includes('fixity.statements'),
  'every content part must carry a fixity digest');

// ── 2. HYGIENE (AR-3/LT-3/RULE 8) ────────────────────────────────────────────
ok(assertPreservationHygiene(rep).ok, 'UTF-8 + ISO-8601 passes preservation hygiene');
ok(!assertPreservationHygiene({ ...rep, encoding: 'CP1252' }).ok, 'a non-Unicode encoding is refused (guaranteed Devanagari loss)');
ok(!assertPreservationHygiene({ ...rep, dateFormat: 'DD/MM/YYYY' }).ok, 'an ambiguous date format is refused');
ok(assertPreservationHygiene({ ...rep, encoding: 'utf-8' }).ok, 'the encoding check is case-insensitive');

// ── 3. FIXITY (DP-P5) ────────────────────────────────────────────────────────
ok(verifyFixity(aip, { events: 'dig-ev-1', statements: 'dig-st-1' }), 'matching digests verify the archive');
ok(!verifyFixity(aip, { events: 'dig-ev-1', statements: 'TAMPERED' }), 'a mismatched digest fails — corruption/tampering is detectable');
ok(!verifyFixity(aip, { events: 'dig-ev-1' }), 'a missing digest fails (no silent pass)');

// ── 4. FORWARD MIGRATION (AR-5/LT-4) ─────────────────────────────────────────
const mig = migrateForward(aip, 'v2', 'migrator-1.0', '2030-01-01T00:00:00Z',
  { events: 'events-v2', statements: 'statements-v2' }, { events: 'dig-ev-2', statements: 'dig-st-2' });
ok(mig.ok && mig.aip.representation.contractVersion === 'v2', 'a forward migration bumps the contract version');
ok(mig.aip.provenance.migrations.length === 1 && mig.aip.provenance.migrations[0].fromVersion === 'v1' &&
   mig.aip.provenance.migrations[0].originalDigest === 'dig-ev-1',
  'the migration record retains the ORIGINAL fixity — the original is provably kept (no silent obsolescence)');
ok(mig.aip.provenance.createdAt === aip.provenance.createdAt, 'the original creation provenance is preserved across migration');
const backward = migrateForward(mig.aip, 'v1', 't', '2031-01-01', { events: 'x', statements: 'y' }, { events: 'd', statements: 'e' });
ok(!backward.ok && /forward/.test(backward.reason), 'a backward (or equal) migration is refused — archives only move forward');
ok(!migrateForward(aip, 'v1', 't', '2031-01-01', aip.content, aip.fixity).ok, 'migrating to the same version is refused');

// ── 5. CONTINUITY DOC exists (VI-6) ──────────────────────────────────────────
const doc = readFileSync(pathResolve(SRC, '..', 'docs', 'architecture', 'ORG-CONTINUITY-HANDOVER.md'), 'utf8');
ok(/Custodial-Handover/.test(doc) && /VI-6/.test(doc) && /Candidate custodians/.test(doc),
  'the organizational-continuity handover procedure is documented (VI-6)');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'archive', 'aip.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `archive/aip is pure & does no I/O (no "${forbidden}")`);
}

console.log(`\nOAIS archival packages: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
