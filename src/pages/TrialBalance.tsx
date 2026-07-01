import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Scale, Download, CheckCircle, AlertTriangle, Calendar, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateTrialBalancePDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';

const TrialBalance: React.FC = () => {
  const { t, language } = useLanguage();
  const { getTrialBalance, society } = useData();
  const navigate = useNavigate();
  // P1-5: Default to the last day of the selected FY (31 March), not today's date.
  const fyEndDate = (() => {
    const endYY = society.financialYear.split('-')[1];
    return `20${endYY}-03-31`;
  })();
  const [asOnDate, setAsOnDate] = useState(fyEndDate);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  // BUG-03 FIX: Pass asOnDate so trial balance filters vouchers up to that date.
  const allBalances = getTrialBalance(asOnDate);
  // Hide accounts with no activity and no opening balance.
  const balances = allBalances.filter(b => b.totalDebit > 0 || b.totalCredit > 0 || b.openingDebit > 0 || b.openingCredit > 0);

  // ── Audit C-6: NCDC Annexure-I two-section layout ────────────────────────
  // Section I = "Liabilities & Income" (credit-nature: liability, equity, income).
  // Section II = "Assets & Expenditure" (debit-nature: asset, expense).
  const sectionOf = (type: string): 'liabInc' | 'assetExp' =>
    (type === 'asset' || type === 'expense') ? 'assetExp' : 'liabInc';
  const liabIncRows = balances.filter(b => sectionOf(b.account.type) === 'liabInc');
  const assetExpRows = balances.filter(b => sectionOf(b.account.type) === 'assetExp');

  // Closing balance is signed: netBalance > 0 ⇒ Dr, < 0 ⇒ Cr.
  const closingDrOf = (b: typeof allBalances[number]) => Math.max(b.netBalance, 0);
  const closingCrOf = (b: typeof allBalances[number]) => Math.max(-b.netBalance, 0);

  // Per-section totals (movement during period + closing balances).
  const sectionTotals = (rows: typeof allBalances) => ({
    movDr: rows.reduce((s, b) => s + (b.transactionDebit || 0), 0),
    movCr: rows.reduce((s, b) => s + (b.transactionCredit || 0), 0),
    clDr: rows.reduce((s, b) => s + closingDrOf(b), 0),
    clCr: rows.reduce((s, b) => s + closingCrOf(b), 0),
  });

  const grandClosingDr = balances.reduce((s, b) => s + closingDrOf(b), 0);
  const grandClosingCr = balances.reduce((s, b) => s + closingCrOf(b), 0);
  const totalMovDr = balances.reduce((s, b) => s + (b.transactionDebit || 0), 0);
  const totalMovCr = balances.reduce((s, b) => s + (b.transactionCredit || 0), 0);
  // NCDC: a Trial Balance is balanced when total CLOSING Dr = total CLOSING Cr.
  const isBalanced = Math.abs(grandClosingDr - grandClosingCr) < 1;
  // Kept for the headline cards / PDF legacy balance line.
  const totalDebit = grandClosingDr;
  const totalCredit = grandClosingCr;

  const openingLabel = (b: typeof allBalances[number]) =>
    b.openingDebit > 0 ? `${b.openingDebit} Dr` : b.openingCredit > 0 ? `${b.openingCredit} Cr` : '';
  const closingLabel = (b: typeof allBalances[number]) =>
    b.netBalance > 0 ? `${b.netBalance} Dr` : b.netBalance < 0 ? `${-b.netBalance} Cr` : '';

  const exportHeaders = ['Section', 'Account Code', 'Account Name', 'Type', 'Opening', 'Debit (period)', 'Credit (period)', 'Closing'];
  const sectionExportRows = (rows: typeof allBalances, sectionLabel: string): (string | number)[][] =>
    rows.map(b => [
      sectionLabel,
      b.account.id,
      b.account.name,
      b.account.type,
      openingLabel(b),
      (b.transactionDebit || 0) > 0 ? b.transactionDebit : '',
      (b.transactionCredit || 0) > 0 ? b.transactionCredit : '',
      closingLabel(b),
    ]);
  const exportRows = (): (string | number)[][] => [
    ...sectionExportRows(liabIncRows, 'Liabilities & Income'),
    ...sectionExportRows(assetExpRows, 'Assets & Expenditure'),
  ];

  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `trial-balance-${society.financialYear}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `trial-balance-${society.financialYear}`, 'Trial Balance');

  // Render one NCDC section (header row + account rows + subtotal row).
  const renderSection = (
    rows: typeof allBalances,
    titleEn: string, titleHi: string,
    headerClass: string,
  ) => {
    const t2 = sectionTotals(rows);
    return (
      <>
        <TableRow className={headerClass}>
          <TableCell colSpan={6} className="font-bold uppercase text-sm tracking-wide">
            {language === 'hi' ? titleHi : titleEn}
          </TableCell>
        </TableRow>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-2">
              {language === 'hi' ? 'कोई खाता नहीं' : 'No accounts'}
            </TableCell>
          </TableRow>
        ) : rows.map((b, i) => (
          <TableRow key={b.account.id} className="hover:bg-muted/30">
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="font-medium">
              <button className="text-left hover:text-primary hover:underline" onClick={() => navigate(`/ledger?account=${b.account.id}`)} title={language === 'hi' ? 'खाता-बही खोलें' : 'Open ledger'}>
                {language === 'hi' ? b.account.nameHi : b.account.name}
              </button>
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {b.openingDebit > 0 ? <>{fmt(b.openingDebit)} <span className="text-[10px]">Dr</span></>
                : b.openingCredit > 0 ? <>{fmt(b.openingCredit)} <span className="text-[10px]">Cr</span></> : '—'}
            </TableCell>
            <TableCell className="text-right">{(b.transactionDebit || 0) > 0 ? fmt(b.transactionDebit) : '—'}</TableCell>
            <TableCell className="text-right">{(b.transactionCredit || 0) > 0 ? fmt(b.transactionCredit) : '—'}</TableCell>
            <TableCell className="text-right font-semibold">
              {b.netBalance > 0 ? <>{fmt(b.netBalance)} <span className="text-[10px] text-info">Dr</span></>
                : b.netBalance < 0 ? <>{fmt(-b.netBalance)} <span className="text-[10px] text-warning">Cr</span></> : '—'}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-semibold">
          <TableCell colSpan={2} className="text-right">
            {(language === 'hi' ? titleHi : titleEn)} — {language === 'hi' ? 'उप-योग' : 'Subtotal'}
          </TableCell>
          <TableCell className="text-right">—</TableCell>
          <TableCell className="text-right">{fmt(t2.movDr)}</TableCell>
          <TableCell className="text-right">{fmt(t2.movCr)}</TableCell>
          <TableCell className="text-right">
            {t2.clDr >= t2.clCr ? <>{fmt(t2.clDr - t2.clCr)} <span className="text-[10px] text-info">Dr</span></>
              : <>{fmt(t2.clCr - t2.clDr)} <span className="text-[10px] text-warning">Cr</span></>}
          </TableCell>
        </TableRow>
      </>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            {t('trialBalance')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'खातों का ट्रायल बैलेंस' : 'Trial Balance of Accounts'}</p>
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
        </div>
      </div>

      {isBalanced ? (
        <Alert className="bg-success/10 border-success/30">
          <CheckCircle className="h-5 w-5 text-success" />
          <AlertTitle className="text-success">{language === 'hi' ? 'ट्रायल बैलेंस संतुलित है' : 'Trial Balance is Balanced'}</AlertTitle>
          <AlertDescription>{language === 'hi' ? 'डेबिट और क्रेडिट बराबर हैं। खाते सही हैं।' : 'Debit and Credit totals match. Accounts are correct.'}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>{language === 'hi' ? 'ट्रायल बैलेंस असंतुलित है!' : 'Trial Balance is NOT Balanced!'}</AlertTitle>
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
            <CardTitle className="text-xl">{language === 'hi' ? 'ट्रायल बैलेंस' : 'Trial Balance'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{language === 'hi' ? society.nameHi : society.name}</p>
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'दिनांक' : 'As on'}: {fmtDate(asOnDate)}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground mb-2">
            {language === 'hi'
              ? 'NCDC अनुलग्नक-I प्रारूप: दो खंड — (I) देयताएं एवं आय, (II) संपत्ति एवं व्यय। समापन डेबिट = समापन क्रेडिट होने पर ट्रायल बैलेंस संतुलित है।'
              : 'NCDC Annexure-I format: two sections — (I) Liabilities & Income, (II) Assets & Expenditure. Balanced when total Closing Dr = total Closing Cr.'}
          </p>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold w-12">{language === 'hi' ? 'क्र.' : 'S.No.'}</TableHead>
                  <TableHead className="font-semibold">{language === 'hi' ? 'खाते का नाम' : 'Account Name'}</TableHead>
                  <TableHead className="font-semibold text-right">{language === 'hi' ? 'ओपनिंग बैलेंस' : 'Opening'}</TableHead>
                  <TableHead className="font-semibold text-right">{t('debit')} (₹)</TableHead>
                  <TableHead className="font-semibold text-right">{t('credit')} (₹)</TableHead>
                  <TableHead className="font-semibold text-right">{language === 'hi' ? 'क्लोज़िंग बैलेंस' : 'Closing'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection(liabIncRows, 'Section I — Liabilities & Income', 'खंड I — देयताएं एवं आय', 'bg-warning/10')}
                {renderSection(assetExpRows, 'Section II — Assets & Expenditure', 'खंड II — संपत्ति एवं व्यय', 'bg-info/10')}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/5 font-bold">
                  <TableCell colSpan={2} className="text-right">{language === 'hi' ? 'कुल (समापन)' : 'Grand Total (Closing)'}</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right text-primary">{fmt(totalMovDr)}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(totalMovCr)}</TableCell>
                  <TableCell className="text-right text-primary">
                    {fmt(grandClosingDr)} <span className="text-[10px]">Dr</span> = {fmt(grandClosingCr)} <span className="text-[10px]">Cr</span>
                  </TableCell>
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
