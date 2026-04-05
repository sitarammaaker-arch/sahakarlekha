/**
 * Depreciation Schedule — Category-wise summary in standard audit format.
 * Opening WDV → Additions → Depreciation → Closing WDV
 * Uses existing calcDepForFY / parseFY / DEP_ACCOUNTS from depreciation.ts
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingDown, Download, FileSpreadsheet, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateDepreciationSchedulePDF } from '@/lib/pdf';
import { calcDepForFY, parseFY, DEP_ACCOUNTS } from '@/lib/depreciation';
import { fmtDate } from '@/lib/dateUtils';
import type { Asset, AssetCategory } from '@/types';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const CATEGORIES: { key: AssetCategory; label: string; labelHi: string }[] = [
  { key: 'Land', label: 'Land', labelHi: 'भूमि' },
  { key: 'Building', label: 'Building', labelHi: 'भवन' },
  { key: 'Furniture', label: 'Furniture & Fixtures', labelHi: 'फर्नीचर एवं जुड़नार' },
  { key: 'Vehicle', label: 'Vehicle', labelHi: 'वाहन' },
  { key: 'Equipment', label: 'Plant & Machinery', labelHi: 'संयंत्र एवं मशीनरी' },
  { key: 'Computer', label: 'Computer / IT Equipment', labelHi: 'कंप्यूटर / IT उपकरण' },
  { key: 'Other', label: 'Other', labelHi: 'अन्य' },
];

interface CategoryRow {
  category: AssetCategory;
  label: string;
  labelHi: string;
  assetCount: number;
  totalCost: number;
  residualValue: number;
  openingWDV: number;
  additions: number;
  deductions: number;
  depRate: string;
  depAmount: number;
  closingWDV: number;
  assets: Asset[];
  method: string;
}

const DepreciationSchedule: React.FC = () => {
  const { language } = useLanguage();
  const { society, assets, accounts, vouchers } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);

  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Calculate accumulated depreciation for an asset from vouchers (prior to current FY)
  const getAccumDepPrior = (asset: Asset): number => {
    const depAcc = DEP_ACCOUNTS[asset.category];
    if (!depAcc) return 0;
    const accumId = depAcc.accumId;
    const acc = accounts.find(a => a.id === accumId);
    if (!acc) return 0;

    // Opening balance of accumulated dep account
    let bal = acc.openingBalanceType === 'credit' ? acc.openingBalance : -acc.openingBalance;

    // Add voucher movements to accumulated dep account (prior FYs only)
    vouchers.filter(v => !v.isDeleted).forEach(v => {
      if (fyDates && v.date >= fyDates.start) return; // skip current FY vouchers
      if (v.debitAccountId === accumId) bal -= v.amount;
      if (v.creditAccountId === accumId) bal += v.amount;
    });

    return Math.max(0, bal);
  };

  // Full accumulated dep including current FY
  const getAccumDepTotal = (asset: Asset): number => {
    const depAcc = DEP_ACCOUNTS[asset.category];
    if (!depAcc) return 0;
    const accumId = depAcc.accumId;
    const acc = accounts.find(a => a.id === accumId);
    if (!acc) return 0;

    let bal = acc.openingBalanceType === 'credit' ? acc.openingBalance : -acc.openingBalance;
    vouchers.filter(v => !v.isDeleted).forEach(v => {
      if (v.debitAccountId === accumId) bal -= v.amount;
      if (v.creditAccountId === accumId) bal += v.amount;
    });
    return Math.max(0, bal);
  };

  const data = useMemo((): CategoryRow[] => {
    if (!fyDates) return [];

    return CATEGORIES.map(cat => {
      const catAssets = assets.filter(a => a.category === cat.key);
      if (catAssets.length === 0) {
        return {
          category: cat.key, label: cat.label, labelHi: cat.labelHi,
          assetCount: 0, totalCost: 0, residualValue: 0, openingWDV: 0, additions: 0,
          deductions: 0, depRate: '—', depAmount: 0, closingWDV: 0,
          assets: [], method: '—',
        };
      }

      const activeAssets = catAssets.filter(a => a.status === 'active');

      // Additions = assets purchased during current FY
      const additions = catAssets
        .filter(a => a.purchaseDate >= fyDates.start && a.purchaseDate <= fyDates.end)
        .reduce((s, a) => s + a.cost, 0);

      // Deductions = disposed assets (simplified — cost of disposed)
      const deductions = catAssets
        .filter(a => a.status === 'disposed')
        .reduce((s, a) => s + a.cost, 0);

      const totalCost = catAssets.reduce((s, a) => s + a.cost, 0);

      // For Land — no depreciation
      if (!DEP_ACCOUNTS[cat.key]) {
        return {
          category: cat.key, label: cat.label, labelHi: cat.labelHi,
          assetCount: catAssets.length, totalCost, residualValue: 0, openingWDV: totalCost,
          additions, deductions, depRate: 'N/A', depAmount: 0,
          closingWDV: totalCost - deductions, assets: catAssets, method: 'N/A',
        };
      }

      // Calculate depreciation for current FY per asset
      let totalDep = 0;
      activeAssets.forEach(a => {
        const priorDep = getAccumDepPrior(a);
        totalDep += calcDepForFY(a, fy, priorDep);
      });

      // Opening WDV = total cost of assets existing before FY start - their prior accumulated dep
      const priorAssets = catAssets.filter(a => a.purchaseDate < fyDates.start);
      const openingCost = priorAssets.reduce((s, a) => s + a.cost, 0);
      const openingAccDep = priorAssets.reduce((s, a) => s + getAccumDepPrior(a), 0);
      const openingWDV = openingCost - openingAccDep;

      const closingWDV = openingWDV + additions - deductions - totalDep;

      // Dep rate — show range if varies
      const rates = [...new Set(activeAssets.map(a => a.depreciationRate).filter(r => r > 0))];
      const depRate = rates.length === 0 ? '—' : rates.length === 1 ? `${rates[0]}%` : `${Math.min(...rates)}-${Math.max(...rates)}%`;

      const methods = [...new Set(activeAssets.map(a => a.depreciationMethod || 'SLM'))];
      const method = methods.join('/');

      const totalResidual = activeAssets.reduce((s, a) => s + (a.residualValue || 0), 0);

      return {
        category: cat.key, label: cat.label, labelHi: cat.labelHi,
        assetCount: catAssets.length, totalCost, residualValue: totalResidual,
        openingWDV: Math.max(0, openingWDV),
        additions, deductions, depRate, depAmount: totalDep,
        closingWDV: Math.max(0, closingWDV), assets: catAssets, method,
      };
    }).filter(r => r.assetCount > 0);
  }, [assets, accounts, vouchers, fy, fyDates]);

  // Totals
  const totals = useMemo(() => ({
    totalCost: data.reduce((s, r) => s + r.totalCost, 0),
    openingWDV: data.reduce((s, r) => s + r.openingWDV, 0),
    additions: data.reduce((s, r) => s + r.additions, 0),
    deductions: data.reduce((s, r) => s + r.deductions, 0),
    depAmount: data.reduce((s, r) => s + r.depAmount, 0),
    closingWDV: data.reduce((s, r) => s + r.closingWDV, 0),
  }), [data]);

  const toggleExpand = (cat: string) => setExpandedCat(prev => prev === cat ? null : cat);

  // Exports
  const csvHeaders = ['Category', 'Assets', 'Total Cost', 'Opening WDV', 'Additions', 'Dep Rate', 'Method', 'Dep Amount (FY)', 'Closing WDV'];
  const csvRows = () => data.map(r => [
    r.label, r.assetCount, r.totalCost, r.openingWDV, r.additions,
    r.depRate, r.method, r.depAmount, r.closingWDV,
  ]);

  const handleCSV = () => downloadCSV(csvHeaders, csvRows(), `depreciation-schedule-${fy}`);
  const handleExcel = () => downloadExcelSingle(csvHeaders, csvRows(), `depreciation-schedule-${fy}`, 'Depreciation Schedule');
  const handlePDF = () => generateDepreciationSchedulePDF(data, totals, society, language);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <TrendingDown className="h-6 w-6 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {hi ? 'ह्रास अनुसूची' : 'Depreciation Schedule'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? `वित्तीय वर्ष ${fy} — श्रेणी-वार सारांश` : `FY ${fy} — Category-wise Summary`}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: hi ? 'कुल लागत' : 'Total Cost', value: fmtAmt(totals.totalCost), color: 'text-blue-700' },
          { label: hi ? `ह्रास (${fy})` : `Depreciation (${fy})`, value: fmtAmt(totals.depAmount), color: 'text-amber-700' },
          { label: hi ? 'संचित ह्रास' : 'Accumulated Dep.', value: fmtAmt(totals.totalCost - totals.closingWDV), color: 'text-red-600' },
          { label: hi ? 'शुद्ध पुस्तक मूल्य' : 'Net Book Value', value: fmtAmt(totals.closingWDV), color: 'text-green-700' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Schedule Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">
            {hi ? 'श्रेणी-वार ह्रास अनुसूची' : 'Category-wise Depreciation Schedule'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई संपत्ति नहीं मिली' : 'No assets found'}</p>
              <p className="text-sm">{hi ? 'संपत्ति रजिस्टर में संपत्ति जोड़ें' : 'Add assets in Asset Register'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{hi ? 'श्रेणी' : 'Category'}</TableHead>
                    <TableHead className="text-center">{hi ? 'संख्या' : 'Assets'}</TableHead>
                    <TableHead className="text-right">{hi ? 'प्रारंभिक WDV' : 'Opening WDV'}</TableHead>
                    <TableHead className="text-right">{hi ? 'जोड़' : 'Additions'}</TableHead>
                    <TableHead className="text-center">{hi ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-center">{hi ? 'पद्धति' : 'Method'}</TableHead>
                    <TableHead className="text-right">{hi ? `ह्रास (${fy})` : `Dep. (${fy})`}</TableHead>
                    <TableHead className="text-right">{hi ? 'अंतिम WDV' : 'Closing WDV'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <React.Fragment key={row.category}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(row.category)}
                      >
                        <TableCell className="w-8">
                          {row.assetCount > 0 && (
                            expandedCat === row.category
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{hi ? row.labelHi : row.label}</TableCell>
                        <TableCell className="text-center">{row.assetCount}</TableCell>
                        <TableCell className="text-right">{fmtAmt(row.openingWDV)}</TableCell>
                        <TableCell className="text-right">{row.additions > 0 ? fmtAmt(row.additions) : '—'}</TableCell>
                        <TableCell className="text-center">{row.depRate}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex px-1.5 py-0.5 text-xs rounded bg-muted font-mono">{row.method}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-700">{fmtAmt(row.depAmount)}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{fmtAmt(row.closingWDV)}</TableCell>
                      </TableRow>

                      {/* Expanded asset detail */}
                      {expandedCat === row.category && row.assets.map(a => (
                        <TableRow key={a.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="pl-8 text-sm text-muted-foreground">
                            {a.assetNo} — {a.name}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtAmt(a.cost)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmtDate(a.purchaseDate)}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{a.depreciationRate}%</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{a.depreciationMethod || 'SLM'}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {fmtAmt(calcDepForFY(a, fy, getAccumDepPrior(a)))}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {fmtAmt(Math.max(0, a.cost - getAccumDepTotal(a)))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Total Row */}
                  <TableRow className="bg-primary/10 font-bold text-base">
                    <TableCell></TableCell>
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-center">{assets.length}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.openingWDV)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.additions)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-amber-700">{fmtAmt(totals.depAmount)}</TableCell>
                    <TableCell className="text-right text-green-700">{fmtAmt(totals.closingWDV)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'प्रारंभिक WDV = पूर्व वर्ष का अंतिम WDV। जोड़ = वर्ष में खरीदी गई संपत्ति। ह्रास = SLM/WDV पद्धति अनुसार। अंतिम WDV = प्रारंभिक + जोड़ - ह्रास।'
            : 'Opening WDV = prior year closing WDV. Additions = assets purchased during FY. Depreciation = as per SLM/WDV method. Closing WDV = Opening + Additions - Depreciation.'}
        </span>
      </div>

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

export default DepreciationSchedule;
