import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, Printer } from 'lucide-react';
import { generateBalanceSheetPDF } from '@/lib/pdf';

const BalanceSheet: React.FC = () => {
  const { t, language } = useLanguage();
  const { getTrialBalance, getProfitLoss, society } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const trialBalance = getTrialBalance();
  const { netProfit } = getProfitLoss();

  const RESERVE_FUND_RATE = 0.25;
  const reserveFund = netProfit > 0 ? Math.round(netProfit * RESERVE_FUND_RATE) : 0;
  const distributableSurplus = netProfit > 0 ? netProfit - reserveFund : 0;

  const assetBalances = trialBalance.filter(b => b.account.type === 'asset' && !b.account.isGroup);
  // Capital & Liabilities side = equity + liability accounts (both right-side of BS)
  const equityBalances = trialBalance.filter(b => b.account.type === 'equity' && !b.account.isGroup);
  const liabilityBalances = trialBalance.filter(b => b.account.type === 'liability' && !b.account.isGroup);
  const capitalAndLiabilityBalances = [...equityBalances, ...liabilityBalances];

  // For display: hide zero-balance accounts (previous year values also considered)
  const pyBalancesRaw = society.previousYearBalances || {};
  const visibleAssets = assetBalances.filter(b => b.netBalance !== 0 || (pyBalancesRaw[b.account.id] ?? 0) !== 0);
  const visibleCapLiab = capitalAndLiabilityBalances.filter(b => b.netBalance !== 0 || (pyBalancesRaw[b.account.id] ?? 0) !== 0);

  // Use signed netBalance: positive = Dr balance (normal), negative = Cr balance (abnormal/contra)
  const totalAssets = assetBalances.reduce((s, b) => s + b.netBalance, 0);
  const totalLiabilities = capitalAndLiabilityBalances.reduce((s, b) => s + Math.abs(b.netBalance), 0)
    + netProfit; // surplus adds, deficit subtracts (negative value)

  const pyBalances = pyBalancesRaw;
  const pyYear = society.previousFinancialYear || '';
  const hasPY = pyYear && Object.keys(pyBalances).length > 0;
  const getPY = (accountId: string) => pyBalances[accountId] ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            {t('balanceSheet')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'तुलन पत्र - वित्तीय स्थिति विवरण' : 'Statement of Financial Position'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateBalanceSheetPDF(assetBalances, capitalAndLiabilityBalances, netProfit, society, language, reserveFund)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />{t('print')}
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">{language === 'hi' ? 'तुलन पत्र' : 'Balance Sheet'}</CardTitle>
          <p className="text-sm text-muted-foreground">{language === 'hi' ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {language === 'hi' ? `31 मार्च ${society.financialYear.split('-')[1]} को` : `As at 31st March 20${society.financialYear.split('-')[1]}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liabilities */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary pb-2 border-b">
                {language === 'hi' ? 'पूंजी एवं देयताएं' : 'Capital & Liabilities'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('particulars')}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyYear}</TableHead>}
                    <TableHead className="text-right">{society.financialYear}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCapLiab.map(b => (
                    <TableRow key={b.account.id} className="hover:bg-muted/30">
                      <TableCell>{language === 'hi' ? b.account.nameHi : b.account.name}</TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground">{getPY(b.account.id) ? fmt(getPY(b.account.id)) : '—'}</TableCell>}
                      <TableCell className="text-right font-medium">{fmt(Math.abs(b.netBalance))}</TableCell>
                    </TableRow>
                  ))}
                  {netProfit > 0 && (
                    <>
                      <TableRow className="bg-amber-50 dark:bg-amber-900/20">
                        <TableCell className="text-amber-700 dark:text-amber-300 font-medium">
                          {language === 'hi' ? 'वैधानिक संरक्षित निधि — 25% (चालू वर्ष)' : 'Statutory Reserve Fund — 25% (Current Year)'}
                        </TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground">—</TableCell>}
                        <TableCell className="text-right font-medium text-amber-700 dark:text-amber-300">{fmt(reserveFund)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-success/10">
                        <TableCell className="text-success font-medium">
                          {language === 'hi' ? 'वितरणयोग्य अधिशेष (चालू वर्ष)' : 'Distributable Surplus (Current Year)'}
                        </TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground">—</TableCell>}
                        <TableCell className="text-right font-medium text-success">{fmt(distributableSurplus)}</TableCell>
                      </TableRow>
                    </>
                  )}
                  {netProfit < 0 && (
                    <TableRow className="bg-destructive/10">
                      <TableCell className="text-destructive font-medium">
                        {language === 'hi' ? 'घाटा (चालू वर्ष)' : 'Deficit (Current Year)'}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground">—</TableCell>}
                      <TableCell className="text-right font-medium text-destructive">({fmt(Math.abs(netProfit))})</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-primary/10 font-bold text-lg">
                    <TableCell>{t('total')}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(liabilityBalances.reduce((s, b) => s + getPY(b.account.id), 0))}</TableCell>}
                    <TableCell className="text-right text-primary">{fmt(totalLiabilities)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Assets */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary pb-2 border-b">
                {language === 'hi' ? 'संपत्तियां' : 'Assets'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('particulars')}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyYear}</TableHead>}
                    <TableHead className="text-right">{society.financialYear}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAssets.map(b => (
                    <TableRow key={b.account.id} className="hover:bg-muted/30">
                      <TableCell>
                        {language === 'hi' ? b.account.nameHi : b.account.name}
                        {b.netBalance < 0 && <span className="ml-1 text-xs text-destructive">(Cr)</span>}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground">{getPY(b.account.id) ? fmt(getPY(b.account.id)) : '—'}</TableCell>}
                      <TableCell className={`text-right font-medium ${b.netBalance < 0 ? 'text-destructive' : ''}`}>
                        {b.netBalance < 0 ? `(${fmt(Math.abs(b.netBalance))})` : fmt(b.netBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold text-lg">
                    <TableCell>{t('total')}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(assetBalances.reduce((s, b) => s + getPY(b.account.id), 0))}</TableCell>}
                    <TableCell className="text-right text-primary">{fmt(totalAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground mb-2">{language === 'hi' ? 'सत्यापन' : 'Verification'}</p>
            <div className="flex justify-center gap-8 flex-wrap">
              <div>
                <span className="text-muted-foreground">{language === 'hi' ? 'कुल देयताएं' : 'Total Liabilities'}:</span>{' '}
                <span className="font-bold">{fmt(totalLiabilities)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{language === 'hi' ? 'कुल संपत्तियां' : 'Total Assets'}:</span>{' '}
                <span className="font-bold">{fmt(totalAssets)}</span>
              </div>
              <div className={Math.abs(totalLiabilities - totalAssets) < 1 ? 'text-success' : 'text-destructive'}>
                <span className="font-bold">
                  {Math.abs(totalLiabilities - totalAssets) < 1
                    ? (language === 'hi' ? '✓ संतुलित' : '✓ Balanced')
                    : (language === 'hi' ? '✗ असंतुलित' : '✗ Not Balanced')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
            {[
              language === 'hi' ? 'लेखाकार' : 'Accountant',
              language === 'hi' ? 'सचिव' : 'Secretary',
              language === 'hi' ? 'अध्यक्ष' : 'Chairman',
            ].map(label => (
              <div key={label}>
                <div className="h-16 border-b border-dashed border-muted-foreground/30 mb-2" />
                <p className="font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BalanceSheet;
