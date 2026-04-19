/**
 * Proforma 6 PDF — Detail of Assets (Working / Non-Working) for HAFED Annual Review.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P6Result } from './p6Calculator';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function generateP6PDF(p6: P6Result, society: SocietySettings): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 6', pw / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `DETAIL OF ASSETS (WORKING / NON-WORKING) OF CMS FOR THE YEAR ${society.financialYear}` +
    (society.hafedDistrictOffice ? ` — DISTRICT: ${society.hafedDistrictOffice.toUpperCase()}` : ''),
    pw / 2, 18, { align: 'center' }
  );
  doc.setFont(font, 'normal'); doc.setFontSize(9);
  doc.text(`Society: ${society.name}`, 14, 25);

  type Row = [string, string, string, string, string, string, string, string, string];
  const body: Row[] = [];
  let sNo = 1;

  p6.groups.forEach((group, gi) => {
    // Section header row
    body.push([`${gi + 1}`, group.label.toUpperCase(), '', '', '', '', '', '', '']);
    group.rows.forEach((r, ri) => {
      body.push([
        String.fromCharCode(65 + ri),  // A, B, C ...
        r.name,
        r.capacityMT ? fmt(r.capacityMT) : '-',
        fmt(r.originalCost),
        fmt(r.wdv),
        fmt(r.marketValue),
        r.condition === 'serviceable' ? '✓' : '',
        r.condition === 'unserviceable' ? '✓' : '',
        r.remarks || '',
      ]);
    });
    if (group.rows.length > 0) {
      body.push([
        '', `Sub-total ${group.label}`,
        group.totalCapacity ? fmt(group.totalCapacity) : '-',
        fmt(group.totalOriginal), fmt(group.totalWdv), fmt(group.totalMarket),
        '', '', '',
      ]);
    } else {
      body.push(['', '  (no assets classified in this category)', '', '', '', '', '', '', '']);
    }
  });

  // Grand total
  body.push([
    '', 'GRAND TOTAL', '',
    fmt(p6.grandTotalOriginal), fmt(p6.grandTotalWdv), fmt(p6.grandTotalMarket),
    `Srv: ${p6.serviceableCount}`, `Un: ${p6.unserviceableCount}`, '',
  ]);

  autoTable(doc, {
    startY: 28,
    head: [[
      'S.No.', 'Name of Fixed Asset',
      'Capacity\n(MT)', 'Original\nCost (₹)', 'WDV (₹)', 'Market\nValue (₹)',
      'Serviceable', 'Unserviceable', 'Remarks',
    ]],
    body,
    theme: 'grid',
    styles: { font, fontSize: 7.8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.12, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 75 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 40 },
    },
    didParseCell: (data) => {
      const sr = data.row.raw[0] as string;
      const label = data.row.raw[1] as string;
      if (data.section === 'body') {
        // Section header
        if (sr && !isNaN(parseInt(sr, 10)) && !label.startsWith('Sub')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 235, 250];
        }
        // Sub-total
        if (typeof label === 'string' && label.startsWith('Sub-total')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 248, 230];
        }
        // Grand total
        if (label === 'GRAND TOTAL') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 220, 200];
        }
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
  doc.save(pdfFileName('Proforma-6-Assets', society));
}
