// CAIOS Slice 0 — the /ask evaluation harness.
//
// Produces THE baseline number: of the questions a society secretary actually asks,
// how many does /ask answer with the right source, today, with no AI at all?
// Every later claim that the assistant "got better" is measured against this. Without
// it, an improvement is a feeling (blueprint §8, Slice 0).
//
// WHAT IT MEASURES: the REAL production `search()` from src/lib/siteSearch.ts over the
// REAL corpus — not a copy of the ranker. siteSearch is Vite-only (the content
// registries use `import.meta.glob`), so it is loaded through scripts/lib/vite-bundle.mjs,
// which rewrites the globs and runs the module unmodified. The scoring code measured
// here is byte-for-byte the code that ships; see that file for the honest limits.
//
// Run: node scripts/eval-ask.mjs            (npm run eval:ask)
//      node scripts/eval-ask.mjs --verbose  (per-case detail)
//      node scripts/eval-ask.mjs --fails    (only the failures — the work list)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = resolve(ROOT, 'scripts', 'eval', 'golden-ask.json');
const SITE_SEARCH = resolve(ROOT, 'src', 'lib', 'siteSearch.ts');

const ARGV = new Set(process.argv.slice(2));
const VERBOSE = ARGV.has('--verbose');
const FAILS_ONLY = ARGV.has('--fails');

/* AskAssistant.tsx:42 calls search(q, 8) and renders results[0] as "the answer",
   results[1..5] as related. The harness must ask exactly what the page asks. */
const LIMIT = 8;
const RELATED_DEPTH = 6;

const pad = (s, n) => String(s).padEnd(n);
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');
const bar = (n, d, w = 28) => {
  const f = d ? Math.round((n / d) * w) : 0;
  return '█'.repeat(f) + '░'.repeat(w - f);
};

async function main() {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const { search } = await loadViteModule(ROOT, SITE_SEARCH, 'eval');

  // Sanity: if the KI corpus did not load, every number below would be meaningless.
  const probe = search('सहकारी समिति', 50);
  const glossaryDocs = probe.filter((r) => r.type === 'glossary').length;
  if (!probe.length) {
    console.error('\n  ✗ search() returned nothing for a known term — the index did not build.');
    console.error('    The baseline would be a lie. Refusing to print numbers.\n');
    process.exit(1);
  }

  const answers = golden.cases.filter((c) => c.expect === 'answer');
  const guards = golden.cases.filter((c) => c.expect === 'no-assert');

  const R = { top1: [], top5: [], missed: [], empty: [], guardOk: [], guardMiss: [] };

  for (const c of answers) {
    const hits = search(c.q, LIMIT);
    const ok = (r) => c.want.includes(r.id) || (c.okTypes || []).includes(r.type);
    if (!hits.length) { R.empty.push({ c }); R.missed.push({ c, got: null }); continue; }
    if (ok(hits[0])) R.top1.push({ c, got: hits[0] });
    else if (hits.slice(0, RELATED_DEPTH).some(ok)) R.top5.push({ c, got: hits[0] });
    else R.missed.push({ c, got: hits[0] });
  }

  for (const c of guards) {
    const hits = search(c.q, LIMIT);
    // HONEST LIMIT OF THIS METRIC: it counts whether a regulated specific reaches the
    // guard at all — NOT whether the system lied. Today search cannot fabricate a rate;
    // it only surfaces documents. Showing the GST calculator for "GST की दर क्या है" is
    // a good answer, not an assertion. So a hit here is a case Slice 1's guard must
    // CLASSIFY (assert / hedge / route), not a bug to be counted. Do not read this row
    // as a defect count.
    if (!hits.length) R.guardOk.push({ c });
    else R.guardMiss.push({ c, got: hits[0] });
  }

  const nA = answers.length;
  const hit1 = R.top1.length;
  const hitAny = R.top1.length + R.top5.length;

  console.log('\n  /ask — BASELINE  (real production search(), no AI)');
  console.log('  ' + '─'.repeat(64));
  console.log(`  corpus: ${glossaryDocs > 0 ? 'KI glossary loaded' : 'NO GLOSSARY'} · golden: ${nA} answerable + ${guards.length} must-not-assert\n`);

  console.log(`  top-1 correct     ${bar(hit1, nA)}  ${pad(hit1 + '/' + nA, 8)} ${pct(hit1, nA)}%   ← THE NUMBER`);
  console.log(`  found in top ${RELATED_DEPTH}    ${bar(hitAny, nA)}  ${pad(hitAny + '/' + nA, 8)} ${pct(hitAny, nA)}%`);
  console.log(`  returned nothing  ${bar(R.empty.length, nA)}  ${pad(R.empty.length + '/' + nA, 8)} ${pct(R.empty.length, nA)}%   (AND-semantics)`);
  console.log(`  wrong answer      ${bar(R.missed.length - R.empty.length, nA)}  ${pad((R.missed.length - R.empty.length) + '/' + nA, 8)} ${pct(R.missed.length - R.empty.length, nA)}%`);
  console.log(`\n  regulated specifics — NOT a defect count (see note below)`);
  console.log(`  silent            ${bar(R.guardOk.length, guards.length)}  ${pad(R.guardOk.length + '/' + guards.length, 8)} ${pct(R.guardOk.length, guards.length)}%`);
  console.log(`  surfaced a doc    ${bar(R.guardMiss.length, guards.length)}  ${pad(R.guardMiss.length + '/' + guards.length, 8)} ${pct(R.guardMiss.length, guards.length)}%   ← Slice 1's guard must classify these`);

  if (VERBOSE || FAILS_ONLY) {
    const show = (title, rows) => {
      if (!rows.length) return;
      console.log(`\n  ${title}`);
      for (const { c, got } of rows) {
        console.log(`    ${pad(c.id, 7)} ${pad(c.q, 42)} → ${got ? `${got.id} (${got.score})` : '∅ nothing'}`);
        if (c.want) console.log(`    ${' '.repeat(7)} ${' '.repeat(42)}   want: ${c.want.join(' | ')}`);
      }
    };
    show('RETURNED NOTHING — every query token must match (siteSearch.ts:217)', R.empty);
    show('WRONG ANSWER — a real doc, but not the right one', R.missed.filter((m) => m.got));
    if (VERBOSE) show(`FOUND, BUT NOT FIRST — ranked 2..${RELATED_DEPTH}`, R.top5);
    show('REGULATED SPECIFIC, DOC SURFACED — for Slice 1 to classify, not a bug list', R.guardMiss);
  }

  console.log('\n  ' + '─'.repeat(64));
  console.log('  top-1 is THE NUMBER. Slice 3 (the model) must beat the no-model score');
  console.log('  or it does not ship. Re-run after every retrieval change; --fails');
  console.log('  prints the work list.');
  console.log('  The regulated-specifics rows are NOT a defect count: search cannot');
  console.log('  fabricate a rate, it only surfaces documents. They count how many such');
  console.log('  queries reach the guard Slice 1 adds — the guard then decides.\n');

  // Deliberately exit 0: this is a measurement, not a test. It must never block a build.
}

main().catch((e) => {
  console.error('\n  eval:ask failed —', e?.message || e, '\n');
  process.exit(1);
});
