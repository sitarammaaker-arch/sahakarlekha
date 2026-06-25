/**
 * auditChecklist — on-demand "Audit Preparation Checklist" PDF (lead magnet).
 * English content + jsPDF Helvetica (same approach as sampleReport.ts — the
 * app's PDFs lack Devanagari glyphs, so marketing PDFs stay English-only).
 * Branded, ~1.5 pages, with a viral footer linking back to the site.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY: [number, number, number] = [31, 73, 125];
const GREEN: [number, number, number] = [15, 123, 90];

export function generateAuditChecklistPDF(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 15;
  const R = pageW - 15;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SahakarLekha', L, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Free cooperative society accounting · sahakarlekha.com', L, 19);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Audit Preparation Checklist', L, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text('For cooperative societies — PACS, Marketing, Consumer & Multipurpose', L, 47);
  doc.setTextColor(0);

  let y = 58;

  const sectionTitle = (txt: string) => {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, 2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(txt, L + 5, y);
    doc.setTextColor(0);
    y += 8;
  };

  const checkItem = (txt: string) => {
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.rect(L + 1, y - 3.4, 3.6, 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(txt, R - (L + 8)) as string[];
    doc.text(lines, L + 8, y);
    y += lines.length * 5 + 2.5;
  };

  // ── Section A ────────────────────────────────────────────────────────────────
  sectionTitle('A. Documents to keep ready');
  [
    'Updated Trial Balance (Debit = Credit, matched)',
    'Final accounts: Trading A/c, Income & Expenditure, Balance Sheet, Receipts & Payments',
    'Bank Reconciliation Statement for every account, up to date',
    'All vouchers in order, with bills / receipts attached',
    'Member, Share, Loan, Stock and Salary registers',
    'GST and TDS returns with challans (proof of payment)',
    'Minutes of General Body / Board meetings',
    "Previous year's audit report + compliance of its objections",
  ].forEach(checkItem);

  y += 3;

  // ── Section B (table) ────────────────────────────────────────────────────────
  sectionTitle('B. Most common audit objections — and how to avoid them');
  autoTable(doc, {
    startY: y,
    head: [['Objection', 'Cause', 'How to avoid']],
    body: [
      ['Trial Balance did not match', 'Wrong opening balance / missed entry', 'Reconcile every month'],
      ['Voucher–entry mismatch', 'Rush, missing bill', 'Attach the bill to each voucher'],
      ['Bank balance not matching', 'No reconciliation done', 'Do a monthly BRS'],
      ['Closing ≠ next opening', 'Year transition error', 'Close & FY-lock the year'],
      ['Stock counted twice', 'Closing stock double-entered', 'Use a single calculation'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: [210, 210, 210] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    margin: { left: L, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Section C ────────────────────────────────────────────────────────────────
  sectionTitle('C. 3 habits that keep every audit easy');
  [
    'Monthly bank reconciliation + a quick Trial Balance check',
    'Attach a bill / receipt to every large voucher immediately',
    'FY-lock at year-end so the figures stay stable during audit',
  ].forEach(checkItem);

  // ── Footer (every page) ──────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(L, pageH - 16, R, pageH - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN);
    doc.text('Generated free with SahakarLekha', L, pageH - 11);
    doc.setTextColor(90);
    doc.text('Start free: sahakarlekha.com/register', R, pageH - 11, { align: 'right' });
    doc.setTextColor(150);
    doc.setFontSize(7.5);
    doc.text(
      'General guidance only; rules vary by state Act / bye-laws — confirm with your Registrar / auditor.',
      pageW / 2, pageH - 6, { align: 'center' }
    );
  }

  doc.save('SahakarLekha-Audit-Checklist.pdf');
}
