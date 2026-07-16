// Generate src/generated/search-index.json — the corpus the CAIOS ask-core serves.
//
// WHY: the Edge Function cannot import siteSearch.ts (Vite globs) and must not
// re-implement buildIndex() — a second corpus builder would drift, and the day it
// drifted the assistant and the search box would disagree in front of a user
// (RULE 2's exact failure mode). So we run the REAL buildIndex() here, at build
// time, and freeze its output. One builder, two consumers.
//
// The artifact is generated, never hand-edited, and never the source of truth: the
// KI markdown under docs/kpp/wave-1-active/ is. Regenerate with `npm run build:search-index`.
//
// Run: node scripts/build-search-index.mjs   (npm run build:search-index)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src', 'generated', 'search-index.json');

const mod = await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'siteSearch.ts'), 'eval');
const docs = mod.buildIndex();

// The relative-glob shim returns {} (see lib/vite-bundle.mjs), so assert on what we
// actually got rather than trusting it. A silently-empty corpus would ship an
// assistant that knows nothing and says so politely — the worst possible failure.
const byType = docs.reduce((a, d) => ((a[d.type] = (a[d.type] || 0) + 1), a), {});
const required = ['glossary', 'help', 'cookbook', 'faq', 'guide', 'blog', 'calculator'];
const missing = required.filter((t) => !byType[t]);
if (missing.length) {
  console.error(`\n  ✗ search-index: no docs of type ${missing.join(', ')} — refusing to write a corpus with a hole in it.\n`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
// Not pretty-printed: this is a machine artifact bundled into an Edge Function, and
// the diff noise of 200+ reformatted docs would bury real content changes in review.
writeFileSync(OUT, JSON.stringify({ version: 1, builtFrom: 'src/lib/siteSearch.ts buildIndex()', docs }), 'utf8');

const kb = (JSON.stringify(docs).length / 1024).toFixed(0);
console.log(`\n  search-index → src/generated/search-index.json`);
console.log(`  ${docs.length} docs, ${kb} KB · ` + required.map((t) => `${t} ${byType[t]}`).join(' · ') + '\n');
