// GSTR-9 annual return (ECR-22). Imports the REAL src/lib/gstr9.ts via the '@/' loader
// (was a self-contained mirror before).
// Run: node scripts/test-gstr9.mjs
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

const { computeGSTR9 } = await import(abs('../src/lib/gstr9.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const FROM = '2026-04-01', TO = '2027-03-31';

// Intra-state sale 10,000 @ 18% (9+9); inter-state sale 5,000 @ 18% IGST.
const sales = [
  { date: '2026-05-10', netAmount: 10000, cgstAmount: 900, sgstAmount: 900, igstAmount: 0, cgstPct: 9, sgstPct: 9, igstPct: 0 },
  { date: '2026-06-01', netAmount: 5000, cgstAmount: 0, sgstAmount: 0, igstAmount: 900, cgstPct: 0, sgstPct: 0, igstPct: 18 },
  { date: '2025-03-31', netAmount: 99999, cgstAmount: 9999, sgstAmount: 9999, igstAmount: 0 }, // OUT of FY → excluded
];
const purchases = [
  { date: '2026-05-05', netAmount: 4000, cgstAmount: 360, sgstAmount: 360, igstAmount: 0, cgstPct: 9, sgstPct: 9 },
];
const salesReturns = [
  { date: '2026-07-01', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 }, // credit note
];
const purchaseReturns = [
  { date: '2026-08-01', netAmount: 500, cgstAmount: 45, sgstAmount: 45, igstAmount: 0 },
];
const g = computeGSTR9({ sales, purchases, salesReturns, purchaseReturns, from: FROM, to: TO });

// 1. Outward = sales − credit notes, FY-bounded (the 2025 row excluded).
ok(g.outward.taxableValue === 14000, 'outward taxable = 10000+5000−1000 = 14000 (out-of-FY row excluded)');
ok(g.outward.cgst === 810 && g.outward.sgst === 810 && g.outward.igst === 900, 'output tax net of credit note');
ok(g.outward.tax === 2520, 'total output tax = 810+810+900');

// 2. ITC availed and reversed.
ok(g.itcAvailed.cgst === 360 && g.itcAvailed.sgst === 360, 'ITC availed from purchases');
ok(g.itcReversed.cgst === 45 && g.itcReversed.sgst === 45, 'ITC reversed from debit notes');
ok(g.netItc.cgst === 315 && g.netItc.sgst === 315 && g.netItc.tax === 630, 'net ITC = availed − reversed');

// 3. Net liability per head = output − net ITC (floored at 0).
ok(g.netLiability.cgst === 495 && g.netLiability.sgst === 495 && g.netLiability.igst === 900, 'net GST payable per head');
ok(g.netLiability.total === 1890, 'total net GST payable = 495+495+900');

// 4. Credit carry-forward when ITC exceeds output on a head.
const g2 = computeGSTR9({ sales: [{ date: '2026-05-01', netAmount: 100, cgstAmount: 9, sgstAmount: 9, igstAmount: 0, cgstPct: 9, sgstPct: 9 }], purchases: [{ date: '2026-05-02', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 }], from: FROM, to: TO });
ok(g2.netLiability.cgst === 0 && g2.creditCarryForward.cgst === 81, 'ITC > output → 0 payable, 81 carry-forward');

// 5. Rate-wise outward, net of credit notes.
const r18 = g.outwardByRate.find(x => x.rate === 18);
ok(!!r18 && r18.taxableValue === 14000, 'rate-wise: 18% bucket taxable = 14000 (net of return)');
ok(g.outwardByRate.length === 1, 'only one rate bucket (18%)');

console.log(`\nGSTR-9 (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
