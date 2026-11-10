// src/lib/seo — the title rule and the /pricing schema shared by the live pages and the prerender.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitTitle, glossaryTitle, pricingJsonLd, TITLE_MAX } from '../src/lib/seo.ts';
import { PLAN_CATALOG } from '../src/lib/plans.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const len = (s) => [...s].length;

// fitTitle
const short = 'GST कैलकुलेटर — Exclusive व Inclusive | SahakarLekha';
ok('a title that fits is returned unchanged', fitTitle(short) === short && len(short) <= TITLE_MAX);
const long = 'प्रतिशत (Percentage) कैलकुलेटर — वृद्धि, कमी, अंतर और बहुत कुछ | SahakarLekha';
ok('a long title loses "| SahakarLekha"', fitTitle(long) === 'प्रतिशत (Percentage) कैलकुलेटर — वृद्धि, कमी, अंतर और बहुत कुछ');
ok('a long title loses "| सहकार लेखा ब्लॉग"', fitTitle('सहकारिता आंदोलन: इतिहास, संस्थाएँ व सफलता की कहानियाँ — पूरी जानकारी | सहकार लेखा ब्लॉग') === 'सहकारिता आंदोलन: इतिहास, संस्थाएँ व सफलता की कहानियाँ — पूरी जानकारी');
const noTail = 'हरियाणा सहकारी समिति लेखा सॉफ्टवेयर — ₹1,499/FY से | Haryana Cooperative Society Accounting Software';
ok('a long title with no brand tail is left alone (never cut mid-sentence)', fitTitle(noTail) === noTail);
ok('the brand in the MIDDLE of a title is never touched', fitTitle('SahakarLekha Pricing — Starter, Plus & Pro Cooperative Accounting Plans for Every Society') === 'SahakarLekha Pricing — Starter, Plus & Pro Cooperative Accounting Plans for Every Society');
ok('a long guide chapter title loses "— सहकार लेखा गाइड"', fitTitle('समग्र केस-स्टडी: रानिया सहकारी समिति (पूर्ण वर्ष) — सहकार लेखा गाइड') === 'समग्र केस-स्टडी: रानिया सहकारी समिति (पूर्ण वर्ष)');
ok('…and the English "— SahakarLekha Guide"', fitTitle('Comprehensive Case Study: Rania Cooperative Society (Full Year) — SahakarLekha Guide') === 'Comprehensive Case Study: Rania Cooperative Society (Full Year)');
ok('empty / undefined pass through', fitTitle('') === '' && fitTitle(undefined) === undefined);

// glossaryTitle
ok('a short term keeps the full section name and brand', glossaryTitle('बैंक बुक (Bank Book)') === 'बैंक बुक (Bank Book) — सहकारी लेखांकन शब्दकोश | SahakarLekha');
const mid = glossaryTitle('रिज़र्व फंड (Reserve Fund)');
ok('a medium term uses the short section name', mid === 'रिज़र्व फंड (Reserve Fund) — शब्दकोश | SahakarLekha' && len(mid) <= TITLE_MAX, mid);
const big = glossaryTitle('प्राथमिक कृषि साख समिति (Primary Agricultural Credit Society)');
ok('a very long term keeps "शब्दकोश" and drops the brand', big === 'प्राथमिक कृषि साख समिति (Primary Agricultural Credit Society) — शब्दकोश', big);

// pricing schema — prices come from the plan catalogue, never typed twice
const ld = pricingJsonLd();
const offers = ld.offers.offers;
ok('three public plans are offered', ld.offers.offerCount === 3 && offers.length === 3);
ok('each price is the catalogue price', offers.map((o) => o.price).join() === [PLAN_CATALOG.starter.price, PLAN_CATALOG.plus.price, PLAN_CATALOG.pro.price].join());
ok('low / high are the cheapest and dearest public plan', ld.offers.lowPrice === String(PLAN_CATALOG.starter.price) && ld.offers.highPrice === String(PLAN_CATALOG.pro.price));
ok('currency is INR everywhere', ld.offers.priceCurrency === 'INR' && offers.every((o) => o.priceCurrency === 'INR'));
ok('no rating or review is claimed', !('aggregateRating' in ld) && !('review' in ld));

// one rule in both places
const hook = readFileSync(resolve(ROOT, 'src/lib/useDocumentMeta.ts'), 'utf8');
const pre = readFileSync(resolve(ROOT, 'scripts/prerender-guide.mjs'), 'utf8');
ok('useDocumentMeta applies fitTitle', hook.includes("from './seo'") && hook.includes('fitTitle(opts.title)'));
ok('the prerender loads the same module and applies fitTitle to every page', pre.includes("resolve(ROOT, 'src', 'lib', 'seo.ts')") && pre.includes('fitTitle(page0.title)'));
ok('the glossary title is built by glossaryTitle in the page and the prerender', readFileSync(resolve(ROOT, 'src/pages/GlossaryTerm.tsx'), 'utf8').includes('glossaryTitle(') && pre.includes('DATA.seo.glossaryTitle(name)'));
ok('the template carries no keywords meta', !/<meta name="keywords"/.test(readFileSync(resolve(ROOT, 'index.html'), 'utf8')));

// static shell: the footer links a crawler that runs no JavaScript needs
ok('the static shell links About, Contact, Pricing, the policies and the state page',
  ['/about', '/contact', '/pricing', '/privacy', '/terms', '/editorial-policy', '/cooperative-software/haryana'].every((p) => pre.includes(`['${p}',`)) && pre.includes('FOOTER_LINKS.map'));

console.log(`\nseo helpers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
