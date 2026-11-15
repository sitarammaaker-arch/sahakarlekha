// English content overlays must be faithful to the Hindi source (founder, 2026-11-15: help / cookbook / calculators
// translated in batches). For every English entry this checks, against the merged Hindi task:
//   - the slug exists, and every list has the same length (so a step can't be dropped or invented),
//   - every string keeps the same numbers (₹ amounts, sections, rates, days — as a multiset of digit runs),
//   - the same number of **bold** markers (UI labels stay highlighted),
//   - no Devanagari is left in the English text, and nothing is empty.
// A Hindi edit that adds or removes a step makes the English entry fail here — fix both together.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const DEV_DIGITS = '०१२३४५६७८९';
const norm = (s) => s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
const digits = (s) => (norm(s).match(/\d+/g) ?? []).sort().join(' ');
const bolds = (s) => (s.match(/\*\*/g) ?? []).length;
const DEVANAGARI = /[ऀ-ॿ]/;

function same(where, hi, en) {
  ok(typeof en === 'string' && en.trim().length > 0, `${where}: English is empty`);
  if (typeof en !== 'string') return;
  ok(!DEVANAGARI.test(en), `${where}: Devanagari left in English → ${en.slice(0, 90)}`);
  ok(digits(hi) === digits(en), `${where}: numbers differ\n      hi [${digits(hi)}] ${hi.slice(0, 90)}\n      en [${digits(en)}] ${en.slice(0, 90)}`);
  ok(bolds(hi) === bolds(en), `${where}: **bold** markers differ (hi ${bolds(hi)}, en ${bolds(en)})`);
}

function sameList(where, hi = [], en, pick) {
  if (!hi.length && en == null) return;
  ok(Array.isArray(en) && en.length === hi.length, `${where}: ${hi.length} in Hindi, ${Array.isArray(en) ? en.length : 'none'} in English`);
  if (!Array.isArray(en)) return;
  hi.forEach((h, i) => {
    if (en[i] == null) return;
    for (const [k, hv, ev] of pick(h, en[i])) same(`${where}[${i}]${k}`, hv, ev);
  });
}

// ── Help (/help) ────────────────────────────────────────────────────────────────────────────────────────────────
const help = await loadViteModule(ROOT, resolve(ROOT, 'src/content/help/index.ts'), 'content-en-help');
const helpEn = await loadViteModule(ROOT, resolve(ROOT, 'src/content/help/en/index.ts'), 'content-en-help-en');
const tasks = new Map(help.HELP_TASKS.map((t) => [t.slug, t]));

for (const [slug, en] of Object.entries(helpEn.HELP_EN)) {
  const hi = tasks.get(slug);
  ok(!!hi, `help/${slug}: no such Hindi task`);
  if (!hi) continue;
  const w = `help/${slug}`;
  for (const k of ['metaTitle', 'metaDescription', 'title', 'estTime', 'tldr']) same(`${w}.${k}`, hi[k], en[k]);
  same(`${w}.deepLinkLabel`, hi.deepLink.label, en.deepLinkLabel);
  sameList(`${w}.prerequisites`, hi.prerequisites, en.prerequisites, (h, e) => [['', h.label, e]]);
  sameList(`${w}.steps`, hi.steps, en.steps, (h, e) => [['', h, e]]);
  sameList(`${w}.commonMistakes`, hi.commonMistakes, en.commonMistakes, (h, e) => [['', h, e]]);
  sameList(`${w}.faqs`, hi.faqs, en.faqs, (h, e) => [['.q', h.q, e.q], ['.a', h.a, e.a]]);
  sameList(`${w}.troubleshooting`, hi.troubleshooting, en.troubleshooting, (h, e) => [['.problem', h.problem, e.problem], ['.fix', h.fix, e.fix]]);
}

// every Hindi category has an English name
for (const c of help.HELP_CATEGORIES) ok(!!helpEn.HELP_CATEGORY_EN[c], `help category "${c}" has no English name`);

// localizeHelpTask: Hindi untouched, English merged, missing → translated=false
const first = help.HELP_TASKS[0];
ok(helpEn.localizeHelpTask(first, 'hi').title === first.title, 'localize(hi) keeps the Hindi title');
ok(helpEn.localizeHelpTask({ ...first, slug: '__none__' }, 'en').translated === false, 'localize(en) without overlay → translated=false');
if (helpEn.HELP_EN[first.slug]) {
  const l = helpEn.localizeHelpTask(first, 'en');
  ok(l.translated && l.title === helpEn.HELP_EN[first.slug].title && l.deepLink.route === first.deepLink.route, 'localize(en) merges text, keeps the route');
}

// ── Cookbook (/cookbook) ────────────────────────────────────────────────────────────────────────────────────────
const cb = await loadViteModule(ROOT, resolve(ROOT, 'src/content/cookbook/index.ts'), 'content-en-cb');
const cbEn = await loadViteModule(ROOT, resolve(ROOT, 'src/content/cookbook/en/index.ts'), 'content-en-cb-en');
const entries = new Map(cb.COOKBOOK_ENTRIES.map((e) => [e.slug, e]));
const opt = (where, hi, en) => { if (hi == null && en == null) return; ok(hi != null, `${where}: English has it, Hindi does not`); if (hi != null) same(where, hi, en); };

for (const [slug, en] of Object.entries(cbEn.COOKBOOK_EN)) {
  const hi = entries.get(slug);
  ok(!!hi, `cookbook/${slug}: no such Hindi entry`);
  if (!hi) continue;
  const w = `cookbook/${slug}`;
  for (const k of ['metaTitle', 'metaDescription', 'title', 'scenario', 'narration']) same(`${w}.${k}`, hi[k], en[k]);
  for (const k of ['useWhen', 'avoidWhen', 'correction', 'inApp']) opt(`${w}.${k}`, hi[k], en[k]);
  opt(`${w}.deepLinkLabel`, hi.deepLink?.label, en.deepLinkLabel);
  sameList(`${w}.lines`, hi.lines, en.lines, (h, e) => [['.account', h.account, e.account], ...(h.note != null || e.note != null ? [['.note', h.note ?? '', e.note]] : [])]);
  sameList(`${w}.notes`, hi.notes, en.notes, (h, e) => [['', h, e]]);
  if (hi.example || en.example) {
    ok(!!hi.example && !!en.example, `${w}.example: present on one side only`);
    if (hi.example && en.example) {
      same(`${w}.example.text`, hi.example.text, en.example.text);
      sameList(`${w}.example.rows`, hi.example.rows, en.example.rows, (h, e) => [['', h.account, e]]);
    }
  }
}
for (const c of cb.COOKBOOK_CATEGORIES) ok(!!cbEn.COOKBOOK_CATEGORY_EN[c], `cookbook category "${c}" has no English name`);
const cb0 = cb.COOKBOOK_ENTRIES[0];
ok(cbEn.localizeCookbookEntry(cb0, 'hi').title === cb0.title, 'localizeCookbook(hi) keeps the Hindi title');
if (cbEn.COOKBOOK_EN[cb0.slug]) {
  const l = cbEn.localizeCookbookEntry(cb0, 'en');
  ok(l.translated && l.lines.every((x, i) => x.type === cb0.lines[i].type), 'localizeCookbook(en) keeps every Dr/Cr side');
  ok(!l.example || l.example.rows.every((r, i) => r.dr === cb0.example.rows[i].dr && r.cr === cb0.example.rows[i].cr), 'localizeCookbook(en) keeps every amount');
}

// ── Calculators (/tools) ────────────────────────────────────────────────────────────────────────────────────────
const calc = await loadViteModule(ROOT, resolve(ROOT, 'src/content/calculators/index.ts'), 'content-en-calc');
const calcEn = await loadViteModule(ROOT, resolve(ROOT, 'src/content/calculators/en/index.ts'), 'content-en-calc-en');
const calcs = new Map(calc.CALCULATORS.map((c) => [c.slug, c]));
const holes = (s) => (s.match(/\{#\}/g) ?? []).length;

for (const [slug, en] of Object.entries(calcEn.CALC_EN_TEXT)) {
  const hi = calcs.get(slug);
  ok(!!hi, `tools/${slug}: no such Hindi calculator`);
  if (!hi) continue;
  const w = `tools/${slug}`;
  for (const k of ['metaTitle', 'metaDescription', 'intro', 'formula', 'explanation', 'example', 'mistakes']) same(`${w}.${k}`, hi[k], en[k]);
  ok(Object.keys(en.inputs).sort().join() === hi.inputs.map((i) => i.key).sort().join(), `${w}.inputs: keys differ from the Hindi inputs`);
  for (const inp of hi.inputs) {
    const e = en.inputs[inp.key];
    if (!e) continue;
    same(`${w}.inputs.${inp.key}.label`, inp.label, e.label);
    opt(`${w}.inputs.${inp.key}.sub`, inp.sub, e.sub);
    if (inp.suffix != null && /[ऀ-ॿ]/.test(inp.suffix)) same(`${w}.inputs.${inp.key}.suffix`, inp.suffix, e.suffix);
    for (const o of inp.options ?? []) same(`${w}.inputs.${inp.key}.options.${o.value}`, o.label, e.options?.[o.value]);
  }
  sameList(`${w}.faqs`, hi.faqs, en.faqs, (h, e) => [['.q', h.q, e.q], ['.a', h.a, e.a]]);
  sameList(`${w}.relatedArticles`, hi.relatedArticles, en.relatedArticles, (h, e) => [['', h.title, e]]);
  sameList(`${w}.relatedHelp`, hi.relatedHelp, en.relatedHelp, (h, e) => [['', h.title, e]]);
  sameList(`${w}.relatedGuide`, hi.relatedGuide, en.relatedGuide, (h, e) => [['', h.title, e]]);
  sameList(`${w}.relatedModules`, hi.relatedModules, en.relatedModules, (h, e) => [['', h.label, e]]);

  // Every string compute() can return (defaults, every select option, a spread of numbers) has an English template.
  const loc = calcEn.localizeCalculator(hi, 'en');
  const base = Object.fromEntries(hi.inputs.map((i) => [i.key, i.default]));
  const variants = [base];
  for (const i of hi.inputs) if (i.type === 'select') for (const o of i.options) variants.push({ ...base, [i.key]: o.value });
  for (const i of hi.inputs) if (i.type === 'number') for (const f of [0, 0.5, 3, 20]) variants.push({ ...base, [i.key]: Number(i.default) * f });
  const seen = new Set();
  for (const v of variants) {
    let r; try { r = loc.compute(v); } catch { continue; }
    const all = [...r.stats.flatMap((x) => [x.label, x.value]), ...(r.table ? [...r.table.head, ...r.table.rows.flat()] : []), ...(r.note ? [r.note] : [])];
    for (const x of all) if (DEVANAGARI.test(x) && !seen.has(x)) { seen.add(x); ok(false, `${w}: compute() string has no English → ${x}`); }
  }
}
for (const [k, v] of Object.entries(calcEn.CALC_RESULT_EN)) {
  ok(holes(k) === holes(v), `calc result "${k}": {#} count differs (${holes(k)} vs ${holes(v)})`);
  ok(!DEVANAGARI.test(v), `calc result "${k}": Devanagari in English`);
  ok(digits(k.replace(/\{#\}/g, '')) === digits(v.replace(/\{#\}/g, '')), `calc result "${k}": fixed numbers differ`);
}
ok(calcEn.translateCalcString('abc 12') === 'abc 12', 'translateCalcString leaves non-Hindi strings alone');

// ── Blog (/blog) ────────────────────────────────────────────────────────────────────────────────────────────────
// English body = src/content/blog/en/<slug>.md, block-for-block with the Hindi .md (blocks = text between blank
// lines): same block count, and per block the same heading level, numbers, **bold** count and link targets.
const { readFileSync, readdirSync, existsSync } = await import('node:fs');
const blog = await loadViteModule(ROOT, resolve(ROOT, 'src/content/blog/index.ts'), 'content-en-blog');
const blogMeta = await loadViteModule(ROOT, resolve(ROOT, 'src/content/blog/en/meta.ts'), 'content-en-blog-meta');
const blogTags = await loadViteModule(ROOT, resolve(ROOT, 'src/content/blog/en/tags.ts'), 'content-en-blog-tags');
const posts = new Map(blog.BLOG_POSTS.map((p) => [p.slug, p]));
const BLOG_DIR = resolve(ROOT, 'src/content/blog');
const enFiles = readdirSync(resolve(BLOG_DIR, 'en')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
const blocks = (md) => md.replace(/\r\n/g, '\n').split(/\n[ \t]*\n/).map((b) => b.trim()).filter(Boolean);
// Page/site links must match exactly; in-page "#anchor" links are compared by count only (a heading's id changes
// with its language — "#स्रोत" becomes "#sources") and must point at a real heading of the English article.
const allLinks = (s) => (s.match(/\]\(([^)\s]+)/g) ?? []).map((x) => x.slice(2));
const links = (s) => { const l = allLinks(s); return [...l.filter((x) => !x.startsWith('#')).sort(), `#x${l.filter((x) => x.startsWith('#')).length}`].join(' '); };
const slugifyHeading = (t) => t.trim().toLowerCase().replace(/[*`_]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const level = (b) => (b.match(/^(#{1,6})\s/) ?? ['', ''])[1];
const TWIN = [
  [/^##\s+तीन बातें याद रखें/, '## Three things to remember'],
  [/^##\s+(अक्सर पूछे जाने वाले प्रश्न|सामान्य सवाल|प्रश्नोत्तर)/, '## Frequently asked questions'],
  [/^##\s+इस लेख में/, '## In this article'],
];
for (const slug of enFiles) ok(!!blogMeta.BLOG_EN_META[slug], `blog/${slug}: English body without an entry in en/meta.ts`);
for (const [slug, en] of Object.entries(blogMeta.BLOG_EN_META)) {
  const hi = posts.get(slug);
  const w = `blog/${slug}`;
  ok(!!hi, `${w}: no such Hindi post`);
  ok(enFiles.includes(slug), `${w}: meta without an English body (en/${slug}.md)`);
  if (!hi || !enFiles.includes(slug)) continue;
  for (const k of ['metaTitle', 'metaDescription', 'title', 'shortTitle', 'excerpt']) same(`${w}.${k}`, hi[k], en[k]);
  opt(`${w}.imageAlt`, hi.imageAlt, en.imageAlt);
  sameList(`${w}.tags`, hi.tags, blogTags.BLOG_EN_TAGS[slug], (h, e) => [['', h, e]]);
  const hb = blocks(readFileSync(resolve(BLOG_DIR, slug + '.md'), 'utf8'));
  const eb = blocks(readFileSync(resolve(BLOG_DIR, 'en', slug + '.md'), 'utf8'));
  ok(hb.length === eb.length, `${w}.md: ${hb.length} blocks in Hindi, ${eb.length} in English`);
  const n = Math.min(hb.length, eb.length);
  const enIds = new Set(eb.filter((b) => /^#{1,6}\s/.test(b)).map((b) => slugifyHeading(b.replace(/^#{1,6}\s+/, '').split(String.fromCharCode(10))[0])));
  for (const a of eb.flatMap(allLinks).filter((x) => x.startsWith('#'))) ok(enIds.has(decodeURIComponent(a.slice(1))), `${w}.md: in-page link ${a} matches no English heading`);
  for (let i = 0; i < n; i++) {
    const h = hb[i], e = eb[i], at = `${w}.md block ${i + 1}`;
    ok(!DEVANAGARI.test(e), `${at}: Devanagari left → ${e.slice(0, 90)}`);
    ok(level(h) === level(e), `${at}: heading level differs ("${h.slice(0, 50)}" vs "${e.slice(0, 50)}")`);
    ok(digits(h) === digits(e), `${at}: numbers differ\n      hi [${digits(h)}] ${h.slice(0, 90)}\n      en [${digits(e)}] ${e.slice(0, 90)}`);
    ok(bolds(h) === bolds(e), `${at}: **bold** markers differ (hi ${bolds(h)}, en ${bolds(e)})`);
    ok(links(h) === links(e), `${at}: link targets differ\n      hi ${links(h)}\n      en ${links(e)}`);
    if (h.startsWith('|')) ok(h.split('\n').length === e.split('\n').length, `${at}: table rows differ`);
    for (const [re, twin] of TWIN) if (re.test(h)) ok(e.startsWith(twin), `${at}: must start "${twin}" (the page lifts this section into UI)`);
  }
}

const covered = Object.keys(helpEn.HELP_EN).filter((s) => tasks.has(s)).length;
console.log(`[content-en] help ${covered}/${tasks.size} · cookbook ${Object.keys(cbEn.COOKBOOK_EN).filter((s) => entries.has(s)).length}/${entries.size} in English · tools ${Object.keys(calcEn.CALC_EN_TEXT).filter((s) => calcs.has(s)).length}/${calcs.size} · blog ${Object.keys(blogMeta.BLOG_EN_META).length}/${posts.size}`);
console.log(`[content-en] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
