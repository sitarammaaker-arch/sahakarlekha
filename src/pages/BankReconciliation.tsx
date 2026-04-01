import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Building2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_IDS } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';

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
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const TODAY = new Date().toISOString().split('T')[0];

const BankReconciliation: React.FC = () => {
  const { language } = useLanguage();
  const { vouchers, accounts, society, getAccountBalance, clearVoucher, unclearVoucher } = useData();
  const { toast } = useToast();

  const [asOfDate, setAsOfDate] = useState(TODAY);
  const [statementBalance, setStatementBalance] = useState<number | ''>('');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [autoMatched, setAutoMatched] = useState(0);

  const bankAccount = accounts.find(a => a.id === ACCOUNT_IDS.BANK);

  // Helper: sum of bank Dr/Cr line amounts for a voucher (supports multi-line Expert Mode vouchers)
  const bankDrAmt = (v: typeof vouchers[0]) =>
    getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.BANK && l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
  const bankCrAmt = (v: typeof vouchers[0]) =>
    getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.BANK && l.type === 'Cr').reduce((s, l) => s + l.amount, 0);

  // All active bank vouchers up to asOfDate
  const bankVouchers = useMemo(() => {
    return vouchers
      .filter(v =>
        !v.isDeleted &&
        v.date <= asOfDate &&
        getVoucherLines(v).some(l => l.accountId === ACCOUNT_IDS.BANK)
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
    const acct = accounts.find(a => a.id === ACCOUNT_IDS.BANK);
    if (!acct) return 0;
    let bal = acct.openingBalanceType === 'debit' ? acct.openingBalance : -acct.openingBalance;
    vouchers
      .filter(v => !v.isDeleted && v.date <= asOfDate &&
        getVoucherLines(v).some(l => l.accountId === ACCOUNT_IDS.BANK))
      .forEach(v => {
        getVoucherLines(v).forEach(l => {
          if (l.accountId !== ACCOUNT_IDS.BANK) return;
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
              <Input value={bankAccount?.name ?? '—'} readOnly className="bg-muted/50" />
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
                        l.accountId === ACCOUNT_IDS.BANK && l.type === (isDeposit ? 'Dr' : 'Cr')
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
        </CardContent>
      </Card>

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
                      {v.narration || getVoucherLines(v).filter(l => l.accountId !== ACCOUNT_IDS.BANK && l.type === 'Cr').map(l => getAccountName(l.accountId)).join(', ')}
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
                      {v.narration || getVoucherLines(v).filter(l => l.accountId !== ACCOUNT_IDS.BANK && l.type === 'Dr').map(l => getAccountName(l.accountId)).join(', ')}
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
                  const isDeposit = getVoucherLines(v).some(l => l.accountId === ACCOUNT_IDS.BANK && l.type === 'Dr');
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
                        {v.narration || getVoucherLines(v).filter(l => l.accountId !== ACCOUNT_IDS.BANK && l.type === (isDeposit ? 'Cr' : 'Dr')).map(l => getAccountName(l.accountId)).join(', ')}
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
