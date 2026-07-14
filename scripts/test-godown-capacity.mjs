// Godown capacity utilisation (ECR-20). Imports the REAL src/lib/godownCapacity.ts via the
// '@/' loader (was a self-contained mirror before).
// Run: node scripts/test-godown-capacity.mjs
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

const { capacityUtilisation } = await import(abs('../src/lib/godownCapacity.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Normal utilisation.
{ const r = capacityUtilisation(50, 100); ok(r.utilisationPct === 50 && !r.overCapacity && r.capacityMT === 100, '50/100 → 50%, not over'); }
// 2. Exactly full → 100%, not over (over is strictly greater).
{ const r = capacityUtilisation(100, 100); ok(r.utilisationPct === 100 && !r.overCapacity, 'full → 100%, not over'); }
// 3. Over capacity.
{ const r = capacityUtilisation(120, 100); ok(r.utilisationPct === 120 && r.overCapacity, 'over → 120%, over flag'); }
// 4. No capacity set → pct null, never over.
{ const r = capacityUtilisation(80, undefined); ok(r.utilisationPct === null && !r.overCapacity && r.capacityMT === null, 'undefined capacity → null pct, not over'); }
{ const r = capacityUtilisation(80, 0); ok(r.utilisationPct === null && !r.overCapacity, 'zero capacity → null pct, not over'); }
{ const r = capacityUtilisation(80, null); ok(r.utilisationPct === null, 'null capacity → null pct'); }
// 5. Empty godown.
{ const r = capacityUtilisation(0, 100); ok(r.utilisationPct === 0 && !r.overCapacity, 'empty → 0%'); }
// 6. Rounding to 1 decimal.
{ const r = capacityUtilisation(1, 3); ok(r.utilisationPct === 33.3, '1/3 → 33.3%'); }
// 7. usedQty falsy guard.
{ const r = capacityUtilisation(undefined, 100); ok(r.usedQty === 0 && r.utilisationPct === 0, 'undefined used → 0'); }

console.log(`\nGodown capacity (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
