/**
 * Proforma 4 PDF — Patronage Rebate (qty in MT).
 * Govt format has: S.No, Name of Society, DAP sold, Urea sold,
 * Wheat procured, Barley procured, Gram procured.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P4Result } from './p4Calculator';

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateP4PDF(p4: P4Result, society: SocietySettings, fromDate: string, toDate: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();
  const dd = (d: string) => d.split('-').reverse().join('-');

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 4', pw / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `INFORMATION REGARDING PATRONAGE REBATE OF CMS FOR THE YEAR ${dd(fromDate)} TO ${dd(toDate)}` +
    (society.hafedDistrictOffice ? ` — DISTRICT: ${society.hafedDistrictOffice.toUpperCase()}` : ''),
    pw / 2, 18, { align: 'center' }
  );
  doc.setFontSize(9); doc.setFont(font, 'normal');
  doc.text(`Society: ${society.name}`, 14, 25);
  doc.text(`(All quantities in MT — Metric Tonnes)`, pw - 14, 25, { align: 'right' });

  const t = p4.totals;
  const body = [
    ['1', p4.society, fmt(t.dap), fmt(t.urea), fmt(t.wheatProc), fmt(t.barleyProc), fmt(t.gramProc)],
    ['', 'TOTAL', fmt(t.dap), fmt(t.urea), fmt(t.wheatProc), fmt(t.barleyProc), fmt(t.gramProc)],
  ];

  autoTable(doc, {
    startY: 30,
    head: [[
      'S.No.', 'Name of the Society',
      'DAP SOLD\n(in MTs)', 'UREA SOLD\n(in MTs)',
      'WHEAT PROC.\n(in MTs)', 'BARLEY PROC.\n(in MTs)', 'GRAM PROC.\n(in MTs)',
    ]],
    body,
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' },
      6: { cellWidth: 35, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  // Extra crops noted below the govt table
  const finalY0 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(9); doc.setFont(font, 'bold');
  doc.text('Additional Procurement (not in govt form):', 14, finalY0);
  doc.setFont(font, 'normal');
  const extras: [string, number][] = [
    ['Paddy procured',     t.paddyProc],
    ['Mustard procured',   t.mustardProc],
    ['Sunflower procured', t.sunflowerProc],
    ['Other procurement',  t.otherProc],
    ['Other fertilizer sold', t.otherFert],
  ];
  let y = finalY0 + 5;
  extras.forEach(([label, val]) => {
    doc.text(`• ${label}: ${fmt(val)} MT`, 18, y);
    y += 5;
  });

  // Signatories
  const finalY = y + 8;
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
  doc.save(pdfFileName('Proforma-4-PatronageRebate', society, fromDate, toDate));
}
