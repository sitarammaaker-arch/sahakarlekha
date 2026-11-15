// English URL space (founder 2026-11-15, batch E: "the URL decides the language").
// /en/<path> is the English twin of every public page in EN_SECTIONS; the Hindi page stays at its address and is
// x-default. Pins the pure rules (src/lib/enRoutes.ts) and the wiring that depends on them.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const R = await import(new URL('../src/lib/enRoutes.ts', import.meta.url).href);

// ── pure rules ──
ok(R.isEnPath('/en') && R.isEnPath('/en/') && R.isEnPath('/en/help/x'), 'isEnPath: /en, /en/, /en/…');
ok(!R.isEnPath('/english') && !R.isEnPath('/help/en') && !R.isEnPath('/'), 'isEnPath: no false positives');
eq(R.stripEn('/en'), '/', 'stripEn(/en)');
eq(R.stripEn('/en/help/add-member'), '/help/add-member', 'stripEn(/en/help/…)');
eq(R.stripEn('/help'), '/help', 'stripEn leaves Hindi paths');
for (const p of ['/', '/pricing', '/about', '/contact', '/faq', '/privacy', '/terms', '/guide', '/guide/introduction', '/help/add-member', '/cookbook/cash-sale', '/tools/depreciation-calculator',
  // batch E2 — blog, categories, author, editorial policy, glossary
  '/blog', '/blog/x', '/blog/category/accounting-basics', '/author/sitaram', '/editorial-policy', '/glossary', '/glossary/asset'])
  ok(R.hasEnglishRoute(p), `has an English twin: ${p}`);
// E2 left these out on purpose: their English page would still be largely Hindi (society-type cards and challenge
// lists, state details, download-format notes exist only in Hindi) — see the note in src/lib/enRoutes.ts.
for (const p of ['/dashboard', '/login', '/register', '/vouchers', '/pricingx', '/helpful', '/guide/quiz/1', '/guide/quiz', '/blogs', '/glossaryx',
  '/software', '/software/pacs', '/cooperative-software/haryana', '/downloads'])
  ok(!R.hasEnglishRoute(p), `no English twin (yet): ${p}`);
eq(R.toEn('/'), '/en', 'toEn(/)');
eq(R.toEn('/help/x?q=1#a'), '/en/help/x?q=1#a', 'toEn keeps query + hash');
eq(R.toEn('/en/help'), '/en/help', 'toEn is idempotent');
eq(R.localizePath('/help/x', 'en'), '/en/help/x', 'English page → English twin');
eq(R.localizePath('/dashboard', 'en'), '/dashboard', 'English page → app route unchanged');
eq(R.localizePath('/register?next=/x', 'en'), '/register?next=/x', 'register stays');
eq(R.localizePath('/en/help/x', 'hi'), '/help/x', 'Hindi page → strips a stray /en');
eq(R.localizePath('/help/x', 'hi'), '/help/x', 'Hindi page → unchanged');
eq(R.localizePath('https://x.com/help', 'en'), 'https://x.com/help', 'external unchanged');
eq(R.localizePath('#faq', 'en'), '#faq', 'anchor unchanged');
eq(R.routeLanguage('/en/help/x'), 'en', 'URL fixes English on /en twin');
eq(R.routeLanguage('/help/x'), 'hi', 'URL fixes Hindi on the Hindi twin');
eq(R.routeLanguage('/dashboard'), null, 'app routes: URL does not decide');
eq(R.routeLanguage('/blog/x'), 'hi', 'blog post: the URL fixes Hindi (E2)');
eq(R.routeLanguage('/en/blog/x'), 'en', 'blog post twin: the URL fixes English (E2)');
eq(R.routeLanguage('/software/pacs'), null, 'no twin yet: URL does not decide');
eq(R.routeLanguage('/en/dashboard'), null, '/en + no twin: does not decide (router redirects)');
eq(R.hreflangAlternates('/help/x', 'https://s.com'), { hi: 'https://s.com/help/x', en: 'https://s.com/en/help/x', xDefault: 'https://s.com/help/x' }, 'hreflang trio, x-default = Hindi');
eq(R.hreflangAlternates('/', 'https://s.com'), { hi: 'https://s.com/', en: 'https://s.com/en', xDefault: 'https://s.com/' }, 'hreflang for home');
eq(R.hreflangAlternates('/downloads', 'https://s.com'), null, 'no hreflang without a twin');
eq(R.hreflangAlternates('/glossary/asset', 'https://s.com'), { hi: 'https://s.com/glossary/asset', en: 'https://s.com/en/glossary/asset', xDefault: 'https://s.com/glossary/asset' }, 'hreflang for a glossary term (E2)');

// ── wiring ──
const app = read('src/App.tsx');
ok(/<Routes location=\{en \? \{ \.\.\.location, pathname: innerPath \} : location\}>/.test(app), 'App matches /en/<path> on <path>');
ok(/if \(en && !hasEnglishRoute\(innerPath\)\) return <Navigate/.test(app), 'App sends an /en address without a twin to the Hindi address');
ok(/setRouteLanguage\(routeLanguage\(pathname\)\)/.test(app), 'App tells LanguageProvider what the URL fixes');
const lc = read('src/contexts/LanguageContext.tsx');
ok(/const language: Language = routeLang \?\? preference;/.test(lc), 'shown language = URL language, else the saved choice');
ok(/routeLanguage\(window\.location\.pathname\)/.test(lc), 'URL language read at start-up (no Hindi flash on a prerendered /en page)');
const sw = read('src/lib/useSwitchLanguage.ts');
ok(/window\.location/.test(sw) && /navigate\(target/.test(sw), 'switch moves between twins using the real address');
for (const f of ['src/components/PublicLayout.tsx', 'src/components/HindiOnlyNotice.tsx', 'src/lib/guideLang.ts'])
  ok(read(f).includes('useSwitchLanguage'), `${f} switches through useSwitchLanguage`);
const meta = read('src/lib/useDocumentMeta.ts');
ok(/hreflangAlternates\(canonicalPath, SITE\)/.test(meta) && /toEn\(canonicalPath\)/.test(meta), 'useDocumentMeta: self canonical on /en + hreflang trio');
const rr = read('scripts/spa-rewrite.mjs');
ok(/EXTRA_SEGMENTS = \['en'\]/.test(rr), '/en/* reaches the app on a hard reload (SPA rewrite)');

// E2 pages: the schema follows the twin (English names, inLanguage 'en', /en/… URLs) and a not-found redirect stays in
// the page's language; the prerender builds the English blog/author/policy/glossary twins from the same modules.
const bp = read('src/pages/BlogPost.tsx');
ok(/inLanguage: onEn \? 'en' : 'hi'/.test(bp) && /twin\('\/blog'\)/.test(bp), 'BlogPost: BlogPosting/breadcrumb follow the twin');
ok(/staticSnapshotFor\(window\.location\.pathname\)/.test(bp), 'BlogPost: keeps the prerendered article on /en/blog/<slug> while the body loads');
for (const f of ['src/pages/BlogPost.tsx', 'src/pages/GlossaryTerm.tsx', 'src/pages/AuthorProfile.tsx'])
  ok(/<Navigate to=\{localizePath\(/.test(read(f)), `${f}: not-found redirect stays in the page's language`);
ok(/inLanguage: L\('hi', 'en'\)/.test(read('src/pages/BlogIndex.tsx')) && /inLanguage: L\('hi', 'en'\)/.test(read('src/pages/BlogCategory.tsx')) && /inLanguage: L\('hi', 'en'\)/.test(read('src/pages/Glossary.tsx')), 'blog index / category / glossary hub: inLanguage follows the twin');
ok(/inLanguage: en \? 'en' : 'hi'/.test(read('src/pages/GlossaryTerm.tsx')) && /glossaryTitleEn\(/.test(read('src/pages/GlossaryTerm.tsx')), 'GlossaryTerm: English title + inLanguage on the twin');
const pre = read('scripts/prerender-guide.mjs');
for (const fn of ['blogIndexEn', 'blogCategoryEn', 'blogPostEn', 'blogScheduledEn', 'authorEn', 'editorialPolicyEn', 'glossaryHubEn', 'glossaryTermEn'])
  ok(pre.includes(`function ${fn}(`), `prerender builds the English twin: ${fn}`);
ok(/hp\._scheduled && hp\.path && R\.hasEnglishRoute/.test(pre), 'a scheduled post gets only a noindex English stub (no hreflang, no sitemap) until its date');

// every react-router Link import goes through LocalLink (links follow the page language)
const { readdirSync, statSync } = await import('node:fs');
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = resolve(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.tsx')) files.push(p); } })(resolve(ROOT, 'src'));
const raw = files.filter((f) => !f.endsWith('LocalLink.tsx') && /import \{[^}]*\bLink\b[^}]*\} from ['"]react-router-dom['"]/.test(readFileSync(f, 'utf8')));
ok(raw.length === 0, `Link must come from @/components/LocalLink: ${raw.map((f) => f.replace(ROOT, '')).join(', ')}`);

console.log(`[english-routes] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
