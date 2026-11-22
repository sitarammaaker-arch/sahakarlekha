// SEO-13 (product audit 2026-11-17): the public entry must not modulepreload code the public pages do not use.
// Radix was one manual chunk (45 KB gzip) on every page's entry path because the root renders a toast and a tooltip
// provider; removing the group lets Rollup give each page only the primitives it imports (measured 2026-11-22:
// entry 226 → 201 KB gzip). supabase-js (51 KB) is still on the entry — AuthProvider imports it at the root; moving it
// behind a dynamic import touches login / MFA and is its own change.
// Source check always; the dist check runs when dist/ is built.
// Run: node scripts/test-seo13-entry.mjs
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
ok(!/return "radix"/.test(cfg), 'vite.config.ts has no "radix" manual chunk (one 45 KB blob on every page)');
ok(/return "icons"/.test(cfg) && /return "react"/.test(cfg) && /return "pdf"/.test(cfg), 'the other vendor groups stay (react, icons, pdf …)');

const html = join(ROOT, 'dist', 'index.html');
if (existsSync(html)) {
  const entry = [...readFileSync(html, 'utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  ok(entry.length > 0 && !entry.some((f) => /\/radix-/.test(f)), `the entry preloads no radix chunk (${entry.map((f) => f.split('/').pop()).join(', ')})`);
  const total = entry.reduce((s, f) => s + gzipSync(readFileSync(join(ROOT, 'dist', f))).length, 0);
  ok(total < 215_000, `public entry JS ≤ 215 KB gzip (now ${Math.round(total / 1024)} KB; was 221 KB with the radix group)`);
} else {
  console.log('  (dist/ not built — dist checks skipped)');
}

console.log(`SEO-13 public entry: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
