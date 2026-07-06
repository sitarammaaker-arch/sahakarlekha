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

if (errors.length) {
  console.error(`[test-dist] ${errors.length} problem(s):`);
  [...new Set(errors)].slice(0, 30).forEach((e) => console.error('  ✗ ' + e));
  if (errors.length > 30) console.error(`  … and ${errors.length - 30} more`);
  process.exit(1);
}
console.log(`[test-dist] ✓ ${pagesChecked} pages · ${linksChecked} internal links resolve · ${ldChecked} JSON-LD blocks valid.`);
