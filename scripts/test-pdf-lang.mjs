// R12 PDF language (Hindi / bilingual labels) — the translation engine, the dictionary, and a ratchet that
// every REPORT label drawn by pdf.ts has a Hindi form.
// Run: node scripts/test-pdf-lang.mjs   (npm run test:pdf-lang)
import fs from 'node:fs';
import {
  normKey, buildLabelMap, lookupLabel, translateText, PATTERNS,
  getPdfLang, setPdfLang, loadPdfLang, subscribePdfLang, setTranslationMissSink,
} from '../src/lib/pdfLang.ts';
import { PDF_HI_EXTRA } from '../src/lib/pdfHindiLabels.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const DEVA = /[ऀ-ॿ]/;

// the app's own vocabulary, read from the source (the module is a React file, not importable here)
const lc = fs.readFileSync(new URL('../src/contexts/LanguageContext.tsx', import.meta.url), 'utf8');
const tr = {};
for (const m of lc.matchAll(/^\s*([A-Za-z0-9_]+):\s*\{\s*hi:\s*'((?:[^'\\]|\\.)*)',\s*en:\s*'((?:[^'\\]|\\.)*)'/gm)) tr[m[1]] = { hi: m[2], en: m[3] };
const appMap = buildLabelMap(tr);
const T = (s, lang = 'hi') => translateText(s, lang, appMap, PDF_HI_EXTRA);

// ── English is untouched ──
ok(T('Trial Balance', 'en') === 'Trial Balance' && T('Rs. 1,000.00 Dr', 'en') === 'Rs. 1,000.00 Dr', 'English mode returns every string unchanged');
ok(T('', 'hi') === '', 'empty string is safe');

// ── labels ──
ok(T('Receipts & Payments Account') === 'प्राप्ति एवं भुगतान खाता', 'a report title');
ok(T('Capital & Liabilities') === 'पूँजी एवं देयताएँ' && T('Assets') === 'परिसंपत्तियाँ', 'balance sheet sides');
ok(T('  Cash in Hand') === '  हाथ में नकद', 'leading indentation is kept (generators indent sub-items)');
ok(T('Secretary / Manager') === 'सचिव / प्रबंधक', 'signature label');
ok(T('GRAND TOTAL') === 'कुल योग' && T('Grand Total') === 'कुल योग', 'case-insensitive lookup');
ok(T('Account Head 12 (data)') === 'Account Head 12 (data)', 'unknown text (data) is left alone, never blanked');
ok(T('Kapil Nutri Store') === 'Kapil Nutri Store', 'a society name is never translated');

// the report dictionary wins over the app vocabulary
ok(lookupLabel('Total', appMap, { total: 'XX' }) === 'XX', 'report-specific term wins over the app term');
ok(lookupLabel('Total', appMap, {}) === (appMap.get('total')), 'falls back to the app vocabulary');
ok(appMap.size > 150, `the app vocabulary is loaded (${appMap.size} terms)`);

// ── patterns that carry a value ──
ok(T('Rs. 1,23,456.00') === 'रु. 1,23,456.00', 'amounts keep Latin digits, Rs. -> रु.');
ok(T('6,845.50 Dr') === '6,845.50 नामे' && T('500.00 Cr') === '500.00 जमा', 'Dr / Cr suffix -> नामे / जमा');
ok(T('Cash  Dr.') === 'Cash नामे', 'Day Book debit line (account name stays; the two spaces collapse to one)');
ok(T('    To Sales  Cr.Received') === '    प्रति Sales  जमाReceived', 'Day Book credit line with narration');
ok(T('To FDR') === 'प्रति FDR' && T('By Mystery Head') === 'द्वारा Mystery Head', 'To / By -> प्रति / द्वारा (an unknown account name stays)');
ok(T('By Salary') === 'द्वारा ' + (appMap.get('salary') ?? 'Salary'), 'To / By + a known label translates the account too (same word the screens use)');
ok(T('To Balance b/d (Opening)') === 'प्रति प्रारंभिक शेष (आगे लाया गया)', 'To + a known label translates both');
ok(T('Page 2 of 5') === 'पृष्ठ 2 / 5', 'page numbers');
ok(T('Report ID: SL-TB-503-20261004-ABC') === 'रिपोर्ट आईडी: SL-TB-503-20261004-ABC', 'Report ID label (the ID itself is untouched)');
ok(T('As on: 31/03/2027 | FY: 2026-27') === 'दिनांक: 31/03/2027 | वित्तीय वर्ष: 2026-27', 'As on + FY');
ok(T('As at 31st March 2027') === '31 मार्च 2027 को', 'As at 31st March');
ok(T('Period: 01/04/2026 to 30/04/2026') === 'अवधि: 01/04/2026 से 30/04/2026', 'period range');
ok(T('01/04/2026 to 30/04/2026 | FY: 2026-27') === '01/04/2026 से 30/04/2026 | वित्तीय वर्ष: 2026-27', 'Day Book subtitle (range + FY)');
ok(T('Account: Cash | 01/04/2026 to 30/04/2026') === 'खाता: Cash | 01/04/2026 से 30/04/2026', 'ledger subtitle');
ok(T('Reg. No: 503 | FY: 2026-27') === 'पंजीकरण सं.: 503 | वित्तीय वर्ष: 2026-27', 'registration line');
ok(T('Date: __________') === 'दिनांक: __________', 'signature date line');
ok(T('Confidential — For authorized use of Kapil Nutri Store only') === 'गोपनीय — केवल Kapil Nutri Store के अधिकृत उपयोग के लिए', 'confidentiality footer');
ok(T('Generated free with SahakarLekha · sahakarlekha.com') === 'सहकार लेखा द्वारा निःशुल्क तैयार · sahakarlekha.com', 'brand footer: two-word Devanagari brand, domain untouched');
ok(T('Total Members: 3   |   Total Share Capital: Rs. 600.00') === 'कुल सदस्य: 3   |   कुल अंश-पूँजी: रु. 600.00', 'share register totals line');
ok(T('Total Loans: 2   |   Total Disbursed: Rs. 5,000.00   |   Outstanding: Rs. 1,000.00') === 'कुल ऋण: 2   |   कुल वितरित: रु. 5,000.00   |   बकाया: रु. 1,000.00', 'loan register totals line');
ok(T('1 transaction(s)   Rcpt: Rs. 100.00   Pmnt: Rs. 0.00') === '1 लेन-देन   प्राप्ति: रु. 100.00   भुगतान: रु. 0.00', 'day-book day summary');

// ── bilingual ──
ok(T('Balance Sheet', 'bi') === 'तुलन-पत्र / Balance Sheet', 'bilingual label = हिंदी / English');
ok(T('As on: 31/03/2027', 'bi') === 'दिनांक: 31/03/2027 / As on: 31/03/2027', 'bilingual pattern keeps the English beside the Hindi');
ok(T('Rs. 1,000.00', 'bi') === 'Rs. 1,000.00' && T('6,845.50 Dr', 'bi') === '6,845.50 Dr' && T('Page 1 of 2', 'bi') === 'Page 1 of 2', 'figures and page numbers stay as they are in bilingual mode');
ok(T('Unknown thing', 'bi') === 'Unknown thing', 'unknown text is unchanged in bilingual mode too');

// ── idempotent: translating twice must not mangle ──
for (const s of ['Trial Balance', 'To FDR', '6,845.50 Dr', 'As on: 31/03/2027', 'Capital & Liabilities']) {
  const once = T(s), twice = T(once);
  ok(once === twice, `translating twice is harmless: "${s}"`);
}
ok(T(T('Balance Sheet', 'bi'), 'bi') === 'तुलन-पत्र / Balance Sheet', 'bilingual text is not re-wrapped');

// ── missing-label sink ──
const missed = [];
setTranslationMissSink(t => missed.push(t));
T('Mystery Column'); T('Trial Balance'); T('12345'); T('श्री राम');
setTranslationMissSink(null);
ok(missed.length === 1 && missed[0] === 'Mystery Column', 'only an unknown ENGLISH label is reported as missing');

// ── dictionary hygiene ──
const keys = Object.keys(PDF_HI_EXTRA);
ok(keys.length > 150, `report dictionary has ${keys.length} terms`);
ok(keys.every(k => k === normKey(k)), 'every key is lower-cased with single spaces (that is how lookups match)');
ok(keys.every(k => DEVA.test(PDF_HI_EXTRA[k])), 'every Hindi value contains Devanagari (no accidental English / empty value)');
ok(keys.every(k => PDF_HI_EXTRA[k].trim() === PDF_HI_EXTRA[k] && PDF_HI_EXTRA[k].length > 0), 'no stray whitespace in values');
ok(PATTERNS.every(r => r.re instanceof RegExp), 'patterns are regular expressions');

// ── the language setting ──
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
ok(getPdfLang() === 'en', 'default PDF language is English (nobody gets Hindi PDFs unless they choose)');
let notified = 0;
const off = subscribePdfLang(() => notified++);
setPdfLang('hi');
ok(getPdfLang() === 'hi' && store['sl-pdf-lang'] === 'hi' && notified === 1, 'setting is changed, persisted and announced');
setPdfLang('bi'); setPdfLang('nonsense');
ok(getPdfLang() === 'en', 'an invalid value falls back to English');
off(); setPdfLang('hi');
ok(notified === 3, 'unsubscribed listeners are not called');
store['sl-pdf-lang'] = 'bi'; setPdfLang('en'); store['sl-pdf-lang'] = 'bi';
ok(loadPdfLang() === 'bi' && getPdfLang() === 'bi', 'the saved choice is restored on load');
store['sl-pdf-lang'] = 'garbage';
ok(loadPdfLang() === 'bi', 'a corrupt saved value is ignored');
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
let threw = false; try { setPdfLang('hi'); loadPdfLang(); } catch { threw = true; }
ok(!threw, 'blocked storage (private mode) never throws');
delete globalThis.localStorage; setPdfLang('en');

// ── RATCHET: every label a REPORT generator draws has a Hindi form ──
// Per-document forms (invoice, voucher, salary slip, notices, application form, bills) are deliberately not
// translated yet — they are legal documents with their own review. A NEW report label must get its Hindi here.
const DOCUMENTS = ['MemberApplication', 'SaleInvoice', 'SalarySlip', 'DemandNotice', 'PurchaseRecord', 'MaintenanceBill', 'MaintenanceReceipt', 'Voucher'];
const src = fs.readFileSync(new URL('../src/lib/pdf.ts', import.meta.url), 'utf8');
const fns = [...src.matchAll(/export function generate([A-Za-z]+)PDF\(/g)].map(m => ({ n: m[1], at: m.index }));
const owner = (i) => { let o = 'helper'; for (const f of fns) if (f.at <= i) o = f.n; return o; };
const labels = new Map();
const add = (s, where) => { if (!labels.has(s)) labels.set(s, new Set()); labels.get(s).add(where); };
for (const m of src.matchAll(/(head|foot):\s*\[\[([\s\S]*?)\]\]/g)) for (const s of m[2].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) add((s[1] ?? s[2]).replace(/\\'/g, "'"), owner(m.index));
for (const m of src.matchAll(/addHeader\(doc,\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1], owner(m.index));
for (const m of src.matchAll(/addSignatureBlock\(doc,[^,]+,\s*\[([\s\S]*?)\]/g)) for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) for (const part of s[1].split('\\n')) add(part, owner(m.index));
for (const m of src.matchAll(/doc\.text\('((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), owner(m.index));
const reportMisses = [];
for (const [s, where] of labels) {
  if (!/[A-Za-z]{2,}/.test(s)) continue;     // 2+ letters: catches short heads like "S.No", "Qty", "Dr"
  const reportOnly = [...where].filter(w => !DOCUMENTS.includes(w));
  if (reportOnly.length === 0) continue;                       // used only by a per-document form
  if (T(s) === s) reportMisses.push(`${JSON.stringify(s)} <${reportOnly.join(',')}>`);
}
ok(reportMisses.length === 0, `${reportMisses.length} report label(s) have no Hindi — add them to src/lib/pdfHindiLabels.ts:\n      ${reportMisses.join('\n      ')}`);
ok(labels.size > 150, `the scan saw the static labels (${labels.size})`);

console.log(`\nPDF language: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
