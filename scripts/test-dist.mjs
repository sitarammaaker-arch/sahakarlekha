// GOS-23 — post-build guards over the prerendered output (the exact HTML crawlers
// see). Run AFTER `npm run build`:  npm run test:dist
//   1. Every <script type="application/ld+json"> block must be valid JSON.
//   2. Every internal <a href="/..."> inside a static body must resolve to a
//      prerendered page or a known public SPA route (no broken internal links).
// Exit 1 on any failure.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('[test-dist] dist/ not found — run `npm run build` first.');
  process.exit(1);
}

// Public routes that exist in the SPA but are intentionally not prerendered.
const SPA_ROUTES = new Set([
  '/', '/register', '/login', '/reset-password', '/about', '/contact', '/privacy',
  '/terms', '/search', '/ask', '/guide/quick-start', '/guide/certificate', '/guide/verify',
]);
const SPA_PREFIXES = ['/guide/quiz/'];

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== 'assets') yield* htmlFiles(p);
    else if (e.name === 'index.html') yield p;
  }
}

const prerendered = new Set(['/']);
for (const f of htmlFiles(DIST)) {
  const p = '/' + f.slice(DIST.length + 1).replace(/[\\/]index\.html$/, '').replace(/\\/g, '/');
  prerendered.add(p === '/index.html' ? '/' : p);
}

// Scheduled (future-dated) blog posts: hand-authored articles may reference them
// ahead of time. Until the publish date the SPA redirects them to /blog (not a
// 404), and they become real pages on their date — treat as resolvable.
const blogSrcFile = resolve(ROOT, 'src', 'content', 'blog', 'index.ts');
if (existsSync(blogSrcFile)) {
  const src = readFileSync(blogSrcFile, 'utf-8');
  for (const m of src.matchAll(/^    slug: '([a-z0-9-]+)'/gm)) prerendered.add('/blog/' + m[1]);
}

const resolves = (path) => {
  const clean = path.replace(/\/$/, '') || '/';
  return prerendered.has(clean) || SPA_ROUTES.has(clean) || SPA_PREFIXES.some((pre) => clean.startsWith(pre));
};

const errors = [];
let pagesChecked = 0, linksChecked = 0, ldChecked = 0;

for (const file of htmlFiles(DIST)) {
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf-8');
  pagesChecked++;

  // 1. JSON-LD validity
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldChecked++;
    try { JSON.parse(m[1]); } catch (e) {
      errors.push(`${rel}: invalid JSON-LD (${e.message.slice(0, 60)})`);
    }
  }

  // 2. internal links in the static body only (the SPA handles its own runtime links)
  const i = html.indexOf('<div id="root">');
  const j = html.indexOf('<script type="module"', i);
  const body = i >= 0 ? html.slice(i, j > i ? j : undefined) : '';
  for (const m of body.matchAll(/<a[^>]+href="(\/[^"]*)"/g)) {
    linksChecked++;
    const target = m[1].split('?')[0].split('#')[0];
    if (!resolves(target)) errors.push(`${rel}: broken internal link → ${target}`);
  }
}

// 3. L2 — sitemap ↔ files. Every <loc> must be a prerendered file whose canonical is that same URL and
//    whose title is its own (not the homepage template's); no lastmod after today; no duplicate <loc>.
//    Every prerendered page: a non-empty meta description and exactly ONE <h1> in its static body.
const SITE = 'https://sahakarlekha.com';
const today = new Date().toISOString().slice(0, 10);
const fileFor = (path) => (path === '/' ? resolve(DIST, 'index.html') : resolve(DIST, path.slice(1), 'index.html'));
const homeTitle = (readFileSync(resolve(DIST, 'index.html'), 'utf-8').match(/<title>([\s\S]*?)<\/title>/) || [])[1];
let locsChecked = 0;
const smIndex = existsSync(resolve(DIST, 'sitemap.xml')) ? readFileSync(resolve(DIST, 'sitemap.xml'), 'utf-8') : '';
if (!smIndex) errors.push('sitemap.xml missing');
for (const m of smIndex.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) if (m[1] > today) errors.push(`sitemap.xml: lastmod ${m[1]} is in the future`);
const seenLoc = new Set();
for (const child of smIndex.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const name = child[1].replace(SITE + '/', '');
  const xml = existsSync(resolve(DIST, name)) ? readFileSync(resolve(DIST, name), 'utf-8') : null;
  if (!xml) { errors.push(`${name}: listed in the index but not written`); continue; }
  for (const u of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    locsChecked++;
    const loc = (u[1].match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
    const lm = (u[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '';
    const path = loc.replace(SITE, '') || '/';
    if (seenLoc.has(loc)) errors.push(`${name}: duplicate <loc> ${loc}`);
    seenLoc.add(loc);
    if (lm > today) errors.push(`${name}: ${path} lastmod ${lm} is in the future`);
    const f = fileFor(path);
    if (!existsSync(f)) { errors.push(`${name}: ${path} has no prerendered file (crawlers get the homepage template)`); continue; }
    const html = readFileSync(f, 'utf-8');
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (canon !== loc) errors.push(`${name}: ${path} canonical is ${canon}`);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    if (path !== '/' && title === homeTitle) errors.push(`${name}: ${path} carries the homepage <title>`);
  }
}
// 4. Private app routes never reach the sitemap or a prerendered file (they carry X-Robots-Tag: noindex —
//    vercel.json, kept in sync by scripts/private-noindex.mjs).
const vercelCfg = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8'));
const privateSegs = new Set(vercelCfg.headers.filter((h) => h.headers?.some((x) => x.key === 'X-Robots-Tag'))
  .flatMap((h) => (h.source.match(/^\/\(([^)]+)\)/)?.[1] ?? '').split('|')).filter(Boolean));
for (const loc of seenLoc) {
  const first = loc.replace(SITE, '').split('/')[1] || '';
  if (privateSegs.has(first)) errors.push(`sitemap lists a private (noindex) route: ${loc}`);
}
for (const p of prerendered) {
  const first = p.split('/')[1] || '';
  if (privateSegs.has(first)) errors.push(`a private (noindex) route was prerendered: ${p}`);
}

for (const file of htmlFiles(DIST)) {
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf-8');
  const desc =(html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!desc) errors.push(`${rel}: empty meta description`);
  const i = html.indexOf('<div id="root">');
  const j = html.indexOf('<script type="module"', i);
  const body = i >= 0 ? html.slice(i, j > i ? j : undefined) : '';
  if (body.replace(/<div id="root">\s*<\/div>/, '').trim().length > 40) {
    const h1 = (body.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) errors.push(`${rel}: ${h1} <h1> in the static body (want exactly 1)`);
  }
}

if (errors.length) {
  console.error(`[test-dist] ${errors.length} problem(s):`);
  [...new Set(errors)].slice(0, process.env.ALL ? 1e9 : 30).forEach((e) => console.error('  ✗ ' + e));
  if (errors.length > 30) console.error(`  … and ${errors.length - 30} more`);
  process.exit(1);
}
console.log(`[test-dist] ✓ ${pagesChecked} pages · ${locsChecked} sitemap URLs map to their own file · ${linksChecked} internal links resolve · ${ldChecked} JSON-LD blocks valid.`);
