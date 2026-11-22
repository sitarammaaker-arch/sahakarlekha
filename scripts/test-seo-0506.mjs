// SEO-05 / SEO-06 (product audit 2026-11-17): no orphan pages in static HTML, and fewer thin ones.
// Measured on dist/ 2026-11-22: 12 indexable pages had NO inbound static link (10 part quizzes, /ask, /partner — the
// sitemap was their only way in) and 43 had under 150 words. Fixed here: the /guide hub links every quiz, each quiz
// links the previous / next one and lists its questions WITH their options, blog category hubs show each post's
// description, and the footer links /partner and /ask. What stays short is short by nature (register, contact, the
// certificate / verify utilities, reference tables) — padding them would be worse.
// Source checks always run; the dist checks run when dist/ is built (npm run build).
// Run: node scripts/test-seo-0506.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── source ──
const pre = read('scripts/prerender-guide.mjs');
ok(pre.includes('<h2>भाग-वार क्विज़</h2>') && pre.includes('href="/guide/quiz/${q.partId}"'), '/guide hub links every part quiz');
ok(pre.includes('x.options.map((o) => `<li>${esc(o)}</li>`)') && pre.includes('quizList[i - 1], next = quizList[i + 1]'), 'quiz pages list each question with its options and link the previous / next quiz');
ok(!/x\.answer|x\.explain/.test(pre.slice(pre.indexOf('const quizList'), pre.indexOf('const quizList') + 1500)), 'the static quiz page never prints the answer or its explanation (the app keeps them)');
ok(pre.includes("postLi(p).replace(/<\\/li>$/, p.description ? `<br>${esc(p.description)}</li>` : '</li>')"), 'Hindi blog category hubs show each post\'s description');
ok(pre.includes("blogEn(DATA, p.slug).excerpt ? `<br>${esc(blogEn(DATA, p.slug).excerpt)}` : ''"), 'English category twins show each post\'s excerpt');
ok(pre.includes("['/partner', 'पार्टनर बनें'], ['/ask', 'सवाल पूछें']") && pre.includes("['/partner', 'Become a partner'], ['/ask', 'Ask a question']"), 'static footer (Hindi + English) links /partner and /ask');
const layout = read('src/components/PublicLayout.tsx');
ok(layout.includes("{ to: '/partner', hi: 'पार्टनर बनें', en: 'Become a Partner' }") && layout.includes('<Link to="/ask"'), 'the live React footer links /partner and /ask too (static == live)');

// ── dist (when built) ──
const DIST = join(ROOT, 'dist');
if (existsSync(join(DIST, 'guide', 'index.html'))) {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'assets') walk(p); } else if (n.endsWith('.html')) files.push(p); } };
  walk(DIST);
  const urlOf = (f) => ('/' + relative(DIST, f).replace(/\\/g, '/')).replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
  const pages = files.map((f) => { const html = readFileSync(f, 'utf8'); return { url: urlOf(f), html, noindex: /<meta name="robots" content="[^"]*noindex/i.test(html) }; });
  const inbound = new Set();
  for (const p of pages) for (const m of p.html.matchAll(/href="(\/[^"#?]*)"/g)) { const t = m[1].replace(/\/$/, '') || '/'; if (t !== p.url) inbound.add(t); }
  const orphans = pages.filter((p) => !p.noindex && p.url !== '/' && !p.url.startsWith('/404') && !inbound.has(p.url)).map((p) => p.url);
  ok(orphans.length === 0, `no indexable static page is an orphan (${orphans.join(', ')})`);
  const quiz = pages.filter((p) => /^\/guide\/quiz\/part-\d+$/.test(p.url));
  ok(quiz.length >= 10 && quiz.every((p) => /<ol><li>[^<]+<ul><li>/.test(p.html)), `every quiz page lists options (${quiz.length} pages)`);
  ok(pages.find((p) => p.url === '/guide').html.includes('href="/guide/quiz/part-1"'), 'built /guide links the quizzes');
} else {
  console.log('  (dist/ not built — dist checks skipped)');
}

console.log(`SEO-05/06 orphans + thin: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
