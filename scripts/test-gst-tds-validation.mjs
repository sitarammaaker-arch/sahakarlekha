// GST/TDS validation (ECR-22 slice C) — imports the REAL src/lib/gstTdsValidation.ts
// via the '@/' loader. Run: node scripts/test-gst-tds-validation.mjs
//
// NOTE: the mirror asserted short message codes ('taxmismatch', 'both', …); the real
// module emits human-readable sentences with the SAME detection logic. The two clean-
// record / field-based (has(issues,field)) / severity assertions already match the real
// structural signal unchanged; the one message-equality assertion (tax-vs-rate mismatch)
// is re-keyed to the real structural signal (field:'gst', severity:'warn', message⊃'taxable').
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

const { validateGSTIN, validateGstRecord, validateTds } = await import(abs('../src/lib/gstTdsValidation.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const has = (issues, field) => issues.some(i => i.field === field);

// 1. Clean intra-state 18% record → no issues.
ok(validateGstRecord({ ref: 'S1', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, cgstPct: 9, sgstPct: 9 }).length === 0, 'clean intra-state record → no issues');

// 2. Clean inter-state 18% IGST → no issues.
ok(validateGstRecord({ ref: 'S2', netAmount: 1000, cgstAmount: 0, sgstAmount: 0, igstAmount: 180, igstPct: 18 }).length === 0, 'clean inter-state record → no issues');

// 3. Both CGST/SGST and IGST → error.
ok(has(validateGstRecord({ ref: 'S3', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 180 }), 'gst'), 'intra + inter conflict flagged');

// 4. CGST ≠ SGST → error.
const r4 = validateGstRecord({ ref: 'S4', netAmount: 1000, cgstAmount: 90, sgstAmount: 50, igstAmount: 0, cgstPct: 9, sgstPct: 9 });
ok(r4.some(i => i.severity === 'error' && i.field === 'gst'), 'CGST≠SGST flagged as error');

// 5. Tax ≠ taxable × rate → warn.
ok(validateGstRecord({ ref: 'S5', netAmount: 1000, cgstAmount: 50, sgstAmount: 50, igstAmount: 0, cgstPct: 9, sgstPct: 9 }).some(i => i.field === 'gst' && i.severity === 'warn' && i.message.includes('taxable')), 'tax vs rate mismatch flagged (re-keyed: field=gst, severity=warn, message⊃"taxable")');

// 6. Odd rate → warn.
ok(has(validateGstRecord({ ref: 'S6', netAmount: 1000, cgstAmount: 65, sgstAmount: 65, igstAmount: 0, cgstPct: 6.5, sgstPct: 6.5 }), 'rate'), 'unusual rate 13% flagged');

// 7. GSTIN format.
ok(validateGSTIN('06AAAAT8335L1Z6'), 'valid GSTIN passes');
ok(!validateGSTIN('06AAAAT8335L1Z'), 'short GSTIN fails');
ok(!validateGSTIN('INVALID'), 'garbage GSTIN fails');
ok(has(validateGstRecord({ ref: 'S7', netAmount: 100, cgstAmount: 9, sgstAmount: 9, igstAmount: 0, cgstPct: 9, sgstPct: 9, gstin: 'BADGSTIN' }), 'gstin'), 'bad GSTIN on a record flagged');

// 8. TDS threshold.
ok(validateTds({ ref: 'P1', amount: 50000, tdsAmount: 0, threshold: 30000 }).length === 1, 'above threshold, no TDS → flagged');
ok(validateTds({ ref: 'P2', amount: 50000, tdsAmount: 500, threshold: 30000 }).length === 0, 'above threshold WITH TDS → ok');
ok(validateTds({ ref: 'P3', amount: 20000, tdsAmount: 0, threshold: 30000 }).length === 0, 'below threshold → ok');

console.log(`\nGST/TDS validation (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
