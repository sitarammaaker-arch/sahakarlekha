// Post-build prerender for public SEO routes (guide/software/states/blog/help/
// cookbook/glossary/tools/pricing/faq).
//
// The app is a client-rendered SPA. This script clones dist/index.html into
// dist/<path>/index.html with, per page:
//   1. its own <title>, description, canonical, OG/Twitter tags and JSON-LD in <head>;
//   2. a REAL static HTML body inside <div id="root"> (GOS-01) — rendered from the
//      SAME sources the app uses (markdown files / content registries), so crawlers
//      that don't execute JS still see the full content. React's createRoot()
//      replaces it on load, so the live app is unaffected.
// It also regenerates the sitemap as a SITEMAP INDEX (GOS-02): dist/sitemap.xml
// (index) → dist/sitemap-<family>.xml, with HONEST per-content lastmod dates
// (never the build date — a daily rebuild must not mark every URL as changed).
//
// Sources:
//   - guide:    scripts/guide-manifest.json + src/content/guide/<slug>.md
//   - blog:     src/content/blog/index.ts (regex; has import.meta.glob so it can't
//               be esbuild-loaded) + src/content/blog/<slug>.md
//   - glossary: docs/kpp/wave-1-active/KI-*.md (frontmatter + **Label:** sections)
//   - help/cookbook/tools/software/states/faq: their TS registries, loaded as real
//     data via esbuild (bundled to node_modules/.cache/prerender and imported).
// Fail-soft: any problem logs a warning and degrades (meta-only page, or skipped
// body, or flat fallback) — a build is never blocked.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const SITE = 'https://sahakarlekha.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(DIST, 'index.html');
const MANIFEST = resolve(ROOT, 'scripts', 'guide-manifest.json');
const SOCIETY_TYPES = resolve(ROOT, 'src', 'content', 'societyTypes.tsx');
const STATES_FILE = resolve(ROOT, 'src', 'content', 'states.ts');
const BLOG_FILE = resolve(ROOT, 'src', 'content', 'blog', 'index.ts');
const BLOG_DIR = resolve(ROOT, 'src', 'content', 'blog');
const AUTHORS_FILE = resolve(ROOT, 'src', 'content', 'blog', 'authors.ts');
const BLOG_CATEGORIES_FILE = resolve(ROOT, 'src', 'content', 'blog', 'categories.ts');
const EDITORIAL_POLICY_FILE = resolve(ROOT, 'src', 'content', 'editorialPolicy.ts');
const HINDI_DATE_FILE = resolve(ROOT, 'src', 'lib', 'hindiDate.ts');
const GUIDE_DIR = resolve(ROOT, 'src', 'content', 'guide');
const HELP_FILE = resolve(ROOT, 'src', 'content', 'help', 'index.ts');
const COOKBOOK_FILE = resolve(ROOT, 'src', 'content', 'cookbook', 'index.ts');
const GLOSSARY_DIR = resolve(ROOT, 'docs', 'kpp', 'wave-1-active');
const CALC_FILE = resolve(ROOT, 'src', 'content', 'calculators', 'index.ts');
const FAQ_FILE = resolve(ROOT, 'src', 'content', 'faq.ts');
const QUIZ_FILE = resolve(ROOT, 'src', 'content', 'guide', 'quizzes.ts');
const GLOSSARY_LINKS_FILE = resolve(ROOT, 'src', 'content', 'glossaryLinks.ts');
const HUB_META_FILE = resolve(ROOT, 'src', 'content', 'hubMeta.ts');
const SEO_FILE = resolve(ROOT, 'src', 'lib', 'seo.ts');
/** Set in main once the registries are loaded; identity until then (fail-soft). */
let fitTitle = (t) => t;
const DOWNLOADS_FILE = resolve(ROOT, 'src', 'content', 'downloads.ts');
const GUIDE_UPDATED_FILE = resolve(ROOT, 'src', 'content', 'guide', 'updated.ts');
const RELATED_FILE = resolve(ROOT, 'src', 'content', 'relatedContent.ts');
// English twins (/en/…, batch E1). EN_ROUTES_FILE is THE list of sections with an English twin.
const EN_ROUTES_FILE = resolve(ROOT, 'src', 'lib', 'enRoutes.ts');
const PAGE_META_EN_FILE = resolve(ROOT, 'src', 'content', 'pageMetaEn.ts');
const GUIDE_ENTRIES_EN_FILE = resolve(ROOT, 'src', 'content', 'guide', 'entriesEn.ts');
const GUIDE_INDEX_FILE = resolve(ROOT, 'src', 'content', 'guide', 'index.ts');
const GUIDE_EN_DIR = resolve(ROOT, 'src', 'content', 'guide', 'en');
const HELP_EN_FILE = resolve(ROOT, 'src', 'content', 'help', 'en', 'index.ts');
const COOKBOOK_EN_FILE = resolve(ROOT, 'src', 'content', 'cookbook', 'en', 'index.ts');
const CALC_EN_FILE = resolve(ROOT, 'src', 'content', 'calculators', 'en', 'index.ts');
// batch E2 — English blog: card/meta text (meta.ts), bodies (blog/en/<slug>.md), category text (categoriesEn.ts)
const BLOG_EN_META_FILE = resolve(ROOT, 'src', 'content', 'blog', 'en', 'meta.ts');
const BLOG_EN_DIR = resolve(ROOT, 'src', 'content', 'blog', 'en');
const BLOG_CATEGORIES_EN_FILE = resolve(ROOT, 'src', 'content', 'blog', 'categoriesEn.ts');
const COURSE = 'सहकारी समिति लेखांकन व ऑडिट — सम्पूर्ण कोर्स';

// Honest per-surface "content last changed" dates. These change ONLY when the
// underlying content actually changes (a per-entry `updated:` field overrides,
// blog uses its own dates, glossary uses KI `last_updated`). NEVER the build date.
const LASTMOD = {
  guide: '2026-06-20',
  software: '2026-06-20',
  state: '2026-06-20',
  help: '2026-06-27',
  cookbook: '2026-06-27',
  calc: '2026-06-27',
  faq: '2026-06-19',
  pricing: '2026-11-11',
  static: '2026-06-19',
};

marked.setOptions({ gfm: true });
// GFM task lists ("- [ ]") are printable checklists: a disabled <input type="checkbox"> showed up as
// "[Input]" in crawled text and as a dimmed checkbox to screen readers. Mirrors GuideMarkdown.
marked.use({ renderer: { checkbox: ({ checked }) => (checked ? '☑ ' : '☐ ') } });

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = (s) => (s ? marked.parse(String(s)) : '');
const mdInline = (s) => (s ? marked.parseInline(String(s)) : '');
const maxDate = (dates, fallback) => {
  const ds = dates.filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : fallback;
};

// L2: a content date can be typed in the future (a post's `updated:` set ahead). A sitemap lastmod /
// dateModified after the day of the build is invalid — clamp to the build day.
// Dates are India dates: the drip rebuild runs just after midnight IST (still the previous UTC day), and
// the reader's browser (index.ts isPublished) also flips at IST midnight.
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const BUILD_DAY = istToday();
const notFuture = (d) => (d && d > BUILD_DAY ? BUILD_DAY : d);

const crumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item })),
});

// Blog author for BlogPosting schema (E-E-A-T). Keep in sync with the default
// author in src/content/blog/authors.ts so the STATIC (crawled) HTML matches the
// runtime Person byline instead of the old Organization author.
const BLOG_AUTHOR = {
  '@type': 'Person',
  name: 'Sitaram',
  jobTitle: 'Editor',
  url: `${SITE}/author/sitaram`,
  image: `${SITE}/authors/sitaram.webp`,
};

// Strip markdown to plain text for schema answer strings.
const plain = (s) =>
  String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

// Parse a post's "## अक्सर पूछे जाने वाले प्रश्न" block into Q/A pairs — mirrors
// parseFaqs() in src/pages/BlogPost.tsx so the FAQPage schema is emitted statically.
function blogFaqs(raw) {
  const m = raw.match(/##\s+(अक्सर पूछे जाने वाले प्रश्न|सामान्य सवाल|प्रश्नोत्तर|FAQ)[^\n]*\r?\n/);
  if (!m || m.index == null) return [];
  const after = m.index + m[0].length;
  const rel = raw.slice(after).search(/\n##\s/);
  const inner = rel === -1 ? raw.slice(after) : raw.slice(after, after + rel);
  const faqs = [];
  inner.split('\n').forEach((line) => {
    const mm = line.trim().match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (mm) faqs.push({ q: mm[1].replace(/\*/g, '').trim(), a: mm[2].trim() });
  });
  return faqs;
}

/* ---------------- static body shell (GOS-01) ---------------- */

const HUB_LINKS = [
  ['/', 'होम'], ['/register', 'रजिस्टर करें'], ['/guide', 'गाइड'], ['/blog', 'ब्लॉग'],
  ['/help', 'मदद केंद्र'], ['/cookbook', 'एंट्री कुकबुक'], ['/glossary', 'शब्दकोश'],
  ['/tools', 'कैलकुलेटर'], ['/downloads', 'मुफ्त प्रारूप'], ['/software', 'सॉफ्टवेयर'], ['/faq', 'FAQ'],
];
// The live site's footer links. Without them the static HTML — all a crawler that runs no JavaScript
// ever sees — gave About, Contact, Pricing, the policies and the state page no inbound link at all.
const FOOTER_LINKS = [
  ['/pricing', 'मूल्य'], ['/about', 'हमारे बारे में'], ['/contact', 'संपर्क'],
  ['/cooperative-software/haryana', 'हरियाणा की समितियों के लिए'], ['/author/sitaram', 'लेखक'],
  ['/editorial-policy', 'संपादकीय नीति'], ['/privacy', 'गोपनीयता नीति'], ['/terms', 'नियम व शर्तें'],
];

/**
 * Scoped styles for the static shell. Real users see this HTML for a few seconds
 * on slow mobile networks before the SPA mounts, so it must look like the site
 * (brand bar, theme colours) — not a bare document. Everything is scoped under
 * .sl-pre so Tailwind's preflight (loaded in <head>) can't flatten it, and it is
 * removed together with the shell when createRoot replaces #root's children.
 * Colours mirror src/index.css: --primary 215 70% 28%, --background 210 20% 98%.
 */
const SHELL_CSS =
  `.sl-pre{min-height:100vh;background:#f8fafc;color:#1e2533;font-family:'Hind','Inter',system-ui,sans-serif;line-height:1.7;overflow-x:hidden}` +
  `.sl-pre a{color:#15417a;text-decoration:underline;text-underline-offset:2px}` +
  `.sl-pre .sl-bar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 1px 2px rgba(0,0,0,.05)}` +
  `.sl-pre .sl-bar-in{max-width:80rem;margin:0 auto;padding:0 16px;height:64px;display:flex;align-items:center}` +
  `.sl-pre .sl-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#1e2533}` +
  `.sl-pre .sl-mark{height:40px;width:40px;border-radius:8px;background:#15417a;color:#fff;font-weight:700;font-size:1.125rem;display:flex;align-items:center;justify-content:center}` +
  `.sl-pre .sl-name{display:block;font-weight:700;font-size:1.125rem;line-height:1.2}` +
  `.sl-pre .sl-sub{display:block;font-size:.75rem;color:#64748b}` +
  `.sl-pre .sl-main{max-width:48rem;margin:0 auto;padding:24px 16px 40px}` +
  `.sl-pre h1{font-size:1.75rem;font-weight:800;line-height:1.25;margin:0 0 14px}` +
  `.sl-pre h2{font-size:1.3rem;font-weight:700;line-height:1.35;margin:26px 0 10px}` +
  `.sl-pre h3{font-size:1.1rem;font-weight:600;margin:18px 0 8px}` +
  `.sl-pre p{margin:0 0 12px}` +
  `.sl-pre ul,.sl-pre ol{margin:0 0 14px;padding-left:1.4rem;list-style:disc}` +
  `.sl-pre ol{list-style:decimal}` +
  `.sl-pre li{margin:4px 0}` +
  `.sl-pre table{border-collapse:collapse;margin:0 0 14px;display:block;overflow-x:auto}` +
  `.sl-pre th,.sl-pre td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}` +
  `.sl-pre .sl-crumb{font-size:.9rem;margin-bottom:14px;color:#64748b}` +
  `.sl-pre .sl-explore{margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:.9rem}` +
  `.sl-pre .sl-hero{background:linear-gradient(135deg,#eef3fa,#f8fafc 50%,#e6edf7);padding:36px 16px 40px;text-align:center}` +
  `.sl-pre .sl-hero-in{max-width:40rem;margin:0 auto}` +
  `.sl-pre .sl-badge{display:inline-block;padding:4px 12px;border-radius:999px;background:#e3eaf4;color:#15417a;font-size:.75rem;font-weight:600;margin-bottom:14px}` +
  `.sl-pre .sl-hero h1{font-size:1.9rem}` +
  `.sl-pre .sl-hero h1 span{color:#15417a}` +
  `.sl-pre .sl-lead{color:#526072}` +
  `.sl-pre .sl-ctas{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:20px 0 10px}` +
  `.sl-pre .sl-btn{display:inline-block;padding:11px 26px;border-radius:8px;background:#15417a;color:#fff;font-weight:600;text-decoration:none}` +
  `.sl-pre .sl-btn-o{background:#fff;color:#15417a;border:1px solid #cbd5e1}` +
  `.sl-pre .sl-ticks{font-size:.8rem;color:#64748b;margin:0}` +
  `.sl-pre .sl-cards{list-style:none;padding:0;display:grid;gap:10px}` +
  `.sl-pre .sl-cards li{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin:0}` +
  `@media(min-width:768px){.sl-pre h1{font-size:2.25rem}.sl-pre .sl-hero{padding:64px 24px 56px}.sl-pre .sl-hero h1{font-size:2.75rem}.sl-pre .sl-cards{grid-template-columns:1fr 1fr}}`;

/** Brand bar mirroring PublicLayout's navbar. Deliberately NO Login/Register
    buttons: a logged-in user also sees this for a moment, and a page that says
    "Login" to a signed-in user reads as "my session is gone". */
const BRAND_BAR =
  `<header class="sl-bar"><div class="sl-bar-in">` +
  `<a class="sl-brand" href="/"><span class="sl-mark" aria-hidden="true">स</span>` +
  `<span><span class="sl-name">SahakarLekha</span><span class="sl-sub">सहकार लेखा</span></span></a>` +
  `</div></header>`;

/**
 * Wrap page content in a branded, readable semantic shell. Shown only until the
 * SPA mounts (createRoot replaces #root children); crawlers see it as the page.
 * crumbs: [[href, label], ...] + current (string).
 * hero: optional full-width HTML rendered above the main column (homepage).
 */
function shell({ crumbs = [], current = '', html, hero = '', lang = 'hi' }) {
  const en = lang === 'en';
  const bc = crumbs.length || current
    ? `<nav aria-label="breadcrumb" class="sl-crumb">` +
      [...crumbs.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`), current ? esc(current) : null]
        .filter(Boolean).join(' › ') +
      `</nav>`
    : '';
  const explore =
    `<nav aria-label="explore" class="sl-explore"><p><strong>${en ? 'Explore:' : 'और देखें:'}</strong> ` +
    (en ? HUB_LINKS_EN : HUB_LINKS).map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ') +
    `</p><p>` +
    (en ? FOOTER_LINKS_EN : FOOTER_LINKS).map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ') +
    `</p></nav>`;
  return (
    `<div class="sl-pre"><style>${SHELL_CSS}</style>` + (en ? BRAND_BAR_EN : BRAND_BAR) + hero +
    `<main class="sl-main">` + bc + html + explore + `</main></div>`
  );
}

const registerCta = (next) =>
  `<p style="margin-top:24px"><a href="/register${next ? `?next=${encodeURIComponent(next)}` : ''}"><strong>अपनी समिति का खाता डिजिटल कीजिए — रजिस्टर करें →</strong></a></p>`;

/* English shell text (batch E1 — /en/… twins). Hrefs are the Hindi paths; localizeEnLinks() turns each one into its
   /en/… twin when that twin was written, so a link never points at an English page that does not exist. */
const HUB_LINKS_EN = [
  ['/', 'Home'], ['/register', 'Register'], ['/guide', 'Guide'], ['/blog', 'Blog'],
  ['/help', 'Help Center'], ['/cookbook', 'Entry Cookbook'], ['/glossary', 'Glossary'],
  ['/tools', 'Calculators'], ['/downloads', 'Free formats'], ['/software', 'Software'], ['/faq', 'FAQ'],
];
const FOOTER_LINKS_EN = [
  ['/pricing', 'Pricing'], ['/about', 'About us'], ['/contact', 'Contact'],
  ['/cooperative-software/haryana', 'For societies in Haryana'], ['/author/sitaram', 'Author'],
  ['/editorial-policy', 'Editorial policy'], ['/privacy', 'Privacy policy'], ['/terms', 'Terms & conditions'],
];
const BRAND_BAR_EN =
  `<header class="sl-bar"><div class="sl-bar-in">` +
  `<a class="sl-brand" href="/"><span class="sl-mark" aria-hidden="true">स</span>` +
  `<span><span class="sl-name">SahakarLekha</span><span class="sl-sub">Cooperative accounting</span></span></a>` +
  `</div></header>`;
const registerCtaEn = (next) =>
  `<p style="margin-top:24px"><a href="/register${next ? `?next=${encodeURIComponent(next)}` : ''}"><strong>Take your society's accounts digital — Register →</strong></a></p>`;

/** Routes worth linking in CRAWLER-facing static bodies (public surfaces only —
    app-module deep links are noindexed and would just leak crawl signals). */
const PUBLIC_PREFIXES = ['/downloads', '/guide', '/blog', '/help', '/cookbook', '/glossary', '/tools', '/software', '/cooperative-software', '/register', '/faq', '/pricing', '/about', '/contact', '/search', '/ask'];
const isPublicRoute = (l) => PUBLIC_PREFIXES.some((p) => l === p || l.startsWith(p + '/') || l.startsWith(p + '?'));

/** A blog link is emitted in static bodies ONLY once the post is live (scheduled
    drip posts would otherwise be broken links until their publish date). */
const blogIsLive = (DATA, slug) => !DATA.publishedBlog || DATA.publishedBlog.has(slug);

/** GOS-11: render a SurfaceLinks bundle ({guide/blog: Refs, help/cookbook: slugs}) as an "और सीखें" block. */
function surfaceLinksHtml(links, DATA, heading = 'और सीखें', lang = 'hi') {
  if (!links) return '';
  const en = lang === 'en';
  const parts = [];
  for (const r of links.guide || []) parts.push(`<a href="/guide/${r.slug}">${esc((en && enEntryTitle(DATA, r.slug)) || r.title)}</a>`);
  for (const r of (links.blog || []).filter((r) => blogIsLive(DATA, r.slug))) parts.push(`<a href="/blog/${r.slug}">${esc(r.title)}</a>`);
  for (const s of links.help || []) {
    const t = (DATA.help || []).find((x) => x.slug === s);
    if (t) parts.push(`<a href="/help/${s}">${esc(en && DATA.helpEn ? DATA.helpEn.localizeHelpTask(t, 'en').title : t.title)}</a>`);
  }
  for (const s of links.cookbook || []) {
    const e = (DATA.cookbook || []).find((x) => x.slug === s);
    if (e) parts.push(`<a href="/cookbook/${s}">${esc(en && DATA.cookbookEn ? DATA.cookbookEn.localizeCookbookEntry(e, 'en').title : e.title)}</a>`);
  }
  return parts.length ? `<h2>${esc(heading)}</h2><p>${parts.join(' · ')}</p>` : '';
}

/* ---------------- registry data via esbuild (pure-data TS modules) ---------------- */

async function loadModule(entry) {
  const esbuild = await import('esbuild');
  const out = resolve(ROOT, 'node_modules', '.cache', 'prerender', basename(entry).replace(/\.tsx?$/, '') + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    alias: { '@': resolve(ROOT, 'src') },
    jsx: 'automatic',
    logLevel: 'silent',
  });
  return await import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

/** Load every esbuild-safe registry; each is null on failure (fail-soft). */
async function loadData() {
  const data = {};
  const jobs = [
    ['help', HELP_FILE, 'HELP_TASKS'],
    ['cookbook', COOKBOOK_FILE, 'COOKBOOK_ENTRIES'],
    ['calc', CALC_FILE, 'CALCULATORS'],
    ['faq', FAQ_FILE, 'FAQ_CATEGORIES'],
    ['quizzes', QUIZ_FILE, 'GUIDE_QUIZZES'],
    ['glossaryLinks', GLOSSARY_LINKS_FILE, 'resolveGlossaryHref'],
    ['guideUpdated', GUIDE_UPDATED_FILE, null], // per-chapter "अंतिम अपडेट" + lastmod
    ['downloads', DOWNLOADS_FILE, null], // /downloads hub — same registry as the page
    ['hub', HUB_META_FILE, null], // L5: hub title/description + glossary description — same module as the pages
    ['society', SOCIETY_TYPES, 'SOCIETY_TYPES'],
    ['states', STATES_FILE, 'STATES'],
    ['rel', RELATED_FILE, null], // whole module (edge maps + helpers), GOS-11
    ['authors', AUTHORS_FILE, null], // /author/<slug> profile pages (E-E-A-T) — AUTHORS + DEFAULT_AUTHOR_SLUG
    ['blogCats', BLOG_CATEGORIES_FILE, 'BLOG_CATEGORIES'], // /blog sections + /blog/category/<slug> hubs
    ['policy', EDITORIAL_POLICY_FILE, null], // /editorial-policy text + the article trust note — same module as the pages
    ['hindiDate', HINDI_DATE_FILE, 'formatHindiDate'],
    ['seo', SEO_FILE, null], // fitTitle / glossaryTitle / pricingJsonLd — the same module the live pages use
    // English twins (batch E1) — the same modules the live English pages read
    ['enRoutes', EN_ROUTES_FILE, null], // hasEnglishRoute / toEn / hreflangAlternates
    ['pageMetaEn', PAGE_META_EN_FILE, 'PAGE_META_EN'],
    ['guideEn', GUIDE_ENTRIES_EN_FILE, null], // PARTS_EN + ENTRY_EN
    ['helpEn', HELP_EN_FILE, null], // HELP_EN + localizeHelpTask + helpCategoryLabel
    ['cookbookEn', COOKBOOK_EN_FILE, null], // COOKBOOK_EN + localizeCookbookEntry + cookbookCategoryLabel
    ['calcEn', CALC_EN_FILE, null], // CALC_EN_TEXT + localizeCalculator
    // batch E2 — blog / category English text (the same modules BlogPost, BlogCards and BlogCategory read)
    ['blogEn', BLOG_EN_META_FILE, 'BLOG_EN_META'],
    ['blogCatsEn', BLOG_CATEGORIES_EN_FILE, 'BLOG_CATEGORIES_EN'],
  ];
  for (const [key, file, exportName] of jobs) {
    try {
      if (!existsSync(file)) { data[key] = null; continue; }
      const mod = await loadModule(file);
      data[key] = exportName ? (mod[exportName] || null) : mod;
      if (!data[key]) console.warn(`[prerender] ${exportName} not found in ${basename(file)} — bodies skipped for that surface.`);
    } catch (e) {
      data[key] = null;
      console.warn(`[prerender] could not data-load ${basename(file)} (${e && e.message}) — bodies skipped for that surface.`);
    }
  }
  return data;
}

/* ---------------- guide routes (manifest meta + chapter .md body) ---------------- */

function guidePages(DATA) {
  if (!existsSync(MANIFEST)) return [];
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  const chapters = entries.filter((e) => e && e.slug);
  const updatedOf = (slug) => (DATA.guideUpdated && DATA.guideUpdated.guideUpdated ? DATA.guideUpdated.guideUpdated(slug) : LASTMOD.guide);

  const pages = [{
    path: '/guide',
    title: DATA.hub.HUB_META.guide.title,
    description: DATA.hub.HUB_META.guide.description,
    lastmod: maxDate(chapters.map((e) => updatedOf(e.slug)), LASTMOD.guide),
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Course', name: COURSE,
        description: 'सहकारी समिति लेखांकन व ऑडिट का मुफ्त, हिन्दी-प्रथम ऑनलाइन कोर्स।',
        provider: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        url: `${SITE}/guide`, inLanguage: 'hi', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      },
      crumb([{ name: 'गाइड', item: `${SITE}/guide` }]),
    ],
    body: shell({
      current: 'गाइड',
      html:
        `<h1>${esc(COURSE)}</h1><p>लेखांकन की नींव से ऑडिट तक — सहकारी समितियों के लिए मुफ्त हिन्दी कोर्स। नीचे सभी अध्याय:</p>` +
        (() => {
          const bySection = new Map();
          for (const e of chapters) {
            const s = e.section || 'भूमिका';
            if (!bySection.has(s)) bySection.set(s, []);
            bySection.get(s).push(e);
          }
          let out = '';
          for (const [section, items] of bySection) {
            out += `<h2>${esc(section)}</h2><ul>` +
              items.map((e) => `<li><a href="/guide/${e.slug}">${esc(e.title)}</a></li>`).join('') + `</ul>`;
          }
          return out;
        })() +
        registerCta(),
    }),
  }];

  for (const e of chapters) {
    const path = `/guide/${e.slug}`;
    const url = SITE + path;
    let body;
    try {
      const mdFile = resolve(GUIDE_DIR, `${e.slug}.md`);
      if (existsSync(mdFile)) {
        body = shell({
          crumbs: [['/guide', 'गाइड']],
          current: e.title,
          html: md(readFileSync(mdFile, 'utf-8')) + `<p><small>अंतिम अपडेट: ${esc(updatedOf(e.slug))}</small></p>` + registerCta(),
        });
      }
    } catch { /* body optional */ }
    pages.push({
      path,
      title: `${e.title} — सहकार लेखा गाइड`,
      description: e.description || '',
      lastmod: updatedOf(e.slug),
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: e.title,
          description: e.description || '',
          inLanguage: 'hi',
          url,
          isPartOf: { '@type': 'Course', name: COURSE, url: `${SITE}/guide` },
          ...(e.section ? { articleSection: e.section } : {}),
          image: `${SITE}/og-image.png`,
          datePublished: LASTMOD.guide,
          dateModified: updatedOf(e.slug),
          author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } },
        },
        crumb([
          { name: 'गाइड', item: `${SITE}/guide` },
          { name: e.title, item: url },
        ]),
      ],
    });
  }
  return pages;
}

/* ---------------- software routes (registry data body; regex meta fallback) ---------------- */

function softwarePages(DATA) {
  const types = DATA.society || [];
  const pages = [
    {
      path: '/software',
      title: 'सहकारी समिति लेखा सॉफ्टवेयर | Cooperative Society Software',
      description: 'PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए लेखा सॉफ्टवेयर, ₹2,999/year + GST से। अपनी समिति का प्रकार चुनें।',
      lastmod: LASTMOD.software,
      jsonLd: [crumb([{ name: 'Software', item: `${SITE}/software` }])],
      body: types.length
        ? shell({
            current: 'सॉफ्टवेयर',
            html:
              `<h1>हर प्रकार की सहकारी समिति के लिए लेखा सॉफ्टवेयर</h1>` +
              `<p>अपनी समिति का प्रकार चुनें:</p><ul>` +
              types.map((t) => `<li><a href="/software/${t.slug}">${esc(t.nameHi)} (${esc(t.nameEn)})</a> — ${esc(t.introHi || '')}</li>`).join('') +
              `</ul><h2>राज्य के अनुसार</h2><ul>` +
              (DATA.states || []).map((s) => `<li><a href="/cooperative-software/${s.slug}">${esc(s.nameHi)} (${esc(s.nameEn)})</a></li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(SOCIETY_TYPES)) {
    const src = readFileSync(SOCIETY_TYPES, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/software/${slug}`;
      const t = types.find((x) => x.slug === slug);
      const body = t
        ? shell({
            crumbs: [['/software', 'सॉफ्टवेयर']],
            current: t.nameHi,
            html:
              `<h1>${esc(t.h1Hi || t.nameHi)}</h1>` +
              `<p>${esc(t.introHi || '')}</p>` +
              (t.painsHi && t.painsHi.length ? `<h2>आम चुनौतियाँ</h2><ul>${t.painsHi.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
              (t.solvesHi && t.solvesHi.length ? `<h2>SahakarLekha कैसे मदद करता है</h2><ul>${t.solvesHi.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
              (t.seoEn ? `<p lang="en">${esc(t.seoEn)}</p>` : '') +
              surfaceLinksHtml(DATA.rel && DATA.rel.SOCIETY_CONTENT && DATA.rel.SOCIETY_CONTENT[slug], DATA, `${t.nameHi} के लिए और सीखें`) +
              `<p><a href="/guide">मुफ़्त गाइड से सीखें</a> · <a href="/software">सभी समिति-प्रकार देखें</a></p>` +
              registerCta(),
          })
        : undefined;
      pages.push({
        path: `/software/${slug}`,
        title,
        description,
        lastmod: LASTMOD.software,
        body,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

/* ---------------- state routes ---------------- */

function statePages(DATA) {
  const states = DATA.states || [];
  const pages = [];
  if (existsSync(STATES_FILE)) {
    const src = readFileSync(STATES_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cooperative-software/${slug}`;
      const s = states.find((x) => x.slug === slug);
      const body = s
        ? shell({
            crumbs: [['/software', 'सॉफ्टवेयर']],
            current: s.nameHi,
            html:
              `<h1>${esc(s.h1Hi || s.nameHi)}</h1>` +
              `<p>${esc(s.introHi || '')}</p>` +
              (s.act ? `<p><strong>लागू कानून:</strong> ${esc(s.act)}</p>` : '') +
              (s.ecosystem && s.ecosystem.length
                ? `<h2>${esc(s.nameHi)} का सहकारी तंत्र</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>क्षेत्र</th><th>संस्था</th><th>SahakarLekha में</th></tr></thead><tbody>` +
                  s.ecosystem.map((r) => `<tr><td>${esc(r.area)}</td><td>${esc(r.body)}</td><td>${esc(r.fits)}</td></tr>`).join('') +
                  `</tbody></table>`
                : '') +
              (s.compliance && s.compliance.length ? `<h2>अनुपालन</h2><ul>${s.compliance.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '') +
              (s.seoEn ? `<p lang="en">${esc(s.seoEn)}</p>` : '') +
              surfaceLinksHtml(DATA.rel && DATA.rel.STATE_CONTENT && DATA.rel.STATE_CONTENT[slug], DATA, `${s.nameHi} की समितियों के लिए और सीखें`) +
              `<p><a href="/software">सभी समिति-प्रकार</a> · <a href="/guide">मुफ़्त गाइड</a></p>` +
              registerCta(),
          })
        : undefined;
      pages.push({
        path: `/cooperative-software/${slug}`,
        title,
        description,
        lastmod: LASTMOD.state,
        body,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

/* ---------------- blog routes (regex meta + .md body; can't esbuild-load) ---------------- */

function blogPages(DATA) {
  const posts = [];
  const scheduled = [];
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    // per post, in declared order: slug, metaTitle, metaDescription, date [, updated]
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?date:\s*'([^']+)'(?:,\s*\r?\n\s*updated:\s*'([^']+)')?/g;
    let m;
    const today = istToday();
    while ((m = re.exec(src))) {
      const [, slug, title, description, date, updated] = m;
      if (date > today) { scheduled.push({ slug, date }); continue; } // drip post — not live yet
      posts.push({ slug, title, description, date, updated: notFuture(updated) });
    }
  }
  // category per post — og article:section
  const categories = {};
  if (existsSync(BLOG_FILE)) {
    const csrc = readFileSync(BLOG_FILE, 'utf-8');
    for (const cm of csrc.matchAll(/slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?\n\s*category:\s*'([^']+)'/g)) categories[cm[1]] = cm[2];
  }
  // optional featured image per post (declared after `slug:` in the same entry)
  const images = {};
  if (existsSync(BLOG_FILE)) {
    const isrc = readFileSync(BLOG_FILE, 'utf-8');
    for (const im of isrc.matchAll(/slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?image:\s*'([^']+)'/g)) images[im[1]] = im[2];
  }
  // the on-page heading (`title:`, not `metaTitle:`) — BlogPost renders it as THE h1
  const headings = {};
  if (existsSync(BLOG_FILE)) {
    const hsrc = readFileSync(BLOG_FILE, 'utf-8');
    for (const hm of hsrc.matchAll(/slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?\n\s*title:\s*'((?:[^'\\]|\\.)*)'/g)) headings[hm[1]] = hm[2].replace(/\\'/g, "'");
  }
  // trust fields (optional, declared right after `category:`): real review date + state
  const reviewed = {};
  const jurisdiction = {};
  if (existsSync(BLOG_FILE)) {
    const tsrc = readFileSync(BLOG_FILE, 'utf-8');
    for (const m of tsrc.matchAll(/slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?\n\s*reviewed:\s*'([^']+)'/g)) reviewed[m[1]] = m[2];
    for (const m of tsrc.matchAll(/slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?\n\s*jurisdiction:\s*'([^']+)'/g)) jurisdiction[m[1]] = m[2];
  }
  // The article trust note — same rule and words as TrustNote in src/pages/BlogPost.tsx.
  const trustHtml = (slug) => {
    const P = DATA.policy;
    if (!P) return '';
    const T = P.TRUST_NOTE;
    const sensitive = P.TRUST_NOTE_CATEGORIES.includes(categories[slug]);
    if (!jurisdiction[slug] && !reviewed[slug] && !sensitive) return '';
    const fmt = DATA.hindiDate || ((d) => d);
    let h = '';
    if (jurisdiction[slug] === 'haryana') h += `<p><strong>${esc(T.haryanaBadge)}</strong> ${esc(T.haryana)}</p>`;
    if (reviewed[slug]) h += `<p><strong>${esc(T.reviewedLabel)}: ${esc(fmt(reviewed[slug]))}</strong>। ${esc(T.reviewed)}</p>`;
    else if (sensitive) h += `<p>${esc(T.notReviewed)}</p>`;
    h += `<p><a href="${P.EDITORIAL_POLICY_PATH}">${esc(T.policyLink)}</a></p>`;
    return `<aside class="sl-trust" aria-label="जानकारी के बारे में">${h}</aside>`;
  };
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Category groups, in BLOG_CATEGORIES order (src/content/blog/categories.ts — the same list the
  // React /blog and /blog/category/<slug> pages use). A post whose category isn't in the list (the
  // BlogCategoryName type should make that impossible) still gets listed, under "अन्य लेख".
  const cats = DATA.blogCats || [];
  const known = new Set(cats.map((c) => c.name));
  const groups = cats
    .map((c) => ({ c, posts: posts.filter((p) => categories[p.slug] === c.name) }))
    .filter((g) => g.posts.length);
  const others = posts.filter((p) => !known.has(categories[p.slug]));
  const postLi = (p) => `<li><a href="/blog/${p.slug}">${esc(headings[p.slug] || p.title)}</a> <small>(${p.date})</small></li>`;
  const catHref = (name) => {
    const c = cats.find((x) => x.name === name);
    return c ? `/blog/category/${c.slug}` : null;
  };

  const pages = [
    {
      path: '/blog',
      title: DATA.hub.HUB_META.blog.title,
      description: DATA.hub.HUB_META.blog.description,
      lastmod: maxDate(posts.map((p) => p.updated || p.date), LASTMOD.static),
      jsonLd: [crumb([{ name: 'ब्लॉग', item: `${SITE}/blog` }])],
      body: posts.length
        ? shell({
            current: 'ब्लॉग',
            html:
              `<h1>सहकार लेखा ब्लॉग</h1><p>सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट व अनुपालन पर सरल हिन्दी लेख।</p>` +
              (groups.length
                ? `<nav aria-label="लेखों की श्रेणियाँ"><p><strong>श्रेणियाँ:</strong> ` +
                  groups.map((g) => `<a href="/blog/category/${g.c.slug}">${esc(g.c.name)}</a> (${g.posts.length})`).join(' · ') +
                  `</p></nav>`
                : '') +
              groups.map((g) =>
                `<section><h2><a href="/blog/category/${g.c.slug}">${esc(g.c.name)}</a></h2><p>${esc(g.c.intro)}</p>` +
                `<ul>${g.posts.map(postLi).join('')}</ul></section>`).join('') +
              (others.length ? `<section><h2>अन्य लेख</h2><ul>${others.map(postLi).join('')}</ul></section>` : '') +
              registerCta(),
          })
        : undefined,
      _blogIndex: { groups, others }, // English twin (batch E2) — not rendered
    },
  ];

  // One crawlable hub per category: /blog/category/<slug>. Same title/description/h1/JSON-LD as
  // src/pages/BlogCategory.tsx. Categories with no live post yet get no page (and no sitemap entry).
  for (const { c, posts: catPosts } of groups) {
    const url = `${SITE}/blog/category/${c.slug}`;
    pages.push({
      path: `/blog/category/${c.slug}`,
      title: c.metaTitle,
      description: c.description,
      lastmod: maxDate(catPosts.map((p) => p.updated || p.date), LASTMOD.static),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: c.name,
          description: c.description,
          url,
          inLanguage: 'hi',
          isPartOf: { '@type': 'Blog', name: 'सहकार लेखा ब्लॉग', url: `${SITE}/blog` },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: catPosts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/blog/${p.slug}`, name: headings[p.slug] || p.title })),
          },
        },
        crumb([
          { name: 'होम', item: `${SITE}/` },
          { name: 'ब्लॉग', item: `${SITE}/blog` },
          { name: c.name, item: url },
        ]),
      ],
      body: shell({
        crumbs: [['/blog', 'ब्लॉग']],
        current: c.name,
        html:
          `<h1>${esc(c.name)}</h1><p>${esc(c.intro)}</p><p><small>${catPosts.length} लेख</small></p>` +
          `<ul>${catPosts.map(postLi).join('')}</ul>` +
          `<p><a href="/blog">सभी श्रेणियाँ और लेख</a></p>` + registerCta(),
      }),
      _cat: { c, posts: catPosts }, // English twin (batch E2) — not rendered
    });
  }
  for (const p of posts) {
    const url = `${SITE}/blog/${p.slug}`;
    let body;
    let faqs = [];
    try {
      const mdFile = resolve(BLOG_DIR, `${p.slug}.md`);
      if (existsSync(mdFile)) {
        const raw = readFileSync(mdFile, 'utf-8');
        faqs = blogFaqs(raw);
        // GOS-11: narrative → task edge into the static body too
        const helpSlugs = (DATA.rel && DATA.rel.BLOG_HELP && DATA.rel.BLOG_HELP[p.slug]) || [];
        const helpLinks = surfaceLinksHtml({ help: helpSlugs }, DATA, 'अभी करें (मदद केंद्र)');
        // L2: mirror BlogPost — its h1 is the post's `title:` and the markdown's own leading "# …" is
        // stripped. 40 posts have no "# " line, so their static HTML had NO h1 at all.
        const heading = headings[p.slug] || p.title;
        const hub = catHref(categories[p.slug]);
        body = shell({
          crumbs: [['/blog', 'ब्लॉग'], ...(hub ? [[hub, categories[p.slug]]] : [])],
          current: heading,
          html: `<h1>${esc(heading)}</h1>` + trustHtml(p.slug) + md(raw.replace(/^﻿?\s*#\s+.*(\r?\n)+/, '')) + helpLinks + registerCta(),
        });
      }
    } catch { /* body optional */ }
    pages.push({
      path: `/blog/${p.slug}`,
      title: p.title,
      description: p.description,
      lastmod: p.updated || p.date,
      image: images[p.slug] ? `${SITE}${images[p.slug]}` : undefined,
      article: { publishedTime: p.date, modifiedTime: p.updated || p.date, section: categories[p.slug] },
      body,
      // English twin (batch E2) — not rendered
      _post: { slug: p.slug, date: p.date, updated: p.updated, category: categories[p.slug], image: images[p.slug], jurisdiction: jurisdiction[p.slug], reviewed: reviewed[p.slug] },
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          // the on-page h1 (`title:`), same as BlogPost's runtime JSON-LD — not the <title> with its brand suffix
          headline: headings[p.slug] || p.title,
          description: p.description,
          inLanguage: 'hi',
          url,
          mainEntityOfPage: url,
          datePublished: p.date,
          dateModified: p.updated || p.date,
          ...(jurisdiction[p.slug] === 'haryana' ? { spatialCoverage: { '@type': 'Place', name: 'Haryana, India' } } : {}),
          image: images[p.slug] ? `${SITE}${images[p.slug]}` : `${SITE}/og-image.png`,
          author: BLOG_AUTHOR,
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } },
        },
        // Same 4 levels as BlogPost's runtime BreadcrumbList: होम › ब्लॉग › category › post
        crumb([
          { name: 'होम', item: `${SITE}/` },
          { name: 'ब्लॉग', item: `${SITE}/blog` },
          ...(catHref(categories[p.slug]) ? [{ name: categories[p.slug], item: `${SITE}${catHref(categories[p.slug])}` }] : []),
          { name: headings[p.slug] || p.title, item: url },
        ]),
        ...(faqs.length ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
        }] : []),
      ],
    });
  }
  // A scheduled (drip) post's URL used to fall through to the SPA rewrite and serve the HOMEPAGE
  // template (canonical "/", HTTP 200). Give it its own noindex stub until its date; the daily
  // rebuild (scheduled-rebuild.yml, just after midnight IST) replaces it with the real article.
  for (const s of scheduled) {
    pages.push({
      path: `/blog/${s.slug}`,
      noindex: true,
      title: 'जल्द आ रहा है | सहकार लेखा ब्लॉग',
      description: `यह लेख ${s.date} को प्रकाशित होगा। तब तक सहकार लेखा ब्लॉग के बाक़ी लेख पढ़ें।`,
      body: shell({
        crumbs: [['/blog', 'ब्लॉग']],
        current: 'जल्द आ रहा है',
        html: `<h1>यह लेख जल्द आ रहा है</h1><p>यह लेख ${esc(s.date)} को प्रकाशित होगा। तब तक <a href="/blog">ब्लॉग के बाक़ी लेख</a> पढ़ें।</p>`,
      }),
      _scheduled: s, // its English stub (batch E2) — not rendered
    });
  }
  return pages;
}

/* ---------------- author profiles + blog not-found ---------------- */

// /author/<slug> was CSR-only: crawlers got the homepage template (canonical "/") for the page every
// BlogPosting's author.url points at. Same title/description/JSON-LD as src/pages/AuthorProfile.tsx.
function authorPages(DATA, blog) {
  const A = DATA.authors;
  if (!A || !A.AUTHORS) return [];
  const live = blog.filter((p) => p.path.startsWith('/blog/') && !p.path.startsWith('/blog/category/') && !p.noindex)   // posts only, not category pages
    .map((p) => ({ path: p.path, title: (p.jsonLd && p.jsonLd[0] && p.jsonLd[0].headline) || p.title, date: p.lastmod }));
  return Object.values(A.AUTHORS).map((a) => {
    const url = `${SITE}/author/${a.slug}`;
    // single-author blog: every post belongs to the default author (BlogPost/AuthorProfile do the same)
    const posts = a.slug === A.DEFAULT_AUTHOR_SLUG ? live : [];
    return {
      path: `/author/${a.slug}`,
      title: `${a.name} — ${a.designation} | सहकार लेखा`,
      description: a.tagline,
      lastmod: maxDate(posts.map((p) => p.date), LASTMOD.static),
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: a.name,
          jobTitle: a.designation,
          description: a.tagline,
          url,
          ...(a.photo ? { image: `${SITE}${a.photo}` } : {}),
          worksFor: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          alumniOf: a.alumniOf.map((n) => ({ '@type': 'Organization', name: n })),
          knowsAbout: a.knowsAbout,
          ...(a.socials && a.socials.length ? { sameAs: a.socials.map((s) => s.href) } : {}),
        },
      }],
      body: shell({
        crumbs: [['/blog', 'ब्लॉग']],
        current: a.name,
        html:
          `<h1>${esc(a.name)}</h1><p><strong>${esc(a.designation)} · सहकार लेखा</strong></p><p>${esc(a.tagline)}</p>` +
          `<h2>योग्यता</h2><ul>${a.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` +
          `<h2>अनुभव</h2><ul>${a.experience.map((e) => `<li>${esc(e.years)} वर्ष — ${esc(e.field)}</li>`).join('')}</ul>` +
          (posts.length ? `<h2>लेख (${posts.length})</h2><ul>${posts.map((p) => `<li><a href="${p.path}">${esc(p.title)}</a></li>`).join('')}</ul>` : ''),
      }),
      _author: { a, posts }, // English twin (batch E2) — not rendered
    };
  });
}

// Unknown /blog/<slug> (or /blog/category/<slug>) used to get the homepage template with HTTP 200 (a
// soft-404 that called itself "/"). vercel.json now keeps /blog/* out of the SPA rewrite, so a path with
// no prerendered file falls through to Vercel's not-found handling, which serves THIS root 404.html with
// a real HTTP 404 status. Since scripts/spa-rewrite.mjs the same is true of ANY path whose first segment
// is not an App.tsx route (/no-such-page, /manifest.json, /wp-login.php …), so the wording is not about
// the blog alone.
function blogNotFoundPage() {
  return {
    file: '404.html',
    noindex: true,
    title: 'पेज नहीं मिला | सहकार लेखा',
    description: 'यह पेज नहीं मिला। लिंक पुराना या ग़लत हो सकता है।',
    body: shell({
      current: 'पेज नहीं मिला',
      html:
        `<h1>यह पेज नहीं मिला</h1><p>लिंक पुराना या ग़लत हो सकता है।</p>` +
        `<p><a href="/">होम</a> · <a href="/blog">सभी लेख</a> · <a href="/guide">गाइड</a> · <a href="/glossary">शब्दकोश</a> · <a href="/help">मदद केंद्र</a> · <a href="/contact">संपर्क</a></p>`,
    }),
  };
}

/* ---------------- help routes (regex meta + registry-data body) ---------------- */

function helpBody(t, DATA) {
  const cookbookSlugs = (DATA.rel && DATA.rel.HELP_COOKBOOK && DATA.rel.HELP_COOKBOOK[t.slug]) || [];
  return shell({
    crumbs: [['/help', 'मदद केंद्र']],
    current: t.title,
    html:
      `<h1>${esc(t.title)}</h1>` +
      `<p><small>${esc(t.category)} · ${esc(t.estTime || '')}</small></p>` +
      (t.tldr ? `<blockquote><strong>संक्षेप में:</strong> ${esc(t.tldr)}</blockquote>` : '') +
      (t.prerequisites && t.prerequisites.length
        ? `<h2>पहले यह तैयार रखें</h2><ul>${t.prerequisites.map((p) => `<li>${esc(p.label)}</li>`).join('')}</ul>` : '') +
      (t.steps && t.steps.length
        ? `<h2>स्टेप-बाय-स्टेप</h2><ol>${t.steps.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ol>` : '') +
      (t.commonMistakes && t.commonMistakes.length
        ? `<h2>आम गलतियाँ</h2><ul>${t.commonMistakes.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ul>` : '') +
      (t.troubleshooting && t.troubleshooting.length
        ? `<h2>अगर दिक्कत आए</h2><ul>${t.troubleshooting.map((x) => `<li><strong>${mdInline(x.problem)}</strong> — ${mdInline(x.fix)}</li>`).join('')}</ul>` : '') +
      (t.faqs && t.faqs.length
        ? `<h2>अक्सर पूछे जाने वाले प्रश्न</h2>` + t.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      (t.guideSlug ? `<p>पूरा समझें: <a href="/guide/${t.guideSlug}">गहराई से गाइड अध्याय</a></p>` : '') +
      surfaceLinksHtml({ cookbook: cookbookSlugs }, DATA, 'इससे जुड़ी entries (कुकबुक)') +
      (t.related && t.related.length
        ? `<p>जुड़े काम: ${t.related.map((r) => `<a href="/help/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (t.updated ? `<p><small>अंतिम अपडेट: ${esc(t.updated)}</small></p>` : '') +
      registerCta(t.deepLink && t.deepLink.route),
  });
}

function helpPages(DATA) {
  const tasks = DATA.help || [];
  const pages = [
    {
      path: '/help',
      title: DATA.hub.HUB_META.help.title,
      description: DATA.hub.HUB_META.help.description,
      lastmod: maxDate(tasks.map((t) => t.updated), LASTMOD.help),
      jsonLd: [crumb([{ name: 'मदद केंद्र', item: `${SITE}/help` }])],
      body: tasks.length
        ? shell({
            current: 'मदद केंद्र',
            html:
              `<h1>मदद केंद्र — "कैसे करें"</h1><p>रोज़मर्रा के काम, आसान स्टेप-बाय-स्टेप:</p>` +
              (() => {
                const byCat = new Map();
                for (const t of tasks) {
                  if (!byCat.has(t.category)) byCat.set(t.category, []);
                  byCat.get(t.category).push(t);
                }
                let out = '';
                for (const [cat, items] of byCat) {
                  out += `<h2>${esc(cat)}</h2><ul>` +
                    items.map((t) => `<li><a href="/help/${t.slug}">${esc(t.title)}</a></li>`).join('') + `</ul>`;
                }
                return out;
              })() + registerCta(),
          })
        : undefined,
    },
  ];
  // Iterate the loaded registry array directly. (Previously this regex-scraped the source
  // for slug→metaTitle→metaDescription, but a quoted `slug:` inside a task's `prerequisites`
  // desynced the stateful regex and silently dropped the FOLLOWING task from prerender +
  // sitemap — record-sale/receive-payment/distribute-profit were all lost this way. The
  // registry already carries every field, so there is no reason to parse text.)
  for (const t of tasks) {
    const { slug, metaTitle: title, metaDescription: description } = t;
    const url = `${SITE}/help/${slug}`;
    pages.push({
      path: `/help/${slug}`,
      title,
      description,
      lastmod: t.updated || LASTMOD.help,
      body: helpBody(t, DATA),
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, image: `${SITE}/og-image.png`, datePublished: t.updated || LASTMOD.help, dateModified: t.updated || LASTMOD.help, author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE }, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } } },
        crumb([
          { name: 'मदद केंद्र', item: `${SITE}/help` },
          { name: title, item: url },
        ]),
        // FAQPage was client-only (HelpArticle) — mirror into static HTML so the
        // help Q&A is machine-readable for FAQ rich results + AI extraction.
        ...(Array.isArray(t.faqs) && t.faqs.length
          ? [{
              '@context': 'https://schema.org', '@type': 'FAQPage',
              mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
            }]
          : []),
      ],
    });
  }
  return pages;
}

/* ---------------- cookbook routes (regex meta + registry-data body) ---------------- */

function cookbookBody(e, DATA) {
  const helpSlugs = (DATA.rel && DATA.rel.helpForCookbook) ? DATA.rel.helpForCookbook(e.slug) : [];
  return shell({
    crumbs: [['/cookbook', 'एंट्री कुकबुक']],
    current: e.title,
    html:
      `<h1>${esc(e.title)}</h1>` +
      `<p><small>${esc(e.category)}</small></p>` +
      (e.scenario ? `<p><strong>कब:</strong> ${esc(e.scenario)}</p>` : '') +
      (e.lines && e.lines.length
        ? `<h2>एंट्री (Journal)</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>खाता</th><th>Dr/Cr</th><th>नोट</th></tr></thead><tbody>` +
          e.lines.map((l) => `<tr><td>${esc(l.account)}</td><td>${esc(l.type)}</td><td>${esc(l.note || '')}</td></tr>`).join('') +
          `</tbody></table>`
        : '') +
      (e.narration ? `<p><strong>विवरण (Narration):</strong> ${esc(e.narration)}</p>` : '') +
      (e.example
        ? `<h2>उदाहरण (₹ में)</h2><p>${esc(e.example.text)}</p><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>खाता</th><th>Dr</th><th>Cr</th></tr></thead><tbody>` +
          e.example.rows.map((r) => `<tr><td>${esc(r.account)}</td><td>${r.dr != null ? '₹' + r.dr.toLocaleString('en-IN') : ''}</td><td>${r.cr != null ? '₹' + r.cr.toLocaleString('en-IN') : ''}</td></tr>`).join('') +
          `</tbody></table>`
        : '') +
      (e.useWhen ? `<p><strong>कब इस्तेमाल करें:</strong> ${esc(e.useWhen)}</p>` : '') +
      (e.avoidWhen ? `<p><strong>कब नहीं:</strong> ${esc(e.avoidWhen)}</p>` : '') +
      (e.inApp ? `<h2>ऐप में कैसे करें</h2><p>${esc(e.inApp)}</p>` : '') +
      (e.correction ? `<h2>गलती हो गई तो — सुधार</h2><p>${esc(e.correction)}</p>` : '') +
      (e.notes && e.notes.length ? `<h2>ध्यान रखें</h2><ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
      (e.guideSlug ? `<p>पूरा समझें: <a href="/guide/${e.guideSlug}">गाइड अध्याय</a></p>` : '') +
      surfaceLinksHtml({ help: helpSlugs }, DATA, 'स्टेप-बाय-स्टेप (मदद केंद्र)') +
      (e.related && e.related.length
        ? `<p>जुड़ी एंट्रियाँ: ${e.related.map((r) => `<a href="/cookbook/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (e.updated ? `<p><small>अंतिम अपडेट: ${esc(e.updated)}</small></p>` : '') +
      registerCta(e.deepLink && e.deepLink.route),
  });
}

function cookbookPages(DATA) {
  const entries = DATA.cookbook || [];
  const pages = [
    {
      path: '/cookbook',
      title: DATA.hub.HUB_META.cookbook.title,
      description: DATA.hub.HUB_META.cookbook.description,
      lastmod: maxDate(entries.map((e) => e.updated), LASTMOD.cookbook),
      jsonLd: [crumb([{ name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` }])],
      body: entries.length
        ? shell({
            current: 'एंट्री कुकबुक',
            html:
              `<h1>एंट्री कुकबुक</h1><p>"X दर्ज करना हो तो कौन-सी एंट्री करें" — हर स्थिति का Dr/Cr उदाहरण:</p>` +
              (() => {
                const byCat = new Map();
                for (const e of entries) {
                  if (!byCat.has(e.category)) byCat.set(e.category, []);
                  byCat.get(e.category).push(e);
                }
                let out = '';
                for (const [cat, items] of byCat) {
                  out += `<h2>${esc(cat)}</h2><ul>` +
                    items.map((e) => `<li><a href="/cookbook/${e.slug}">${esc(e.title)}</a></li>`).join('') + `</ul>`;
                }
                return out;
              })() + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(COOKBOOK_FILE)) {
    const src = readFileSync(COOKBOOK_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cookbook/${slug}`;
      const e = entries.find((x) => x.slug === slug);
      pages.push({
        path: `/cookbook/${slug}`,
        title,
        description,
        lastmod: (e && e.updated) || LASTMOD.cookbook,
        body: e ? cookbookBody(e, DATA) : undefined,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, image: `${SITE}/og-image.png`, datePublished: (e && e.updated) || LASTMOD.cookbook, dateModified: (e && e.updated) || LASTMOD.cookbook, author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE }, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } } },
          crumb([
            { name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

/* ---------------- glossary routes (KI markdown → full-body term pages, GOS-03) ---------------- */

function parseKiSections(body) {
  const out = {};
  const re = /\*\*([^*\n]+?):\*\*/g;
  const marks = [];
  let m;
  while ((m = re.exec(body))) marks.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const next = i + 1 < marks.length ? marks[i + 1].start : body.length;
    out[marks[i].label.replace(/\([^)]*\)/g, '').trim().toLowerCase()] = body.slice(marks[i].end, next).trim();
  }
  return out;
}

const kiPlain = (s) =>
  (s || '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function glossaryPages(DATA) {
  const pages = [
    {
      path: '/glossary',
      title: DATA.hub.HUB_META.glossary.title,
      description: DATA.hub.HUB_META.glossary.description,
      lastmod: LASTMOD.static,
      jsonLd: [crumb([{ name: 'शब्दकोश', item: `${SITE}/glossary` }])],
    },
  ];
  if (!existsSync(GLOSSARY_DIR)) return pages;
  const files = readdirSync(GLOSSARY_DIR).filter((f) => /^KI-\d+.*\.md$/.test(f));

  // pass 1 — parse all KIs (need the id→slug map for related-concept links)
  const terms = [];
  for (const file of files) {
    const src = readFileSync(resolve(GLOSSARY_DIR, file), 'utf-8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const field = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1]?.trim() || '';
    if (field('status') && field('status') !== 'active') continue;
    const body = src.slice(fm[0].length);
    terms.push({
      slug: file.replace(/^KI-\d+-/, '').replace(/\.md$/, ''),
      id: field('knowledge_id'),
      hindi: field('hindi_name'),
      en: field('english_name') || field('title'),
      lastUpdated: field('last_updated'),
      sections: parseKiSections(body),
    });
  }
  const idToSlug = new Map(terms.map((t) => [t.id, t.slug]));

  // glossary hub body — A–Z list of every active term (crawlable link hub)
  pages[0].lastmod = maxDate(terms.map((t) => t.lastUpdated), LASTMOD.static);
  pages[0].body = shell({
    current: 'शब्दकोश',
    html:
      `<h1>सहकारी लेखांकन शब्दकोश</h1><p>हर शब्द आसान हिन्दी व English में — ${terms.length} शब्द:</p><ul>` +
      [...terms].sort((a, b) => a.en.localeCompare(b.en))
        .map((t) => `<li><a href="/glossary/${t.slug}">${esc(t.hindi ? `${t.hindi} (${t.en})` : t.en)}</a></li>`).join('') +
      `</ul>` + registerCta(),
  });
  pages[0]._terms = terms; // English twin (batch E2) — not rendered

  for (const t of terms) {
    const s = t.sections;
    const name = t.hindi ? `${t.hindi} (${t.en})` : t.en;
    const def = kiPlain(s['definition']);
    // SERP snippet + schema description in HINDI. The KI `definition` field is English, but
    // this is a Hindi-first product and these pages rank on "…meaning in hindi / क्या है"
    // queries — an English snippet under a Hindi title was killing CTR (e.g. passbook: 334
    // impressions, 0 clicks). The KI's own `hindi explanation` is the natural snippet; fall
    // back to the English definition only when a term has no Hindi explanation.
    const hindiDef = kiPlain(s['hindi explanation']) || def;
    const url = `${SITE}/glossary/${t.slug}`;

    // related-concept links (only to other ACTIVE terms)
    const related = [];
    const relRe = /\[\[(KI-\d+)\]\]\s*([^·\n]*)/g;
    let rm;
    while ((rm = relRe.exec(s['related concepts'] || ''))) {
      const slug = idToSlug.get(rm[1]);
      const label = rm[2].replace(/\(planned\)/i, '').trim();
      if (slug) related.push(`<a href="/glossary/${slug}">${esc(label)}</a>`);
      else if (label) related.push(esc(label));
    }
    // KI related-concept labels are English already; the English twin reuses this list (batch E2)
    const internalLinks = Array.from((s['internal links'] || '').matchAll(/(^|[\s·])(\/[a-z0-9/:_-]+)/gi))
      .map((mm) => mm[2])
      .filter(isPublicRoute); // app-module links stay on the live page, not in crawler HTML

    pages.push({
      path: `/glossary/${t.slug}`,
      title: DATA.seo ? DATA.seo.glossaryTitle(name) : `${name} — सहकारी लेखांकन शब्दकोश | SahakarLekha`,
      description: DATA.hub.glossaryMetaDescription({ hindi: s['hindi explanation'], definition: s['definition'] }), // L5: same rule as GlossaryTerm
      lastmod: t.lastUpdated || LASTMOD.static,
      _term: { t, related, internalLinks }, // English twin (batch E2) — not rendered
      body: shell({
        crumbs: [['/glossary', 'शब्दकोश']],
        current: t.hindi || t.en,
        html:
          `<h1>${esc(t.hindi || t.en)}</h1><p><em>${esc(t.en)}</em></p>` +
          (def ? `<p><strong>परिभाषा:</strong> ${esc(def)}</p>` : '') +
          (s['plain-language explanation'] ? `<h2>आसान शब्दों में</h2><p>${esc(kiPlain(s['plain-language explanation']))}</p>` : '') +
          (s['hindi explanation'] ? `<h2>हिन्दी में</h2><p lang="hi">${esc(kiPlain(s['hindi explanation']))}</p>` : '') +
          (s['english explanation'] ? `<h2>In English</h2><p lang="en">${esc(kiPlain(s['english explanation']))}</p>` : '') +
          (s['why it matters'] ? `<h2>यह क्यों ज़रूरी है</h2><p>${esc(kiPlain(s['why it matters']))}</p>` : '') +
          (s['common misconceptions'] ? `<h2>आम गलतफ़हमियाँ</h2>${md(s['common misconceptions'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
          (s['learning objectives'] ? `<h2>सीखने के लक्ष्य</h2>${md(s['learning objectives'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
          (related.length ? `<h2>जुड़े विषय</h2><p>${related.join(' · ')}</p>` : '') +
          (() => {
            // GOS-11: definition → narrative edge in the static body too
            const pb = DATA.rel && DATA.rel.GLOSSARY_BLOG && DATA.rel.GLOSSARY_BLOG[t.slug];
            return pb && blogIsLive(DATA, pb.slug) ? `<p>पूरा लेख पढ़ें: <a href="/blog/${pb.slug}">${esc(pb.title)}</a></p>` : '';
          })() +
          (internalLinks.length ? `<p>और पढ़ें: ${internalLinks.map((l) => `<a href="${l}">${l}</a>`).join(' · ')}</p>` : '') +
          registerCta(),
      }),
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'DefinedTerm', name, description: hindiDef,
          inLanguage: 'hi', url, termCode: t.id,
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'SahakarLekha Glossary', url: `${SITE}/glossary` },
        },
        crumb([
          { name: 'शब्दकोश', item: `${SITE}/glossary` },
          { name: t.en, item: url },
        ]),
      ],
    });
  }
  return pages;
}

/* ---------------- calculator routes (regex meta + registry-data body) ---------------- */

function calcBody(c, DATA) {
  const cookbookSlugs = (DATA.rel && DATA.rel.CALC_COOKBOOK && DATA.rel.CALC_COOKBOOK[c.slug]) || [];
  return shell({
    crumbs: [['/tools', 'कैलकुलेटर']],
    current: c.hindiName,
    html:
      `<h1>${esc(c.hindiName)} (${esc(c.englishName)})</h1>` +
      (c.intro ? `<p>${esc(c.intro)}</p>` : '') +
      `<p><em>इंटरैक्टिव कैलकुलेटर पेज लोड होते ही चालू हो जाता है — नीचे सूत्र व उदाहरण पढ़ें।</em></p>` +
      (c.formula ? `<h2>सूत्र</h2>${md(c.formula)}` : '') +
      (c.explanation ? `<h2>यह कैसे काम करता है</h2>${md(c.explanation)}` : '') +
      (c.example ? `<h2>उदाहरण</h2>${md(c.example)}` : '') +
      (c.mistakes ? `<h2>आम गलतियाँ</h2>${md(c.mistakes)}` : '') +
      (c.faqs && c.faqs.length
        ? `<h2>अक्सर पूछे जाने वाले प्रश्न</h2>` + c.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      surfaceLinksHtml({ cookbook: cookbookSlugs }, DATA, 'एंट्री कैसे दर्ज करें (कुकबुक)') +
      (c.relatedGlossary && c.relatedGlossary.length
        ? `<p>जुड़े शब्द: ${c.relatedGlossary.map((g) => `<a href="/glossary/${g}">${g.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (() => {
        const liveArticles = (c.relatedArticles || []).filter((a) => blogIsLive(DATA, a.slug));
        return liveArticles.length
          ? `<p>गहराई से पढ़ें: ${liveArticles.map((a) => `<a href="/blog/${a.slug}">${esc(a.title)}</a>`).join(' · ')}</p>` : '';
      })() +
      (c.relatedGuide && c.relatedGuide.length
        ? `<p>गाइड में सीखें: ${c.relatedGuide.map((g) => `<a href="/guide/${g.slug}">${esc(g.title)}</a>`).join(' · ')}</p>` : '') +
      (c.relatedHelp && c.relatedHelp.length
        ? `<p>ऐप में कैसे करें: ${c.relatedHelp.map((h) => `<a href="/help/${h.slug}">${esc(h.title)}</a>`).join(' · ')}</p>` : '') +
      (c.related && c.related.length
        ? `<p>और कैलकुलेटर: ${c.related.map((r) => `<a href="/tools/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (c.updated ? `<p><small>अंतिम अपडेट: ${esc(c.updated)}</small></p>` : '') +
      registerCta(),
  });
}

function calculatorPages(DATA) {
  const calcs = DATA.calc || [];
  const pages = [
    {
      path: '/tools',
      title: DATA.hub.HUB_META.tools.title,
      description: DATA.hub.HUB_META.tools.description,
      lastmod: maxDate(calcs.map((c) => c.updated), LASTMOD.calc),
      jsonLd: [crumb([{ name: 'कैलकुलेटर', item: `${SITE}/tools` }])],
      body: calcs.length
        ? shell({
            current: 'कैलकुलेटर',
            html:
              `<h1>मुफ्त कैलकुलेटर</h1><p>सहकारी समिति के हिसाब के लिए — हर कैलकुलेटर के साथ सूत्र, उदाहरण व आम गलतियाँ:</p><ul>` +
              calcs.map((c) => `<li><a href="/tools/${c.slug}">${esc(c.hindiName)}</a> — ${esc(c.intro || '')}</li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(CALC_FILE)) {
    const src = readFileSync(CALC_FILE, 'utf-8');
    // per calculator: slug, metaTitle, metaDescription in order. Tempered `(?!slug:)` so an
    // inner slug: (relatedArticles/relatedHelp) never bridges to the NEXT config's meta.
    const re = /slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?metaTitle:\s*'((?:[^'\\]|\\.)*)'(?:(?!slug:)[\s\S])*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/tools/${slug}`;
      const c = calcs.find((x) => x.slug === slug);
      pages.push({
        path: `/tools/${slug}`,
        title,
        description,
        lastmod: (c && c.updated) || LASTMOD.calc,
        body: c ? calcBody(c, DATA) : undefined,
        jsonLd: [
          {
            '@context': 'https://schema.org', '@type': 'WebApplication', name: title, description,
            inLanguage: 'hi', url, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
            isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
            publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          },
          crumb([
            { name: 'कैलकुलेटर', item: `${SITE}/tools` },
            { name: title, item: url },
          ]),
          // HowTo + FAQPage were client-only (CalculatorShell) — mirror them into the
          // static HTML so non-JS/AI crawlers get the step-by-step + Q&A (the highest-
          // value AI-citation surface for a calculator).
          ...(c && Array.isArray(c.inputs)
            ? [{
                '@context': 'https://schema.org', '@type': 'HowTo',
                name: `${c.hindiName} कैसे इस्तेमाल करें`, inLanguage: 'hi',
                step: [
                  ...c.inputs.map((inp, i) => ({ '@type': 'HowToStep', position: i + 1, name: `${inp.label} भरें`, text: `${inp.label}${inp.sub ? ' — ' + inp.sub : ''}।` })),
                  { '@type': 'HowToStep', position: c.inputs.length + 1, name: 'परिणाम देखें', text: 'परिणाम तुरंत दिख जाता है — कोई बटन दबाने की ज़रूरत नहीं।' },
                ],
              }]
            : []),
          ...(c && Array.isArray(c.faqs) && c.faqs.length
            ? [{
                '@context': 'https://schema.org', '@type': 'FAQPage',
                mainEntity: c.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
              }]
            : []),
        ],
      });
    }
  }
  return pages;
}

/* ---------------- /downloads hub ---------------- */

// Static body from src/content/downloads.ts: every resource with its format, use, state/year, review date and the
// honest "expert review pending / not a statutory form" note — the same facts the React page shows.
function downloadsPages(DATA) {
  const D = DATA.downloads;
  if (!D || !Array.isArray(D.DOWNLOADS)) return [];
  const items = D.DOWNLOADS.map((r) =>
    `<li id="${esc(r.slug)}"><h2>${esc(r.title)}</h2><p><em>${esc(r.englishTitle)}</em></p><ul>` +
    `<li><strong>प्रारूप:</strong> ${esc(r.format)}</li><li><strong>उपयोग:</strong> ${esc(r.use)}</li>` +
    `<li><strong>राज्य:</strong> ${esc(r.applicability)}</li><li><strong>वर्ष:</strong> ${esc(r.year)}</li>` +
    `<li><strong>अंतिम समीक्षा:</strong> ${esc(r.reviewed)}</li><li>${esc(r.expertReview)}</li></ul>` +
    (r.kind === 'page' && r.href ? `<p><a href="${esc(r.href)}">खोलें व प्रिंट करें</a></p>` : '<p>PDF पेज पर बटन दबाकर डाउनलोड करें (बिना ईमेल)।</p>') +
    (r.related && r.related.length ? `<p>जुड़े पेज: ${r.related.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ')}</p>` : '') +
    `</li>`).join('');
  return [{
    path: '/downloads',
    title: D.DOWNLOADS_META.title,
    description: D.DOWNLOADS_META.description,
    lastmod: notFuture(D.DOWNLOADS_REVIEWED),
    body: shell({
      current: 'मुफ्त प्रारूप',
      html: `<h1>मुफ्त खाली प्रारूप (Downloads)</h1>` +
        `<p>ये सामान्य कार्य-प्रारूप हैं, वैधानिक (statutory) प्रपत्र नहीं। आपके राज्य के सहकारी अधिनियम/नियम या समिति की उपविधि में कोई प्रारूप निर्धारित हो, तो वही मान्य है।</p>` +
        `<ol>${items}</ol>` + registerCta(),
    }),
    jsonLd: [
      crumb([{ name: 'डाउनलोड', item: `${SITE}/downloads` }]),
      { '@context': 'https://schema.org', '@type': 'ItemList',
        itemListElement: D.DOWNLOADS.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.title, url: `${SITE}/downloads#${r.slug}` })) },
    ],
  }];
}

/* ---------------- app-shell publics (L2) ---------------- */

// These routes were in the sitemap with NO static file: crawlers got the homepage template (homepage
// <title>, canonical "/"), so 18 sitemap URLs each declared themselves a copy of "/". Each now gets its
// own head (same title/description/canonical as the page's useDocumentMeta) and a short honest body;
// the quizzes list their real questions. React replaces the body on mount.
function appShellPages(DATA) {
  const page = (path, title, description, h1, html, crumbs = []) => ({
    path, title, description, lastmod: LASTMOD.static,
    body: shell({ crumbs, current: h1, html: `<h1>${esc(h1)}</h1><p>${esc(description)}</p>` + html }),
  });
  const pages = [
    page('/privacy', 'गोपनीयता नीति — SahakarLekha | Privacy Policy',
      'SahakarLekha आपकी समिति का कौन-सा डेटा रखता है और उसे कैसे सुरक्षित रखता है — society-level isolation व एन्क्रिप्शन. What data SahakarLekha holds and how it protects your cooperative society data.',
      'गोपनीयता नीति — Privacy Policy', '<p><a href="/terms">नियम व शर्तें</a> · <a href="/contact">संपर्क करें</a></p>'),
    page('/terms', 'नियम व शर्तें — SahakarLekha | Terms & Conditions',
      'SahakarLekha सहकारी लेखा प्लेटफ़ॉर्म के उपयोग की नियम व शर्तें. Terms and conditions for using the SahakarLekha cooperative accounting platform.',
      'नियम व शर्तें — Terms & Conditions', '<p><a href="/privacy">गोपनीयता नीति</a> · <a href="/contact">संपर्क करें</a></p>'),
    page('/guide/quick-start', 'SahakarLekha कैसे चलाएँ? — पूर्ण उपयोग गाइड | सहकार लेखा',
      'सहकारी समिति के क्लर्क, लेखाकार, प्रबंधक और ऑडिटर के लिए STEP-BY-STEP सरल हिंदी गाइड — बिना किसी ट्रेनिंग के सहकार लेखा सॉफ्टवेयर चलाएँ।',
      'SahakarLekha कैसे चलाएँ?', '<p><a href="/guide">पूरा लेखांकन कोर्स</a> · <a href="/help">मदद केंद्र</a></p>' + registerCta(), [['/guide', 'गाइड']]),
    page('/guide/certificate', 'पूर्णता प्रमाणपत्र — सहकार लेखा गाइड',
      'सहकार लेखा सम्पूर्ण लेखांकन कोर्स पूरा करने पर यूनीक क्रमांक वाला, सत्यापन-योग्य पूर्णता प्रमाणपत्र प्राप्त करें।',
      'पूर्णता प्रमाणपत्र', '<p><a href="/guide">कोर्स शुरू करें</a> · <a href="/guide/verify">प्रमाणपत्र सत्यापित करें</a></p>', [['/guide', 'गाइड']]),
    page('/guide/verify', 'प्रमाणपत्र सत्यापन — सहकार लेखा गाइड',
      'सहकार लेखा गाइड के पूर्णता प्रमाणपत्र को क्रमांक व नाम से सत्यापित करें।',
      'प्रमाणपत्र सत्यापन', '<p><a href="/guide/certificate">पूर्णता प्रमाणपत्र</a></p>', [['/guide', 'गाइड']]),
  ];
  for (const q of Object.values(DATA.quizzes || {})) {
    if (!q || !q.partId) continue;
    const list = q.questions || [];
    pages.push(page(`/guide/quiz/${q.partId}`, `${q.title} — क्विज़ | सहकार लेखा गाइड`,
      `${q.title}: ${list.length} प्रश्नों की क्विज़ — अपना ज्ञान परखें।`,
      q.title, `<ol>${list.map((x) => `<li>${esc(x.q)}</li>`).join('')}</ol><p><a href="/guide">गाइड पर लौटें</a></p>`, [['/guide', 'गाइड']]));
  }
  return pages;
}

/* ---------------- pricing + faq (GOS-05: static publics, now prerendered) ---------------- */

function staticExtraPages(DATA) {
  const pages = [];

  // Homepage — was CSR-only (empty <div id="root">), so non-JS/AI crawlers got no
  // body on the highest-priority URL. Emit a real static body (React replaces it on
  // mount). No jsonLd here: the template <head> already carries the homepage
  // SoftwareApplication/WebSite/FAQPage, and transform() preserves them for path '/'.
  pages.push({
    path: '/',
    title: 'SahakarLekha — Cooperative Society Accounting Software India',
    description: 'भारतीय cooperative societies के लिए accounting, GST/TDS, member records, reports और audit-ready workflows — PACS, Dairy, Marketing, Consumer व अन्य। SahakarLekha ₹2,999/year + GST से शुरू करें, Hindi + English।',
    lastmod: LASTMOD.static,
    // Mirrors LandingPage's hero (same h1/lead/CTA copy) so the hand-off to React is
    // near-seamless. Pricing copy must match the paid model: no public free plan.
    body: shell({
      hero:
        `<section class="sl-hero"><div class="sl-hero-in">` +
          `<span class="sl-badge">सहकारी समितियों के लिए बना लेखा प्लेटफ़ॉर्म</span>` +
          `<h1>सहकारी समिति का <span>Accounting, Compliance और Control</span> — एक ही जगह।</h1>` +
          `<p class="sl-lead">PACS, dairy, marketing, consumer और अन्य cooperative societies के लिए बनाया गया — जहाँ vouchers से लेकर financial statements, GST/TDS और audit-ready reports तक एक connected system में रहते हैं।</p>` +
          `<p>Professional cooperative accounting <strong>₹2,999/year + GST से</strong>। Team व operations बढ़ें तो Plus या Pro के साथ आगे बढ़ें।</p>` +
          `<div class="sl-ctas"><a class="sl-btn" href="/register">शुरू करें →</a><a class="sl-btn sl-btn-o" href="/pricing">मूल्य देखें</a></div>` +
          `<p class="sl-ticks">✓ Unlimited Vouchers · ✓ Unlimited Members · ✓ Data Export Anytime · ✓ ₹2,999/year + GST से</p>` +
        `</div></section>`,
      html:
        `<h2>एक ही system में सब कुछ</h2>` +
        `<ul class="sl-cards">` +
          `<li>असीमित वाउचर व सदस्य — नकद/बैंक, खरीद-बिक्री, वेतन, ऋण, जमा</li>` +
          `<li>सभी रिपोर्ट PDF/Excel में — ट्रायल बैलेंस, बैलेंस शीट, आय-व्यय, प्राप्ति-भुगतान, TDS/GST</li>` +
          `<li>सहकारी-विशेष — ऋण रजिस्टर व ऋण-सीमा जाँच, आरक्षित निधि विनियोजन, नामांकन, RCS ऑडिट प्रारूप</li>` +
          `<li>साप्ताहिक स्वतः बैकअप · हिन्दी + English · डेटा कभी भी export करें, कोई लॉक-इन नहीं</li>` +
        `</ul>` +
        `<p>PACS, dairy, marketing, consumer, housing — हर प्रकार की समिति के लिए। Starter ₹2,999/year + GST · Plus ₹6,999/year + GST · Pro ₹14,999/year + GST — <a href="/pricing">सभी plans देखें</a>।</p>` +
        `<p><a href="/software">अपनी समिति के प्रकार के लिए</a> · <a href="/guide">मुफ़्त गाइड व कोर्स</a> · <a href="/blog">ब्लॉग</a> · <a href="/tools">कैलकुलेटर</a> · <a href="/glossary">शब्दकोश</a></p>` +
        registerCta(),
    }),
  });

  // About + Contact were sitemapped but CSR-only (empty body to non-JS/AI crawlers).
  pages.push({
    path: '/about',
    title: 'हमारे बारे में — SahakarLekha | सहकारी समिति लेखा सॉफ्टवेयर',
    description: 'SahakarLekha भारत की सहकारी समितियों के लिए बना लेखा प्लेटफ़ॉर्म है — हमारा उद्देश्य, दृष्टि व अनुपालन (RCS, TDS, GST, NABARD). Learn about our mission to digitise cooperative society accounting across India.',
    lastmod: LASTMOD.static,
    jsonLd: [crumb([{ name: 'हमारे बारे में', item: `${SITE}/about` }])],
    body: shell({
      current: 'हमारे बारे में',
      html:
        `<h1>हमारे बारे में — About SahakarLekha</h1>` +
        `<p>SahakarLekha एक <strong>सहकारी-विशेष क्लाउड लेखा प्लेटफ़ॉर्म</strong> है। हमारा उद्देश्य — भारत की हर सहकारी समिति को, चाहे गाँव की छोटी समिति हो या राज्य-स्तरीय फेडरेशन, आधुनिक, पारदर्शी व किफ़ायती लेखा प्रणाली देना — <a href="/pricing">₹2,999/year + GST से</a>।</p>` +
        `<p>A cooperative-specific cloud accounting platform — built for PACS, dairy, marketing, consumer and housing societies, in Hindi and English, from ₹2,999 per year plus GST.</p>` +
        `<h2>अनुपालन की तैयारी (Compliance support)</h2>` +
        `<ul>` +
          `<li>राज्य-वार ऑडिट schedules — Haryana, Maharashtra, Gujarat, Karnataka, Kerala, UP आदि (धाराएँ राज्य अधिनियम अनुसार अलग)</li>` +
          `<li>TDS रजिस्टर + तिमाही TDS डेटा निर्यात (पुराना Form 26Q layout) — फाइलिंग Income Tax e-Filing portal पर आप करते हैं</li>` +
          `<li>GST — GSTR-1 / GSTR-3B के आँकड़े व e-Way Bill JSON — फाइलिंग सरकारी portal पर आप करते हैं</li>` +
          `<li>NABARD / DCCB-शैली MIS रिपोर्ट व RCS दो-खंड ट्रायल बैलेंस/बैलेंस शीट</li>` +
          `<li>आरक्षित निधि विनियोजन — % अपने राज्य अधिनियम/उपनियम अनुसार</li>` +
        `</ul>` +
        `<p><a href="/contact">संपर्क करें</a> · <a href="/guide">गाइड</a> · <a href="/software">समिति के प्रकार</a></p>` +
        registerCta(),
    }),
  });

  pages.push({
    path: '/contact',
    title: 'संपर्क करें — SahakarLekha सहकारी लेखा सॉफ्टवेयर सहायता',
    description: 'SahakarLekha टीम से संपर्क करें — सहायता, डेमो व अपनी सहकारी समिति को ऑनबोर्ड करने के लिए. Contact us for support, a demo, or to onboard your cooperative society.',
    lastmod: LASTMOD.static,
    jsonLd: [crumb([{ name: 'संपर्क', item: `${SITE}/contact` }])],
    body: shell({
      current: 'संपर्क',
      html:
        `<h1>संपर्क करें — Contact Us</h1>` +
        `<p>सहायता, डेमो, या अपनी सहकारी समिति को ऑनबोर्ड करने के लिए हमसे संपर्क करें — हिन्दी या English में।</p>` +
        `<ul>` +
          `<li><strong>WhatsApp:</strong> +91 94679 18545</li>` +
          `<li><strong>ईमेल / Email:</strong> support@sahakarlekha.com</li>` +
        `</ul>` +
        `<p>अपनी समिति अभी शुरू करें (<a href="/pricing">₹2,999/year + GST से</a>), या पहले <a href="/guide">गाइड</a> व <a href="/faq">सामान्य प्रश्न</a> देखें।</p>` +
        registerCta(),
    }),
  });

  // संपादकीय व सुधार नीति — same text module as src/pages/EditorialPolicy.tsx.
  if (DATA.policy) {
    const P = DATA.policy;
    const E = P.EDITORIAL_POLICY;
    pages.push({
      path: P.EDITORIAL_POLICY_PATH,
      title: E.title,
      description: E.description,
      lastmod: '2026-10-18', // when this policy text last changed
      jsonLd: [crumb([
        { name: 'होम', item: `${SITE}/` },
        { name: 'ब्लॉग', item: `${SITE}/blog` },
        { name: E.h1, item: `${SITE}${P.EDITORIAL_POLICY_PATH}` },
      ])],
      body: shell({
        crumbs: [['/blog', 'ब्लॉग']],
        current: E.h1,
        html:
          `<h1>${esc(E.h1)}</h1><p>${esc(E.intro)}</p>` +
          E.sections.map((s) => `<h2>${esc(s.heading)}</h2>` + s.paras.map((t) => `<p>${esc(t)}</p>`).join('')).join('') +
          `<p><a href="/contact">ग़लती बताएँ: संपर्क पन्ना</a> · <a href="/author/sitaram">लेखक की प्रोफ़ाइल</a> · <a href="/blog">सभी लेख</a></p>`,
      }),
    });
  }

  pages.push({
    path: '/pricing',
    title: 'SahakarLekha Pricing — Starter, Plus & Pro Plans',
    description: 'SahakarLekha cooperative accounting ₹2,999/साल + GST से — 30 दिन मुफ़्त trial। सभी रिपोर्ट हर plan में; staff, Payroll और Member Portal के लिए Plus; शाखाएँ, असीमित users व डेटा-migration के लिए Pro।',
    lastmod: LASTMOD.pricing,
    jsonLd: [crumb([{ name: 'मूल्य', item: `${SITE}/pricing` }]), ...(DATA.seo ? [DATA.seo.pricingJsonLd()] : [])],
    body: shell({
      current: 'मूल्य',
      html:
        `<h1>SahakarLekha मूल्य — Starter, Plus व Pro</h1>` +
        `<p>Professional cooperative accounting ₹2,999/साल + GST से। रजिस्टर करने पर 30 दिन का मुफ़्त trial मिलता है। हिसाब-किताब और सभी रिपोर्ट हर plan में एक जैसी हैं; Plus में staff, Payroll और Member Portal जुड़ते हैं, Pro में शाखाएँ, संयुक्त रिपोर्ट और असीमित users।</p>` +
        `<h2>Starter — ₹2,999 / साल + GST (≈ ₹250/माह)</h2>` +
        `<p>छोटी समिति, जहाँ एक व्यक्ति हिसाब रखता है — पूरा professional accounting, कोई demo नहीं। 1 समिति · 1 user · असीमित vouchers व सदस्य। Ledger, Trial Balance, Balance Sheet, लाभ-हानि, प्राप्ति-भुगतान, GST/TDS सारांश, सदस्य/Share/Loan register, Custom Chart of Accounts, PDF/Excel/CSV export व साप्ताहिक cloud backup — आपका डेटा आपका। वेतन (Payroll), Member Portal और शाखाएँ शामिल नहीं।</p>` +
        `<h2>Plus — ₹6,999 / साल + GST (≈ ₹583/माह)</h2>` +
        `<p>staff के साथ चलने वाली समिति के लिए। Starter का सब कुछ, और: <strong>6 users</strong> (जैसे 5 staff + 1 Auditor/CA), हर user की अलग भूमिका (Role-Based Access), वेतन — कर्मचारी, वेतन पर्ची व PF/ESI/TDS कटौती, और Member Portal — सदस्य अपना खाता खुद देखें।</p>` +
        `<h2>Pro — ₹14,999 / साल + GST (≈ ₹1,250/माह)</h2>` +
        `<p>बड़ी team वाली समिति के लिए। Plus का सब कुछ, और: असीमित users — हर शाखा व विभाग के staff के लिए; Multi-Branch — शाखा-वार हिसाब व रिपोर्ट; कई समितियों की संयुक्त रिपोर्ट; डेटा-migration सहायता शामिल — पुराना हिसाब हम डालेंगे (₹4,999 + GST की बचत); और priority WhatsApp support।</p>` +
        `<h2>Enterprise / Federation — ₹49,000/साल + GST से</h2>` +
        `<p>Federations, unions, clusters व बड़े deployments के लिए — कई समितियों का एक साथ setup, bulk डेटा-migration व dedicated onboarding/support। <a href="/contact">हमसे बात करें</a>।</p>` +
        `<p>सभी दाम प्रति समिति, भुगतान की तारीख़ से 12 महीने के लिए; GST अलग से जुड़ता है। Plan app के अंदर online ख़रीदें; बीच में upgrade पर सिर्फ़ बचे समय का अंतर लगता है। डेटा-migration सहायता ₹4,999 + GST एक बार (Pro में शामिल)। <a href="/faq">अक्सर पूछे जाने वाले प्रश्न देखें</a></p>` +
        registerCta(),
    }),
  });

  const cats = DATA.faq || [];
  const faqJsonLd = cats.length
    ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: cats.flatMap((c) => c.items).map((it) => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: `${it.aHi} ${it.aEn}` },
        })),
      }]
    : [];
  pages.push({
    path: '/faq',
    title: 'अक्सर पूछे जाने वाले प्रश्न (FAQ) — SahakarLekha',
    description: 'क्या यह वाकई मुफ़्त है? ऑडिटर रिपोर्ट स्वीकार करेंगे? डेटा सुरक्षित है? Tally से कैसे आएँ? — SahakarLekha के सभी सामान्य प्रश्नों के उत्तर हिंदी व English में.',
    lastmod: LASTMOD.faq,
    jsonLd: [...faqJsonLd, crumb([{ name: 'FAQ', item: `${SITE}/faq` }])],
    body: cats.length
      ? shell({
          current: 'FAQ',
          html:
            `<h1>अक्सर पूछे जाने वाले प्रश्न</h1>` +
            cats.map((c) =>
              `<h2>${esc(c.label)}</h2>` +
              c.items.map((it) => `<h3>${esc(it.q)}</h3><p lang="hi">${esc(it.aHi)}</p><p lang="en">${esc(it.aEn)}</p>`).join('')
            ).join('') +
            registerCta(),
        })
      : undefined,
  });

  return pages;
}

/* ---------------- English twins at /en/… (batch E1: "the URL decides the language") ---------------- */
//
// For every Hindi page above whose path has an English twin (src/lib/enRoutes — THE list, never a copy here) AND
// whose English content exists, emit the English page at toEn(path): English head, body, JSON-LD (inLanguage 'en',
// English breadcrumb names). Both twins then carry hreflang hi-IN / en-IN / x-default (= Hindi). A Hindi page with
// no English content gets no twin (and no hreflang) — an "English" page with a Hindi body would be the same page twice.
// English text comes from the same modules the live English pages use: pageMetaEn, guide/entriesEn + guide/en/*.md,
// help/en, cookbook/en, calculators/en, faq.ts (the English half of each bilingual string).

/** English short title of a guide entry (ENTRY_EN), or null. */
function enEntryTitle(DATA, slug) {
  const e = DATA.guideEn && DATA.guideEn.ENTRY_EN && DATA.guideEn.ENTRY_EN[slug];
  return e ? e.shortTitle : null;
}

/** 'हिंदी / English' → the English half (same split as FAQ.tsx's splitBilingual). */
const enHalf = (s) => {
  const i = String(s).indexOf(' / ');
  return i === -1 ? String(s) : String(s).slice(i + 3);
};

const enCrumb = (items) => crumb(items.map((it) => ({ name: it.name, item: SITE + DATA_EN_ROUTES.toEn(it.path) })));
/** Set in main once enRoutes is loaded (enCrumb / the builders read it). */
let DATA_EN_ROUTES = null;

const ORG = { '@type': 'Organization', name: 'SahakarLekha', url: SITE };
const PUBLISHER = { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } };

/** Hindi guide part title (manifest `section`) → English part title, via the part ids in guide/index.ts. */
function guidePartTitlesEn(DATA) {
  const map = new Map([['', 'Introduction']]);
  try {
    const src = readFileSync(GUIDE_INDEX_FILE, 'utf-8');
    const parts = (DATA.guideEn && DATA.guideEn.PARTS_EN) || {};
    for (const m of src.matchAll(/"id":\s*"([^"]+)",\s*"title":\s*"([^"]+)"/g)) if (parts[m[1]]) map.set(m[2], parts[m[1]]);
  } catch { /* fail-soft: Hindi section names */ }
  return map;
}

/**
 * Build the English twin of one Hindi page. Returns { page } (body may be undefined → meta-only) or { skip: reason }.
 */
function englishTwin(hp, DATA) {
  const M = DATA.pageMetaEn;
  const p = hp.path;
  const base = { path: DATA_EN_ROUTES.toEn(p), hiPath: p, lang: 'en', lastmod: hp.lastmod };
  const needMeta = (key) => (M && M[key] ? M[key] : null);

  // ---- static publics ----
  if (p === '/') {
    const m = needMeta('home');
    if (!m) return { skip: 'pageMetaEn not loaded' };
    return { page: { ...base, title: m.title, description: m.description, body: homeBodyEn() } };
  }
  if (p === '/pricing') {
    const m = needMeta('pricing');
    if (!m) return { skip: 'pageMetaEn not loaded' };
    return { page: { ...base, title: m.title, description: m.description, body: pricingBodyEn(),
      jsonLd: [enCrumb([{ name: 'Pricing', path: '/pricing' }]), ...(DATA.seo ? [DATA.seo.pricingJsonLd()] : [])] } };
  }
  if (p === '/about') {
    const m = needMeta('about');
    if (!m) return { skip: 'pageMetaEn not loaded' };
    return { page: { ...base, title: m.title, description: m.description, body: aboutBodyEn(), jsonLd: [enCrumb([{ name: 'About us', path: '/about' }])] } };
  }
  if (p === '/contact') {
    const m = needMeta('contact');
    if (!m) return { skip: 'pageMetaEn not loaded' };
    return { page: { ...base, title: m.title, description: m.description, body: contactBodyEn(), jsonLd: [enCrumb([{ name: 'Contact', path: '/contact' }])] } };
  }
  if (p === '/faq') {
    const m = needMeta('faq');
    if (!m) return { skip: 'pageMetaEn not loaded' };
    const cats = DATA.faq || [];
    return { page: { ...base, title: m.title, description: m.description,
      jsonLd: [
        ...(cats.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en',
          mainEntity: cats.flatMap((c) => c.items).map((it) => ({ '@type': 'Question', name: enHalf(it.q), acceptedAnswer: { '@type': 'Answer', text: it.aEn } })) }] : []),
        enCrumb([{ name: 'FAQ', path: '/faq' }]),
      ],
      body: cats.length
        ? shell({ lang: 'en', current: 'FAQ',
            html: `<h1>Frequently Asked Questions</h1>` +
              cats.map((c) => `<h2>${esc(enHalf(c.label))}</h2>` + c.items.map((it) => `<h3>${esc(enHalf(it.q))}</h3><p>${esc(it.aEn)}</p>`).join('')).join('') +
              registerCtaEn() })
        : undefined } };
  }
  // short app-shell pages: same shape as appShellPages' page()
  const simple = { '/privacy': ['privacy', 'Privacy Policy', '<p><a href="/terms">Terms & Conditions</a> · <a href="/contact">Contact us</a></p>', []],
    '/terms': ['terms', 'Terms & Conditions', '<p><a href="/privacy">Privacy Policy</a> · <a href="/contact">Contact us</a></p>', []],
    '/guide/quick-start': ['quickStart', 'How to use SahakarLekha?', '<p><a href="/guide">The full accounting course</a> · <a href="/help">Help Center</a></p>' + registerCtaEn(), [['/guide', 'Guide']]],
    '/guide/certificate': ['certificate', 'Completion Certificate', '<p><a href="/guide">Start the course</a> · <a href="/guide/verify">Verify a certificate</a></p>', [['/guide', 'Guide']]],
    '/guide/verify': ['verify', 'Certificate Verification', '<p><a href="/guide/certificate">Completion Certificate</a></p>', [['/guide', 'Guide']]] }[p];
  if (simple) {
    const [key, h1, html, crumbs] = simple;
    const m = needMeta(key);
    if (!m) return { skip: 'pageMetaEn not loaded' };
    return { page: { ...base, title: m.title, description: m.description,
      body: shell({ lang: 'en', crumbs, current: h1, html: `<h1>${esc(h1)}</h1><p>${esc(m.description)}</p>` + html }) } };
  }
  if (p.startsWith('/guide/quiz/')) return { skip: 'quiz titles and questions exist only in Hindi (guide/quizzes.ts)' };

  // ---- guide ----
  if (p === '/guide') return { page: guideHubEn(base, DATA) };
  if (p.startsWith('/guide/')) {
    const slug = p.slice('/guide/'.length);
    const meta = DATA.guideEn && DATA.guideEn.ENTRY_EN && DATA.guideEn.ENTRY_EN[slug];
    if (!meta) return { skip: 'no English title/summary in guide/entriesEn.ts (ENTRY_EN)' };
    return { page: guideChapterEn(base, slug, meta, DATA) };
  }

  // ---- help ----
  if (p === '/help') return hubOr(base, DATA, 'help', () => helpHubEn(DATA));
  if (p.startsWith('/help/')) {
    const t = (DATA.help || []).find((x) => x.slug === p.slice('/help/'.length));
    if (!t || !DATA.helpEn || !DATA.helpEn.HELP_EN || !DATA.helpEn.HELP_EN[t.slug]) return { skip: 'no English overlay in help/en' };
    return { page: helpTaskEn(base, DATA.helpEn.localizeHelpTask(t, 'en'), DATA) };
  }

  // ---- cookbook ----
  if (p === '/cookbook') return hubOr(base, DATA, 'cookbook', () => cookbookHubEn(DATA));
  if (p.startsWith('/cookbook/')) {
    const e = (DATA.cookbook || []).find((x) => x.slug === p.slice('/cookbook/'.length));
    if (!e || !DATA.cookbookEn || !DATA.cookbookEn.COOKBOOK_EN || !DATA.cookbookEn.COOKBOOK_EN[e.slug]) return { skip: 'no English overlay in cookbook/en' };
    return { page: cookbookEntryEn(base, DATA.cookbookEn.localizeCookbookEntry(e, 'en'), DATA) };
  }

  // ---- calculators ----
  if (p === '/tools') return hubOr(base, DATA, 'tools', () => toolsHubEn(DATA));
  if (p.startsWith('/tools/')) {
    const c = (DATA.calc || []).find((x) => x.slug === p.slice('/tools/'.length));
    if (!c || !DATA.calcEn || !DATA.calcEn.CALC_EN_TEXT || !DATA.calcEn.CALC_EN_TEXT[c.slug]) return { skip: 'no English text in calculators/en' };
    return { page: calculatorEn(base, DATA.calcEn.localizeCalculator(c, 'en'), DATA) };
  }

  // ---- batch E2: blog, author pages, editorial policy, glossary ----
  if (p === '/blog') return blogIndexEn(base, hp, DATA);
  if (p.startsWith('/blog/category/')) return blogCategoryEn(base, hp, DATA);
  if (p.startsWith('/blog/')) return blogPostEn(base, hp, DATA);
  if (p.startsWith('/author/')) return authorEn(base, hp, DATA);
  if (DATA.policy && p === DATA.policy.EDITORIAL_POLICY_PATH) return editorialPolicyEn(base, DATA);
  if (p === '/glossary') return glossaryHubEn(base, hp, DATA);
  if (p.startsWith('/glossary/')) return glossaryTermEn(base, hp, DATA);
  return { skip: 'no English builder for this path' };
}

/** Hub twin: English meta from pageMetaEn + a body (undefined → meta-only). */
function hubOr(base, DATA, key, bodyFn) {
  const m = DATA.pageMetaEn && DATA.pageMetaEn[key];
  if (!m) return { skip: 'pageMetaEn not loaded' };
  const names = { help: 'Help Center', cookbook: 'Entry Cookbook', tools: 'Calculators' };
  let body;
  try { body = bodyFn(); } catch (e) { console.warn(`[prerender] English ${key} hub body skipped (${e && e.message})`); }
  return { page: { ...base, title: m.title, description: m.description, body, jsonLd: [enCrumb([{ name: names[key], path: `/${key}` }])] } };
}

function homeBodyEn() {
  return shell({
    lang: 'en',
    hero:
      `<section class="sl-hero"><div class="sl-hero-in">` +
        `<span class="sl-badge">Cooperative-first Accounting Platform</span>` +
        `<h1>Your cooperative society's <span>accounting, compliance and control</span> — all in one place.</h1>` +
        `<p class="sl-lead">Built for PACS, dairy, marketing, consumer and other cooperative societies — vouchers, financial statements, GST/TDS and audit-ready reports, all in one connected system.</p>` +
        `<p>Professional cooperative accounting <strong>from ₹2,999/year + GST</strong>. As your team and operations grow, move up to Plus or Pro.</p>` +
        `<div class="sl-ctas"><a class="sl-btn" href="/register">Get Started →</a><a class="sl-btn sl-btn-o" href="/pricing">See pricing</a></div>` +
        `<p class="sl-ticks">✓ Unlimited Vouchers · ✓ Unlimited Members · ✓ Data Export Anytime · ✓ From ₹2,999/year + GST</p>` +
      `</div></section>`,
    html:
      `<h2>Everything in one system</h2>` +
      `<ul class="sl-cards">` +
        `<li>Unlimited vouchers and members — cash/bank, purchase and sale, salary, loans, deposits</li>` +
        `<li>Every report in PDF/Excel — Trial Balance, Balance Sheet, Income & Expenditure, Receipts & Payments, TDS/GST</li>` +
        `<li>Built for cooperatives — loan register and loan-exposure check, reserve fund appropriation, nominations, RCS audit formats</li>` +
        `<li>Automatic weekly backup · Hindi + English · export your data any time, no lock-in</li>` +
      `</ul>` +
      `<p>For every kind of society — PACS, dairy, marketing, consumer, housing. Starter ₹2,999/year + GST · Plus ₹6,999/year + GST · Pro ₹14,999/year + GST — <a href="/pricing">see all plans</a>.</p>` +
      `<p><a href="/software">For your type of society</a> · <a href="/guide">Free guide and course</a> · <a href="/blog">Blog</a> · <a href="/tools">Calculators</a> · <a href="/glossary">Glossary</a></p>` +
      registerCtaEn(),
  });
}

function aboutBodyEn() {
  return shell({
    lang: 'en',
    current: 'About us',
    html:
      `<h1>About SahakarLekha</h1>` +
      `<p>SahakarLekha is a <strong>cooperative-specific cloud accounting platform</strong>. Our aim: to give every cooperative society in India — from a small village society to a state-level federation — a modern, transparent and affordable accounting system, <a href="/pricing">from ₹2,999/year + GST</a>.</p>` +
      `<h2>Vision</h2><p>To digitize every cooperative society in India — from village-level societies to state-level federations. Modern accounting should not be a privilege.</p>` +
      `<h2>Mission</h2><p>Build affordable, compliant, bilingual accounting software accessible to every cooperative society. No hidden charges, no complexity.</p>` +
      `<h2>Compliance support</h2>` +
      `<ul>` +
        `<li>State-wise audit schedules — Haryana, Maharashtra, Gujarat, Karnataka, Kerala, UP and more (sections differ by state Act)</li>` +
        `<li>TDS register + quarterly TDS data export (legacy Form 26Q layout) — you file on the Income Tax e-Filing portal</li>` +
        `<li>GST — GSTR-1 / GSTR-3B figures and e-Way Bill JSON — you file on the GST / e-Way Bill portals</li>` +
        `<li>NABARD / DCCB-style MIS report · RCS two-section Trial Balance & Balance Sheet</li>` +
        `<li>Statutory Reserve Fund appropriation — % set as per your state Act / bye-laws</li>` +
      `</ul>` +
      `<p><a href="/contact">Contact us</a> · <a href="/guide">Guide</a> · <a href="/software">Society types</a></p>` +
      registerCtaEn(),
  });
}

function contactBodyEn() {
  return shell({
    lang: 'en',
    current: 'Contact',
    html:
      `<h1>Contact Us</h1>` +
      `<p>Get in touch for support, a demo, or to onboard your cooperative society — in Hindi or English.</p>` +
      `<ul>` +
        `<li><strong>WhatsApp:</strong> +91 94679 18545</li>` +
        `<li><strong>Email:</strong> support@sahakarlekha.com</li>` +
      `</ul>` +
      `<p>Start your society now (<a href="/pricing">from ₹2,999/year + GST</a>), or first read the <a href="/guide">guide</a> and the <a href="/faq">frequently asked questions</a>.</p>` +
      registerCtaEn(),
  });
}

function pricingBodyEn() {
  return shell({
    lang: 'en',
    current: 'Pricing',
    html:
      `<h1>SahakarLekha Pricing — Starter, Plus & Pro</h1>` +
      `<p>Professional cooperative accounting from ₹2,999/year + GST. Registering gives you a 30-day free trial. Bookkeeping and every report are the same on every plan; Plus adds staff, Payroll and the Member Portal, Pro adds branches, combined reports and unlimited users.</p>` +
      `<h2>Starter — ₹2,999 / year + GST (≈ ₹250/month)</h2>` +
      `<p>For a small society run by one person — full professional accounting, not a demo. 1 society · 1 user · unlimited vouchers and members. Ledger, Trial Balance, Balance Sheet, Profit & Loss, Receipts & Payments, GST/TDS summary, Member/Share/Loan registers, Custom Chart of Accounts, PDF/Excel/CSV export and weekly cloud backup — your data is yours. Payroll, Member Portal and branches not included.</p>` +
      `<h2>Plus — ₹6,999 / year + GST (≈ ₹583/month)</h2>` +
      `<p>For a society with staff. Everything in Starter, plus: <strong>6 users</strong> (e.g. 5 staff + 1 auditor/CA), a separate role for every user (Role-Based Access), Payroll — employees, payslips and PF/ESI/TDS deductions, and the Member Portal — members see their own account.</p>` +
      `<h2>Pro — ₹14,999 / year + GST (≈ ₹1,250/month)</h2>` +
      `<p>For a society with a large team. Everything in Plus, plus: unlimited users — for the staff of every branch and department; Multi-Branch — branch-wise accounts and reports; combined reports for several societies; data-migration help included — we enter your old accounts (saves ₹4,999 + GST); and priority WhatsApp support.</p>` +
      `<h2>Enterprise / Federation — from ₹49,000/year + GST</h2>` +
      `<p>For federations, unions, clusters and large deployments — setting up many societies together, bulk data migration and dedicated onboarding/support. <a href="/contact">Talk to us</a>.</p>` +
      `<p>All prices are per society, for 12 months from the payment date; GST is added separately. Buy a plan online inside the app; upgrading mid-term charges only the difference for the remaining time. Data-migration help is ₹4,999 + GST one time (included in Pro). <a href="/faq">See the frequently asked questions</a></p>` +
      registerCtaEn(),
  });
}

function guideHubEn(base, DATA) {
  const M = DATA.pageMetaEn;
  const COURSE_EN = 'Cooperative Society Accounting & Audit — Complete Course';
  const entries = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf-8')).filter((e) => e && e.slug) : [];
  const partEn = guidePartTitlesEn(DATA);
  const bySection = new Map();
  for (const e of entries) {
    const s = e.section || '';
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s).push(e);
  }
  let toc = '';
  for (const [section, items] of bySection) {
    toc += `<h2>${esc(partEn.get(section) || section || 'Introduction')}</h2><ul>` +
      items.map((e) => `<li><a href="/guide/${e.slug}">${esc(enEntryTitle(DATA, e.slug) || e.title)}</a></li>`).join('') + `</ul>`;
  }
  return {
    ...base,
    title: M ? M.guide.title : 'SahakarLekha Guide — Complete Cooperative Accounting Course',
    description: M ? M.guide.description : '',
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Course', name: COURSE_EN,
        description: 'A free, self-paced course teaching cooperative society accounting from first principles to final accounts, GST/TDS, audit and year-end — 35 chapters with quizzes and a verifiable certificate.',
        provider: ORG, url: `${SITE}/en/guide`, inLanguage: 'en', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      },
      enCrumb([{ name: 'Guide', path: '/guide' }]),
    ],
    body: entries.length
      ? shell({ lang: 'en', current: 'Guide',
          html: `<h1>${esc(COURSE_EN)}</h1><p>From the foundations of accounting to audit — a free course for cooperative societies. All chapters below:</p>` + toc + registerCtaEn() })
      : undefined,
  };
}

function guideChapterEn(base, slug, meta, DATA) {
  const updated = (DATA.guideUpdated && DATA.guideUpdated.guideUpdated ? DATA.guideUpdated.guideUpdated(slug) : LASTMOD.guide);
  const url = SITE + base.path;
  let body;
  try {
    const mdFile = resolve(GUIDE_EN_DIR, `${slug}.md`);
    if (existsSync(mdFile)) {
      body = shell({ lang: 'en', crumbs: [['/guide', 'Guide']], current: meta.shortTitle,
        html: md(readFileSync(mdFile, 'utf-8')) + `<p><small>Last updated: ${esc(updated)}</small></p>` + registerCtaEn() });
    }
  } catch { /* body optional */ }
  const entry = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf-8')).find((e) => e && e.slug === slug) : null;
  const section = entry && entry.section ? guidePartTitlesEn(DATA).get(entry.section) : null;
  return {
    ...base,
    title: `${meta.shortTitle} — SahakarLekha Guide`, // same as GuideChapter's English title
    description: meta.summary,
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Article', headline: meta.shortTitle, description: meta.summary,
        inLanguage: 'en', url,
        isPartOf: { '@type': 'Course', name: 'Cooperative Society Accounting & Audit — Complete Course', url: `${SITE}/en/guide` },
        ...(section ? { articleSection: section } : {}),
        image: `${SITE}/og-image.png`, datePublished: LASTMOD.guide, dateModified: updated, author: ORG, publisher: PUBLISHER,
      },
      enCrumb([{ name: 'Guide', path: '/guide' }, { name: meta.shortTitle, path: base.hiPath }]),
    ],
  };
}

function helpHubEn(DATA) {
  const tasks = DATA.help || [];
  if (!tasks.length || !DATA.helpEn) return undefined;
  const byCat = new Map();
  for (const t of tasks) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category).push(t);
  }
  let out = '';
  for (const [cat, items] of byCat) {
    out += `<h2>${esc(DATA.helpEn.helpCategoryLabel(cat, 'en'))}</h2><ul>` +
      items.map((t) => `<li><a href="/help/${t.slug}">${esc(DATA.helpEn.localizeHelpTask(t, 'en').title)}</a></li>`).join('') + `</ul>`;
  }
  return shell({ lang: 'en', current: 'Help Center',
    html: `<h1>Help Center — How to do it</h1><p>A short, direct step-by-step for every task — and from every article, a link to do the same task right in SahakarLekha.</p>` + out + registerCtaEn() });
}

function helpTaskEn(base, t, DATA) {
  const url = SITE + base.path;
  const date = t.updated || LASTMOD.help;
  const cookbookSlugs = (DATA.rel && DATA.rel.HELP_COOKBOOK && DATA.rel.HELP_COOKBOOK[t.slug]) || [];
  const guideTitle = t.guideSlug ? enEntryTitle(DATA, t.guideSlug) : null;
  const body = shell({
    lang: 'en',
    crumbs: [['/help', 'Help Center']],
    current: t.title,
    html:
      `<h1>${esc(t.title)}</h1>` +
      `<p><small>${esc(t.category)} · ${esc(t.estTime || '')}</small></p>` +
      (t.tldr ? `<blockquote><strong>In short:</strong> ${esc(t.tldr)}</blockquote>` : '') +
      (t.prerequisites && t.prerequisites.length
        ? `<h2>Before you start</h2><ul>${t.prerequisites.map((p) => `<li>${esc(p.label)}</li>`).join('')}</ul>` : '') +
      (t.steps && t.steps.length ? `<h2>Steps</h2><ol>${t.steps.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ol>` : '') +
      (t.commonMistakes && t.commonMistakes.length
        ? `<h2>Common mistakes</h2><ul>${t.commonMistakes.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ul>` : '') +
      (t.troubleshooting && t.troubleshooting.length
        ? `<h2>If something goes wrong</h2><ul>${t.troubleshooting.map((x) => `<li><strong>${mdInline(x.problem)}</strong> — ${mdInline(x.fix)}</li>`).join('')}</ul>` : '') +
      (t.faqs && t.faqs.length
        ? `<h2>Frequently asked questions</h2>` + t.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      (t.guideSlug ? `<p>Understand it in depth: <a href="/guide/${t.guideSlug}">${esc(guideTitle || 'Guide chapter')}</a></p>` : '') +
      surfaceLinksHtml({ cookbook: cookbookSlugs }, DATA, 'Related entries (Cookbook)', 'en') +
      (t.related && t.related.length
        ? `<p>Related tasks: ${t.related.map((r) => `<a href="/help/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (t.updated ? `<p><small>Last updated: ${esc(t.updated)}</small></p>` : '') +
      registerCtaEn(t.deepLink && t.deepLink.route),
  });
  return {
    ...base,
    title: t.metaTitle,
    description: t.metaDescription,
    body,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: t.metaTitle, description: t.metaDescription, inLanguage: 'en', url, image: `${SITE}/og-image.png`, datePublished: date, dateModified: date, author: ORG, publisher: PUBLISHER },
      enCrumb([{ name: 'Help Center', path: '/help' }, { name: t.metaTitle, path: base.hiPath }]),
      ...(Array.isArray(t.faqs) && t.faqs.length
        ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en',
            mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
        : []),
    ],
  };
}

function cookbookHubEn(DATA) {
  const entries = DATA.cookbook || [];
  if (!entries.length || !DATA.cookbookEn) return undefined;
  const byCat = new Map();
  for (const e of entries) {
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category).push(e);
  }
  let out = '';
  for (const [cat, items] of byCat) {
    out += `<h2>${esc(DATA.cookbookEn.cookbookCategoryLabel(cat, 'en'))}</h2><ul>` +
      items.map((e) => `<li><a href="/cookbook/${e.slug}">${esc(DATA.cookbookEn.localizeCookbookEntry(e, 'en').title)}</a></li>`).join('') + `</ul>`;
  }
  return shell({ lang: 'en', current: 'Entry Cookbook',
    html: `<h1>Entry Cookbook</h1><p>"Which entry records this transaction?" — the plain Dr/Cr for every common situation, with an example and the points to watch.</p>` + out + registerCtaEn() });
}

function cookbookEntryEn(base, e, DATA) {
  const url = SITE + base.path;
  const date = e.updated || LASTMOD.cookbook;
  const helpSlugs = (DATA.rel && DATA.rel.helpForCookbook) ? DATA.rel.helpForCookbook(e.slug) : [];
  const guideTitle = e.guideSlug ? enEntryTitle(DATA, e.guideSlug) : null;
  const money = (n) => (n != null ? '₹' + n.toLocaleString('en-IN') : '');
  const body = shell({
    lang: 'en',
    crumbs: [['/cookbook', 'Entry Cookbook']],
    current: e.title,
    html:
      `<h1>${esc(e.title)}</h1>` +
      `<p><small>${esc(e.category)}</small></p>` +
      (e.scenario ? `<p><strong>When:</strong> ${esc(e.scenario)}</p>` : '') +
      (e.lines && e.lines.length
        ? `<h2>Entry (Journal)</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>Account</th><th>Dr/Cr</th><th>Note</th></tr></thead><tbody>` +
          e.lines.map((l) => `<tr><td>${esc(l.account)}</td><td>${esc(l.type)}</td><td>${esc(l.note || '')}</td></tr>`).join('') +
          `</tbody></table>`
        : '') +
      (e.narration ? `<p><strong>Narration:</strong> ${esc(e.narration)}</p>` : '') +
      (e.example
        ? `<h2>Example (in ₹)</h2><p>${esc(e.example.text)}</p><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>Account</th><th>Dr</th><th>Cr</th></tr></thead><tbody>` +
          e.example.rows.map((r) => `<tr><td>${esc(r.account)}</td><td>${money(r.dr)}</td><td>${money(r.cr)}</td></tr>`).join('') +
          `</tbody></table>`
        : '') +
      (e.useWhen ? `<p><strong>When to use:</strong> ${esc(e.useWhen)}</p>` : '') +
      (e.avoidWhen ? `<p><strong>When not to:</strong> ${esc(e.avoidWhen)}</p>` : '') +
      (e.inApp ? `<h2>How to do it in the app</h2><p>${esc(e.inApp)}</p>` : '') +
      (e.correction ? `<h2>Made a mistake? — the correction</h2><p>${esc(e.correction)}</p>` : '') +
      (e.notes && e.notes.length ? `<h2>Keep in mind</h2><ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
      (e.guideSlug ? `<p>Understand it in depth: <a href="/guide/${e.guideSlug}">${esc(guideTitle || 'Guide chapter')}</a></p>` : '') +
      surfaceLinksHtml({ help: helpSlugs }, DATA, 'Step-by-step (Help Center)', 'en') +
      (e.related && e.related.length
        ? `<p>Similar entries: ${e.related.map((r) => `<a href="/cookbook/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (e.updated ? `<p><small>Last updated: ${esc(e.updated)}</small></p>` : '') +
      registerCtaEn(e.deepLink && e.deepLink.route),
  });
  return {
    ...base,
    title: e.metaTitle,
    description: e.metaDescription,
    body,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: e.metaTitle, description: e.metaDescription, inLanguage: 'en', url, image: `${SITE}/og-image.png`, datePublished: date, dateModified: date, author: ORG, publisher: PUBLISHER },
      enCrumb([{ name: 'Entry Cookbook', path: '/cookbook' }, { name: e.metaTitle, path: base.hiPath }]),
    ],
  };
}

function toolsHubEn(DATA) {
  const calcs = DATA.calc || [];
  if (!calcs.length || !DATA.calcEn) return undefined;
  return shell({ lang: 'en', current: 'Calculators',
    html: `<h1>Cooperative Accounting Calculators</h1><p>Interest, EMI, depreciation, GST, TDS and more — free, instant, with formulas and explanations.</p><ul>` +
      calcs.map((c) => {
        const l = DATA.calcEn.localizeCalculator(c, 'en');
        return `<li><a href="/tools/${c.slug}">${esc(c.englishName)}</a>${l.translated && l.intro ? ` — ${esc(l.intro)}` : ''}</li>`;
      }).join('') + `</ul>` + registerCtaEn() });
}

function calculatorEn(base, c, DATA) {
  const url = SITE + base.path;
  const cookbookSlugs = (DATA.rel && DATA.rel.CALC_COOKBOOK && DATA.rel.CALC_COOKBOOK[c.slug]) || [];
  const liveArticles = (c.relatedArticles || []).filter((a) => blogIsLive(DATA, a.slug));
  const body = shell({
    lang: 'en',
    crumbs: [['/tools', 'Calculators']],
    current: c.englishName,
    html:
      `<h1>${esc(c.englishName)}</h1>` +
      (c.intro ? `<p>${esc(c.intro)}</p>` : '') +
      `<p><em>The interactive calculator starts as soon as the page loads — read the formula and example below.</em></p>` +
      (c.formula ? `<h2>Formula</h2>${md(c.formula)}` : '') +
      (c.explanation ? `<h2>Explanation</h2>${md(c.explanation)}` : '') +
      (c.example ? `<h2>Example</h2>${md(c.example)}` : '') +
      (c.mistakes ? `<h2>Common mistakes</h2>${md(c.mistakes)}` : '') +
      (c.faqs && c.faqs.length
        ? `<h2>Frequently asked questions</h2>` + c.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      surfaceLinksHtml({ cookbook: cookbookSlugs }, DATA, 'How to record the entry (Cookbook)', 'en') +
      (c.relatedGlossary && c.relatedGlossary.length
        ? `<p>Related terms (Glossary): ${c.relatedGlossary.map((g) => `<a href="/glossary/${g}">${g.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (liveArticles.length ? `<p>Read in depth: ${liveArticles.map((a) => `<a href="/blog/${a.slug}">${esc(a.title)}</a>`).join(' · ')}</p>` : '') +
      (c.relatedGuide && c.relatedGuide.length
        ? `<p>Learn in the guide: ${c.relatedGuide.map((g) => `<a href="/guide/${g.slug}">${esc(g.title)}</a>`).join(' · ')}</p>` : '') +
      (c.relatedHelp && c.relatedHelp.length
        ? `<p>How to do it in the app: ${c.relatedHelp.map((h) => `<a href="/help/${h.slug}">${esc(h.title)}</a>`).join(' · ')}</p>` : '') +
      (c.related && c.related.length
        ? `<p>More calculators: ${c.related.map((r) => `<a href="/tools/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (c.updated ? `<p><small>Last updated: ${esc(c.updated)}</small></p>` : '') +
      registerCtaEn(),
  });
  return {
    ...base,
    title: c.metaTitle,
    description: c.metaDescription,
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: c.metaTitle, description: c.metaDescription,
        inLanguage: 'en', url, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
        isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, publisher: ORG,
      },
      enCrumb([{ name: 'Calculators', path: '/tools' }, { name: c.metaTitle, path: base.hiPath }]),
      ...(Array.isArray(c.inputs)
        ? [{
            '@context': 'https://schema.org', '@type': 'HowTo', name: `How to use the ${c.englishName}`, inLanguage: 'en',
            step: [
              ...c.inputs.map((inp, i) => ({ '@type': 'HowToStep', position: i + 1, name: `Enter ${inp.label}`, text: `${inp.label}${inp.sub ? ' — ' + inp.sub : ''}.` })),
              { '@type': 'HowToStep', position: c.inputs.length + 1, name: 'See the result', text: 'The result appears instantly — no button to press.' },
            ],
          }]
        : []),
      ...(Array.isArray(c.faqs) && c.faqs.length
        ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en',
            mainEntity: c.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
        : []),
    ],
  };
}

/* ---- batch E2: blog, author, editorial policy, glossary twins ---- */

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** ISO date → "30 June 2026" (same as BlogCards' blogDate in English). */
const enDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? `${d} ${EN_MONTHS[m - 1]} ${y}` : String(iso || '');
};

/** English blog meta of a slug (BLOG_EN_META) only when its English body exists too — same rule as hasEnglishPost. */
function blogEn(DATA, slug) {
  const m = DATA.blogEn && DATA.blogEn[slug];
  return m && existsSync(resolve(BLOG_EN_DIR, `${slug}.md`)) ? m : null;
}
/** English label of a (Hindi) category name, via its slug (categoriesEn) — same as categoryLabel(name, 'en'). */
function blogCatEn(DATA, name) {
  const c = (DATA.blogCats || []).find((x) => x.name === name);
  const e = c && DATA.blogCatsEn && DATA.blogCatsEn[c.slug];
  return e ? { slug: c.slug, ...e } : null;
}

/** "## Frequently asked questions" of an English post → Q/A pairs (same line shape as blogFaqs / BlogPost's parseFaqs). */
function blogFaqsEn(raw) {
  const m = raw.match(/##\s+(Frequently asked questions|FAQ)[^\n]*\r?\n/);
  if (!m || m.index == null) return [];
  const after = m.index + m[0].length;
  const rel = raw.slice(after).search(/\n##\s/);
  const inner = rel === -1 ? raw.slice(after) : raw.slice(after, after + rel);
  const faqs = [];
  inner.split('\n').forEach((line) => {
    const mm = line.trim().match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (mm) faqs.push({ q: mm[1].replace(/\*/g, '').trim(), a: mm[2].trim() });
  });
  return faqs;
}

function blogIndexEn(base, hp, DATA) {
  const M = DATA.pageMetaEn && DATA.pageMetaEn.blog;
  if (!M) return { skip: 'pageMetaEn.blog missing' };
  const { groups = [], others = [] } = hp._blogIndex || {};
  const all = [...groups.flatMap((g) => g.posts), ...others];
  const missing = all.filter((p) => !blogEn(DATA, p.slug));
  if (missing.length) return { skip: `untranslated posts on the index: ${missing.map((p) => p.slug).join(', ')}` };
  const li = (p) => `<li><a href="/blog/${p.slug}">${esc(blogEn(DATA, p.slug).title)}</a> <small>(${p.date})</small></li>`;
  const label = (c) => (DATA.blogCatsEn && DATA.blogCatsEn[c.slug]) || null;
  if (groups.some((g) => !label(g.c))) return { skip: 'a category has no English text in categoriesEn' };
  return { page: { ...base, title: M.title, description: M.description,
    jsonLd: [enCrumb([{ name: 'Blog', path: '/blog' }])],
    body: all.length
      ? shell({ lang: 'en', current: 'Blog',
          html:
            `<h1>SahakarLekha Blog</h1><p>Simple articles for cooperative societies on digital accounting, voucher entry, audit and compliance.</p>` +
            (groups.length
              ? `<nav aria-label="Article categories"><p><strong>Categories:</strong> ` +
                groups.map((g) => `<a href="/blog/category/${g.c.slug}">${esc(label(g.c).name)}</a> (${g.posts.length})`).join(' · ') + `</p></nav>`
              : '') +
            groups.map((g) =>
              `<section><h2><a href="/blog/category/${g.c.slug}">${esc(label(g.c).name)}</a></h2><p>${esc(label(g.c).intro)}</p>` +
              `<ul>${g.posts.map(li).join('')}</ul></section>`).join('') +
            (others.length ? `<section><h2>Other articles</h2><ul>${others.map(li).join('')}</ul></section>` : '') +
            registerCtaEn() })
      : undefined } };
}

function blogCategoryEn(base, hp, DATA) {
  const { c, posts = [] } = hp._cat || {};
  const e = c && DATA.blogCatsEn && DATA.blogCatsEn[c.slug];
  if (!e) return { skip: 'no English text in categoriesEn' };
  const missing = posts.filter((p) => !blogEn(DATA, p.slug));
  if (missing.length) return { skip: `untranslated posts in the category: ${missing.map((p) => p.slug).join(', ')}` };
  const url = SITE + base.path;
  const li = (p) => `<li><a href="/blog/${p.slug}">${esc(blogEn(DATA, p.slug).title)}</a> <small>(${p.date})</small></li>`;
  return { page: { ...base, title: e.metaTitle, description: e.description,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: e.name,
        description: e.description,
        url,
        inLanguage: 'en',
        isPartOf: { '@type': 'Blog', name: 'SahakarLekha Blog', url: `${SITE}/en/blog` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/en/blog/${p.slug}`, name: blogEn(DATA, p.slug).title })),
        },
      },
      enCrumb([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: e.name, path: base.hiPath }]),
    ],
    body: shell({ lang: 'en', crumbs: [['/blog', 'Blog']], current: e.name,
      html:
        `<h1>${esc(e.name)}</h1><p>${esc(e.intro)}</p><p><small>${posts.length} ${posts.length === 1 ? 'article' : 'articles'}</small></p>` +
        `<ul>${posts.map(li).join('')}</ul>` +
        `<p><a href="/blog">All categories and articles</a></p>` + registerCtaEn() }) } };
}

function blogPostEn(base, hp, DATA) {
  const p = hp._post;
  const m = p && blogEn(DATA, p.slug);
  if (!m) return { skip: 'no English body/meta in blog/en' };
  const url = SITE + base.path;
  const raw = readFileSync(resolve(BLOG_EN_DIR, `${p.slug}.md`), 'utf-8');
  const faqs = blogFaqsEn(raw);
  const cat = blogCatEn(DATA, p.category);
  const hub = cat ? `/blog/category/${cat.slug}` : null;
  // trust note — same rule as the Hindi copy / BlogPost's TrustNote, English words (TRUST_NOTE_EN)
  let trust = '';
  const P = DATA.policy;
  if (P && P.TRUST_NOTE_EN) {
    const T = P.TRUST_NOTE_EN;
    const sensitive = P.TRUST_NOTE_CATEGORIES.includes(p.category);
    if (p.jurisdiction || p.reviewed || sensitive) {
      let h = '';
      if (p.jurisdiction === 'haryana') h += `<p><strong>${esc(T.haryanaBadge)}</strong> ${esc(T.haryana)}</p>`;
      if (p.reviewed) h += `<p><strong>${esc(T.reviewedLabel)}: ${esc(enDate(p.reviewed))}</strong>. ${esc(T.reviewed)}</p>`;
      else if (sensitive) h += `<p>${esc(T.notReviewed)}</p>`;
      h += `<p><a href="${P.EDITORIAL_POLICY_PATH}">${esc(T.policyLink)}</a></p>`;
      trust = `<aside class="sl-trust" aria-label="About this information">${h}</aside>`;
    }
  }
  const helpSlugs = (DATA.rel && DATA.rel.BLOG_HELP && DATA.rel.BLOG_HELP[p.slug]) || [];
  const body = shell({ lang: 'en', crumbs: [['/blog', 'Blog'], ...(hub ? [[hub, cat.name]] : [])], current: m.title,
    html: `<h1>${esc(m.title)}</h1>` + trust + md(raw.replace(/^﻿?\s*#\s+.*(\r?\n)+/, '')) +
      surfaceLinksHtml({ help: helpSlugs }, DATA, 'Do it now (Help Center)', 'en') + registerCtaEn() });
  return { page: { ...base, title: m.metaTitle, description: m.metaDescription,
    image: p.image ? `${SITE}${p.image}` : undefined,
    article: { publishedTime: p.date, modifiedTime: p.updated || p.date, section: cat ? cat.name : p.category },
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: m.title,
        description: m.metaDescription,
        inLanguage: 'en',
        url,
        mainEntityOfPage: url,
        datePublished: p.date,
        dateModified: p.updated || p.date,
        ...(p.jurisdiction === 'haryana' ? { spatialCoverage: { '@type': 'Place', name: 'Haryana, India' } } : {}),
        image: p.image ? `${SITE}${p.image}` : `${SITE}/og-image.png`,
        author: BLOG_AUTHOR,
        publisher: PUBLISHER,
      },
      enCrumb([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        ...(hub ? [{ name: cat.name, path: hub }] : []),
        { name: m.title, path: base.hiPath },
      ]),
      ...(faqs.length ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'en',
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
      }] : []),
    ] } };
}

/** English stub of a scheduled (drip) post: noindex, no hreflang, no sitemap — like its Hindi stub, until its date. */
function blogScheduledEn(hp) {
  const s = hp._scheduled;
  return {
    path: DATA_EN_ROUTES.toEn(hp.path),
    hiPath: hp.path,
    lang: 'en',
    noindex: true,
    title: 'Coming soon | SahakarLekha Blog',
    description: `This article will be published on ${enDate(s.date)}. Until then, read the other articles on the SahakarLekha blog.`,
    body: shell({ lang: 'en', crumbs: [['/blog', 'Blog']], current: 'Coming soon',
      html: `<h1>This article is coming soon</h1><p>This article will be published on ${esc(enDate(s.date))}. Until then, read the <a href="/blog">other articles on the blog</a>.</p>` }),
  };
}

function authorEn(base, hp, DATA) {
  const { a, posts = [] } = hp._author || {};
  if (!a || !a.taglineEn) return { skip: 'no English tagline in authors.ts' };
  // posts only — the Hindi list also picks up the /blog/category/<slug> hubs (they share the /blog/ prefix); the React page lists posts
  const list = posts.filter((p) => !p.path.startsWith('/blog/category/')).map((p) => ({ ...p, en: blogEn(DATA, p.path.slice('/blog/'.length)) }));
  if (list.some((p) => !p.en)) return { skip: 'untranslated posts on the author page' };
  const url = SITE + base.path;
  const pair = (t) => { const parts = String(t).split(' / '); return parts.length === 2 ? parts[1] : t; };
  return { page: { ...base,
    title: `${a.name} — ${a.designation} | SahakarLekha`,
    description: a.taglineEn,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      inLanguage: 'en',
      url,
      mainEntity: {
        '@type': 'Person',
        name: a.name,
        jobTitle: a.designation,
        description: a.taglineEn,
        url: `${SITE}/author/${a.slug}`,
        ...(a.photo ? { image: `${SITE}${a.photo}` } : {}),
        worksFor: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        alumniOf: a.alumniOf.map((n) => ({ '@type': 'Organization', name: n })),
        knowsAbout: a.knowsAboutEn || a.knowsAbout,
        ...(a.socials && a.socials.length ? { sameAs: a.socials.map((s) => s.href) } : {}),
      },
    }],
    body: shell({ lang: 'en', crumbs: [['/blog', 'Blog']], current: a.name,
      html:
        `<h1>${esc(a.name)}</h1><p><strong>${esc(a.designation)} · SahakarLekha</strong></p><p>${esc(a.taglineEn)}</p>` +
        `<h2>Qualifications</h2><ul>${a.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` +
        `<h2>Experience</h2><ul>${a.experience.map((e) => `<li>${esc(e.years)} years — ${esc(pair(e.field))}</li>`).join('')}</ul>` +
        (list.length ? `<h2>Articles (${list.length})</h2><ul>${list.map((p) => `<li><a href="${p.path}">${esc(p.en.title)}</a></li>`).join('')}</ul>` : '') }) } };
}

function editorialPolicyEn(base, DATA) {
  const P = DATA.policy;
  const E = P && P.EDITORIAL_POLICY_EN;
  if (!E) return { skip: 'no EDITORIAL_POLICY_EN in content/editorialPolicy.ts' };
  return { page: { ...base, title: E.title, description: E.description,
    jsonLd: [enCrumb([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: E.h1, path: P.EDITORIAL_POLICY_PATH }])],
    body: shell({ lang: 'en', crumbs: [['/blog', 'Blog']], current: E.h1,
      html:
        `<h1>${esc(E.h1)}</h1><p>${esc(E.intro)}</p>` +
        E.sections.map((s) => `<h2>${esc(s.heading)}</h2>` + s.paras.map((t) => `<p>${esc(t)}</p>`).join('')).join('') +
        `<p><a href="/contact">Report a mistake: contact page</a> · <a href="/author/sitaram">Author profile</a> · <a href="/blog">All articles</a></p>` }) } };
}

/** "English (हिंदी)" name of a glossary term — the English page leads with the English name (as GlossaryTerm does). */
const glossaryNameEn = (t) => (t.hindi ? `${t.en} (${t.hindi})` : t.en);

function glossaryHubEn(base, hp, DATA) {
  const M = DATA.pageMetaEn && DATA.pageMetaEn.glossary;
  if (!M) return { skip: 'pageMetaEn.glossary missing' };
  const terms = hp._terms || [];
  return { page: { ...base, title: M.title, description: M.description,
    jsonLd: [enCrumb([{ name: 'Glossary', path: '/glossary' }])],
    body: shell({ lang: 'en', current: 'Glossary',
      html:
        `<h1>Cooperative Accounting Glossary</h1><p>Every term in plain English and Hindi — ${terms.length} terms:</p><ul>` +
        [...terms].sort((a, b) => a.en.localeCompare(b.en))
          .map((t) => `<li><a href="/glossary/${t.slug}">${esc(glossaryNameEn(t))}</a></li>`).join('') +
        `</ul>` + registerCtaEn() }) } };
}

function glossaryTermEn(base, hp, DATA) {
  const { t, related = [], internalLinks = [] } = hp._term || {};
  if (!t) return { skip: 'no glossary term data' };
  const s = t.sections;
  const def = kiPlain(s['definition']);
  if (!def && !s['english explanation']) return { skip: 'KI has no English definition/explanation' };
  const url = SITE + base.path;
  const name = glossaryNameEn(t);
  const pb = DATA.rel && DATA.rel.GLOSSARY_BLOG && DATA.rel.GLOSSARY_BLOG[t.slug];
  const pbEn = pb && blogIsLive(DATA, pb.slug) ? (blogEn(DATA, pb.slug) || null) : null;
  return { page: { ...base,
    title: DATA.seo && DATA.seo.glossaryTitleEn ? DATA.seo.glossaryTitleEn(name) : `${name} — Cooperative Accounting Glossary | SahakarLekha`,
    description: DATA.hub && DATA.hub.glossaryMetaDescriptionEn
      ? DATA.hub.glossaryMetaDescriptionEn({ definition: s['definition'], english: s['english explanation'] })
      : (def || kiPlain(s['english explanation'])).slice(0, 158),
    body: shell({ lang: 'en', crumbs: [['/glossary', 'Glossary']], current: t.en,
      html:
        `<h1>${esc(t.en)}</h1>` + (t.hindi ? `<p lang="hi"><em>${esc(t.hindi)}</em></p>` : '') +
        (def ? `<p><strong>Definition:</strong> ${esc(def)}</p>` : '') +
        (s['plain-language explanation'] ? `<h2>In plain words</h2><p>${esc(kiPlain(s['plain-language explanation']))}</p>` : '') +
        (s['english explanation'] ? `<h2>In English</h2><p>${esc(kiPlain(s['english explanation']))}</p>` : '') +
        (s['hindi explanation'] ? `<h2>In Hindi</h2><p lang="hi">${esc(kiPlain(s['hindi explanation']))}</p>` : '') +
        (s['why it matters'] ? `<h2>Why it matters</h2><p>${esc(kiPlain(s['why it matters']))}</p>` : '') +
        (s['common misconceptions'] ? `<h2>Common misconceptions</h2>${md(s['common misconceptions'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
        (s['learning objectives'] ? `<h2>What you will learn from this term</h2>${md(s['learning objectives'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
        (related.length ? `<h2>Related topics</h2><p>${related.join(' · ')}</p>` : '') +
        (pbEn ? `<p>Read the full article: <a href="/blog/${pb.slug}">${esc(pbEn.title)}</a></p>` : '') +
        (internalLinks.length ? `<p>Read more: ${internalLinks.map((l) => `<a href="${l}">${l}</a>`).join(' · ')}</p>` : '') +
        registerCtaEn() }),
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'DefinedTerm', name, description: def || kiPlain(s['english explanation']),
        inLanguage: 'en', url, termCode: t.id,
        inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'SahakarLekha Glossary', url: `${SITE}/en/glossary` },
      },
      enCrumb([{ name: 'Glossary', path: '/glossary' }, { name: t.en, path: base.hiPath }]),
    ] } };
}

/**
 * Pair every eligible Hindi page with its English twin. Mutates the Hindi pages (adds `hreflang`) and returns
 * { pages: English twins, skipped: [{ path, reason }], metaOnly: [path] }.
 */
function englishPages(hindiPages, DATA) {
  const R = DATA.enRoutes;
  if (!R || !R.hasEnglishRoute || !R.toEn || !R.hreflangAlternates) {
    console.warn('[prerender] enRoutes not loaded — no English twins written.');
    return { pages: [], skipped: [], metaOnly: [] };
  }
  DATA_EN_ROUTES = R;
  const out = [], skipped = [], metaOnly = [];
  for (const hp of hindiPages) {
    // A scheduled (drip) post's noindex stub gets an English noindex stub too — never a real page or hreflang before
    // its date (the daily rebuild swaps both for the real articles on publish day).
    if (hp && hp._scheduled && hp.path && R.hasEnglishRoute(hp.path)) { out.push(blogScheduledEn(hp)); continue; }
    if (!hp || !hp.path || hp.noindex || hp.lang === 'en' || !R.hasEnglishRoute(hp.path)) continue;
    let res;
    try { res = englishTwin(hp, DATA); } catch (e) { res = { skip: `builder error: ${e && e.message}` }; }
    if (!res || !res.page) { skipped.push({ path: hp.path, reason: (res && res.skip) || 'unknown' }); continue; }
    const alts = R.hreflangAlternates(hp.path, SITE);
    if (!alts) { skipped.push({ path: hp.path, reason: 'hreflangAlternates returned null' }); continue; }
    hp.hreflang = alts;
    res.page.hreflang = alts;
    if (!res.page.body && !res.page.noindex) metaOnly.push(hp.path);
    out.push(res.page);
  }
  return { pages: out, skipped, metaOnly };
}

/** On an English page: every internal link whose target has a written English twin goes to that twin. */
function localizeEnLinks(body, twinOf) {
  return body.replace(/href="(\/[^"]*)"/g, (m0, href) => {
    const i = href.search(/[?#]/);
    const p = i < 0 ? href : href.slice(0, i);
    const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
    const en = twinOf.get(clean);
    return en ? `href="${en}${i < 0 ? '' : href.slice(i)}"` : m0;
  });
}

/* ---------------- blog RSS 2.0 feed (lightweight — latest 30 live posts) ---------------- */
// Re-parses the blog registry (same proven per-post regex as blogPages / the sitemap)
// and emits a minimal RSS 2.0 feed to dist/rss.xml. No dependencies, no bodies —
// just title, link, guid, pubDate and the meta description per post.
function buildBlogRss() {
  if (!existsSync(BLOG_FILE)) return null;
  const src = readFileSync(BLOG_FILE, 'utf-8');
  const today = istToday();
  const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?date:\s*'([^']+)'(?:,\s*\r?\n\s*updated:\s*'([^']+)')?/g;
  const posts = [];
  let m;
  while ((m = re.exec(src))) {
    const [, slug, title, description, date, updated] = m;
    if (date > today) continue; // scheduled (future-dated) post — not published yet
    posts.push({ slug, title, description, date, updated });
  }
  if (!posts.length) return null;
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  const rfc822 = (d) => new Date(`${d}T00:00:00Z`).toUTCString();
  const cleanTitle = (t) => t.replace(/\s*\|\s*SahakarLekha\s*$/, ''); // drop the SEO suffix in feed titles
  const lastBuild = rfc822(maxDate(posts.map((p) => p.updated || p.date), today));
  const items = posts.slice(0, 30).map((p) => {
    const url = `${SITE}/blog/${p.slug}`;
    return `  <item>\n` +
      `    <title>${esc(cleanTitle(p.title))}</title>\n` +
      `    <link>${url}</link>\n` +
      `    <guid isPermaLink="true">${url}</guid>\n` +
      `    <pubDate>${rfc822(p.date)}</pubDate>\n` +
      `    <description>${esc(p.description)}</description>\n` +
      `  </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `<channel>\n` +
    `  <title>सहकार लेखा ब्लॉग — SahakarLekha Blog</title>\n` +
    `  <link>${SITE}/blog</link>\n` +
    `  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    `  <description>सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट, अनुपालन व प्रबंधन पर सरल हिन्दी लेख।</description>\n` +
    `  <language>hi</language>\n` +
    `  <lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    items.join('\n') + `\n` +
    `</channel>\n</rss>\n`;
}

/* ---------------- sitemap index + per-family child sitemaps (GOS-02) ---------------- */

function familyOf(path) {
  if (path === '/blog' || path.startsWith('/blog/')) return 'blog';
  if (path === '/guide' || path.startsWith('/guide/')) return 'guide';
  if (path === '/glossary' || path.startsWith('/glossary/')) return 'glossary';
  if (path === '/tools' || path.startsWith('/tools/')) return 'tools';
  if (path === '/help' || path.startsWith('/help/')) return 'help';
  if (path === '/cookbook' || path.startsWith('/cookbook/')) return 'cookbook';
  if (path === '/software' || path.startsWith('/software/') || path.startsWith('/cooperative-software/')) return 'software';
  return 'pages';
}

function rank(path) {
  if (path === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (path === '/blog' || path === '/guide') return { changefreq: 'weekly', priority: '0.9' };
  if (path === '/software' || path === '/glossary' || path === '/tools') return { changefreq: 'weekly', priority: '0.8' };
  if (path === '/register') return { changefreq: 'monthly', priority: '0.9' };
  if (path === '/login') return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/tools/')) return { changefreq: 'monthly', priority: '0.7' };
  if (path.startsWith('/blog/')) return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/software/') || path.startsWith('/cooperative-software/')) return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/glossary/')) return { changefreq: 'monthly', priority: '0.6' };
  if (path.startsWith('/guide/quiz/')) return { changefreq: 'monthly', priority: '0.4' };
  if (path.startsWith('/guide/')) return { changefreq: 'monthly', priority: '0.7' };
  if (path === '/privacy' || path === '/terms') return { changefreq: 'yearly', priority: '0.3' };
  return { changefreq: 'monthly', priority: '0.6' };
}

function buildSitemaps(dynamicPages, blogMax) {
  // L2: the sitemap lists ONLY pages this script wrote a file for (`dynamicPages`). A hand list of
  // "static" routes used to add /login, /register, /privacy, /terms, the quizzes … with no file behind
  // them — each served the homepage template (canonical "/"). /login and /register stay out: they are
  // app entry points whose canonical is the homepage.
  const PAGE_LASTMOD = { '/': blogMax, '/privacy': '2026-10-02', '/guide/quick-start': LASTMOD.guide,
    '/guide/certificate': LASTMOD.guide, '/guide/verify': LASTMOD.guide };
  // noindex stubs (scheduled drip posts) have a file but must never be sitemapped
  // An English twin (/en/…) sits in its Hindi twin's family with the Hindi twin's (honest) lastmod and rank.
  const all = dynamicPages.filter((p) => p && p.path && !p.noindex).map((p) => {
    const key = p.hiPath || p.path;
    return {
      path: p.path,
      key,
      hreflang: p.hreflang || null,
      lastmod: notFuture(PAGE_LASTMOD[key] || (key.startsWith('/guide/quiz/') ? LASTMOD.guide : p.lastmod) || LASTMOD.static),
    };
  });
  const seen = new Set();
  const urls = all.filter((u) => (seen.has(u.path) ? false : (seen.add(u.path), true)));

  // group by family
  const groups = new Map();
  for (const u of urls) {
    const fam = familyOf(u.key);
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam).push(u);
  }

  const files = new Map();
  const indexEntries = [];
  for (const [fam, items] of groups) {
    const name = `sitemap-${fam}.xml`;
    const body = items.map((u) => {
      const r = rank(u.key);
      // hreflang alternates (both twins list the same three; x-default = Hindi)
      const alt = u.hreflang
        ? [['hi-IN', u.hreflang.hi], ['en-IN', u.hreflang.en], ['x-default', u.hreflang.xDefault]]
            .map(([l, href]) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${href}" />`).join('')
        : '';
      return `  <url>\n    <loc>${SITE}${u.path}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>${alt}\n  </url>`;
    }).join('\n');
    // xmlns:xhtml only where a file carries alternates — a Hindi-only family (blog) stays byte-identical.
    const ns = items.some((u) => u.hreflang) ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : '';
    files.set(name, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${body}\n</urlset>\n`);
    indexEntries.push({ name, lastmod: maxDate(items.map((i) => i.lastmod), LASTMOD.static), count: items.length });
  }

  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    indexEntries.map((e) => `  <sitemap>\n    <loc>${SITE}/${e.name}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </sitemap>`).join('\n') +
    `\n</sitemapindex>\n`;
  files.set('sitemap.xml', index);
  return { files, total: urls.length, perFamily: indexEntries };
}

/* ---------------- head + body transform ---------------- */

function transform(template, page0) {
  const page = { ...page0, title: fitTitle(page0.title) };   // same rule as useDocumentMeta
  const url = SITE + (page.path || '/blog');
  let html = template;

  // Subpages: drop the homepage-only template schemas (SoftwareApplication + the
  // 5-question FAQPage) so each page carries ONLY its own JSON-LD + Organization.
  // The homepage itself (path '/') KEEPS them — they belong there.
  // The English home (/en) keeps them too: the template's SoftwareApplication/FAQPage text is English.
  if (page.path !== '/' && page.path !== '/en') {
    html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (m0, body) =>
      /"@type":\s*"(SoftwareApplication|FAQPage)"/.test(body) ? '' : m0);
  }

  const sub = (re, value) => { if (re.test(html)) html = html.replace(re, value); };
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  sub(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`);
  sub(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  sub(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  sub(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`);
  sub(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`);
  if (page.image) {
    sub(/<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${page.image}" />`);
    sub(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${page.image}" />`);
  }
  sub(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  sub(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  if (page.noindex) sub(/<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex, follow" />`);
  if (page.article) {
    const a = page.article;
    const tags = [
      `<meta property="article:published_time" content="${esc(a.publishedTime)}" />`,
      a.modifiedTime ? `<meta property="article:modified_time" content="${esc(a.modifiedTime)}" />` : '',
      a.section ? `<meta property="article:section" content="${esc(a.section)}" />` : '',
    ].filter(Boolean).join('\n    ');
    sub(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article" />\n    ${tags}`);
  }
  if (page.jsonLd && page.jsonLd.length) {
    // Escape "<" so a value containing "</script>" can never break out of the tag (safe JSON-in-HTML).
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    // data-prerendered-jsonld: useDocumentMeta removes this copy when the page mounts and injects its
    // own — otherwise a JS-rendering crawler saw every BlogPosting/FAQPage twice.
    const ld = `<script type="application/ld+json" data-prerendered-jsonld>${json}</script>\n  </head>`;
    html = html.replace('</head>', ld);
  }
  // Batch E1 — English twin: the document language and og:locale follow the URL (index.html ships hi-IN / hi_IN).
  if (page.lang === 'en') {
    sub(/<html lang="[^"]*">/, '<html lang="en-IN">');
    sub(/<meta property="og:locale" content="[^"]*" \/>/, '<meta property="og:locale" content="en_IN" />');
    sub(/<meta property="og:locale:alternate" content="[^"]*" \/>/, '<meta property="og:locale:alternate" content="hi_IN" />');
  }
  // Both twins of a pair name each other (Hindi = x-default), right before </head>. useDocumentMeta removes every
  // link[rel=alternate][hreflang] on mount and adds its own, so the live page never shows two sets.
  if (page.hreflang) {
    const h = page.hreflang;
    const links = [['hi-IN', h.hi], ['en-IN', h.en], ['x-default', h.xDefault]]
      .map(([l, href]) => `<link rel="alternate" hreflang="${l}" href="${href}" data-prerendered-hreflang />`).join('\n    ');
    html = html.replace('</head>', `${links}\n  </head>`);
  }
  // GOS-01: real static body inside #root (React's createRoot replaces it on mount).
  if (page.body) {
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${page.body}</div>`);
  }
  return html;
}

/* ---------------- main ---------------- */

try {
  if (!existsSync(TEMPLATE)) {
    console.warn('[prerender] dist/index.html not found — skipping.');
    process.exit(0);
  }
  const template = readFileSync(TEMPLATE, 'utf-8');
  const DATA = await loadData();
  if (DATA.seo && DATA.seo.fitTitle) fitTitle = DATA.seo.fitTitle;

  // Published (live-today) blog slugs — body builders use this so static HTML
  // never links to a still-scheduled drip post.
  DATA.publishedBlog = new Set();
  DATA.scheduledBlog = new Set();
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    const today = istToday();
    // same proven per-post pattern as blogPages(): slug → metaTitle → metaDescription → date
    for (const m of src.matchAll(/slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'(?:[^'\\]|\\.)*'[\s\S]*?metaDescription:\s*'(?:[^'\\]|\\.)*'[\s\S]*?date:\s*'([^']+)'/g)) {
      if (m[2] <= today) DATA.publishedBlog.add(m[1]);
      else DATA.scheduledBlog.add(m[1]);
    }
  }

  const blog = blogPages(DATA);
  const pages = [
    ...guidePages(DATA),
    ...softwarePages(DATA),
    ...statePages(DATA),
    ...blog,
    ...helpPages(DATA),
    ...cookbookPages(DATA),
    ...glossaryPages(DATA),
    ...calculatorPages(DATA),
    ...staticExtraPages(DATA),
    ...appShellPages(DATA),
    ...downloadsPages(DATA),
    ...authorPages(DATA, blog),
  ];

  // Batch E1 — English twins at /en/… (fail-soft: on any error the Hindi pages ship alone, without hreflang).
  let en = { pages: [], skipped: [], metaOnly: [] };
  try {
    en = englishPages(pages, DATA);
  } catch (e) {
    for (const p of pages) if (p) delete p.hreflang;
    console.warn('[prerender] English twins skipped:', e && e.message ? e.message : e);
  }
  pages.push(...en.pages);

  // A hand-written link to a drip post that is still scheduled → plain text until its date (mirrors
  // GuideMarkdown's hideLink in BlogPost); the daily rebuild turns it back into a link on publish day.
  for (const page of pages) {
    if (!page || !page.body) continue;
    page.body = page.body.replace(/<a href="\/blog\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/g, (m0, slug, inner) =>
      (DATA.scheduledBlog.has(slug) ? inner : m0));
  }

  // L8: same rule as GuideMarkdown — a /glossary/<slug> link to a term that doesn't exist becomes plain
  // text (or goes to its exact synonym), so static HTML never carries the dead link either.
  const glossarySlugs = new Set(pages.filter((p) => p && p.path && p.path.startsWith('/glossary/')).map((p) => p.path.slice('/glossary/'.length)));
  if (DATA.glossaryLinks) {
    for (const page of pages) {
      if (!page || !page.body) continue;
      page.body = page.body.replace(/<a href="(\/glossary\/[^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m0, href, rest, inner) => {
        const to = DATA.glossaryLinks(href, (slug) => glossarySlugs.has(slug));
        return to === null ? inner : to === href ? m0 : `<a href="${to}"${rest}>${inner}</a>`;
      });
    }
  }

  // English bodies link to the English twin of a target only when that twin was written (else the Hindi page).
  const twinOf = new Map(en.pages.filter((p) => !p.noindex).map((p) => [p.hiPath, p.path]));
  for (const page of en.pages) if (page.body) page.body = localizeEnLinks(page.body, twinOf);

  let n = 0, withBody = 0;
  for (const page of pages) {
    if (!page || !page.path) continue;
    const outDir = resolve(DIST, page.path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, page), 'utf-8');
    n++;
    if (page.body) withBody++;
  }
  const notFound = blogNotFoundPage();
  writeFileSync(resolve(DIST, notFound.file), transform(template, notFound), 'utf-8');
  console.log(`[prerender] wrote ${n} static pages (${withBody} with full HTML body) + ${notFound.file}.`);
  {
    const enBody = en.pages.filter((p) => p.body).length;
    const why = new Map();
    for (const s of en.skipped) why.set(s.reason, (why.get(s.reason) || 0) + 1);
    console.log(`[prerender] English twins: ${en.pages.length} /en pages (${enBody} with English body, ${en.metaOnly.length} meta-only` +
      `${en.metaOnly.length ? ': ' + en.metaOnly.join(', ') : ''}); ${en.skipped.length} eligible Hindi pages without a twin` +
      `${why.size ? ' — ' + [...why].map(([r, c]) => `${c}× ${r}`).join('; ') : ''}.`);
    if (process.env.PRERENDER_VERBOSE) for (const s of en.skipped) console.log(`  no twin: ${s.path} (${s.reason})`);
  }

  try {
    const blogMax = maxDate(blog.map((p) => p.lastmod), LASTMOD.static);
    const { files, total, perFamily } = buildSitemaps(pages, blogMax);
    for (const [name, xml] of files) writeFileSync(resolve(DIST, name), xml, 'utf-8');
    const enUrls = en.pages.filter((p) => !p.noindex).length;
    console.log(`[prerender] wrote sitemap index + ${files.size - 1} child sitemaps (${total} URLs = ${total - enUrls} Hindi + ${enUrls} English): ` +
      perFamily.map((e) => `${e.name.replace('sitemap-', '').replace('.xml', '')}=${e.count}`).join(', '));
  } catch (e) {
    console.warn('[prerender] sitemap generation skipped:', e && e.message ? e.message : e);
  }

  try {
    const rss = buildBlogRss();
    if (rss) {
      writeFileSync(resolve(DIST, 'rss.xml'), rss, 'utf-8');
      console.log('[prerender] wrote rss.xml (blog feed).');
    }
  } catch (e) {
    console.warn('[prerender] rss generation skipped:', e && e.message ? e.message : e);
  }
} catch (err) {
  console.warn('[prerender] skipped due to error:', err && err.message ? err.message : err);
  process.exit(0); // never block the build
}
