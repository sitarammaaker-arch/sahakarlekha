/**
 * Closing Stock Report — Item-wise closing stock with movements summary.
 * Opening Qty → Purchases → Sales → Adjustments → Closing Qty × Rate = Value
 * Matches Trading Account closing stock figure.
 */
import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Download, FileSpreadsheet, Info } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateClosingStockPDF } from '@/lib/pdf';
import { parseFY } from '@/lib/depreciation';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtQty = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);

interface StockRow {
  itemCode: string;
  name: string;
  unit: string;
  hsnCode: string;
  openingQty: number;
  purchaseQty: number;
  saleQty: number;
  adjustmentQty: number;
  closingQty: number;
  rate: number;
  openingValue: number;
  closingValue: number;
}

const ClosingStockReport: React.FC = () => {
  const { language } = useLanguage();
  const { society, stockItems, stockMovements } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);

  const data = useMemo((): StockRow[] => {
    if (!fyDates) return [];

    return stockItems
      .filter(item => item.isActive)
      .map(item => {
        const movements = stockMovements.filter(m => m.itemId === item.id && m.date >= fyDates.start && m.date <= fyDates.end);

        const purchaseQty = movements.filter(m => m.type === 'purchase').reduce((s, m) => s + m.qty, 0);
        const saleQty = movements.filter(m => m.type === 'sale').reduce((s, m) => s + Math.abs(m.qty), 0);
        const adjustmentQty = movements.filter(m => m.type === 'adjustment').reduce((s, m) => s + m.qty, 0);

        const openingQty = item.openingStock || 0;
        const closingQty = openingQty + purchaseQty - saleQty + adjustmentQty;
        const rate = item.purchaseRate || 0;

        return {
          itemCode: item.itemCode,
          name: item.name,
          unit: item.unit,
          hsnCode: item.hsnCode || '',
          openingQty,
          purchaseQty,
          saleQty,
          adjustmentQty,
          closingQty: Math.max(0, closingQty),
          rate,
          openingValue: openingQty * rate,
          closingValue: Math.max(0, closingQty) * rate,
        };
      })
      .filter(r => r.openingQty > 0 || r.purchaseQty > 0 || r.saleQty > 0 || r.closingQty > 0);
  }, [stockItems, stockMovements, fyDates]);

  const totals = useMemo(() => ({
    openingQty: data.reduce((s, r) => s + r.openingQty, 0),
    purchaseQty: data.reduce((s, r) => s + r.purchaseQty, 0),
    saleQty: data.reduce((s, r) => s + r.saleQty, 0),
    adjustmentQty: data.reduce((s, r) => s + r.adjustmentQty, 0),
    closingQty: data.reduce((s, r) => s + r.closingQty, 0),
    openingValue: data.reduce((s, r) => s + r.openingValue, 0),
    closingValue: data.reduce((s, r) => s + r.closingValue, 0),
  }), [data]);

  // Exports
  const headers = ['S.No', 'Item Code', 'Item Name', 'Unit', 'HSN', 'Opening Qty', 'Purchases', 'Sales', 'Adj.', 'Closing Qty', 'Rate', 'Closing Value'];
  const rows = () => data.map((r, i) => [
    i + 1, r.itemCode, r.name, r.unit, r.hsnCode,
    r.openingQty, r.purchaseQty, r.saleQty, r.adjustmentQty,
    r.closingQty, r.rate, r.closingValue,
  ]);

  const handleCSV = () => downloadCSV(headers, rows(), `closing-stock-${fy}`);
  const handleExcel = () => downloadExcelSingle(headers, rows(), `closing-stock-${fy}`, 'Closing Stock');
  const handlePDF = () => generateClosingStockPDF(data, totals, society, language);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <Package className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {hi ? 'समापन माल रिपोर्ट' : 'Closing Stock Report'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? `वित्तीय वर्ष ${fy} — मद-वार समापन माल विवरण` : `FY ${fy} — Item-wise Closing Stock Statement`}
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
          { label: hi ? 'कुल मदें' : 'Total Items', value: String(data.length), color: 'text-blue-700' },
          { label: hi ? 'प्रारंभिक माल मूल्य' : 'Opening Stock Value', value: fmtAmt(totals.openingValue), color: 'text-amber-700' },
          { label: hi ? 'समापन माल मूल्य' : 'Closing Stock Value', value: fmtAmt(totals.closingValue), color: 'text-emerald-700' },
          { label: hi ? 'अंतर' : 'Difference', value: fmtAmt(totals.closingValue - totals.openingValue), color: totals.closingValue >= totals.openingValue ? 'text-green-700' : 'text-red-600' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">
            {hi ? 'मद-वार समापन माल' : 'Item-wise Closing Stock'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई माल नहीं मिला' : 'No stock items found'}</p>
              <p className="text-sm">{hi ? 'इन्वेंटरी में माल जोड़ें' : 'Add items in Inventory'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                    <TableHead>{hi ? 'मद का नाम' : 'Item Name'}</TableHead>
                    <TableHead>{hi ? 'इकाई' : 'Unit'}</TableHead>
                    <TableHead className="text-right">{hi ? 'प्रारंभिक' : 'Opening'}</TableHead>
                    <TableHead className="text-right">{hi ? 'क्रय' : 'Purchase'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बिक्री' : 'Sale'}</TableHead>
                    <TableHead className="text-right">{hi ? 'समायोजन' : 'Adj.'}</TableHead>
                    <TableHead className="text-right font-semibold">{hi ? 'समापन मात्रा' : 'Closing Qty'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-right font-semibold">{hi ? 'मूल्य' : 'Value'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r, i) => (
                    <TableRow key={r.itemCode} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{r.itemCode}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right">{fmtQty(r.openingQty)}</TableCell>
                      <TableCell className="text-right text-blue-700">{r.purchaseQty > 0 ? fmtQty(r.purchaseQty) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600">{r.saleQty > 0 ? fmtQty(r.saleQty) : '—'}</TableCell>
                      <TableCell className="text-right">{r.adjustmentQty !== 0 ? fmtQty(r.adjustmentQty) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtQty(r.closingQty)}</TableCell>
                      <TableCell className="text-right">{fmtAmt(r.rate)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">{fmtAmt(r.closingValue)}</TableCell>
                    </TableRow>
                  ))}

                  {/* Total Row */}
                  <TableRow className="bg-primary/10 font-bold text-base">
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{fmtQty(totals.openingQty)}</TableCell>
                    <TableCell className="text-right">{fmtQty(totals.purchaseQty)}</TableCell>
                    <TableCell className="text-right">{fmtQty(totals.saleQty)}</TableCell>
                    <TableCell className="text-right">{fmtQty(totals.adjustmentQty)}</TableCell>
                    <TableCell className="text-right">{fmtQty(totals.closingQty)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtAmt(totals.closingValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-check info */}
      <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-800 dark:text-emerald-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? `समापन माल मूल्य (${fmtAmt(totals.closingValue)}) व्यापार खाते (Trading Account) के क्रेडिट पक्ष से मिलना चाहिए। सूत्र: प्रारंभिक + क्रय - बिक्री ± समायोजन = समापन मात्रा। मूल्य = मात्रा × क्रय दर।`
            : `Closing Stock Value (${fmtAmt(totals.closingValue)}) should match the Trading Account credit side. Formula: Opening + Purchases - Sales +/- Adjustments = Closing Qty. Value = Qty x Purchase Rate.`}
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

export default ClosingStockReport;
