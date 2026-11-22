// SEO-07 (product audit 2026-11-17): the homepage carried FAQPage structured data whose questions were not visible
// on the page (one asked "Is SahakarLekha really free?"). Google requires FAQ markup to match visible content, so the
// block is removed from the template; the visible FAQ and its FAQPage live on /faq. Also: the template's alternateName
// now spells the brand as two words (सहकार लेखा), as everywhere else.
// Run: node scripts/test-seo07-homepage-faq.mjs     (dist/ checks run only after a full `npm run build`)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const tpl = read('index.html');
const blocks = [...tpl.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok(blocks.every((b) => !/"@type":\s*"FAQPage"/.test(b)), 'the template carries no FAQPage (its questions were not on the homepage)');
ok(!/really free/i.test(tpl), 'the "Is SahakarLekha really free?" question is gone');
ok(blocks.length >= 1 && blocks.every((b) => { try { JSON.parse(b); return true; } catch { return false; } }), 'the remaining JSON-LD blocks still parse');
ok(tpl.includes('"alternateName": "सहकार लेखा"') && !tpl.includes('सहकारलेखा'), 'brand in Devanagari is two words (सहकार लेखा)');
{
  // founder 2026-11-22: the Terms trademark line names BOTH Devanagari forms (the two-word brand + the older one-word form)
  const t = read('src/content/legal/termsSections.tsx');
  ok(t.includes('"SahakarLekha", "सहकार लेखा" और "सहकारलेखा" हमारे ट्रेडमार्क हैं।') && t.includes('"SahakarLekha", "सहकार लेखा" and "सहकारलेखा" are our trademarks.'), 'Terms (hi + en): trademarks list SahakarLekha, सहकार लेखा and सहकारलेखा');
}
ok(read('src/pages/FAQ.tsx').includes("'@type': 'FAQPage'"),'the /faq page keeps its own FAQPage (its questions are visible there)');

if (existsSync(join(ROOT, 'dist', 'faq', 'index.html'))) {
  const count = (f) => (readFileSync(join(ROOT, 'dist', f), 'utf8').match(/"@type":\s*"FAQPage"/g) || []).length;
  ok(count('index.html') === 0 && count('en/index.html') === 0, 'built homepage (Hindi and /en): no FAQPage');
  ok(count('faq/index.html') === 1, 'built /faq: exactly one FAQPage');
} else {
  console.log('  (dist/ checks skipped — run `npm run build` first)');
}

console.log(`SEO-07 homepage FAQ: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
