import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Download, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateIncomeExpenditurePDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const RESERVE_FUND_RATE = 0.25; // 25% mandatory under Haryana Cooperative Societies Act 1984, Sec 65

const ProfitLoss: React.FC = () => {
  const { language } = useLanguage();
  const { getProfitLoss, society } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit } = getProfitLoss();
  const isSurplus = netProfit >= 0;

  // P5-2: Previous year comparison
  const pyIE = society.previousYearIE;
  const hasPY = !!pyIE && !!society.previousFinancialYear;
  const pyLabel = society.previousFinancialYear || '';
  const getPYIncome = (name: string) => pyIE?.incomeItems.find(i => i.name === name)?.amount ?? 0;
  const getPYExpense = (name: string) => pyIE?.expenseItems.find(i => i.name === name)?.amount ?? 0;

  const reserveFund = isSurplus ? Math.round(netProfit * RESERVE_FUND_RATE) : 0;
  const distributableSurplus = isSurplus ? netProfit - reserveFund : 0;

  const hi = language === 'hi';

  const exportHeaders = ['Type', 'Account Name', 'Amount (₹)'];
  const exportRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    incomeItems.forEach(item => rows.push(['Income', item.name, item.amount]));
    rows.push(['Income', 'Total Income', totalIncome]);
    expenseItems.forEach(item => rows.push(['Expense', item.name, item.amount]));
    if (isSurplus && netProfit > 0) {
      rows.push(['Expense', 'Statutory Reserve Fund (25%)', reserveFund]);
      rows.push(['Expense', 'Surplus (to Balance Sheet)', distributableSurplus]);
    } else if (!isSurplus) {
      rows.push(['Expense', 'Deficit (to Balance Sheet)', Math.abs(netProfit)]);
    }
    rows.push(['Expense', 'Total Expenditure', totalExpenses]);
    return rows;
  };

  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `profit-loss-${society.financialYear}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `profit-loss-${society.financialYear}`, 'Income & Expenditure');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-success" />
            {hi ? 'आय-व्यय खाता' : 'Income & Expenditure Account'}
          </h1>
          <p className="text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => generateIncomeExpenditurePDF(incomeItems, expenseItems, society, language, reserveFund)}
          >
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{hi ? 'कुल आय' : 'Total Income'}</p>
                <p className="text-2xl font-bold text-success">{fmt(totalIncome)}</p>
              </div>
              <ArrowDown className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{hi ? 'कुल व्यय' : 'Total Expenditure'}</p>
                <p className="text-2xl font-bold text-destructive">{fmt(totalExpenses)}</p>
              </div>
              <ArrowUp className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-2', isSurplus ? 'bg-success/20 border-success' : 'bg-destructive/20 border-destructive')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isSurplus
                    ? (hi ? 'अधिशेष (Surplus)' : 'Surplus')
                    : (hi ? 'घाटा (Deficit)' : 'Deficit')}
                </p>
                <p className={cn('text-2xl font-bold', isSurplus ? 'text-success' : 'text-destructive')}>
                  {fmt(Math.abs(netProfit))}
                </p>
              </div>
              {isSurplus
                ? <TrendingUp className="h-8 w-8 text-success/50" />
                : <TrendingDown className="h-8 w-8 text-destructive/50" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reserve Fund info banner */}
      {isSurplus && netProfit > 0 && (
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {hi
                ? `⚖️ हरियाणा सहकारी समिति अधिनियम 1984, धारा 65 के अनुसार: अधिशेष का न्यूनतम 25% वैधानिक संरक्षित निधि में हस्तांतरित करना अनिवार्य है।`
                : `⚖️ As per Haryana Cooperative Societies Act 1984, Sec 65: Minimum 25% of surplus must be transferred to Statutory Reserve Fund.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="font-medium">
                {hi ? 'वैधानिक संरक्षित निधि (25%)' : 'Statutory Reserve Fund (25%)'}:{' '}
                <strong className="text-amber-700 dark:text-amber-300">{fmt(reserveFund)}</strong>
              </span>
              <span className="font-medium">
                {hi ? 'वितरणयोग्य अधिशेष' : 'Distributable Surplus'}:{' '}
                <strong className="text-success">{fmt(distributableSurplus)}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* T-Account format */}
      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">
            {hi ? 'आय-व्यय खाता' : 'Income & Expenditure Account'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenditure — Left (Dr) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2 pb-2 border-b">
                <ArrowUp className="h-5 w-5" />
                {hi ? 'व्यय (Dr)' : 'Expenditure (Dr)'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyLabel}</TableHead>}
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasPY ? 3 : 2} className="text-center text-muted-foreground">
                        {hi ? 'कोई व्यय नहीं' : 'No expenses'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{hi ? item.nameHi : item.name}</TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{getPYExpense(item.name) ? fmt(getPYExpense(item.name)) : '—'}</TableCell>}
                        <TableCell className="text-right font-medium">{fmt(item.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Reserve Fund appropriation */}
                  {isSurplus && netProfit > 0 && (
                    <TableRow className="bg-amber-50 dark:bg-amber-900/20 font-medium">
                      <TableCell className="text-amber-700 dark:text-amber-300">
                        {hi ? 'वैधानिक संरक्षित निधि (25%) — To Balance Sheet' : 'Statutory Reserve Fund (25%) — To Balance Sheet'}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>}
                      <TableCell className="text-right text-amber-700 dark:text-amber-300">{fmt(reserveFund)}</TableCell>
                    </TableRow>
                  )}
                  {/* Surplus / Deficit row */}
                  {isSurplus ? (
                    <TableRow className="bg-success/10 font-semibold">
                      <TableCell className="text-success">
                        {hi ? 'अधिशेष (तुलन पत्र में)' : 'Surplus (to Balance Sheet)'}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyIE && pyIE.netProfit >= 0 ? fmt(pyIE.netProfit) : '—'}</TableCell>}
                      <TableCell className="text-right text-success">{fmt(distributableSurplus)}</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow className="bg-destructive/10 font-semibold">
                      <TableCell className="text-destructive">
                        {hi ? 'घाटा (तुलन पत्र में)' : 'Deficit (to Balance Sheet)'}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyIE && pyIE.netProfit < 0 ? fmt(Math.abs(pyIE.netProfit)) : '—'}</TableCell>}
                      <TableCell className="text-right text-destructive">{fmt(Math.abs(netProfit))}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted font-bold text-lg">
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{pyIE ? fmt(pyIE.totalIncome) : '—'}</TableCell>}
                    <TableCell className="text-right">{fmt(totalIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Income — Right (Cr) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-success flex items-center gap-2 pb-2 border-b">
                <ArrowDown className="h-5 w-5" />
                {hi ? 'आय (Cr)' : 'Income (Cr)'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyLabel}</TableHead>}
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasPY ? 3 : 2} className="text-center text-muted-foreground">
                        {hi ? 'कोई आय नहीं' : 'No income'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomeItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{hi ? item.nameHi : item.name}</TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{getPYIncome(item.name) ? fmt(getPYIncome(item.name)) : '—'}</TableCell>}
                        <TableCell className="text-right font-medium">{fmt(item.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-muted font-bold text-lg">
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{pyIE ? fmt(pyIE.totalIncome) : '—'}</TableCell>}
                    <TableCell className="text-right">{fmt(totalIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitLoss;
