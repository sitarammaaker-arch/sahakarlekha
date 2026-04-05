/**
 * Balance Sheet — Grouped Audit Format
 * Groups: Share Capital, Reserves, Current Liabilities, Loans | Fixed Assets, Investments, Current Assets, Inventory
 * Each group shows sub-total in "Grand" column, child accounts indented with individual amounts
 * Previous Year column shows per-account and per-group values
 */
import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, AlertTriangle } from 'lucide-react';
import { generateBalanceSheetPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import type { AccountBalance } from '@/types';

interface BSGroup {
  id: string;
  name: string;
  nameHi: string;
  items: { account: AccountBalance; displayAmount: number; pyAmount: number }[];
  grandTotal: number;
  pyGrandTotal: number;
}

const BalanceSheet: React.FC = () => {
  const { t, language } = useLanguage();
  const { getTrialBalance, getProfitLoss, getTradingAccount, society, accounts } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const trialBalance = getTrialBalance();
  const { netProfit } = getProfitLoss();
  const { physicalClosingStock, closingStockPosted } = getTradingAccount();
  const unpostedStock = !closingStockPosted && physicalClosingStock > 0 ? physicalClosingStock : 0;

  const RESERVE_FUND_RATE = (society.reserveFundPct ?? 25) / 100;
  const reserveFund = netProfit > 0 ? Math.round(netProfit * RESERVE_FUND_RATE) : 0;

  const pyBalances = society.previousYearBalances || {};
  const pyYear = society.previousFinancialYear || '';
  const hasPY = !!pyYear && Object.keys(pyBalances).length > 0;
  const getPY = (id: string) => pyBalances[id] ?? 0;

  // Build grouped structure
  const buildGroups = (
    parentIds: string[], // top-level group IDs (e.g., ['1000', '2000'] for liabilities)
    signFlip: boolean,   // true for equity/liability (credit-nature → flip to positive)
  ): BSGroup[] => {
    // Find sub-groups under these parents
    const subGroups = accounts.filter(a => a.isGroup && parentIds.includes(a.parentId || ''));

    return subGroups.map(group => {
      // Find leaf accounts under this group (direct children + children of sub-sub-groups)
      const childIds = new Set<string>();
      // Direct children
      accounts.filter(a => !a.isGroup && a.parentId === group.id).forEach(a => childIds.add(a.id));
      // Sub-sub-groups (e.g., 2200 Statutory Liabilities under 2000)
      const subSubGroups = accounts.filter(a => a.isGroup && a.parentId === group.id);
      subSubGroups.forEach(ssg => {
        accounts.filter(a => !a.isGroup && a.parentId === ssg.id).forEach(a => childIds.add(a.id));
      });

      const items = trialBalance
        .filter(b => childIds.has(b.account.id))
        .filter(b => b.netBalance !== 0 || getPY(b.account.id) !== 0)
        .map(b => ({
          account: b,
          displayAmount: signFlip ? -b.netBalance : b.netBalance,
          pyAmount: getPY(b.account.id),
        }));

      const grandTotal = items.reduce((s, i) => s + i.displayAmount, 0);
      const pyGrandTotal = items.reduce((s, i) => s + i.pyAmount, 0);

      return {
        id: group.id,
        name: group.name,
        nameHi: group.nameHi || group.name,
        items,
        grandTotal,
        pyGrandTotal,
      };
    }).filter(g => g.items.length > 0 || g.grandTotal !== 0);
  };

  // Liability side groups (equity + liability)
  const liabilityGroups = useMemo(() => buildGroups(['1000', '2000'], true), [trialBalance, accounts, pyBalances]);

  // Asset side groups
  const assetGroups = useMemo(() => buildGroups(['3000'], false), [trialBalance, accounts, pyBalances]);

  // Totals
  const totalLiabilities = useMemo(() =>
    liabilityGroups.reduce((s, g) => s + g.grandTotal, 0) + netProfit
  , [liabilityGroups, netProfit]);

  const totalAssets = useMemo(() =>
    assetGroups.reduce((s, g) => s + g.grandTotal, 0) + unpostedStock
  , [assetGroups, unpostedStock]);

  const pyTotalLiab = liabilityGroups.reduce((s, g) => s + g.pyGrandTotal, 0);
  const pyTotalAsset = assetGroups.reduce((s, g) => s + g.pyGrandTotal, 0);

  // Export
  const exportHeaders = ['Section', 'Group', 'Particulars', 'Amount (Rs.)', 'Grand'];
  const exportRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    liabilityGroups.forEach(g => {
      rows.push(['Capital & Liabilities', g.name, '', '', g.grandTotal]);
      g.items.forEach(i => rows.push(['', '', i.account.account.name, i.displayAmount, '']));
    });
    if (netProfit !== 0) rows.push(['Capital & Liabilities', 'Profit & Loss A/c', netProfit >= 0 ? 'Net Profit' : 'Net Loss', Math.abs(netProfit), '']);
    rows.push(['Capital & Liabilities', '', 'GRAND TOTAL', totalLiabilities, totalLiabilities]);
    assetGroups.forEach(g => {
      rows.push(['Assets', g.name, '', '', g.grandTotal]);
      g.items.forEach(i => rows.push(['', '', i.account.account.name, i.displayAmount, '']));
    });
    rows.push(['Assets', '', 'GRAND TOTAL', totalAssets, totalAssets]);
    return rows;
  };

  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `balance-sheet-${society.financialYear}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `balance-sheet-${society.financialYear}`, 'Balance Sheet');

  const handlePDF = () => {
    const diff = Math.abs(totalLiabilities - totalAssets);
    if (diff >= 1) {
      toast({
        title: hi ? 'तुलन पत्र असंतुलित है' : 'Balance Sheet is not balanced',
        description: hi ? `अंतर: Rs. ${diff.toFixed(0)}` : `Difference: Rs. ${diff.toFixed(0)}`,
        variant: 'destructive',
      });
      return;
    }
    generateBalanceSheetPDF(
      trialBalance.filter(b => b.account.type === 'asset' && !b.account.isGroup),
      [...trialBalance.filter(b => b.account.type === 'equity' && !b.account.isGroup), ...trialBalance.filter(b => b.account.type === 'liability' && !b.account.isGroup)],
      netProfit, society, language, reserveFund, accounts
    );
  };

  // Render a grouped side (liabilities or assets)
  const renderSide = (groups: BSGroup[], sideLabel: string, sideLabelHi: string, total: number, pyTotal: number, isLiabSide: boolean) => (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-primary pb-2 border-b">
        {hi ? sideLabelHi : sideLabel}
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            {hasPY && <TableHead className="text-right text-muted-foreground text-xs w-24">{pyYear}</TableHead>}
            <TableHead>{t('particulars')}</TableHead>
            <TableHead className="text-right w-28">{hi ? 'राशि' : 'Amount'}</TableHead>
            <TableHead className="text-right w-28">{hi ? 'कुल योग' : 'Grand'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map(group => (
            <React.Fragment key={group.id}>
              {/* Group Header */}
              <TableRow className="bg-primary/5 font-bold">
                {hasPY && <TableCell className="text-right text-muted-foreground">{group.pyGrandTotal !== 0 ? fmt(group.pyGrandTotal) : ''}</TableCell>}
                <TableCell className="font-bold uppercase text-sm">
                  {hi ? group.nameHi : group.name}
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold">{fmt(group.grandTotal)}</TableCell>
              </TableRow>
              {/* Child accounts */}
              {group.items.map(({ account: b, displayAmount, pyAmount }) => {
                const isContra = (isLiabSide && displayAmount < 0) || (!isLiabSide && displayAmount < 0);
                return (
                  <TableRow key={b.account.id} className="hover:bg-muted/30">
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyAmount !== 0 ? fmt(pyAmount) : '—'}</TableCell>}
                    <TableCell className="pl-6 text-sm">
                      {hi ? b.account.nameHi : b.account.name}
                      {isContra && <span className="ml-1 text-xs text-destructive">(Dr)</span>}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${isContra ? 'text-destructive' : ''}`}>
                      {isContra ? `(${fmt(Math.abs(displayAmount))})` : fmt(displayAmount)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}

          {/* Profit & Loss (Liabilities side only) */}
          {isLiabSide && netProfit !== 0 && (
            <TableRow className={netProfit > 0 ? 'bg-success/10 font-bold' : 'bg-destructive/10 font-bold'}>
              {hasPY && <TableCell></TableCell>}
              <TableCell className={`font-bold uppercase text-sm ${netProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                {hi ? 'लाभ-हानि खाता' : 'Profit & Loss A/c'}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className={`text-right font-bold ${netProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                {netProfit < 0 ? `(${fmt(Math.abs(netProfit))})` : fmt(netProfit)}
              </TableCell>
            </TableRow>
          )}

          {/* Unposted Closing Stock (Assets side only) */}
          {!isLiabSide && unpostedStock > 0 && (
            <TableRow className="bg-amber-50 dark:bg-amber-900/20 font-semibold">
              {hasPY && <TableCell></TableCell>}
              <TableCell className="text-amber-800 dark:text-amber-300 text-sm">
                {hi ? 'समापन माल (भौतिक — जर्नल नहीं हुआ) ⚠' : 'Closing Stock (Physical — Not Yet Journalized) ⚠'}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right text-amber-800 dark:text-amber-300">{fmt(unpostedStock)}</TableCell>
            </TableRow>
          )}

          {/* GRAND TOTAL */}
          <TableRow className="bg-primary/15 font-bold text-base border-t-2 border-primary">
            {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(pyTotal)}</TableCell>}
            <TableCell className="font-bold">{hi ? 'कुल योग' : 'GRAND TOTAL'}</TableCell>
            <TableCell className="text-right font-bold text-primary">{fmt(total)}</TableCell>
            <TableCell className="text-right font-bold text-primary">{fmt(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            {t('balanceSheet')}
          </h1>
          <p className="text-muted-foreground">{hi ? 'तुलन पत्र - वित्तीय स्थिति विवरण' : 'Statement of Financial Position'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}><Download className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
        </div>
      </div>

      {unpostedStock > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {hi ? 'समापन माल अभी जर्नल में दर्ज नहीं हुआ' : 'Closing Stock Not Yet Journalized'}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {hi
                ? `भौतिक समापन माल ${fmt(unpostedStock)} है। Trading Account पर "Post Closing Stock" बटन दबाएं।`
                : `Physical closing stock of ${fmt(unpostedStock)}. Go to Trading Account and click "Post Closing Stock".`}
            </p>
          </div>
        </div>
      )}

      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">{hi ? 'तुलन पत्र' : 'Balance Sheet'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi ? `31 मार्च ${society.financialYear.split('-')[1]} को` : `As at 31st March 20${society.financialYear.split('-')[1]}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderSide(liabilityGroups, 'Capital & Liabilities', 'पूंजी एवं देयताएं', totalLiabilities, pyTotalLiab, true)}
            {renderSide(assetGroups, 'Assets', 'संपत्तियां', totalAssets, pyTotalAsset, false)}
          </div>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground mb-2">{hi ? 'सत्यापन' : 'Verification'}</p>
            <div className="flex justify-center gap-8 flex-wrap">
              <div>
                <span className="text-muted-foreground">{hi ? 'कुल देयताएं' : 'Total Liabilities'}:</span>{' '}
                <span className="font-bold">{fmt(totalLiabilities)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{hi ? 'कुल संपत्तियां' : 'Total Assets'}:</span>{' '}
                <span className="font-bold">{fmt(totalAssets)}</span>
              </div>
              <div className={Math.abs(totalLiabilities - totalAssets) < 1 ? 'text-success' : 'text-destructive'}>
                <span className="font-bold">
                  {Math.abs(totalLiabilities - totalAssets) < 1
                    ? (hi ? '✓ संतुलित' : '✓ Balanced')
                    : (hi ? '✗ असंतुलित' : '✗ Not Balanced')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
            {[hi ? 'लेखाकार' : 'Accountant', hi ? 'सचिव' : 'Secretary', hi ? 'अध्यक्ष' : 'Chairman'].map(label => (
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
