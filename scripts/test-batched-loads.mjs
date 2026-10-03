// J5 · applyLoadsTogether (lib/batchedLoads) — several independent table loads applied in ONE callback
// (so React batches them into one commit). Checks: nothing is applied until every load settles, all
// setters run in the same tick, an error / null data / rejection falls back to that table's cached copy,
// and a throwing setter never blocks the others.
//
// Run: node scripts/test-batched-loads.mjs   (npm run test:batched-loads)


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
let applyLoadsTogether;
try {
  ({ applyLoadsTogether } = await import(abs('../src/lib/batchedLoads.ts')));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/batchedLoads.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const later = (ms, v, reject = false) => new Promise((res, rej) => setTimeout(() => (reject ? rej(v) : res(v)), ms));

const applied = {};
const calls = [];
const setter = (k) => (rows) => { applied[k] = rows; calls.push({ k, at: performance.now() }); };
const origWarn = console.warn; let warned = 0; console.warn = () => { warned++; };

let settledEarly = false;
const fast = later(5, { data: [{ id: 'fast' }], error: null });
fast.then(() => { settledEarly = Object.keys(applied).length > 0; });

await applyLoadsTogether([
  [fast, setter('ok'), () => ['cache-ok']],
  [later(40, { data: [{ id: 'slow' }], error: null }), setter('slow'), () => ['cache-slow']],
  [later(10, { data: null, error: { message: 'relation does not exist' } }), setter('missing'), () => ['cache-missing']],
  [later(15, { data: null, error: null }), setter('nulldata'), () => ['cache-null']],
  [later(20, new Error('network'), true), setter('rejected'), () => ['cache-rejected']],
  [later(25, { data: [{ id: 'x' }], error: null }), () => { throw new Error('boom'); }, () => []],
  [later(30, { data: [{ id: 'after' }], error: null }), setter('afterThrow'), () => ['cache-after']],
], 'test');
console.warn = origWarn;

check('nothing applied while slower loads were pending', settledEarly === false);
check('successful loads applied with their rows', applied.ok?.[0]?.id === 'fast' && applied.slow?.[0]?.id === 'slow');
check('error → cached copy', applied.missing?.[0] === 'cache-missing');
check('null data → cached copy', applied.nulldata?.[0] === 'cache-null');
check('rejection → cached copy', applied.rejected?.[0] === 'cache-rejected');
check('a throwing setter does not block the next one', applied.afterThrow?.[0]?.id === 'after' && warned === 1, `warned=${warned}`);
const span = Math.max(...calls.map(c => c.at)) - Math.min(...calls.map(c => c.at));
check('every setter ran in the same tick (one batch)', calls.length === 6 && span < 5, `calls=${calls.length} span=${span.toFixed(2)}ms`);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll batched-load checks passed.');
process.exitCode = failed ? 1 : 0;
