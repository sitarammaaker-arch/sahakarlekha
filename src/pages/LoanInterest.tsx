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
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName, rightAlignAmountColumns } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { interestPeriodDefaults, type InterestPeriodMode } from '@/lib/loans/interestPeriod';
import {
  accruableLoans, accrualRows, splitAccrual, accrualVoucherLines, accrualRecords,
  ACC_INTEREST_RECEIVABLE as ACC_INTEREST_REC, ACC_INTEREST_INCOME as ACC_INTEREST_INC, ACC_OVERDUE_INTEREST_RESERVE as ACC_OIR,
} from '@/lib/loans/interestAccrual';
import { useLoanAccruals } from '@/hooks/useLoanAccruals';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);


// ── Period label ─────────────────────────────────────────────────────────────
const getPeriodLabel = (mode: 'monthly' | 'quarterly' | 'annual', fromDate: string, toDate: string, hi: boolean): string => {
  if (!fromDate || !toDate) return '';
  const from = fmtDate(fromDate);
  const to   = fmtDate(toDate);
  const labels: Record<string, { hi: string; en: string }> = {
    monthly:   { hi: 'मासिक ब्याज',   en: 'Monthly Interest'   },
    quarterly: { hi: 'क्वार्टरली ब्याज', en: 'Quarterly Interest' },
    annual:    { hi: 'वार्षिक ब्याज',  en: 'Annual Interest'    },
  };
  return `${labels[mode][hi ? 'hi' : 'en']} (${from} → ${to})`;
};

// ── Days between dates ────────────────────────────────────────────────────────
const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay));
};

// ── Default from/to for a period mode (local dates, Indian FY) — see interestPeriodDefaults ──
const buildDefaultDates = (mode: InterestPeriodMode) => interestPeriodDefaults(mode);

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

  // ── Interest-bearing loans (active AND overdue) ────────────────────────────
  // Haryana Act s.87 Explanation (i): overdue interest IS accrued but held in the Overdue Interest
  // Reserve (2211), not income. Overdue = marked overdue, or due date before the period end with
  // something outstanding (founder decision D1).
  const activeLoans = useMemo(() => accruableLoans(loans), [loans]);
  const { saveAccruals } = useLoanAccruals();

  // ── Check if period already posted ────────────────────────────────────────
  const periodLabel = getPeriodLabel(mode, fromDate, toDate, hi);
  const alreadyPostedVouchers = useMemo(() =>
    vouchers.filter(v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === ACC_INTEREST_REC && l.type === 'Dr') &&
      getVoucherLines(v).some(l => (l.accountId === ACC_INTEREST_INC || l.accountId === ACC_OIR) && l.type === 'Cr') &&
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
    overdue: boolean;
  }

  // Shared accrual rows (one formula — the shared loanOutstanding, clamped at 0 for interest only).
  const accrual = useMemo(() => accrualRows(activeLoans, toDate, days), [activeLoans, toDate, days]);
  const rows: InterestRow[] = useMemo(() => accrual.map(r => {
    const member = members.find(m => m.id === r.memberId);
    return {
      loanId: r.loanId, loanNo: r.loanNo, memberName: member?.name ?? '—', memberId: member?.memberId ?? '—',
      principal: r.principal, outstanding: r.outstanding, ratePa: r.ratePa, days: r.days, interest: r.interest, overdue: r.overdue,
    };
  }), [accrual, members]);

  const split = useMemo(() => splitAccrual(accrual), [accrual]);
  const totalInterest = split.total;

  // ── Confirm state ─────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePost = async () => {
    if (totalInterest <= 0) return;
    if (society.fyLocked) {
      setConfirmOpen(false);
      toast({ title: hi ? 'FY लॉक है' : 'FY Locked', description: hi ? 'वित्त वर्ष ऑडिट-लॉक है — ब्याज जर्नल पोस्ट नहीं हो सकता।' : 'Cannot post while the Financial Year is audit-locked.', variant: 'destructive' });
      return;
    }

    setConfirmOpen(false);
    // RULE 1: each loan's accrual is saved to the cloud FIRST; no per-loan record ⇒ no journal (a
    // repayment must later be able to clear exactly what was accrued for that loan).
    const newId = () => crypto.randomUUID();
    const records = accrualRecords(accrual, fromDate, toDate, user?.name ?? 'System', newId);
    const saved = await saveAccruals(records);
    if (!saved.ok) {
      const missing = /loan_interest_accruals|does not exist|schema cache|PGRST205|42P01/i.test(saved.error || '');
      toast({
        title: hi ? 'ब्याज जर्नल पोस्ट नहीं हुआ' : 'Interest journal NOT posted',
        description: missing
          ? (hi ? 'पहले Supabase में migration 069 (loan_interest_accruals) चलाएँ।' : 'Run migration 069 (loan_interest_accruals) in Supabase first.')
          : `${hi ? 'प्रति-ऋण ब्याज cloud में सेव नहीं हुआ' : 'Per-loan accrual did not save to the cloud'} — ${saved.error}`,
        variant: 'destructive',
        duration: 12000,
      });
      return;
    }

    // One balanced journal: Dr 3313 total / Cr 4408 regular / Cr 2211 Overdue Interest Reserve.
    const lines = accrualVoucherLines(split, newId);
    const v = addVoucher({
      type: 'journal',
      date: toDate,
      debitAccountId: ACC_INTEREST_REC,
      creditAccountId: split.regular > 0 ? ACC_INTEREST_INC : ACC_OIR,
      amount: totalInterest,
      lines,
      narration: `Member Loan Interest Accrual ${fromDate} to ${toDate} (${rows.length} loans, ${days} days${split.overdue > 0 ? `; overdue ₹${split.overdue} to Overdue Interest Reserve` : ''}) — FY ${fy}`,
      createdBy: user?.name ?? 'System',
    } as Parameters<typeof addVoucher>[0]);

    // addVoucher refuses (permission / FY lock / expired plan) by returning an empty voucher — never
    // claim success for a journal that was not created.
    if (!v?.id) {
      // The per-loan rows have no journal — retire them so they can never be counted.
      void saveAccruals(records.map(r => ({ ...r, isDeleted: true })));
      toast({
        title: hi ? 'ब्याज जर्नल पोस्ट नहीं हुआ' : 'Interest journal NOT posted',
        description: hi ? 'वाउचर नहीं बना — ऊपर वाला संदेश देखें (अनुमति / FY लॉक / प्लान)।' : 'No voucher was created — see the message above (permission / FY lock / plan).',
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }
    // Link each row to its journal (best-effort: the rows already exist; H2-2 honours linked rows).
    const linked = await saveAccruals(records.map(r => ({ ...r, voucherId: v.id })));
    if (!linked.ok) {
      toast({ title: hi ? 'चेतावनी' : 'Warning', description: hi ? 'जर्नल पोस्ट हो गया, पर प्रति-ऋण रिकॉर्ड उससे जुड़ नहीं पाया — पेज refresh करके देखें।' : 'Journal posted, but the per-loan rows could not be linked to it — refresh and check.', duration: 10000 });
    }
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

    const sigY2 = finalY + 10;
    const sig = getSignatoryNames(society);
    addSignatureBlock(doc, font, ['Accountant', 'Secretary / Manager', 'President'], sigY2, undefined,
      [sig.accountant, sig.secretary, sig.president]);

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
          <br />
          {hi
            ? 'अतिदेय (overdue) ऋणों का ब्याज भी गिना जाता है, पर वह आय में नहीं, "अतिदेय ब्याज संचय" (2211) में जाता है — वसूली होने पर ही आय बनेगा। (हरियाणा सहकारी समिति अधिनियम 1984, धारा 87 व्याख्या) अतिदेय = जिसे overdue चुना गया हो, या जिसकी देय तिथि अवधि समाप्ति से पहले निकल गई हो।'
            : 'Interest on overdue loans is accrued too, but credited to the "Overdue Interest Reserve" (2211), not income — it becomes income only when recovered. (Haryana Co-operative Societies Act 1984, s.87 Explanation) Overdue = marked overdue, or due date before the period end.'}
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
                  <SelectItem value="quarterly">{hi ? 'क्वार्टरली' : 'Quarterly'}</SelectItem>
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
        <SummaryCard label={hi ? 'ब्याज योग्य ऋण' : 'Interest-bearing Loans'} value={`${activeLoans.length}${split.overdue > 0 ? ` (${rows.filter(r => r.overdue).length} ${hi ? 'अतिदेय' : 'overdue'})` : ''}`} />
        <SummaryCard
          label={hi ? 'कुल मूलधन' : 'Total Principal'}
          value={fmt(activeLoans.reduce((s, l) => s + l.amount, 0))}
        />
        <SummaryCard
          label={hi ? 'ब्याज योग्य बकाया' : 'Interest-bearing Outstanding'}
          value={fmt(rows.reduce((s, r) => s + r.outstanding, 0))}
        />
        <SummaryCard
          label={hi ? 'कुल ब्याज' : 'Total Interest'}
          value={split.overdue > 0 ? `${fmt(totalInterest)} (${hi ? 'आय' : 'income'} ${fmt(split.regular)} · ${hi ? 'संचय' : 'reserve'} ${fmt(split.overdue)})` : fmt(totalInterest)}
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
              {hi ? 'कोई ब्याज योग्य ऋण नहीं मिला।' : 'No interest-bearing loans found.'}
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
                  <TableHead>{hi ? 'जाएगा' : 'Goes to'}</TableHead>
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
                    <TableCell>
                      {r.overdue
                        ? <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">{hi ? 'अतिदेय → संचय 2211' : 'Overdue → Reserve 2211'}</Badge>
                        : <Badge variant="outline" className="text-[10px]">{hi ? 'आय 4408' : 'Income 4408'}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t">
                  <td colSpan={7} className="px-4 py-2 text-sm">{hi ? 'कुल' : 'Total'}</td>
                  <td className="px-4 py-2 text-right text-sm text-blue-700">{fmt(totalInterest)}</td>
                  <td />
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
              {hi ? 'पोस्ट जर्नल एंट्रियाँ (इस अवधि)' : 'Posted Journals (this period)'}
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
                  {split.regular > 0 && <>&nbsp;&nbsp;Cr 4408 Interest on Member Loans &nbsp;{fmt(split.regular)}<br /></>}
                  {split.overdue > 0 && <>&nbsp;&nbsp;Cr 2211 Overdue Interest Reserve &nbsp;{fmt(split.overdue)}</>}
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
