/**
 * Audit Certificate Performa
 *
 * Printable statutory audit certificate for cooperative societies.
 * Pre-fills figures from the accounting data (income, expenditure, balances).
 * Editable fields for auditor's observations and signatures.
 * PDF + browser print.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileCheck, Download, Info, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { addHeader, addPageNumbers, pdfFileName } from '@/lib/pdf';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const AuditCertificate: React.FC = () => {
  const { language } = useLanguage();
  const { society, accounts, vouchers, members, getProfitLoss } = useData();

  const hi = language === 'hi';
  const fy = society.financialYear;

  // ── Auto-computed figures ─────────────────────────────────────────────────
  const { totalIncome, totalExpense, netProfit } = useMemo(() => getProfitLoss(), [getProfitLoss]);

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

  const cashBalance  = getBalance('3301'); // Cash in Hand
  const bankBalance  = getBalance('3302'); // Bank Account
  const shareCapital = accounts
    .filter(a => !a.isGroup && a.type === 'equity')
    .reduce((s, a) => {
      const b = getBalance(a.id);
      return s + (b > 0 ? b : 0);
    }, 0);

  const totalMembersCount = members.filter(m => m.status === 'active').length;

  // ── Editable fields ────────────────────────────────────────────────────────
  const [auditDate, setAuditDate]         = useState(new Date().toISOString().split('T')[0]);
  const [auditFrom, setAuditFrom]         = useState('');
  const [auditTo,   setAuditTo]           = useState('');
  const [auditorName,  setAuditorName]    = useState('');
  const [auditorRegNo, setAuditorRegNo]   = useState('');
  const [auditorAddress, setAuditorAddress] = useState('');
  const [observations, setObservations]   = useState('');
  const [classif, setClassif]             = useState('A'); // Audit classification

  // Cash book balance (manual override if needed)
  const [cashBookBal, setCashBookBal]     = useState(String(Math.max(0, Math.round(cashBalance * 100) / 100)));
  const [bankBookBal, setBankBookBal]     = useState(String(Math.max(0, Math.round(bankBalance * 100) / 100)));

  // ── CSV / Excel ────────────────────────────────────────────────────────────
  const csvHeaders = ['Particulars', 'Value'];
  const getCsvRows = () => [
    ['Society Name', society.name],
    ['Registration No.', society.registrationNo || '—'],
    ['Financial Year', fy],
    ['Audit From', auditFrom || '—'],
    ['Audit To', auditTo || '—'],
    ['Total Income', totalIncome],
    ['Total Expenditure', totalExpense],
    [netProfit >= 0 ? 'Net Surplus' : 'Net Deficit', Math.abs(netProfit)],
    ['Cash Balance', parseFloat(cashBookBal) || 0],
    ['Bank Balance', parseFloat(bankBookBal) || 0],
    ['Share Capital', shareCapital],
    ['Active Members', totalMembersCount],
    ['Audit Classification', `Class ${classif}`],
    ['Auditor Name', auditorName || '—'],
    ['Auditor Reg. No.', auditorRegNo || '—'],
  ];

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'audit-certificate');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'audit-certificate', 'Audit Certificate');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginL = 20;
    const pageW = doc.internal.pageSize.getWidth();

    const { startY, font } = addHeader(doc, 'Audit Report / Audit Certificate', society, '[Under the Cooperative Societies Act]', { reportCode: 'AC' });
    let y = startY;

    const line = (text: string, indent = 0, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      const split = doc.splitTextToSize(text, pageW - marginL - indent - 16);
      doc.text(split, marginL + indent, y);
      y += split.length * 5 + 1;
    };
    const hline = () => { doc.setLineWidth(0.3); doc.line(marginL, y, pageW - marginL, y); y += 3; };
    const space = (n = 4) => { y += n; };

    // Society details
    line(`Society Name:       ${society.name}`, 0, true);
    line(`Registration No.:   ${society.registrationNo || '—'}`);
    line(`Address:            ${society.address || '—'}`);
    line(`District:           ${society.district || '—'}, State: ${society.state || '—'}`);
    line(`Financial Year:     ${fy}  (${auditFrom || '—'} to ${auditTo || '—'})`);
    line(`Audit Date:         ${fmtDate(auditDate)}`);
    space();

    hline();
    line('FINANCIAL SUMMARY', 0, true);
    hline();

    const row = (label: string, val: string) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(label, marginL, y);
      doc.text(val, pageW - marginL, y, { align: 'right' });
      y += 5.5;
    };

    row('Total Income (Receipts)', `₹ ${fmt(totalIncome)}`);
    row('Total Expenditure (Payments)', `₹ ${fmt(totalExpense)}`);
    doc.setFont('helvetica', 'bold');
    row(netProfit >= 0 ? 'Net Surplus' : 'Net Deficit', `₹ ${fmt(Math.abs(netProfit))}`);
    doc.setFont('helvetica', 'normal');
    row('Cash in Hand (as per Cash Book)', `₹ ${fmt(parseFloat(cashBookBal) || 0)}`);
    row('Balance at Bank', `₹ ${fmt(parseFloat(bankBookBal) || 0)}`);
    row('Share Capital (Paid-up)', `₹ ${fmt(shareCapital)}`);
    row('Total Active Members', String(totalMembersCount));
    space();

    hline();
    line('AUDIT CLASSIFICATION', 0, true);
    line(`This Society is classified as: Class "${classif}"`, 4);
    space();

    hline();
    line('AUDITOR\'S OBSERVATIONS / REMARKS', 0, true);
    if (observations.trim()) {
      const splitObs = doc.splitTextToSize(observations, pageW - marginL * 2);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(splitObs, marginL, y);
      y += splitObs.length * 5 + 2;
    } else {
      line('No adverse observations. Accounts are maintained properly.', 4);
    }
    space();

    hline();
    line('CERTIFICATE', 0, true);
    const certText = `I/We have examined the accounts of ${society.name} for the year ending ` +
      `${auditTo || fy}. In my/our opinion and to the best of my/our knowledge and ` +
      `belief, the accounts give a true and fair view of the state of affairs of the Society ` +
      `and are in agreement with the books and records of the Society.`;
    line(certText, 4);
    space(10);

    // Signature block
    doc.setFontSize(9);
    const sigY = y;
    doc.text('_______________________', marginL, sigY);
    doc.text('_______________________', pageW - marginL - 50, sigY);
    y += 5;
    doc.text(`Auditor's Signature`, marginL, y);
    doc.text('President / Secretary', pageW - marginL - 50, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(auditorName || 'Name: ____________________', marginL, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    if (auditorRegNo) doc.text(`Reg. No.: ${auditorRegNo}`, marginL, y);
    y += 5;
    if (auditorAddress) { const s = doc.splitTextToSize(`Address: ${auditorAddress}`, 80); doc.text(s, marginL, y); y += s.length * 5; }
    doc.text(`Date: ${fmtDate(auditDate)}`, marginL, y);
    doc.text(`Place: ${society.district || '—'}`, marginL + 50, y);

    addPageNumbers(doc, font, society?.name);
    doc.save(pdfFileName('AuditCertificate', society));
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 print:p-0">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <div className="p-2 bg-teal-100 rounded-lg">
          <FileCheck className="h-6 w-6 text-teal-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'ऑडिट प्रमाणपत्र (Performa)' : 'Audit Certificate Performa'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {fy}
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button size="sm" className="gap-2 bg-teal-700 hover:bg-teal-800" onClick={handleDownloadPDF}>
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
      <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800 print:hidden">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'वित्तीय आंकड़े स्वतः भरे जाते हैं। ऑडिटर की जानकारी और टिप्पणी भरें, फिर PDF डाउनलोड करें।'
            : 'Financial figures are auto-filled from accounts. Fill auditor details and observations, then download PDF.'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left: auditor details ── */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="font-semibold text-sm text-gray-700">{hi ? 'ऑडिटर विवरण' : 'Auditor Details'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'ऑडिट प्रारंभ तिथि' : 'Audit From Date'}</Label>
                <Input type="date" value={auditFrom} onChange={e => setAuditFrom(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'ऑडिट समाप्ति तिथि' : 'Audit To Date'}</Label>
                <Input type="date" value={auditTo} onChange={e => setAuditTo(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'ऑडिटर का नाम' : 'Auditor Name'}</Label>
              <Input value={auditorName} onChange={e => setAuditorName(e.target.value)} className="h-8 text-sm" placeholder={hi ? 'पूरा नाम' : 'Full name'} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'पंजीकरण / लाइसेंस नं.' : 'Registration / License No.'}</Label>
              <Input value={auditorRegNo} onChange={e => setAuditorRegNo(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'पता' : 'Address'}</Label>
              <Textarea value={auditorAddress} onChange={e => setAuditorAddress(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'ऑडिट तिथि' : 'Date of Audit Certificate'}</Label>
              <Input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'ऑडिट श्रेणी (A/B/C/D)' : 'Audit Classification (A/B/C/D)'}</Label>
              <select
                value={classif}
                onChange={e => setClassif(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-3 text-sm w-20"
              >
                {['A', 'B', 'C', 'D'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── Right: financial figures (auto + override) ── */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="font-semibold text-sm text-gray-700">{hi ? 'वित्तीय विवरण' : 'Financial Summary'}</p>
            <ReadonlyRow label={hi ? 'कुल आय' : 'Total Income'} value={`₹ ${fmt(totalIncome)}`} />
            <ReadonlyRow label={hi ? 'कुल व्यय' : 'Total Expenditure'} value={`₹ ${fmt(totalExpense)}`} />
            <ReadonlyRow
              label={netProfit >= 0 ? (hi ? 'शुद्ध अधिशेष' : 'Net Surplus') : (hi ? 'शुद्ध घाटा' : 'Net Deficit')}
              value={`₹ ${fmt(Math.abs(netProfit))}`}
              highlight
            />
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'नकद शेष (नकद बही)' : 'Cash Balance (Cash Book)'}</Label>
              <Input type="number" value={cashBookBal} onChange={e => setCashBookBal(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'बैंक शेष' : 'Bank Balance'}</Label>
              <Input type="number" value={bankBookBal} onChange={e => setBankBookBal(e.target.value)} className="h-8 text-sm" />
            </div>
            <ReadonlyRow label={hi ? 'अंश पूंजी' : 'Share Capital'} value={`₹ ${fmt(shareCapital)}`} />
            <ReadonlyRow label={hi ? 'सक्रिय सदस्य' : 'Active Members'} value={String(totalMembersCount)} />
          </CardContent>
        </Card>
      </div>

      {/* Observations */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Label className="text-sm font-semibold">{hi ? 'ऑडिटर की टिप्पणी / आपत्तियाँ' : "Auditor's Observations / Remarks"}</Label>
          <Textarea
            value={observations}
            onChange={e => setObservations(e.target.value)}
            rows={5}
            placeholder={hi ? 'कोई विशेष टिप्पणी या आपत्ति नहीं। खाते सही तरीके से रखे गए हैं।' : 'No adverse observations. Accounts are maintained properly in accordance with the provisions of the Act.'}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Preview certificate text */}
      <Card className="border-teal-200">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-teal-700 mb-2">{hi ? 'प्रमाणपत्र पाठ (पूर्वावलोकन)' : 'Certificate Text (Preview)'}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            I/We have examined the accounts of <strong>{society.name}</strong> for the year ending{' '}
            <strong>{auditTo || fy}</strong>. In my/our opinion and to the best of my/our knowledge and
            belief, the accounts give a true and fair view of the state of affairs of the Society
            and are in agreement with the books and records of the Society.
          </p>
          <div className="mt-4 flex justify-between text-xs text-gray-500">
            <span>
              {hi ? 'ऑडिटर:' : 'Auditor:'} {auditorName || '________________'}
              {auditorRegNo ? ` | Reg: ${auditorRegNo}` : ''}
            </span>
            <span>{hi ? 'ऑडिट तिथि:' : 'Date:'} {auditDate ? fmtDate(auditDate) : '—'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ReadonlyRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-600">{label}</span>
    <span className={`text-sm font-semibold ${highlight ? 'text-teal-700' : 'text-gray-800'}`}>{value}</span>
  </div>
);

export default AuditCertificate;
