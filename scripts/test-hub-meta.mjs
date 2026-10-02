// L5 · HUB_META (src/content/hubMeta) — one source for hub <title>/description in the pages AND the prerender.
// Checks: the guide description's part/chapter counts equal the guide registry; each hub page and the
// prerender read HUB_META (no private copy left to drift); glossary description is Hindi-first, ≤158 chars.
//
// Run: node scripts/test-hub-meta.mjs   (npm run test:hub-meta)



import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
import { readFileSync } from 'node:fs';
const ROOT = dirname(HERE);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf-8');
const { HUB_META, glossaryMetaDescription } = await import(pathToFileURL(pathResolve(ROOT, 'src/content/hubMeta.ts')).href);

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const guide = read('src/content/guide/index.ts');
const parts = (guide.match(/"id": "part-\d+"/g) || []).length;
const chapters = (guide.match(/"kind": "chapter"/g) || []).length;
check(`guide description says ${parts} भाग`, HUB_META.guide.description.includes(`${parts} भाग`), HUB_META.guide.description);
check(`guide description says ${chapters} अध्याय`, HUB_META.guide.description.includes(`${chapters} अध्याय`), HUB_META.guide.description);
const en = read('src/pages/GuideHub.tsx');
check(`GuideHub English copy says ${chapters} chapters (no stale count)`, en.includes(`${chapters} chapters`) && !/\b(?!35\b)\d+ chapters/.test(en.replace(`${chapters} chapters`, '')));
for (const [key, file] of [['guide', 'GuideHub'], ['blog', 'BlogIndex'], ['help', 'HelpHub'], ['cookbook', 'CookbookHub'], ['glossary', 'Glossary'], ['tools', 'CalculatorHub']]) {
  const src = read(`src/pages/${file}.tsx`);
  check(`${file} uses HUB_META.${key}.title + .description`, src.includes(`HUB_META.${key}.title`) && src.includes(`HUB_META.${key}.description`));
  check(`${file} keeps no private copy of the hub title`, !src.includes(`'${HUB_META[key].title}'`));
}
const pre = read('scripts/prerender-guide.mjs');
for (const key of Object.keys(HUB_META)) check(`prerender uses HUB_META.${key}`, pre.includes(`DATA.hub.HUB_META.${key}.title`) && pre.includes(`DATA.hub.HUB_META.${key}.description`));
check('GlossaryTerm + prerender share glossaryMetaDescription', read('src/pages/GlossaryTerm.tsx').includes('glossaryMetaDescription(term)') && pre.includes('DATA.hub.glossaryMetaDescription('));
const d = glossaryMetaDescription({ hindi: 'यह **बहुत** [ज़रूरी](/x) शब्द है', definition: 'English' });
check('glossary description: Hindi first, markdown stripped', d === 'यह बहुत ज़रूरी शब्द है', d);
check('glossary description: falls back to the definition', glossaryMetaDescription({ hindi: '', definition: 'A `term`.' }) === 'A term.');
check('glossary description: ≤158 chars', glossaryMetaDescription({ hindi: 'क'.repeat(400) }).length === 158);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll hub-meta checks passed.');
process.exit(failed ? 1 : 0);
