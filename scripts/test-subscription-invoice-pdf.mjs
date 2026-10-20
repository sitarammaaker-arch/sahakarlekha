// Subscription tax-invoice list + PDF (billing slice 2). Renders the REAL generateSubscriptionInvoicePDF
// (esbuild bundle + jsPDF's node build) from frozen invoice rows and inspects the produced document;
// checks invoiceView's paise → rupee figures, and statically guards the read-only list wiring.
// Run: node scripts/test-subscription-invoice-pdf.mjs   (npm run test:subscription-invoice-pdf)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'sub-inv-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
(globalThis as any).window = (globalThis as any).window || {};
import * as pdf from '@/lib/pdf';
import { invoiceView, stateLabel } from '@/lib/billing/invoiceView';
const base: any = {
  id: 'i1', invoice_no: 'SL/2026-27/0001', invoice_date: '2026-10-20', order_id: 'order_X', payment_id: 'pay_Y',
  plan: 'starter', kind: 'new', seller_name: 'Seller Pvt Ltd', seller_gstin: '06ABCDE1234F1Z5',
  seller_address: 'Karnal', seller_state_code: '06', buyer_name: 'Kisan PACS Ltd', buyer_address: 'Assandh, Haryana',
  buyer_state_code: '06', buyer_gstin: null, place_of_supply: '06', sac: 'SAC-TBD', gst_rate_pct: '18',
  taxable_paise: 127034, cgst_paise: 11433, sgst_paise: 11433, igst_paise: 0, total_paise: 149900,
};
const inter: any = { ...base, invoice_no: 'SL/2026-27/0002', kind: 'upgrade', plan: 'plus', buyer_state_code: '07', place_of_supply: '07',
  buyer_gstin: '07ABCDE1234F1Z5', cgst_paise: 0, sgst_paise: 0, igst_paise: 22866 };
module.exports = {
  intraDoc: pdf.generateSubscriptionInvoicePDF(base, { save: false }).output(),
  interDoc: pdf.generateSubscriptionInvoicePDF(inter, { save: false }).output(),
  vIntra: invoiceView(base), vInter: invoiceView(inter),
  labels: [stateLabel('06'), stateLabel('99')],
};
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { intraDoc, interDoc, vIntra, vInter, labels } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const has = (d, s) => d.includes(s);

// ── invoiceView ──────────────────────────────────────────────────────────────
ok(vIntra.intra && vIntra.taxable === 1270.34 && vIntra.cgst === 114.33 && vIntra.sgst === 114.33 && vIntra.total === 1499, 'intra view: 1270.34 + 114.33 + 114.33 = 1499');
ok(Math.abs(vIntra.tax - 228.66) < 1e-9 && vIntra.rate === 18 && vIntra.halfRate === 9, 'tax 228.66; string rate "18" → 18, halves 9');
ok(!vInter.intra && vInter.igst === 228.66 && vInter.cgst === 0, 'inter view: IGST only');
ok(vIntra.fileName === 'Invoice_SL_2026-27_0001.pdf', `file name has no slashes (${vIntra.fileName})`);
ok(/upgrade for the remaining period/.test(vInter.description) && /Plus plan/.test(vInter.description), 'upgrade is not described as a full year');
ok(/Starter plan, 1 year$/.test(vIntra.description), 'new order described as 1 year');
ok(labels[0] === '06 - Haryana' && labels[1] === '99', 'state label from code; unknown code printed as-is');

// ── PDF content ──────────────────────────────────────────────────────────────
ok(has(intraDoc, '(TAX INVOICE)'), 'heading TAX INVOICE');
for (const s of ['SL/2026-27/0001', 'GSTIN: 06ABCDE1234F1Z5', 'Seller Pvt Ltd', 'Kisan PACS Ltd', '06 - Haryana', 'SAC-TBD', 'pay_Y'])
  ok(has(intraDoc, s), `intra PDF shows ${s}`);
ok(has(intraDoc, 'CGST @ 9%') && has(intraDoc, 'SGST @ 9%') && !has(intraDoc, 'IGST @'), 'intra PDF: CGST + SGST at half rate, no IGST');
ok(has(intraDoc, 'Rs. 1,270.34') && has(intraDoc, 'Rs. 114.33') && has(intraDoc, 'Rs. 1,499.00'), 'intra PDF amounts to the paisa');
ok(has(intraDoc, 'One Thousand Four Hundred Ninety-Nine Rupees Only'), 'amount in words');
ok(has(interDoc, 'IGST @ 18%') && !has(interDoc, 'CGST @') && has(interDoc, 'Rs. 228.66'), 'inter PDF: IGST at full rate only');
ok(has(interDoc, 'GSTIN: 07ABCDE1234F1Z5') && has(interDoc, '07 - Delhi'), 'inter PDF: buyer GSTIN + Delhi place of supply');

// ── Wiring (static) ──────────────────────────────────────────────────────────
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const lib = read('src/lib/billing/invoices.ts');
const comp = read('src/components/billing/SubscriptionInvoices.tsx');
const um = read('src/pages/UserManagement.tsx');
ok(/from\('invoices'\)\.select\(INVOICE_COLUMNS\)/.test(lib) && !/\.(insert|update|upsert|delete)\(/.test(lib + comp), 'list only READS invoices — no client write path');
ok(/if \(error\) return \{ rows: \[\], error: error\.message \}/.test(lib) && /\{error \? \(/.test(comp), 'a read error is shown, not swallowed');
ok(/import\('@\/lib\/pdf'\)/.test(comp) && /generateSubscriptionInvoicePDF\(inv\)/.test(comp), 'PDF built on demand from the row (pdf.ts lazy-loaded)');
ok(/<SubscriptionInvoices societyId=\{currentUser\?\.societyId \|\| ''\} hi=\{hi\} \/>/.test(um), 'User Management shows the invoices card');
ok(!/lib\/supabase/.test(read('src/lib/billing/invoiceView.ts')), 'invoiceView.ts stays pure — pdf.ts must not pull in the DB client');
const pdfSrc = read('src/lib/pdf.ts');
const fn = pdfSrc.slice(pdfSrc.indexOf('export function generateSubscriptionInvoicePDF('), pdfSrc.indexOf('export interface VoucherPDFInput'));
ok(fn.length > 0 && !/society\./.test(fn), 'the PDF reads only the frozen row — never current society settings');

console.log(`subscription-invoice-pdf: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
