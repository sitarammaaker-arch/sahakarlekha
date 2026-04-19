/**
 * Proforma 9 PDF — District Review of Cooperative Marketing Societies.
 * Landscape A4. Accepts array of rows so single-society and district
 * roll-up use the same function.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P9Row } from './p9Calculator';

const fmt  = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtL = (n: number) => (n / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateP9PDF(rows: P9Row[], society: SocietySettings, fyLabel: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 9', pw / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `REVIEW OF COOPERATIVE MARKETING SOCIETIES FOR THE YEAR ${fyLabel}` +
    (society.hafedDistrictOffice ? ` — HAFED DISTRICT OFFICE: ${society.hafedDistrictOffice.toUpperCase()}` : ''),
    pw / 2, 18, { align: 'center' }
  );

  const body = rows.map((r, i) => [
    String(i + 1),
    r.societyName,
    r.turnoverLacs.toFixed(2),
    fmtL(r.netProfitLoss),
    String(r.totalEmployees),
    r.turnoverPerEmployee.toFixed(2),
    fmt(r.kachiAaratBusiness),
    fmt(r.damiMustardSeed),
    fmt(r.damiGram),
    fmt(r.damiBarley),
  ]);

  if (rows.length > 1) {
    const tot = rows.reduce((a, r) => ({
      turnoverLacs:        a.turnoverLacs + r.turnoverLacs,
      netProfitLoss:       a.netProfitLoss + r.netProfitLoss,
      totalEmployees:      a.totalEmployees + r.totalEmployees,
      kachiAaratBusiness:  a.kachiAaratBusiness + r.kachiAaratBusiness,
      damiMustardSeed:     a.damiMustardSeed + r.damiMustardSeed,
      damiGram:            a.damiGram + r.damiGram,
      damiBarley:          a.damiBarley + r.damiBarley,
    }), { turnoverLacs: 0, netProfitLoss: 0, totalEmployees: 0, kachiAaratBusiness: 0, damiMustardSeed: 0, damiGram: 0, damiBarley: 0 });
    const tpe = tot.totalEmployees > 0 ? tot.turnoverLacs / tot.totalEmployees : 0;
    body.push([
      '', 'TOTAL',
      tot.turnoverLacs.toFixed(2),
      fmtL(tot.netProfitLoss),
      String(tot.totalEmployees),
      tpe.toFixed(2),
      fmt(tot.kachiAaratBusiness),
      fmt(tot.damiMustardSeed),
      fmt(tot.damiGram),
      fmt(tot.damiBarley),
    ]);
  }

  autoTable(doc, {
    startY: 24,
    head: [[
      { content: 'Sr.No.', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Name of Society', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Turnover\n(Rs. in Lacs)', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Profit/\nLoss (Lacs)', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'No. of\nEmployees', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Turnover per\nEmployee (Lacs)', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Business of\nKachi Aarat', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Dami Earned on Kachi Aarat', colSpan: 3, styles: { halign: 'center' } },
    ], [
      'M/Seed', 'Gram', 'Barley',
    ]],
    body,
    theme: 'grid',
    styles: { font, fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
      8: { cellWidth: 25, halign: 'right' },
      9: { cellWidth: 25, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.raw[1] === 'TOTAL') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-9-DistrictReview', society));
}
