// GOS-23 — IndexNow ping: tells Bing/Yandex (NOT Google — it ignores IndexNow)
// which URLs exist/changed, straight from the sitemaps.
//   npm run seo:ping           → URLs from dist/sitemap-*.xml (after a local build)
//   npm run seo:ping -- --live → URLs fetched from the LIVE site's sitemap index
// The key file is served at /<key>.txt (in public/), which proves domain ownership.
// Safe to run repeatedly; IndexNow endpoints dedupe. Max 10,000 URLs per POST.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SITE = 'https://sahakarlekha.com';
const HOST = 'sahakarlekha.com';
const KEY = 'ae9158729d82cc3f22621c96246cdfa5'; // matches public/<key>.txt

const live = process.argv.includes('--live');
const urls = new Set();

if (live) {
  const index = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const child of children) {
    const xml = await (await fetch(child)).text();
    for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) urls.add(m[1]);
  }
} else {
  if (!existsSync(DIST)) {
    console.error('[indexnow] dist/ not found — run `npm run build` first, or use --live.');
    process.exit(1);
  }
  for (const f of readdirSync(DIST).filter((f) => /^sitemap-.*\.xml$/.test(f))) {
    const xml = readFileSync(resolve(DIST, f), 'utf-8');
    for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) urls.add(m[1]);
  }
}

const urlList = [...urls].slice(0, 10000);
if (!urlList.length) {
  console.error('[indexnow] no URLs found — nothing to ping.');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
// 200 = processed, 202 = accepted (key will be verified async) — both are success.
console.log(`[indexnow] pinged ${urlList.length} URLs (${live ? 'live' : 'dist'}) → HTTP ${res.status}${res.status === 200 || res.status === 202 ? ' ✓' : ' ✗'}`);
if (res.status !== 200 && res.status !== 202) process.exit(1);
