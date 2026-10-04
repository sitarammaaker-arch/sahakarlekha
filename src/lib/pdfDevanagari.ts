/**
 * Hindi (Devanagari) inside PDF tables.
 *
 * jsPDF's fonts have no Devanagari, and jsPDF cannot SHAPE Devanagari (matras / conjuncts) even with
 * an embedded font — so a member's name or a narration typed in Hindi printed as garbage. The
 * browser shapes Devanagari correctly, so a table cell that contains Hindi is drawn by the browser on
 * a canvas and placed in the cell as an image:
 *   1. didParseCell  — the cell keeps a width-alike Latin placeholder, so autoTable sizes and wraps it;
 *   2. willDrawCell  — the placeholder is not drawn;
 *   3. didDrawCell   — the real text, wrapped to the cell, is drawn on a canvas and added as an image.
 * Installed ONCE as an autoTable global default, so every PDF table in the app gets it. No-op outside
 * a browser (tests, SSR).
 *
 * R12 (Hindi labels): the same machinery now also
 *   - TRANSLATES every label (table cells and headings) when the PDF language is Hindi / bilingual
 *     (lib/pdfLang.ts), before the Devanagari check, so a translated label is drawn by the browser too;
 *   - draws ANY doc.text(...) that contains Devanagari — headings, header lines, footer, a Hindi society
 *     name — as a canvas image at the same position, size, colour and alignment (previously: garbage).
 * With the PDF language English (the default) nothing is translated and only text that already contains
 * Devanagari takes the image path, exactly as before.
 */
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { getPdfLang, loadPdfLang, translateText, buildLabelMap } from '@/lib/pdfLang';
import { PDF_HI_EXTRA } from '@/lib/pdfHindiLabels';

const DEVA = /[ऀ-ॿ]/;
const MARK = /[ऀ-ःऺ-ॏ॑-ॗॢॣ]/; // combining signs take no width of their own

/** Latin stand-in of roughly the same width, so autoTable wraps and sizes the cell sensibly. */
export function devanagariPlaceholder(text: string): string {
  let out = '';
  for (const ch of text) out += MARK.test(ch) ? '' : DEVA.test(ch) ? 'n' : ch;
  return out;
}
export const hasDevanagari = (s: string) => DEVA.test(s);

type CellLike = {
  text: string[]; x: number; y: number; width: number; height: number;
  styles: { fontSize: number; fontStyle?: string; halign?: string; valign?: string; textColor?: unknown; cellPadding?: unknown };
  padding: (side: 'top' | 'bottom' | 'left' | 'right') => number;
};
const DEVA_KEY = '__devanagariText';

function colorCss(c: unknown): string {
  if (Array.isArray(c)) return `rgb(${c[0] ?? 0},${c[1] ?? 0},${c[2] ?? 0})`;
  if (typeof c === 'number') return `rgb(${c},${c},${c})`;
  if (typeof c === 'string') return c;
  return '#000';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(tryLine).width <= maxWidth || !line) line = tryLine;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

function drawCell(doc: jsPDF, cell: CellLike, text: string) {
  const MM_TO_PX = 3.7795 * 3;                 // 3× for a crisp image
  const w = Math.max(1, cell.width - cell.padding('left') - cell.padding('right'));
  const h = Math.max(1, cell.height - cell.padding('top') - cell.padding('bottom'));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * MM_TO_PX);
  canvas.height = Math.ceil(h * MM_TO_PX);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Devanagari marks sit ABOVE the headline (े ं ी ँ) and below it (ु ृ): lay lines out by the font's
  // real ink box, not a Latin line height — and shrink the font rather than clip a mark.
  let fontPx = cell.styles.fontSize * 0.3528 * MM_TO_PX;   // pt → mm → px
  const setFont = () => { ctx.font = `${cell.styles.fontStyle === 'bold' ? 'bold ' : ''}${fontPx}px "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Kohinoor Devanagari", sans-serif`; };
  setFont();
  let lines = wrap(ctx, text, canvas.width);
  const box = () => {
    let a = 0, d = 0;
    for (const l of lines) { const m = ctx.measureText(l || ' '); a = Math.max(a, m.actualBoundingBoxAscent || fontPx); d = Math.max(d, m.actualBoundingBoxDescent || fontPx * 0.3); }
    return { a, d, lineH: (a + d) * 1.08 };
  };
  let b = box();
  for (let i = 0; i < 6 && lines.length * b.lineH > canvas.height; i++) {
    fontPx *= Math.max(0.6, canvas.height / (lines.length * b.lineH));
    setFont(); lines = wrap(ctx, text, canvas.width); b = box();
  }
  ctx.fillStyle = colorCss(cell.styles.textColor);
  ctx.textBaseline = 'alphabetic';
  const blockH = lines.length * b.lineH;
  let y = (cell.styles.valign === 'middle' ? Math.max(0, (canvas.height - blockH) / 2) : cell.styles.valign === 'bottom' ? Math.max(0, canvas.height - blockH) : 0) + b.a;
  for (const line of lines) {
    const lw = ctx.measureText(line).width;
    const x = cell.styles.halign === 'right' ? canvas.width - lw : cell.styles.halign === 'center' ? (canvas.width - lw) / 2 : 0;
    ctx.fillText(line, x, y);
    y += b.lineH;
  }
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', cell.x + cell.padding('left'), cell.y + cell.padding('top'), w, h, undefined, 'FAST');
}

// The app's own Hindi vocabulary + the report-only terms (built once).
// The vocabulary is INJECTED (ExportContextBinder passes LanguageContext's `translations`) rather than imported, so
// this module stays loadable without React (tests, workers). Without it only the report dictionary applies.
let appMap: Map<string, string> = new Map();
export function setAppVocabulary(translations: Record<string, { hi: string; en: string }>): void {
  appMap = buildLabelMap(translations);
}
export function tr(text: string): string {
  const lang = getPdfLang();
  if (lang === 'en') return text;
  return translateText(text, lang, appMap, PDF_HI_EXTRA);
}

type TextPayload = { text: string | string[]; x: number; y: number; options?: Record<string, unknown> };

/** Draw one Devanagari string with doc.text()'s own position / size / colour / alignment, as a canvas image. */
function drawTextImage(doc: jsPDF, text: string, x: number, y: number, options: Record<string, unknown> = {}): boolean {
  if (typeof document === 'undefined') return false;
  const PX = 3.7795 * 3;                                   // mm -> px at 3x for a crisp image
  const sizePt = doc.getFontSize();
  const bold = String(doc.getFont()?.fontStyle ?? '').includes('bold');
  let fontPx = sizePt * 0.3528 * PX;
  const fontFor = (px: number) => `${bold ? 'bold ' : ''}${px}px "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Kohinoor Devanagari", sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return false;
  measure.font = fontFor(fontPx);
  // fitWidth (mm): keep ONE line and shrink the font to fit, e.g. a long Hindi society name in the page header.
  if (typeof options.fitWidth === 'number') {
    const w0 = measure.measureText(text.replace(/\n/g, ' ')).width;
    const fitPx = options.fitWidth * PX;
    if (w0 > fitPx) fontPx *= Math.max(0.55, fitPx / w0);
    measure.font = fontFor(fontPx);
  }
  const font = fontFor(fontPx);
  const maxW = typeof options.maxWidth === 'number' ? options.maxWidth * PX : Infinity;
  const lines = typeof options.fitWidth === 'number' ? [text.split(String.fromCharCode(10)).join(' ')] : wrap(measure, text, maxW);
  const metrics = lines.map(l => measure.measureText(l || ' '));
  const ascent = Math.max(fontPx * 0.8, ...metrics.map(m => m.actualBoundingBoxAscent || 0));
  const descent = Math.max(fontPx * 0.3, ...metrics.map(m => m.actualBoundingBoxDescent || 0));
  const lineH = (ascent + descent) * 1.1;
  const widths = metrics.map(m => m.width);
  const widest = Math.max(1, ...widths);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widest);
  canvas.height = Math.ceil(lineH * lines.length + descent);
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.font = font;
  ctx.fillStyle = String(doc.getTextColor() || '#000');
  ctx.textBaseline = 'alphabetic';
  const align = String(options.align ?? 'left');
  lines.forEach((line, i) => {
    const lw = widths[i];
    const lx = align === 'center' ? (widest - lw) / 2 : align === 'right' ? widest - lw : 0;
    ctx.fillText(line, lx, ascent + i * lineH);
  });
  const wMm = canvas.width / PX, hMm = canvas.height / PX;
  const left = align === 'center' ? x - wMm / 2 : align === 'right' ? x - wMm : x;
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', left, y - ascent / PX, wMm, hMm, undefined, 'FAST');
  return true;
}

let installed = false;
export function installDevanagariCells(): void {
  // Installed everywhere (not only in a browser) so label translation also runs in tests; only the
  // Devanagari DRAWING needs a browser canvas and is guarded below.
  if (installed) return;
  installed = true;
  loadPdfLang();   // the saved PDF-language choice (English unless the user picked otherwise)
  applyPlugin(jsPDF);
  // doc.text(): jsPDF publishes "preProcessText" (a supported plugin event) before it writes any text, with the
  // document as `this`. Translate the label there; if it holds Devanagari, draw it through the browser and
  // blank the original so nothing garbled is written.
  (jsPDF as unknown as { API: { events: [string, (this: jsPDF, payload: TextPayload) => void][] } }).API.events.push([
    'preProcessText',
    function (this: jsPDF, payload: TextPayload) {
      try {
        const lines = Array.isArray(payload.text) ? payload.text : [payload.text];
        if (!lines.every(l => typeof l === 'string')) return;
        const translated = (lines as string[]).map(tr);
        payload.text = Array.isArray(payload.text) ? translated : translated[0];
        const joined = translated.join(' ');
        if (typeof document === 'undefined' || !hasDevanagari(joined)) return;
        const opts = (payload.options ?? {}) as Record<string, unknown>;
        // jsPDF already split the lines using Latin metrics; for Devanagari let the canvas do the wrapping.
        const text = typeof opts.maxWidth === 'number' ? joined : translated.join('\n');
        if (drawTextImage(this, text, payload.x, payload.y, opts)) payload.text = Array.isArray(payload.text) ? translated.map(() => '') : '';
      } catch { /* never break a PDF over a label */ }
    },
  ]);
  (jsPDF as unknown as { autoTableSetDefaults: (d: object) => void }).autoTableSetDefaults({
    didParseCell: (data: { cell: CellLike & Record<string, unknown> }) => {
      data.cell.text = (data.cell.text || []).map(tr);   // R12: label -> Hindi / bilingual when the PDF language asks for it
      const joined = (data.cell.text || []).join('\n');
      if (typeof document === 'undefined' || !hasDevanagari(joined)) return;   // no canvas -> leave the cell as is
      data.cell[DEVA_KEY] = joined;
      data.cell.text = joined.split('\n').map(devanagariPlaceholder);
      // Room for marks above and below the headline (a Latin line is too short for Devanagari).
      const st = data.cell.styles as { fontSize: number; minCellHeight?: number };
      const pad = (data.cell.padding?.('top') ?? 1) + (data.cell.padding?.('bottom') ?? 1);
      st.minCellHeight = Math.max(st.minCellHeight ?? 0, st.fontSize * 0.3528 * 1.75 + pad);
    },
    willDrawCell: (data: { cell: CellLike & Record<string, unknown> }) => {
      if (data.cell[DEVA_KEY]) data.cell.text = [];
    },
    didDrawCell: (data: { doc: jsPDF; cell: CellLike & Record<string, unknown> }) => {
      const t = data.cell[DEVA_KEY];
      if (typeof t === 'string') { try { drawCell(data.doc, data.cell, t); } catch { /* never break a PDF over one cell */ } }
    },
  });
}
