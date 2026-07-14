// Warehouse documents (ECR-20) — imports the REAL src/lib/warehouseDoc.ts via the
// '@/' loader. Run: node scripts/test-warehouse-doc.mjs
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

const { warehouseDocKind, buildWarehouseDoc } = await import(abs('../src/lib/warehouseDoc.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Kind by direction.
ok(warehouseDocKind('purchase', 100) === 'WHR', 'purchase → WHR');
ok(warehouseDocKind('opening', 50) === 'WHR', 'opening → WHR');
ok(warehouseDocKind('adjustment', 5) === 'WHR', 'positive adjustment → WHR');
ok(warehouseDocKind('sale', 30) === 'GatePass', 'sale → Gate Pass');
ok(warehouseDocKind('adjustment', -5) === 'GatePass', 'negative adjustment → Gate Pass');

// 2. WHR document content.
{
  const d = buildWarehouseDoc({ movementType: 'purchase', qty: 100, date: '2026-04-01', referenceNo: 'PUR/1', docNo: 'WHR/1', societyName: 'ग्राम सेवा', godownName: 'मुख्य गोदाम', itemName: 'गेहूँ', itemUnit: 'क्विंटल' });
  ok(d.kind === 'WHR' && d.title.includes('गोदाम रसीद'), 'WHR title');
  ok(d.fields.find(f => f.label.includes('मात्रा')).value === '100 क्विंटल', 'qty with unit');
  ok(d.fields.find(f => f.label.includes('वस्तु')).value === 'गेहूँ', 'item name');
  ok(d.manualFields.includes('जमाकर्ता (Depositor)'), 'WHR has depositor blank');
}

// 3. Gate pass document content — outward qty shown as magnitude.
{
  const d = buildWarehouseDoc({ movementType: 'adjustment', qty: -30, date: '2026-04-10', referenceNo: 'TRF/1', docNo: 'GP/1', societyName: 'ग्राम सेवा', godownName: 'शाखा', itemName: 'चावल' });
  ok(d.kind === 'GatePass' && d.title.includes('निकासी'), 'Gate pass title');
  ok(d.fields.find(f => f.label.includes('मात्रा')).value === '30', 'outward qty as magnitude (30, no unit)');
  ok(d.manualFields.includes('वाहन संख्या (Vehicle no.)'), 'gate pass has vehicle blank');
  ok(d.docNo === 'GP/1' && d.societyName === 'ग्राम सेवा', 'docNo + society carried');
}

// 4. Missing date → blank (fill by hand).
{
  const d = buildWarehouseDoc({ movementType: 'purchase', qty: 10, docNo: 'WHR/2', societyName: 'S', godownName: 'G', itemName: 'I' });
  ok(d.fields.find(f => f.label.includes('दिनांक')).value === '', 'missing date → blank');
  ok(d.fields.find(f => f.label.includes('संदर्भ')).value === '—', 'missing ref → dash');
}

console.log(`\nWarehouse doc (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
