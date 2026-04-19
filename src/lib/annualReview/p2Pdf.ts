/**
 * Proforma 2 PDF generator — Recoverable Position (HAFED format).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P2Result } from './p2Calculator';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function generateP2PDF(p2: P2Result, society: SocietySettings, fyStartDate: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const fyEnd = (() => {
    const d = new Date(fyStartDate);
    d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const ddmmyyyy = (d: string) => d.split('-').reverse().join('-');

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 2', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`RECOVERABLE POSITION OF ${society.name.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  doc.setFontSize(10); doc.setFont(font, 'normal');
  doc.text(`FOR THE YEAR ${ddmmyyyy(fyStartDate)} TO ${ddmmyyyy(fyEnd)}`, doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });

  type Row = [string, string, string];
  const rows: Row[] = [];
  const sect = (letter: string, label: string, date?: string) => rows.push([letter, `${label}${date ? ' ' + date : ''}`, '']);
  const item = (n: string, label: string, amt: number) => rows.push([n, label, fmt(amt)]);
  const total = (amt: number) => rows.push(['', 'Total', fmt(amt)]);

  sect('A)', 'Opening balance as on', ddmmyyyy(fyStartDate));
  item('1', 'Fertilizer & Pesticide Outstanding', p2.opening.fertPesticide);
  item('2', 'Advances', p2.opening.advance);
  item('3', 'Embezzlements (If Any)', p2.opening.embezzlement);
  item('4', 'Others (if any)', p2.opening.other);
  total(p2.openingTotal);

  sect('B)', 'Addition During the Year');
  item('1', 'Fertilizer & Pesticide Outstanding', p2.additions.fertPesticide);
  item('2', 'Advances', p2.additions.advance);
  item('3', 'Embezzlements (If Any)', p2.additions.embezzlement);
  item('4', 'Others (if any)', p2.additions.other);
  total(p2.additionsTotal);

  sect('C)', 'Recovery Made During the Year');
  item('1', 'Fertilizer & Pesticide Outstanding', p2.recoveries.fertPesticide);
  item('2', 'Advances', p2.recoveries.advance);
  item('3', 'Embezzlements (If Any)', p2.recoveries.embezzlement);
  item('4', 'Others (if any)', p2.recoveries.other);
  total(p2.recoveriesTotal);

  sect('D)', 'Balance Recoverables as on', ddmmyyyy(fyEnd));
  item('1', 'Cases with police', p2.legalStage.police);
  item('2', 'Cases in arbitration', p2.legalStage.arbitration);
  item('3', 'Cases under execution', p2.legalStage.execution);
  item('4', 'Award taken but not sent to execution', p2.legalStage.award);
  rows.push(['5', 'Others', '']);
  rows.push(['', '   a) Confirmed', fmt(p2.legalStage.confirmed + p2.legalStage.none)]);
  rows.push(['', '   b) Un-confirmed', fmt(p2.legalStage.unconfirmed)]);
  total(p2.legalStageTotal);

  const sectionRows = new Set<string>(['A)', 'B)', 'C)', 'D)']);
  autoTable(doc, {
    startY: 32,
    head: [['S.NO.', 'Particulars', 'Amount in Rs.']],
    body: rows,
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 50, halign: 'right' },
    },
    didParseCell: (data) => {
      const sr = data.row.raw[0] as string;
      if (data.section === 'body') {
        if (sectionRows.has(sr)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 235, 250];
        } else if (sr === '' && (data.row.raw[1] as string) === 'Total') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text('Manager / Secretary', 30, finalY);
  doc.text('Chairman', 110, finalY);
  doc.text('Inspector / Auditor', 170, finalY);
  doc.line(15, finalY - 2, 70, finalY - 2);
  doc.line(95, finalY - 2, 140, finalY - 2);
  doc.line(155, finalY - 2, 195, finalY - 2);

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-2', society, fyStartDate, fyEnd));
}
