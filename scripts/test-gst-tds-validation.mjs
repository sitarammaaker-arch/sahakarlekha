// GST/TDS validation (ECR-22 slice C) — mirrors src/lib/gstTdsValidation.ts.
// Run: node scripts/test-gst-tds-validation.mjs
const r2 = (n) => Math.round(n * 100) / 100;
const VALID_RATES = new Set([0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28]);
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const validateGSTIN = (g) => !!g && GSTIN_RE.test(g.trim().toUpperCase());
const rateOf = (rec) => { const igst = rec.igstAmount || 0; return igst > 0 ? (rec.igstPct || 0) : r2((rec.cgstPct || 0) + (rec.sgstPct || 0)); };
function validateGstRecord(rec) {
  const issues = []; const ref = rec.ref || '?';
  const taxable = rec.netAmount || 0, cgst = rec.cgstAmount || 0, sgst = rec.sgstAmount || 0, igst = rec.igstAmount || 0;
  if ((cgst > 0 || sgst > 0) && igst > 0) issues.push({ ref, field: 'gst', severity: 'error', message: 'both' });
  if (igst === 0 && Math.abs(cgst - sgst) > 0.5) issues.push({ ref, field: 'gst', severity: 'error', message: 'cgst!=sgst' });
  const rate = rateOf(rec);
  if (rate > 0 && taxable > 0) { const expected = r2((taxable * rate) / 100); const actual = r2(cgst + sgst + igst); if (Math.abs(expected - actual) > 1) issues.push({ ref, field: 'gst', severity: 'warn', message: 'taxmismatch' }); }
  if (rate > 0 && !VALID_RATES.has(rate)) issues.push({ ref, field: 'rate', severity: 'warn', message: 'oddrate' });
  if (rec.gstin && !validateGSTIN(rec.gstin)) issues.push({ ref, field: 'gstin', severity: 'error', message: 'badgstin' });
  return issues;
}
function validateTds(rec) { const amount = rec.amount || 0, threshold = rec.threshold ?? 0; if (threshold > 0 && amount > threshold && (rec.tdsAmount || 0) <= 0) return [{ ref: rec.ref || '?', field: 'tds', severity: 'warn', message: 'notds' }]; return []; }

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
ok(validateGstRecord({ ref: 'S5', netAmount: 1000, cgstAmount: 50, sgstAmount: 50, igstAmount: 0, cgstPct: 9, sgstPct: 9 }).some(i => i.message === 'taxmismatch'), 'tax vs rate mismatch flagged');

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
