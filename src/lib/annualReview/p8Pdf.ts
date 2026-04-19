/**
 * Proforma 8 PDF — Kachi Aarat (HAFED format).
 * Columns: S.No, Name of CMS, Value of Business done as Kachi Aarat,
 *          Dami Earned (before farmer rebate).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P8Result } from './p8Calculator';
import { KACHI_CROP_LABELS } from './p8Calculator';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function generateP8PDF(p8: P8Result, society: SocietySettings, fyStartDate: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();
  const fyEnd = (() => {
    const d = new Date(fyStartDate);
    d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const dd = (d: string) => d.split('-').reverse().join('-');

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 8', pw / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.text(
    `INFORMATION REGARDING KACHI AARAT FOR THE YEAR ${dd(fyStartDate)} TO ${dd(fyEnd)}`,
    pw / 2, 20, { align: 'center' }
  );

  // Main P8 table (govt format)
  autoTable(doc, {
    startY: 28,
    head: [['S.No.', 'Name of CMS', 'Value of Business (₹)', 'Dami Earned (₹)']],
    body: [
      ['1', society.name, fmt(p8.totalBusinessValue), fmt(p8.totalDamiEarned)],
    ],
    theme: 'grid',
    styles: { font, fontSize: 9.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 45, halign: 'right' },
    },
  });

  // Dami split by crop (used for P9)
  const finalY0 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(10); doc.setFont(font, 'bold');
  doc.text('Dami Earned — Split by Crop (for Proforma 9):', 14, finalY0);
  doc.setFont(font, 'normal');

  autoTable(doc, {
    startY: finalY0 + 4,
    head: [['Crop', 'Business Value (₹)', 'Dami Earned (₹)']],
    body: [
      ['Mustard Seed', fmt(p8.businessByCrop.mustardSeed), fmt(p8.damiByCrop.mustardSeed)],
      ['Gram',         fmt(p8.businessByCrop.gram),         fmt(p8.damiByCrop.gram)],
      ['Barley',       fmt(p8.businessByCrop.barley),       fmt(p8.damiByCrop.barley)],
      ['Wheat',        fmt(p8.businessByCrop.wheat),        fmt(p8.damiByCrop.wheat)],
      ['Paddy',        fmt(p8.businessByCrop.paddy),        fmt(p8.damiByCrop.paddy)],
      ['Other',        fmt(p8.businessByCrop.other),        fmt(p8.damiByCrop.other)],
      ['TOTAL',        fmt(p8.totalBusinessValue),           fmt(p8.totalDamiEarned)],
    ],
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.12, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 55, halign: 'right' },
      2: { cellWidth: 55, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  // Signatories
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text('Manager / Secretary', 30, finalY);
  doc.text('Chairman', 110, finalY);
  doc.text('Inspector / Auditor', 170, finalY);
  doc.line(15, finalY - 2, 70, finalY - 2);
  doc.line(95, finalY - 2, 140, finalY - 2);
  doc.line(155, finalY - 2, 195, finalY - 2);

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-8-KachiAarat', society, fyStartDate, fyEnd));
}
