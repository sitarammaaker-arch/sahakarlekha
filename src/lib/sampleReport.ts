/**
 * sampleReport — on-demand "sample report" PDF for the marketing site (lead magnet).
 * Generates a branded 3-page report (Trial Balance, Balance Sheet, Income &
 * Expenditure) for a FICTIONAL, fully-balanced cooperative society, using the same
 * header/footer as the real app reports (so prospects see exactly what they'll get).
 * English-only content — the app's PDFs use Helvetica, which lacks Devanagari glyphs.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addHeader, addPageNumbers, rightAlignAmountColumns } from '@/lib/pdf';

const fmt = (n: number): string =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Fictional society — no real names, no tax IDs.
const DEMO_SOCIETY = {
  name: 'Aadarsh Cooperative Society Ltd. (SAMPLE)',
  registrationNo: 'SAMPLE/2024/001',
  financialYear: '2025-26',
  address: 'Main Bazaar',
  district: 'Example Town',
  state: '',
  pinCode: '',
} as unknown as SocietySettings;

const NAVY: [number, number, number] = [31, 73, 125];

export function generateSampleReportPDF(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let font = 'helvetica';

  const sampleNote = (y: number) => {
    doc.setFontSize(8);
    doc.setTextColor(190, 90, 0);
    doc.text('SAMPLE REPORT — fictional figures for demonstration only', pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
  };

  const baseTable = (startY: number, head: string[], body: (string)[][], foot: string[], rightCols: number[]) => {
    autoTable(doc, {
      startY,
      head: [head],
      body,
      foot: [foot],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: [210, 210, 210] },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [235, 240, 247], textColor: 0, fontStyle: 'bold' },
      didParseCell: rightAlignAmountColumns(...rightCols),
      margin: { left: 15, right: 15 },
    });
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  };

  // ── Page 1: Trial Balance ───────────────────────────────────────────────────
  let h = addHeader(doc, 'Trial Balance', DEMO_SOCIETY, 'As at 31-03-2026', { reportCode: 'TB' });
  font = h.font;
  sampleNote(h.startY);
  baseTable(
    h.startY + 4,
    ['Particulars', 'Debit (Rs.)', 'Credit (Rs.)'],
    [
      ['Share Capital', '', fmt(200000)],
      ['Reserve Fund', '', fmt(50000)],
      ["Members' Deposits", '', fmt(150000)],
      ['Sundry Creditors (Suppliers)', '', fmt(30000)],
      ['Sales / Trading Income', '', fmt(320000)],
      ['Cash in Hand', fmt(35000), ''],
      ['Bank (SBI)', fmt(215000), ''],
      ['Furniture & Fixtures', fmt(60000), ''],
      ['Stock-in-Trade', fmt(90000), ''],
      ['Sundry Debtors (Members)', fmt(40000), ''],
      ['Purchases', fmt(230000), ''],
      ['Salaries', fmt(48000), ''],
      ['Office & Admin Expenses', fmt(22000), ''],
      ['Audit Fee', fmt(10000), ''],
    ],
    ['Total', fmt(750000), fmt(750000)],
    [1, 2],
  );

  // ── Page 2: Balance Sheet ───────────────────────────────────────────────────
  doc.addPage();
  h = addHeader(doc, 'Balance Sheet', DEMO_SOCIETY, 'As at 31-03-2026', { reportCode: 'BS' });
  sampleNote(h.startY);
  baseTable(
    h.startY + 4,
    ['Capital & Liabilities', 'Amount', 'Assets', 'Amount'],
    [
      ['Share Capital', fmt(200000), 'Furniture & Fixtures', fmt(60000)],
      ['Reserve Fund', fmt(50000), 'Stock-in-Trade', fmt(90000)],
      ['Surplus (this year)', fmt(10000), 'Sundry Debtors (Members)', fmt(40000)],
      ["Members' Deposits", fmt(150000), 'Cash in Hand', fmt(35000)],
      ['Sundry Creditors', fmt(30000), 'Bank (SBI)', fmt(215000)],
    ],
    ['Total', fmt(440000), 'Total', fmt(440000)],
    [1, 3],
  );

  // ── Page 3: Income & Expenditure ────────────────────────────────────────────
  doc.addPage();
  h = addHeader(doc, 'Income & Expenditure Account', DEMO_SOCIETY, 'For the year ended 31-03-2026', { reportCode: 'IE' });
  sampleNote(h.startY);
  baseTable(
    h.startY + 4,
    ['Expenditure', 'Amount', 'Income', 'Amount'],
    [
      ['To Purchases', fmt(230000), 'By Sales / Trading Income', fmt(320000)],
      ['To Salaries', fmt(48000), '', ''],
      ['To Office & Admin Expenses', fmt(22000), '', ''],
      ['To Audit Fee', fmt(10000), '', ''],
      ['To Surplus carried to Balance Sheet', fmt(10000), '', ''],
    ],
    ['Total', fmt(320000), 'Total', fmt(320000)],
    [1, 3],
  );

  addPageNumbers(doc, font, DEMO_SOCIETY.name);
  doc.save('SahakarLekha-Sample-Report.pdf');
}
