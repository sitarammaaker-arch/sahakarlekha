/**
 * Proforma 1 PDF generator — matches Haryana HAFED Annual Review format exactly.
 * Single-page A4 table with S.NO / PARTICULARS / (Rs. in Lacs) columns.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';
import type { P1Result } from './p1Calculator';
import { CROP_LABELS, EXPENSE_BUCKET_LABELS, TURNOVER_BUCKET_LABELS } from './p1Calculator';

const L = (rs: number) => (rs / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateP1PDF(p1: P1Result, society: SocietySettings, fromDate: string, toDate: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = 'helvetica';

  // ── Header ──
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('PERFORMA 1', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.text(
    `ANNUAL REVIEW / INSPECTION NOTE OF THE ${society.name.toUpperCase()}`,
    doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' }
  );
  doc.setFontSize(10);
  doc.setFont(font, 'normal');
  const fmtDt = (d: string) => d.split('-').reverse().join('/');
  doc.text(`FOR THE YEAR ${fmtDt(fromDate)} TO ${fmtDt(toDate)}`,
    doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });

  // ── Build rows ──
  type Row = [string, string, string];
  const rows: Row[] = [];

  // 1. Commission
  rows.push(['1', 'INCOME FROM COMMISSION ON', '']);
  const cropKeys: Array<keyof typeof CROP_LABELS> = ['wheat','paddy','sunflower','mustard','gram','bajra','maize','moong','other'];
  const roman = ['i','ii','iii','iv','v','vi','vii','viii','ix'];
  cropKeys.forEach((k, i) => {
    rows.push(['', `${roman[i]}) ${CROP_LABELS[k].split(' / ')[0]}`, L(p1.commission[k])]);
  });

  rows.push(['2', 'PATRONAGE REBATE (Annexure 4)', L(p1.patronageRebate)]);
  rows.push(['', 'Other if Any', L(p1.patronageOther)]);
  rows.push(['3', 'TOTAL INCOME COMMISSION + PATRONAGE REBATE (1+2)', L(p1.totalIncomeCommissionPatronage)]);
  rows.push(['4', 'MARGIN EARNED ON DISTRIBUTION OF INPUTS', L(p1.inputMargin)]);
  rows.push(['5', 'INCOME FROM SALE OF CONSUMER PRODUCTS', L(p1.consumerSale)]);
  rows.push(['6', 'INCOME FROM OWN PROCESSING UNITS (Annexure Attach)', L(p1.processingIncome)]);
  rows.push(['7', 'INCOME FROM TRUCKS', L(p1.truckIncome)]);
  rows.push(['8', 'RENTAL INCOME OF SOCIETY', L(p1.rentalIncome)]);
  rows.push(['9', 'OTHER INCOME IF ANY FROM HAFED', L(p1.hafedOther)]);
  rows.push(['10', 'INCOME FROM OTHER THAN HAFED', L(p1.nonHafedIncome)]);
  rows.push(['11', 'TOTAL INCOME (3+4+5+6+7+8+9+10)', L(p1.totalIncome)]);

  rows.push(['12', 'EXPENSES:', '']);
  const expKeys: Array<keyof typeof EXPENSE_BUCKET_LABELS> = ['admn','office','marketing','fertPesticide','processing','other'];
  const ab = ['a','b','c','d','e','f'];
  expKeys.forEach((k, i) => {
    rows.push(['', `${ab[i]}) ${EXPENSE_BUCKET_LABELS[k]}`, L(p1.expenses[k])]);
  });
  rows.push(['13', 'TOTAL EXP. (a+b+c+d+e+f)', L(p1.totalExpenses)]);
  rows.push(['14', 'NET PROFIT / LOSS IN THE SOCIETY (11-13)', L(p1.netProfitLoss)]);
  rows.push(['15', 'ACCUMULATED PROFIT / LOSS AS PER BALANCE SHEET', L(p1.accumulatedProfitLoss)]);
  rows.push(['16', 'DOES SOCIETY UNDERTAKE WHOLESALE BUSINESS OF FERT. & PESTICIDES: YES/NO',
    p1.wholesaleFertPesticide ? 'YES' : 'NO']);

  rows.push(['17', 'TURNOVER OF SOCIETY', '']);
  const toKeys: Array<keyof typeof TURNOVER_BUCKET_LABELS> = ['procurement','consumer','fertilizer','pesticide','cattleFeed','nonHafed'];
  toKeys.forEach((k, i) => {
    rows.push(['', `${ab[i]}) ${TURNOVER_BUCKET_LABELS[k]}`, L(p1.turnover[k])]);
  });
  rows.push(['18', 'TOTAL: (a+b+c+d+e+f) [must match with proforma-3]', L(p1.turnoverTotal)]);
  rows.push(['19', 'DETAIL OF EMPLOYEES OF THE SOCIETY (Annexure-5)', String(p1.employeeCount)]);
  rows.push(['20', 'SHARE CAPITAL', L(p1.shareCapital)]);
  rows.push(['21', 'INVESTMENT IN HAFED (SHARE CAPITAL)', L(p1.hafedShareInvestment)]);
  rows.push(['22', "FDR'S WITH HAFED", L(p1.hafedFdr)]);
  rows.push(['23', 'INVESTMENT OTHER THAN HAFED', L(p1.otherInvestment)]);
  rows.push(['24', 'REASONS OF LOSSES, IF ANY (MANAGER CMS COMMENTS)', p1.lossReasons || '-']);

  // ── AutoTable ──
  const boldRows = new Set(['1', '3', '11', '12', '13', '14', '17', '18']);
  autoTable(doc, {
    startY: 32,
    head: [['S.NO.', 'PARTICULARS', '(Rs. in Lacs)']],
    body: rows,
    theme: 'grid',
    styles: { font, fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 140 },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && boldRows.has(data.row.raw[0] as string)) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  // ── Signatory line at bottom ──
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text('Manager / Secretary', 30, finalY);
  doc.text('Chairman', 110, finalY);
  doc.text('Inspector / Auditor', 170, finalY);
  doc.line(15, finalY - 2, 70, finalY - 2);
  doc.line(95, finalY - 2, 140, finalY - 2);
  doc.line(155, finalY - 2, 195, finalY - 2);

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-1', society, fromDate, toDate));
}
