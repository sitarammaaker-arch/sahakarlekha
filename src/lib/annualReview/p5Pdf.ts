/**
 * Proforma 5 PDF — Staff & Salary information for HAFED Annual Review.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P5Result } from './p5Calculator';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

export function generateP5PDF(p5: P5Result, society: SocietySettings, fyLabel: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 5', pw / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `INFORMATION REGARDING STAFF & SALARY OF CMS FOR THE YEAR ${fyLabel}` +
    (society.hafedDistrictOffice ? ` — DISTRICT: ${society.hafedDistrictOffice.toUpperCase()}` : ''),
    pw / 2, 18, { align: 'center' }
  );

  // Summary strip
  doc.setFont(font, 'normal'); doc.setFontSize(9);
  const { summary } = p5;
  doc.text(
    `Society: ${society.name}   |   Sanctioned: ${summary.sanctionedStrength}   |   Working (Regular): ${summary.societyEmployees}   |   HAFED Deputed: ${summary.hafedDeputed}   |   Outsourced: ${summary.outsourced}`,
    14, 26
  );

  const body = p5.rows.map(r => [
    String(r.sNo),
    r.societyName,
    r.employeeName,
    r.designation,
    r.category,
    r.payScale,
    fmt(r.basicPay),
    r.isHafedDeputed ? 'Yes' : 'No',
    r.isSocietyEmployee ? 'Yes' : 'No',
    r.isOutsourced ? 'Yes' : 'No',
    fmt(r.hafedSalaryPaid),
    r.hafedSalaryPercent ? r.hafedSalaryPercent.toFixed(2) + '%' : '-',
  ]);

  // Totals row
  body.push([
    '', '', 'TOTAL', '', '', '',
    fmt(summary.totalBasicPay),
    String(summary.hafedDeputed),
    String(summary.societyEmployees),
    String(summary.outsourced),
    fmt(summary.totalHafedSalaryPaid),
    '',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [[
      'S.No.', 'Name of Society', 'Name of Employee', 'Designation',
      'Category\nA/B/C/D', 'Pay Scale', 'Basic Pay',
      'Deputation\nfrom HAFED', 'Society\nEmployee', 'Outsourced\nEmployee',
      'Salary paid\nby HAFED (₹)', '% Salary\nby HAFED',
    ]],
    body,
    theme: 'grid',
    styles: { font, fontSize: 7.5, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.12, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 38 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 28 },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 22, halign: 'center' },
      10: { cellWidth: 25, halign: 'right' },
      11: { cellWidth: 20, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  if (finalY < doc.internal.pageSize.getHeight() - 10) {
    doc.setFontSize(9);
    doc.text('Manager / Secretary', 30, finalY);
    doc.text('Chairman', 130, finalY);
    doc.text('Inspector / Auditor', 230, finalY);
    doc.line(15, finalY - 2, 80, finalY - 2);
    doc.line(110, finalY - 2, 170, finalY - 2);
    doc.line(215, finalY - 2, 275, finalY - 2);
  }

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-5-Staff', society));
}
