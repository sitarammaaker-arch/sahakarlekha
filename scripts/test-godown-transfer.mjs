// Inter-godown transfer (ECR-20). Imports the REAL src/lib/godownTransfer.ts (validateTransfer,
// buildTransferLegs) + the REAL canonical qtyDelta from src/lib/godownStock.ts via the '@/'
// loader (was a self-contained mirror before).
// Run: node scripts/test-godown-transfer.mjs
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

const { validateTransfer, buildTransferLegs } = await import(abs('../src/lib/godownTransfer.ts'));
const { qtyDelta } = await import(abs('../src/lib/godownStock.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Validation.
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G1', qty: 5, availableQty: 10 }).ok, 'same godown rejected');
ok(!validateTransfer({ fromGodownId: '', toGodownId: 'G2', qty: 5, availableQty: 10 }).ok, 'missing source rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 0, availableQty: 10 }).ok, 'zero qty rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: -3, availableQty: 10 }).ok, 'negative qty rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 15, availableQty: 10 }).ok, 'over-available rejected');
ok(validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 10, availableQty: 10 }).ok, 'exactly available allowed');
ok(validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 4, availableQty: 10 }).ok, 'within available allowed');

// 2. Legs — signs, godowns, shared ref, both adjustment.
const [out, inn] = buildTransferLegs({ itemId: 'A', fromGodownId: 'G1', toGodownId: 'G2', qty: 30, rate: 50, date: '2026-04-10', transferNo: 'TRF/1', fromLabel: 'मुख्य', toLabel: 'शाखा' });
ok(out.type === 'adjustment' && inn.type === 'adjustment', 'both legs are adjustments (no formula change)');
ok(out.qty === -30 && out.godownId === 'G1', 'OUT leg: -30 @ source');
ok(inn.qty === 30 && inn.godownId === 'G2', 'IN leg: +30 @ destination');
ok(out.referenceNo === 'TRF/1' && inn.referenceNo === 'TRF/1', 'shared TRF reference');
ok(out.amount === 1500 && inn.amount === 1500, 'value = qty × rate on both legs');
ok(inn.narration.includes('मुख्य') && out.narration.includes('शाखा'), 'narration carries godown labels');

// 3. Under the canonical formula the pair nets to zero society-wide but shifts per godown.
const societyDelta = qtyDelta(out.type, out.qty) + qtyDelta(inn.type, inn.qty);
ok(societyDelta === 0, 'society-wide net delta = 0 (total stock unchanged)');
ok(qtyDelta(out.type, out.qty) === -30, 'source godown -30');
ok(qtyDelta(inn.type, inn.qty) === 30, 'destination godown +30');

console.log(`\nGodown transfer (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
