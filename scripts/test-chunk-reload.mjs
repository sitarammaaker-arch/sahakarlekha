// L1 · reloadOnceForStaleChunk (lib/chunkReload) — stale-chunk recovery after a deploy.
// Checks: first failure reloads; any failure inside the window does not (no loop — the guard is never
// cleared by a successful chunk); after the window a later deploy can recover; blocked storage never reloads.
//
// Run: node scripts/test-chunk-reload.mjs   (npm run test:chunk-reload)


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
let M;
try {
  M = await import(abs('../src/lib/chunkReload.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/chunkReload.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { reloadOnceForStaleChunk, RELOAD_WINDOW_MS } = M;

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
let clock = 5_000_000; const now = () => clock;
let reloads = 0; const reload = () => { reloads++; };

const s = mem();
check('first failure → reload', reloadOnceForStaleChunk(s, reload, now) === true && reloads === 1);
clock += 2_000;
check('failure right after our reload → no second reload (no loop)', reloadOnceForStaleChunk(s, reload, now) === false && reloads === 1);
clock += RELOAD_WINDOW_MS;
check('a later deploy in the same tab can recover again', reloadOnceForStaleChunk(s, reload, now) === true && reloads === 2);
clock += 1_000;
check('another failure soon after (e.g. page chunk OK, body chunk fails) → still no reload loop', reloadOnceForStaleChunk(s, reload, now) === false && reloads === 2);
const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } };
check('blocked storage → never reload', reloadOnceForStaleChunk(blocked, reload, now) === false && reloads === 2);
check('no storage → never reload', reloadOnceForStaleChunk(undefined, reload, now) === false && reloads === 2);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll chunk-reload checks passed.');
process.exit(failed ? 1 : 0);
