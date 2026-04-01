import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Scale, Download, Printer, CheckCircle, AlertTriangle, Calendar, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateTrialBalancePDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';

const TrialBalance: React.FC = () => {
  const { t, language } = useLanguage();
  const { getTrialBalance, society } = useData();
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split('T')[0]);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  // BUG-03 FIX: Pass asOnDate so trial balance filters vouchers up to that date.
  const allBalances = getTrialBalance(asOnDate);
  // Hide accounts with no activity (both Dr and Cr are zero)
  const balances = allBalances.filter(b => b.totalDebit > 0 || b.totalCredit > 0);
  const totalDebit = allBalances.reduce((s, b) => s + b.totalDebit, 0);
  const totalCredit = allBalances.reduce((s, b) => s + b.totalCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const exportHeaders = ['Account Code', 'Account Name', 'Type', 'Debit (Dr)', 'Credit (Cr)'];
  const exportRows = () => balances.map(b => [
    b.account.id,
    b.account.name,
    b.account.type,
    b.totalDebit > 0 ? b.totalDebit : '',
    b.totalCredit > 0 ? b.totalCredit : '',
  ] as (string | number)[]);

  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `trial-balance-${society.financialYear}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `trial-balance-${society.financialYear}`, 'Trial Balance');

  const typeBadge = (type: string) => {
    const cfg: Record<string, { label: string; labelHi: string; className: string }> = {
      asset: { label: 'Asset', labelHi: 'संपत्ति', className: 'bg-info/20 text-info' },
      liability: { label: 'Liability', labelHi: 'देयता', className: 'bg-warning/20 text-warning' },
      income: { label: 'Income', labelHi: 'आय', className: 'bg-success/20 text-success' },
      expense: { label: 'Expense', labelHi: 'व्यय', className: 'bg-destructive/20 text-destructive' },
    };
    return cfg[type] || { label: type, labelHi: type, className: '' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            {t('trialBalance')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'खातों का तलपट' : 'Trial Balance of Accounts'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateTrialBalancePDF(balances, society, asOnDate, language)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />{t('print')}
          </Button>
        </div>
      </div>

      {isBalanced ? (
        <Alert className="bg-success/10 border-success/30">
          <CheckCircle className="h-5 w-5 text-success" />
          <AlertTitle className="text-success">{language === 'hi' ? 'तलपट संतुलित है' : 'Trial Balance is Balanced'}</AlertTitle>
          <AlertDescription>{language === 'hi' ? 'डेबिट और क्रेडिट बराबर हैं। खाते सही हैं।' : 'Debit and Credit totals match. Accounts are correct.'}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>{language === 'hi' ? 'तलपट असंतुलित है!' : 'Trial Balance is NOT Balanced!'}</AlertTitle>
          <AlertDescription>
            {language === 'hi' ? `अंतर: ${fmt(Math.abs(totalDebit - totalCredit))}` : `Difference: ${fmt(Math.abs(totalDebit - totalCredit))}`}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{language === 'hi' ? 'दिनांक तक' : 'As on Date'}:</span>
              <Input type="date" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} className="w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="border-b">
          <div className="text-center">
            <CardTitle className="text-xl">{language === 'hi' ? 'तलपट' : 'Trial Balance'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{language === 'hi' ? society.nameHi : society.name}</p>
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'दिनांक' : 'As on'}: {fmtDate(asOnDate)}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold w-12">{language === 'hi' ? 'क्र.' : 'S.No.'}</TableHead>
                  <TableHead className="font-semibold">{language === 'hi' ? 'खाते का नाम' : 'Account Name'}</TableHead>
                  <TableHead className="font-semibold">{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead className="font-semibold text-right">{t('debit')} (₹)</TableHead>
                  <TableHead className="font-semibold text-right">{t('credit')} (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b, i) => {
                  const badge = typeBadge(b.account.type);
                  return (
                    <TableRow key={b.account.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{language === 'hi' ? b.account.nameHi : b.account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {language === 'hi' ? badge.labelHi : badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {b.totalDebit > 0 && <span className="font-semibold">{fmt(b.totalDebit)}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.totalCredit > 0 && <span className="font-semibold">{fmt(b.totalCredit)}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/5 font-bold text-lg">
                  <TableCell colSpan={3} className="text-right">{t('total')}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(totalDebit)}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(totalCredit)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल डेबिट' : 'Total Debit'}</p>
                <p className="text-2xl font-bold text-destructive">{fmt(totalDebit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-success/20">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल क्रेडिट' : 'Total Credit'}</p>
                <p className="text-2xl font-bold text-success">{fmt(totalCredit)}</p>
              </CardContent>
            </Card>
            <Card className={cn('border-2', isBalanced ? 'bg-success/10 border-success' : 'bg-destructive/10 border-destructive')}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">{language === 'hi' ? 'अंतर' : 'Difference'}</p>
                <p className={cn('text-2xl font-bold', isBalanced ? 'text-success' : 'text-destructive')}>
                  {fmt(Math.abs(totalDebit - totalCredit))}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialBalance;
