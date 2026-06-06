import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Download, ArrowUp, ArrowDown, FileSpreadsheet, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateIncomeExpenditurePDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { getVoucherLines } from '@/lib/voucherUtils';

// Appropriation account IDs (must match ReserveFund.tsx)
const ACC_NET_SURPLUS = '1208';   // Net Surplus / (Deficit)
const ACC_RESERVE_FUND = '1201';  // Statutory Reserve Fund
const ACC_EDUCATION_FUND = '1203';// Education Fund

const ProfitLoss: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { getProfitLoss, society, vouchers } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  // Bound the I&E to the financial-year end (31 March) so vouchers mis-dated into
  // the NEXT FY don't leak into this year's surplus — keeps the I&E consistent
  // with the Trial Balance / Balance Sheet (which are read as-on the FY end).
  const fyEndDate = `20${society.financialYear.split('-')[1]}-03-31`;
  const { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit } = getProfitLoss(fyEndDate);
  const isSurplus = netProfit >= 0;
  const grandTotal = isSurplus ? totalIncome : totalExpenses;

  // P5-2: Previous year comparison
  const pyIE = society.previousYearIE;
  const hasPY = !!pyIE && !!society.previousFinancialYear;
  const pyLabel = society.previousFinancialYear || '';
  const getPYIncome = (name: string) => pyIE?.incomeItems.find(i => i.name === name)?.amount ?? 0;
  const getPYExpense = (name: string) => pyIE?.expenseItems.find(i => i.name === name)?.amount ?? 0;

  // ── Audit C-10: read ACTUAL journalled appropriations, not hardcoded 25% ────
  // NCDC principle (l): appropriation of surplus is SEPARATE from the P&L/I&E.
  // The I&E shows the full Net Surplus; reserve/education/dividend transfers are
  // posted as journals (Dr 1208 Net Surplus / Cr 1201/1203) on the Reserve Fund
  // page and are read here from the ledger — never computed inline.
  const fyPostedAppropriation = (creditAcc: string): number =>
    vouchers
      .filter(v => !v.isDeleted && v.narration?.includes(society.financialYear))
      .reduce((sum, v) => {
        const lines = getVoucherLines(v);
        const hasNetSurplusDr = lines.some(l => l.accountId === ACC_NET_SURPLUS && l.type === 'Dr');
        if (!hasNetSurplusDr) return sum;
        const crLine = lines.find(l => l.accountId === creditAcc && l.type === 'Cr');
        return sum + (crLine?.amount || 0);
      }, 0);

  const postedReserve = fyPostedAppropriation(ACC_RESERVE_FUND);
  const postedEducation = fyPostedAppropriation(ACC_EDUCATION_FUND);
  const totalAppropriated = postedReserve + postedEducation;
  const undistributedSurplus = isSurplus ? netProfit - totalAppropriated : netProfit;
  const appropriationPending = isSurplus && netProfit > 0 && totalAppropriated < 0.01;

  // Indicative statutory amounts (for the pending prompt only — NOT posted to books)
  const RESERVE_FUND_RATE = (society.reserveFundPct ?? 25) / 100;
  const indicativeReserve = isSurplus ? Math.round(netProfit * RESERVE_FUND_RATE) : 0;
  const indicativeEducation = isSurplus ? Math.round(netProfit * 0.01) : 0;

  const hi = language === 'hi';

  const exportHeaders = ['Type', 'Account Name', 'Amount (₹)'];
  const exportRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    incomeItems.forEach(item => rows.push(['Income', item.name, item.amount]));
    rows.push(['Income', 'Total Income', totalIncome]);
    expenseItems.forEach(item => rows.push(['Expense', item.name, item.amount]));
    // NCDC: full Net Surplus/Deficit goes to the Balance Sheet; appropriation is separate.
    if (isSurplus) {
      rows.push(['Expense', 'Net Surplus (to Balance Sheet)', netProfit]);
    } else {
      rows.push(['Expense', 'Net Deficit (to Balance Sheet)', Math.abs(netProfit)]);
    }
    rows.push(['Expense', 'Total Expenditure', totalExpenses]);
    // Separate Appropriation section — actual posted amounts (read from ledger).
    if (totalAppropriated > 0.01) {
      rows.push(['Appropriation', 'Statutory Reserve Fund (posted)', postedReserve]);
      rows.push(['Appropriation', 'Education Fund (posted)', postedEducation]);
      rows.push(['Appropriation', 'Undistributed Surplus c/d', undistributedSurplus]);
    }
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
            onClick={() => generateIncomeExpenditurePDF(incomeItems, expenseItems, society, language, postedReserve)}
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

      {/* Appropriation of Surplus — SEPARATE from the I&E (NCDC principle l).
          Reads ACTUAL journalled reserve/education transfers from the ledger. */}
      {isSurplus && netProfit > 0 && (
        appropriationPending ? (
          <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {hi
                  ? `⚖️ अधिशेष का आवंटन अभी पोस्ट नहीं हुआ (वैकल्पिक)। आप "संचय निधि" पृष्ठ पर संचय/शिक्षा निधि में कोई भी % या राशि चुनकर आवंटित कर सकते हैं। नीचे केवल सामान्य सुझाव (25%/1%) दिखाया गया है।`
                  : `⚖️ Surplus appropriation not yet posted (optional). On the Reserve Fund page you can allocate any % or amount to Reserve/Education funds. The figures below are only the common suggestion (25%/1%).`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium">
                  {hi ? 'अनुमानित संचय निधि (25%)' : 'Indicative Reserve (25%)'}:{' '}
                  <strong className="text-amber-700 dark:text-amber-300">{fmt(indicativeReserve)}</strong>
                </span>
                <span className="font-medium">
                  {hi ? 'अनुमानित शिक्षा निधि (1%)' : 'Indicative Education (1%)'}:{' '}
                  <strong className="text-amber-700 dark:text-amber-300">{fmt(indicativeEducation)}</strong>
                </span>
                <Button size="sm" className="ml-auto gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => navigate('/reserve-fund')}>
                  <Shield className="h-4 w-4" />
                  {hi ? 'आवंटन पोस्ट करें' : 'Post Appropriation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {hi ? 'लाभ-हानि विनियोजन खाता (Appropriation A/c) — ledger में पोस्ट' : 'Profit & Loss Appropriation Account — posted to ledger'}
              </p>
              {/* Formal appropriation account: Net Surplus less statutory transfers = balance c/d. */}
              <div className="mt-2 max-w-md text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{hi ? 'वर्ष का शुद्ध अधिशेष' : 'Net Surplus for the year'}</span>
                  <strong>{fmt(netProfit)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{hi ? 'घटाएँ: वैधानिक संचय निधि (1201)' : 'Less: Statutory Reserve Fund (1201)'}</span>
                  <span className="text-green-700 dark:text-green-300">({fmt(postedReserve)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{hi ? 'घटाएँ: शिक्षा निधि (1203)' : 'Less: Education Fund (1203)'}</span>
                  <span className="text-green-700 dark:text-green-300">({fmt(postedEducation)})</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{hi ? 'अवितरित अधिशेष c/d (तुलन पत्र में)' : 'Undistributed Surplus c/d (to Balance Sheet)'}</span>
                  <strong className="text-success">{fmt(undistributedSurplus)}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        )
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
                  {/* Net Surplus / Deficit row — FULL surplus to Balance Sheet.
                      Appropriation (reserve/education) is shown SEPARATELY below,
                      per NCDC principle (l), and posted as journals — not deducted here. */}
                  {isSurplus ? (
                    <TableRow className="bg-success/10 font-semibold">
                      <TableCell className="text-success">
                        {hi ? 'शुद्ध अधिशेष (तुलन पत्र में)' : 'Net Surplus (to Balance Sheet)'}
                      </TableCell>
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyIE && pyIE.netProfit >= 0 ? fmt(pyIE.netProfit) : '—'}</TableCell>}
                      <TableCell className="text-right text-success">{fmt(netProfit)}</TableCell>
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
                    <TableCell className="text-right">{fmt(grandTotal)}</TableCell>
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
                    <TableCell className="text-right">{fmt(grandTotal)}</TableCell>
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
