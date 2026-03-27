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
import { Plus, Wallet, Calendar, Filter, Download, Printer, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCashBookPDF } from '@/lib/pdf';

const CashBook: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { accounts, addVoucher, getCashBookEntries, getAccountBalance, society } = useData();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<'receipt' | 'payment'>('receipt');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [otherAccount, setOtherAccount] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNarration, setEntryNarration] = useState('');

  const openingBalance = accounts.find(a => a.id === ACCOUNT_IDS.CASH)?.openingBalance || 0;
  const entries = getCashBookEntries(appliedFrom || undefined, appliedTo || undefined);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const totalReceipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);
  const totalPayments = entries.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const closingBalance = getAccountBalance(ACCOUNT_IDS.CASH);

  const nonCashAccounts = accounts.filter(a => !a.isGroup && a.id !== ACCOUNT_IDS.CASH && a.id !== ACCOUNT_IDS.BANK);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherAccount || !entryAmount || Number(entryAmount) <= 0) {
      toast({ title: language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    addVoucher({
      type: entryType === 'receipt' ? 'receipt' : 'payment',
      date: entryDate,
      debitAccountId: entryType === 'receipt' ? ACCOUNT_IDS.CASH : otherAccount,
      creditAccountId: entryType === 'receipt' ? otherAccount : ACCOUNT_IDS.CASH,
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

  const handlePDF = () => {
    generateCashBookPDF(entries, society, openingBalance, language);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            {t('cashBook')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'दैनिक नकद लेनदेन का विवरण' : 'Daily cash transactions record'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />{t('print')}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{language === 'hi' ? 'नई प्रविष्टि' : 'New Entry'}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{language === 'hi' ? 'नई नकद प्रविष्टि' : 'New Cash Entry'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('date')}</Label>
                    <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'प्रकार' : 'Type'}</Label>
                    <Select value={entryType} onValueChange={(v) => setEntryType(v as 'receipt' | 'payment')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receipt">{t('receipt')}</SelectItem>
                        <SelectItem value="payment">{t('payment')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'दूसरा खाता' : 'Other Account'}</Label>
                  <Select value={otherAccount} onValueChange={setOtherAccount} required>
                    <SelectTrigger><SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                    <SelectContent>
                      {nonCashAccounts.map(a => (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल जमा' : 'Total Receipts'}</p>
                <p className="text-2xl font-bold text-success">{fmt(totalReceipts)}</p>
              </div>
              <ArrowDownLeft className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल भुगतान' : 'Total Payments'}</p>
                <p className="text-2xl font-bold text-destructive">{fmt(totalPayments)}</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('closingBalance')}</p>
                <p className="text-2xl font-bold text-primary">{fmt(closingBalance)}</p>
              </div>
              <Wallet className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">{t('fromDate')}:</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">{t('toDate')}:</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" className="gap-2" onClick={() => { setAppliedFrom(fromDate); setAppliedTo(toDate); }}>
              <Filter className="h-4 w-4" />{language === 'hi' ? 'फ़िल्टर करें' : 'Apply Filter'}
            </Button>
            {(appliedFrom || appliedTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo(''); }}>
                {language === 'hi' ? 'साफ़ करें' : 'Clear'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">{language === 'hi' ? 'नकद बही विवरण' : 'Cash Book Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">{t('date')}</TableHead>
                  <TableHead className="font-semibold">{t('voucherNo')}</TableHead>
                  <TableHead className="font-semibold">{t('particulars')}</TableHead>
                  <TableHead className="font-semibold text-right">{t('receipt')} (जमा)</TableHead>
                  <TableHead className="font-semibold text-right">{t('payment')} (नाम)</TableHead>
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
                    <TableCell className="font-medium">{new Date(entry.date).toLocaleDateString('hi-IN')}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{entry.voucherNo}</Badge></TableCell>
                    <TableCell>{entry.particulars}</TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'receipt' && <span className="text-success font-semibold">{fmt(entry.amount)}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'payment' && <span className="text-destructive font-semibold">{fmt(entry.amount)}</span>}
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmt(entry.runningBalance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-bold">
                  <TableCell colSpan={3} className="text-right">{t('total')}:</TableCell>
                  <TableCell className="text-right text-success">{fmt(totalReceipts)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(totalPayments)}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashBook;
