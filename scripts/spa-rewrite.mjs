#!/usr/bin/env node
// The SPA rewrite in vercel.json, derived from src/App.tsx (one source).
//
// The rewrite used to be a catch-all: every path that was not a file was answered with the app shell and
// HTTP 200. So /anything-at-all, /PRICING, /manifest.json, /ads.txt and /wp-login.php all "existed" — soft
// 404s that a search engine reads as real, empty pages that copy the homepage.
//
// Now only paths whose FIRST segment is a real route in App.tsx are rewritten to the app. Anything else
// has no file and no rewrite, so Vercel answers it with dist/404.html and a real 404 status (the same
// path /blog/<unknown> has taken since /blog was taken out of the rewrite).
//
// Inside a known section nothing changes: /guide/<anything> and /dashboard/<anything> still reach the app,
// which redirects or shows its own not-found screen. /blog stays out of the rewrite, as before.
//
//   node scripts/spa-rewrite.mjs           check (CI: npm run test:spa-rewrite)
//   node scripts/spa-rewrite.mjs --write   rewrite the two rules in vercel.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const vercelPath = resolve(ROOT, 'vercel.json');
const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));

/** Sections answered only from prerendered files — an unknown path under them is a real 404. */
// Every valid page of these sections is a prerendered file (hub + one page per slug), so an unknown slug has
// nothing to render. Left in the rewrite, /software/<anything> answered 200 with the home page's HTML and
// canonical "/" — the same soft 404 /blog once had. /guide is included: its chapters (all 47 in the
// manifest), quick-start, certificate, verify and the ten quiz pages are every one a prerendered file, and
// the certificate number travels in the query string (/guide/verify?id=…), not in the path.
export const NOT_REWRITTEN = ['blog', 'software', 'cooperative-software', 'glossary', 'help', 'cookbook', 'tools', 'author', 'guide'];
/** Segments routed without a <Route path> of their own. */
// SEO-01 (audit 2026-11-17): 'en' is NOT here any more. Every English page is a prerendered file (dist/en/…), so the
// rewrite only ever answered addresses that had no page — /en/zzz-none and /en/dashboard came back 200 with the home
// page's HTML and "index, follow". Now an unknown /en/… is a real 404, and the /en/ address of an app page (no English
// twin) is REDIRECTED to the Hindi page (EN_REDIRECTS below), never served as a copy of the home page.
export const EXTRA_SEGMENTS = [];

const paths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const seg = (p) => p.replace(/^\//, '').split('/')[0];
export const SEGMENTS = [...new Set([...paths.map(seg), ...EXTRA_SEGMENTS])]
  .filter((s) => s && s !== '*' && !s.startsWith(':') && !NOT_REWRITTEN.includes(s))
  .sort();

const alt = SEGMENTS.join('|');
const DEST = '/index.html';
const RULES = [
  { source: `/(${alt})`, destination: DEST },
  { source: `/(${alt})/:path*`, destination: DEST },
];
const isSpaRule = (r) => r.destination === DEST;

// SEO-01: /en/<app page> → /<app page> (temporary — the page may get an English twin later). Vercel runs redirects
// BEFORE the filesystem, so a segment that HAS English pages (lib/enRoutes EN_SECTIONS) is never redirected — /en/pricing
// is a real file. EN_EXCLUDED paths (inside a twin section but Hindi-only) are redirected one by one.
const enRoutes = readFileSync(resolve(ROOT, 'src/lib/enRoutes.ts'), 'utf8');
const listOf = (name) => {
  const body = enRoutes.split(`export const ${name}: readonly string[] = [`)[1]?.split('];')[0] ?? '';
  return [...body.matchAll(/^\s*'([^']+)'/gm)].map((m) => m[1]);
};
export const EN_SECTION_SEGMENTS = [...new Set(listOf('EN_SECTIONS').map(seg).filter(Boolean))].sort();
export const EN_EXCLUDED = listOf('EN_EXCLUDED');
// App segments + the prerender-only Hindi sections (software, cooperative-software) — every page a visitor can
// reach in Hindi whose English address has no page.
export const EN_REDIRECT_SEGMENTS = [...new Set([...SEGMENTS, ...NOT_REWRITTEN])].filter((s) => !EN_SECTION_SEGMENTS.includes(s)).sort();
const enAlt = EN_REDIRECT_SEGMENTS.join('|');
const EN_REDIRECTS = [
  { source: `/en/:seg(${enAlt})`, destination: '/:seg', permanent: false },
  { source: `/en/:seg(${enAlt})/:path*`, destination: '/:seg/:path*', permanent: false },
  ...EN_EXCLUDED.flatMap((x) => [
    { source: `/en${x}`, destination: x, permanent: false },
    { source: `/en${x}/:path*`, destination: `${x}/:path*`, permanent: false },
  ]),
];
const isEnRedirect = (r) => typeof r.source === 'string' && r.source.startsWith('/en/') && r.permanent === false;

if (process.argv.includes('--write')) {
  vercel.rewrites = [...(vercel.rewrites || []).filter((r) => !isSpaRule(r)), ...RULES];
  vercel.redirects = [...(vercel.redirects || []).filter((r) => !isEnRedirect(r)), ...EN_REDIRECTS];
  writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
  console.log(`vercel.json: SPA rewrite for ${SEGMENTS.length} route segments; ${EN_REDIRECTS.length} /en redirects`);
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const rules = (vercel.rewrites || []).filter(isSpaRule);
const covered = new Set(rules.flatMap((r) => (r.source.match(/^\/\(([^)]+)\)/)?.[1] ?? '').split('|')).filter(Boolean));
const missing = SEGMENTS.filter((s) => !covered.has(s));
const extra = [...covered].filter((s) => !SEGMENTS.includes(s));
const FIX = 'run: node scripts/spa-rewrite.mjs --write';

ok(`every app route segment reaches the app (${SEGMENTS.length})`, missing.length === 0, `a hard reload of these would 404: ${missing.join(', ')} — ${FIX}`);
ok('no segment is rewritten that App.tsx does not route', extra.length === 0, `${extra.join(', ')} — ${FIX}`);
ok('both the exact and the sub-path rule exist', rules.some((r) => !r.source.includes(':path*')) && rules.some((r) => r.source.endsWith('/:path*')));
ok('no catch-all rewrite is left (an unknown path must be a real 404)', rules.every((r) => /^\/\([^)]+\)(\/:path\*)?$/.test(r.source)), rules.map((r) => r.source.slice(0, 40)).join(' ; '));
for (const s of [...NOT_REWRITTEN, 'api', 'assets']) ok(`/${s} is not rewritten to the app`, !covered.has(s));
for (const s of ['dashboard', 'login', 'register', 'reset-password', 'verify-email', 'vouchers', 'member']) ok(`/${s} reaches the app`, covered.has(s));
// SEO-01
const enR = (vercel.redirects || []).filter(isEnRedirect);
const enMatches = (path) => enR.some((r) => new RegExp('^' + r.source.replace(/:seg\(([^)]+)\)/, '($1)').replace('/:path*', '(/.*)?') + '$').test(path));
ok('/en is not rewritten to the app — an unknown /en/… is a real 404', !covered.has('en') && !enMatches('/en/zzz-none'));
ok('the /en redirects in vercel.json match the generated list', JSON.stringify(enR) === JSON.stringify(EN_REDIRECTS), FIX);
for (const s of ['dashboard', 'login', 'vouchers', 'member']) ok(`/en/${s} redirects to /${s}`, enMatches(`/en/${s}`) && enMatches(`/en/${s}/x`));
ok('the English twin sections were read from lib/enRoutes', EN_SECTION_SEGMENTS.includes('pricing') && EN_SECTION_SEGMENTS.includes('blog') && EN_EXCLUDED.includes('/guide/quiz'));
for (const s of EN_SECTION_SEGMENTS) ok(`/en/${s} is never redirected (it has English pages)`, !enMatches(`/en/${s}`) && !enMatches(`/en/${s}/x`) || EN_EXCLUDED.some((x) => x.startsWith(`/${s}/`)) && !enMatches(`/en/${s}`));
ok('/en/guide/quiz (Hindi-only) redirects to /guide/quiz', enMatches('/en/guide/quiz') && enMatches('/en/guide/quiz/3'));
ok('every /en redirect stays inside the 4096-character limit', enR.every((r) => r.source.length <= 4096), enR.map((r) => r.source.length).join(', '));
ok('each rule stays inside Vercel\'s 4096-character source limit', rules.every((r) => r.source.length <= 4096), rules.map((r) => r.source.length).join(', '));
const pre = readFileSync(resolve(ROOT, 'scripts/prerender-guide.mjs'), 'utf8');
ok('the build writes dist/404.html (what an unknown path is answered with)', pre.includes("file: '404.html'"));

console.log(`\nspa rewrite: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
