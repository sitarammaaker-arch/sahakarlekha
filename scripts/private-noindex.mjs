#!/usr/bin/env node
// Private app routes → `X-Robots-Tag: noindex` in vercel.json, derived from src/App.tsx (one source).
//
// Every <Route> wrapped in ProtectedRoute / CapabilityGuard is private, plus the few private routes that
// authenticate themselves (EXTRA_PRIVATE). Their FIRST path segments become the two vercel.json header rules
// (`/(a|b|…)` and `/(a|b|…)/:path*`), so the server — not only the client-side <meta robots> that a logged-out
// crawler never reaches (it is redirected to /login) — tells search engines not to index them.
// Before this, only 27 of ~135 private routes carried the header (e.g. /gst-summary, /tds-register did not).
//
//   node scripts/private-noindex.mjs           check (CI: npm run test:private-noindex)
//   node scripts/private-noindex.mjs --write   rewrite the two rules in vercel.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const vercelPath = resolve(ROOT, 'vercel.json');
const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));

/** Private routes that are not behind ProtectedRoute because they authenticate on their own. */
export const EXTRA_PRIVATE = [
  'super-admin',     // platform admin (SuperAdminRoute)
  'member',          // member portal — per-society personal data, own auth client
  'sadasya',         // old member-portal URL (redirects to /member)
  'reset-password',  // password-reset token flow
];

const routes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^\n]*)/g)].map((m) => ({ path: m[1], el: m[2] }));
const seg = (p) => p.replace(/^\//, '').split('/')[0];
const protectedSegs = routes.filter((r) => /ProtectedRoute|CapabilityGuard/.test(r.el)).map((r) => seg(r.path));
export const PRIVATE = [...new Set([...protectedSegs, ...EXTRA_PRIVATE])].filter(Boolean).sort();
const publicSegs = [...new Set(routes.filter((r) => !/ProtectedRoute|CapabilityGuard/.test(r.el)).map((r) => seg(r.path)))]
  .filter((s) => s && s !== '*' && !EXTRA_PRIVATE.includes(s));

const alt = PRIVATE.join('|');
const RULES = [
  { source: `/(${alt})`, headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
  { source: `/(${alt})/:path*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
];
const isNoindexRule = (h) => h.headers?.some((x) => x.key === 'X-Robots-Tag');

if (process.argv.includes('--write')) {
  const kept = vercel.headers.filter((h) => !isNoindexRule(h));
  vercel.headers = [...kept, ...RULES];
  writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
  console.log(`vercel.json: noindex for ${PRIVATE.length} private route segments`);
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const rules = vercel.headers.filter(isNoindexRule);
const covered = new Set(rules.flatMap((h) => (h.source.match(/^\/\(([^)]+)\)/)?.[1] ?? '').split('|')).filter(Boolean));
const missing = PRIVATE.filter((s) => !covered.has(s));
ok(`every private route segment carries X-Robots-Tag: noindex (${PRIVATE.length})`, missing.length === 0, `missing: ${missing.join(', ')} — run: node scripts/private-noindex.mjs --write`);
ok('both exact and sub-path rules exist', rules.some((h) => !h.source.includes(':path*')) && rules.some((h) => h.source.endsWith('/:path*')));
const leaked = publicSegs.filter((s) => covered.has(s));
ok('no PUBLIC route is noindexed (guide, blog, help, glossary, tools, …)', leaked.length === 0, `public but noindexed: ${leaked.join(', ')}`);
for (const pub of ['blog', 'guide', 'glossary', 'tools', 'help', 'cookbook', 'pricing', 'faq', 'software', 'downloads']) {
  ok(`/${pub} stays indexable`, !covered.has(pub));
}
const robotsTxt = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8');
ok('robots.txt does not Disallow a public section', !/Disallow:\s*\/(blog|guide|glossary|tools|help|cookbook|downloads)\b/.test(robotsTxt));
console.log(`\nprivate noindex: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
