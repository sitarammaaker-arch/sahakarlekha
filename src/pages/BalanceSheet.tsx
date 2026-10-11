/**
 * Balance Sheet — the society's CA format (2026-10-11): two money columns, the head total on the head's
 * last line, fixed assets net of depreciation, one profit & loss line. Rows come from the shared layout
 * (lib/reports/balanceSheetLayout) that the PDF and the Excel/CSV export print too (RULE 2).
 * Previous Year column shows per-line and per-head values
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { balanceSheetLeaves } from '@/lib/balanceSheetLeaves';
import { buildBalanceSheetLayout, visibleRows, pyResult, balanceSheetExportRows, BS_EXPORT_HEADERS, type BsSide } from '@/lib/reports/balanceSheetLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { isEmptyPeriod, comparative } from '@/lib/reportComparative';
import { useToast } from '@/hooks/use-toast';
import type { AccountBalance } from '@/types';
import { PrintButton, PrintHeader } from '@/components/ReportPrint';
import YearEndChecklist from '@/components/YearEndChecklist';

const BalanceSheet: React.FC = () => {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const canExport = can('export');   // ECR-19: read-only roles can view/print but not export data
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

  // Auto-reclassify by balance SIGN + the closing-stock rule — the ONE shared rule
  // (src/lib/balanceSheetLeaves.ts), also used by the NABARD CAS Balance Sheet (RULE 2).
  const { assetLeaves, capLiabLeaves: allCapLiabLeaf, unpostedStock } =
    balanceSheetLeaves(trialBalance, { closingStockPosted, physicalClosingStock, netProfit });
  const pyNetProfit = hasPY ? pyResult(pyBalances, accounts) : 0;
  const layout = buildBalanceSheetLayout({
    accounts, assetLeaves, capLiabLeaves: allCapLiabLeaf, unpostedStock, netProfit,
    py: hasPY ? pyBalances : undefined, pyNetProfit: hasPY ? pyNetProfit : undefined,
  });
  const totalAssets = layout.assets.total;
  const totalLiabilities = layout.liabilities.total;

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

  // Export — the SAME rows as the screen, in the chosen detail level (Summary / Full detail), with the prior year.
  const exportHeaders = BS_EXPORT_HEADERS(hi, hasPY ? pyYear : '');
  const exportRows = () => balanceSheetExportRows(layout, showLedgers, hi);

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
      allCapLiabLeaf,   // reclassified-by-sign, same as the on-screen sheet (ARTHIYA etc. on the liability side)
      netProfit, society, language, 0, accounts, stockItems, showLedgers, unpostedStock,
      hasPY ? { balances: pyBalances, label: pyYear, netProfit: pyNetProfit } : undefined,
    );
  };

  // Render a grouped side (liabilities or assets)
  // ECR-19: variance cell (current − prior) with % change. Prior is already
  // sign-aligned to the current column, so the variance reads correctly per side.
  const varCell = (curr: number, prior: number) => {
    const v = comparative(curr, prior);
    if (v.current === 0 && v.prior === 0) return <TableCell className="text-right text-xs text-muted-foreground" />;
    const up = v.variance > 0;
    const tone = v.variance === 0 ? 'text-muted-foreground' : up ? 'text-emerald-600' : 'text-red-600';
    return (
      <TableCell className={`text-right text-xs ${tone}`}>
        {v.variance > 0 ? '+' : v.variance < 0 ? '−' : ''}{fmt(Math.abs(v.variance))}
        {v.variancePct !== null && v.variance !== 0 && (
          <span className="block text-[10px] opacity-80">{up ? '+' : '−'}{Math.abs(v.variancePct)}%</span>
        )}
      </TableCell>
    );
  };

  const money = (v: number) => (v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v));
  // One side, CA style: head heading row → its lines (AMOUNT column) → the head total on the LAST row (TOTAL column).
  // Full detail adds each sub-group's ledgers in a separate DETAIL column, so no column holds a subtotal and its parts.
  const renderSide = (side: BsSide, sideLabel: string, sideLabelHi: string) => (
    <div className="space-y-2 min-w-0">
      <h3 className="text-lg font-semibold text-primary pb-2 border-b">
        {hi ? sideLabelHi : sideLabel}
      </h3>
      {/* Contain any residual overflow inside the table's own box so a tight column never
          forces the whole page to scroll horizontally. */}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {hasPY && <TableHead className="text-right text-muted-foreground text-xs w-24" title={usingComputedPY ? (hi ? 'डेटा से गणना (पिछले FY अंत)' : 'Computed from data (prior FY end)') : (hi ? 'सहेजा गया स्नैपशॉट' : 'Saved snapshot')}>{pyYear}{usingComputedPY ? ' *' : ''}</TableHead>}
            {hasPY && <TableHead className="text-right text-muted-foreground text-xs w-24">{hi ? 'बदलाव' : 'Change'}</TableHead>}
            <TableHead className="min-w-[11rem]">{t('particulars')}</TableHead>
            {showLedgers && <TableHead className="text-right w-28 text-muted-foreground">{hi ? 'ब्योरा' : 'Detail'}</TableHead>}
            <TableHead className="text-right w-28">{hi ? 'राशि' : 'Amount'}</TableHead>
            <TableHead className="text-right w-28">{hi ? 'योग' : 'Total'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {side.sections.map(sec => {
            const rows = visibleRows(sec, showLedgers);
            return (
              <React.Fragment key={sec.id}>
                {/* Head heading — the prior-year head total sits here (the current one on the head's last line) */}
                <TableRow className={sec.warn ? 'bg-amber-500/10' : 'bg-primary/5'}>
                  {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{sec.pyTotal !== 0 ? money(sec.pyTotal) : ''}</TableCell>}
                  {hasPY && varCell(sec.total, sec.pyTotal)}
                  <TableCell className="font-bold uppercase text-sm" colSpan={showLedgers ? 4 : 3}>{hi ? sec.titleHi : sec.title}</TableCell>
                </TableRow>
                {rows.map((r, i) => {
                  const last = i === rows.length - 1;
                  const isDetail = r.kind === 'detail';
                  const padLeft = `${isDetail ? 1.5 + r.depth * 1.25 : 1.5}rem`;
                  const link = r.accountId ? () => navigate(`/ledger?account=${r.accountId}`) : undefined;
                  return (
                    <TableRow key={r.key}
                      className={`${link ? 'hover:bg-muted/30 cursor-pointer' : ''} ${isDetail ? 'text-muted-foreground' : ''}`}
                      onClick={link} title={link ? (hi ? 'लेजर देखें' : 'View Ledger') : undefined}
                    >
                      {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{r.py !== 0 ? money(r.py) : '—'}</TableCell>}
                      {hasPY && (isDetail ? <TableCell /> : varCell(r.amount, r.py))}
                      <TableCell className={`text-sm group ${r.tone === 'subhead' ? 'italic font-medium' : ''} ${r.tone === 'less' ? 'italic' : ''}`} style={{ paddingLeft: padLeft }}>
                        <span className={link ? 'group-hover:text-primary group-hover:underline' : ''}>
                          {hi ? r.labelHi : r.label}
                        </span>
                        {r.tone === 'subhead' && <span className="ml-1 text-xs">({hi ? 'योग' : 'total'} {money(r.amount)})</span>}
                        {link && <ExternalLink className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50 text-muted-foreground" />}
                      </TableCell>
                      {showLedgers && <TableCell className="text-right text-sm">{isDetail && r.tone !== 'subhead' ? money(r.amount) : ''}</TableCell>}
                      <TableCell className={`text-right text-sm ${r.amount < 0 && !isDetail ? 'text-muted-foreground' : ''}`}>{isDetail ? '' : money(r.amount)}</TableCell>
                      <TableCell className={`text-right font-bold ${last && sec.total < 0 ? 'text-destructive' : ''}`}>
                        {last ? <span className="inline-block border-t border-foreground/40 pt-0.5">{money(sec.total)}</span> : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* GRAND TOTAL */}
          <TableRow className="bg-primary/15 font-bold text-base border-t-2 border-primary">
            {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(side.pyTotal)}</TableCell>}
            {hasPY && varCell(side.total, side.pyTotal)}
            <TableCell className="font-bold" colSpan={showLedgers ? 3 : 2}>{hi ? 'कुल योग' : 'GRAND TOTAL'}</TableCell>
            <TableCell className="text-right font-bold text-primary">{fmt(side.total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PrintHeader />
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            {t('balanceSheet')}
          </h1>
          <p className="text-muted-foreground">{hi ? 'बैलेंस शीट - वित्तीय स्थिति विवरण' : 'Statement of Financial Position'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrintButton />
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}><Download className="h-4 w-4" />PDF</Button>
          {canExport && <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
          </>}
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
              ? 'सारांश: हर उप-समूह (जैसे बैंक खाते, विविध देनदार) एक पंक्ति में। पूर्ण विवरण: उनके खाते "ब्योरा" column में अलग से।'
              : 'Summary: each sub-group (e.g. bank accounts, sundry debtors) on one line. Full detail: their ledgers in a separate "Detail" column.'}
          </p>
        </CardContent>
      </Card>

      <YearEndChecklist balances={trialBalance} asOnDate={asOnDate} bsBalanced={isBalanced} />

      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">{hi ? 'बैलेंस शीट' : 'Balance Sheet'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? (society.nameHi || society.name) : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi ? `${fmtDate(asOnDate)} को` : `As at ${fmtDate(asOnDate)}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Stack the two sides until xl: on a laptop, side-by-side + the prior-year/Change
              comparative columns overflowed the width and forced horizontal scrollbars.
              Each side stacks full-width below xl; side-by-side only on wide monitors — and with the
              prior-year or detail columns only from 2xl, so "Particulars" never wraps word by word. */}
          <div className={`grid grid-cols-1 gap-6 ${hasPY || showLedgers ? '2xl:grid-cols-2' : 'xl:grid-cols-2'}`}>
            {renderSide(layout.liabilities, 'Capital & Liabilities', 'कैपिटल एवं लायबिलिटीज़')}
            {renderSide(layout.assets, 'Assets', 'संपत्तियां')}
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
