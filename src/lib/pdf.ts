import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings, AccountBalance, CashBookEntry, BankBookEntry, LedgerAccount, Member, MemberLedgerEntry, ReceiptsPaymentsData, Loan, Asset, AuditObjection } from '@/types';


const fmt = (amount: number): string =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(amount);

const fmtDate = (dateStr: string): string => {
  try { return new Date(dateStr).toLocaleDateString('en-IN'); } catch { return dateStr; }
};

/** All PDFs use English only — helvetica font always. */
function setupFont(_doc: jsPDF): string {
  return 'helvetica';
}

function addHeader(doc: jsPDF, title: string, society: SocietySettings, subtitle?: string): { startY: number; font: string } {
  const font = setupFont(doc);
  const pageW = doc.internal.pageSize.width;
  const cx = pageW / 2;
  const marginR = pageW - 15;

  doc.setFontSize(14);
  doc.setFont(font, 'bold');
  // Always use English society name in PDF
  doc.text(society.name, cx, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.text(`Reg. No: ${society.registrationNo} | FY: ${society.financialYear}`, cx, 21, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont(font, 'bold');
  doc.text(title, cx, 30, { align: 'center' });
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(subtitle, cx, 36, { align: 'center' });
  }
  doc.setDrawColor(41, 82, 163);
  doc.setLineWidth(0.5);
  doc.line(15, 40, marginR, 40);
  return { startY: 45, font };
}

export function generateCashBookPDF(
  entries: CashBookEntry[],
  society: SocietySettings,
  openingBalance: number,
  language: 'hi' | 'en'
) {
  const doc = new jsPDF();
  const { startY, font } = addHeader(doc, 'Cash Book', society, `Financial Year: ${society.financialYear}`);

  const totalReceipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);
  const totalPayments = entries.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : openingBalance;

  const body = [
    ['', 'OB', 'Opening Balance', fmt(openingBalance), '', fmt(openingBalance)],
    ...entries.map(e => [
      fmtDate(e.date),
      e.voucherNo,
      e.particulars,
      e.type === 'receipt' ? fmt(e.amount) : '',
      e.type === 'payment' ? fmt(e.amount) : '',
      fmt(e.runningBalance),
    ]),
  ];

  autoTable(doc, {
    startY,
    head: [['Date', 'Voucher No.', 'Particulars', 'Receipt (Dr)', 'Payment (Cr)', 'Balance']],
    body,
    foot: [['', '', 'Total', fmt(totalReceipts), fmt(totalPayments), fmt(closingBalance)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  doc.save(`cash-book-${society.financialYear}.pdf`);
}

export function generateBankBookPDF(
  entries: BankBookEntry[],
  society: SocietySettings,
  openingBalance: number,
  language: 'hi' | 'en'
) {
  const doc = new jsPDF();
  const { startY, font } = addHeader(doc, 'Bank Book', society, `Financial Year: ${society.financialYear}`);

  const totalDeposits = entries.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0);
  const totalWithdrawals = entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0);
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : openingBalance;

  const body = [
    ['', 'OB', 'Opening Balance', fmt(openingBalance), '', fmt(openingBalance)],
    ...entries.map(e => [
      fmtDate(e.date),
      e.voucherNo,
      e.particulars,
      e.type === 'deposit' ? fmt(e.amount) : '',
      e.type === 'withdrawal' ? fmt(e.amount) : '',
      fmt(e.runningBalance),
    ]),
  ];

  autoTable(doc, {
    startY,
    head: [['Date', 'Voucher No.', 'Particulars', 'Deposit', 'Withdrawal', 'Balance']],
    body,
    foot: [['', '', 'Total', fmt(totalDeposits), fmt(totalWithdrawals), fmt(closingBalance)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  doc.save(`bank-book-${society.financialYear}.pdf`);
}

export function generateTrialBalancePDF(balances: AccountBalance[], society: SocietySettings, asOnDate: string, language: 'hi' | 'en') {
  const doc = new jsPDF();
  const { startY, font } = addHeader(doc, 'Trial Balance', society, `As on: ${fmtDate(asOnDate)} | FY: ${society.financialYear}`);

  const totalDebit = balances.reduce((s, b) => s + b.totalDebit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.totalCredit, 0);

  const body = balances.map((b, i) => [
    String(i + 1),
    b.account.name, // Always English in PDF
    b.account.type.charAt(0).toUpperCase() + b.account.type.slice(1),
    b.totalDebit > 0 ? fmt(b.totalDebit) : '',
    b.totalCredit > 0 ? fmt(b.totalCredit) : '',
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Account Name', 'Type', 'Debit (Dr)', 'Credit (Cr)']],
    body,
    foot: [['', '', 'Total', fmt(totalDebit), fmt(totalCredit)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  doc.save(`trial-balance-${society.financialYear}.pdf`);
}

export function generateIncomeExpenditurePDF(
  incomeItems: { name: string; nameHi: string; amount: number }[],
  expenseItems: { name: string; nameHi: string; amount: number }[],
  society: SocietySettings,
  language: 'hi' | 'en',
  reserveFund: number = 0
) {
  const doc = new jsPDF('landscape');
  const { startY, font } = addHeader(doc, 'Income & Expenditure Account', society, `Financial Year: ${society.financialYear}`);

  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const isSurplus = netProfit >= 0;
  const distributableSurplus = isSurplus ? netProfit - reserveFund : 0;

  const expBody: string[][] = [
    ...expenseItems.map(i => [i.name, fmt(i.amount)]),
    ...(isSurplus && reserveFund > 0 ? [['Statutory Reserve Fund (25%)', fmt(reserveFund)]] : []),
    ...(isSurplus ? [['Surplus (to Balance Sheet)', fmt(distributableSurplus)]] : [['Deficit (to Balance Sheet)', fmt(Math.abs(netProfit))]]),
  ];
  const incBody: string[][] = incomeItems.map(i => [i.name, fmt(i.amount)]);

  // Expenditure side (left half)
  autoTable(doc, {
    startY,
    margin: { left: 15, right: 158 },
    head: [['Expenditure (Dr)', 'Amount']],
    body: expBody,
    foot: [['Total', fmt(totalIncome)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Income side (right half)
  autoTable(doc, {
    startY,
    margin: { left: 154, right: 15 },
    head: [['Income (Cr)', 'Amount']],
    body: incBody,
    foot: [['Total', fmt(totalIncome)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Reserve Fund note at bottom
  if (isSurplus && reserveFund > 0) {
    const finalY = Math.max((doc as any).lastAutoTable.finalY + 8, 185);
    doc.setFontSize(8);
    doc.setFont(font, 'normal');
    doc.text(
      `Note: Statutory Reserve Fund of ${fmt(reserveFund)} (25%) transferred as required under Haryana Cooperative Societies Act 1984, Sec 65`,
      15, finalY
    );
  }

  doc.save(`income-expenditure-${society.financialYear}.pdf`);
}

export function generateReceiptsPaymentsPDF(data: ReceiptsPaymentsData, society: SocietySettings) {
  const doc = new jsPDF('landscape');
  const { startY, font } = addHeader(doc, 'Receipts & Payments Account', society, `Financial Year: ${society.financialYear}`);

  const { openingCash, openingBank, receipts, payments, closingCash, closingBank } = data;
  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const drTotal = openingCash + openingBank + totalReceipts;
  const crTotal = totalPayments + closingCash + closingBank;

  // Dr side: Opening Balance + Receipts
  const drBody: string[][] = [
    ['To Balance b/d (Opening)', ''],
    ['  Cash in Hand', fmt(openingCash)],
    ['  Cash at Bank', fmt(openingBank)],
    ...receipts.map(r => [`To ${r.accountName}`, fmt(r.amount)]),
  ];

  // Cr side: Payments + Closing Balance
  const crBody: string[][] = [
    ...payments.map(p => [`By ${p.accountName}`, fmt(p.amount)]),
    ['By Balance c/d (Closing)', ''],
    ['  Cash in Hand', fmt(closingCash)],
    ['  Cash at Bank', fmt(closingBank)],
  ];

  // Dr (Receipts) side — left half
  autoTable(doc, {
    startY,
    margin: { left: 15, right: 158 },
    head: [['Dr — Receipts', 'Amount']],
    body: drBody,
    foot: [['Total', fmt(drTotal)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Cr (Payments) side — right half
  autoTable(doc, {
    startY,
    margin: { left: 154, right: 15 },
    head: [['Cr — Payments', 'Amount']],
    body: crBody,
    foot: [['Total', fmt(crTotal)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  doc.save(`receipts-payments-${society.financialYear}.pdf`);
}

export function generateBalanceSheetPDF(
  assetBalances: AccountBalance[],
  liabilityBalances: AccountBalance[],
  netProfit: number,
  society: SocietySettings,
  language: 'hi' | 'en',
  reserveFund: number = 0
) {
  const doc = new jsPDF('landscape');
  const { startY, font } = addHeader(doc, 'Balance Sheet', society, `As at 31st March 20${society.financialYear.split('-')[1]}`);

  const totalAssets = assetBalances.reduce((s, b) => s + Math.abs(b.netBalance), 0);
  const totalLiabilities = liabilityBalances.reduce((s, b) => s + Math.abs(b.netBalance), 0) + (netProfit > 0 ? netProfit : 0);
  const distributableSurplus = netProfit > 0 ? netProfit - reserveFund : 0;
  const pyBalances = society.previousYearBalances || {};
  const pyYear = society.previousFinancialYear || '';
  const hasPY = pyYear && Object.keys(pyBalances).length > 0;
  const getPY = (id: string) => pyBalances[id] ?? 0;

  const liabHead = hasPY
    ? [['Capital & Liabilities', pyYear, society.financialYear]]
    : [['Capital & Liabilities', 'Amount']];
  const assetHead = hasPY
    ? [['Assets', pyYear, society.financialYear]]
    : [['Assets', 'Amount']];

  const liabBody = [
    ...liabilityBalances.map(b => hasPY
      ? [b.account.name, getPY(b.account.id) ? fmt(getPY(b.account.id)) : '—', fmt(Math.abs(b.netBalance))]
      : [b.account.name, fmt(Math.abs(b.netBalance))]
    ),
    ...(netProfit > 0 && reserveFund > 0
      ? [hasPY ? ['Statutory Reserve Fund 25%', '—', fmt(reserveFund)] : ['Statutory Reserve Fund — 25%', fmt(reserveFund)]]
      : []),
    ...(netProfit > 0
      ? [hasPY ? ['Distributable Surplus', '—', fmt(distributableSurplus)] : ['Distributable Surplus', fmt(distributableSurplus)]]
      : []),
  ];

  const assetBody = assetBalances.map(b => hasPY
    ? [b.account.name, getPY(b.account.id) ? fmt(getPY(b.account.id)) : '—', fmt(Math.abs(b.netBalance))]
    : [b.account.name, fmt(Math.abs(b.netBalance))]
  );

  const pyLiabTotal = liabilityBalances.reduce((s, b) => s + getPY(b.account.id), 0);
  const pyAssetTotal = assetBalances.reduce((s, b) => s + getPY(b.account.id), 0);

  const colStyles = hasPY
    ? { 1: { halign: 'right' as const }, 2: { halign: 'right' as const } }
    : { 1: { halign: 'right' as const } };

  // Capital & Liabilities (left half)
  autoTable(doc, {
    startY,
    margin: { left: 15, right: 158 },
    head: liabHead,
    body: liabBody,
    foot: [hasPY ? ['Total', fmt(pyLiabTotal), fmt(totalLiabilities)] : ['Total', fmt(totalLiabilities)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: colStyles,
  });

  // Assets (right half)
  autoTable(doc, {
    startY,
    margin: { left: 154, right: 15 },
    head: assetHead,
    body: assetBody,
    foot: [hasPY ? ['Total', fmt(pyAssetTotal), fmt(totalAssets)] : ['Total', fmt(totalAssets)]],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    columnStyles: colStyles,
  });

  doc.save(`balance-sheet-${society.financialYear}.pdf`);
}

export function generateLedgerPDF(
  entries: { date: string; voucherNo: string; particulars: string; debit: number; credit: number; balance: number; balanceType: 'Dr' | 'Cr' }[],
  account: LedgerAccount,
  society: SocietySettings,
  language: 'hi' | 'en',
  fromDate?: string,
  toDate?: string
) {
  const doc = new jsPDF();
  const subtitle = fromDate && toDate
    ? `Account: ${account.name} | ${fmtDate(fromDate)} to ${fmtDate(toDate)}`
    : `Account: ${account.name} | FY: ${society.financialYear}`;
  const { startY, font } = addHeader(doc, 'Ledger Account Statement', society, subtitle);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closing = entries[entries.length - 1];

  const body = entries.map(e => [
    fmtDate(e.date),
    e.voucherNo,
    e.particulars,
    e.debit > 0 ? fmt(e.debit) : '',
    e.credit > 0 ? fmt(e.credit) : '',
    `${fmt(e.balance)} ${e.balanceType}`,
  ]);

  autoTable(doc, {
    startY,
    head: [['Date', 'Voucher No.', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
    body,
    foot: [['', '', 'Total', fmt(totalDebit), fmt(totalCredit), closing ? `${fmt(closing.balance)} ${closing.balanceType}` : '']],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  doc.save(`ledger-${account.name.toLowerCase().replace(/\s+/g, '-')}-${society.financialYear}.pdf`);
}

export function generateMemberPassbookPDF(
  member: Member,
  entries: MemberLedgerEntry[],
  society: SocietySettings
) {
  const doc = new jsPDF();
  const { startY, font } = addHeader(doc, 'Member Share Ledger', society, `Member: ${member.name} | ID: ${member.memberId}`);

  // Member info box
  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.text(`Father/Husband: ${member.fatherName || '-'}`, 15, startY + 2);
  doc.text(`Phone: ${member.phone}`, 15, startY + 7);
  doc.text(`Address: ${member.address || '-'}`, 15, startY + 12);
  doc.text(`Join Date: ${fmtDate(member.joinDate)}`, 120, startY + 2);
  doc.text(`Status: ${member.status.toUpperCase()}`, 120, startY + 7);

  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const closing = entries[entries.length - 1];

  const body = entries.map(e => [
    fmtDate(e.date),
    e.voucherNo,
    e.particulars,
    e.credit > 0 ? fmt(e.credit) : '',
    e.debit > 0 ? fmt(e.debit) : '',
    fmt(e.balance),
  ]);

  autoTable(doc, {
    startY: startY + 18,
    head: [['Date', 'Voucher No.', 'Particulars', 'Credit (Cr)', 'Debit (Dr)', 'Balance']],
    body,
    foot: [['', '', 'Total', fmt(totalCredit), fmt(totalDebit), closing ? fmt(closing.balance) : '']],
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  // Signature line
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text('Member Signature: ___________________', 15, finalY);
  doc.text('Secretary: ___________________', 120, finalY);

  doc.save(`member-passbook-${member.memberId}-${society.financialYear}.pdf`);
}

// ─── Share Register PDF ─────────────────────────────────────────────────────
export function generateShareRegisterPDF(members: Member[], society: SocietySettings): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const { startY, font } = addHeader(doc, 'SHARE REGISTER', society, `Financial Year: ${society.financialYear}`);

  const rows = members.map((m, i) => [
    String(i + 1),
    m.memberId,
    m.name,
    m.fatherName || '',
    m.joinDate,
    m.shareCertNo || '',
    m.shareCount != null ? String(m.shareCount) : '',
    m.shareFaceValue != null ? fmt(m.shareFaceValue) : '',
    fmt(m.shareCapital),
    m.nomineeName || '',
    m.nomineeRelation || '',
    m.status === 'active' ? 'Active' : 'Inactive',
  ]);

  autoTable(doc, {
    startY: startY + 2,
    head: [['S.No', 'Member ID', 'Name', 'Father/Husband', 'Join Date', 'Cert. No.', 'Shares', 'Face Val.', 'Total Capital', 'Nominee', 'Relation', 'Status']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 8: { halign: 'right' } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalCap = members.reduce((s, m) => s + m.shareCapital, 0);
  doc.setFontSize(10);
  doc.setFont(font, 'bold');
  doc.text(`Total Members: ${members.length}   |   Total Share Capital: ${fmt(totalCap)}`, 15, finalY);

  doc.save(`share-register-${society.financialYear}.pdf`);
}

// ─── Loan Register PDF ────────────────────────────────────────────────────────
export function generateLoanRegisterPDF(loans: Loan[], members: Member[], society: SocietySettings): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const { startY, font } = addHeader(doc, 'LOAN REGISTER', society, `Financial Year: ${society.financialYear}`);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id;
  const loanTypeLabel = (t: string) => t === 'short-term' ? 'S/T' : t === 'medium-term' ? 'M/T' : 'L/T';

  const rows = loans.map(l => [
    l.loanNo,
    getMemberName(l.memberId),
    loanTypeLabel(l.loanType),
    l.purpose || '',
    fmt(l.amount),
    `${l.interestRate}%`,
    fmtDate(l.disbursementDate),
    fmtDate(l.dueDate),
    fmt(l.repaidAmount),
    fmt(l.amount - l.repaidAmount),
    l.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: startY + 2,
    head: [['Loan No.', 'Member', 'Type', 'Purpose', 'Amount', 'Rate', 'Disbursed', 'Due Date', 'Repaid', 'Outstanding', 'Status']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 4: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
  const totalOutstanding = loans.filter(l => l.status !== 'cleared').reduce((s, l) => s + (l.amount - l.repaidAmount), 0);
  doc.setFontSize(10);
  doc.setFont(font, 'bold');
  doc.text(`Total Loans: ${loans.length}   |   Total Disbursed: ${fmt(totalDisbursed)}   |   Outstanding: ${fmt(totalOutstanding)}`, 15, finalY);

  doc.save(`loan-register-${society.financialYear}.pdf`);
}

// ─── Asset Register PDF ────────────────────────────────────────────────────────
export function generateAssetRegisterPDF(assets: Asset[], society: SocietySettings): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const { startY, font } = addHeader(doc, 'ASSET REGISTER', society, `As on: ${new Date().toLocaleDateString('en-IN')} | Depreciation Method: SLM`);

  const calcBookValue = (a: Asset): number => {
    if (!a.purchaseDate || !a.depreciationRate) return a.cost;
    const now = new Date();
    const yearEnd = now.getMonth() >= 3 ? new Date(now.getFullYear(), 2, 31) : new Date(now.getFullYear() - 1, 2, 31);
    const yearsElapsed = Math.max(0, (yearEnd.getTime() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000));
    return Math.max(0, a.cost - a.cost * (a.depreciationRate / 100) * yearsElapsed);
  };

  const rows = assets.map((a, i) => {
    const bookVal = calcBookValue(a);
    return [
      String(i + 1),
      a.assetNo,
      a.name,
      a.category,
      a.location || '',
      fmtDate(a.purchaseDate),
      fmt(a.cost),
      `${a.depreciationRate}%`,
      fmt(a.cost - bookVal),
      fmt(bookVal),
      a.status === 'active' ? 'Active' : 'Disposed',
    ];
  });

  autoTable(doc, {
    startY: startY + 2,
    head: [['S.No', 'Asset No.', 'Asset Name', 'Category', 'Location', 'Purchase Date', 'Cost', 'Dep%', 'Acc. Dep.', 'Book Value', 'Status']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 6: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
    foot: [[
      '', '', '', '', '', 'Total',
      fmt(assets.reduce((s, a) => s + a.cost, 0)),
      '',
      fmt(assets.reduce((s, a) => s + (a.cost - calcBookValue(a)), 0)),
      fmt(assets.reduce((s, a) => s + calcBookValue(a), 0)),
      '',
    ]],
    footStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
  });

  doc.save(`asset-register-${new Date().getFullYear()}.pdf`);
}

// ─── Audit Rectification Register PDF ─────────────────────────────────────────
export function generateAuditRegisterPDF(objections: AuditObjection[], society: SocietySettings): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const { startY, font } = addHeader(doc, 'AUDIT RECTIFICATION REGISTER', society, `Prepared on: ${new Date().toLocaleDateString('en-IN')}`);

  const statusLabel = (s: string) => s === 'rectified' ? 'Rectified' : s === 'partial' ? 'Partial' : 'Pending';

  const rows = objections.map(o => [
    o.objectionNo,
    o.auditYear,
    o.paraNo,
    o.category.toUpperCase(),
    o.objection.length > 60 ? o.objection.substring(0, 60) + '...' : o.objection,
    o.amountInvolved > 0 ? fmt(o.amountInvolved) : '—',
    o.dueDate ? fmtDate(o.dueDate) : '—',
    o.actionTaken ? (o.actionTaken.length > 40 ? o.actionTaken.substring(0, 40) + '...' : o.actionTaken) : '—',
    o.rectifiedDate ? fmtDate(o.rectifiedDate) : '—',
    statusLabel(o.status),
  ]);

  autoTable(doc, {
    startY: startY + 2,
    head: [['Objn. No.', 'Audit Year', 'Para', 'Category', 'Objection', 'Amount', 'Due Date', 'Action Taken', 'Rect. Date', 'Status']],
    body: rows,
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      4: { cellWidth: 55 },
      7: { cellWidth: 45 },
      5: { halign: 'right' },
    },
    didDrawCell: (data) => {
      // Color status column
      if (data.section === 'body' && data.column.index === 9) {
        const val = data.cell.raw as string;
        if (val === 'Rectified') { doc.setTextColor(22, 163, 74); }
        else if (val === 'Partial') { doc.setTextColor(217, 119, 6); }
        else { doc.setTextColor(220, 38, 38); }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const pending = objections.filter(o => o.status === 'pending').length;
  const rectified = objections.filter(o => o.status === 'rectified').length;
  const totalAmt = objections.reduce((s, o) => s + o.amountInvolved, 0);
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.text(`Total: ${objections.length} | Pending: ${pending} | Rectified: ${rectified} | Total Amount Involved: ${fmt(totalAmt)}`, 15, finalY);

  const sigY = finalY + 15;
  doc.text('Secretary: ___________________', 15, sigY);
  doc.text('Auditor: ___________________', 120, sigY);
  doc.text('President: ___________________', 225, sigY);

  doc.save(`audit-register-${society.financialYear}.pdf`);
}

export function generateDayBookPDF(
  entries: { id: string; date: string; voucherNo: string; type: string; debitAccountId: string; creditAccountId: string; amount: number; narration?: string }[],
  accounts: LedgerAccount[],
  society: SocietySettings,
  fromDate: string,
  toDate: string,
  language: 'hi' | 'en'
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const getAccName = (id: string) => accounts.find(a => a.id === id)?.name || id;
  const typeLabel = (t: string) => t === 'receipt' ? 'Receipt' : t === 'payment' ? 'Payment' : 'Journal';

  const subtitle = `${fmtDate(fromDate)} to ${fmtDate(toDate)} | FY: ${society.financialYear}`;
  const { startY, font } = addHeader(doc, 'Day Book', society, subtitle);

  // Group by date
  const groups: { date: string; items: typeof entries }[] = [];
  entries.forEach(v => {
    const last = groups[groups.length - 1];
    if (last && last.date === v.date) last.items.push(v);
    else groups.push({ date: v.date, items: [v] });
  });

  // Running cash only (Day Book = cash based)
  const cashAccOB = accounts.find(a => a.id === 'CASH')?.openingBalance || 0;
  // Compute pre-period cash: OB + all vouchers before first entry date
  const firstDate = entries.length > 0 ? entries[0].date : null;
  let runCash = cashAccOB;
  if (firstDate) {
    entries.forEach(v => {
      if (v.date >= firstDate) return;
      if (v.debitAccountId === 'CASH') runCash += v.amount;
      else if (v.creditAccountId === 'CASH') runCash -= v.amount;
    });
  }

  // Columns: Date/Voucher | Particulars | Debit (Rs.) | Credit (Rs.)
  // Each voucher = 2 rows: Dr row + Cr row
  const body: (string[])[] = [];
  const dayHeaderRows: number[] = [];
  const openingBalRows: number[] = [];
  const dayTotalRows: number[] = [];
  const closingBalRows: number[] = [];
  const drRows: number[] = [];
  const crRows: number[] = [];

  groups.forEach(group => {
    const dayDate = fmtDate(group.date);
    const dayTotal = group.items.reduce((s, v) => s + v.amount, 0);
    const dayReceipts = group.items.filter(v => v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
    const dayPayments = group.items.filter(v => v.type === 'payment').reduce((s, v) => s + v.amount, 0);

    // Day header row (spans all 4 cols)
    dayHeaderRows.push(body.length);
    body.push([
      `${dayDate}`,
      `${group.items.length} transaction(s)   Rcpt: ${fmt(dayReceipts)}   Pmnt: ${fmt(dayPayments)}`,
      '',
      `Total: ${fmt(dayTotal)}`,
    ]);

    // Opening balance row
    openingBalRows.push(body.length);
    body.push(['Opening Balance', `Cash in Hand (Opening): ${fmt(runCash)}`, fmt(runCash), '']);

    // Transaction rows — 2 per voucher
    group.items.forEach((v, i) => {
      const drLabel = `${getAccName(v.debitAccountId)}  Dr.`;
      const crLabel = `    To ${getAccName(v.creditAccountId)}  Cr.`;
      const narration = v.narration ? `  (${v.narration})` : '';

      // Dr row
      drRows.push(body.length);
      body.push([
        `${fmtDate(v.date)}\n${typeLabel(v.type)}\n#${i + 1} ${v.voucherNo}`,
        drLabel,
        fmt(v.amount),
        '',
      ]);

      // Cr row
      crRows.push(body.length);
      body.push([
        '',
        `${crLabel}${narration}`,
        '',
        fmt(v.amount),
      ]);
    });

    // Day total row
    dayTotalRows.push(body.length);
    body.push(['Day Total', `${dayDate}`, fmt(dayTotal), fmt(dayTotal)]);

    // Update running cash
    group.items.forEach(v => {
      if (v.debitAccountId === 'CASH') runCash += v.amount;
      else if (v.creditAccountId === 'CASH') runCash -= v.amount;
    });

    // Closing balance row
    closingBalRows.push(body.length);
    body.push(['Closing Balance', `Cash in Hand (Closing): ${fmt(runCash)}`, fmt(runCash), '']);
  });

  const grandTotal = entries.reduce((s, v) => s + v.amount, 0);

  autoTable(doc, {
    startY,
    head: [['Date / Voucher', 'Particulars', 'Debit (Rs.)', 'Credit (Rs.)']],
    body,
    foot: [['', 'GRAND TOTAL', fmt(grandTotal), fmt(grandTotal)]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [220, 230, 255], fontStyle: 'bold', textColor: 20, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 145 },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const rowIdx = data.row.index;
      if (dayHeaderRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [41, 82, 163];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
      } else if (openingBalRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [255, 248, 220];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [120, 80, 0];
        if (data.column.index >= 2) data.cell.styles.halign = 'right';
      } else if (drRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [240, 245, 255];
        data.cell.styles.textColor = [30, 50, 150];
        if (data.column.index >= 2) data.cell.styles.halign = 'right';
      } else if (crRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [245, 255, 245];
        data.cell.styles.textColor = [20, 100, 40];
        if (data.column.index >= 2) data.cell.styles.halign = 'right';
      } else if (dayTotalRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [230, 236, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [30, 30, 150];
        if (data.column.index >= 2) data.cell.styles.halign = 'right';
      } else if (closingBalRows.includes(rowIdx)) {
        data.cell.styles.fillColor = [225, 245, 225];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [20, 100, 20];
        if (data.column.index >= 2) data.cell.styles.halign = 'right';
      }
    },
  });

  doc.save(`day-book-${society.financialYear}.pdf`);
}
