import type jsPDF from 'jspdf';

/**
 * Fit one line of text inside maxW: shrink the font from `start` down to `min`, then
 * truncate with an ellipsis. Leaves the font size set for the caller's doc.text (audit D-02:
 * long society names used to run off both page edges). Layout positions are unchanged.
 *
 * Dependency-free (type import only) so scripts/test-pdf-fit.mjs can import it directly.
 */
export function fitLine(doc: jsPDF, text: string, maxW: number, start: number, min: number): string {
  let size = start;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) { size -= 0.5; doc.setFontSize(size); }
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '...';
}
