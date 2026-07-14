// GST export scaffold (ECR-22 slice D). Imports the REAL src/lib/gstExport.ts via the '@/'
// loader (was a self-contained mirror before).
// Run: node scripts/test-gst-export.mjs
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

const { buildGstr9Export } = await import(abs('../src/lib/gstExport.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const g = {
  outward: { taxableValue: 14000, cgst: 810, sgst: 810, igst: 900, tax: 2520 },
  itcAvailed: { cgst: 360, sgst: 360, igst: 0, taxableValue: 4000, tax: 720 },
  itcReversed: { cgst: 45, sgst: 45, igst: 0, taxableValue: 500, tax: 90 },
  netItc: { cgst: 315, sgst: 315, igst: 0, taxableValue: 3500, tax: 630 },
  netLiability: { cgst: 495, sgst: 495, igst: 900, total: 1890 },
  creditCarryForward: { cgst: 0, sgst: 0, igst: 0, total: 0 },
  outwardByRate: [{ rate: 18, taxableValue: 14000, cgst: 810, sgst: 810, igst: 900 }],
};
const e = buildGstr9Export(g, ' 06aaaat8335l1z6 ', '2026-27');

ok(e.doc === 'GSTR9-DRAFT', 'doc tag = GSTR9-DRAFT');
ok(e.gstin === '06AAAAT8335L1Z6', 'GSTIN trimmed + upper-cased');
ok(e.fp === '2026-27', 'financial period label');
ok(e.outward_supplies.taxable_value === 14000 && e.outward_supplies.igst === 900, 'outward mapped');
ok(e.itc_availed.cgst === 360 && e.itc_reversed.cgst === 45 && e.net_itc.cgst === 315, 'ITC availed/reversed/net mapped');
ok(e.tax_payable_cash.total === 1890, 'net tax payable total');
ok(e.rate_wise.length === 1 && e.rate_wise[0].rate === 18 && e.rate_wise[0].taxable_value === 14000, 'rate-wise mapped');
ok(typeof e._disclaimer === 'string' && /NOT a certified/.test(e._disclaimer), 'disclaimer present (honest scaffold)');
ok(JSON.stringify(e).length > 0 && JSON.parse(JSON.stringify(e)).doc === 'GSTR9-DRAFT', 'serialises to valid JSON');

console.log(`\nGST export (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
