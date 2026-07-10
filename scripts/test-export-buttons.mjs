// Per-page export buttons (T-19..T-22) — every `entityKey` must name a real, exportable
// registry entity.
//
// WHY THIS EXISTS. `<EntityExportButton entityKey="worker_advnace" />` compiles. TypeScript
// sees a string. At runtime getEntity() returns undefined, the component returns null, and
// the button simply is not there. No error, no warning, no export — and nobody notices for
// a year. A silently missing export button is the small sibling of the backup that could
// not restore.
//
// So: parse every entityKey out of the pages, resolve it against the real registry, and
// fail on anything that would render nothing.
//
// Run: node scripts/test-export-buttons.mjs   (npm run test:export-buttons)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve as pathResolve, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const PAGES = join(ROOT, 'src', 'pages');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

let REGISTRY;
try {
  ({ REGISTRY } = await import(pathToFileURL(join(ROOT, 'src', 'lib', 'export', 'registry.ts')).href));
} catch (e) {
  console.error('\nFAIL    Could not import the export registry.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  console.error('        Requires Node with native TypeScript support (>= 23.6). Failing closed.');
  process.exit(1);
}
if (!Array.isArray(REGISTRY) || REGISTRY.length === 0) {
  console.error('\nFAIL    REGISTRY is empty.');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const byKey = new Map(REGISTRY.map(e => [e.key, e]));
const buttons = [];

for (const file of walk(PAGES)) {
  const src = readFileSync(file, 'utf8');
  const where = relative(ROOT, file).replace(/\\/g, '/');

  for (const m of src.matchAll(/entityKey="([^"]*)"/g)) {
    buttons.push({ key: m[1], where });
  }

  // A page that renders the button must import it, and vice versa.
  const usesTag = /<EntityExportButton\b/.test(src);
  const hasImport = /import\s+EntityExportButton\s+from/.test(src);
  if (usesTag || hasImport) {
    ok(usesTag && hasImport, `${where}: EntityExportButton is imported and used together`);
  }
}

ok(buttons.length > 0, `at least one page exports through the registry (found ${buttons.length})`);

for (const { key, where } of buttons) {
  const entity = byKey.get(key);
  ok(!!entity, `${where}: entityKey "${key}" names a real registry entity`);
  if (!entity) continue;

  // These three would each render an invisible button rather than an error.
  ok(entity.backupPolicy !== 'exclude',
    `${where}: "${key}" is not an \`exclude\` entity (its rows never leave the database)`);
  ok(entity.formats.includes('csv') || entity.formats.includes('xlsx'),
    `${where}: "${key}" declares at least one format the button can offer`);
  ok(entity.scope === 'society',
    `${where}: "${key}" is society-scoped, so it can be read for one society`);
}

// A key used twice is fine; a key that is nowhere in the registry is not. Report the set
// so a reviewer sees the coverage at a glance.
const unique = [...new Set(buttons.map(b => b.key))].sort();
console.log(`\n  ${buttons.length} buttons across ${new Set(buttons.map(b => b.where)).size} pages, ${unique.length} distinct entities:`);
for (const key of unique) {
  const e = byKey.get(key);
  if (e) console.log(`    ${key.padEnd(26)} minRole=${e.minRole.padEnd(11)} capability=${e.capability ?? '(none)'}`);
}

console.log(`\nExport buttons: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
