#!/usr/bin/env node
// Every calculator links onward to all four learning/doing surfaces, and each link resolves:
//   guide chapter (scripts/guide-manifest.json) · article (published blog post) · glossary (active KI file)
//   · product module (a route in src/App.tsx) — plus help tasks when given. No email gate on calculator use.
// Source of the topic roles: docs/seo/TOPIC-LINK-MAP.md.
//
// Run: node scripts/test-calculator-links.mjs   (npm run test:calculator-links)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const { CALCULATORS } = await loadViteModule(ROOT, resolve(ROOT, 'src/content/calculators/index.ts'), 'eval');

const guide = new Set(JSON.parse(rd('scripts/guide-manifest.json')).map((e) => e.slug));
const glossary = new Set(readdirSync(resolve(ROOT, 'docs/kpp/wave-1-active')).filter((f) => /^KI-\d+/.test(f)).map((f) => f.replace(/^KI-\d+-/, '').replace(/\.md$/, '')));
const today = new Date().toISOString().slice(0, 10);
const blog = new Map(rd('src/content/blog/index.ts').split(/\r?\n  \{\r?\n/).slice(1)
  .map((c) => [(c.match(/slug: '([^']+)'/) || [])[1], (c.match(/\bdate: '([^']+)'/) || [])[1]]).filter(([s]) => s));
const routes = new Set([...rd('src/App.tsx').matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
const help = new Set([...rd('src/content/help/index.ts').matchAll(/^    slug: '([^']+)'/gm)].map((m) => m[1]));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };

ok('10+ calculators loaded', CALCULATORS.length >= 10, String(CALCULATORS.length));
for (const c of CALCULATORS) {
  const g = c.relatedGuide || [], a = c.relatedArticles || [], gl = c.relatedGlossary || [], m = c.relatedModules || [], h = c.relatedHelp || [];
  ok(`${c.slug}: links a guide chapter that exists`, g.length > 0 && g.every((x) => guide.has(x.slug)), g.map((x) => x.slug).join(','));
  ok(`${c.slug}: links a PUBLISHED article`, a.length > 0 && a.some((x) => blog.has(x.slug) && blog.get(x.slug) <= today), a.map((x) => x.slug).join(','));
  ok(`${c.slug}: every article slug exists`, a.every((x) => blog.has(x.slug)));
  ok(`${c.slug}: links an active glossary term (all exist)`, gl.length > 0 && gl.every((s) => glossary.has(s)), gl.filter((s) => !glossary.has(s)).join(','));
  ok(`${c.slug}: links a product module that is a real route`, m.length > 0 && m.every((x) => routes.has(x.route)), m.map((x) => x.route).join(','));
  ok(`${c.slug}: help slugs (if any) exist`, h.every((x) => help.has(x.slug)), h.map((x) => x.slug).join(','));
}
const shell = rd('src/components/calculators/CalculatorShell.tsx');
ok('CalculatorShell renders the guide links', /config\.relatedGuide\.map/.test(shell) && /to=\{`\/guide\/\$\{g\.slug\}`\}/.test(shell));
ok('no email gate: CalculatorShell has no email input / lead form', !/type=["']email["']/.test(shell) && !/email/i.test(shell));
const pre = rd('scripts/prerender-guide.mjs');
ok('prerendered calculator body links guide + help', /गाइड में सीखें/.test(pre) && /ऐप में कैसे करें/.test(pre));

console.log(`\ncalculator links: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
