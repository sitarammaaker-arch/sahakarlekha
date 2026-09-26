/** PDF / Excel for the subsidiary ledgers — from the same LedgerTable the screen shows. */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addHeader, addPageNumbers, pdfFileName } from '@/lib/pdf';
import { downloadExcel, type Cell } from '@/lib/exportUtils';
import { flattenTables, type LedgerTable } from './ledgerTables';

const num = (v: Cell) => (typeof v === 'number' ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(v) : (v ?? '') as string);

/** One or many ledgers in one PDF — each starts on its own page. */
export function ledgerPdf(society: SocietySettings, tables: readonly LedgerTable[], reportCode: string, fileTag: string): void {
  if (!tables.length) return;
  const landscape = tables[0].columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  tables.forEach((t, i) => {
    if (i > 0) doc.addPage();
    const { startY, font } = addHeader(doc, t.title, society, t.subtitle, { reportCode });
    const right: Record<number, { halign: 'right' }> = {};
    t.columns.forEach((c, j) => { if (c.num) right[j] = { halign: 'right' }; });
    autoTable(doc, {
      startY,
      head: [t.columns.map((c) => c.en)],
      body: [...t.rowsEn.map((r) => r.map(num)), t.totals.map((v) => ({ content: num(v), styles: { fontStyle: 'bold' } }))],
      styles: { fontSize: 7.5, cellPadding: 1.2 },
      headStyles: { fillColor: [55, 65, 81] },
      columnStyles: right,
    });
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    doc.setFont(font, 'normal'); doc.setFontSize(7.5);
    for (const n of t.notes) { const lines = doc.splitTextToSize(`Note: ${n.en}`, doc.internal.pageSize.width - 28); doc.text(lines, 14, y); y += lines.length * 3.5; }
  });
  addPageNumbers(doc, 'helvetica', society.name);
  doc.save(pdfFileName(fileTag, society));
}

export function ledgerExcel(tables: readonly LedgerTable[], filename: string, sheetName: string): void {
  if (!tables.length) return;
  const t = tables[0];
  if (tables.length === 1) {
    downloadExcel([{ name: sheetName, headers: t.columns.map((c) => c.en), rows: [[t.subtitle], ...t.rowsEn, t.totals] }], filename);
    return;
  }
  const { headers, rows } = flattenTables(tables, 'Account');
  downloadExcel([{ name: sheetName, headers, rows }], filename);
}
