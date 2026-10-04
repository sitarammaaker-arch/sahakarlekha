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
const GUIDE_DIR = resolve(ROOT, 'src', 'content', 'guide');
const HELP_FILE = resolve(ROOT, 'src', 'content', 'help', 'index.ts');
const COOKBOOK_FILE = resolve(ROOT, 'src', 'content', 'cookbook', 'index.ts');
const GLOSSARY_DIR = resolve(ROOT, 'docs', 'kpp', 'wave-1-active');
const CALC_FILE = resolve(ROOT, 'src', 'content', 'calculators', 'index.ts');
const FAQ_FILE = resolve(ROOT, 'src', 'content', 'faq.ts');
const QUIZ_FILE = resolve(ROOT, 'src', 'content', 'guide', 'quizzes.ts');
const GLOSSARY_LINKS_FILE = resolve(ROOT, 'src', 'content', 'glossaryLinks.ts');
const HUB_META_FILE = resolve(ROOT, 'src', 'content', 'hubMeta.ts');
const DOWNLOADS_FILE = resolve(ROOT, 'src', 'content', 'downloads.ts');
const GUIDE_UPDATED_FILE = resolve(ROOT, 'src', 'content', 'guide', 'updated.ts');
const RELATED_FILE = resolve(ROOT, 'src', 'content', 'relatedContent.ts');
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
  pricing: '2026-08-20',
  static: '2026-06-19',
};

marked.setOptions({ gfm: true });

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
const BUILD_DAY = new Date().toISOString().slice(0, 10);
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
function shell({ crumbs = [], current = '', html, hero = '' }) {
  const bc = crumbs.length || current
    ? `<nav aria-label="breadcrumb" class="sl-crumb">` +
      [...crumbs.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`), current ? esc(current) : null]
        .filter(Boolean).join(' › ') +
      `</nav>`
    : '';
  const explore =
    `<nav aria-label="explore" class="sl-explore"><p><strong>और देखें:</strong> ` +
    HUB_LINKS.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ') +
    `</p></nav>`;
  return (
    `<div class="sl-pre"><style>${SHELL_CSS}</style>` + BRAND_BAR + hero +
    `<main class="sl-main">` + bc + html + explore + `</main></div>`
  );
}

const registerCta = (next) =>
  `<p style="margin-top:24px"><a href="/register${next ? `?next=${encodeURIComponent(next)}` : ''}"><strong>अपनी समिति का खाता डिजिटल कीजिए — रजिस्टर करें →</strong></a></p>`;

/** Routes worth linking in CRAWLER-facing static bodies (public surfaces only —
    app-module deep links are noindexed and would just leak crawl signals). */
const PUBLIC_PREFIXES = ['/downloads', '/guide', '/blog', '/help', '/cookbook', '/glossary', '/tools', '/software', '/cooperative-software', '/register', '/faq', '/pricing', '/about', '/contact', '/search', '/ask'];
const isPublicRoute = (l) => PUBLIC_PREFIXES.some((p) => l === p || l.startsWith(p + '/') || l.startsWith(p + '?'));

/** A blog link is emitted in static bodies ONLY once the post is live (scheduled
    drip posts would otherwise be broken links until their publish date). */
const blogIsLive = (DATA, slug) => !DATA.publishedBlog || DATA.publishedBlog.has(slug);

/** GOS-11: render a SurfaceLinks bundle ({guide/blog: Refs, help/cookbook: slugs}) as an "और सीखें" block. */
function surfaceLinksHtml(links, DATA, heading = 'और सीखें') {
  if (!links) return '';
  const parts = [];
  for (const r of links.guide || []) parts.push(`<a href="/guide/${r.slug}">${esc(r.title)}</a>`);
  for (const r of (links.blog || []).filter((r) => blogIsLive(DATA, r.slug))) parts.push(`<a href="/blog/${r.slug}">${esc(r.title)}</a>`);
  for (const s of links.help || []) {
    const t = (DATA.help || []).find((x) => x.slug === s);
    if (t) parts.push(`<a href="/help/${s}">${esc(t.title)}</a>`);
  }
  for (const s of links.cookbook || []) {
    const e = (DATA.cookbook || []).find((x) => x.slug === s);
    if (e) parts.push(`<a href="/cookbook/${s}">${esc(e.title)}</a>`);
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
      title: 'सहकारी समिति लेखा सॉफ्टवेयर — हर प्रकार के लिए | Cooperative Society Software',
      description: 'PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए लेखा सॉफ्टवेयर, ₹1,499/FY से। अपनी समिति का प्रकार चुनें।',
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
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    // per post, in declared order: slug, metaTitle, metaDescription, date [, updated]
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?date:\s*'([^']+)'(?:,\s*\r?\n\s*updated:\s*'([^']+)')?/g;
    let m;
    const today = new Date().toISOString().slice(0, 10);
    while ((m = re.exec(src))) {
      const [, slug, title, description, date, updated] = m;
      if (date > today) continue; // scheduled (future-dated) post — not live yet
      posts.push({ slug, title, description, date, updated: notFuture(updated) });
    }
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
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

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
              `<h1>सहकार लेखा ब्लॉग</h1><p>सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट व अनुपालन पर सरल हिन्दी लेख।</p><ul>` +
              posts.map((p) => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a> <small>(${p.date})</small></li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
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
        body = shell({
          crumbs: [['/blog', 'ब्लॉग']],
          current: heading,
          html: `<h1>${esc(heading)}</h1>` + md(raw.replace(/^﻿?\s*#\s+.*(\r?\n)+/, '')) + helpLinks + registerCta(),
        });
      }
    } catch { /* body optional */ }
    pages.push({
      path: `/blog/${p.slug}`,
      title: p.title,
      description: p.description,
      lastmod: p.updated || p.date,
      image: images[p.slug] ? `${SITE}${images[p.slug]}` : undefined,
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.description,
          inLanguage: 'hi',
          url,
          mainEntityOfPage: url,
          datePublished: p.date,
          dateModified: p.updated || p.date,
          image: images[p.slug] ? `${SITE}${images[p.slug]}` : `${SITE}/og-image.png`,
          author: BLOG_AUTHOR,
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } },
        },
        crumb([
          { name: 'ब्लॉग', item: `${SITE}/blog` },
          { name: p.title, item: url },
        ]),
        ...(faqs.length ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
        }] : []),
      ],
    });
  }
  return pages;
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
    const internalLinks = Array.from((s['internal links'] || '').matchAll(/(^|[\s·])(\/[a-z0-9/:_-]+)/gi))
      .map((mm) => mm[2])
      .filter(isPublicRoute); // app-module links stay on the live page, not in crawler HTML

    pages.push({
      path: `/glossary/${t.slug}`,
      title: `${name} — सहकारी लेखांकन शब्दकोश | SahakarLekha`,
      description: DATA.hub.glossaryMetaDescription({ hindi: s['hindi explanation'], definition: s['definition'] }), // L5: same rule as GlossaryTerm
      lastmod: t.lastUpdated || LASTMOD.static,
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
    title: 'SahakarLekha — Cooperative Accounting & Management Platform for India',
    description: 'भारतीय cooperative societies के लिए accounting, GST/TDS, member records, reports और audit-ready workflows — PACS, Dairy, Marketing, Consumer व अन्य। SahakarLekha ₹1,499/FY से शुरू करें, Hindi + English।',
    lastmod: LASTMOD.static,
    // Mirrors LandingPage's hero (same h1/lead/CTA copy) so the hand-off to React is
    // near-seamless. Pricing copy must match the paid model: no public free plan.
    body: shell({
      hero:
        `<section class="sl-hero"><div class="sl-hero-in">` +
          `<span class="sl-badge">Cooperative-first Accounting Platform</span>` +
          `<h1>सहकारी समिति का <span>Accounting, Compliance और Control</span> — एक ही जगह।</h1>` +
          `<p class="sl-lead">PACS, dairy, marketing, consumer और अन्य cooperative societies के लिए बनाया गया — जहाँ vouchers से लेकर financial statements, GST/TDS और audit-ready reports तक एक connected system में रहते हैं।</p>` +
          `<p>Professional cooperative accounting <strong>₹1,499/FY से</strong>। Team व operations बढ़ें तो Plus या Pro के साथ आगे बढ़ें।</p>` +
          `<div class="sl-ctas"><a class="sl-btn" href="/register">शुरू करें / Get Started →</a><a class="sl-btn sl-btn-o" href="/pricing">मूल्य देखें</a></div>` +
          `<p class="sl-ticks">✓ Unlimited Vouchers · ✓ Unlimited Members · ✓ Data Export Anytime · ✓ ₹1,499/FY से</p>` +
        `</div></section>`,
      html:
        `<h2>एक ही system में सब कुछ</h2>` +
        `<ul class="sl-cards">` +
          `<li>असीमित वाउचर व सदस्य — नकद/बैंक, खरीद-बिक्री, वेतन, ऋण, जमा</li>` +
          `<li>सभी रिपोर्ट PDF/Excel में — ट्रायल बैलेंस, बैलेंस शीट, आय-व्यय, प्राप्ति-भुगतान, TDS/GST</li>` +
          `<li>सहकारी-विशेष — ऋण रजिस्टर व ऋण-सीमा जाँच, आरक्षित निधि विनियोजन, नामांकन, RCS ऑडिट प्रारूप</li>` +
          `<li>साप्ताहिक स्वतः बैकअप · हिन्दी + English · डेटा कभी भी export करें, कोई लॉक-इन नहीं</li>` +
        `</ul>` +
        `<p>PACS, dairy, marketing, consumer, housing — हर प्रकार की समिति के लिए। Starter ₹1,499/FY · Plus ₹3,999/FY · Pro ₹9,999/FY — <a href="/pricing">सभी plans देखें</a>।</p>` +
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
        `<p>SahakarLekha एक <strong>सहकारी-विशेष क्लाउड लेखा प्लेटफ़ॉर्म</strong> है। हमारा उद्देश्य — भारत की हर सहकारी समिति को, चाहे गाँव की छोटी समिति हो या राज्य-स्तरीय फेडरेशन, आधुनिक, पारदर्शी व किफ़ायती लेखा प्रणाली देना — <a href="/pricing">₹1,499/FY से</a>।</p>` +
        `<p>A cooperative-specific cloud accounting platform — built for PACS, dairy, marketing, consumer and housing societies, in Hindi and English, from ₹1,499 per financial year.</p>` +
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
        `<p>अपनी समिति अभी शुरू करें (<a href="/pricing">₹1,499/FY से</a>), या पहले <a href="/guide">गाइड</a> व <a href="/faq">सामान्य प्रश्न</a> देखें।</p>` +
        registerCta(),
    }),
  });

  pages.push({
    path: '/pricing',
    title: 'SahakarLekha Pricing — Starter, Plus & Pro Cooperative Accounting Plans',
    description: 'SahakarLekha cooperative accounting ₹1,499/FY से शुरू करें। Staff, role-based access, payroll, multi-branch accounting और advanced operations के लिए Plus या Pro चुनें।',
    lastmod: LASTMOD.pricing,
    jsonLd: [crumb([{ name: 'मूल्य', item: `${SITE}/pricing` }])],
    body: shell({
      current: 'मूल्य',
      html:
        `<h1>SahakarLekha मूल्य — Starter, Plus व Pro</h1>` +
        `<p>Professional cooperative accounting ₹1,499/FY से। आपकी समिति छोटी हो या बढ़ रही हो — SahakarLekha उसके साथ बढ़ता है। Staff, automation और advanced control की ज़रूरत हो तो Plus या Pro चुनें।</p>` +
        `<h2>Starter — ₹1,499 / वित्त वर्ष (≈ ₹125/माह)</h2>` +
        `<p>छोटी, single-user समिति के लिए पूरा professional accounting — demo नहीं। 1 समिति · 1 user · असीमित vouchers व सदस्य। Ledger, Trial Balance, Balance Sheet, P&amp;L, Receipts &amp; Payments, GST/TDS सारांश, Member/Share/Loan register, PDF/Excel/CSV export, secure cloud backup, core security व basic audit trail — आपका डेटा आपका।</p>` +
        `<h2>Plus — ₹3,999 / वित्त वर्ष (≈ ₹333/माह) · सबसे लोकप्रिय</h2>` +
        `<p>staff के साथ चलने वाली समिति के लिए। Starter का सब कुछ, और: <strong>5 Staff Users + 1 Auditor/CA शामिल</strong>, Role-Based Access व staff activity controls, payroll automation, scheduled backup/export, report branding हटता व priority support।</p>` +
        `<h2>Pro — ₹9,999 / वित्त वर्ष (≈ ₹833/माह)</h2>` +
        `<p>multi-branch व advanced संचालन के लिए। Plus का सब कुछ, और: Unlimited Users, Multi-Branch Accounting व branch-wise reporting, Multi-Society Consolidation, Custom Chart of Accounts, API Access, Data-Migration सहायता व Custom-Branded Reports।</p>` +
        `<h2>Enterprise / Federation — ₹49,000/साल से</h2>` +
        `<p>Federations, unions, clusters व बड़े deployments के लिए — bulk society deployment, central administration, organisation-wide reporting, integrations/API, bulk migration व dedicated onboarding/support। <a href="/contact">हमसे बात करें</a>।</p>` +
        `<p>सभी दाम प्रति समिति, प्रति वित्त वर्ष (अप्रैल renewal)। <a href="/faq">अक्सर पूछे जाने वाले प्रश्न देखें</a></p>` +
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

/* ---------------- blog RSS 2.0 feed (lightweight — latest 30 live posts) ---------------- */
// Re-parses the blog registry (same proven per-post regex as blogPages / the sitemap)
// and emits a minimal RSS 2.0 feed to dist/rss.xml. No dependencies, no bodies —
// just title, link, guid, pubDate and the meta description per post.
function buildBlogRss() {
  if (!existsSync(BLOG_FILE)) return null;
  const src = readFileSync(BLOG_FILE, 'utf-8');
  const today = new Date().toISOString().slice(0, 10);
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
  const all = dynamicPages.filter((p) => p && p.path).map((p) => ({
    path: p.path,
    lastmod: notFuture(PAGE_LASTMOD[p.path] || (p.path.startsWith('/guide/quiz/') ? LASTMOD.guide : p.lastmod) || LASTMOD.static),
  }));
  const seen = new Set();
  const urls = all.filter((u) => (seen.has(u.path) ? false : (seen.add(u.path), true)));

  // group by family
  const groups = new Map();
  for (const u of urls) {
    const fam = familyOf(u.path);
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam).push(u);
  }

  const files = new Map();
  const indexEntries = [];
  for (const [fam, items] of groups) {
    const name = `sitemap-${fam}.xml`;
    const body = items.map((u) => {
      const r = rank(u.path);
      return `  <url>\n    <loc>${SITE}${u.path}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`;
    }).join('\n');
    files.set(name, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    indexEntries.push({ name, lastmod: maxDate(items.map((i) => i.lastmod), LASTMOD.static), count: items.length });
  }

  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    indexEntries.map((e) => `  <sitemap>\n    <loc>${SITE}/${e.name}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </sitemap>`).join('\n') +
    `\n</sitemapindex>\n`;
  files.set('sitemap.xml', index);
  return { files, total: urls.length, perFamily: indexEntries };
}

/* ---------------- head + body transform ---------------- */

function transform(template, page) {
  const url = SITE + page.path;
  let html = template;

  // Subpages: drop the homepage-only template schemas (SoftwareApplication + the
  // 5-question FAQPage) so each page carries ONLY its own JSON-LD + Organization.
  // The homepage itself (path '/') KEEPS them — they belong there.
  if (page.path !== '/') {
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
  if (page.jsonLd && page.jsonLd.length) {
    // Escape "<" so a value containing "</script>" can never break out of the tag (safe JSON-in-HTML).
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    const ld = `<script type="application/ld+json">${json}</script>\n  </head>`;
    html = html.replace('</head>', ld);
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

  // Published (live-today) blog slugs — body builders use this so static HTML
  // never links to a still-scheduled drip post.
  DATA.publishedBlog = new Set();
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    const today = new Date().toISOString().slice(0, 10);
    // same proven per-post pattern as blogPages(): slug → metaTitle → metaDescription → date
    for (const m of src.matchAll(/slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'(?:[^'\\]|\\.)*'[\s\S]*?metaDescription:\s*'(?:[^'\\]|\\.)*'[\s\S]*?date:\s*'([^']+)'/g)) {
      if (m[2] <= today) DATA.publishedBlog.add(m[1]);
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
  ];

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

  let n = 0, withBody = 0;
  for (const page of pages) {
    if (!page || !page.path) continue;
    const outDir = resolve(DIST, page.path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, page), 'utf-8');
    n++;
    if (page.body) withBody++;
  }
  console.log(`[prerender] wrote ${n} static pages (${withBody} with full HTML body).`);

  try {
    const blogMax = maxDate(blog.map((p) => p.lastmod), LASTMOD.static);
    const { files, total, perFamily } = buildSitemaps(pages, blogMax);
    for (const [name, xml] of files) writeFileSync(resolve(DIST, name), xml, 'utf-8');
    console.log(`[prerender] wrote sitemap index + ${files.size - 1} child sitemaps (${total} URLs): ` +
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
