/**
 * NABARD / DCC Bank Credit Report
 *
 * Generates NABARD/DCC Bank compliance report with NPA classification,
 * loan portfolio summary, member credit summary, and working capital statement.
 * PDF export in English.
 */
import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Landmark, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcel } from '@/lib/exportUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName, rightAlignAmountColumns } from '@/lib/pdf';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const pct = (n: number) => `${n.toFixed(2)}%`;

// Days between two dates (positive = d2 is after d1)
const daysBetween = (d1: Date, d2: Date) =>
  Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

type NpaClass = 'Standard' | 'Sub-Standard' | 'Doubtful' | 'Loss';

interface NpaRow {
  classification: NpaClass;
  accounts: number;
  outstanding: number;
  overdue: number;
}

const NabardReport: React.FC = () => {
  const { language } = useLanguage();
  const { society, accounts, loans, members, vouchers, kccLoans } = useData();
  const hi = language === 'hi';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Section A: KCC NPA Classification ───────────────────────────────────────
  const npaData = useMemo((): NpaRow[] => {
    const rows: Record<NpaClass, NpaRow> = {
      Standard:      { classification: 'Standard',      accounts: 0, outstanding: 0, overdue: 0 },
      'Sub-Standard':{ classification: 'Sub-Standard',  accounts: 0, outstanding: 0, overdue: 0 },
      Doubtful:      { classification: 'Doubtful',      accounts: 0, outstanding: 0, overdue: 0 },
      Loss:          { classification: 'Loss',          accounts: 0, outstanding: 0, overdue: 0 },
    };

    kccLoans.forEach(loan => {
      if (loan.status === 'repaid') return; // exclude fully repaid
      const due = new Date(loan.dueDate);
      due.setHours(0, 0, 0, 0);
      const overdueDays = daysBetween(due, today);
      const outstanding = loan.outstandingAmount ?? (loan.drawnAmount - loan.repaidAmount);
      const overdueAmt = overdueDays > 0 ? outstanding : 0;

      let cls: NpaClass;
      if (overdueDays <= 90) cls = 'Standard';
      else if (overdueDays <= 365) cls = 'Sub-Standard';
      else if (overdueDays <= 1095) cls = 'Doubtful';
      else cls = 'Loss';

      rows[cls].accounts += 1;
      rows[cls].outstanding += outstanding;
      rows[cls].overdue += overdueAmt;
    });

    return Object.values(rows);
  }, [kccLoans, today]);

  const kccTotals = useMemo(() => ({
    accounts: npaData.reduce((s, r) => s + r.accounts, 0),
    outstanding: npaData.reduce((s, r) => s + r.outstanding, 0),
    overdue: npaData.reduce((s, r) => s + r.overdue, 0),
  }), [npaData]);

  const npaTotalOutstanding = npaData
    .filter(r => r.classification !== 'Standard')
    .reduce((s, r) => s + r.outstanding, 0);

  const npaRatio = kccTotals.outstanding > 0
    ? (npaTotalOutstanding / kccTotals.outstanding) * 100
    : 0;

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

  // ── Section B: Loan Portfolio Summary ───────────────────────────────────────
  const loanStats = useMemo(() => {
    const disbursed = loans.reduce((s, l) => s + l.amount, 0);
    const outstanding = loans.reduce((s, l) => s + (l.amount - l.repaidAmount), 0);
    const overdue = loans
      .filter(l => {
        const due = new Date(l.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today && l.status !== 'cleared';
      })
      .reduce((s, l) => s + (l.amount - l.repaidAmount), 0);
    const recovered = disbursed - outstanding;
    const recoveryPct = disbursed > 0 ? (recovered / disbursed) * 100 : 0;
    return { disbursed, outstanding, overdue, recovered, recoveryPct };
  }, [loans, today]);

  // ── Section C: Member Credit Summary ────────────────────────────────────────
  const memberStats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => m.status === 'active').length;
    const memberIdsWithLoans = new Set(loans.map(l => l.memberId));
    const withLoans = members.filter(m => memberIdsWithLoans.has(m.id)).length;
    return { total, active, withLoans };
  }, [members, loans]);

  // ── Section D: Working Capital ───────────────────────────────────────────────
  const workingCapital = useMemo(() => {
    const equityAccounts = accounts.filter(a => !a.isGroup && a.type === 'equity');
    const ownFunds = equityAccounts.reduce((s, a) => {
      const b = getBalance(a.id);
      return s + (b > 0 ? b : 0);
    }, 0);

    const liabilityAccounts = accounts.filter(a => !a.isGroup && a.type === 'liability');
    const borrowedFunds = liabilityAccounts.reduce((s, a) => {
      const b = getBalance(a.id);
      return s + (b > 0 ? b : 0);
    }, 0);

    return { ownFunds, borrowedFunds, total: ownFunds + borrowedFunds };
  }, [accounts, vouchers]);

  // ── CSV / Excel Export ───────────────────────────────────────────────────────
  const npaHeaders = ['Classification', 'No. of Accounts', 'Outstanding Amount (₹)', 'Overdue Amount (₹)'];
  const loanSummaryHeaders = ['Particulars', 'Amount (₹)'];

  const npaDataRows = () =>
    npaData.map(r => [r.classification, r.accounts, fmt(r.outstanding), fmt(r.overdue)]);

  const loanSummaryRows = () => [
    ['Total Loans Disbursed', fmt(loanStats.disbursed)],
    ['Total Outstanding', fmt(loanStats.outstanding)],
    ['Total Overdue', fmt(loanStats.overdue)],
    ['Total Recovered', fmt(loanStats.recovered)],
    ['Recovery %', pct(loanStats.recoveryPct)],
  ];

  const handleCSV = () => {
    downloadCSV(npaHeaders, npaDataRows(), 'nabard-report-npa');
  };

  const handleExcel = () => {
    downloadExcel([
      { name: 'NPA Classification', headers: npaHeaders, rows: npaDataRows() },
      { name: 'Loan Summary', headers: loanSummaryHeaders, rows: loanSummaryRows() },
    ], 'nabard-report');
  };

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const { startY, font } = addHeader(doc, 'NABARD/DCC Bank Credit Report', society, `Financial Year: ${society.financialYear}`, { reportCode: 'NBR' });
    let y = startY;

    const subHeading = (text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(text, 14, y);
      y += 5;
    };

    // Section A
    subHeading('Section A — KCC / Crop Loan NPA Classification');
    autoTable(doc, {
      startY: y,
      head: [['Classification', 'No. of Accounts', 'Outstanding Amount (Rs.)', 'Overdue Amount (Rs.)']],
      body: [
        ...npaData.map(r => [r.classification, r.accounts, fmt(r.outstanding), fmt(r.overdue)]),
        ['Total', kccTotals.accounts, fmt(kccTotals.outstanding), fmt(kccTotals.overdue)],
      ],
      foot: [[{ content: `NPA Ratio: ${pct(npaRatio)}`, colSpan: 4, styles: { fontStyle: 'bold' } }]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      didParseCell: rightAlignAmountColumns(2, 3),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 16; }

    // Section B
    subHeading('Section B — Loan Portfolio Summary');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Total Loans Disbursed', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanStats.disbursed)],
        ['Total Outstanding', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanStats.outstanding)],
        ['Total Overdue', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanStats.overdue)],
        ['Total Recovered', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loanStats.recovered)],
        ['Recovery %', pct(loanStats.recoveryPct)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 16; }

    // Section C
    subHeading('Section C — Member Credit Summary');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Count']],
      body: [
        ['Total Members', memberStats.total],
        ['Active Members', memberStats.active],
        ['Members with Loans', memberStats.withLoans],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 16; }

    // Section D
    subHeading('Section D — Working Capital Statement');
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Own Funds (Share Capital + Reserves)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(workingCapital.ownFunds)],
        ['Borrowed Funds (Deposits + Bank Borrowings)', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(workingCapital.borrowedFunds)],
        ['Total Working Capital', 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(workingCapital.total)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      didParseCell: rightAlignAmountColumns(1),
      didDrawPage: (data) => { y = data.cursor?.y ?? y; },
    });

    const sigY = (doc as any).lastAutoTable.finalY + 10;
    const sig = getSignatoryNames(society);
    addSignatureBlock(doc, font, ['Accountant', 'Secretary / Manager', 'President'], sigY, undefined,
      [sig.accountant, sig.secretary, sig.president]);

    addPageNumbers(doc, font, society?.name);
    doc.save(pdfFileName('NABARD_CreditReport', society));
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">
              {hi ? 'NABARD क्रेडिट रिपोर्ट' : 'NABARD Credit Report'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? 'NABARD/DCC बैंक अनुपालन रिपोर्ट — NPA वर्गीकरण' : 'NABARD/DCC Bank Compliance Report — NPA Classification'}
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

      {/* Society Info */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">{hi ? 'समिति' : 'Society'}:</span> <span className="font-medium">{society.name}</span></div>
            <div><span className="text-muted-foreground">{hi ? 'पंजीकरण सं.' : 'Reg. No.'}:</span> <span className="font-medium">{society.registrationNo || '—'}</span></div>
            <div><span className="text-muted-foreground">{hi ? 'वित्त वर्ष' : 'FY'}:</span> <span className="font-medium">{society.financialYear}</span></div>
            <div><span className="text-muted-foreground">{hi ? 'दिनांक' : 'Date'}:</span> <span className="font-medium">{new Date().toLocaleDateString('en-IN')}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Section A — KCC NPA Classification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? 'अनुभाग A — KCC/फसल ऋण NPA वर्गीकरण' : 'Section A — KCC / Crop Loan NPA Classification'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left">{hi ? 'वर्गीकरण' : 'Classification'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'खातों की संख्या' : 'No. of Accounts'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'बकाया राशि (₹)' : 'Outstanding Amount (₹)'}</th>
                  <th className="border px-3 py-2 text-right">{hi ? 'अतिदेय राशि (₹)' : 'Overdue Amount (₹)'}</th>
                </tr>
              </thead>
              <tbody>
                {npaData.map(row => (
                  <tr key={row.classification} className="hover:bg-muted/50">
                    <td className="border px-3 py-2">{row.classification}</td>
                    <td className="border px-3 py-2 text-right">{row.accounts}</td>
                    <td className="border px-3 py-2 text-right">{fmt(row.outstanding)}</td>
                    <td className="border px-3 py-2 text-right">{fmt(row.overdue)}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted">
                  <td className="border px-3 py-2">{hi ? 'कुल' : 'Total'}</td>
                  <td className="border px-3 py-2 text-right">{kccTotals.accounts}</td>
                  <td className="border px-3 py-2 text-right">{fmt(kccTotals.outstanding)}</td>
                  <td className="border px-3 py-2 text-right">{fmt(kccTotals.overdue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
            <span className="font-semibold">NPA Ratio: </span>
            <span className={npaRatio > 10 ? 'text-red-600 font-bold' : 'text-green-700 font-bold'}>
              {pct(npaRatio)}
            </span>
            <span className="text-muted-foreground ml-2">
              ({hi ? 'उप-मानक + संदिग्ध + हानि / कुल बकाया' : 'Sub-Standard + Doubtful + Loss / Total Outstanding'})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section B — Loan Portfolio Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? 'अनुभाग B — ऋण पोर्टफोलियो सारांश' : 'Section B — Loan Portfolio Summary'}
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
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'कुल वितरित ऋण' : 'Total Loans Disbursed'}</td><td className="border px-3 py-2 text-right">{fmt(loanStats.disbursed)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'कुल बकाया' : 'Total Outstanding'}</td><td className="border px-3 py-2 text-right">{fmt(loanStats.outstanding)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'कुल अतिदेय' : 'Total Overdue'}</td><td className="border px-3 py-2 text-right text-red-600">{fmt(loanStats.overdue)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'कुल वसूली' : 'Total Recovered'}</td><td className="border px-3 py-2 text-right">{fmt(loanStats.recovered)}</td></tr>
                <tr className="font-semibold bg-muted"><td className="border px-3 py-2">{hi ? 'वसूली प्रतिशत' : 'Recovery %'}</td><td className="border px-3 py-2 text-right text-green-700">{pct(loanStats.recoveryPct)}</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section C — Member Credit Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? 'अनुभाग C — सदस्य क्रेडिट सारांश' : 'Section C — Member Credit Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-700">{memberStats.total}</div>
              <div className="text-sm text-muted-foreground mt-1">{hi ? 'कुल सदस्य' : 'Total Members'}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-700">{memberStats.active}</div>
              <div className="text-sm text-muted-foreground mt-1">{hi ? 'सक्रिय सदस्य' : 'Active Members'}</div>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg border">
              <div className="text-2xl font-bold text-amber-700">{memberStats.withLoans}</div>
              <div className="text-sm text-muted-foreground mt-1">{hi ? 'ऋण वाले सदस्य' : 'Members with Loans'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section D — Working Capital */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {hi ? 'अनुभाग D — कार्यशील पूंजी विवरण' : 'Section D — Working Capital Statement'}
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
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'स्वयं के फंड (अंश पूंजी + संचय)' : 'Own Funds (Share Capital + Reserves)'}</td><td className="border px-3 py-2 text-right">{fmt(workingCapital.ownFunds)}</td></tr>
                <tr className="hover:bg-muted/50"><td className="border px-3 py-2">{hi ? 'उधार लिए गए फंड (जमा + बैंक उधार)' : 'Borrowed Funds (Deposits + Bank Borrowings)'}</td><td className="border px-3 py-2 text-right">{fmt(workingCapital.borrowedFunds)}</td></tr>
                <tr className="font-bold bg-muted"><td className="border px-3 py-2">{hi ? 'कुल कार्यशील पूंजी' : 'Total Working Capital'}</td><td className="border px-3 py-2 text-right">{fmt(workingCapital.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NabardReport;
