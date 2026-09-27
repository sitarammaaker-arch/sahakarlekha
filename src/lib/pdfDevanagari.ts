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
 * a browser (tests, SSR). Labels stay English; only DATA that is Hindi is rendered this way.
 */
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

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
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', cell.x + cell.padding('left'), cell.y + cell.padding('top'), w, h);
}

let installed = false;
export function installDevanagariCells(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  applyPlugin(jsPDF);
  (jsPDF as unknown as { autoTableSetDefaults: (d: object) => void }).autoTableSetDefaults({
    didParseCell: (data: { cell: CellLike & Record<string, unknown> }) => {
      const joined = (data.cell.text || []).join('\n');
      if (!hasDevanagari(joined)) return;
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
