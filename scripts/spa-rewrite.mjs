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
export const NOT_REWRITTEN = ['blog'];

const paths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const seg = (p) => p.replace(/^\//, '').split('/')[0];
export const SEGMENTS = [...new Set(paths.map(seg))]
  .filter((s) => s && s !== '*' && !s.startsWith(':') && !NOT_REWRITTEN.includes(s))
  .sort();

const alt = SEGMENTS.join('|');
const DEST = '/index.html';
const RULES = [
  { source: `/(${alt})`, destination: DEST },
  { source: `/(${alt})/:path*`, destination: DEST },
];
const isSpaRule = (r) => r.destination === DEST;

if (process.argv.includes('--write')) {
  vercel.rewrites = [...(vercel.rewrites || []).filter((r) => !isSpaRule(r)), ...RULES];
  writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
  console.log(`vercel.json: SPA rewrite for ${SEGMENTS.length} route segments`);
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
for (const s of ['dashboard', 'login', 'register', 'reset-password', 'verify-email', 'vouchers', 'guide', 'glossary', 'member']) ok(`/${s} reaches the app`, covered.has(s));
ok('each rule stays inside Vercel\'s 4096-character source limit', rules.every((r) => r.source.length <= 4096), rules.map((r) => r.source.length).join(', '));
const pre = readFileSync(resolve(ROOT, 'scripts/prerender-guide.mjs'), 'utf8');
ok('the build writes dist/404.html (what an unknown path is answered with)', pre.includes("file: '404.html'"));

console.log(`\nspa rewrite: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
