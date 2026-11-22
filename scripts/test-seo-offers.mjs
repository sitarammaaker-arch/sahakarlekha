// SEO P3 (product audit 2026-11-17, "inconsistent offer markup"): every page that marks SahakarLekha up as software
// states the SAME offer — an AggregateOffer from Starter to Pro, 3 plans — and every price written into static HTML
// matches src/lib/plans.ts. The homepage said a single Offer of ₹2,999 while /pricing, /software and the state pages
// said ₹2,999–₹14,999; prerender-guide.mjs carries the figures as literals. Free things (the course, the calculators)
// keep price 0 with isAccessibleForFree — those are not the software.
// Run: node scripts/test-seo-offers.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const plans = read('src/lib/plans.ts');
const price = (id) => Number(plans.match(new RegExp(`${id}:\\s*\\{[^}]*price:\\s*(\\d+)`))?.[1]);
const P = { starter: price('starter'), plus: price('plus'), pro: price('pro'), enterprise: price('enterprise') };
ok(P.starter > 0 && P.plus > P.starter && P.pro > P.plus && P.enterprise > P.pro, `plan prices read from plans.ts (${JSON.stringify(P)})`);
const inr = (n) => n.toLocaleString('en-IN');

// 1. homepage SoftwareApplication
const html = read('index.html');
const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : j['@graph'] ?? [j]; });
const app = ld.find((n) => n['@type'] === 'SoftwareApplication');
ok(app?.offers?.['@type'] === 'AggregateOffer', 'homepage: the software offer is an AggregateOffer (was a single ₹2,999 Offer)');
ok(app?.offers?.lowPrice === String(P.starter) && app?.offers?.highPrice === String(P.pro) && app?.offers?.offerCount === 3 && app?.offers?.priceCurrency === 'INR', 'homepage: lowPrice = Starter, highPrice = Pro, 3 offers, INR');
ok(app?.description?.includes(`INR ${P.starter} per year`), 'homepage description names the Starter price from plans.ts');

// 2. prerendered software pages
const pre = read('scripts/prerender-guide.mjs');
const agg = [...pre.matchAll(/'@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: '(\d+)', highPrice: '(\d+)', offerCount: (\d+)/g)];
ok(agg.length > 0 && agg.every((m) => Number(m[1]) === P.starter && Number(m[2]) === P.pro && m[3] === '3'), `prerender-guide AggregateOffer literals match plans.ts (${agg.map((m) => m[1] + '–' + m[2]).join(', ')})`);
const written = [...pre.matchAll(/₹([\d,]+)\/(?:साल|year)/g)].map((m) => Number(m[1].replace(/,/g, '')));
ok(written.length >= 6 && written.every((n) => Object.values(P).includes(n)), `every ₹x/year in prerendered HTML is a real plan price (${[...new Set(written)].map(inr).join(', ')})`);

// 3. the React pages read the catalogue (no literals)
for (const f of ['src/components/Testimonials.tsx', 'src/pages/SoftwareLanding.tsx', 'src/pages/StateLanding.tsx']) {
  ok(read(f).includes("offers: { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: String(PLAN_CATALOG.starter.price), highPrice: String(PLAN_CATALOG.pro.price), offerCount: 3 }"), `${f}: AggregateOffer from PLAN_CATALOG`);
}
ok(/lowPrice: String\(Math\.min\(\.\.\.prices\)\)/.test(read('src/lib/seo.ts')), '/pricing: AggregateOffer from the plan catalogue');

// 4. price 0 only on free things, never on the software
// the node a price-0 offer belongs to = the nearest "'@context' … '@type'" before it
const zero = [...pre.matchAll(/offers: \{ '@type': 'Offer', price: '0'/g)]
  .map((m) => [...pre.slice(0, m.index).matchAll(/'@context': 'https:\/\/schema\.org', '@type': '(\w+)'/g)].pop()?.[1]);
ok(zero.length > 0 && zero.every((t) => t === 'Course' || t === 'WebApplication'), `price 0 appears only on the free course / calculators (${[...new Set(zero)].join(', ')})`);
ok(!/'@type': 'SoftwareApplication'[\s\S]{0,400}price: '0'/.test(pre) && !/"SoftwareApplication"[\s\S]{0,600}"price": "0"/.test(html), 'the software is never marked up as free');

console.log(`SEO offers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
