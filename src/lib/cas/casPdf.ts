/**
 * NABARD CAS statements (Annexure II / III / IV) as a PDF — the same builders the screen uses.
 * English labels (the CAS formats are English; the PDF font has no Devanagari).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addHeader, addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { CasBalanceSheet, CasProfitLoss, CasTrading, CasSection } from './pacsCas';

const fmt = (n: number) => {
  if (Math.abs(n) < 0.005) return '—';
  const abs = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
};

function sectionRows(sections: CasSection[]): (string | { content: string; styles: object })[][] {
  const rows: (string | { content: string; styles: object })[][] = [];
  for (const s of sections) {
    const single = s.rows.length === 1 && s.rows[0].label === s.label;
    if (!single) rows.push([{ content: s.label, styles: { fontStyle: 'bold' } }, '']);
    for (const r of s.rows) rows.push([`${single ? '' : '   '}${r.label}`, fmt(r.amount)]);
    if (!single) rows.push([{ content: `Total — ${s.label}`, styles: { fontStyle: 'bold' } }, { content: fmt(s.total), styles: { fontStyle: 'bold' } }]);
  }
  return rows;
}

function table(doc: jsPDF, startY: number, title: string, sections: CasSection[], total: number): number {
  autoTable(doc, {
    startY,
    head: [[title, 'Amount (Rs.)']],
    body: [...sectionRows(sections), [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: fmt(total), styles: { fontStyle: 'bold' } }]],
    styles: { fontSize: 8, cellPadding: 1.4 },
    headStyles: { fillColor: [55, 65, 81] },
    columnStyles: { 1: { halign: 'right', cellWidth: 38 } },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

export function generateCasPdf(society: SocietySettings, bs: CasBalanceSheet, pl: CasProfitLoss, trading: CasTrading | null, asOn: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const note = 'Format: NABARD Common Accounting System (CAS) for PACS — Annexure II / III / IV';
  const { startY, font } = addHeader(doc, 'CAS Financial Statements', society, `As on ${asOn} · ${note}`, { reportCode: 'CAS' });
  let y = startY;
  if (trading) {
    doc.setFont(font, 'bold'); doc.setFontSize(10); doc.text('ANNEXURE II — TRADING ACCOUNT', 14, y); y += 3;
    y = table(doc, y, 'Debit', trading.debit, trading.debit.reduce((t, s) => t + s.total, 0));
    y = table(doc, y, 'Credit', trading.credit, trading.total);
    doc.addPage(); y = 16;
  }
  doc.setFont(font, 'bold'); doc.setFontSize(10); doc.text('ANNEXURE III — PROFIT AND LOSS ACCOUNT', 14, y); y += 3;
  y = table(doc, y, 'Expenditure', pl.expenditure, pl.expenditure.reduce((t, s) => t + s.total, 0));
  y = table(doc, y, 'Income', pl.income, pl.total);
  doc.addPage(); y = 16;
  doc.setFont(font, 'bold'); doc.setFontSize(10); doc.text('ANNEXURE IV — BALANCE SHEET', 14, y); y += 3;
  y = table(doc, y, 'Liabilities', bs.liabilities, bs.totalLiabilities);
  y = table(doc, y, 'Assets', bs.assets, bs.totalAssets);
  doc.setFont(font, 'normal'); doc.setFontSize(7);
  doc.text('Overdue Interest Reserve shown as "Less: Provision for overdue interest" under Other Assets (CAS Annexure IV).', 14, y);
  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('CAS_Statements', society));
}
