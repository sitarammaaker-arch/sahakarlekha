/**
 * Proforma 3 PDF — Financial Result of Cooperative Marketing Societies.
 * District annexure format (landscape A4). Accepts array of rows so
 * the same function works for single-society and district roll-up.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P3Row } from './p3Calculator';

const fmtL = (n: number) => (n / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateP3PDF(rows: P3Row[], society: SocietySettings, fyLabel: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 3', pw / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `FINANCIAL RESULT OF COOPERATIVE MARKETING SOCIETIES FOR THE YEAR ${fyLabel}` +
    (society.hafedDistrictOffice ? ` — DISTRICT: ${society.hafedDistrictOffice.toUpperCase()}` : ''),
    pw / 2, 18, { align: 'center' }
  );
  doc.setFontSize(8); doc.setFont(font, 'normal');
  doc.text('(Rs. in Lacs)', pw - 14, 24, { align: 'right' });

  const body = rows.map((r, i) => [
    String(i + 1),
    r.societyName,
    fmtL(r.turnover),
    fmtL(r.netProfitLoss),
    fmtL(r.adminExp),
    String(r.sanctionedStrength),
    String(r.regularEmployees),
    String(r.outsourcedEmployees),
    r.businessType,
    String(r.memberFarmers),
    String(r.memberNonFarmers),
    r.address,
    r.email,
    r.phone,
    r.remarks,
  ]);

  // Totals (useful when multiple rows)
  if (rows.length > 1) {
    body.push([
      '', 'TOTAL',
      fmtL(rows.reduce((s, r) => s + r.turnover, 0)),
      fmtL(rows.reduce((s, r) => s + r.netProfitLoss, 0)),
      fmtL(rows.reduce((s, r) => s + r.adminExp, 0)),
      String(rows.reduce((s, r) => s + r.sanctionedStrength, 0)),
      String(rows.reduce((s, r) => s + r.regularEmployees, 0)),
      String(rows.reduce((s, r) => s + r.outsourcedEmployees, 0)),
      '—',
      String(rows.reduce((s, r) => s + r.memberFarmers, 0)),
      String(rows.reduce((s, r) => s + r.memberNonFarmers, 0)),
      '', '', '', '',
    ]);
  }

  autoTable(doc, {
    startY: 28,
    head: [[
      'S.No.', 'Name of the Society',
      'Turnover', 'Net P/L', 'Admn. Exp.',
      'Sanctd.\nStrength', 'Regular\nEmployees', 'Outsrc.\nEmp.',
      'Type of\nBusiness',
      'Farmers', 'Non-\nFarmers',
      'Address / Tel', 'Email', 'Phone', 'Remarks',
    ]],
    body,
    theme: 'grid',
    styles: { font, fontSize: 6.8, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.12, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0:  { cellWidth: 10, halign: 'center' },
      1:  { cellWidth: 42 },
      2:  { cellWidth: 18, halign: 'right' },
      3:  { cellWidth: 18, halign: 'right' },
      4:  { cellWidth: 18, halign: 'right' },
      5:  { cellWidth: 16, halign: 'center' },
      6:  { cellWidth: 18, halign: 'center' },
      7:  { cellWidth: 16, halign: 'center' },
      8:  { cellWidth: 17, halign: 'center' },
      9:  { cellWidth: 14, halign: 'center' },
      10: { cellWidth: 14, halign: 'center' },
      11: { cellWidth: 40 },
      12: { cellWidth: 28 },
      13: { cellWidth: 20 },
      14: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.row.raw[1] === 'TOTAL')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-3-FinancialResult', society));
}
