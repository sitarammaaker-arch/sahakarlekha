import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { ACCOUNT_IDS } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Building2, Download, Printer, CreditCard, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateBankBookPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const BankBook: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { accounts, addVoucher, getBankBookEntries, getAccountBalance, society } = useData();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [otherAccount, setOtherAccount] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNarration, setEntryNarration] = useState('');

  const bankAccount = accounts.find(a => a.id === ACCOUNT_IDS.BANK);
  const openingBalance = bankAccount?.openingBalance || 0;
  const entries = getBankBookEntries();
  const bankBalance = getAccountBalance(ACCOUNT_IDS.BANK);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const totalDeposits = entries.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0);
  const totalWithdrawals = entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0);

  const nonBankAccounts = accounts.filter(a => !a.isGroup && a.id !== ACCOUNT_IDS.BANK && a.id !== ACCOUNT_IDS.CASH);

  const exportHeaders = ['Date', 'Voucher No.', 'Particulars', 'Receipt (Dr)', 'Payment (Cr)', 'Balance'];

  const buildExportRows = () => {
    const rows: (string | number | null)[][] = [];
    rows.push(['Opening', 'OB', 'Opening Balance', openingBalance, null, openingBalance]);
    entries.forEach(entry => {
      rows.push([
        fmtDate(entry.date),
        entry.voucherNo,
        entry.particulars,
        entry.type === 'deposit' ? entry.amount : null,
        entry.type === 'withdrawal' ? entry.amount : null,
        entry.runningBalance,
      ]);
    });
    rows.push(['Total', '', '', totalDeposits, totalWithdrawals, bankBalance]);
    return rows;
  };

  const handleCSV = () => {
    downloadCSV(exportHeaders, buildExportRows(), `bank-book-${society.financialYear}`);
  };

  const handleExcel = () => {
    downloadExcelSingle(exportHeaders, buildExportRows(), `bank-book-${society.financialYear}`, 'Bank Book');
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherAccount || !entryAmount || Number(entryAmount) <= 0) {
      toast({ title: language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    addVoucher({
      type: entryType === 'deposit' ? 'receipt' : 'payment',
      date: entryDate,
      debitAccountId: entryType === 'deposit' ? ACCOUNT_IDS.BANK : otherAccount,
      creditAccountId: entryType === 'deposit' ? otherAccount : ACCOUNT_IDS.BANK,
      amount: Number(entryAmount),
      narration: entryNarration,
      createdBy: user?.name || 'System',
    });
    toast({ title: language === 'hi' ? 'प्रविष्टि सहेजी गई' : 'Entry saved' });
    setOtherAccount('');
    setEntryAmount('');
    setEntryNarration('');
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-info" />
            {t('bankBook')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'बैंक खाता लेनदेन का विवरण' : 'Bank account transactions record'}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => generateBankBookPDF(entries, society, openingBalance, language)}>
              <Download className="h-4 w-4" />PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
              <FileSpreadsheet className="h-4 w-4" />Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
              <FileSpreadsheet className="h-4 w-4" />CSV
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />{t('print')}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{language === 'hi' ? 'नई प्रविष्टि' : 'New Entry'}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{language === 'hi' ? 'नई बैंक प्रविष्टि' : 'New Bank Entry'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('date')}</Label>
                    <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'प्रकार' : 'Type'}</Label>
                    <Select value={entryType} onValueChange={(v) => setEntryType(v as 'deposit' | 'withdrawal')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">{language === 'hi' ? 'जमा' : 'Deposit'}</SelectItem>
                        <SelectItem value="withdrawal">{language === 'hi' ? 'निकासी' : 'Withdrawal'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'दूसरा खाता' : 'Other Account'}</Label>
                  <Select value={otherAccount} onValueChange={setOtherAccount} required>
                    <SelectTrigger><SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                    <SelectContent>
                      {nonBankAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{language === 'hi' ? a.nameHi : a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('amount')} (₹)</Label>
                  <Input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} placeholder="0" min="1" required />
                </div>
                <div className="space-y-2">
                  <Label>{t('narration')}</Label>
                  <Textarea value={entryNarration} onChange={e => setEntryNarration(e.target.value)} placeholder={language === 'hi' ? 'विवरण लिखें...' : 'Enter details...'} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('cancel')}</Button>
                  <Button type="submit">{t('save')}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bank Card */}
      <Card className="ring-2 ring-primary">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-info" />
              </div>
              <div>
                <h3 className="font-semibold">{language === 'hi' ? bankAccount?.nameHi : bankAccount?.name}</h3>
                <p className="text-sm text-muted-foreground">{society.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t('balance')}</p>
              <p className="text-xl font-bold text-info">{fmt(bankBalance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल जमा' : 'Total Deposits'}</p>
            <p className="text-2xl font-bold text-success">{fmt(totalDeposits)}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल निकासी' : 'Total Withdrawals'}</p>
            <p className="text-2xl font-bold text-destructive">{fmt(totalWithdrawals)}</p>
          </CardContent>
        </Card>
        <Card className="bg-info/10 border-info/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('closingBalance')}</p>
            <p className="text-2xl font-bold text-info">{fmt(bankBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{language === 'hi' ? 'बैंक बही विवरण' : 'Bank Book Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">{t('date')}</TableHead>
                  <TableHead className="font-semibold">{t('voucherNo')}</TableHead>
                  <TableHead className="font-semibold">{t('particulars')}</TableHead>
                  <TableHead className="font-semibold text-right">{language === 'hi' ? 'जमा' : 'Deposit'}</TableHead>
                  <TableHead className="font-semibold text-right">{language === 'hi' ? 'निकासी' : 'Withdrawal'}</TableHead>
                  <TableHead className="font-semibold text-right">{t('balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/20">
                  <TableCell className="font-medium">{language === 'hi' ? 'प्रारंभ' : 'Opening'}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">OB</Badge></TableCell>
                  <TableCell>{t('openingBalance')}</TableCell>
                  <TableCell className="text-right text-success font-semibold">{fmt(openingBalance)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold">{fmt(openingBalance)}</TableCell>
                </TableRow>
                {entries.map(entry => (
                  <TableRow key={entry.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{fmtDate(entry.date)}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{entry.voucherNo}</Badge></TableCell>
                    <TableCell>{entry.particulars}</TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'deposit' && <span className="text-success font-semibold">{fmt(entry.amount)}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'withdrawal' && <span className="text-destructive font-semibold">{fmt(entry.amount)}</span>}
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmt(entry.runningBalance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-bold">
                  <TableCell colSpan={3} className="text-right">{t('total')}:</TableCell>
                  <TableCell className="text-right text-success">{fmt(totalDeposits)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(totalWithdrawals)}</TableCell>
                  <TableCell className="text-right text-info">{fmt(bankBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankBook;
