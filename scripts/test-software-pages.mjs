#!/usr/bin/env node
// /software/<type> pages: the module list and questions are DERIVED from the app (content/softwareModules,
// content/softwareFaq). This guards the derivation, not the wording:
//   - every society type that has a /software page maps to an app society type (else its page silently
//     loses the "what you get" section and its FAQ);
//   - each type gets the universal books plus its own module group;
//   - no menu label falls back to a raw translation key;
//   - the questions carry the public plan prices from lib/plans (never a stale number).
// Run: node scripts/test-software-pages.mjs   (npm run test:software-pages)
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(ROOT, 'node_modules', '.cache', 'test-software-pages', 'bundle.mjs');
mkdirSync(dirname(out), { recursive: true });
const esbuild = await import('esbuild');
await esbuild.build({
  stdin: {
    contents: `export * from './src/content/softwareModules'; export * from './src/content/softwareFaq'; export { PLAN_CATALOG, priceLabel } from './src/lib/plans';`,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out,
  alias: { '@': resolve(ROOT, 'src') }, jsx: 'automatic', logLevel: 'silent',
});
const m = await import(pathToFileURL(out).href + `?t=${Date.now()}`);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };

const src = readFileSync(resolve(ROOT, 'src/content/societyTypes.tsx'), 'utf8');
const slugs = [...src.matchAll(/^\s{4}slug:\s*'([^']+)'/gm)].map((x) => x[1]);
ok('societyTypes.tsx lists the software pages', slugs.length >= 8, String(slugs.length));

const unmapped = slugs.filter((s) => !m.SOFTWARE_SLUG_TYPE[s]);
ok('every /software/<type> page maps to an app society type', unmapped.length === 0, `add to SOFTWARE_SLUG_TYPE: ${unmapped.join(', ')}`);

const OWN_GROUP = { dairy: 'dairy', consumer: 'consumer', housing: 'housing', labour: 'labour', marketing: 'marketing', pacs: 'marketing', sugar: 'marketing' };
for (const s of slugs.filter((x) => m.SOFTWARE_SLUG_TYPE[x])) {
  const groups = m.softwareModuleGroups(s);
  const domains = groups.map((g) => g.domain);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  ok(`${s}: has the daily books, reports and registers`, ['core', 'reports', 'registers'].every((d) => domains.includes(d)), domains.join(','));
  ok(`${s}: a real module list (${total})`, total >= 40);
  if (OWN_GROUP[s]) ok(`${s}: its own module group is listed`, domains.includes(OWN_GROUP[s]), domains.join(','));
  ok(`${s}: no settings screens or dashboards in the list`, !domains.includes('administration') && !groups.some((g) => g.items.some((i) => /^(Dashboard|My Dashboard|Analytics)$/.test(i.en))));
  const raw = groups.flatMap((g) => g.items).filter((i) => /^[a-z]+[A-Z]/.test(i.hi) || /^[a-z]+[A-Z]/.test(i.en));
  ok(`${s}: every label is translated`, raw.length === 0, raw.map((i) => i.en).join(', '));

  const faq = m.softwareFaq(s, 'नाम', 'Name');
  ok(`${s}: questions exist with answers in both languages`, faq.length >= 5 && faq.every((q) => q.qHi && q.qEn && q.aHi.length > 20 && q.aEn.length > 20), String(faq.length));
  const price = faq.find((q) => q.qEn.startsWith('Is the price different'));
  const want = [m.PLAN_CATALOG.starter.price, m.PLAN_CATALOG.plus.price, m.PLAN_CATALOG.pro.price].map(m.priceLabel);
  ok(`${s}: the price answer quotes the public plans`, !!price && want.every((w) => price.aHi.includes(w) && price.aEn.includes(w)), want.join(' '));
  ok(`${s}: the first answer states the real module count`, faq[0].aHi.includes(` ${total} module`) && faq[0].aEn.includes(` ${total} modules`));
}

ok('an unknown slug gives nothing (no invented page content)', m.softwareModuleGroups('no-such-type').length === 0 && m.softwareFaq('no-such-type', 'x', 'x').length === 0);
const ld = m.softwareFaqLd(m.softwareFaq('pacs', 'PACS', 'PACS'));
ok('FAQ structured data is a FAQPage with questions', ld['@type'] === 'FAQPage' && ld.mainEntity.length >= 5 && ld.mainEntity.every((q) => q['@type'] === 'Question' && q.acceptedAnswer.text));

console.log(`\nsoftware pages: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
