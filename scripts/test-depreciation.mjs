// Asset depreciation (SLM / WDV) — T-02 born-exact (ADR-0006).
//
// calcSLMDepreciation / calcWDVDepreciation used Math.round(base × rate/100 × fraction × 100)
// / 100. They now compute in exact integer paise (subMinor base, roundMinor) via money.ts.
// This imports the REAL src/lib/depreciation.ts (which imports @/lib/money) via an
// '@/'-resolving loader — the actual engine, not a mirror.
//
// Run: node scripts/test-depreciation.mjs   (npm run test:depreciation)

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

const { calcSLMDepreciation, calcWDVDepreciation } = await import(abs('../src/lib/depreciation.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const p = (r) => Math.round(r * 100);

// Equipment, purchased well before the FY → full-year (fraction = 1).
const mk = (o = {}) => ({ id: 'a1', name: 'x', category: 'Equipment', cost: 100000, purchaseDate: '2020-01-01', depreciationRate: 10, depreciationMethod: 'SLM', residualValue: 0, ...o });

// ── SLM ──────────────────────────────────────────────────────────────────────
ok(calcSLMDepreciation(mk(), '2025-26') === 10000, 'SLM 10% of ₹100000 (full year) = ₹10000');
ok(calcSLMDepreciation(mk({ residualValue: 10000 }), '2025-26') === 9000, 'SLM on depreciable base cost − residual = 10% of ₹90000 = ₹9000');
ok(calcSLMDepreciation(mk({ category: 'Land' }), '2025-26') === 0, 'Land (no dep account) → 0');
ok(calcSLMDepreciation(mk({ depreciationRate: 0 }), '2025-26') === 0, 'zero rate → 0');
// born-exact: 15% of ₹33333 = ₹4999.95 to the paisa.
ok(p(calcSLMDepreciation(mk({ cost: 33333, depreciationRate: 15 }), '2025-26')) === 499995, 'SLM 15% of ₹33333 = ₹4999.95 exact');

// ── WDV ──────────────────────────────────────────────────────────────────────
ok(calcWDVDepreciation(mk({ depreciationMethod: 'WDV' }), '2025-26', 0) === 10000, 'WDV year 1: 10% of book ₹100000 = ₹10000');
ok(calcWDVDepreciation(mk({ depreciationMethod: 'WDV' }), '2025-26', 10000) === 9000, 'WDV year 2: 10% of book ₹90000 = ₹9000');
// Residual cap: book already at residual → no further depreciation.
ok(calcWDVDepreciation(mk({ depreciationMethod: 'WDV', residualValue: 95000 }), '2025-26', 0) <= 5000, 'WDV capped so book never drops below residual');

console.log(`\nDepreciation (born-exact): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
