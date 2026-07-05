import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Building2, CheckCircle2, AlertCircle, Upload, Save, FileDown, History, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_IDS, getBankAccountIds } from '@/lib/storage';
import * as storage from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BankReconciliationRecord } from '@/types';

import * as XLSX from 'xlsx';

// ── CSV/Excel Import helpers ──────────────────────────────────────────────────
interface CsvRow { date: string; description: string; debit: number; credit: number; balance: number }

function normalizeBankRows(rows: any[]): CsvRow[] {
  return rows.map(row => {
    // Support both array and object rows (xlsx can return either)
    const cols = Array.isArray(row) ? row : Object.values(row);
    const [dateRaw, description = '', debitRaw = 0, creditRaw = 0, balRaw = 0] = cols;
    const dateParsed = new Date(dateRaw);
    if (isNaN(dateParsed.getTime())) return null;
    const date = dateParsed.toISOString().split('T')[0];
    const debit = parseFloat(String(debitRaw).replace(/,/g, '')) || 0;
    const credit = parseFloat(String(creditRaw).replace(/,/g, '')) || 0;
    const balance = parseFloat(String(balRaw).replace(/,/g, '')) || 0;
    return { date, description: String(description), debit, credit, balance };
  }).filter(Boolean) as CsvRow[];
}

function parseBankCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const dataRows = lines.slice(1).map(line =>
    line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
  ).filter(cols => cols.length >= 4);
  return normalizeBankRows(dataRows);
}

function parseBankExcel(buffer: ArrayBuffer): CsvRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return normalizeBankRows(rows.slice(1)); // skip header row
}

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const TODAY = new Date().toISOString().split('T')[0];

const BankReconciliation: React.FC = () => {
  const { language } = useLanguage();
  const { vouchers, accounts, society, getAccountBalance, clearVoucher, unclearVoucher, addVoucher } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || 'SOC001';

  const [asOfDate, setAsOfDate] = useState(TODAY);
  const [statementBalance, setStatementBalance] = useState<number | ''>('');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [autoMatched, setAutoMatched] = useState(0);

  // Saved reconciliation sign-off records (page-local; Supabase-first, localStorage fallback).
  const [records, setRecords] = useState<BankReconciliationRecord[]>(() => storage.getBankReconciliations());
  useEffect(() => {
    if (!user?.societyId) { setRecords([]); return; }
    supabase.from('bank_reconciliations').select('*').eq('society_id', user.societyId).then(
      ({ data, error }) => setRecords(error || !data ? storage.getBankReconciliations() : (data as BankReconciliationRecord[])),
      () => setRecords(storage.getBankReconciliations()),
    );
  }, [user?.societyId]);

  const bankIds = useMemo(() => getBankAccountIds(accounts), [accounts]);
  const [selectedBank, setSelectedBank] = useState('');
  const activeBankId = selectedBank || bankIds[0] || '';

  const bankAccount = accounts.find(a => a.id === activeBankId);

  // Helper: sum of bank Dr/Cr line amounts for a voucher (supports multi-line Expert Mode vouchers)
  const bankDrAmt = (v: typeof vouchers[0]) =>
    getVoucherLines(v).filter(l => l.accountId === activeBankId && l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
  const bankCrAmt = (v: typeof vouchers[0]) =>
    getVoucherLines(v).filter(l => l.accountId === activeBankId && l.type === 'Cr').reduce((s, l) => s + l.amount, 0);

  // All active bank vouchers up to asOfDate
  const bankVouchers = useMemo(() => {
    return vouchers
      .filter(v =>
        !v.isDeleted &&
        v.date <= asOfDate &&
        getVoucherLines(v).some(l => l.accountId === activeBankId)
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [vouchers, asOfDate]);

  // Uncleared deposits (Dr Bank — money coming in, not yet in bank statement)
  const unclearedDeposits = bankVouchers.filter(v => !v.isCleared && bankDrAmt(v) > 0);
  // Uncleared payments/cheques (Cr Bank — cheques issued but not yet presented)
  const unclearedPayments = bankVouchers.filter(v => !v.isCleared && bankCrAmt(v) > 0);
  // Cleared vouchers
  const clearedVouchers = bankVouchers.filter(v => v.isCleared);

  const totalUnclearedDeposits = unclearedDeposits.reduce((s, v) => s + bankDrAmt(v), 0);
  const totalUnclearedPayments = unclearedPayments.reduce((s, v) => s + bankCrAmt(v), 0);

  // Book balance (as per our bank account) — all active bank txns up to asOfDate
  const bookBalance = useMemo(() => {
    const acct = accounts.find(a => a.id === activeBankId);
    if (!acct) return 0;
    let bal = acct.openingBalanceType === 'debit' ? acct.openingBalance : -acct.openingBalance;
    vouchers
      .filter(v => !v.isDeleted && v.date <= asOfDate &&
        getVoucherLines(v).some(l => l.accountId === activeBankId))
      .forEach(v => {
        getVoucherLines(v).forEach(l => {
          if (l.accountId !== activeBankId) return;
          if (l.type === 'Dr') bal += l.amount;
          else bal -= l.amount;
        });
      });
    return bal;
  }, [vouchers, accounts, asOfDate]);

  // BRS: Bank Statement Balance = Book Balance - Uncleared Deposits + Uncleared Payments
  // (deposits in books but not yet in statement reduce statement bal relative to books)
  // (outstanding cheques in books but not presented means statement still has that money)
  const derivedStatementBalance = bookBalance - totalUnclearedDeposits + totalUnclearedPayments;
  const difference = statementBalance !== '' ? statementBalance - derivedStatementBalance : null;
  const isReconciled = difference !== null && Math.abs(difference) < 0.01;

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? id;

  // ── Unmatched statement lines → post an adjusting entry (bank charges/interest/TDS) ──
  const rowMatchesVoucher = (row: CsvRow) => {
    const amt = row.credit > 0 ? row.credit : row.debit;
    const isDeposit = row.credit > 0;
    return vouchers.some(v => !v.isDeleted && v.date === row.date &&
      Math.abs((isDeposit ? bankDrAmt(v) : bankCrAmt(v)) - amt) < 1 &&
      getVoucherLines(v).some(l => l.accountId === activeBankId && l.type === (isDeposit ? 'Dr' : 'Cr')));
  };
  const unmatchedRows = useMemo(
    () => csvRows.map((row, i) => ({ row, i })).filter(({ row }) => (row.credit > 0 || row.debit > 0) && !rowMatchesVoucher(row)),
    [csvRows, vouchers, activeBankId],
  );
  const [rowContra, setRowContra] = useState<Record<number, string>>({});
  // Leaf (postable) accounts only — never post into a group/header account.
  const leafParentIds = useMemo(() => new Set(accounts.map(a => a.parentId).filter(Boolean)), [accounts]);
  const contraOptions = (isDeposit: boolean) => accounts.filter(a =>
    a.id !== activeBankId && !leafParentIds.has(a.id) &&
    (isDeposit ? ['income', 'liability', 'asset'].includes(a.type) : ['expense', 'asset'].includes(a.type)));

  const postAdjustment = (idx: number) => {
    const row = csvRows[idx];
    const contraId = rowContra[idx];
    if (!row || !contraId) { toast({ title: hi ? 'खाता चुनें' : 'Pick a contra account', variant: 'destructive' }); return; }
    const isDeposit = row.credit > 0;
    const amount = isDeposit ? row.credit : row.debit;
    if (!(amount > 0)) return;
    const lid = () => crypto.randomUUID();
    const lines: { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = isDeposit
      ? [{ id: lid(), accountId: activeBankId, type: 'Dr', amount }, { id: lid(), accountId: contraId, type: 'Cr', amount }]
      : [{ id: lid(), accountId: contraId, type: 'Dr', amount }, { id: lid(), accountId: activeBankId, type: 'Cr', amount }];
    addVoucher({
      type: isDeposit ? 'receipt' : 'payment', date: row.date, lines,
      debitAccountId: isDeposit ? activeBankId : contraId, creditAccountId: isDeposit ? contraId : activeBankId, amount,
      narration: row.description || (hi ? 'बैंक समायोजन' : 'Bank adjustment'),
      createdBy: user?.name || 'System', isCleared: true, clearedDate: row.date,
    } as Parameters<typeof addVoucher>[0]);
    setRowContra(prev => { const n = { ...prev }; delete n[idx]; return n; });
    toast({ title: hi ? '✅ प्रविष्टि दर्ज (मिलान हुआ)' : '✅ Entry posted & cleared', description: `${fmt(amount)} · ${getAccountName(contraId)}` });
  };

  // ── Save reconciliation sign-off (RULE-1 safe) ────────────────────────────
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId });
  const persistRecords = (next: BankReconciliationRecord[]) => { setRecords(next); storage.setBankReconciliations(next); };

  const saveReconciliation = () => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'ऑडिट-लॉक होने पर सहेज नहीं सकते।' : 'Cannot save while FY is audit-locked.', variant: 'destructive' }); return; }
    if (!activeBankId) { toast({ title: hi ? 'बैंक खाता चुनें' : 'Select a bank account', variant: 'destructive' }); return; }
    if (statementBalance === '') { toast({ title: hi ? 'पहले स्टेटमेंट शेष दर्ज करें' : 'Enter the statement balance first', variant: 'destructive' }); return; }
    const rec: BankReconciliationRecord = {
      id: crypto.randomUUID(), bankAccountId: activeBankId, bankAccountName: bankAccount?.name || activeBankId,
      asOfDate, statementBalance: Number(statementBalance), bookBalance,
      unclearedDepositsTotal: totalUnclearedDeposits, unclearedPaymentsTotal: totalUnclearedPayments,
      unclearedDepositIds: unclearedDeposits.map(v => v.id), unclearedPaymentIds: unclearedPayments.map(v => v.id),
      difference: difference ?? 0, isReconciled: !!isReconciled,
      reconciledBy: user?.name || 'System', reconciledAt: new Date().toISOString(),
    };
    const prev = records;
    persistRecords([rec, ...records]);
    supabase.from('bank_reconciliations').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('BRS save error:', error.message);
        persistRecords(prev); // RULE-1 rollback
        toast({ title: hi ? 'समाधान सेव नहीं हुआ' : 'Reconciliation not saved', description: `Cloud save fail — ${error.message}. (Pehli baar: bank_reconciliations block chalayein.)`, variant: 'destructive', duration: 12000 });
      } else {
        toast({ title: hi ? '✅ समाधान सहेजा गया' : '✅ Reconciliation saved', description: rec.isReconciled ? (hi ? 'समाधित' : 'Reconciled') : (hi ? `अंतर ${fmt(Math.abs(rec.difference))}` : `Difference ${fmt(Math.abs(rec.difference))}`) });
      }
    });
  };

  const deleteReconciliation = (id: string) => {
    const prev = records;
    persistRecords(records.filter(r => r.id !== id));
    supabase.from('bank_reconciliations').update({ isDeleted: true }).eq('id', id).then(({ error }) => {
      if (error) { persistRecords(prev); toast({ title: hi ? 'हटाया नहीं गया' : 'Delete failed', description: error.message, variant: 'destructive' }); }
    });
  };

  // ── Printable BRS statement (PDF) ─────────────────────────────────────────
  const resolveVouchers = (ids: string[]) => ids.map(id => vouchers.find(v => v.id === id)).filter(Boolean) as typeof vouchers;
  const buildBrsPdf = (
    r: { bankAccountId: string; bankAccountName: string; asOfDate: string; bookBalance: number; statementBalance: number;
         unclearedDepositsTotal: number; unclearedPaymentsTotal: number; difference: number; isReconciled: boolean;
         reconciledBy: string; reconciledAt: string },
    deposits: typeof vouchers, payments: typeof vouchers,
  ) => {
    const drOf = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.accountId === r.bankAccountId && l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
    const crOf = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.accountId === r.bankAccountId && l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('BANK RECONCILIATION STATEMENT', w / 2, 16, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(society.name, w / 2, 23, { align: 'center' });
    const sub = [society.registrationNo ? `Reg: ${society.registrationNo}` : null, `Bank: ${r.bankAccountName}`, `As of: ${r.asOfDate}`].filter(Boolean).join('   |   ');
    doc.text(sub, w / 2, 29, { align: 'center' });
    autoTable(doc, {
      startY: 36,
      head: [['Particulars', 'Amount (Rs.)']],
      body: [
        ['Balance as per Cash Book (Bank A/c)', r.bookBalance.toFixed(2)],
        [`Less: Deposits in transit (not yet in statement) [${deposits.length}]`, '- ' + r.unclearedDepositsTotal.toFixed(2)],
        [`Add: Outstanding cheques (not yet presented) [${payments.length}]`, '+ ' + r.unclearedPaymentsTotal.toFixed(2)],
        ['Derived Balance as per Bank Statement', (r.bookBalance - r.unclearedDepositsTotal + r.unclearedPaymentsTotal).toFixed(2)],
        ['Balance as per Bank Statement (entered)', r.statementBalance.toFixed(2)],
        ['Difference', r.difference.toFixed(2)],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [41, 82, 163], textColor: 255 },
      columnStyles: { 1: { halign: 'right' } },
    });
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFont('helvetica', 'bold');
    if (r.isReconciled) { doc.setTextColor(21, 128, 61); doc.text('RECONCILED — difference NIL', 14, y); }
    else { doc.setTextColor(190, 24, 61); doc.text(`NOT RECONCILED — difference Rs. ${Math.abs(r.difference).toFixed(2)}`, 14, y); }
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    if (deposits.length) {
      y += 6; doc.setFontSize(10); doc.text('Deposits in transit', 14, y);
      autoTable(doc, { startY: y + 2, head: [['Date', 'Voucher', 'Narration', 'Amount']],
        body: deposits.map(v => [v.date, v.voucherNo || '', (v.narration || '').slice(0, 60), drOf(v).toFixed(2)]),
        styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 8 }, columnStyles: { 3: { halign: 'right' } } });
    }
    if (payments.length) {
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      doc.setFontSize(10); doc.text('Outstanding cheques', 14, y);
      autoTable(doc, { startY: y + 2, head: [['Date', 'Voucher', 'Narration', 'Amount']],
        body: payments.map(v => [v.date, v.voucherNo || '', (v.narration || '').slice(0, 60), crOf(v).toFixed(2)]),
        styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8 }, columnStyles: { 3: { halign: 'right' } } });
    }
    const fy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.text(`Reconciled by: ${r.reconciledBy}     On: ${new Date(r.reconciledAt).toLocaleString('en-IN')}`, 14, fy);
    doc.text('Prepared by: ____________            Verified by: ____________', 14, fy + 10);
    doc.save(`BRS_${r.bankAccountName.replace(/\s+/g, '_')}_${r.asOfDate}.pdf`);
  };

  const downloadCurrentBrs = () => {
    if (!activeBankId) { toast({ title: hi ? 'बैंक खाता चुनें' : 'Select a bank account', variant: 'destructive' }); return; }
    buildBrsPdf({
      bankAccountId: activeBankId, bankAccountName: bankAccount?.name || activeBankId, asOfDate, bookBalance,
      statementBalance: statementBalance === '' ? 0 : Number(statementBalance),
      unclearedDepositsTotal: totalUnclearedDeposits, unclearedPaymentsTotal: totalUnclearedPayments,
      difference: difference ?? 0, isReconciled: !!isReconciled, reconciledBy: user?.name || 'System', reconciledAt: new Date().toISOString(),
    }, unclearedDeposits, unclearedPayments);
  };

  const activeRecords = useMemo(() => records.filter(r => !r.isDeleted).sort((a, b) => b.reconciledAt.localeCompare(a.reconciledAt)), [records]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Building2 className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'hi' ? 'बैंक समाधान विवरण (BRS)' : 'Bank Reconciliation Statement'}
          </h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'तिथि तक' : 'As of Date'}</Label>
              <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'बैंक खाता' : 'Bank Account'}</Label>
              {bankIds.length > 1 ? (
                <select value={activeBankId} onChange={e => setSelectedBank(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {bankIds.map(bid => {
                    const acc = accounts.find(a => a.id === bid);
                    return <option key={bid} value={bid}>{acc?.name || bid}</option>;
                  })}
                </select>
              ) : (
                <Input value={bankAccount?.name ?? '—'} readOnly className="bg-muted/50" />
              )}
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'पासबुक / बैंक स्टेटमेंट शेष (₹)' : 'Passbook / Statement Balance (₹)'}</Label>
              <Input
                type="number"
                step={0.01}
                value={statementBalance}
                onChange={e => setStatementBalance(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={language === 'hi' ? 'बैंक स्टेटमेंट से दर्ज करें' : 'Enter from bank statement'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {language === 'hi' ? 'बैंक स्टेटमेंट CSV / Excel आयात' : 'Import Bank Statement (CSV / Excel)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {language === 'hi'
              ? 'CSV / Excel फ़ॉर्मेट: Date, Description, Debit, Credit, Balance (हेडर सहित)'
              : 'CSV / Excel format: Date, Description, Debit, Credit, Balance (with header row)'}
          </p>
          <div className="flex items-center gap-3">
            <input
              type="file" accept=".csv,.xlsx,.xls"
              className="text-sm"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const isExcel = file.name.match(/\.xlsx?$/i);
                const processRows = (rows: CsvRow[]) => {
                  setCsvRows(rows);
                  let matched = 0;
                  rows.forEach(row => {
                    const amt = row.credit > 0 ? row.credit : row.debit;
                    const isDeposit = row.credit > 0;
                    const match = vouchers.find(v =>
                      !v.isDeleted && !v.isCleared &&
                      v.date === row.date &&
                      Math.abs((isDeposit ? bankDrAmt(v) : bankCrAmt(v)) - amt) < 1 &&
                      getVoucherLines(v).some(l =>
                        l.accountId === activeBankId && l.type === (isDeposit ? 'Dr' : 'Cr')
                      )
                    );
                    if (match) { clearVoucher(match.id); matched++; }
                  });
                  setAutoMatched(matched);
                  toast({ title: language === 'hi'
                    ? `${rows.length} पंक्तियाँ आयात हुईं, ${matched} वाउचर स्वतः मिलान हुए`
                    : `${rows.length} rows imported, ${matched} vouchers auto-matched` });
                };
                const reader = new FileReader();
                if (isExcel) {
                  reader.onload = ev => processRows(parseBankExcel(ev.target?.result as ArrayBuffer));
                  reader.readAsArrayBuffer(file);
                } else {
                  reader.onload = ev => processRows(parseBankCsv(ev.target?.result as string));
                  reader.readAsText(file);
                }
              }}
            />
            {csvRows.length > 0 && (
              <span className="text-sm text-green-700 font-medium">
                {csvRows.length} {language === 'hi' ? 'पंक्तियाँ' : 'rows'} · {autoMatched} {language === 'hi' ? 'मिलान' : 'matched'}
              </span>
            )}
          </div>
          {csvRows.length > 0 && (
            <div className="overflow-x-auto max-h-48 border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-1 text-left">{language === 'hi' ? 'तिथि' : 'Date'}</th>
                    <th className="p-1 text-left">{language === 'hi' ? 'विवरण' : 'Description'}</th>
                    <th className="p-1 text-right">{language === 'hi' ? 'डेबिट' : 'Debit'}</th>
                    <th className="p-1 text-right">{language === 'hi' ? 'क्रेडिट' : 'Credit'}</th>
                    <th className="p-1 text-right">{language === 'hi' ? 'शेष' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">{r.date}</td>
                      <td className="p-1 truncate max-w-[120px]">{r.description}</td>
                      <td className="p-1 text-right font-mono">{r.debit > 0 ? r.debit.toFixed(2) : ''}</td>
                      <td className="p-1 text-right font-mono">{r.credit > 0 ? r.credit.toFixed(2) : ''}</td>
                      <td className="p-1 text-right font-mono">{r.balance > 0 ? r.balance.toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unmatched statement lines → post adjusting entry */}
      {unmatchedRows.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" />
              {language === 'hi' ? 'बिना मिलान स्टेटमेंट पंक्तियाँ' : 'Unmatched statement lines'}
              <Badge variant="secondary" className="ml-auto">{unmatchedRows.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {language === 'hi'
                ? 'बैंक शुल्क / ब्याज / TDS — खाता चुनकर पुस्तकों में दर्ज करें (स्वतः मिलान भी हो जाएगा)।'
                : 'Bank charges / interest / TDS — pick an account to post them into the books (auto-marked cleared).'}
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{language === 'hi' ? 'विवरण' : 'Description'}</TableHead>
                  <TableHead>{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead>{language === 'hi' ? 'सामने वाला खाता' : 'Contra account'}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedRows.map(({ row, i }) => {
                  const isDeposit = row.credit > 0;
                  const amount = isDeposit ? row.credit : row.debit;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{fmtDate(row.date)}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{row.description || '—'}</TableCell>
                      <TableCell>
                        {isDeposit
                          ? <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">{language === 'hi' ? 'जमा' : 'In'}</Badge>
                          : <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">{language === 'hi' ? 'नामे' : 'Out'}</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(amount)}</TableCell>
                      <TableCell>
                        <select value={rowContra[i] || ''} onChange={e => setRowContra(p => ({ ...p, [i]: e.target.value }))}
                          className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs">
                          <option value="">{language === 'hi' ? 'खाता चुनें' : 'Select account'}</option>
                          {contraOptions(isDeposit).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" disabled={!rowContra[i]} onClick={() => postAdjustment(i)}>
                          {language === 'hi' ? 'दर्ज करें' : 'Post'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* BRS Summary */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            {language === 'hi' ? 'समाधान विवरण' : 'Reconciliation Statement'}
            {isReconciled && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {language === 'hi' ? 'समाधित' : 'Reconciled'}
              </Badge>
            )}
            {difference !== null && !isReconciled && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                {language === 'hi' ? 'अंतर' : 'Difference'}: {fmt(Math.abs(difference))}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2 text-sm">
            <div className="flex justify-between font-medium">
              <span>{language === 'hi' ? 'बही खाता शेष (पुस्तकों के अनुसार)' : 'Balance as per Books (Bank A/c)'}</span>
              <span className="font-mono">{fmt(bookBalance)}</span>
            </div>
            <div className="flex justify-between text-red-600 border-t pt-1">
              <span>
                {language === 'hi'
                  ? 'घटाएं: जमा किए गए चेक (बैंक में जमा नहीं)'
                  : 'Less: Deposits in transit (not in statement)'}
                {unclearedDeposits.length > 0 && <span className="text-xs ml-1">({unclearedDeposits.length})</span>}
              </span>
              <span className="font-mono">- {fmt(totalUnclearedDeposits)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>
                {language === 'hi'
                  ? 'जोड़ें: जारी चेक (बैंक में प्रस्तुत नहीं)'
                  : 'Add: Outstanding cheques (not yet presented)'}
                {unclearedPayments.length > 0 && <span className="text-xs ml-1">({unclearedPayments.length})</span>}
              </span>
              <span className="font-mono">+ {fmt(totalUnclearedPayments)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>{language === 'hi' ? 'अनुमानित बैंक स्टेटमेंट शेष' : 'Derived Statement Balance'}</span>
              <span className={cn('font-mono', isReconciled ? 'text-green-700' : '')}>
                {fmt(derivedStatementBalance)}
              </span>
            </div>
            {statementBalance !== '' && (
              <div className={cn(
                'flex justify-between text-sm border-t pt-2 font-semibold',
                isReconciled ? 'text-green-700' : 'text-red-600'
              )}>
                <span>{language === 'hi' ? 'अंतर (स्टेटमेंट − अनुमानित)' : 'Difference (Statement − Derived)'}</span>
                <span className="font-mono">{fmt(difference ?? 0)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
            <Button size="sm" onClick={saveReconciliation} className="gap-1">
              <Save className="h-4 w-4" />{hi ? 'समाधान सहेजें (साइन-ऑफ)' : 'Save reconciliation (sign-off)'}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadCurrentBrs} className="gap-1">
              <FileDown className="h-4 w-4" />{hi ? 'BRS विवरण (PDF)' : 'BRS statement (PDF)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Past reconciliations (audit sign-off log) */}
      {activeRecords.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              {hi ? 'सहेजे गए समाधान (ऑडिट रिकॉर्ड)' : 'Saved reconciliations (audit log)'}
              <Badge variant="secondary" className="ml-auto">{activeRecords.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'तिथि तक' : 'As of'}</TableHead>
                  <TableHead>{hi ? 'बैंक' : 'Bank'}</TableHead>
                  <TableHead className="text-right">{hi ? 'स्टेटमेंट शेष' : 'Statement'}</TableHead>
                  <TableHead className="text-right">{hi ? 'अंतर' : 'Difference'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead>{hi ? 'द्वारा' : 'By'}</TableHead>
                  <TableHead className="w-20 text-right">{hi ? 'क्रिया' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRecords.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.asOfDate)}</TableCell>
                    <TableCell className="text-sm">{r.bankAccountName}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.statementBalance)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.difference)}</TableCell>
                    <TableCell>
                      {r.isReconciled
                        ? <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">{hi ? 'समाधित' : 'Reconciled'}</Badge>
                        : <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">{hi ? 'अंतर' : 'Diff'}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reconciledBy}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={hi ? 'पुनः प्रिंट' : 'Reprint'}
                        onClick={() => buildBrsPdf(r, resolveVouchers(r.unclearedDepositIds), resolveVouchers(r.unclearedPaymentIds))}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" title={hi ? 'हटाएं' : 'Delete'}
                        onClick={() => deleteReconciliation(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Uncleared Deposits */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base text-orange-700">
            {language === 'hi'
              ? `जमा लेकिन बैंक में क्रेडिट नहीं (${unclearedDeposits.length})`
              : `Deposits in Transit — not yet credited in statement (${unclearedDeposits.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{language === 'hi' ? 'पास' : 'Clear'}</TableHead>
                <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                <TableHead>{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                <TableHead>{language === 'hi' ? 'विवरण' : 'Particulars'}</TableHead>
                <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unclearedDeposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    {language === 'hi' ? 'सभी जमा स्टेटमेंट में हैं' : 'All deposits cleared in statement'}
                  </TableCell>
                </TableRow>
              ) : (
                unclearedDeposits.map(v => (
                  <TableRow key={v.id} className="bg-orange-50/30">
                    <TableCell>
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => clearVoucher(v.id)}
                        title={language === 'hi' ? 'क्लियर करें' : 'Mark as cleared'}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                    <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                    <TableCell className="text-sm">
                      {v.narration || getVoucherLines(v).filter(l => l.accountId !== activeBankId && l.type === 'Cr').map(l => getAccountName(l.accountId)).join(', ')}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-700">{fmt(bankDrAmt(v))}</TableCell>
                  </TableRow>
                ))
              )}
              {unclearedDeposits.length > 0 && (
                <TableRow className="font-semibold bg-orange-50">
                  <TableCell colSpan={4} className="text-right">
                    {language === 'hi' ? 'कुल' : 'Total'}
                  </TableCell>
                  <TableCell className="text-right text-orange-700">{fmt(totalUnclearedDeposits)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Uncleared Payments / Outstanding Cheques */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base text-blue-700">
            {language === 'hi'
              ? `जारी चेक — बैंक में प्रस्तुत नहीं (${unclearedPayments.length})`
              : `Outstanding Cheques — not yet presented to bank (${unclearedPayments.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{language === 'hi' ? 'पास' : 'Clear'}</TableHead>
                <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                <TableHead>{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                <TableHead>{language === 'hi' ? 'विवरण' : 'Particulars'}</TableHead>
                <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unclearedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                    {language === 'hi' ? 'कोई बकाया चेक नहीं' : 'No outstanding cheques'}
                  </TableCell>
                </TableRow>
              ) : (
                unclearedPayments.map(v => (
                  <TableRow key={v.id} className="bg-blue-50/30">
                    <TableCell>
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => clearVoucher(v.id)}
                        title={language === 'hi' ? 'क्लियर करें' : 'Mark as cleared'}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                    <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                    <TableCell className="text-sm">
                      {v.narration || getVoucherLines(v).filter(l => l.accountId !== activeBankId && l.type === 'Dr').map(l => getAccountName(l.accountId)).join(', ')}
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-700">{fmt(bankCrAmt(v))}</TableCell>
                  </TableRow>
                ))
              )}
              {unclearedPayments.length > 0 && (
                <TableRow className="font-semibold bg-blue-50">
                  <TableCell colSpan={4} className="text-right">
                    {language === 'hi' ? 'कुल' : 'Total'}
                  </TableCell>
                  <TableCell className="text-right text-blue-700">{fmt(totalUnclearedPayments)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cleared Vouchers */}
      {clearedVouchers.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {language === 'hi'
                ? `समाधित लेनदेन (${clearedVouchers.length})`
                : `Cleared Transactions (${clearedVouchers.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{language === 'hi' ? 'विवरण' : 'Particulars'}</TableHead>
                  <TableHead>{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead>{language === 'hi' ? 'पास तिथि' : 'Cleared Date'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clearedVouchers.map(v => {
                  const isDeposit = getVoucherLines(v).some(l => l.accountId === activeBankId && l.type === 'Dr');
                  return (
                    <TableRow key={v.id} className="bg-green-50/20">
                      <TableCell>
                        <Checkbox
                          checked={true}
                          onCheckedChange={() => unclearVoucher(v.id)}
                          title={language === 'hi' ? 'अनक्लियर करें' : 'Mark as uncleared'}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                      <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                      <TableCell className="text-sm">
                        {v.narration || getVoucherLines(v).filter(l => l.accountId !== activeBankId && l.type === (isDeposit ? 'Cr' : 'Dr')).map(l => getAccountName(l.accountId)).join(', ')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isDeposit
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                        }>
                          {isDeposit
                            ? (language === 'hi' ? 'जमा' : 'Deposit')
                            : (language === 'hi' ? 'भुगतान' : 'Payment')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(isDeposit ? bankDrAmt(v) : bankCrAmt(v))}</TableCell>
                      <TableCell className="text-sm text-gray-500">{v.clearedDate ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BankReconciliation;
