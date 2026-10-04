// Content standards (content refresh 2026-10, Phase 4) — keeps the public learning surfaces from
// quietly thinning out or going stale again. Checks, per surface:
//   guide      — every teaching chapter ≥ 600 words; GUIDE_UPDATED dates valid and only for real chapters
//   cookbook   — worked example (Dr = Cr), use/avoid/correction, `updated`, ≥ 150 words
//   help       — ≥ 6 steps, ≥ 3 troubleshooting items, `updated`
//   calculator — ≥ 5 FAQs, a second worked example, `updated`
//   glossary   — every active term links to at least one deeper page
//   all        — no developer jargon in user-facing text; no `updated` date in the future
//
// Run: node scripts/test-content-standards.mjs   (npm run test:content-standards)
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const JARGON = /\bRULE \d|upsert|ऑडिट-फिक्स|grandTotal|canonical|DataContext|\.tsx\b|localStorage|society_users/;
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/** Bundle a TS registry (with the @/ alias from tsconfig.app.json) and return its exports. */
async function load(rel) {
  const r = await build({
    entryPoints: [resolve(ROOT, rel)], bundle: true, format: 'cjs', platform: 'node', write: false,
    tsconfig: resolve(ROOT, 'tsconfig.app.json'), logLevel: 'silent',
  });
  const m = { exports: {} };
  const noRequire = (id) => { throw new Error(`${rel}: registries must be self-contained (tried to require ${id})`); };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(m, m.exports, noRequire);
  return m.exports;
}

let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const date = (where, d) => {
  if (!d) return fail(`${where}: no "updated" date`);
  if (!ISO.test(d)) return fail(`${where}: "updated" is not YYYY-MM-DD (${d})`);
  if (d > TODAY) fail(`${where}: "updated" ${d} is in the future`);
};

// ── guide ──────────────────────────────────────────────────────────────────────────────
// Reference pages (cards, glossaries, checklists, answer keys, FAQ lists) are short by design.
const GUIDE_REFERENCE = new Set([
  'introduction', 'conclusion', 'golden-rules', 'glossary', 'account-name-glossary', 'expense-dictionary',
  'standard-chart-of-accounts', 'quick-reference-card', 'voucher-entry-quick-reference', 'society-type-quick-card',
  'report-to-statutory-form-map', 'year-end-checklist', 'troubleshooting-guide', 'exercise-answers', 'comprehensive-faq',
]);
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'scripts/guide-manifest.json'), 'utf8')).filter((e) => e && e.slug);
const guideSlugs = new Set(manifest.map((e) => e.slug));
for (const { slug } of manifest) {
  const md = readFileSync(resolve(ROOT, 'src/content/guide', `${slug}.md`), 'utf8');
  if (!GUIDE_REFERENCE.has(slug) && words(md) < 600) fail(`guide/${slug}: ${words(md)} words (< 600)`);
  const j = md.match(JARGON); if (j) fail(`guide/${slug}: developer jargon "${j[0]}"`);
}
const { GUIDE_UPDATED, GUIDE_DEFAULT_UPDATED } = await load('src/content/guide/updated.ts');
date('guide default', GUIDE_DEFAULT_UPDATED);
for (const [slug, d] of Object.entries(GUIDE_UPDATED)) {
  if (!guideSlugs.has(slug)) fail(`guide updated.ts: "${slug}" is not a chapter`);
  date(`guide/${slug}`, d);
}

// ── cookbook ───────────────────────────────────────────────────────────────────────────
const { COOKBOOK_ENTRIES } = await load('src/content/cookbook/index.ts');
for (const e of COOKBOOK_ENTRIES) {
  const w = `cookbook/${e.slug}`;
  if (!e.example || !e.example.rows?.length) { fail(`${w}: no worked example`); continue; }
  const dr = e.example.rows.reduce((a, r) => a + (r.dr || 0), 0);
  const cr = e.example.rows.reduce((a, r) => a + (r.cr || 0), 0);
  if (dr !== cr) fail(`${w}: example does not balance (Dr ${dr} ≠ Cr ${cr})`);
  for (const k of ['useWhen', 'avoidWhen', 'correction', 'inApp']) if (!e[k]) fail(`${w}: missing ${k}`);
  date(w, e.updated);
  // what the page actually shows (not meta title/description)
  const text = [e.category, e.title, e.deepLink?.label, e.scenario, e.narration, ...(e.notes || []), ...e.lines.map((l) => `${l.account} ${l.note || ''}`),
    e.example.text, ...e.example.rows.map((r) => r.account), e.useWhen, e.avoidWhen, e.correction, e.inApp].join(' ');
  if (words(text) < 150) fail(`${w}: ${words(text)} words (< 150)`);
  const j = text.match(JARGON); if (j) fail(`${w}: developer jargon "${j[0]}"`);
}

// ── help ───────────────────────────────────────────────────────────────────────────────
const { HELP_TASKS } = await load('src/content/help/index.ts');
for (const t of HELP_TASKS) {
  const w = `help/${t.slug}`;
  if ((t.steps || []).length < 6) fail(`${w}: ${(t.steps || []).length} steps (< 6)`);
  if ((t.troubleshooting || []).length < 3) fail(`${w}: ${(t.troubleshooting || []).length} troubleshooting items (< 3)`);
  date(w, t.updated);
  const j = JSON.stringify([t.tldr, t.steps, t.troubleshooting, t.faqs, t.commonMistakes]).match(JARGON);
  if (j) fail(`${w}: developer jargon "${j[0]}"`);
}

// ── calculators ────────────────────────────────────────────────────────────────────────
const { CALCULATORS } = await load('src/content/calculators/index.ts');
for (const c of CALCULATORS) {
  const w = `tools/${c.slug}`;
  if ((c.faqs || []).length < 5) fail(`${w}: ${(c.faqs || []).length} FAQs (< 5)`);
  if (!/दूसरा उदाहरण/.test(c.example || '')) fail(`${w}: no second worked example`);
  date(w, c.updated);
}

// ── glossary ───────────────────────────────────────────────────────────────────────────
const KI_DIR = resolve(ROOT, 'docs/kpp/wave-1-active');
for (const f of readdirSync(KI_DIR).filter((x) => /^KI-\d+.*\.md$/.test(x))) {
  const links = (readFileSync(resolve(KI_DIR, f), 'utf8').match(/\*\*Internal links:\*\*([^\n]*)/) || [])[1] || '';
  if (!/\/(guide|blog|help|cookbook|tools)\//.test(links)) fail(`glossary ${f}: no link to a deeper page`);
}

const counted = `${manifest.length} guide · ${COOKBOOK_ENTRIES.length} cookbook · ${HELP_TASKS.length} help · ${CALCULATORS.length} calculators`;
if (failures) { console.error(`[content-standards] ✗ ${failures} problem(s) (${counted})`); process.exit(1); }
console.log(`[content-standards] ✓ ${counted} + glossary meet the content standards`);
