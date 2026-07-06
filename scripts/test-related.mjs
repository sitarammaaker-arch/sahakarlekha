// Validates src/content/relatedContent.ts (GOS-11): every cross-surface edge must
// point at a REAL slug in the target registry — a typo here would ship broken
// internal links onto every page and into the prerendered bodies.
// Run: npm run test:related   (exit 1 on any bad edge)

import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function loadModule(entry) {
  const esbuild = await import('esbuild');
  const out = resolve(ROOT, 'node_modules', '.cache', 'prerender', 'test-' + basename(entry).replace(/\.tsx?$/, '') + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'node',
    outfile: out, alias: { '@': resolve(ROOT, 'src') }, jsx: 'automatic', logLevel: 'silent',
  });
  return await import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

const rel = await loadModule(resolve(ROOT, 'src', 'content', 'relatedContent.ts'));
const help = (await loadModule(resolve(ROOT, 'src', 'content', 'help', 'index.ts'))).HELP_TASKS.map((t) => t.slug);
const cookbook = (await loadModule(resolve(ROOT, 'src', 'content', 'cookbook', 'index.ts'))).COOKBOOK_ENTRIES.map((e) => e.slug);
const calcs = (await loadModule(resolve(ROOT, 'src', 'content', 'calculators', 'index.ts'))).CALCULATORS.map((c) => c.slug);
const society = (await loadModule(resolve(ROOT, 'src', 'content', 'societyTypes.tsx'))).SOCIETY_TYPES.map((t) => t.slug);
const states = (await loadModule(resolve(ROOT, 'src', 'content', 'states.ts'))).STATES.map((s) => s.slug);

// blog slugs (regex — index.ts can't be esbuild-loaded because of import.meta.glob)
const blogSrc = readFileSync(resolve(ROOT, 'src', 'content', 'blog', 'index.ts'), 'utf-8');
const blog = [...blogSrc.matchAll(/^    slug: '([a-z0-9-]+)'/gm)].map((m) => m[1]);

// guide slugs from the committed manifest
const guide = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'guide-manifest.json'), 'utf-8')).map((e) => e.slug);

// glossary slugs from the active KI files
const glossary = readdirSync(resolve(ROOT, 'docs', 'kpp', 'wave-1-active'))
  .filter((f) => /^KI-\d+.*\.md$/.test(f))
  .map((f) => f.replace(/^KI-\d+-/, '').replace(/\.md$/, ''));

const errors = [];
const check = (val, pool, where) => { if (!pool.includes(val)) errors.push(`${where}: '${val}' not found`); };

for (const [k, v] of Object.entries(rel.BLOG_HELP)) {
  check(k, blog, 'BLOG_HELP key (blog)');
  v.forEach((s) => check(s, help, `BLOG_HELP['${k}'] (help)`));
}
for (const [k, v] of Object.entries(rel.GLOSSARY_BLOG)) {
  check(k, glossary, 'GLOSSARY_BLOG key (glossary)');
  check(v.slug, blog, `GLOSSARY_BLOG['${k}'] (blog)`);
}
for (const [k, v] of Object.entries(rel.HELP_COOKBOOK)) {
  check(k, help, 'HELP_COOKBOOK key (help)');
  v.forEach((s) => check(s, cookbook, `HELP_COOKBOOK['${k}'] (cookbook)`));
}
for (const [k, v] of Object.entries(rel.CALC_COOKBOOK)) {
  check(k, calcs, 'CALC_COOKBOOK key (calculator)');
  v.forEach((s) => check(s, cookbook, `CALC_COOKBOOK['${k}'] (cookbook)`));
}
const checkSurface = (map, keyPool, keyName) => {
  for (const [k, links] of Object.entries(map)) {
    check(k, keyPool, `${keyName} key`);
    (links.guide || []).forEach((r) => check(r.slug, guide, `${keyName}['${k}'].guide`));
    (links.blog || []).forEach((r) => check(r.slug, blog, `${keyName}['${k}'].blog`));
    (links.help || []).forEach((s) => check(s, help, `${keyName}['${k}'].help`));
    (links.cookbook || []).forEach((s) => check(s, cookbook, `${keyName}['${k}'].cookbook`));
  }
};
checkSurface(rel.SOCIETY_CONTENT, society, 'SOCIETY_CONTENT');
checkSurface(rel.STATE_CONTENT, states, 'STATE_CONTENT');

const edges =
  Object.values(rel.BLOG_HELP).flat().length +
  Object.keys(rel.GLOSSARY_BLOG).length +
  Object.values(rel.HELP_COOKBOOK).flat().length +
  Object.values(rel.CALC_COOKBOOK).flat().length +
  Object.values(rel.SOCIETY_CONTENT).flatMap((l) => [...(l.guide || []), ...(l.blog || []), ...(l.help || []), ...(l.cookbook || [])]).length +
  Object.values(rel.STATE_CONTENT).flatMap((l) => [...(l.guide || []), ...(l.blog || []), ...(l.help || []), ...(l.cookbook || [])]).length;

if (errors.length) {
  console.error(`[related] ${errors.length} broken edge(s):`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log(`[related] ✓ all ${edges} cross-surface edges resolve to real slugs.`);
