// SEO-13 (product audit 2026-11-17): the public entry must not modulepreload code the public pages do not use.
// Part 1: Radix was one manual chunk (45 KB gzip) on every page's entry path because the root renders a toast and a
// tooltip provider; removing the group lets Rollup give each page only the primitives it imports (entry 226 → 201 KB).
// Part 2: supabase-js (51 KB) left the entry — AuthProvider, error reporting and the public widgets (testimonials,
// rating, helpful, e-mail capture, blog views) take the client through lib/supabaseLazy (entry 201 → 151 KB;
// landing / blog / guide / glossary / help −50 KB each). test:auth-lazy-client drives the auth flows.
// Source checks always; the dist checks run when dist/ is built.
// Run: node scripts/test-seo13-entry.mjs
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
ok(!/return "radix"/.test(cfg), 'vite.config.ts has no "radix" manual chunk (one 45 KB blob on every page)');
ok(/return "icons"/.test(cfg) && /return "react"/.test(cfg) && /return "pdf"/.test(cfg), 'the other vendor groups stay (react, icons, pdf …)');

// the entry and the busiest public pages reach no static @/lib/supabase (they load it only when it is used)
const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
const res = (spec, from) => {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = join(dirname(from), spec);
  else return null;
  for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx', base]) if (existsSync(c) && /\.(ts|tsx)$/.test(c)) return c;
  return null;
};
const reachesSupabase = (start) => {
  const seen = new Set();
  const stack = [join(SRC, start)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(IMPORT_RE)) { const r = res(m[1], f); if (r) stack.push(r); }
  }
  return seen.has(join(SRC, 'lib', 'supabase.ts'));
};
for (const p of ['main.tsx', 'pages/LandingPage.tsx', 'pages/BlogPost.tsx', 'pages/GuideChapter.tsx', 'pages/GlossaryTerm.tsx', 'pages/HelpArticle.tsx', 'pages/Pricing.tsx']) {
  ok(!reachesSupabase(p), `${p} does not statically import @/lib/supabase`);
}

const html = join(ROOT, 'dist', 'index.html');
if (existsSync(html)) {
  const entry = [...readFileSync(html, 'utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  ok(entry.length > 0 && !entry.some((f) => /\/radix-/.test(f)), `the entry preloads no radix chunk (${entry.map((f) => f.split('/').pop()).join(', ')})`);
  ok(!entry.some((f) => /\/supabase-/.test(f)), 'the entry preloads no supabase chunk');
  const total = entry.reduce((s, f) => s + gzipSync(readFileSync(join(ROOT, 'dist', f))).length, 0);
  ok(total < 165_000, `public entry JS ≤ 165 KB gzip (now ${Math.round(total / 1024)} KB; was 221 KB with radix + supabase)`);
} else {
  console.log('  (dist/ not built — dist checks skipped)');
}

console.log(`SEO-13 public entry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
