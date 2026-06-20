// Post-build prerender for public SEO routes (/guide/* and /software/*).
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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://sahakarlekha.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(DIST, 'index.html');
const MANIFEST = resolve(ROOT, 'scripts', 'guide-manifest.json');
const SOCIETY_TYPES = resolve(ROOT, 'src', 'content', 'societyTypes.tsx');
const STATES_FILE = resolve(ROOT, 'src', 'content', 'states.ts');
const COURSE = 'सहकारी समिति लेखांकन व अंकेक्षण — सम्पूर्ण कोर्स';

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
    const ld = `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>\n  </head>`;
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
  const pages = [...guidePages(), ...softwarePages(), ...statePages()];
  let n = 0;
  for (const page of pages) {
    if (!page || !page.path) continue;
    const outDir = resolve(DIST, page.path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, page), 'utf-8');
    n++;
  }
  console.log(`[prerender] wrote ${n} static pages (guide + software).`);
} catch (err) {
  console.warn('[prerender] skipped due to error:', err && err.message ? err.message : err);
  process.exit(0); // never block the build
}
