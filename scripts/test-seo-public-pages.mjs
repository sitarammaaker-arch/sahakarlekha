// SEO-03 / SEO-04 (product audit 2026-11-17):
//  SEO-03 — /register (the most-linked URL), /partner, /search and /ask had no static HTML, so a crawler without
//           JavaScript got the HOMEPAGE (its title, canonical "/"). Now each is prerendered with its own head + body
//           from src/content/publicShellMeta.ts, which the pages read too (/search is noindex).
//  SEO-04 — Privacy and Terms were ~100-word stubs; the binding text lived only in the React page. The section text
//           moved to src/content/legal/*Sections.tsx (the pages render it) and the prerender writes it as HTML.
// Run: node scripts/test-seo-public-pages.mjs        (the dist/ checks run only when a full `npm run build` exists)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. the legal HTML renderer, bundled the way the prerender bundles it ──
const out = join(tmpdir(), `legal-${process.pid}.mjs`);
await build({ entryPoints: [join(ROOT, 'src/content/legal/legalHtml.tsx')], bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': join(ROOT, 'src') }, jsx: 'automatic', logLevel: 'silent' });
const L = await import(pathToFileURL(out).href);
{
  const { createElement: h } = await import('react');
  ok(L.nodeToHtml(h('p', { className: 'x' }, 'a < b & ', h('strong', null, 'c'))) === '<p>a &lt; b &amp; <strong>c</strong></p>', 'JSX → HTML: text escaped, classes dropped, tags kept');
  ok(L.nodeToHtml(h('a', { href: 'mailto:privacy@sahakarlekha.com' }, 'mail')) === '<a href="mailto:privacy@sahakarlekha.com">mail</a>' && L.nodeToHtml(h('a', { href: 'javascript:alert(1)' }, 'x')) === '<a>x</a>', 'only safe hrefs survive (mailto / http / site paths; never javascript:)');
  ok(L.nodeToHtml(h('script', null, 'evil')) === 'evil' && L.nodeToHtml([h('li', null, '1'), null, false, 2]) === '<li>1</li>2', 'unknown tags render text only; arrays, null and booleans handled');
  for (const which of ['privacy', 'terms']) for (const lang of ['hi', 'en']) {
    const html = L.legalHtml(which, lang);
    const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    ok((html.match(/<h2>\d+\. /g) || []).length >= 10 && words > 400, `${which} (${lang}): every numbered section as HTML (${words} words — was ~100)`);
  }
  ok(L.legalHtml('privacy', 'hi').includes('डेटा संग्रहण') && L.legalHtml('privacy', 'en').includes('Data We Collect'), 'Hindi and English bodies are the matching sections');
}

// ── 2. one source for the page and the static HTML ──
{
  ok(read('src/pages/PrivacyPolicy.tsx').includes("import { SECTIONS } from '@/content/legal/privacySections';") && !read('src/pages/PrivacyPolicy.tsx').includes('const SECTIONS = ['), 'the Privacy page renders the shared sections');
  ok(read('src/pages/TermsConditions.tsx').includes("import { SECTIONS } from '@/content/legal/termsSections';") && !read('src/pages/TermsConditions.tsx').includes('const SECTIONS = ['), 'the Terms page renders the shared sections');
  ok(!/from '@\/content\/legal\/legalHtml'/.test(read('src/pages/PrivacyPolicy.tsx') + read('src/pages/TermsConditions.tsx')), 'the build-time renderer is never imported by the app');
  const pre = read('scripts/prerender-guide.mjs');
  ok(pre.includes("['legal', LEGAL_HTML_FILE, null]") && pre.includes("legalBody(DATA, 'privacy', 'hi')") && pre.includes("legalBody(DATA, 'terms', 'en')"), 'the prerender writes the full text for Hindi and English Privacy / Terms');
  ok(pre.includes("['shellMeta', PUBLIC_SHELL_META_FILE, 'PUBLIC_SHELL_META']") && pre.includes("{ ...page('/search', M.search.hi.title, M.search.hi.description, M.search.hi.h1, hub), noindex: true }"), 'register / partner / ask / search are prerendered; search is noindex');
  ok(read('src/pages/Register.tsx').includes("useDocumentMeta({ title: L(meta.hi.title, meta.en.title), description: L(meta.hi.description, meta.en.description), canonicalPath: '/register' });"), '/register sets its own title / canonical (it showed the homepage\'s)');
  for (const f of ['PartnerProgram', 'SiteSearch', 'AskAssistant']) ok(read(`src/pages/${f}.tsx`).includes("from '@/content/publicShellMeta'"), `${f} reads its meta from the shared module`);
  const meta = read('src/content/publicShellMeta.ts');
  ok(meta.includes("import { PLAN_CATALOG, TRIAL_DAYS, priceLabel } from '@/lib/plans';") && !/₹\s?\d/.test(meta), 'register figures come from lib/plans (no price typed by hand)');
}

// ── 3. the built pages (skipped without a full build) ──
const dist = (p) => join(ROOT, 'dist', p, 'index.html');
if (existsSync(dist('register')) && existsSync(dist('privacy'))) {
  const page = (p) => readFileSync(dist(p), 'utf8');
  const title = (h) => (h.match(/<title>([^<]*)/) || [])[1] || '';
  const canon = (h) => (h.match(/rel="canonical" href="([^"]*)"/) || [])[1] || '';
  for (const p of ['register', 'partner', 'ask', 'search']) {
    const h = page(p);
    ok(canon(h) === `https://sahakarlekha.com/${p}` && title(h) !== title(readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8')), `dist/${p}: its own title and canonical (not the homepage's)`);
  }
  ok(/<meta name="robots" content="noindex, follow"/.test(page('search')) && /<meta name="robots" content="index, follow"/.test(page('register')), 'search is noindex; register is indexable');
  ok(page('privacy').includes('डेटा संग्रहण') && page('en/privacy').includes('Data We Collect') && page('terms').includes('<h2>1. '), 'the built Privacy / Terms carry the real sections');
} else {
  console.log('  (dist/ checks skipped — run `npm run build` first)');
}

console.log(`SEO public pages (SEO-03/04): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
