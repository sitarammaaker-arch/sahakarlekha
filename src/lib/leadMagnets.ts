/**
 * leadMagnets — on-demand branded checklist PDFs (lead magnets). English content
 * + jsPDF Helvetica (same proven approach as sampleReport.ts; the app's PDFs lack
 * Devanagari glyphs, so marketing PDFs stay English). One generic builder drives
 * several topic-matched magnets (audit, GST/TDS, inventory).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MAGNETS, type Magnet, type MagnetKey } from './leadMagnetsMeta';

const NAVY: [number, number, number] = [31, 73, 125];
const GREEN: [number, number, number] = [15, 123, 90];

// Catalogue lives in leadMagnetsMeta (J1); re-exported so existing imports keep working.
export { MAGNETS, magnetForCategory, type Magnet, type MagnetKey } from './leadMagnetsMeta';

function buildPDF(m: Magnet): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 15;
  const R = pageW - 15;

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SahakarLekha', L, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Free cooperative society accounting · sahakarlekha.com', L, 19);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(m.pdfTitle, L, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(m.pdfSubtitle, L, 47);
  doc.setTextColor(0);

  let y = 58;

  const sectionTitle = (txt: string) => {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, 2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(txt, L + 5, y);
    doc.setTextColor(0);
    y += 8;
  };

  const checkItem = (txt: string) => {
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.rect(L + 1, y - 3.4, 3.6, 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(txt, R - (L + 8)) as string[];
    doc.text(lines, L + 8, y);
    y += lines.length * 5 + 2.5;
  };

  m.sections.forEach((s) => {
    sectionTitle(s.title);
    if ('items' in s) {
      s.items.forEach(checkItem);
      y += 3;
    } else {
      autoTable(doc, {
        startY: y,
        head: [s.table.head],
        body: s.table.rows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.2, lineColor: [210, 210, 210] },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
        margin: { left: L, right: 15 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(L, pageH - 16, R, pageH - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN);
    doc.text('Generated free with SahakarLekha', L, pageH - 11);
    doc.setTextColor(90);
    doc.text('Start free: sahakarlekha.com/register', R, pageH - 11, { align: 'right' });
    doc.setTextColor(150);
    doc.setFontSize(7.5);
    doc.text(m.disclaimer, pageW / 2, pageH - 6, { align: 'center' });
  }

  doc.save(m.filename);
}

export function generateMagnet(key: MagnetKey): void {
  buildPDF(MAGNETS[key] || MAGNETS['audit-checklist']);
}
