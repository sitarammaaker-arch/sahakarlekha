// Unit tests for the PURE placement config (supabase/functions/_shared/placement-config.mjs).
// The honesty rule under test: never claim a location we were not told. An undeclared copy makes
// the placement UNEVALUABLE (Backup Health then says "never evaluated") rather than fabricating a
// region/jurisdiction — a guessed jurisdiction would silently suppress a real residency deficiency.
// Run: node scripts/test-backup-placement-config.mjs   (npm run test:backup-placement-config)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { resolvePlacements } from '../supabase/functions/_shared/placement-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const PRIMARY = { provider: 'supabase-storage', region: 'ap-south-1', jurisdiction: 'in' };
const SECONDARY = { provider: 'cloudflare-r2', region: 'apac', jurisdiction: 'in' };

// ── 1. Fully declared primary, no secondary ⇒ evaluable, one copy ─────────────
{
  const r = resolvePlacements({ primary: PRIMARY });
  ok(r.evaluable === true, 'a fully declared primary is evaluable');
  ok(r.copies.length === 1 && r.copies[0].provider === 'supabase-storage', 'one copy: the primary');
  ok(r.reasons.length === 0, 'no reasons when the primary is declared');
}

// ── 2. Primary + a LANDED secondary ⇒ two copies, primary first ───────────────
{
  const r = resolvePlacements({ primary: PRIMARY, secondary: SECONDARY });
  ok(r.evaluable === true && r.copies.length === 2, 'a landed secondary adds a second copy');
  ok(r.copies[0].provider === 'supabase-storage', 'copies[0] is the primary (evaluate321 treats it as the reference)');
  ok(r.copies[1].provider === 'cloudflare-r2', 'copies[1] is the off-vendor copy');
}

// ── 3. A secondary that did NOT land is not a copy ────────────────────────────
{
  const r = resolvePlacements({ primary: PRIMARY, secondary: null });
  ok(r.copies.length === 1, 'a configured-but-failed replication does NOT count toward 3-2-1');
}

// ── 4. THE HONESTY RULE — an undeclared primary is unevaluable, never guessed ─
{
  for (const [field, cfg] of [
    ['provider', { ...PRIMARY, provider: '' }],
    ['region', { ...PRIMARY, region: '' }],
    ['jurisdiction', { ...PRIMARY, jurisdiction: '' }],
  ]) {
    const r = resolvePlacements({ primary: cfg });
    ok(r.evaluable === false, `an undeclared primary ${field} ⇒ NOT evaluable (never guessed)`);
    ok(r.copies.length === 0, `and yields no copies (${field})`);
    ok(r.reasons.some((x) => x.toUpperCase().includes(field.toUpperCase())), `and names the missing env var (${field})`);
  }
  const none = resolvePlacements({ primary: {} });
  ok(none.reasons.length === 3, 'all three missing declarations are reported at once');
  ok(resolvePlacements({}).evaluable === false, 'no config at all ⇒ not evaluable');
  ok(resolvePlacements({ primary: { provider: '  ', region: ' ', jurisdiction: '\t' } }).evaluable === false, 'whitespace-only declarations do not count');
}

// ── 5. A landed-but-undeclared secondary refuses the WHOLE verdict ────────────
// (dropping it silently would under-report: we'd grade 1 copy while 2 exist.)
{
  const r = resolvePlacements({ primary: PRIMARY, secondary: { provider: 'cloudflare-r2', region: '', jurisdiction: 'in' } });
  ok(r.evaluable === false, 'a landed secondary with an undeclared region makes the placement unevaluable');
  ok(r.reasons.some((x) => /not fully declared/.test(x)), 'and says the off-vendor copy is not fully declared');
}

// ── 6. Trimming + purity ─────────────────────────────────────────────────────
{
  const r = resolvePlacements({ primary: { provider: ' supabase-storage ', region: ' ap-south-1 ', jurisdiction: ' in ' } });
  ok(r.copies[0].region === 'ap-south-1' && r.copies[0].jurisdiction === 'in', 'declared values are trimmed');

  const source = readFileSync(pathResolve(ROOT, 'supabase', 'functions', '_shared', 'placement-config.mjs'), 'utf8');
  for (const forbidden of ['Deno.env', 'fetch(', 'Date.now', 'new Date', 'Math.random']) {
    ok(!source.includes(forbidden), `placement-config.mjs is pure (found "${forbidden}")`);
  }
}

console.log(`\nBackup placement config: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
