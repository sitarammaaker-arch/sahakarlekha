import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { getVoucherLines } from '@/lib/voucherUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BookOpen, Download, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { generateLedgerPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';

interface LedgerEntry {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: 'Dr' | 'Cr';
}

const Ledger: React.FC = () => {
  const { t, language } = useLanguage();
  const { accounts, vouchers, society } = useData();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(n);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const buildEntries = (lang: 'hi' | 'en'): LedgerEntry[] => {
    if (!selectedAccount) return [];

    const isDebitNature = selectedAccount.openingBalanceType === 'debit';
    let runningBalance = isDebitNature
      ? selectedAccount.openingBalance
      : -selectedAccount.openingBalance;

    // BUG-01 FIX: Use getVoucherLines() to support multi-line Expert Mode vouchers.
    // A voucher touches this account if ANY of its lines has this accountId.
    const accountVouchers = vouchers
      .filter(v => !v.isDeleted && getVoucherLines(v).some(l => l.accountId === selectedAccountId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      accountVouchers
        .filter(v => v.date < fromDate)
        .forEach(v => {
          getVoucherLines(v).forEach(l => {
            if (l.accountId === selectedAccountId) {
              runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
            }
          });
        });
    }

    const filtered = accountVouchers.filter(v => {
      if (fromDate && v.date < fromDate) return false;
      if (toDate && v.date > toDate) return false;
      return true;
    });

    const result: LedgerEntry[] = [];
    const obBalance = runningBalance;
    result.push({
      id: 'ob',
      date: fromDate || `${society.financialYear.split('-')[0]}-04-01`,
      voucherNo: 'OB',
      particulars: lang === 'hi' ? 'प्रारंभिक शेष' : 'Opening Balance',
      debit: obBalance >= 0 ? obBalance : 0,
      credit: obBalance < 0 ? Math.abs(obBalance) : 0,
      balance: Math.abs(obBalance),
      balanceType: obBalance >= 0 ? 'Dr' : 'Cr',
    });

    filtered.forEach(v => {
      const lines = getVoucherLines(v);
      // For each line that touches this account, create a separate ledger row
      lines.forEach((l, li) => {
        if (l.accountId !== selectedAccountId) return;
        const isDebit = l.type === 'Dr';
        runningBalance += isDebit ? l.amount : -l.amount;

        // "Particulars" = narration + other account names in this voucher
        const otherAccNames = lines
          .filter(ol => ol.accountId !== selectedAccountId)
          .map(ol => {
            const acc = accounts.find(a => a.id === ol.accountId);
            return lang === 'hi' ? (acc?.nameHi || acc?.name || ol.accountId) : (acc?.name || ol.accountId);
          })
          .join(', ');

        result.push({
          id: `${v.id}-${li}`,
          date: v.date,
          voucherNo: v.voucherNo,
          particulars: v.narration ? `${v.narration} (${otherAccNames})` : otherAccNames,
          debit: isDebit ? l.amount : 0,
          credit: !isDebit ? l.amount : 0,
          balance: Math.abs(runningBalance),
          balanceType: runningBalance >= 0 ? 'Dr' : 'Cr',
        });
      });
    });

    return result;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => buildEntries(language), [selectedAccount, selectedAccountId, vouchers, accounts, fromDate, toDate, language, society.financialYear]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closing = entries[entries.length - 1];

  const accountTypeBadge = (type: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      asset:     { label: language === 'hi' ? 'संपत्ति' : 'Asset',     cls: 'bg-blue-100 text-blue-700' },
      liability: { label: language === 'hi' ? 'देयता' : 'Liability',   cls: 'bg-yellow-100 text-yellow-700' },
      income:    { label: language === 'hi' ? 'आय' : 'Income',         cls: 'bg-green-100 text-green-700' },
      expense:   { label: language === 'hi' ? 'व्यय' : 'Expense',      cls: 'bg-red-100 text-red-700' },
    };
    return map[type] ?? { label: type, cls: '' };
  };

  // BUG-06 FIX: Exclude group/header accounts — only leaf accounts can have transactions.
  const grouped = [
    { label: language === 'hi' ? 'संपत्ति' : 'Assets',      items: accounts.filter(a => a.type === 'asset' && !a.isGroup) },
    { label: language === 'hi' ? 'देयता' : 'Liabilities',   items: accounts.filter(a => a.type === 'liability' && !a.isGroup) },
    { label: language === 'hi' ? 'पूंजी' : 'Equity',        items: accounts.filter(a => a.type === 'equity' && !a.isGroup) },
    { label: language === 'hi' ? 'आय' : 'Income',            items: accounts.filter(a => a.type === 'income' && !a.isGroup) },
    { label: language === 'hi' ? 'व्यय' : 'Expenses',       items: accounts.filter(a => a.type === 'expense' && !a.isGroup) },
  ];

  const handlePDF = () => {
    if (!selectedAccount) return;
    // Always use English entries for PDF — jsPDF doesn't support Devanagari
    const pdfEntries = buildEntries('en');
    generateLedgerPDF(pdfEntries, selectedAccount, society, 'en', fromDate, toDate);
  };

  const exportHeaders = ['Date', 'Voucher No.', 'Particulars', 'Debit', 'Credit', 'Balance'];

  const buildExportRows = () =>
    entries.map(e => [
      fmtDate(e.date),
      e.voucherNo,
      e.particulars,
      e.debit > 0 ? e.debit : null,
      e.credit > 0 ? e.credit : null,
      `${fmt(e.balance)} ${e.balanceType}`,
    ]);

  const handleCSV = () => {
    downloadCSV(exportHeaders, buildExportRows(), `ledger-${selectedAccount?.name || 'account'}`);
  };

  const handleExcel = () => {
    downloadExcelSingle(exportHeaders, buildExportRows(), `ledger-${selectedAccount?.name || 'account'}`, 'Ledger');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            {t('ledger')}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'खाता बही - विस्तृत खाता विवरण' : 'General Ledger — Detailed Account Statement'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handlePDF} variant="outline" size="sm" className="gap-2" disabled={!selectedAccount}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button onClick={handleExcel} variant="outline" size="sm" className="gap-2" disabled={!selectedAccount}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button onClick={handleCSV} variant="outline" size="sm" className="gap-2" disabled={!selectedAccount}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-52 space-y-1">
              <label className="text-sm font-medium">
                {language === 'hi' ? 'खाता चुनें' : 'Select Account'}
              </label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {grouped.map(g => g.items.length > 0 && (
                    <React.Fragment key={g.label}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                        {g.label}
                      </div>
                      {g.items.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {language === 'hi' ? a.nameHi : a.name}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{language === 'hi' ? 'से' : 'From'}</label>
                <Input type="date" className="w-36 h-9" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{language === 'hi' ? 'तक' : 'To'}</label>
                <Input type="date" className="w-36 h-9" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); }}>
                  {language === 'hi' ? 'साफ करें' : 'Clear'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Summary Card */}
      {selectedAccount && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {language === 'hi' ? selectedAccount.nameHi : selectedAccount.name}
                  </h2>
                  <Badge className={accountTypeBadge(selectedAccount.type).cls}>
                    {accountTypeBadge(selectedAccount.type).label}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-8 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">{t('debit')}</p>
                  <p className="text-lg font-bold text-red-600">Rs. {fmt(totalDebit)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">{t('credit')}</p>
                  <p className="text-lg font-bold text-green-600">Rs. {fmt(totalCredit)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">{language === 'hi' ? 'शेष' : 'Balance'}</p>
                  <p className="text-lg font-bold text-primary">
                    Rs. {closing ? fmt(closing.balance) : '0'} {closing?.balanceType}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledger Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">
            {language === 'hi' ? 'खाता विवरण' : 'Account Statement'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('voucherNo')}</TableHead>
                  <TableHead>{t('particulars')}</TableHead>
                  <TableHead className="text-right">{t('debit')} (Dr)</TableHead>
                  <TableHead className="text-right">{t('credit')} (Cr)</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'शेष' : 'Balance'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {language === 'hi' ? 'कोई प्रविष्टि नहीं मिली' : 'No entries found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {entries.map((entry, idx) => (
                      <TableRow
                        key={entry.id}
                        className={idx === 0 ? 'bg-blue-50/60 font-medium' : 'hover:bg-muted/30'}
                      >
                        <TableCell className="text-sm whitespace-nowrap">
                          {fmtDate(entry.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {entry.voucherNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.particulars}</TableCell>
                        <TableCell className="text-right text-sm">
                          {entry.debit > 0 && (
                            <span className="font-semibold text-red-600">
                              Rs. {fmt(entry.debit)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {entry.credit > 0 && (
                            <span className="font-semibold text-green-600">
                              Rs. {fmt(entry.credit)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm whitespace-nowrap">
                          Rs. {fmt(entry.balance)}{' '}
                          <span className="text-xs text-muted-foreground">{entry.balanceType}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-primary text-primary-foreground font-bold">
                      <TableCell colSpan={3} className="text-right">
                        {t('total')}
                      </TableCell>
                      <TableCell className="text-right">Rs. {fmt(totalDebit)}</TableCell>
                      <TableCell className="text-right">Rs. {fmt(totalCredit)}</TableCell>
                      <TableCell className="text-right">
                        Rs. {closing ? fmt(closing.balance) : '0'} {closing?.balanceType}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Ledger;
