#!/usr/bin/env node
// Audit 2026-11-16, Sprint 3 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md) — guards for:
//   C-1 / J-20  one wording for the main call to action, with the trial length taken from lib/plans
//   J-5b        the software is never called "free" — it has a free TRIAL (the calculators are free)
//   J-9         Login is in the header on a phone (from 360px), not only inside the drawer
//   J-17        no button promises a "demo" that does not exist
//   J-18 / C-6  a button that names an app screen says, to a signed-out visitor, what it really does
// Run: node scripts/test-public-cta.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { TRIAL_DAYS } = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/plans.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

const HI = `${TRIAL_DAYS} दिन मुफ़्त आज़माएँ`;
const EN = `Start ${TRIAL_DAYS}-day free trial`;

console.log('The label');
const cta = read('src/lib/cta.ts');
ok('TRIAL_CTA is built from TRIAL_DAYS (it cannot drift from the pricing or Register page)',
  /hi: `\$\{TRIAL_DAYS\} दिन मुफ़्त आज़माएँ`/.test(cta) && /en: `Start \$\{TRIAL_DAYS\}-day free trial`/.test(cta) && /import \{ TRIAL_DAYS \} from '\.\/plans';/.test(cta));
const guide = read('src/content/guide/i18n.ts');
ok('the guide hub string (a literal — that file has no imports) says the same', guide.includes(`'hub.cta.start': { hi: '${HI}', en: '${EN}' }`));
const pre = read('scripts/prerender-guide.mjs');
ok('the prerendered home page (what is on screen before the app loads) says the same, in both languages',
  pre.includes(`<a class="sl-btn" href="/register">${HI} →</a>`) && pre.includes(`<a class="sl-btn" href="/register">${EN} →</a>`));

console.log('Pages that use it');
const USES = [
  'src/pages/LandingPage.tsx', 'src/pages/Pricing.tsx', 'src/pages/SoftwareLanding.tsx', 'src/pages/StateLanding.tsx',
  'src/pages/BlogIndex.tsx', 'src/pages/BlogPost.tsx', 'src/pages/GlossaryTerm.tsx', 'src/pages/UserGuide.tsx', 'src/pages/FAQ.tsx',
  'src/pages/CalculatorHub.tsx', 'src/components/calculators/CalculatorShell.tsx', 'src/components/PublicLayout.tsx',
];
for (const f of USES) ok(`${f} takes the label from lib/cta`, /from '@\/lib\/cta'/.test(read(f)) && /TRIAL_CTA/.test(read(f)));
ok('Pricing no longer keeps its own copy of the label', !/const TRIAL_CTA/.test(read('src/pages/Pricing.tsx')));
const landing = read('src/pages/LandingPage.tsx');
ok('the landing page has a register button in the hero, after the demo and at the end (3)', (landing.match(/<Link to="\/register"/g) || []).length === 3 && /location: 'landing_demo'/.test(landing));

console.log('Old wordings for the same button are gone from the public pages');
const OLD = [/L\('शुरू करें', 'Get [Ss]tarted'\)/, /L\('रजिस्टर करें', '(Register|Get Started)'\)/, /L\('पंजीकरण', 'Register'\)/, /मुफ्त रजिस्टर करें/, /Register free/, /अभी शुरू करें · Get Started/];
for (const f of USES) ok(`${f}: no older label`, !OLD.some((re) => re.test(read(f))));

console.log('"Free" is said only of what is free');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = pathResolve(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(n) ? [p] : []; });
const src = walk(pathResolve(ROOT, 'src/pages')).concat(walk(pathResolve(ROOT, 'src/components')));
const claims = src.filter((p) => /बिल्कुल मुफ्त।|completely free\./.test(readFileSync(p, 'utf8')) && /SahakarLekha में|In SahakarLekha/.test(readFileSync(p, 'utf8').match(/[^\n]*(बिल्कुल मुफ्त।|completely free\.)[^\n]*/)?.[0] ?? ''));
ok('no page says the software itself is "completely free"', claims.length === 0);
const shell = read('src/components/calculators/CalculatorShell.tsx');
ok('the calculator page no longer sells the accounts as "— free"', !/डिजिटल कीजिए — मुफ्त|digital — free/.test(shell));
ok('the calculators themselves are still marked free (they are)', (shell.match(/isAccessibleForFree: true/g) || []).length === 2);
const tm = read('src/components/Testimonials.tsx');
ok('the review structured data states the real plan prices, not price 0', !/price: '0'/.test(tm) && /lowPrice: String\(PLAN_CATALOG\.starter\.price\)/.test(tm));

console.log('Header on a phone');
const layout = read('src/components/PublicLayout.tsx');
ok('a Login button is in the bar from 360px up', /className="hidden min-\[360px\]:inline-flex sm:hidden[^"]*"[\s\S]{0,40}<Link to="\/login"/.test(layout));
ok('below 360px Login is still the first item of the drawer', /<Link to="\/login" className="sm:hidden py-3 px-1/.test(layout));
ok('the wide header uses the trial label, the narrow one plain "Register"', /<span className="hidden lg:inline">\{L\(TRIAL_CTA\.hi, TRIAL_CTA\.en\)\}<\/span>/.test(layout) && /<span className="lg:hidden">\{L\('रजिस्टर', 'Register'\)\}<\/span>/.test(layout));
ok('a signed-in visitor still sees only Dashboard in the bar (never Login / Register)', /\{isAuthenticated \? \(\s*<Button asChild size="sm" className="gap-1">\s*<Link to="\/dashboard">/.test(layout));

console.log('Honest buttons');
for (const f of ['src/pages/SoftwareLanding.tsx', 'src/pages/StateLanding.tsx'])
  ok(`${f}: the contact button no longer promises a demo`, !/डेमो\/संपर्क|Demo \/ Contact/.test(read(f)) && /L\('संपर्क करें', 'Contact us'\)/.test(read(f)));
ok('the signed-out note names the trial length from TRIAL_DAYS', /SIGNED_OUT_NOTE/.test(cta) && (cta.match(/\$\{TRIAL_DAYS\}/g) || []).length >= 4);
const gl = read('src/pages/GlossaryTerm.tsx');
ok('glossary "do this in SahakarLekha" buttons send a signed-out visitor to Register with ?next=',
  /to=\{isAuthenticated \? m : `\/register\?next=\$\{encodeURIComponent\(m\)\}`\}/.test(gl) && /!isAuthenticated && <p[^>]*>\{L\(SIGNED_OUT_NOTE\.hi, SIGNED_OUT_NOTE\.en\)\}/.test(gl));
for (const f of ['src/pages/HelpArticle.tsx', 'src/pages/CookbookEntry.tsx'])
  ok(`${f}: the app-screen button explains itself to a signed-out visitor`, /!isAuthenticated/.test(read(f)) && /SIGNED_OUT_NOTE\.hi : SIGNED_OUT_NOTE\.en/.test(read(f)));

console.log(`\npublic-cta / sprint-3: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
