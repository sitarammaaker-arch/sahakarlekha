/**
 * PDF language (R12): a report can be published in English (default), Hindi, or bilingual.
 *
 *   en  — exactly today's PDFs (no change for anyone who does not opt in)
 *   hi  — statutory labels, headings, column heads, signature lines in Hindi
 *   bi  — "हिंदी / English" in one string: the safest choice for a document an auditor or the Registrar reads
 *
 * HOW IT WORKS (no generator is rewritten): every label the PDF layer draws — table cells, headings, footer —
 * passes through `translateText`, an exact-match dictionary of the English labels the generators already use,
 * plus patterns for labels that carry a value ("As on: 31/03/2027", "Page 1 of 3", "To Cash", "Rs. 1,000 Dr").
 * Anything not in the dictionary stays as it is (English), so a missing term can never blank or break a report.
 * Hindi text is then drawn by the BROWSER (lib/pdfDevanagari.ts) because jsPDF cannot shape Devanagari even with
 * an embedded font (matras / conjuncts) — embedding a font would print WRONG Hindi.
 *
 * The vocabulary is the app's own: `buildLabelMap(translations)` takes the Hindi the screens already show, so a
 * PDF says things the way the page did. `PDF_HI_EXTRA` (pdfHindiLabels.ts) adds report-only terms and wins on a
 * clash. EVERY Hindi term is a presentation choice → EXTERNAL VALIDATION NEEDED with a CA / the cooperative
 * department before it is relied on in a statutory submission (one place to correct: pdfHindiLabels.ts).
 *
 * PURE and dependency-free (the language setting aside), so scripts/test-pdf-lang.mjs imports it directly.
 */

export type PdfLang = 'en' | 'hi' | 'bi';
const STORAGE_KEY = 'sl-pdf-lang';

let current: PdfLang = 'en';
const listeners = new Set<() => void>();

const isLang = (v: unknown): v is PdfLang => v === 'en' || v === 'hi' || v === 'bi';

/** Read the saved choice (browser only). Safe to call anywhere; falls back to English. */
export function loadPdfLang(): PdfLang {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (isLang(v)) current = v;
  } catch { /* private mode / blocked storage -> keep the in-memory value */ }
  return current;
}
export function getPdfLang(): PdfLang { return current; }
export function setPdfLang(lang: PdfLang): void {
  current = isLang(lang) ? lang : 'en';
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
  listeners.forEach(l => l());
}
export function subscribePdfLang(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

// ─── dictionary ────────────────────────────────────────────────────────────────────────

/** Case/space-insensitive key for a label. */
export function normKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The app's own English->Hindi vocabulary (the `translations` object the screens use). */
export function buildLabelMap(translations: Record<string, { hi: string; en: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of Object.values(translations)) {
    if (v && v.en && v.hi) map.set(normKey(v.en), v.hi);
  }
  return map;
}

/** Look a label up: the report-specific dictionary wins over the app vocabulary. */
export function lookupLabel(text: string, appMap: Map<string, string>, extra: Record<string, string>): string | undefined {
  const k = normKey(text);
  if (!k) return undefined;
  return extra[k] ?? appMap.get(k);
}

// ─── patterns: labels that carry a value ───────────────────────────────────────────────

/** `Dr` / `Cr` on a balance. नामे / जमा are the standard Hindi accounting terms (the app shows "नाम (डेबिट)"). */
const SIDE: Record<string, string> = { Dr: 'नामे', Cr: 'जमा', 'Dr.': 'नामे', 'Cr.': 'जमा' };
const toHiRange = (s: string) => s.replace(/\s+to\s+/i, ' से ');

interface Rule {
  re: RegExp;
  /** `tr` translates a fragment with the same dictionary (for "To <account>" style prefixes). */
  to: (m: RegExpMatchArray, tr: (s: string) => string) => string;
  /** In bilingual mode keep the English as it is (figures, page numbers) instead of "hindi / english". */
  keepEnglishInBi?: boolean;
}

export const PATTERNS: Rule[] = [
  // figures and balances — Latin digits stay (so a figure reads the same in every language)
  { re: /^Rs\.\s*(.+)$/, to: m => `रु. ${m[1]}`, keepEnglishInBi: true },
  { re: /^(.+?)\s+(Dr|Cr)\.?$/, to: m => `${m[1]} ${SIDE[m[2]]}`, keepEnglishInBi: true },
  { re: /^Page (\d+) of (\d+)$/i, to: m => `पृष्ठ ${m[1]} / ${m[2]}`, keepEnglishInBi: true },
  // header / footer lines
  { re: /^Report ID:\s*(.+)$/i, to: m => `रिपोर्ट आईडी: ${m[1]}`, keepEnglishInBi: true },
  { re: /^Prepared on:\s*(.+)$/i, to: m => `तैयार किया गया: ${m[1]}` },
  { re: /^Reg\. ?No:?\s*(.+?)\s*\|\s*FY:\s*(.+)$/i, to: m => `पंजीकरण सं.: ${m[1]} | वित्तीय वर्ष: ${m[2]}` },
  { re: /^Financial Year:\s*(.+)$/i, to: m => `वित्तीय वर्ष: ${m[1]}` },
  { re: /^Period:\s*(.+)$/i, to: m => `अवधि: ${toHiRange(m[1])}` },
  // Day Book subtitle: "01/04/2026 to 30/04/2026 | FY: 2026-27"
  { re: /^(\d{2}\/\d{2}\/\d{4}) to (\d{2}\/\d{2}\/\d{4})\s*\|\s*FY:\s*(.+)$/i, to: m => `${m[1]} से ${m[2]} | वित्तीय वर्ष: ${m[3]}` },
  { re: /^As on:\s*(.+?)(\s*\|\s*FY:\s*(.+))?$/i, to: m => `दिनांक: ${m[1]}${m[3] ? ` | वित्तीय वर्ष: ${m[3]}` : ''}` },
  { re: /^As at 31st March (\d{4})$/i, to: m => `31 मार्च ${m[1]} को` },
  { re: /^Account:\s*(.+?)\s*\|\s*(.+)$/i, to: m => `खाता: ${m[1]} | ${toHiRange(m[2])}` },
  { re: /^Date:\s*(_+)$/i, to: m => `दिनांक: ${m[1]}`, keepEnglishInBi: true },
  { re: /^Member Signature:\s*(_+)$/i, to: m => `सदस्य के हस्ताक्षर: ${m[1]}` },
  { re: /^Secretary:\s*(_+)$/i, to: m => `सचिव: ${m[1]}` },
  { re: /^Confidential\s*—\s*For authorized use of (.+) only$/i, to: m => `गोपनीय — केवल ${m[1]} के अधिकृत उपयोग के लिए` },
  { re: /^Generated free with SahakarLekha\s*·\s*(.+)$/i, to: m => `सहकार लेखा द्वारा निःशुल्क तैयार · ${m[1]}`, keepEnglishInBi: true },
  // "To <account>" / "By <account>" — प्रति / द्वारा are the Hindi accounting words for To / By
  { re: /^(\s*)To (.+?)\s+Cr\.(.*)$/, to: (m) => `${m[1]}प्रति ${m[2]}  जमा${m[3]}` },   // Day Book credit line (account + narration)
  { re: /^(\s*)To (.+)$/, to: (m, tr) => `${m[1]}प्रति ${tr(m[2])}` },
  { re: /^(\s*)By (.+)$/, to: (m, tr) => `${m[1]}द्वारा ${tr(m[2])}` },
  // totals lines
  { re: /^Total:\s*(Rs\.\s*.+)$/i, to: m => `कुल: रु.${m[1].replace(/^Rs\./i, '')}` },
  { re: /^(\d+) transaction\(s\)\s+Rcpt:\s*Rs\.\s*(\S+)\s+Pmnt:\s*Rs\.\s*(\S+)$/i, to: m => `${m[1]} लेन-देन   प्राप्ति: रु. ${m[2]}   भुगतान: रु. ${m[3]}` },
  { re: /^Cash in Hand \((Opening|Closing)\):\s*Rs\.\s*(.+)$/i, to: m => `हाथ में नकद (${/open/i.test(m[1]) ? 'प्रारंभिक' : 'अंतिम'}): रु. ${m[2]}` },
  { re: /^Total Members:\s*(\d+)\s*\|\s*Total Share Capital:\s*Rs\.\s*(.+)$/i, to: m => `कुल सदस्य: ${m[1]}   |   कुल अंश-पूँजी: रु. ${m[2]}` },
  { re: /^Total Loans:\s*(\d+)\s*\|\s*Total Disbursed:\s*Rs\.\s*(\S+)\s*\|\s*Outstanding:\s*Rs\.\s*(\S+)$/i, to: m => `कुल ऋण: ${m[1]}   |   कुल वितरित: रु. ${m[2]}   |   बकाया: रु. ${m[3]}` },
];

/** Recorded when a label has NO Hindi — lets tests (and the developer) see what is still English. */
let missSink: ((text: string) => void) | null = null;
export function setTranslationMissSink(fn: ((text: string) => void) | null): void { missSink = fn; }

/**
 * PURE (given the maps) — the text to draw for `text` in language `lang`.
 *  - en -> unchanged;  hi -> Hindi when known, else the original;  bi -> "हिंदी / English" when known.
 * Leading indentation is kept (the generators indent sub-items with spaces). Values (numbers, dates, names)
 * are never touched. Already-Hindi text is never re-translated, so translating twice is harmless.
 */
export function translateText(
  text: string,
  lang: PdfLang,
  appMap: Map<string, string>,
  extra: Record<string, string>,
): string {
  if (lang === 'en' || !text) return text;
  const indent = (text.match(/^\s*/) ?? [''])[0];
  const core = text.slice(indent.length).replace(/\s+$/, '');
  const trailing = text.slice(indent.length + core.length);
  const again = (s: string) => translateText(s, lang === 'bi' ? 'hi' : lang, appMap, extra);

  const hit = lookupLabel(core, appMap, extra);
  if (hit !== undefined) return indent + (lang === 'bi' ? `${hit} / ${core}` : hit) + trailing;

  for (const rule of PATTERNS) {
    const m = core.match(rule.re);
    if (!m) continue;
    if (lang === 'bi' && rule.keepEnglishInBi) return text;
    const out = rule.to(m, again);
    return indent + (lang === 'bi' ? `${out} / ${core}` : out) + trailing;
  }
  // Already-Hindi text (e.g. "Cash नामे": an account name + a translated side) is not a missing label.
  if (missSink && /[A-Za-z]{3,}/.test(core) && !/[ऀ-ॿ]/.test(core)) missSink(core);
  return text;
}
