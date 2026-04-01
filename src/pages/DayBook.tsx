import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { ACCOUNT_IDS } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Download, Printer, Filter, Wallet, Pencil, Save, X, FileSpreadsheet } from 'lucide-react';
import { generateDayBookPDF } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import type { VoucherType } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { fmtDate as fmtDateShort, fmtDateLong } from '@/lib/dateUtils';

const DayBook: React.FC = () => {
  const { language } = useLanguage();
  const { vouchers, accounts, society, updateVoucher } = useData();
  const { toast } = useToast();

  // Edit dialog state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<VoucherType>('receipt');
  const [editDebit, setEditDebit] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNarration, setEditNarration] = useState('');

  const openEdit = (v: { id: string; date: string; type: string; debitAccountId: string; creditAccountId: string; amount: number; narration?: string }) => {
    setEditId(v.id);
    setEditDate(v.date);
    setEditType(v.type as VoucherType);
    setEditDebit(v.debitAccountId);
    setEditCredit(v.creditAccountId);
    setEditAmount(String(v.amount));
    setEditNarration(v.narration || '');
  };

  const handleEditSave = () => {
    if (!editId || !editDebit || !editCredit || !editAmount || Number(editAmount) <= 0) return;
    if (editDebit === editCredit) {
      toast({ title: language === 'hi' ? 'डेबिट और क्रेडिट खाता अलग होना चाहिए' : 'Debit and Credit accounts must be different', variant: 'destructive' });
      return;
    }
    updateVoucher(editId, {
      type: editType,
      date: editDate,
      debitAccountId: editDebit,
      creditAccountId: editCredit,
      amount: Number(editAmount),
      narration: editNarration,
    });
    toast({ title: language === 'hi' ? 'वाउचर अपडेट किया गया' : 'Voucher updated successfully' });
    setEditId(null);
  };

  const today = new Date().toISOString().split('T')[0];
  const fyStart = society.financialYearStart || `${society.financialYear?.split('-')[0]}-04-01`;

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate, setToDate] = useState(today);
  const [filtered, setFiltered] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return language === 'hi' ? (acc?.nameHi || acc?.name || id) : (acc?.name || id);
  };

  const activeVouchers = vouchers.filter(v => !v.isDeleted);

  const entries = useMemo(() => {
    return activeVouchers
      .filter(v => {
        if (filtered) {
          if (fromDate && v.date < fromDate) return false;
          if (toDate && v.date > toDate) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }, [activeVouchers, fromDate, toDate, filtered]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: typeof entries }[] = [];
    entries.forEach(v => {
      const last = groups[groups.length - 1];
      if (last && last.date === v.date) last.items.push(v);
      else groups.push({ date: v.date, items: [v] });
    });
    return groups;
  }, [entries]);

  // Pre-period opening balance: account OB + all vouchers BEFORE the filter start
  const { cashOB, bankOB } = useMemo(() => {
    const cashAccOB = accounts.find(a => a.id === ACCOUNT_IDS.CASH)?.openingBalance || 0;
    const bankAccOB = accounts.find(a => a.id === ACCOUNT_IDS.BANK)?.openingBalance || 0;
    // Vouchers BEFORE the first visible date (i.e. outside the current filter window)
    const firstDate = entries.length > 0 ? entries[0].date : null;
    let preCash = cashAccOB;
    let preBank = bankAccOB;
    if (firstDate) {
      activeVouchers.forEach(v => {
        if (v.date >= firstDate) return; // only pre-period
        getVoucherLines(v).forEach(l => {
          if (l.accountId === ACCOUNT_IDS.CASH) preCash += l.type === 'Dr' ? l.amount : -l.amount;
          if (l.accountId === ACCOUNT_IDS.BANK) preBank += l.type === 'Dr' ? l.amount : -l.amount;
        });
      });
    }
    return { cashOB: preCash, bankOB: preBank };
  }, [accounts, activeVouchers, entries]);

  const runningBalances = useMemo(() => {
    let cash = cashOB;
    let bank = bankOB;
    return groupedByDate.map(group => {
      const openCash = cash;
      const openBank = bank;
      group.items.forEach(v => {
        getVoucherLines(v).forEach(l => {
          if (l.accountId === ACCOUNT_IDS.CASH) cash += l.type === 'Dr' ? l.amount : -l.amount;
          if (l.accountId === ACCOUNT_IDS.BANK) bank += l.type === 'Dr' ? l.amount : -l.amount;
        });
      });
      return { date: group.date, openCash, openBank, closeCash: cash, closeBank: bank };
    });
  }, [groupedByDate, cashOB, bankOB]);

  const totalReceipts = entries.filter(v => v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
  const totalPayments = entries.filter(v => v.type === 'payment').reduce((s, v) => s + v.amount, 0);
  const totalJournals = entries.filter(v => v.type === 'journal').reduce((s, v) => s + v.amount, 0);
  const lastRB = runningBalances[runningBalances.length - 1];
  const cashCB = lastRB ? lastRB.closeCash : cashOB;

  const typeLabel = (type: string) => {
    if (type === 'receipt') return language === 'hi' ? 'रसीद' : 'Receipt';
    if (type === 'payment') return language === 'hi' ? 'भुगतान' : 'Payment';
    if (type === 'contra') return language === 'hi' ? 'कोंट्रा' : 'Contra';
    if (type === 'sale') return language === 'hi' ? 'बिक्री' : 'Sale';
    if (type === 'purchase') return language === 'hi' ? 'खरीद' : 'Purchase';
    if (type === 'debit_note') return language === 'hi' ? 'डेबिट नोट' : 'Debit Note';
    if (type === 'credit_note') return language === 'hi' ? 'क्रेडिट नोट' : 'Credit Note';
    return language === 'hi' ? 'जर्नल' : 'Journal';
  };

  const typeBadgeClass = (type: string) => {
    if (type === 'receipt') return 'bg-success/15 text-success border-success/30';
    if (type === 'payment') return 'bg-destructive/15 text-destructive border-destructive/30';
    return 'bg-info/15 text-info border-info/30';
  };

  const handleFilter = () => setFiltered(true);
  const handleReset = () => { setFromDate(fyStart); setToDate(today); setFiltered(false); };
  const handlePDF = () => generateDayBookPDF(entries, accounts, society, fromDate, toDate, language);
  const handlePrint = () => window.print();

  const exportHeaders = ['Date', 'Voucher No.', 'Type', 'Account', 'Dr/Cr', 'Amount', 'Narration'];

  // Fix: use getVoucherLines() so multi-line Expert Mode vouchers export all lines correctly.
  const buildExportRows = () => {
    const rows: (string | number)[][] = [];
    entries.forEach(v => {
      getVoucherLines(v).forEach((l, li) => {
        rows.push([
          li === 0 ? fmtDateShort(v.date) : '',
          li === 0 ? v.voucherNo : '',
          li === 0 ? typeLabel(v.type) : '',
          getAccountName(l.accountId),
          l.type,
          l.amount,
          li === 0 ? (v.narration || '') : '',
        ]);
      });
    });
    return rows;
  };

  const handleCSV = () => {
    downloadCSV(exportHeaders, buildExportRows(), `day-book-${fromDate}-to-${toDate}`);
  };

  const handleExcel = () => {
    downloadExcelSingle(exportHeaders, buildExportRows(), `day-book-${fromDate}-to-${toDate}`, 'Day Book');
  };

  const fmtDate = (d: string) => fmtDateLong(d, language === 'hi' ? 'hi' : 'en');

  return (
    <>
      <style>{`
        @media print {
          .day-group { break-inside: avoid; }
          body { font-size: 11px; }
        }
      `}</style>

      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              {language === 'hi' ? 'रोजनामचा' : 'Day Book'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'hi' ? 'सभी लेनदेन का दिनवार विवरण' : 'Day-wise chronological record of all transactions'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}>
              <Download className="h-4 w-4" />PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
              <FileSpreadsheet className="h-4 w-4" />Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
              <FileSpreadsheet className="h-4 w-4" />CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" />{language === 'hi' ? 'प्रिंट' : 'Print'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <Card className="bg-success/10 border-success/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल रसीद' : 'Total Receipts'}</p>
              <p className="text-xl font-bold text-success">{fmt(totalReceipts)}</p>
              <p className="text-xs text-muted-foreground">{entries.filter(v => v.type === 'receipt').length} {language === 'hi' ? 'वाउचर' : 'vouchers'}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल भुगतान' : 'Total Payments'}</p>
              <p className="text-xl font-bold text-destructive">{fmt(totalPayments)}</p>
              <p className="text-xs text-muted-foreground">{entries.filter(v => v.type === 'payment').length} {language === 'hi' ? 'वाउचर' : 'vouchers'}</p>
            </CardContent>
          </Card>
          <Card className="bg-info/10 border-info/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल जर्नल' : 'Total Journals'}</p>
              <p className="text-xl font-bold text-info">{fmt(totalJournals)}</p>
              <p className="text-xs text-muted-foreground">{entries.filter(v => v.type === 'journal').length} {language === 'hi' ? 'वाउचर' : 'vouchers'}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल वाउचर' : 'Total Entries'}</p>
              <p className="text-xl font-bold text-primary">{entries.length}</p>
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'प्रविष्टियां' : 'transactions'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Date Filter */}
        <Card className="no-print">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-sm">{language === 'hi' ? 'दिनांक से' : 'From Date'}</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{language === 'hi' ? 'दिनांक तक' : 'To Date'}</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 w-40" />
              </div>
              <Button size="sm" className="gap-2 h-9" onClick={handleFilter}>
                <Filter className="h-4 w-4" />{language === 'hi' ? 'फ़िल्टर' : 'Filter'}
              </Button>
              {filtered && (
                <Button size="sm" variant="outline" className="h-9" onClick={handleReset}>
                  {language === 'hi' ? 'रीसेट' : 'Reset'}
                </Button>
              )}
              <div className="ml-auto flex gap-6 text-sm text-muted-foreground">
                <span>{language === 'hi' ? 'नकद प्रारंभिक शेष' : 'Opening Cash'}: <strong>{fmt(cashOB)}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day-wise grouped tables */}
        {entries.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">{language === 'hi' ? 'कोई प्रविष्टि नहीं मिली' : 'No entries found'}</p>
              <p className="text-sm mt-1">{language === 'hi' ? 'फ़िल्टर बदलें या वाउचर जोड़ें' : 'Adjust date filter or add vouchers'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map((group, gIdx) => {
              const dayTotal = group.items.reduce((s, v) => s + v.amount, 0);
              const dayReceipts = group.items.filter(v => v.type === 'receipt').reduce((s, v) => s + v.amount, 0);
              const dayPayments = group.items.filter(v => v.type === 'payment').reduce((s, v) => s + v.amount, 0);
              const rb = runningBalances[gIdx];

              return (
                <div key={group.date} className="day-group rounded-lg border overflow-hidden shadow-sm">
                  {/* Day Header */}
                  <div className="bg-primary text-primary-foreground px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="font-bold text-sm">{fmtDate(group.date)}</p>
                      <p className="text-primary-foreground/75 text-xs">
                        {group.items.length} {language === 'hi' ? 'लेनदेन' : 'transaction(s)'}
                      </p>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-200">{language === 'hi' ? 'रसीद' : 'Rcpt'}: <strong>{fmt(dayReceipts)}</strong></span>
                      <span className="text-red-200">{language === 'hi' ? 'भुगतान' : 'Pmnt'}: <strong>{fmt(dayPayments)}</strong></span>
                      <span className="text-white font-semibold">{language === 'hi' ? 'योग' : 'Total'}: <strong>{fmt(dayTotal)}</strong></span>
                    </div>
                  </div>

                  {/* Opening Balance for this day */}
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap gap-6 items-center">
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      {language === 'hi' ? 'प्रारंभिक नकद शेष' : 'Opening Cash Balance'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <Wallet className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-amber-700">{language === 'hi' ? 'नकद (हाथ में)' : 'Cash in Hand'}:</span>
                      <span className="font-bold text-amber-800 text-sm">{fmt(rb.openCash)}</span>
                    </div>
                  </div>

                  {/* Transactions Table — Double Entry Format */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="font-semibold text-xs w-28">{language === 'hi' ? 'दिनांक / वाउचर' : 'Date / Voucher'}</TableHead>
                          <TableHead className="font-semibold text-xs">{language === 'hi' ? 'विवरण (Particulars)' : 'Particulars'}</TableHead>
                          <TableHead className="font-semibold text-xs text-right w-32">{language === 'hi' ? 'नाम (Dr) ₹' : 'Debit (₹)'}</TableHead>
                          <TableHead className="font-semibold text-xs text-right w-32">{language === 'hi' ? 'जमा (Cr) ₹' : 'Credit (₹)'}</TableHead>
                          <TableHead className="font-semibold text-xs text-center w-10 print:hidden">{language === 'hi' ? 'संपादन' : 'Edit'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((v, i) => {
                          const vLines = getVoucherLines(v);
                          const isMulti = vLines.length > 2;

                          if (isMulti) {
                            return (
                              <React.Fragment key={v.id}>
                                {vLines.map((line, li) => (
                                  <TableRow key={line.id} className={line.type === 'Dr' ? 'hover:bg-blue-50/30' : 'hover:bg-green-50/30'}>
                                    {li === 0 && (
                                      <TableCell rowSpan={vLines.length + 1} className="align-top pt-2">
                                        <div className="text-xs text-muted-foreground">{fmtDate(v.date)}</div>
                                        <Badge variant="outline" className={`mt-1 text-xs ${typeBadgeClass(v.type)}`}>
                                          {typeLabel(v.type)}
                                        </Badge>
                                        <div className="font-mono text-xs mt-1 text-muted-foreground">#{i + 1} {v.voucherNo}</div>
                                      </TableCell>
                                    )}
                                    <TableCell>
                                      <span className="font-semibold text-sm">{getAccountName(line.accountId)}</span>
                                      <span className={`ml-2 text-xs font-bold border rounded px-1 py-0.5 ${line.type === 'Dr' ? 'text-blue-600 border-blue-300' : 'text-green-600 border-green-300'}`}>{line.type}</span>
                                      {line.narration && <p className="text-xs text-muted-foreground italic mt-0.5">{line.narration}</p>}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-blue-700 text-sm">
                                      {line.type === 'Dr' ? fmt(line.amount) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-green-700 text-sm">
                                      {line.type === 'Cr' ? fmt(line.amount) : '—'}
                                    </TableCell>
                                    {li === 0 && (
                                      <TableCell rowSpan={vLines.length} className="text-center print:hidden align-middle">
                                        {/* Multi-line vouchers must be edited from the Vouchers page */}
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground cursor-not-allowed opacity-40" title={language === 'hi' ? 'Vouchers पेज से संपादित करें' : 'Edit from Vouchers page'} disabled>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                                {/* Narration row */}
                                <TableRow className="bg-muted/10">
                                  <TableCell colSpan={3} className="text-xs text-muted-foreground italic py-1">
                                    {v.narration}
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          }

                          // Legacy 2-line display
                          return (
                          <React.Fragment key={v.id}>
                            {/* Debit Row */}
                            <TableRow className="border-b-0 hover:bg-blue-50/30">
                              <TableCell className="align-top pt-2 pb-0">
                                <div className="text-xs text-muted-foreground">{fmtDate(v.date)}</div>
                                <Badge variant="outline" className={`mt-1 text-xs ${typeBadgeClass(v.type)}`}>
                                  {typeLabel(v.type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top pt-2 pb-0">
                                <span className="font-semibold text-sm text-foreground">
                                  {getAccountName(v.debitAccountId)}
                                </span>
                                <span className="ml-2 text-xs font-bold text-blue-600 border border-blue-300 rounded px-1 py-0.5">Dr.</span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-blue-700 align-top pt-2 pb-0 text-sm">
                                {fmt(v.amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground align-top pt-2 pb-0">—</TableCell>
                              <TableCell className="text-center print:hidden align-middle" rowSpan={2}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary hover:bg-primary/10"
                                  title={language === 'hi' ? 'संपादित करें' : 'Edit'}
                                  onClick={() => openEdit(v)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {/* Credit Row */}
                            <TableRow className="hover:bg-green-50/30">
                              <TableCell className="pt-0 pb-2 align-top">
                                <span className="font-mono text-xs text-muted-foreground">#{i + 1} {v.voucherNo}</span>
                              </TableCell>
                              <TableCell className="pt-0 pb-2">
                                <span className="pl-4 text-muted-foreground text-sm">
                                  {language === 'hi' ? 'जमा — ' : 'To — '}
                                </span>
                                <span className="font-semibold text-sm text-foreground">
                                  {getAccountName(v.creditAccountId)}
                                </span>
                                <span className="ml-2 text-xs font-bold text-green-600 border border-green-300 rounded px-1 py-0.5">Cr.</span>
                                {v.narration && (
                                  <p className="text-xs text-muted-foreground italic mt-0.5 pl-4">
                                    ({v.narration})
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground pt-0 pb-2">—</TableCell>
                              <TableCell className="text-right font-bold text-green-700 pt-0 pb-2 text-sm">
                                {fmt(v.amount)}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                          );
                        })}
                        {/* Day Total */}
                        <TableRow className="bg-primary/5 border-t-2 border-primary/30">
                          <TableCell colSpan={2} className="text-right font-bold text-primary text-xs py-2">
                            {language === 'hi' ? 'दिन का योग' : 'Day Total'}:
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary text-sm py-2">{fmt(dayTotal)}</TableCell>
                          <TableCell className="text-right font-bold text-primary text-sm py-2">{fmt(dayTotal)}</TableCell>
                          <TableCell className="no-print" />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Closing Balance for this day */}
                  <div className="bg-green-50 border-t border-green-200 px-4 py-2 flex flex-wrap gap-6 items-center">
                    <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                      {language === 'hi' ? 'अंतिम नकद शेष (Closing)' : 'Closing Cash Balance'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <Wallet className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-700">{language === 'hi' ? 'नकद (हाथ में)' : 'Cash in Hand'}:</span>
                      <span className="font-bold text-green-800 text-sm">{fmt(rb.closeCash)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-5 py-3 print:hidden">
              <span className="font-bold text-primary">
                {language === 'hi' ? 'कुल योग (सभी दिन)' : 'Grand Total (All Days)'}
              </span>
              <span className="font-bold text-primary text-xl">{fmt(entries.reduce((s, v) => s + v.amount, 0))}</span>
            </div>

            {/* Final Cash Balance */}
            <div className="no-print">
              <Card className="bg-card-cash/10 border-card-cash/20">
                <CardContent className="pt-4 pb-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === 'hi' ? 'अंतिम नकद शेष (Closing Cash Balance)' : 'Closing Cash Balance'}</p>
                      <p className="text-2xl font-bold">{fmt(cashCB)}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>{language === 'hi' ? 'प्रारंभिक' : 'Opening'}: <span className="font-semibold">{fmt(cashOB)}</span></p>
                    <p>{language === 'hi' ? 'अंतिम' : 'Closing'}: <span className="font-semibold text-foreground">{fmt(cashCB)}</span></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Voucher Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'वाउचर संपादित करें' : 'Edit Voucher'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{language === 'hi' ? 'तिथि' : 'Date'}</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>{language === 'hi' ? 'प्रकार' : 'Type'}</Label>
                <Select value={editType} onValueChange={v => setEditType(v as VoucherType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">{language === 'hi' ? 'रसीद' : 'Receipt'}</SelectItem>
                    <SelectItem value="payment">{language === 'hi' ? 'भुगतान' : 'Payment'}</SelectItem>
                    <SelectItem value="journal">{language === 'hi' ? 'जर्नल' : 'Journal'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-destructive font-bold">Dr.</span> {language === 'hi' ? 'नाम खाता' : 'Debit Account'}</Label>
              <Select value={editDebit} onValueChange={setEditDebit}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{language === 'hi' ? a.nameHi : a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-success font-bold">Cr.</span> {language === 'hi' ? 'जमा खाता' : 'Credit Account'}</Label>
              <Select value={editCredit} onValueChange={setEditCredit}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{language === 'hi' ? a.nameHi : a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}</Label>
              <Input
                type="number"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                min="1"
                className="h-10 text-lg font-bold text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{language === 'hi' ? 'विवरण' : 'Narration'}</Label>
              <Textarea
                value={editNarration}
                onChange={e => setEditNarration(e.target.value)}
                rows={2}
                placeholder={language === 'hi' ? 'विवरण...' : 'Narration...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="gap-1.5">
              <X className="h-4 w-4" />{language === 'hi' ? 'रद्द' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleEditSave} className="gap-1.5">
              <Save className="h-4 w-4" />{language === 'hi' ? 'सहेजें' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DayBook;
