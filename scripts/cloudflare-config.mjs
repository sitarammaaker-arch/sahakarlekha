#!/usr/bin/env node
// Cloudflare hosting (2026-11-21) — the Cloudflare config is DERIVED from vercel.json, so there is one source of
// routing truth and every existing test of vercel.json (spa-rewrite, english-routes, g2-g8 …) still guards it.
//
//   cloudflare/routes.generated.json  ← redirects + SPA rewrites + header rules, read by cloudflare/worker.js
//   dist/_headers                      ← the same header rules for STATIC files (served without the Worker)
//
// Cloudflare serves a request from dist/ when a file matches (html_handling: drop-trailing-slash, so /about is
// dist/about/index.html and /about/ redirects to /about — Vercel's trailingSlash:false). Only when no file matches
// does the Worker run: redirects → SPA shell for real app routes → otherwise dist/404.html with status 404.
//
//   node scripts/cloudflare-config.mjs            check (CI: npm run test:cloudflare-config)
//   node scripts/cloudflare-config.mjs --write    regenerate routes.generated.json (+ dist/_headers when dist exists)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
const OUT = resolve(ROOT, 'cloudflare/routes.generated.json');

/** Vercel path pattern → a RegExp source the Worker can run (anchored). Supports what vercel.json uses:
 *  literal paths, `/(a|b|…)` groups, `(.*)`, `:name(regex)` and `:path*`. */
export function toRegexSource(source) {
  let out = '';
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    let m;
    if ((m = rest.match(/^\/:([A-Za-z_]\w*)\*/))) { out += `(?<${m[1]}>(?:/.*)?)`; i += m[0].length; continue; }       // /:path*
    if ((m = rest.match(/^:([A-Za-z_]\w*)\(([^)]*)\)/))) { out += `(?<${m[1]}>${m[2]})`; i += m[0].length; continue; }   // :seg(a|b)
    if ((m = rest.match(/^:([A-Za-z_]\w*)/))) { out += `(?<${m[1]}>[^/]+)`; i += m[0].length; continue; }               // :slug
    if ((m = rest.match(/^\(([^)]*)\)/))) { out += `(${m[1]})`; i += m[0].length; continue; }                            // (a|b) / (.*)
    out += rest[0].replace(/[.+?^${}[\]\\|]/g, '\\$&');
    i += 1;
  }
  return `^${out}$`;
}

const redirects = (vercel.redirects || []).map((r) => ({
  re: toRegexSource(r.source), to: r.destination, status: r.permanent === false ? 307 : 308,
}));
const spa = (vercel.rewrites || []).filter((r) => r.destination === '/index.html').map((r) => toRegexSource(r.source));
const headers = (vercel.headers || []).map((h) => ({ re: toRegexSource(h.source), set: Object.fromEntries(h.headers.map((x) => [x.key, x.value])) }));
const generated = { note: 'GENERATED from vercel.json by scripts/cloudflare-config.mjs — do not edit by hand', redirects, spa, headers };

/** dist/_headers — Cloudflare's static-file header file. Only rules expressible there: /assets/* and /*. */
export function headersFile() {
  const lines = [];
  for (const h of vercel.headers || []) {
    const path = h.source === '/(.*)' ? '/*' : h.source === '/assets/(.*)' ? '/assets/*' : null;
    if (!path) continue;   // route-list rules (X-Robots-Tag on app pages) apply to the SPA shell — set by the Worker
    lines.push(path, ...h.headers.map((x) => `  ${x.key}: ${x.value}`), '');
  }
  return lines.join('\n');
}

if (process.argv.includes('--write')) {
  writeFileSync(OUT, JSON.stringify(generated, null, 2) + '\n');
  const dist = resolve(ROOT, 'dist');
  if (existsSync(dist)) writeFileSync(resolve(dist, '_headers'), headersFile());
  console.log(`cloudflare: ${redirects.length} redirects, ${spa.length} SPA rules, ${headers.length} header rules${existsSync(dist) ? ' + dist/_headers' : ''}`);
  process.exit(0);
}

// ── check ──
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const committed = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
ok('cloudflare/routes.generated.json matches vercel.json', JSON.stringify(committed) === JSON.stringify(generated), 'run: node scripts/cloudflare-config.mjs --write');
const R = (src) => new RegExp(src);
const redirectFor = (p) => redirects.find((r) => R(r.re).test(p));
const isSpa = (p) => spa.some((s) => R(s).test(p));
ok('/dashboard and /members/123 are app routes (SPA shell)', isSpa('/dashboard') && isSpa('/members/123'));
ok('/zzz-none and /en/zzz-none are not app routes (real 404)', !isSpa('/zzz-none') && !isSpa('/en/zzz-none') && !redirectFor('/en/zzz-none'));
const g = redirectFor('/guide/adhyay-1');
ok('/guide/adhyay-1 → /guide/accounting-foundations (308)', g && g.to === '/guide/accounting-foundations' && g.status === 308);
const en = redirectFor('/en/dashboard/x');
ok('/en/dashboard/x → 307 to /:seg/:path* (Hindi app page)', en && en.status === 307 && en.to === '/:seg/:path*' && R(en.re).exec('/en/dashboard/x').groups.seg === 'dashboard');
ok('/en/pricing is never redirected (English file)', !redirectFor('/en/pricing'));
const sec = headers.find((h) => h.re === '^/(.*)$');
ok('security headers (HSTS, nosniff, frame, referrer, permissions) carried over', sec && ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy'].every((k) => k in sec.set));
ok('app routes carry X-Robots-Tag: noindex in the Worker rules', headers.some((h) => h.set['X-Robots-Tag'] === 'noindex' && R(h.re).test('/dashboard')));
const hf = headersFile();
ok('dist/_headers covers /* (security) and /assets/* (immutable cache)', hf.includes('/*\n  Strict-Transport-Security:') && hf.includes('/assets/*\n  Cache-Control: public, max-age=31536000, immutable'));
const wr = readFileSync(resolve(ROOT, 'wrangler.jsonc'), 'utf8');
ok('wrangler: a browser navigation still reaches the Worker (assets_navigation_has_no_effect) — else /login is a 404 in a real browser', wr.includes('"compatibility_flags": ["assets_navigation_has_no_effect"]'));
ok('wrangler: dist/ assets, drop-trailing-slash, 404 page, Worker only when no file matches', wr.includes('"directory": "./dist"') && wr.includes('"html_handling": "drop-trailing-slash"') && wr.includes('"not_found_handling": "404-page"') && wr.includes('"main": "cloudflare/worker.js"'));
console.log(`\ncloudflare config: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
