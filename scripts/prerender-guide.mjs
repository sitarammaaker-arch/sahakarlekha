// Post-build prerender for /guide/* routes.
//
// The app is a client-rendered SPA, so crawlers / WhatsApp / social scrapers that
// do NOT run JS would otherwise see the homepage <title>/OG tags on every guide
// page. This script clones dist/index.html into dist/guide/<slug>/index.html with
// the chapter's own <title>, description, canonical, OG/Twitter tags and an
// Article + BreadcrumbList JSON-LD baked into <head>. The SPA still boots and
// hydrates normally — only the static <head> differs.
//
// Driven by scripts/guide-manifest.json (emitted by SahakarLekha_Book/split_guide.py).
// Fail-soft: any problem logs a warning and exits 0 so a build is never blocked.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://sahakarlekha.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(DIST, 'index.html');
const MANIFEST = resolve(ROOT, 'scripts', 'guide-manifest.json');
const COURSE = 'सहकारी समिति लेखांकन व अंकेक्षण — सम्पूर्ण कोर्स';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headFor(e) {
  const url = `${SITE}/guide/${e.slug}`;
  const title = `${e.title} — सहकार लेखा गाइड`;
  const desc = e.description || '';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: e.title,
      description: desc,
      inLanguage: 'hi',
      url,
      isPartOf: { '@type': 'Course', name: COURSE, url: `${SITE}/guide` },
      ...(e.section ? { articleSection: e.section } : {}),
      publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'गाइड', item: `${SITE}/guide` },
        { '@type': 'ListItem', position: 2, name: e.title, item: url },
      ],
    },
  ];
  return { url, title, desc, jsonLd };
}

function transform(template, e) {
  const { url, title, desc, jsonLd } = headFor(e);
  let html = template;
  const sub = (re, value) => {
    if (re.test(html)) html = html.replace(re, value);
  };
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  sub(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
  sub(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  sub(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  sub(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
  sub(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`);
  sub(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  sub(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`);
  // Inject the per-page Article + Breadcrumb JSON-LD just before </head>.
  const ld = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
  html = html.replace('</head>', ld);
  return html;
}

try {
  if (!existsSync(TEMPLATE)) {
    console.warn('[prerender-guide] dist/index.html not found — skipping.');
    process.exit(0);
  }
  if (!existsSync(MANIFEST)) {
    console.warn('[prerender-guide] scripts/guide-manifest.json not found — skipping.');
    process.exit(0);
  }
  const template = readFileSync(TEMPLATE, 'utf-8');
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  let n = 0;
  for (const e of entries) {
    if (!e || !e.slug) continue;
    const outDir = resolve(DIST, 'guide', e.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, e), 'utf-8');
    n++;
  }
  console.log(`[prerender-guide] wrote ${n} static guide pages.`);
} catch (err) {
  console.warn('[prerender-guide] skipped due to error:', err && err.message ? err.message : err);
  process.exit(0); // never block the build
}
