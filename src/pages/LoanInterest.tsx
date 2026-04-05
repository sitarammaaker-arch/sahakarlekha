/**
 * Member Loan Interest Calculation
 *
 * Calculates simple interest on active member loans and posts
 * accrual journal entries: Dr 3313 (Interest Receivable) / Cr 4408 (Interest Income)
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Percent, CheckCircle2, Info, Download, Calculator, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, pdfFileName, rightAlignAmountColumns } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';

// ── Account IDs ───────────────────────────────────────────────────────────────
const ACC_INTEREST_REC  = '3313'; // Member Loan Interest Receivable (asset)
const ACC_INTEREST_INC  = '4408'; // Interest on Member Loans (income)

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

// ── Simple interest helper ────────────────────────────────────────────────────
const calcInterest = (principal: number, ratePa: number, days: number): number =>
  Math.round(((principal * ratePa * days) / (365 * 100)) * 100) / 100;

// ── Period label ─────────────────────────────────────────────────────────────
const getPeriodLabel = (mode: 'monthly' | 'quarterly' | 'annual', fromDate: string, toDate: string, hi: boolean): string => {
  if (!fromDate || !toDate) return '';
  const from = fmtDate(fromDate);
  const to   = fmtDate(toDate);
  const labels: Record<string, { hi: string; en: string }> = {
    monthly:   { hi: 'मासिक ब्याज',   en: 'Monthly Interest'   },
    quarterly: { hi: 'त्रैमासिक ब्याज', en: 'Quarterly Interest' },
    annual:    { hi: 'वार्षिक ब्याज',  en: 'Annual Interest'    },
  };
  return `${labels[mode][hi ? 'hi' : 'en']} (${from} → ${to})`;
};

// ── Days between dates ────────────────────────────────────────────────────────
const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay));
};

// ── Build default from/to for a period mode ───────────────────────────────────
const buildDefaultDates = (mode: 'monthly' | 'quarterly' | 'annual'): { from: string; to: string } => {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth(); // 0-indexed

  if (mode === 'monthly') {
    const from = new Date(y, m, 1);
    const to   = new Date(y, m + 1, 0); // last day of month
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  }
  if (mode === 'quarterly') {
    const qStart = Math.floor(m / 3) * 3;
    const from = new Date(y, qStart, 1);
    const to   = new Date(y, qStart + 3, 0);
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  }
  // annual
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
};

// ────────────────────────────────────────────────────────────────────────────
const LoanInterest: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { loans, members, vouchers, society, addVoucher } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';
  const fy = society.financialYear;

  // ── Period controls ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [fromDate, setFromDate] = useState(() => buildDefaultDates('monthly').from);
  const [toDate,   setToDate]   = useState(() => buildDefaultDates('monthly').to);

  const handleModeChange = (m: 'monthly' | 'quarterly' | 'annual') => {
    setMode(m);
    const d = buildDefaultDates(m);
    setFromDate(d.from);
    setToDate(d.to);
  };

  const days = useMemo(() => daysBetween(fromDate, toDate), [fromDate, toDate]);

  // ── Active loans only ──────────────────────────────────────────────────────
  const activeLoans = useMemo(
    () => loans.filter(l => l.status === 'active'),
    [loans]
  );

  // ── Check if period already posted ────────────────────────────────────────
  const periodLabel = getPeriodLabel(mode, fromDate, toDate, hi);
  const alreadyPostedVouchers = useMemo(() =>
    vouchers.filter(v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === ACC_INTEREST_REC && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === ACC_INTEREST_INC && l.type === 'Cr') &&
      v.narration.includes(fromDate)
    ),
    [vouchers, fromDate]
  );
  const isPosted = alreadyPostedVouchers.length > 0;

  // ── Per-loan interest rows ─────────────────────────────────────────────────
  interface InterestRow {
    loanId: string;
    loanNo: string;
    memberName: string;
    memberId: string;
    principal: number;
    outstanding: number;
    ratePa: number;
    days: number;
    interest: number;
  }

  const rows: InterestRow[] = useMemo(() => {
    return activeLoans.map(loan => {
      const member   = members.find(m => m.id === loan.memberId);
      const outstanding = Math.max(0, loan.amount - (loan.repaidAmount || 0));
      const interest = calcInterest(outstanding, loan.interestRate, days);
      return {
        loanId: loan.id,
        loanNo: loan.loanNo,
        memberName: member?.name ?? '—',
        memberId: member?.memberId ?? '—',
        principal: loan.amount,
        outstanding,
        ratePa: loan.interestRate,
        days,
        interest,
      };
    });
  }, [activeLoans, members, days]);

  const totalInterest = useMemo(() => rows.reduce((s, r) => s + r.interest, 0), [rows]);

  // ── Confirm state ─────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePost = () => {
    if (totalInterest <= 0) return;

    // Post one consolidated journal for the total period interest
    addVoucher({
      type: 'journal',
      date: toDate,
      debitAccountId: ACC_INTEREST_REC,
      creditAccountId: ACC_INTEREST_INC,
      amount: totalInterest,
      narration: `Member Loan Interest Accrual ${fromDate} to ${toDate} (${rows.length} loans, ${days} days) — FY ${fy}`,
      createdBy: user?.name ?? 'System',
    });

    setConfirmOpen(false);
    toast({
      title: hi
        ? `ब्याज जर्नल पोस्ट हो गया — ${fmt(totalInterest)}`
        : `Interest journal posted — ${fmt(totalInterest)}`,
    });
  };

  // ── CSV / Excel ────────────────────────────────────────────────────────────
  const csvHeaders = ['Member', 'Loan Amount', 'Rate %', 'Period (days)', 'Interest'];
  const getCsvRows = () =>
    rows.map(r => [r.memberName, r.outstanding, r.ratePa, r.days, r.interest]);

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'loan-interest');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'loan-interest', 'Loan Interest');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const { startY, font } = addHeader(doc, 'Loan Interest Statement', society,
      `Period: ${fromDate} to ${toDate} (${days} days)`, { reportCode: 'LI' });

    autoTable(doc, {
      startY,
      head: [['#', 'Loan No.', 'Member ID', 'Member Name', 'Principal', 'Outstanding', 'Rate % p.a.', 'Days', 'Interest']],
      body: rows.map((r, i) => [
        i + 1,
        r.loanNo,
        r.memberId,
        r.memberName,
        fmt(r.principal),
        fmt(r.outstanding),
        `${r.ratePa}%`,
        r.days,
        fmt(r.interest),
      ]),
      foot: [['', '', '', 'Total', '', '', '', '', fmt(totalInterest)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 8: { halign: 'right' } },
      didParseCell: rightAlignAmountColumns(4, 5, 8),
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.text(`Formula: Interest = (Outstanding x Rate x Days) / (365 x 100)`, 14, finalY);

    addPageNumbers(doc, font, society.name);
    doc.save(pdfFileName('LoanInterest', society));
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Percent className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'सदस्य ऋण ब्याज गणना' : 'Member Loan Interest Calculation'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {fy}
            {' · '}{activeLoans.length} {hi ? 'सक्रिय ऋण' : 'active loans'}
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4" />
            {hi ? 'PDF' : 'Download PDF'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'सूत्र: ब्याज = (बकाया × दर × दिन) / (365 × 100) | Dr 3313 ब्याज प्राप्य / Cr 4408 ब्याज आय'
            : 'Formula: Interest = (Outstanding × Rate × Days) / (365 × 100) | Dr 3313 Interest Receivable / Cr 4408 Interest Income'}
        </span>
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            {hi ? 'अवधि चयन' : 'Period Selection'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'अवधि प्रकार' : 'Period Type'}</Label>
              <Select value={mode} onValueChange={v => handleModeChange(v as typeof mode)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{hi ? 'मासिक' : 'Monthly'}</SelectItem>
                  <SelectItem value="quarterly">{hi ? 'त्रैमासिक' : 'Quarterly'}</SelectItem>
                  <SelectItem value="annual">{hi ? 'वार्षिक' : 'Annual'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'तिथि से' : 'From Date'}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'तिथि तक' : 'To Date'}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="text-sm text-gray-600 pb-1">
              {hi ? 'कुल दिन:' : 'Total days:'} <strong>{days}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label={hi ? 'सक्रिय ऋण' : 'Active Loans'} value={String(activeLoans.length)} />
        <SummaryCard
          label={hi ? 'कुल मूलधन' : 'Total Principal'}
          value={fmt(activeLoans.reduce((s, l) => s + l.amount, 0))}
        />
        <SummaryCard
          label={hi ? 'कुल बकाया' : 'Total Outstanding'}
          value={fmt(activeLoans.reduce((s, l) => s + Math.max(0, l.amount - (l.repaidAmount || 0)), 0))}
        />
        <SummaryCard
          label={hi ? 'कुल ब्याज' : 'Total Interest'}
          value={fmt(totalInterest)}
          highlight
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between">
            <span>{hi ? 'सदस्यवार ब्याज विवरण' : 'Member-wise Interest Statement'}</span>
            {isPosted ? (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {hi ? 'पोस्ट हो चुका' : 'Posted'}
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={totalInterest <= 0 || days <= 0}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {hi ? 'ब्याज जर्नल पोस्ट करें' : 'Post Interest Journal'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">
              {hi ? 'कोई सक्रिय ऋण नहीं मिला।' : 'No active loans found.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{hi ? 'ऋण नं.' : 'Loan No.'}</TableHead>
                  <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                  <TableHead className="text-right">{hi ? 'मूलधन' : 'Principal'}</TableHead>
                  <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                  <TableHead className="text-right">{hi ? 'दर % प्रति वर्ष' : 'Rate % p.a.'}</TableHead>
                  <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                  <TableHead className="text-right">{hi ? 'ब्याज' : 'Interest'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.loanId}>
                    <TableCell className="text-gray-500 text-sm">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{r.loanNo}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{r.memberName}</span>
                      <span className="text-xs text-gray-400 ml-1">({r.memberId})</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.principal)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.outstanding)}</TableCell>
                    <TableCell className="text-right text-sm">{r.ratePa}%</TableCell>
                    <TableCell className="text-right text-sm">{r.days}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">{fmt(r.interest)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t">
                  <td colSpan={7} className="px-4 py-2 text-sm">{hi ? 'कुल' : 'Total'}</td>
                  <td className="px-4 py-2 text-right text-sm text-blue-700">{fmt(totalInterest)}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Posted vouchers */}
      {isPosted && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {hi ? 'पोस्ट जर्नल प्रविष्टियाँ (इस अवधि)' : 'Posted Journals (this period)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'विवरण' : 'Narration'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alreadyPostedVouchers.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                    <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                    <TableCell className="text-sm">{v.narration}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(v.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hi ? 'ब्याज जर्नल पोस्ट करें?' : 'Post Interest Journal?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{hi ? 'अवधि:' : 'Period:'} <strong>{periodLabel}</strong></p>
                <p>{hi ? 'ऋण संख्या:' : 'Loans:'} {rows.length} &nbsp;|&nbsp; {hi ? 'दिन:' : 'Days:'} {days}</p>
                <div className="bg-gray-50 rounded p-2 font-mono text-xs mt-2">
                  Dr 3313 Member Loan Interest Receivable &nbsp;{fmt(totalInterest)}<br />
                  &nbsp;&nbsp;Cr 4408 Interest on Member Loans &nbsp;{fmt(totalInterest)}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} className="bg-blue-700 hover:bg-blue-800">
              {hi ? 'पोस्ट करें' : 'Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Small summary card ────────────────────────────────────────────────────────
const SummaryCard: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <Card className={highlight ? 'border-blue-300 bg-blue-50' : ''}>
    <CardContent className="p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
    </CardContent>
  </Card>
);

export default LoanInterest;
