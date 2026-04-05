/**
 * Cooperative Federation / Registrar Annual Statistical Return
 *
 * Generates the annual statutory return for the Cooperative Registrar /
 * Federation with 8 numbered sections.
 * PDF export in English.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollText, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName, rightAlignAmountColumns } from '@/lib/pdf';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const pct = (n: number) => `${n.toFixed(2)}%`;

const daysBetween = (d1: Date, d2: Date) =>
  Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

// Determine financial year start date from financialYear string e.g. "2023-24"
const fyStart = (fy: string): Date => {
  const year = parseInt(fy.split('-')[0], 10);
  return new Date(year, 3, 1); // 1 April
};

const FederationReport: React.FC = () => {
  const { language } = useLanguage();
  const { society, accounts, loans, members, vouchers, getProfitLoss, kccLoans } = useData();
  const hi = language === 'hi';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Editable field: audit completion date ──────────────────────────────────
  const [auditDate, setAuditDate] = useState('');

  // ── Account balance helper ───────────────────────────────────────────────────
  const getBalance = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return 0;
    let bal = acc.openingBalanceType === 'credit' ? acc.openingBalance : -acc.openingBalance;
    vouchers.filter(v => !v.isDeleted).forEach(v => {
      getVoucherLines(v).forEach(l => {
        if (l.accountId !== id) return;
        if (l.type === 'Dr') bal -= l.amount;
        else bal += l.amount;
      });
    });
    return bal;
  };

  // ── Section 2: Membership Strength ─────────────────────────────────────────
  const membershipData = useMemo(() => {
    const fyStartDate = fyStart(society.financialYear);
    const totalMembers = members.length;

    // Members joined in current FY (createdAt >= fyStart)
    const joined = members.filter(m => {
      const d = new Date(m.joinDate || '');
      return d >= fyStartDate;
    }).length;

    // Members left (inactive)
    const left = members.filter(m => m.status === 'inactive').length;

    // Opening = total - joined
    const opening = totalMembers - joined;
    // Closing = opening + joined - left
    const closing = opening + joined - left;

    return { opening, joined, left, closing };
  }, [members, society.financialYear]);

  // ── Section 3: Share Capital ────────────────────────────────────────────────
  const shareData = useMemo(() => {
    const sharesIssued = members.reduce((s, m) => s + (m.shareCount ?? 0), 0);
    const paidUp = members.reduce((s, m) => s + (m.shareCapital ?? 0), 0);
    return { sharesIssued, paidUp };
  }, [members]);

  // ── Section 4: Deposits ─────────────────────────────────────────────────────
  const depositTotal = useMemo(() => {
    return accounts
      .filter(a => !a.isGroup && a.type === 'liability' &&
        /deposit|fd|rd/i.test(a.name))
      .reduce((s, a) => {
        const b = getBalance(a.id);
        return s + (b > 0 ? b : 0);
      }, 0);
  }, [accounts, vouchers]);

  // ── Section 5: Loans & Advances ─────────────────────────────────────────────
  const loanData = useMemo(() => {
    const sanctioned = loans.reduce((s, l) => s + l.amount, 0);
    const disbursed = sanctioned;
    const recovered = loans.reduce((s, l) => s + l.repaidAmount, 0);
    const outstanding = disbursed - recovered;
    const overdue = loans
      .filter(l => {
        const due = new Date(l.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today && l.status !== 'cleared';
      })
      .reduce((s, l) => s + (l.amount - l.repaidAmount), 0);

    // KCC NPA amounts
    const kccNpa = kccLoans
      .filter(loan => {
        if (loan.status === 'repaid') return false;
        const due = new Date(loan.dueDate);
        due.setHours(0, 0, 0, 0);
        return daysBetween(due, today) > 90;
      })
      .reduce((s, l) => s + (l.outstandingAmount ?? (l.drawnAmount - l.repaidAmount)), 0);

    const npaAmt = overdue + kccNpa;
    const totalOutstanding = outstanding + kccLoans.reduce((s, l) => s + (l.outstandingAmount ?? (l.drawnAmount - l.repaidAmount)), 0);
    const npaPct = totalOutstanding > 0 ? (npaAmt / totalOutstanding) * 100 : 0;

    return { sanctioned, disbursed, recovered, outstanding, overdue, npaAmt, npaPct };
  }, [loans, kccLoans, today]);

  // ── Section 6: Working Capital ───────────────────────────────────────────────
  const wcData = useMemo(() => {
    const ownFunds = accounts
      .filter(a => !a.isGroup && a.type === 'equity')
      .reduce((s, a) => { const b = getBalance(a.id); return s + (b > 0 ? b : 0); }, 0);
    const borrowings = accounts
      .filter(a => !a.isGroup && a.type === 'liability')
      .reduce((s, a) => { const b = getBalance(a.id); return s + (b > 0 ? b : 0); }, 0);
    return { ownFunds, borrowings, total: ownFunds + borrowings };
  }, [accounts, vouchers]);

  // ── Section 7: Profit & Loss Appropriation ──────────────────────────────────
  const plData = useMemo(() => {
    const { netProfit } = getProfitLoss();
    const statutoryReserve = netProfit > 0 ? netProfit * 0.25 : 0;
    const educationFund = netProfit > 0 ? netProfit * 0.01 : 0;
    const dividendFund = netProfit > 0 ? netProfit * 0.15 : 0;
    const balance = netProfit - statutoryReserve - educationFund - dividendFund;
    return { netProfit, statutoryReserve, educationFund, dividendFund, balance };
  }, [getProfitLoss]);

  // ── CSV / Excel Export ───────────────────────────────────────────────────────
  const fedHeaders = ['Section', 'Particulars', 'Value'];

  const fedDataRows = () => [
    // Section 1
    ['1. Society Particulars', 'Society Name', society.name],
    ['1. Society Particulars', 'Registration No.', society.registrationNo || '—'],
    ['1. Society Particulars', 'Financial Year', society.financialYear],
    ['1. Society Particulars', 'Address', society.address || '—'],
    ['1. Society Particulars', 'District', society.district || '—'],
    ['1. Society Particulars', 'State', society.state || '—'],
    // Section 2
    ['2. Membership', 'Opening Members', membershipData.opening],
    ['2. Membership', 'Joined', membershipData.joined],
    ['2. Membership', 'Left', membershipData.left],
    ['2. Membership', 'Closing Members', membershipData.closing],
    // Section 3
    ['3. Share Capital', 'Shares Issued', shareData.sharesIssued],
    ['3. Share Capital', 'Paid-up Capital (₹)', fmt(shareData.paidUp)],
    // Section 4
    ['4. Deposits', 'Total Deposits (₹)', fmt(depositTotal)],
    // Section 5
    ['5. Loans', 'Loans Sanctioned (₹)', fmt(loanData.sanctioned)],
    ['5. Loans', 'Loans Disbursed (₹)', fmt(loanData.disbursed)],
    ['5. Loans', 'Loans Recovered (₹)', fmt(loanData.recovered)],
    ['5. Loans', 'Loans Outstanding (₹)', fmt(loanData.outstanding)],
    ['5. Loans', 'Overdue Amount (₹)', fmt(loanData.overdue)],
    ['5. Loans', 'NPA Amount (₹)', fmt(loanData.npaAmt)],
    ['5. Loans', 'NPA %', pct(loanData.npaPct)],
    // Section 6
    ['6. Working Capital', 'Own Funds (₹)', fmt(wcData.ownFunds)],
    ['6. Working Capital', 'Borrowings (₹)', fmt(wcData.borrowings)],
    ['6. Working Capital', 'Total Working Capital (₹)', fmt(wcData.total)],
    // Section 7
    ['7. P&L Appropriation', 'Net Profit / (Loss) (₹)', fmt(plData.netProfit)],
    ['7. P&L Appropriation', 'Statutory Reserve @ 25% (₹)', fmt(plData.statutoryReserve)],
    ['7. P&L Appropriation', 'Education Fund @ 1% (₹)', fmt(plData.educationFund)],
    ['7. P&L Appropriation', 'Dividend Fund @ 15% (₹)', fmt(plData.dividendFund)],
    ['7. P&L Appropriation', 'Balance carried forward (₹)', fmt(plData.balance)],
    // Section 8
    ['8. Audit Status', 'Audit Completion Date', auditDate || '(Pending)'],
  ];

  const handleCSV = () => {
    downloadCSV(fedHeaders, fedDataRows(), 'federation-annual-return');
  };

  const handleExcel = () => {
    downloadExcelSingle(fedHeaders, fedDataRows(), 'federation-annual-return', 'Annual Return');
  };

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const { startY, font } = addHeader(doc, 'Federation Annual Return', society, `Cooperative Society Annual Statistical Return | FY: ${society.financialYear}`, { reportCode: 'FED' });
    let y = startY;

    const subHeading = (text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(text, 14, y);
      y += 5;
    };

    const ensureSpace = (needed = 40) => {
      if (y + needed > 270) { doc.addPage(); y = 16; }
    };

    // Section 1
    subHeading('Section 1 — Society Particulars');
    autoTable(doc, {
      startY: y,
      head: [['Field', 'Details']],
      body: [
        ['Society Name', society.name],
        ['Registration No.', society.registrationNo || '—'],
        ['Financial Year', society.financialYear],
        ['Address', society.address || '—'],
        ['District', society.district || '—'],
        ['State', society.state || '—'],
        ['Phone', society.phone || '—'],
        ['Email', society.email || '—'],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 2
    ensureSpace(40);
    subHeading('Section 2 — Membership Strength');
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Opening', 'Joined', 'Left', 'Closing']],
      body: [
        ['Members', membershipData.opening, membershipData.joined, membershipData.left, membershipData.closing],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 3
    ensureSpace(30);
    subHeading('Section 3 — Share Capital');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Value']],
      body: [
        ['Total Shares Issued', shareData.sharesIssued],
        ['Total Paid-up Capital (Rs.)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(shareData.paidUp)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 4
    ensureSpace(25);
    subHeading('Section 4 — Deposits (Borrowings)');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [['Total Deposits (FD/RD/Deposit accounts)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(depositTotal)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 5
    ensureSpace(55);
    subHeading('Section 5 — Loans & Advances');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Loans Sanctioned', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.sanctioned)],
        ['Loans Disbursed', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.disbursed)],
        ['Loans Recovered', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.recovered)],
        ['Loans Outstanding', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.outstanding)],
        ['Overdue Amount', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.overdue)],
        ['NPA Amount', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanData.npaAmt)],
        ['NPA %', pct(loanData.npaPct)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 6
    ensureSpace(35);
    subHeading('Section 6 — Working Capital');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Total Own Funds (Equity)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(wcData.ownFunds)],
        ['Total Borrowings (Liabilities)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(wcData.borrowings)],
        ['Total Working Capital', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(wcData.total)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 7
    ensureSpace(45);
    subHeading('Section 7 — Profit & Loss Appropriation');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Net Profit / (Loss)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plData.netProfit)],
        ['Statutory Reserve @ 25%', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plData.statutoryReserve)],
        ['Education Fund @ 1%', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plData.educationFund)],
        ['Dividend Fund @ 15%', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plData.dividendFund)],
        ['Balance carried forward', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plData.balance)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Section 8
    ensureSpace(40);
    subHeading('Section 8 — Audit Status');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Details']],
      body: [
        ['Financial Year', society.financialYear],
        ['Audit Completion Date', auditDate || '(Pending)'],
        ['Annual Return Filed', 'Yes'],
        ['Audit Fee Paid', 'Yes'],
        ['Bye-laws Complied', 'Yes'],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });

    const sigY = (doc as any).lastAutoTable.finalY + 10;
    const sig = getSignatoryNames(society);
    addSignatureBlock(doc, font, ['Accountant', 'Secretary / Manager', 'President'], sigY, undefined,
      [sig.accountant, sig.secretary, sig.president]);

    addPageNumbers(doc, font, society?.name);
    doc.save(pdfFileName('Federation_AnnualReturn', society));
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-green-700" />
          <div>
            <h1 className="text-2xl font-bold">
              {hi ? 'सहकारी वार्षिक विवरणी' : 'Federation Annual Return'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? 'सहकारी रजिस्ट्रार / फेडरेशन वार्षिक सांख्यिकीय विवरणी' : 'Cooperative Registrar / Federation Annual Statistical Return'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleDownloadPDF} className="gap-2">
            <Download className="h-4 w-4" />
            {hi ? 'PDF डाउनलोड करें' : 'Download PDF'}
          </Button>
          <Button onClick={handleExcel} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button onClick={handleCSV} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {/* Section 1 — Society Particulars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '1. समिति का विवरण' : '1. Society Particulars'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              [hi ? 'समिति का नाम' : 'Society Name', society.name],
              [hi ? 'पंजीकरण संख्या' : 'Registration No.', society.registrationNo || '—'],
              [hi ? 'वित्तीय वर्ष' : 'Financial Year', society.financialYear],
              [hi ? 'पता' : 'Address', society.address || '—'],
              [hi ? 'जिला' : 'District', society.district || '—'],
              [hi ? 'राज्य' : 'State', society.state || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-muted-foreground min-w-[140px]">{label}:</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Membership */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '2. सदस्यता' : '2. Membership Strength'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left">{hi ? 'श्रेणी' : 'Category'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'प्रारंभिक' : 'Opening'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'सम्मिलित' : 'Joined'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'निष्क्रिय/छोड़ा' : 'Left'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'अंतिम' : 'Closing'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/50">
                  <td className="border px-3 py-2">{hi ? 'सदस्य' : 'Members'}</td>
                  <td className="border px-3 py-2 text-right">{membershipData.opening}</td>
                  <td className="border px-3 py-2 text-right">{membershipData.joined}</td>
                  <td className="border px-3 py-2 text-right">{membershipData.left}</td>
                  <td className="border px-3 py-2 text-right font-semibold">{membershipData.closing}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — Share Capital */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '3. अंश पूंजी' : '3. Share Capital'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-700">{shareData.sharesIssued.toLocaleString('en-IN')}</div>
              <div className="text-sm text-muted-foreground mt-1">{hi ? 'जारी किए गए कुल अंश' : 'Total Shares Issued'}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-700">₹{fmt(shareData.paidUp)}</div>
              <div className="text-sm text-muted-foreground mt-1">{hi ? 'कुल चुकता पूंजी' : 'Total Paid-up Capital'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Deposits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '4. जमा राशि (उधार)' : '4. Deposits (Borrowings)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <div className="flex justify-between p-3 bg-muted rounded">
              <span>{hi ? 'कुल जमा (FD/RD/Deposit खाते)' : 'Total Deposits (FD/RD/Deposit accounts)'}</span>
              <span className="font-bold">₹{fmt(depositTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5 — Loans & Advances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '5. ऋण एवं अग्रिम' : '5. Loans & Advances'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left">{hi ? 'विवरण' : 'Particulars'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [hi ? 'स्वीकृत ऋण' : 'Loans Sanctioned', fmt(loanData.sanctioned)],
                  [hi ? 'वितरित ऋण' : 'Loans Disbursed', fmt(loanData.disbursed)],
                  [hi ? 'वसूली' : 'Recovered', fmt(loanData.recovered)],
                  [hi ? 'बकाया ऋण' : 'Outstanding Loans', fmt(loanData.outstanding)],
                  [hi ? 'अतिदेय राशि' : 'Overdue Amount', fmt(loanData.overdue)],
                  [hi ? 'NPA राशि' : 'NPA Amount', fmt(loanData.npaAmt)],
                  [hi ? 'NPA %' : 'NPA %', pct(loanData.npaPct)],
                ].map(([label, value]) => (
                  <tr key={label} className="hover:bg-muted/50">
                    <td className="border px-3 py-2">{label}</td>
                    <td className="border px-3 py-2 text-right">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 6 — Working Capital */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '6. कार्यशील पूंजी' : '6. Working Capital'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left">{hi ? 'विवरण' : 'Particulars'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'स्वयं के फंड (इक्विटी)' : 'Total Own Funds (Equity)'}</td><td className="border px-3 py-2 text-right">{fmt(wcData.ownFunds)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'कुल उधार (देनदारियां)' : 'Total Borrowings (Liabilities)'}</td><td className="border px-3 py-2 text-right">{fmt(wcData.borrowings)}</td></tr>
                <tr className="font-bold bg-muted"><td className="border px-3 py-2">{hi ? 'कुल कार्यशील पूंजी' : 'Total Working Capital'}</td><td className="border px-3 py-2 text-right">{fmt(wcData.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 7 — P&L Appropriation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '7. लाभ-हानि विनियोजन' : '7. Profit & Loss Appropriation'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left">{hi ? 'विवरण' : 'Particulars'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'शुद्ध लाभ / (हानि)' : 'Net Profit / (Loss)'}</td><td className="border px-3 py-2 text-right font-semibold">{fmt(plData.netProfit)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'वैधानिक संचय @ 25%' : 'Statutory Reserve @ 25%'}</td><td className="border px-3 py-2 text-right">{fmt(plData.statutoryReserve)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'शिक्षा निधि @ 1%' : 'Education Fund @ 1%'}</td><td className="border px-3 py-2 text-right">{fmt(plData.educationFund)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'लाभांश निधि @ 15%' : 'Dividend Fund @ 15%'}</td><td className="border px-3 py-2 text-right">{fmt(plData.dividendFund)}</td></tr>
                <tr className="font-bold bg-muted"><td className="border px-3 py-2">{hi ? 'शेष राशि (आगे ले जाने हेतु)' : 'Balance carried forward'}</td><td className="border px-3 py-2 text-right">{fmt(plData.balance)}</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 8 — Audit Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? '8. ऑडिट स्थिति' : '8. Audit Status'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">{hi ? 'वित्तीय वर्ष' : 'Financial Year'}</Label>
              <div className="px-3 py-2 bg-muted rounded text-sm font-medium">{society.financialYear}</div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-date" className="text-sm text-muted-foreground">
                {hi ? 'ऑडिट पूर्णता दिनांक' : 'Audit Completion Date'}
              </Label>
              <Input
                id="audit-date"
                type="date"
                value={auditDate}
                onChange={e => setAuditDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {hi ? 'वैधानिक अनुपालन (केवल प्रदर्शन)' : 'Statutory Compliance (Display Only)'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                hi ? 'वार्षिक विवरणी दाखिल की गई' : 'Annual Return Filed',
                hi ? 'ऑडिट शुल्क जमा किया गया' : 'Audit Fee Paid',
                hi ? 'उप-नियमों का पालन किया गया' : 'Bye-laws Complied',
                hi ? 'AGM आयोजित की गई' : 'AGM Conducted',
                hi ? 'सदस्य रजिस्टर अद्यतन' : 'Member Register Updated',
                hi ? 'अंश रजिस्टर अद्यतन' : 'Share Register Updated',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FederationReport;
