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
import { Coins, CheckCircle2, AlertTriangle, Info, Download, Users, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';

// ── Account IDs ─────────────────────────────────────────────────────────────
const ACC_NET_SURPLUS   = '1208';
const ACC_RESERVE_FUND  = '1201';
const ACC_EDUCATION     = '1203';
const ACC_DIVIDEND      = '1211'; // Dividend Distribution (equity liability to members)
const ACC_BONUS_EXP     = '5207'; // Employee Bonus (expense)

// ── Statutory rates ──────────────────────────────────────────────────────────
const EDUCATION_RATE = 0.01;

const fmt = (n: number) =>
  '\u20B9 ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ── Check if a distribution journal exists ───────────────────────────────────
const usePosted = (
  vouchers: ReturnType<typeof useData>['vouchers'],
  debitId: string,
  creditId: string,
  fy: string
) =>
  vouchers.find(
    v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === debitId && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === creditId && l.type === 'Cr') &&
      v.narration.includes(fy)
  );

// ────────────────────────────────────────────────────────────────────────────
const ProfitDistribution: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { vouchers, accounts, members, society, getProfitLoss, addVoucher } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';
  const fy = society.financialYear;

  // ── Net Surplus ────────────────────────────────────────────────────────────
  const { netProfit } = useMemo(() => getProfitLoss(), [getProfitLoss]);

  const RESERVE_RATE = (society.reserveFundPct ?? 25) / 100;
  const reserveAmt   = Math.round(netProfit * RESERVE_RATE * 100) / 100;
  const educationAmt = Math.round(netProfit * EDUCATION_RATE * 100) / 100;
  const distributable = netProfit - reserveAmt - educationAmt;

  // ── User inputs ────────────────────────────────────────────────────────────
  const [dividendRate, setDividendRate] = useState('');   // % of share capital
  const [bonusAmt, setBonusAmt]         = useState('');   // flat amount
  const [confirmOpen, setConfirmOpen]   = useState(false);

  const dividendRatePct = parseFloat(dividendRate) || 0;
  const bonusAmount     = parseFloat(bonusAmt) || 0;

  // ── Total share capital of active members ─────────────────────────────────
  const activeMembers = useMemo(
    () => members.filter(m => m.status === 'active'),
    [members]
  );
  const totalShareCapital = useMemo(
    () => activeMembers.reduce((s, m) => s + (m.shareCapital || 0), 0),
    [activeMembers]
  );

  // ── Per-member dividend ────────────────────────────────────────────────────
  const memberDividends = useMemo(() =>
    activeMembers.map(m => ({
      ...m,
      dividend: Math.round((m.shareCapital || 0) * dividendRatePct / 100 * 100) / 100,
    })),
    [activeMembers, dividendRatePct]
  );
  const totalDividend = memberDividends.reduce((s, m) => s + m.dividend, 0);

  // ── Remaining surplus ─────────────────────────────────────────────────────
  const remaining = Math.round((distributable - totalDividend - bonusAmount) * 100) / 100;

  // ── Posted check ──────────────────────────────────────────────────────────
  const existingDivVoucher   = usePosted(vouchers, ACC_NET_SURPLUS, ACC_DIVIDEND, fy);
  const existingBonusVoucher = usePosted(vouchers, ACC_NET_SURPLUS, ACC_BONUS_EXP, fy);
  const divPosted   = !!existingDivVoucher;
  const bonusPosted = !!existingBonusVoucher;

  // ── Account balance helper ─────────────────────────────────────────────────
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

  // ── P3-1: Check if 25% Reserve Fund has been posted (Sec 65 compliance) ────
  const reserveVoucher = usePosted(vouchers, ACC_NET_SURPLUS, ACC_RESERVE_FUND, fy);
  const reservePosted = !!reserveVoucher;
  const educationVoucher = usePosted(vouchers, ACC_NET_SURPLUS, ACC_EDUCATION, fy);
  const educationPosted = !!educationVoucher;
  const mandatoryAppropriationsDone = netProfit <= 0 || (reservePosted && educationPosted);

  // ── Post journals ──────────────────────────────────────────────────────────
  const canPost = mandatoryAppropriationsDone && (!divPosted && totalDividend > 0 || !bonusPosted && bonusAmount > 0);

  const handlePost = () => {
    // P3-1: Hard block — mandatory appropriations must be done first
    if (netProfit > 0 && !mandatoryAppropriationsDone) {
      toast({
        title: hi ? 'अनिवार्य आवंटन पहले करें' : 'Mandatory Appropriations Required First',
        description: hi
          ? `सहकारी समिति अधिनियम धारा 65 के तहत, लाभांश वितरण से पहले 25% वैधानिक संचय निधि (₹${reserveAmt.toLocaleString('hi-IN')}) और 1% शिक्षा निधि का आवंटन अनिवार्य है। पहले "संचय निधि" पृष्ठ पर जाएं।`
          : `Under Sec. 65 of the Cooperative Societies Act, you must first transfer 25% Statutory Reserve Fund (₹${reserveAmt.toLocaleString('en-IN')}) and 1% Education Fund before distributing profits. Please visit the Reserve Fund page first.`,
        variant: 'destructive',
      });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    let posted = 0;

    if (!divPosted && totalDividend > 0) {
      addVoucher({
        type: 'journal',
        date: today,
        debitAccountId: ACC_NET_SURPLUS,
        creditAccountId: ACC_DIVIDEND,
        amount: totalDividend,
        narration: `Dividend Appropriation @ ${dividendRatePct}% of Share Capital — FY ${fy}`,
        createdBy: user?.name ?? 'System',
      });
      posted++;
    }

    if (!bonusPosted && bonusAmount > 0) {
      addVoucher({
        type: 'journal',
        date: today,
        debitAccountId: ACC_NET_SURPLUS,
        creditAccountId: ACC_BONUS_EXP,
        amount: bonusAmount,
        narration: `Employee Bonus Appropriation — FY ${fy}`,
        createdBy: user?.name ?? 'System',
      });
      posted++;
    }

    setConfirmOpen(false);
    toast({
      title: hi
        ? `${posted} जर्नल प्रविष्टियाँ पोस्ट की गईं`
        : `${posted} journal entries posted`,
    });
  };

  // ── CSV / Excel ────────────────────────────────────────────────────────────
  const csvHeaders = ['Member', 'Share Capital', 'Distribution %', 'Amount'];
  const getCsvRows = () =>
    memberDividends.map(m => [m.name, m.shareCapital || 0, dividendRatePct, m.dividend]);

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'profit-distribution');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'profit-distribution', 'Profit Distribution');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginL = 14;
    let y = 14;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit Distribution Statement', marginL, y); y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${society.name}  |  FY ${fy}`, marginL, y); y += 10;

    // Part A — Appropriation Summary
    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Amount (₹)']],
      body: [
        ['Net Surplus (from P&L)', fmt(netProfit)],
        [`Less: Statutory Reserve Fund @ 25%`, `(${fmt(reserveAmt)})`],
        [`Less: Education Fund @ 1%`, `(${fmt(educationAmt)})`],
        ['Distributable Surplus', fmt(distributable)],
        [`Less: Dividend @ ${dividendRatePct}% of Share Capital`, `(${fmt(totalDividend)})`],
        [`Less: Employee Bonus`, `(${fmt(bonusAmount)})`],
        ['Balance Carried Forward', fmt(remaining)],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === 3 || data.row.index === 6) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Part B — Member-wise Dividend
    if (totalDividend > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Member-wise Dividend', marginL, y); y += 5;

      autoTable(doc, {
        startY: y,
        head: [['#', 'Member ID', 'Member Name', 'Share Capital', `Dividend @ ${dividendRatePct}%`]],
        body: memberDividends.map((m, i) => [
          i + 1,
          m.memberId,
          m.name,
          fmt(m.shareCapital || 0),
          fmt(m.dividend),
        ]),
        foot: [['', '', 'Total', fmt(totalShareCapital), fmt(totalDividend)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
    }

    doc.save(`ProfitDistribution_FY_${fy}.pdf`);
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-yellow-100 rounded-lg">
          <Coins className="h-6 w-6 text-yellow-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'लाभ वितरण विवरण' : 'Profit Distribution Statement'}
          </h1>
          <p className="text-sm text-gray-500">{society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {fy}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4" />
            {hi ? 'PDF डाउनलोड' : 'Download PDF'}
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

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'अनिवार्य आवंटन (25% संचय + 1% शिक्षा) के बाद शेष अधिशेष को लाभांश और बोनस के रूप में वितरित करें।'
            : 'After mandatory appropriations (25% reserve + 1% education), distribute the remaining surplus as dividend and bonus.'}
        </span>
      </div>

      {/* Net surplus warning */}
      {netProfit <= 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {hi ? 'शुद्ध अधिशेष शून्य या ऋणात्मक है — वितरण संभव नहीं।' : 'Net surplus is zero or negative — distribution not applicable.'}
        </div>
      )}

      {/* P3-1: Mandatory appropriation gate — block if reserve not posted */}
      {netProfit > 0 && !mandatoryAppropriationsDone && (
        <div className="flex items-start gap-3 p-4 bg-destructive/5 border-2 border-destructive rounded-lg text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-destructive">
              {hi ? 'अनिवार्य आवंटन लंबित (धारा 65)' : 'Mandatory Appropriation Pending (Sec. 65)'}
            </p>
            <p className="text-destructive/80 mt-0.5">
              {hi
                ? `लाभांश वितरण से पहले निम्नलिखित अनिवार्य है: ${!reservePosted ? `25% वैधानिक संचय निधि (₹${reserveAmt.toLocaleString('hi-IN')})` : ''}${!reservePosted && !educationPosted ? ' तथा ' : ''}${!educationPosted ? `1% शिक्षा निधि` : ''}। कृपया पहले "संचय निधि" पृष्ठ पर जाएं।`
                : `Before distributing profits, you must first post: ${!reservePosted ? `25% Statutory Reserve Fund (₹${reserveAmt.toLocaleString('en-IN')})` : ''}${!reservePosted && !educationPosted ? ' and ' : ''}${!educationPosted ? '1% Education Fund' : ''}. Please visit the Reserve Fund page first.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Appropriation summary ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {hi ? 'अधिशेष आवंटन विवरण' : 'Surplus Appropriation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row
              label={hi ? 'शुद्ध अधिशेष (P&L)' : 'Net Surplus (P&L)'}
              value={fmt(netProfit)}
              valueClass={netProfit >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}
            />
            <div className="border-t pt-2 space-y-1">
              <Row label={hi ? 'घटाएं: वैधानिक संचय (25%)' : 'Less: Statutory Reserve (25%)'}
                   value={`(${fmt(reserveAmt)})`} valueClass="text-orange-600" />
              <Row label={hi ? 'घटाएं: शिक्षा निधि (1%)' : 'Less: Education Fund (1%)'}
                   value={`(${fmt(educationAmt)})`} valueClass="text-orange-600" />
            </div>
            <div className="border-t pt-2 border-b pb-2">
              <Row label={hi ? 'वितरण योग्य अधिशेष' : 'Distributable Surplus'}
                   value={fmt(distributable)}
                   valueClass={distributable >= 0 ? 'text-blue-700 font-bold text-base' : 'text-red-600 font-bold text-base'} />
            </div>
            <div className="border-b pb-2 space-y-1">
              <Row label={hi ? `घटाएं: लाभांश (${dividendRatePct}%)` : `Less: Dividend (${dividendRatePct}%)`}
                   value={`(${fmt(totalDividend)})`} valueClass="text-orange-600" />
              <Row label={hi ? 'घटाएं: कर्मचारी बोनस' : 'Less: Employee Bonus'}
                   value={`(${fmt(bonusAmount)})`} valueClass="text-orange-600" />
            </div>
            <div className="pt-1">
              <Row label={hi ? 'शेषांश (अग्रेषित)' : 'Balance Carried Forward'}
                   value={fmt(remaining)}
                   valueClass={remaining >= 0 ? 'text-green-700 font-bold text-base' : 'text-red-600 font-bold text-base'} />
            </div>
          </CardContent>
        </Card>

        {/* ── Input panel ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {hi ? 'वितरण निर्धारण' : 'Distribution Settings'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dividend rate */}
            <div className="space-y-1">
              <Label className="text-sm">
                {hi ? 'लाभांश दर (% अंश पूंजी पर)' : 'Dividend Rate (% on Share Capital)'}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0" max="100" step="0.5"
                  value={dividendRate}
                  onChange={e => setDividendRate(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-28"
                  disabled={divPosted}
                />
                <span className="text-sm text-gray-500">%</span>
                <span className="text-sm text-gray-600 ml-auto">
                  {hi ? 'कुल' : 'Total'}: <strong>{fmt(totalDividend)}</strong>
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {hi
                  ? `कुल अंश पूंजी: ${fmt(totalShareCapital)} | ${activeMembers.length} सक्रिय सदस्य`
                  : `Total share capital: ${fmt(totalShareCapital)} | ${activeMembers.length} active members`}
              </p>
            </div>

            {/* Bonus */}
            <div className="space-y-1">
              <Label className="text-sm">
                {hi ? 'कर्मचारी बोनस (राशि ₹)' : 'Employee Bonus (Amount ₹)'}
              </Label>
              <Input
                type="number"
                min="0" step="100"
                value={bonusAmt}
                onChange={e => setBonusAmt(e.target.value)}
                placeholder="e.g. 25000"
                className="w-40"
                disabled={bonusPosted}
              />
            </div>

            {/* Fund balances */}
            <div className="text-xs text-gray-500 space-y-0.5 border-t pt-3">
              <p>{hi ? 'लाभांश खाता शेष' : 'Dividend Account (1211)'}:{' '}
                <span className="font-medium text-gray-700">{fmt(getBalance(ACC_DIVIDEND))}</span>
              </p>
            </div>

            {/* Post button */}
            <div className="pt-2">
              {distributable <= 0 ? (
                <p className="text-xs text-amber-600">
                  {hi ? 'वितरण योग्य अधिशेष नहीं है।' : 'No distributable surplus available.'}
                </p>
              ) : canPost ? (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  className="w-full bg-yellow-700 hover:bg-yellow-800"
                  disabled={totalDividend === 0 && bonusAmount === 0}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  {hi ? 'वितरण जर्नल पोस्ट करें' : 'Post Distribution Journals'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {hi ? 'इस वर्ष के लिए पोस्ट हो चुका है' : 'Already posted for this FY'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Member-wise dividend table ── */}
      {dividendRatePct > 0 && activeMembers.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              {hi ? 'सदस्यवार लाभांश विवरण' : 'Member-wise Dividend'}
              {divPosted && (
                <Badge className="ml-2 bg-green-100 text-green-800 border-green-300 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {hi ? 'पोस्ट हो चुका' : 'Posted'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{hi ? 'सदस्य आईडी' : 'Member ID'}</TableHead>
                  <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                  <TableHead className="text-right">{hi ? 'अंश पूंजी' : 'Share Capital'}</TableHead>
                  <TableHead className="text-right">{hi ? `लाभांश @ ${dividendRatePct}%` : `Dividend @ ${dividendRatePct}%`}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberDividends.map((m, i) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-gray-500 text-sm">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{m.memberId}</TableCell>
                    <TableCell className="text-sm">{m.name}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(m.shareCapital || 0)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">{fmt(m.dividend)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t">
                  <td colSpan={3} className="px-4 py-2 text-sm">{hi ? 'कुल' : 'Total'}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(totalShareCapital)}</td>
                  <td className="px-4 py-2 text-right text-sm text-green-700">{fmt(totalDividend)}</td>
                </tr>
              </tfoot>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Posted vouchers ── */}
      {(divPosted || bonusPosted) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {hi ? 'पोस्ट जर्नल प्रविष्टियाँ' : 'Posted Journals'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[existingDivVoucher, existingBonusVoucher].filter(Boolean).map(v => v && (
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

      {/* ── Confirm dialog ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hi ? 'वितरण जर्नल पोस्ट करें?' : 'Post Distribution Journals?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{hi ? 'निम्नलिखित जर्नल प्रविष्टियाँ बनाई जाएंगी:' : 'The following journal entries will be created:'}</p>
                {!divPosted && totalDividend > 0 && (
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                    Dr 1208 Net Surplus &nbsp;{fmt(totalDividend)}<br />
                    &nbsp;&nbsp;Cr 1211 Dividend Distribution &nbsp;{fmt(totalDividend)}<br />
                    <span className="text-gray-500">@ {dividendRatePct}% of Share Capital</span>
                  </div>
                )}
                {!bonusPosted && bonusAmount > 0 && (
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                    Dr 1208 Net Surplus &nbsp;{fmt(bonusAmount)}<br />
                    &nbsp;&nbsp;Cr 5207 Employee Bonus &nbsp;{fmt(bonusAmount)}<br />
                    <span className="text-gray-500">Employee Bonus FY {fy}</span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} className="bg-yellow-700 hover:bg-yellow-800">
              {hi ? 'पोस्ट करें' : 'Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Helper ────────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = '' }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-600">{label}</span>
    <span className={valueClass || 'font-medium'}>{value}</span>
  </div>
);

export default ProfitDistribution;
