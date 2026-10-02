// J5 · fetchSubscriptionRow (lib/subscriptionRow) — one subscription read per society, shared by
// DataContext, the banner and the plan pages. Checks: concurrent readers share one request, a read is
// reused within the TTL and refetched after it, errors and rejections are never cached, and a missing
// row resolves null (legacy).
//
// Run: node scripts/test-subscription-row.mjs   (npm run test:subscription-row)


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
  M = await import(abs('../src/lib/subscriptionRow.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/subscriptionRow.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { fetchSubscriptionRow, clearSubscriptionCache, SUB_TTL_MS } = M;

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
// Fake client: records each request; the next responses come from a queue.
const fake = (queue) => {
  const calls = [];
  return { calls, from: (t) => ({ select: (c) => ({ eq: (k, v) => ({ maybeSingle: () => { calls.push(`${t}:${v}`); const n = queue.shift(); return n instanceof Error ? Promise.reject(n) : Promise.resolve(n); } }) }) }) };
};
let clock = 1_000_000;
const now = () => clock;
const row = { plan: 'plus', status: 'active', period_end: '2027-03-31' };

// 1. Concurrent readers share one request.
{
  clearSubscriptionCache();
  const c = fake([{ data: row, error: null }]);
  const [a, b, d] = await Promise.all([fetchSubscriptionRow('S1', c, now), fetchSubscriptionRow('S1', c, now), fetchSubscriptionRow('S1', c, now)]);
  check('three readers → one request', c.calls.length === 1 && a === b && b === d && a.plan === 'plus');
}

// 2. Reused within the TTL, refetched after it; societies are separate.
{
  clearSubscriptionCache();
  const c = fake([{ data: row, error: null }, { data: { ...row, status: 'expired' }, error: null }, { data: null, error: null }]);
  await fetchSubscriptionRow('S1', c, now);
  clock += SUB_TTL_MS - 1;
  await fetchSubscriptionRow('S1', c, now);
  check('within TTL → no new request', c.calls.length === 1);
  clock += 2;
  const fresh = await fetchSubscriptionRow('S1', c, now);
  check('after TTL → refetched (renewal/expiry visible)', c.calls.length === 2 && fresh.status === 'expired');
  const other = await fetchSubscriptionRow('S2', c, now);
  check('another society has its own read; missing row → null', c.calls.length === 3 && c.calls[2] === 'subscriptions:S2' && other === null);
}

// 3. Errors and rejections are never cached — the next reader retries.
{
  clearSubscriptionCache();
  const c = fake([{ data: null, error: { message: 'boom' } }, new Error('network'), { data: row, error: null }]);
  check('error → null', (await fetchSubscriptionRow('S1', c, now)) === null);
  check('rejection → null (retried, not cached)', (await fetchSubscriptionRow('S1', c, now)) === null && c.calls.length === 2);
  check('third read succeeds', (await fetchSubscriptionRow('S1', c, now))?.plan === 'plus' && c.calls.length === 3);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll subscription-row checks passed.');
process.exit(failed ? 1 : 0);
