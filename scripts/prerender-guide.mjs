// Post-build prerender for public SEO routes (/guide/*, /software/*, /blog/*).
//
// The app is a client-rendered SPA, so crawlers / WhatsApp / social scrapers that
// do NOT run JS would otherwise see the homepage <title>/OG tags on every page.
// This script clones dist/index.html into dist/<path>/index.html with the page's
// own <title>, description, canonical, OG/Twitter tags and JSON-LD baked into
// <head>. The SPA still boots and hydrates normally — only the static <head> differs.
//
// Sources:
//   - guide routes: scripts/guide-manifest.json (emitted by SahakarLekha_Book/split_guide.py)
//   - software routes: parsed from src/content/societyTypes.tsx (single source of truth)
// Fail-soft: any problem logs a warning and exits 0 so a build is never blocked.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://sahakarlekha.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(DIST, 'index.html');
const MANIFEST = resolve(ROOT, 'scripts', 'guide-manifest.json');
const SOCIETY_TYPES = resolve(ROOT, 'src', 'content', 'societyTypes.tsx');
const STATES_FILE = resolve(ROOT, 'src', 'content', 'states.ts');
const BLOG_FILE = resolve(ROOT, 'src', 'content', 'blog', 'index.ts');
const HELP_FILE = resolve(ROOT, 'src', 'content', 'help', 'index.ts');
const COOKBOOK_FILE = resolve(ROOT, 'src', 'content', 'cookbook', 'index.ts');
const GLOSSARY_DIR = resolve(ROOT, 'docs', 'kpp', 'wave-1-active');
const COURSE ='सहकारी समिति लेखांकन व ऑडिट — सम्पूर्ण कोर्स';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const crumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item })),
});

// ---- guide routes (from the committed manifest) ----
function guidePages() {
  if (!existsSync(MANIFEST)) return [];
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  return entries.filter((e) => e && e.slug).map((e) => {
    const path = `/guide/${e.slug}`;
    const url = SITE + path;
    return {
      path,
      title: `${e.title} — सहकार लेखा गाइड`,
      description: e.description || '',
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
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        },
        crumb([
          { name: 'गाइड', item: `${SITE}/guide` },
          { name: e.title, item: url },
        ]),
      ],
    };
  });
}

// ---- software routes (parsed from societyTypes.tsx — single source of truth) ----
function softwarePages() {
  const pages = [
    {
      path: '/software',
      title: 'सहकारी समिति लेखा सॉफ्टवेयर — हर प्रकार के लिए | Cooperative Society Software',
      description: 'PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर। अपनी समिति का प्रकार चुनें।',
      jsonLd: [crumb([{ name: 'Software', item: `${SITE}/software` }])],
    },
  ];
  if (existsSync(SOCIETY_TYPES)) {
    const src = readFileSync(SOCIETY_TYPES, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/software/${slug}`;
      pages.push({
        path: `/software/${slug}`,
        title,
        description,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

// ---- state routes (parsed from states.ts — single source of truth) ----
function statePages() {
  const pages = [];
  if (existsSync(STATES_FILE)) {
    const src = readFileSync(STATES_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cooperative-software/${slug}`;
      pages.push({
        path: `/cooperative-software/${slug}`,
        title,
        description,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

// ---- blog routes (parsed from src/content/blog/index.ts — single source of truth) ----
function blogPages() {
  const pages = [
    {
      path: '/blog',
      title: 'सहकार लेखा ब्लॉग — सहकारी समिति लेखांकन, ऑडिट व प्रबंधन',
      description: 'सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट, अनुपालन व प्रबंधन पर सरल हिन्दी लेख।',
      jsonLd: [crumb([{ name: 'ब्लॉग', item: `${SITE}/blog` }])],
    },
  ];
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    // per post, in declared order: slug, metaTitle, metaDescription, date
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?date:\s*'([^']+)'/g;
    let m;
    const today = new Date().toISOString().slice(0, 10);
    while ((m = re.exec(src))) {
      const [, slug, title, description, date] = m;
      if (date > today) continue; // scheduled (future-dated) post — not live yet
      const url = `${SITE}/blog/${slug}`;
      pages.push({
        path: `/blog/${slug}`,
        title,
        description,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: title,
            description,
            inLanguage: 'hi',
            url,
            mainEntityOfPage: url,
            datePublished: date,
            dateModified: date,
            author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
            publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          },
          crumb([
            { name: 'ब्लॉग', item: `${SITE}/blog` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

// ---- help routes (parsed from src/content/help/index.ts — the DO layer) ----
function helpPages() {
  const pages = [
    {
      path: '/help',
      title: 'मदद केंद्र (Help Center) — कैसे करें | SahakarLekha',
      description: 'सहकारी समिति लेखांकन के रोज़मर्रा के काम — Member कैसे जोड़ें, Opening Balance कैसे डालें, Voucher कैसे करें — आसान स्टेप-बाय-स्टेप।',
      jsonLd: [crumb([{ name: 'मदद केंद्र', item: `${SITE}/help` }])],
    },
  ];
  if (existsSync(HELP_FILE)) {
    const src = readFileSync(HELP_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/help/${slug}`;
      pages.push({
        path: `/help/${slug}`,
        title,
        description,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE } },
          crumb([
            { name: 'मदद केंद्र', item: `${SITE}/help` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

// ---- cookbook routes (parsed from src/content/cookbook/index.ts — REFERENCE layer) ----
function cookbookPages() {
  const pages = [
    {
      path: '/cookbook',
      title: 'एंट्री कुकबुक (Accounting Entries) — कौन-सी एंट्री कैसे करें | SahakarLekha',
      description: 'सहकारी समिति की आम journal entries — बिक्री-खरीद, शेयर पूँजी, ऋण-ब्याज, वेतन, डेप्रिसिएशन, क्लोज़िंग स्टॉक, HAFED कमीशन — हर एक का Dr/Cr उदाहरण सहित।',
      jsonLd: [crumb([{ name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` }])],
    },
  ];
  if (existsSync(COOKBOOK_FILE)) {
    const src = readFileSync(COOKBOOK_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cookbook/${slug}`;
      pages.push({
        path: `/cookbook/${slug}`,
        title,
        description,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE } },
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

// ---- glossary routes (generated from ACTIVE Knowledge Items — single source of truth) ----
// Reads /docs/kpp/wave-1-active/KI-*.md (the same files the app's glossary adapter reads),
// so the prerendered head + sitemap can never drift from the live glossary.
function glossaryPages() {
  const pages = [
    {
      path: '/glossary',
      title: 'सहकारी लेखांकन शब्दकोश (Glossary) — हर शब्द आसान भाषा में | SahakarLekha',
      description: 'रोकड़ बही से बैलेंस शीट तक — सहकारी समिति लेखांकन के मुख्य शब्दों का आसान हिन्दी व English शब्दकोश।',
      jsonLd: [crumb([{ name: 'शब्दकोश', item: `${SITE}/glossary` }])],
    },
  ];
  if (!existsSync(GLOSSARY_DIR)) return pages;
  const files = readdirSync(GLOSSARY_DIR).filter((f) => /^KI-\d+.*\.md$/.test(f));
  for (const file of files) {
    const src = readFileSync(resolve(GLOSSARY_DIR, file), 'utf-8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const field = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1]?.trim() || '';
    if (field('status') && field('status') !== 'active') continue;
    const slug = file.replace(/^KI-\d+-/, '').replace(/\.md$/, '');
    const hindi = field('hindi_name');
    const en = field('english_name') || field('title');
    const name = hindi ? `${hindi} (${en})` : en;
    const rawDef = (src.match(/\*\*Definition:\*\*\s*(.+)/) || [])[1]?.trim() || '';
    // strip inline markdown (**bold**, *italic*, `code`, [[KI-..]]) so meta/JSON-LD read cleanly
    const def = rawDef.replace(/\[\[[^\]]*\]\]/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
    const url = `${SITE}/glossary/${slug}`;
    pages.push({
      path: `/glossary/${slug}`,
      title: `${name} — सहकारी लेखांकन शब्दकोश | SahakarLekha`,
      description: def.slice(0, 158),
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'DefinedTerm', name, description: def,
          inLanguage: 'hi', url, termCode: field('knowledge_id'),
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'SahakarLekha Glossary', url: `${SITE}/glossary` },
        },
        crumb([
          { name: 'शब्दकोश', item: `${SITE}/glossary` },
          { name: en, item: url },
        ]),
      ],
    });
  }
  return pages;
}

// ---- sitemap.xml (build-time, from the SAME route sources as the prerender) ----
// Regenerates the DEPLOYED dist/sitemap.xml so it can never drift from the actual
// built routes (the hand file had stale /guide/quiz/bhag-N slugs + missing part-10).
// split_guide.py and the committed public/sitemap.xml are left untouched — vite
// copies public/sitemap.xml into dist/, then this overwrites the dist copy.
function buildSitemap(dynamicPages) {
  const today = new Date().toISOString().slice(0, 10);
  // Static public routes (always present; not prerendered).
  const STATIC = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/register', changefreq: 'monthly', priority: '0.9' },
    { path: '/login', changefreq: 'monthly', priority: '0.8' },
    { path: '/about', changefreq: 'monthly', priority: '0.5' },
    { path: '/pricing', changefreq: 'monthly', priority: '0.7' },
    { path: '/faq', changefreq: 'monthly', priority: '0.6' },
    { path: '/contact', changefreq: 'monthly', priority: '0.6' },
    { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
    { path: '/terms', changefreq: 'yearly', priority: '0.3' },
    // Guide hub + landing routes (chapters themselves come from guidePages()).
    { path: '/guide', changefreq: 'weekly', priority: '0.9' },
    { path: '/guide/quick-start', changefreq: 'monthly', priority: '0.7' },
    { path: '/guide/certificate', changefreq: 'monthly', priority: '0.5' },
    { path: '/guide/verify', changefreq: 'monthly', priority: '0.5' },
  ];
  // One quiz per guide Part (currently 10). Canonical slugs are part-N (bhag-N 301s here).
  for (let i = 1; i <= 10; i++) STATIC.push({ path: `/guide/quiz/part-${i}`, changefreq: 'monthly', priority: '0.4' });

  const rank = (path) => {
    if (path === '/blog') return { changefreq: 'weekly', priority: '0.9' };
    if (path === '/software') return { changefreq: 'weekly', priority: '0.8' };
    if (path === '/glossary') return { changefreq: 'weekly', priority: '0.8' };
    if (path.startsWith('/blog/')) return { changefreq: 'monthly', priority: '0.8' };
    if (path.startsWith('/software/') || path.startsWith('/cooperative-software/')) return { changefreq: 'monthly', priority: '0.8' };
    if (path.startsWith('/glossary/')) return { changefreq: 'monthly', priority: '0.6' };
    if (path.startsWith('/guide/')) return { changefreq: 'monthly', priority: '0.7' };
    return { changefreq: 'monthly', priority: '0.6' };
  };

  const all = [
    ...STATIC,
    ...dynamicPages.filter((p) => p && p.path).map((p) => ({ path: p.path, ...rank(p.path) })),
  ];
  const seen = new Set();
  const urls = all.filter((u) => (seen.has(u.path) ? false : (seen.add(u.path), true)));

  const body = urls.map((u) =>
    `  <url>\n    <loc>${SITE}${u.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function transform(template, page) {
  const url = SITE + page.path;
  let html = template;
  const sub = (re, value) => { if (re.test(html)) html = html.replace(re, value); };
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  sub(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`);
  sub(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  sub(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  sub(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`);
  sub(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`);
  sub(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  sub(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  if (page.jsonLd && page.jsonLd.length) {
    // Escape "<" so a value containing "</script>" can never break out of the tag (safe JSON-in-HTML).
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    const ld = `<script type="application/ld+json">${json}</script>\n  </head>`;
    html = html.replace('</head>', ld);
  }
  return html;
}

try {
  if (!existsSync(TEMPLATE)) {
    console.warn('[prerender] dist/index.html not found — skipping.');
    process.exit(0);
  }
  const template = readFileSync(TEMPLATE, 'utf-8');
  const pages = [...guidePages(), ...softwarePages(), ...statePages(), ...blogPages(), ...helpPages(), ...cookbookPages(), ...glossaryPages()];
  let n = 0;
  for (const page of pages) {
    if (!page || !page.path) continue;
    const outDir = resolve(DIST, page.path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, page), 'utf-8');
    n++;
  }
  console.log(`[prerender] wrote ${n} static pages (guide + software + blog + glossary).`);
  try {
    const sitemap = buildSitemap(pages);
    writeFileSync(resolve(DIST, 'sitemap.xml'), sitemap, 'utf-8');
    const count = (sitemap.match(/<loc>/g) || []).length;
    console.log(`[prerender] regenerated dist/sitemap.xml (${count} URLs)`);
  } catch (e) {
    console.warn('[prerender] sitemap generation skipped:', e && e.message ? e.message : e);
  }
} catch (err) {
  console.warn('[prerender] skipped due to error:', err && err.message ? err.message : err);
  process.exit(0); // never block the build
}
