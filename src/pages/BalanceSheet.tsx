/**
 * Balance Sheet — Grouped Audit Format
 * Groups: Share Capital, Reserves, Current Liabilities, Loans | Fixed Assets, Investments, Current Assets, Inventory
 * Each group shows sub-total in "Grand" column, child accounts indented with individual amounts
 * Previous Year column shows per-account and per-group values
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, Calendar, ExternalLink } from 'lucide-react';
import { generateBalanceSheetPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { isEmptyPeriod } from '@/lib/reportComparative';
import { useToast } from '@/hooks/use-toast';
import type { AccountBalance } from '@/types';

interface BSItem {
  account: AccountBalance;
  displayAmount: number;
  pyAmount: number;
  indent?: number;        // 0 = direct child, 1 = under a nested sub-group
  isSubHeader?: boolean;  // a nested sub-group heading row (displayAmount = its sub-total)
}

interface BSGroup {
  id: string;
  name: string;
  nameHi: string;
  items: BSItem[];
  grandTotal: number;
  pyGrandTotal: number;
}

const BalanceSheet: React.FC = () => {
  const { t, language } = useLanguage();
  const { getTrialBalance, getProfitLoss, getTradingAccount, society, accounts, stockItems } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const hi = language === 'hi';

  // As-on-date (default: FY end = 31st March)
  const fyEndDate = `20${society.financialYear.split('-')[1]}-03-31`;
  const [asOnDate, setAsOnDate] = useState(fyEndDate);
  // Detail level: Summary (default) shows groups/sub-groups with totals and hides
  // the long lists of individual ledgers; Detailed expands every account.
  const [showLedgers, setShowLedgers] = useState(false);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  // BS-tie fix: net profit and trading MUST be bounded to the SAME as-on date as
  // the balances. Calling getProfitLoss()/getTradingAccount() without asOnDate
  // counted vouchers dated AFTER the as-on date (e.g. a fee posted in the next
  // FY) into net profit while the asset/cash side — correctly date-filtered —
  // excluded the matching receipt, throwing the sheet out by that amount.
  const trialBalance = getTrialBalance(asOnDate);
  const { netProfit } = getProfitLoss(asOnDate);
  const { physicalClosingStock, closingStockPosted } = getTradingAccount(asOnDate);
  const unpostedStock = !closingStockPosted && physicalClosingStock > 0 ? physicalClosingStock : 0;

  // Audit C-10: the Balance Sheet reads the ACTUAL journalled Statutory Reserve
  // Fund (1201) balance via the equity group below — it never re-computes a
  // hardcoded 25% of net profit. Reserve appropriation is posted on the Reserve
  // Fund page (Dr 1208 / Cr 1201) and flows in naturally as an equity balance.

  // ECR-19: the prior-year column is now COMPUTED from actual data — the balance
  // sheet position as at the prior FY end (getTrialBalance for the day before FY
  // start) — instead of a manual snapshot. Same debit-positive convention as the
  // snapshot (so the column's meaning is unchanged); falls back to the saved
  // snapshot when the dataset carries no prior-period figures.
  // Prior FY end = 31 March of the FIRST year of the current FY (e.g. FY 2026-27
  // → 2026-03-31). Derived from the FY string — the same robust approach as
  // fyEndDate above. NEVER parse society.financialYearStart with new Date(): it
  // can be missing or non-ISO and threw "Invalid time value" (crashed the page).
  const fyFirstYear = (society.financialYear || '').split('-')[0];
  const priorEndDate = /^\d{4}$/.test(fyFirstYear) ? `${fyFirstYear}-03-31` : '';
  const pyComputed: Record<string, number> = {};
  if (priorEndDate) {
    getTrialBalance(priorEndDate).forEach(b => { if (!b.account.isGroup) pyComputed[b.account.id] = b.netBalance; });
  }
  const usingComputedPY = !isEmptyPeriod(pyComputed);
  const pyBalances = usingComputedPY ? pyComputed : (society.previousYearBalances || {});
  const [fyA, fyB] = (society.financialYear || '').split('-');
  const computedPyLabel = fyA && fyB ? `${Number(fyA) - 1}-${String(Number(fyB) - 1).padStart(2, '0')}` : '';
  const pyYear = usingComputedPY ? computedPyLabel : (society.previousFinancialYear || '');
  const hasPY = !!pyYear && Object.keys(pyBalances).length > 0;
  const getPY = (id: string) => pyBalances[id] ?? 0;

  // All leaf balances by type (same as original flat BS)
  const allEquityLeaf = trialBalance.filter(b => b.account.type === 'equity' && !b.account.isGroup);
  const allLiabilityLeaf = trialBalance.filter(b => b.account.type === 'liability' && !b.account.isGroup);
  const allCapLiabLeaf = [...allEquityLeaf, ...allLiabilityLeaf];
  const allAssetLeaf = trialBalance.filter(b => b.account.type === 'asset' && !b.account.isGroup);
  // When the closing-stock journal is NOT posted but inventory items DO carry a physical
  // closing stock, the Inventory ledger (group 3400) still shows the stale OPENING stock
  // (already consumed into gross profit). In that case drop the 3400 leaves and show the
  // real closing stock once via the injected "Closing Stock (from Inventory)" row
  // (= physicalClosingStock), else the sheet carried BOTH opening and closing stock and
  // was out by the opening amount (Audit #3).
  // BUT when there are no inventory items (unpostedStock === 0), the 3400 ledger balance
  // IS the closing stock (opening == closing, nothing moved) and nothing gets injected to
  // replace it — so KEEP the 3400 leaves, else the sheet drops the stock and is out of
  // balance by that amount (RULE 2: BS closing stock must match the Trading A/c, which
  // reads the same 3400 ledger balance).
  const assetLeaves = (closingStockPosted || unpostedStock === 0)
    ? allAssetLeaf
    : allAssetLeaf.filter(b => b.account.id !== '3400' && b.account.parentId !== '3400');

  // Original total calculations (guaranteed correct — same as old flat BS)
  const totalAssets = assetLeaves.reduce((s, b) => s + b.netBalance, 0) + unpostedStock;
  const totalLiabilities = allCapLiabLeaf.reduce((s, b) => s + (-b.netBalance), 0) + netProfit;

  // ── Balance health diagnostic ──────────────────────────────────────────────
  // When the sheet doesn't tie, the root cause is almost always a ledger that
  // itself doesn't balance: opening balances entered with Dr ≠ Cr, or a legacy
  // voucher posted before Dr=Cr enforcement. Surface the exact gap so the user
  // can fix the SOURCE (Society Setup → Opening Balances) instead of guessing.
  const isBalanced = Math.abs(totalLiabilities - totalAssets) < 1;
  const sumOpenDr = trialBalance.reduce((s, b) => s + (b.openingDebit || 0), 0);
  const sumOpenCr = trialBalance.reduce((s, b) => s + (b.openingCredit || 0), 0);
  const sumTxnDr = trialBalance.reduce((s, b) => s + (b.transactionDebit || 0), 0);
  const sumTxnCr = trialBalance.reduce((s, b) => s + (b.transactionCredit || 0), 0);
  const openingGap = sumOpenDr - sumOpenCr;   // ≠ 0 ⇒ opening balances don't tie
  const txnGap = sumTxnDr - sumTxnCr;          // ≠ 0 ⇒ a legacy unbalanced voucher

  // Build grouped structure for display
  const buildGroups = (
    balances: AccountBalance[],
    topParentIds: string[],
    signFlip: boolean,
  ): BSGroup[] => {
    const subGroups = accounts.filter(a => a.isGroup && topParentIds.includes(a.parentId || ''));
    const capturedIds = new Set<string>();

    const nonZero = (b: AccountBalance) => b.netBalance !== 0 || getPY(b.account.id) !== 0;
    const mkLeaf = (b: AccountBalance, indent: number): BSItem => {
      capturedIds.add(b.account.id);
      return { account: b, displayAmount: signFlip ? -b.netBalance : b.netBalance, pyAmount: signFlip ? -getPY(b.account.id) : getPY(b.account.id), indent };
    };

    // Recursively build rows for a group to ANY depth: direct leaves at `depth`,
    // then each nested sub-group as a heading (with its rolled-up subtotal)
    // followed by its own sub-tree at depth+1. Preserves the full hierarchy
    // (group → sub-group → sub-sub-group → … → ledger) instead of flattening it.
    const buildRows = (parentId: string, depth: number): BSItem[] => {
      const out: BSItem[] = [];
      balances
        .filter(b => b.account.parentId === parentId && !b.account.isGroup && nonZero(b))
        .forEach(b => out.push(mkLeaf(b, depth)));
      accounts.filter(a => a.isGroup && a.parentId === parentId).forEach(ssg => {
        const subRows = buildRows(ssg.id, depth + 1);
        const leaves = subRows.filter(r => !r.isSubHeader);
        if (leaves.length === 0) return;
        out.push({
          account: { account: { id: `subgrp-${ssg.id}`, name: ssg.name, nameHi: ssg.nameHi, type: ssg.type } } as any,
          displayAmount: leaves.reduce((s, r) => s + r.displayAmount, 0),
          pyAmount: leaves.reduce((s, r) => s + r.pyAmount, 0),
          isSubHeader: true, indent: depth,
        });
        out.push(...subRows);
      });
      return out;
    };

    const groups = subGroups.map(group => {
      const items: BSItem[] = buildRows(group.id, 0);

      // Audit-friendly group names
      const auditNames: Record<string, { en: string; hi: string }> = {
        '3400': { en: 'Closing Stock', hi: 'समापन माल' },
        '3300': { en: 'Current Assets & Cash/Bank', hi: 'चालू संपत्ति एवं नकद/बैंक' },
      };
      const displayName = auditNames[group.id]?.en || group.name;
      const displayNameHi = auditNames[group.id]?.hi || group.nameHi || group.name;

      // NOTE: Closing stock is NOT rendered here from currentStock. It is shown
      // once, movement-based (RULE 2), via the injected "Closing Stock (from
      // Inventory)" row (unpostedStock) when no journal is posted, or via the
      // 3400 ledger leaves when a journal IS posted. Rendering it from
      // currentStock here caused a double-count and a second (wrong) formula.

      // Grand total sums LEAVES only — sub-header rows already carry their leaves'
      // subtotal, so counting both would double the nested sub-group's amount.
      const leafItems = items.filter(i => !i.isSubHeader);
      return {
        id: group.id, name: displayName, nameHi: displayNameHi,
        items, grandTotal: leafItems.reduce((s, i) => s + i.displayAmount, 0),
        pyGrandTotal: leafItems.reduce((s, i) => s + i.pyAmount, 0),
      };
    }).filter(g => g.items.length > 0);

    // Catch orphaned accounts not captured by any group
    const orphans = balances
      .filter(b => !capturedIds.has(b.account.id) && (b.netBalance !== 0 || getPY(b.account.id) !== 0))
      .map(b => ({ account: b, displayAmount: signFlip ? -b.netBalance : b.netBalance, pyAmount: signFlip ? -getPY(b.account.id) : getPY(b.account.id) }));

    if (orphans.length > 0) {
      groups.push({
        id: 'other', name: 'Other', nameHi: 'अन्य',
        items: orphans,
        grandTotal: orphans.reduce((s, i) => s + i.displayAmount, 0),
        pyGrandTotal: orphans.reduce((s, i) => s + i.pyAmount, 0),
      });
    }

    return groups;
  };

  const liabilityGroups = useMemo(() => buildGroups(allCapLiabLeaf, ['1000', '2000'], true), [trialBalance, accounts, pyBalances]);
  const assetGroups = useMemo(() => buildGroups(assetLeaves, ['3000'], false), [trialBalance, accounts, pyBalances, closingStockPosted]);

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
        title: hi ? 'बैलेंस शीट असंतुलित है' : 'Balance Sheet is not balanced',
        description: hi ? `अंतर: Rs. ${diff.toFixed(0)}` : `Difference: Rs. ${diff.toFixed(0)}`,
        variant: 'destructive',
      });
      return;
    }
    generateBalanceSheetPDF(
      assetLeaves,
      [...trialBalance.filter(b => b.account.type === 'equity' && !b.account.isGroup), ...trialBalance.filter(b => b.account.type === 'liability' && !b.account.isGroup)],
      netProfit, society, language, 0, accounts, stockItems, showLedgers, unpostedStock
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
            {hasPY && <TableHead className="text-right text-muted-foreground text-xs w-24" title={usingComputedPY ? (hi ? 'डेटा से गणना (पिछले FY अंत)' : 'Computed from data (prior FY end)') : (hi ? 'सहेजा गया स्नैपशॉट' : 'Saved snapshot')}>{pyYear}{usingComputedPY ? ' *' : ''}</TableHead>}
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
                <TableCell className={`text-right font-bold ${group.grandTotal < 0 ? 'text-destructive' : ''}`}>
                  {group.grandTotal < 0 ? `(${fmt(Math.abs(group.grandTotal))})` : fmt(group.grandTotal)}
                </TableCell>
              </TableRow>
              {/* Child accounts (with nested sub-group headings) */}
              {group.items.map(({ account: b, displayAmount, pyAmount, indent, isSubHeader }) => {
                const isNegative = displayAmount < 0;
                const contraLabel = isLiabSide ? '(Dr)' : '(Cr)';

                // Indent grows with nesting depth (works for any number of levels).
                const padLeft = `${1.5 + (indent || 0) * 1.25}rem`;

                // Nested sub-group heading row (e.g. "Market Supplier Chakan") with its subtotal.
                if (isSubHeader) {
                  return (
                    <TableRow key={b.account.id} className="bg-muted/30">
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyAmount !== 0 ? fmt(pyAmount) : '—'}</TableCell>}
                      <TableCell className="text-sm font-semibold" style={{ paddingLeft: padLeft }}>{hi ? b.account.nameHi : b.account.name}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {isNegative ? `(${fmt(Math.abs(displayAmount))})` : fmt(displayAmount)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                }

                // Summary mode: hide individual ledgers — those nested inside a
                // sub-group, and the long catch-all "Other" list — keeping only
                // group/sub-group totals and the few direct group lines.
                if (!showLedgers && ((indent || 0) >= 1 || group.id === 'other')) return null;

                return (
                  <TableRow key={b.account.id} className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/ledger?account=${b.account.id}`)}
                    title={hi ? 'लेजर देखें' : 'View Ledger'}
                  >
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{pyAmount !== 0 ? fmt(pyAmount) : '—'}</TableCell>}
                    <TableCell className="text-sm group" style={{ paddingLeft: padLeft }}>
                      <span className="group-hover:text-primary group-hover:underline">
                        {hi ? b.account.nameHi : b.account.name}
                      </span>
                      {isNegative && <span className="ml-1 text-xs text-muted-foreground">{contraLabel}</span>}
                      <ExternalLink className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50 text-muted-foreground" />
                    </TableCell>
                    <TableCell className={`text-right text-sm ${isNegative ? 'text-muted-foreground' : ''}`}>
                      {isNegative ? `(${fmt(Math.abs(displayAmount))})` : fmt(displayAmount)}
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
                {hi ? 'प्रॉफ़िट एंड लॉस खाता' : 'Profit & Loss A/c'}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className={`text-right font-bold ${netProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                {netProfit < 0 ? `(${fmt(Math.abs(netProfit))})` : fmt(netProfit)}
              </TableCell>
            </TableRow>
          )}

          {/* Closing Stock — auto-valued from inventory at the as-on date (Tally-style) */}
          {!isLiabSide && unpostedStock > 0 && (
            <TableRow className="font-semibold">
              {hasPY && <TableCell></TableCell>}
              <TableCell className="text-sm">
                {hi ? 'समापन माल (इन्वेंट्री से)' : 'Closing Stock (from Inventory)'}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">{fmt(unpostedStock)}</TableCell>
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
          <p className="text-muted-foreground">{hi ? 'बैलेंस शीट - वित्तीय स्थिति विवरण' : 'Statement of Financial Position'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}><Download className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
        </div>
      </div>

      {/* As-on-date picker */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">{hi ? 'दिनांक तक' : 'As on Date'}:</Label>
            <Input type="date" value={asOnDate} onChange={e => setAsOnDate(e.target.value)} className="w-44 h-8 text-sm" />
            {asOnDate !== fyEndDate && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setAsOnDate(fyEndDate)}>
                {hi ? 'FY अंत पर रीसेट' : 'Reset to FY End'}
              </Button>
            )}
            {asOnDate !== fyEndDate && (
              <span className="text-xs text-amber-600 font-medium">
                {hi ? '⚠ अंतरिम बैलेंस शीट' : '⚠ Interim Balance Sheet'}
              </span>
            )}
            {/* Summary ⇄ Detailed: collapse the long ledger lists into group totals. */}
            <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
              <Button
                variant={showLedgers ? 'ghost' : 'default'} size="sm" className="h-7 text-xs"
                onClick={() => setShowLedgers(false)}
              >
                {hi ? 'सारांश' : 'Summary'}
              </Button>
              <Button
                variant={showLedgers ? 'default' : 'ghost'} size="sm" className="h-7 text-xs"
                onClick={() => setShowLedgers(true)}
              >
                {hi ? 'पूर्ण विवरण' : 'Full detail'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {hi
              ? 'सारांश: समूह/उप-समूह केवल कुल योग के साथ (व्यक्तिगत खाते छिपे)। पूर्ण विवरण: हर खाता दिखे।'
              : 'Summary: groups/sub-groups with totals only (individual ledgers hidden). Full detail: every account.'}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">{hi ? 'बैलेंस शीट' : 'Balance Sheet'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi ? `${fmtDate(asOnDate)} को` : `As at ${fmtDate(asOnDate)}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderSide(liabilityGroups, 'Capital & Liabilities', 'कैपिटल एवं लायबिलिटीज़', totalLiabilities, pyTotalLiab, true)}
            {renderSide(assetGroups, 'Assets', 'संपत्तियां', totalAssets, pyTotalAsset, false)}
          </div>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground mb-2">{hi ? 'सत्यापन' : 'Verification'}</p>
            <div className="flex justify-center gap-8 flex-wrap">
              <div>
                <span className="text-muted-foreground">{hi ? 'कुल लायबिलिटीज़' : 'Total Liabilities'}:</span>{' '}
                <span className="font-bold">{fmt(totalLiabilities)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{hi ? 'कुल संपत्तियां' : 'Total Assets'}:</span>{' '}
                <span className="font-bold">{fmt(totalAssets)}</span>
              </div>
              <div className={isBalanced ? 'text-success' : 'text-destructive'}>
                <span className="font-bold">
                  {isBalanced
                    ? (hi ? '✓ संतुलित' : '✓ Balanced')
                    : (hi ? '✗ असंतुलित' : '✗ Not Balanced')}
                </span>
              </div>
            </div>

            {/* Diagnostic — only when the sheet doesn't tie. Points to the real source. */}
            {!isBalanced && (
              <div className="mt-4 pt-4 border-t text-left max-w-2xl mx-auto text-sm space-y-1">
                <p className="font-semibold text-destructive">
                  {hi ? `अंतर: ${fmt(Math.abs(totalLiabilities - totalAssets))} — संभावित कारण:` : `Difference: ${fmt(Math.abs(totalLiabilities - totalAssets))} — likely cause:`}
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{hi ? 'ओपनिंग बैलेंस (Opening) — कुल डेबिट' : 'Opening balances — total Debit'}</span>
                  <span>{fmt(sumOpenDr)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{hi ? 'ओपनिंग बैलेंस (Opening) — कुल क्रेडिट' : 'Opening balances — total Credit'}</span>
                  <span>{fmt(sumOpenCr)}</span>
                </div>
                {Math.abs(openingGap) >= 1 && (
                  <div className="flex justify-between font-semibold text-destructive">
                    <span>{hi ? '→ Opening Dr ≠ Cr, अंतर' : '→ Opening Dr ≠ Cr, gap'}</span>
                    <span>{openingGap > 0 ? '' : '−'}{fmt(Math.abs(openingGap))} {openingGap > 0 ? 'Dr' : 'Cr'}</span>
                  </div>
                )}
                {Math.abs(txnGap) >= 1 && (
                  <div className="flex justify-between font-semibold text-destructive">
                    <span>{hi ? '→ किसी voucher में Dr ≠ Cr, अंतर' : '→ A voucher has Dr ≠ Cr, gap'}</span>
                    <span>{txnGap > 0 ? '' : '−'}{fmt(Math.abs(txnGap))} {txnGap > 0 ? 'Dr' : 'Cr'}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {Math.abs(openingGap) >= 1
                    ? (hi
                        ? 'ठीक करें: Society Setup → Opening Balances में जाएँ और कुल डेबिट = कुल क्रेडिट करें (यह अंतर आमतौर पर किसी एक खाते के ओपनिंग बैलेंस का बिना-जोड़ा हिस्सा होता है, जैसे प्रवेश शुल्क)।'
                        : 'Fix: open Society Setup → Opening Balances and make total Debit = total Credit (this gap is usually one account\'s unmatched opening balance, e.g. Admission Fee).')
                    : Math.abs(txnGap) >= 1
                      ? (hi
                          ? 'ठीक करें: कोई पुराना voucher असंतुलित है (Dr=Cr लागू होने से पहले बना)। Trial Balance पर भी यही अंतर दिखेगा — उस voucher को खोजकर सुधारें।'
                          : 'Fix: a legacy voucher is unbalanced (created before Dr=Cr enforcement). The Trial Balance shows the same gap — find and correct that voucher.')
                      : (hi
                          ? 'खाते संतुलित हैं पर बैलेंस शीट नहीं — समापन माल (closing stock) पोस्टिंग जाँचें।'
                          : 'Ledger ties but the sheet does not — check the closing-stock posting.')}
                </p>
              </div>
            )}
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
