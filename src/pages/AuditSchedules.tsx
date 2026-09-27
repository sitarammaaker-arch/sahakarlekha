/**
 * B-2: State-wise Audit Schedules
 *
 * Tabbed page showing all statutory audit schedules (I–X) per the
 * society's state Cooperative Societies Act. Data-driven — the schedule
 * definitions come from stateAuditFormats.ts, amounts are resolved
 * from the trial balance. Supports PDF / Excel / CSV export.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Download, FileSpreadsheet, Info, Scale } from 'lucide-react';
import { downloadCSV, downloadExcel } from '@/lib/exportUtils';
import {
  getStateAuditFormat,
  resolveAllSchedules,
  getConfiguredStates,
  type ResolvedSchedule,
  type ResolvedLineItem,
  type StateAuditFormat,
  type ResolverContext,
} from '@/lib/stateAuditFormats';
import { generateAuditSchedulesPDF } from '@/lib/pdf';
import { balanceSheetLeaves } from '@/lib/balanceSheetLeaves';
import { tieSchedules } from '@/lib/auditScheduleTie';
import { CasStatements } from '@/components/cas/CasStatements';
import { statutoryLimits, scheduleLimitsLine } from '@/lib/rules/statutoryLimits';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

const fmtSigned = (n: number) => {
  if (Math.abs(n) < 0.01) return '—';
  return n < 0 ? `(${fmt(n)})` : fmt(n);
};

// ── Sub-components ──────────────────────────────────────────────────────────

interface ScheduleTableProps {
  schedule: ResolvedSchedule;
  hi: boolean;
  fy: string;
  pyYear: string;
  hasPY: boolean;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedule, hi, fy, pyYear, hasPY }) => (
  <Card className="shadow-card">
    <CardHeader className="pb-3 border-b">
      <CardTitle className="text-base flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        {hi ? schedule.nameHi : schedule.name}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
            {hasPY && (
              <TableHead className="text-right text-muted-foreground text-xs w-32">{pyYear}</TableHead>
            )}
            <TableHead className="text-right w-36">{fy}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.items.map((item, idx) => (
            <ScheduleRow key={item.id} item={item} idx={idx + 1} hi={hi} hasPY={hasPY} />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

interface ScheduleRowProps {
  item: ResolvedLineItem;
  idx: number;
  hi: boolean;
  hasPY: boolean;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({ item, idx, hi, hasPY }) => {
  const isNeg = item.currentYear < -0.01;
  return (
    <TableRow
      className={
        item.isTotal
          ? 'bg-primary/10 font-bold'
          : item.bold
          ? 'font-semibold'
          : 'hover:bg-muted/30'
      }
    >
      <TableCell className="text-muted-foreground text-xs">
        {item.isTotal ? '' : idx}
      </TableCell>
      <TableCell style={{ paddingLeft: `${(item.indent || 0) * 24 + 16}px` }}>
        {hi ? item.labelHi : item.label}
        {item.note && (
          <span className="ml-2 text-xs text-muted-foreground">({item.note})</span>
        )}
      </TableCell>
      {hasPY && (
        <TableCell className="text-right text-muted-foreground">
          {fmtSigned(item.previousYear)}
        </TableCell>
      )}
      <TableCell className={`text-right ${isNeg ? 'text-destructive' : ''}`}>
        {fmtSigned(item.currentYear)}
      </TableCell>
    </TableRow>
  );
};

/** Depreciation schedule — wider table for Schedule IV */
const DepreciationTable: React.FC<ScheduleTableProps> = ({ schedule, hi, fy, pyYear, hasPY }) => (
  <Card className="shadow-card">
    <CardHeader className="pb-3 border-b">
      <CardTitle className="text-base flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        {hi ? schedule.nameHi : schedule.name}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{hi ? 'संपत्ति श्रेणी' : 'Asset Category'}</TableHead>
              <TableHead className="text-right">{hi ? 'सकल लागत' : 'Gross Cost'}</TableHead>
              <TableHead className="text-right">{hi ? 'संचित ह्रास' : 'Accum. Dep.'}</TableHead>
              <TableHead className="text-right">{hi ? 'शुद्ध मूल्य' : 'Net Book Value'}</TableHead>
              {hasPY && (
                <TableHead className="text-right text-muted-foreground text-xs">{pyYear}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.items.map(item => {
              // For depreciation, currentYear has gross cost. We show it as-is.
              return (
                <TableRow
                  key={item.id}
                  className={item.isTotal ? 'bg-primary/10 font-bold' : 'hover:bg-muted/30'}
                >
                  <TableCell>{hi ? item.labelHi : item.label}</TableCell>
                  <TableCell className="text-right">{fmtSigned(item.currentYear)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right">{fmtSigned(item.currentYear)}</TableCell>
                  {hasPY && (
                    <TableCell className="text-right text-muted-foreground">{fmtSigned(item.previousYear)}</TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground mt-3 italic">
        {hi
          ? 'नोट: विस्तृत ह्रास गणना के लिए संपत्ति रजिस्टर देखें।'
          : 'Note: For detailed depreciation calculation, refer to the Asset Register.'}
      </p>
    </CardContent>
  </Card>
);

// ── Main Component ──────────────────────────────────────────────────────────

const AuditSchedules: React.FC = () => {
  const { language } = useLanguage();
  const {
    society,
    accounts,
    members,
    getTrialBalance,
    getProfitLoss,
    getTradingAccount,
  } = useData();

  const hi = language === 'hi';
  const fy = society.financialYear;
  const pyYear = society.previousFinancialYear || '';
  const pyBalances = society.previousYearBalances || {};
  const hasPY = !!pyYear && Object.keys(pyBalances).length > 0;

  // State audit format
  const format = useMemo(() => getStateAuditFormat(society.state), [society.state]);

  // Resolve all schedules
  // RULE 2: the SAME as-on date, leaves and closing-stock rule as the Balance Sheet page, and the
  // app's own Trading A/c — every schedule total then ties to the statements (tieSchedules).
  const fyEnd = `20${(fy || '').split('-')[1]}-03-31`;
  const tied = useMemo(() => {
    const trialBalance = getTrialBalance(fyEnd);
    const { totalIncome, totalExpenses, netProfit } = getProfitLoss(fyEnd);
    const tr = getTradingAccount(fyEnd);
    const { grossProfit } = tr;
    const approvedMembers = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
    const activeMembers = approvedMembers.filter(m => m.status === 'active').length;
    const totalShareCapital = approvedMembers.reduce((s, m) => s + (m.shareCapital ?? 0), 0);

    const ctx: ResolverContext = {
      trialBalance,
      accounts,
      previousYearBalances: pyBalances,
      netProfit,
      grossProfit,
      reserveFundPct: society.reserveFundPct ?? 25,
      totalIncome,
      totalExpenses,
      totalMembers: members.length,
      activeMembers,
      totalShareCapital,
    };

    const leaves = balanceSheetLeaves(trialBalance, { closingStockPosted: tr.closingStockPosted, physicalClosingStock: tr.physicalClosingStock, netProfit });
    const hasTrading = Math.abs(tr.totalSales) > 0.005 || Math.abs(tr.totalPurchases) > 0.005 || Math.abs(tr.totalClosingStock) > 0.005;
    return tieSchedules(resolveAllSchedules(format, ctx), {
      accounts, leaves, trialBalance, netProfit, previousYearBalances: pyBalances,
      trading: hasTrading ? tr : null,
    });
  }, [format, fyEnd, getTrialBalance, getProfitLoss, getTradingAccount, accounts, members, pyBalances, society.reserveFundPct]);
  const resolved = tied.schedules;

  // ── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  // PACS only: the NABARD CAS formats (Annexure II / III / IV) as an alternative view (founder D1).
  const isPacs = society.societyType === 'pacs';
  const [view, setView] = useState<'state' | 'cas'>('state');
  // The statutory figures shown here come from the ONE rules source (#508) when checked against the
  // State Act's text — not the format's hard-coded defaults (RULE 2).
  const limits = useMemo(() => statutoryLimits(society.state, new Date().toISOString().slice(0, 10)), [society.state]);

  // ── Export helpers ──────────────────────────────────────────────────────
  const exportRows = (schedule: ResolvedSchedule) =>
    schedule.items.map(item => [
      hi ? item.labelHi : item.label,
      item.currentYear,
      ...(hasPY ? [item.previousYear] : []),
    ] as (string | number)[]);

  const exportHeaders = [
    hi ? 'विवरण' : 'Particulars',
    `${fy} (₹)`,
    ...(hasPY ? [`${pyYear} (₹)`] : []),
  ];

  const handleCSV = () => {
    const rows: (string | number)[][] = [];
    resolved.forEach(sch => {
      rows.push([(hi ? sch.nameHi : sch.name), '', ...(hasPY ? [''] : [])]);
      rows.push(...exportRows(sch));
      rows.push(['', '', ...(hasPY ? [''] : [])]);
    });
    downloadCSV(exportHeaders, rows, `audit-schedules-${fy}`);
  };

  const handleExcel = () => {
    const sheets = resolved.map(sch => ({
      name: sch.shortName ? `Sch ${sch.shortName}` : sch.id,
      headers: exportHeaders,
      rows: exportRows(sch),
    }));
    downloadExcel(sheets, `audit-schedules-${fy}`);
  };

  const handlePDF = () => {
    generateAuditSchedulesPDF(resolved, society, format, language);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const renderSchedule = (sch: ResolvedSchedule) => {
    if (sch.specialRenderer === 'depreciation') {
      return <DepreciationTable key={sch.id} schedule={sch} hi={hi} fy={fy} pyYear={pyYear} hasPY={hasPY} />;
    }
    return <ScheduleTable key={sch.id} schedule={sch} hi={hi} fy={fy} pyYear={pyYear} hasPY={hasPY} />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <ClipboardList className="h-6 w-6 text-indigo-700 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {hi ? 'ऑडिट अनुसूचियां (राज्य प्रारूप)' : 'Audit Schedules (State Format)'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? format.actNameHi : format.actName}
              {format.auditFormNumber && ` — ${format.auditFormNumber}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}>
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

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm text-indigo-800 dark:text-indigo-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">{hi ? society.nameHi : society.name}</span>
          {' · '}
          {hi ? 'वित्तीय वर्ष' : 'FY'} {fy}
          {' · '}
          {scheduleLimitsLine(society, limits, format, hi)}
        </div>
      </div>

      {/* Configured states info */}
      <div className="text-xs text-muted-foreground">
        {hi ? 'समर्थित राज्य' : 'Configured states'}:{' '}
        {getConfiguredStates().map(s => s.code.toUpperCase()).join(', ')}
        {format.stateCode === 'generic' && (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            ({hi ? 'सामान्य प्रारूप का उपयोग किया जा रहा है' : 'Using generic format — state-specific format not configured'})
          </span>
        )}
      </div>

      {isPacs && (
        <div className="inline-flex rounded-lg border p-1 gap-1">
          <Button size="sm" variant={view === 'state' ? 'default' : 'ghost'} onClick={() => setView('state')}>{hi ? 'राज्य प्रारूप' : 'State format'}</Button>
          <Button size="sm" variant={view === 'cas' ? 'default' : 'ghost'} onClick={() => setView('cas')}>NABARD CAS</Button>
        </div>
      )}

      {isPacs && view === 'cas' ? <CasStatements hi={hi} /> : (<>
      {/* Every schedule ties to the Balance Sheet (RULE 2) — shown, never assumed. */}
      <div className={`rounded-lg border p-3 text-sm ${tied.ties.ok ? 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
        {tied.ties.ok
          ? (hi ? `✓ अनुसूचियाँ तुलन पत्र से मेल खाती हैं — देनदारियाँ (I+II+III+VII) ₹${tied.ties.liabilities.toLocaleString('en-IN')} · परिसंपत्तियाँ (IV+V+VI) ₹${tied.ties.assets.toLocaleString('en-IN')}`
                : `✓ Schedules tie to the Balance Sheet — liabilities (I+II+III+VII) ₹${tied.ties.liabilities.toLocaleString('en-IN')} · assets (IV+V+VI) ₹${tied.ties.assets.toLocaleString('en-IN')}`)
          : (hi ? `✗ अनुसूचियाँ तुलन पत्र से मेल नहीं खातीं — अनुसूची: देनदारियाँ ₹${tied.ties.liabilities.toLocaleString('en-IN')}, परिसंपत्तियाँ ₹${tied.ties.assets.toLocaleString('en-IN')}; तुलन पत्र: ₹${tied.ties.bsLiabilities.toLocaleString('en-IN')} / ₹${tied.ties.bsAssets.toLocaleString('en-IN')} — कृपया सूचित करें`
                : `✗ Schedules do not tie to the Balance Sheet — schedules: liabilities ₹${tied.ties.liabilities.toLocaleString('en-IN')}, assets ₹${tied.ties.assets.toLocaleString('en-IN')}; Balance Sheet: ₹${tied.ties.bsLiabilities.toLocaleString('en-IN')} / ₹${tied.ties.bsAssets.toLocaleString('en-IN')} — please report`)}
      </div>

      {/* Tabbed schedules */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="mb-4">
            <TabsTrigger value="all">{hi ? 'सभी' : 'All'}</TabsTrigger>
            {resolved.map(sch => (
              <TabsTrigger key={sch.id} value={sch.id}>
                {sch.shortName}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* All tab */}
        <TabsContent value="all" className="space-y-6">
          {resolved.map(renderSchedule)}
        </TabsContent>

        {/* Individual schedule tabs */}
        {resolved.map(sch => (
          <TabsContent key={sch.id} value={sch.id}>
            {renderSchedule(sch)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Cross-check summary */}
      <Card className="border-indigo-200 dark:border-indigo-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-indigo-700 dark:text-indigo-300">
            {hi ? 'क्रॉस-चेक सारांश' : 'Cross-Check Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {resolved
              .filter(s => s.items.some(i => i.isTotal))
              .map(sch => {
                const total = sch.items.find(i => i.isTotal);
                return (
                  <div key={sch.id} className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">{sch.shortName}</div>
                    <div className="text-sm font-bold">
                      {total ? fmtSigned(total.currentYear) : '—'}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
      </>)}

      {/* Signature block */}
      <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
        {[
          hi ? 'लेखाकार' : 'Accountant',
          hi ? 'सचिव' : 'Secretary',
          hi ? 'अध्यक्ष' : 'Chairman',
        ].map(label => (
          <div key={label}>
            <div className="h-16 border-b border-dashed border-muted-foreground/30 mb-2" />
            <p className="font-medium">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditSchedules;
