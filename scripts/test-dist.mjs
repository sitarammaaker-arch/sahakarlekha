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

// noindex stubs (scheduled drip posts) are files, but a static link to one is still a dead end for the
// reader until its date — the prerender turns such links into plain text, so none may remain.
const noindexPages = new Set();
for (const f of htmlFiles(DIST)) {
  if (!/<meta name="robots" content="noindex/.test(readFileSync(f, 'utf-8'))) continue;
  noindexPages.add('/' + f.slice(DIST.length + 1).replace(/[\\/]?index\.html$/, '').replace(/\\/g, '/'));
}

const resolves = (path) => {
  const clean = path.replace(/\/$/, '') || '/';
  if (noindexPages.has(clean)) return false;
  return prerendered.has(clean) || SPA_ROUTES.has(clean) || SPA_PREFIXES.some((pre) => clean.startsWith(pre));
};

const errors = [];
let pagesChecked = 0, linksChecked = 0, ldChecked = 0;

for (const file of htmlFiles(DIST)) {
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf-8');
  pagesChecked++;

  // 1. JSON-LD validity
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
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
  // GFM task lists must render as ☐ text — a static <input> surfaced as "[Input]" in crawled text.
  if (/<input[\s>]/.test(body)) errors.push(`${rel}: <input> in the static body (task-list checkbox?)`);
}

// Blog soft-404 guards: the author page and the not-found page are real files, and no rewrite catches
// /blog/* — an unknown blog path must fall through to 404.html with a real HTTP 404, not a 200 page.
if (!existsSync(resolve(DIST, 'author', 'sitaram', 'index.html'))) errors.push('author/sitaram/index.html missing (crawlers get the homepage template)');
const nf = existsSync(resolve(DIST, '404.html')) ? readFileSync(resolve(DIST, '404.html'), 'utf-8') : '';
if (!/<meta name="robots" content="noindex/.test(nf)) errors.push('404.html missing or not noindex');
{
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8'));
  for (const r of vercel.rewrites || []) {
    const src = r.source || '';
    if (src.startsWith('/blog') || (src.startsWith('/((?!') && !src.includes('blog/'))) {
      errors.push(`vercel.json: rewrite "${src}" catches /blog/* — unknown blog URLs would answer 200 instead of 404`);
    }
  }
}

// Blog categories: /blog lists every live post under a category <h2>, each category <h2> links to its
// own prerendered hub, and the hubs together list exactly the live posts (each post on one hub).
{
  const blogHtml = existsSync(resolve(DIST, 'blog', 'index.html')) ? readFileSync(resolve(DIST, 'blog', 'index.html'), 'utf-8') : '';
  const hubSlugs = [...blogHtml.matchAll(/<h2><a href="\/blog\/category\/([a-z0-9-]+)">/g)].map((m) => m[1]);
  if (hubSlugs.length < 2) errors.push(`blog/index.html: expected category <h2> sections, found ${hubSlugs.length}`);
  const livePosts = new Set([...blogHtml.matchAll(/<li><a href="\/blog\/([a-z0-9-]+)">/g)].map((m) => m[1]));
  const onHubs = new Map();
  for (const s of hubSlugs) {
    const f = resolve(DIST, 'blog', 'category', s, 'index.html');
    if (!existsSync(f)) { errors.push(`blog/category/${s}/index.html missing`); continue; }
    const h = readFileSync(f, 'utf-8');
    if (!/"@type":"CollectionPage"/.test(h)) errors.push(`blog/category/${s}: no CollectionPage JSON-LD`);
    for (const m of h.matchAll(/<li><a href="\/blog\/([a-z0-9-]+)">/g)) {
      if (onHubs.has(m[1])) errors.push(`blog post ${m[1]} is on two category hubs (${onHubs.get(m[1])}, ${s})`);
      onHubs.set(m[1], s);
    }
  }
  for (const p of livePosts) if (!onHubs.has(p)) errors.push(`blog post ${p} is on /blog but on no category hub`);
  for (const p of onHubs.keys()) if (!livePosts.has(p)) errors.push(`blog post ${p} is on a category hub but not on /blog`);
}

// Blog trust note (batch 2): crawlers see the same review date / "general information" note / state
// badge as readers, every note links to the editorial policy, and that policy page is prerendered.
{
  const read = (rel) => (existsSync(resolve(DIST, rel)) ? readFileSync(resolve(DIST, rel), 'utf-8') : '');
  if (!/<h1>संपादकीय व सुधार नीति<\/h1>/.test(read('editorial-policy/index.html'))) errors.push('editorial-policy/index.html missing or without its h1');
  const reviewedPost = read('blog/haryana-cooperative-act-1984-rules-1989-guide/index.html');
  if (!/class="sl-trust"[\s\S]*?अंतिम समीक्षा:[\s\S]*?हरियाणा[\s\S]*?href="\/editorial-policy"/.test(reviewedPost) && !/class="sl-trust"[\s\S]*?हरियाणा[\s\S]*?अंतिम समीक्षा:[\s\S]*?href="\/editorial-policy"/.test(reviewedPost)) {
    errors.push('blog/haryana-cooperative-act-1984-rules-1989-guide: static trust note (review date + Haryana + policy link) missing');
  }
  const unreviewed = read('blog/tds-and-26q-for-societies/index.html');
  if (!/class="sl-trust"[\s\S]*?सामान्य जानकारी[\s\S]*?href="\/editorial-policy"/.test(unreviewed) || /अंतिम समीक्षा:/.test(unreviewed)) {
    errors.push('blog/tds-and-26q-for-societies: static "general information" note missing, or it claims a review');
  }
  if (/class="sl-trust"/.test(read('blog/debit-credit-and-double-entry/index.html'))) errors.push('blog/debit-credit-and-double-entry: trust note on a non-legal, non-state post');
}

// 3. L2 — sitemap ↔ files. Every <loc> must be a prerendered file whose canonical is that same URL and
//    whose title is its own (not the homepage template's); no lastmod after today; no duplicate <loc>.
//    Every prerendered page: a non-empty meta description and exactly ONE <h1> in its static body.
const SITE = 'https://sahakarlekha.com';
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); // IST, as the prerender
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
