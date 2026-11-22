// SEO-02 (product audit 2026-11-17): the Hindi glossary page was mostly English — definition, why, misconceptions and
// learning objectives came from the English KI fields; only the "हिन्दी में" paragraph was Hindi (avg 71% Latin
// script, 89% of its words shared with the /en twin). A KI now carries its Hindi text under four Hindi labels
// (**परिभाषा:**, **क्यों ज़रूरी:**, **आम गलतफ़हमियाँ:**, **सीखने के लक्ष्य:**); the Hindi page (React + static HTML)
// uses them, keeps the English definition in one card, and falls back to English for a KI without them.
// Run: node scripts/test-seo02-glossary-hindi.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── wiring ──
const parser = read('src/content/glossary/index.ts');
ok(["definitionHi: plainText(getSection(sections, 'परिभाषा'))", "whyHi: plainText(getSection(sections, 'क्यों ज़रूरी'))", "misconceptionsHi: getSection(sections, 'आम गलतफ़हमियाँ')", "learningObjectivesHi: getSection(sections, 'सीखने के लक्ष्य')"].every((x) => parser.includes(x)), 'the parser reads the four Hindi fields');
const page = read('src/pages/GlossaryTerm.tsx');
ok(page.includes("const hiText = language === 'hi' && !!term.definitionHi;") && page.includes('{hiText ? term.definitionHi : term.definition}') && page.includes('pick(term.whyHi, term.why)') && page.includes('pick(term.misconceptionsHi, term.misconceptions)') && page.includes('pick(term.learningObjectivesHi, term.learningObjectives)'), 'GlossaryTerm shows the Hindi fields on the Hindi page (English page unchanged)');
const pre = read('scripts/prerender-guide.mjs');
ok(pre.includes("(s['परिभाषा'] ? glossaryHindiBody(s, def) : (") && pre.includes('function glossaryHindiBody(s, def)'), 'the static Hindi glossary page uses the Hindi fields too');

// ── content ──
const DIR = join(ROOT, 'docs/kpp/wave-1-active');
const kis = readdirSync(DIR).filter((f) => /^KI-\d+-.+\.md$/.test(f));
const devanagariShare = (s) => { const L = s.replace(/[^A-Za-zऀ-ॿ]/g, ''); return L ? L.replace(/[^ऀ-ॿ]/g, '').length / L.length : 0; };
const field = (src, label) => (src.match(new RegExp(`\\*\\*${label}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[^*\\n]+?:\\*\\*|$)`)) || [])[1]?.trim() || '';
const done = [];
for (const f of kis) {
  const src = readFileSync(join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  if (!src.includes('**परिभाषा:**')) continue;
  done.push(f);
  const parts = ['परिभाषा', 'क्यों ज़रूरी', 'आम गलतफ़हमियाँ', 'सीखने के लक्ष्य'].map((l) => field(src, l));
  ok(parts.every(Boolean), `${f}: all four Hindi fields are present`);
  ok(parts.every((p) => devanagariShare(p) >= 0.7), `${f}: each Hindi field is mostly Devanagari (${parts.map((p) => devanagariShare(p).toFixed(2)).join(', ')})`);
  ok(src.indexOf('**परिभाषा:**') < src.indexOf('**Related concepts:**'), `${f}: the Hindi block sits before Related concepts (the English fields keep their boundaries)`);
}
ok(done.length === kis.length, `every KI carries its Hindi text — a new term needs the four Hindi fields too (${done.length} of ${kis.length})`);

// ── built pages (when dist/ exists) ──
if (existsSync(join(ROOT, 'dist/glossary'))) {
  const text = (p) => { const f = join(ROOT, 'dist', p, 'index.html'); if (!existsSync(f)) return ''; return ((readFileSync(f, 'utf8').match(/<main[\s\S]*?<\/main>/) || [''])[0]).replace(/<nav[\s\S]*?<\/nav>/g, ' ').replace(/<footer[\s\S]*?<\/footer>/g, ' ').replace(/<[^>]+>/g, ' '); };
  for (const f of done) {
    const slug = f.replace(/^KI-\d+-/, '').replace(/\.md$/, '');
    const hi = text(`glossary/${slug}`);
    ok(hi && 1 - devanagariShare(hi) < 0.4, `/glossary/${slug}: under 40% Latin script (now ${((1 - devanagariShare(hi)) * 100).toFixed(0)}%)`);
  }
} else {
  console.log('  (dist/ not built — page checks skipped)');
}

console.log(`SEO-02 Hindi glossary: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
