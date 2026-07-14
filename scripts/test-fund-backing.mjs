// Fund backing-investment coverage (ECR-27) — imports the REAL src/lib/fundBacking.ts via the '@/' loader.
// Run: node scripts/test-fund-backing.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { fundBackingCoverage } = await import(abs('../src/lib/fundBacking.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Fully backed — investments ≥ funds.
{
  const r = fundBackingCoverage(100000, 100000);
  ok(r.backed && r.coveragePct === 100 && r.shortfall === 0, 'funds == investments → backed, 100%, no shortfall');
}
// 2. Over-backed.
{
  const r = fundBackingCoverage(100000, 150000);
  ok(r.backed && r.coveragePct === 150 && r.shortfall === 0, 'investments > funds → backed, 150%, no shortfall');
}
// 3. Under-backed — shortfall + coverage%.
{
  const r = fundBackingCoverage(100000, 60000);
  ok(!r.backed && r.coveragePct === 60 && r.shortfall === 40000, 'investments 60% of funds → not backed, ₹40000 shortfall');
}
// 4. No funds → 100% (nothing to back), backed.
{
  const r = fundBackingCoverage(0, 0);
  ok(r.backed && r.coveragePct === 100 && r.shortfall === 0, 'no funds → 100% backed (nothing to cover)');
}
// 5. Funds but zero investments → 0%, full shortfall.
{
  const r = fundBackingCoverage(50000, 0);
  ok(!r.backed && r.coveragePct === 0 && r.shortfall === 50000, 'funds with no investments → 0%, full shortfall');
}
// 6. ₹1 tolerance — investments just under funds still counts as backed.
{
  const r = fundBackingCoverage(100000, 99999.5);
  ok(r.backed, 'investments within ₹1 of funds → backed (tolerance)');
  const r2 = fundBackingCoverage(100000, 99998);
  ok(!r2.backed && r2.shortfall === 2, '₹2 short → not backed, ₹2 shortfall');
}

console.log(`\nFund backing (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
