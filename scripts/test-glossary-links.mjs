// L8 · resolveGlossaryHref (src/content/glossaryLinks) — hand-written glossary links in articles.
// Checks: existing slug kept; exact synonym re-pointed; unknown slug → null (plain text); non-glossary
// hrefs untouched; query/hash kept; every alias targets a real glossary term (KI file).
//
// Run: node scripts/test-glossary-links.mjs   (npm run test:glossary-links)
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
import { readdirSync } from 'node:fs';
const { resolveGlossaryHref, GLOSSARY_ALIASES } = await import(abs('../src/content/glossaryLinks.ts'));

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
// real glossary slugs, derived the way src/content/glossary does (from the KI filename)
const KI = pathResolve(HERE, '..', 'docs', 'kpp', 'wave-1-active');
const slugs = new Set(readdirSync(KI).filter((f) => /^KI-\d+.*\.md$/.test(f)).map((f) => f.replace(/^KI-\d+-/, '').replace(/\.md$/, '')));
const has = (s) => slugs.has(s);
check('KI slugs found', slugs.size >= 100, `got ${slugs.size}`);
check('existing slug → kept', resolveGlossaryHref('/glossary/voucher', has) === '/glossary/voucher');
check('exact synonym → re-pointed', resolveGlossaryHref('/glossary/registrar', has) === '/glossary/registrar-of-cooperative-societies');
check('unknown slug → null (plain text)', resolveGlossaryHref('/glossary/trial-balance-zz', has) === null);
check('query/hash kept on alias', resolveGlossaryHref('/glossary/nomination#x', has) === '/glossary/nominee#x');
check('non-glossary href untouched', resolveGlossaryHref('/blog/abc', has) === '/blog/abc' && resolveGlossaryHref('https://x.org', has) === 'https://x.org');
check('glossary index untouched', resolveGlossaryHref('/glossary', has) === '/glossary');
check('undefined href untouched', resolveGlossaryHref(undefined, has) === undefined);
for (const [from, to] of Object.entries(GLOSSARY_ALIASES)) {
  check(`alias ${from} → ${to} targets a real term, and ${from} itself is not one`, has(to) && !has(from));
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll glossary-link checks passed.');
process.exit(failed ? 1 : 0);
