/**
 * Closing Stock Report — Category-wise grouped with 6-section format:
 * Opening → Purchase → Sales Return → Sale → Purchase Return → Closing
 * Each section: Quantity, Value. Returns are broken out of Inward/Outward so the
 * statement is transparent: Closing = Opening + Purchase + Sales Return − Sale − Purchase Return.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Download, FileSpreadsheet, Info } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateClosingStockPDF } from '@/lib/pdf';
import { parseFY } from '@/lib/depreciation';
import { computeStock, computeStockCostRate } from '@/lib/stockUtils';

const fmtV = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtQ = (n: number) => n > 0 ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) : '';

interface StockRow {
  itemCode: string;
  name: string;
  unit: string;
  stockGroup: string;
  openingQty: number;
  openingValue: number;
  purchaseQty: number;
  purchaseValue: number;
  salesReturnQty: number;      // goods returned BY customers → back into stock (inward)
  salesReturnValue: number;
  saleQty: number;
  saleValue: number;
  purchaseReturnQty: number;   // goods returned TO suppliers → out of stock (outward)
  purchaseReturnValue: number;
  closingQty: number;
  closingValue: number;
}

interface GroupSummary {
  group: string;
  items: StockRow[];
  openingValue: number;
  purchaseValue: number;
  salesReturnValue: number;
  saleValue: number;
  purchaseReturnValue: number;
  closingValue: number;
}

const ClosingStockReport: React.FC = () => {
  const { language } = useLanguage();
  const { society, stockItems, reconciledStockMovements } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groupedData.map(g => g.group)));
  };
  const collapseAll = () => setExpandedGroups(new Set());

  // Compute item-wise data
  const itemRows = useMemo((): StockRow[] => {
    if (!fyDates) return [];

    return stockItems
      .filter(item => item.isActive)
      .map(item => {
        const fyMovements = reconciledStockMovements.filter(m => m.itemId === item.id && m.date >= fyDates.start && m.date <= fyDates.end);

        // Four distinct flows (returns are `adjustment` movements: +qty = sales return / inward,
        // −qty = purchase return / outward). Splitting the old Inward/Outward buckets this way keeps
        // the identity exact: Closing = Opening + Purchase + Sales Return − Sale − Purchase Return.
        const purchaseMoves = fyMovements.filter(m => m.type === 'purchase');
        const salesReturnMoves = fyMovements.filter(m => m.type === 'adjustment' && m.qty > 0);
        const saleMoves = fyMovements.filter(m => m.type === 'sale');
        const purchaseReturnMoves = fyMovements.filter(m => m.type === 'adjustment' && m.qty < 0);
        const sumQ = (arr: typeof fyMovements) => arr.reduce((s, m) => s + Math.abs(m.qty), 0);
        const sumV = (arr: typeof fyMovements) => arr.reduce((s, m) => s + Math.abs(m.amount), 0);

        const purchaseQty = sumQ(purchaseMoves), purchaseValue = sumV(purchaseMoves);
        const salesReturnQty = sumQ(salesReturnMoves), salesReturnValue = sumV(salesReturnMoves);
        const saleQty = sumQ(saleMoves), saleValue = sumV(saleMoves);
        const purchaseReturnQty = sumQ(purchaseReturnMoves), purchaseReturnValue = sumV(purchaseReturnMoves);

        const openingQty = item.openingStock || 0;
        const openingRate = item.purchaseRate || 0;
        const openingValue = openingQty * openingRate;

        // Closing must equal the Trading A/c / Balance Sheet figure for this item — both
        // use WHOLE-HISTORY (up to FY end) qty × weighted-average cost. Using only FY-scoped
        // movements gave a different WA rate (and qty) when prior-FY movements exist (Audit #11).
        const histMovements = reconciledStockMovements.filter(m => m.itemId === item.id && m.date <= fyDates.end);
        const closingQty = computeStock(item, histMovements);
        const closingRate = computeStockCostRate(item, histMovements);
        const closingValue = closingQty * closingRate;

        return {
          itemCode: item.itemCode,
          name: item.name,
          unit: item.unit,
          stockGroup: item.stockGroup || 'General',
          openingQty, openingValue,
          purchaseQty, purchaseValue,
          salesReturnQty, salesReturnValue,
          saleQty, saleValue,
          purchaseReturnQty, purchaseReturnValue,
          closingQty, closingValue,
        };
      })
      .filter(r => r.openingQty > 0 || r.purchaseQty > 0 || r.salesReturnQty > 0 || r.saleQty > 0 || r.purchaseReturnQty > 0 || r.closingQty > 0);
  }, [stockItems, reconciledStockMovements, fyDates]);

  // Group by stockGroup
  const groupedData = useMemo((): GroupSummary[] => {
    const groups: Record<string, StockRow[]> = {};
    itemRows.forEach(r => {
      if (!groups[r.stockGroup]) groups[r.stockGroup] = [];
      groups[r.stockGroup].push(r);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, items]) => ({
        group,
        items,
        openingValue: items.reduce((s, r) => s + r.openingValue, 0),
        purchaseValue: items.reduce((s, r) => s + r.purchaseValue, 0),
        salesReturnValue: items.reduce((s, r) => s + r.salesReturnValue, 0),
        saleValue: items.reduce((s, r) => s + r.saleValue, 0),
        purchaseReturnValue: items.reduce((s, r) => s + r.purchaseReturnValue, 0),
        closingValue: items.reduce((s, r) => s + r.closingValue, 0),
      }));
  }, [itemRows]);

  const grandTotals = useMemo(() => ({
    openingValue: groupedData.reduce((s, g) => s + g.openingValue, 0),
    purchaseValue: groupedData.reduce((s, g) => s + g.purchaseValue, 0),
    salesReturnValue: groupedData.reduce((s, g) => s + g.salesReturnValue, 0),
    saleValue: groupedData.reduce((s, g) => s + g.saleValue, 0),
    purchaseReturnValue: groupedData.reduce((s, g) => s + g.purchaseReturnValue, 0),
    closingValue: groupedData.reduce((s, g) => s + g.closingValue, 0),
  }), [groupedData]);

  // Flatten for PDF/CSV
  const flatRows = useMemo(() => {
    const rows: StockRow[] = [];
    groupedData.forEach(g => rows.push(...g.items));
    return rows;
  }, [groupedData]);

  const flatTotals = useMemo(() => ({
    openingQty: flatRows.reduce((s, r) => s + r.openingQty, 0),
    purchaseQty: flatRows.reduce((s, r) => s + r.purchaseQty, 0),
    saleQty: flatRows.reduce((s, r) => s + r.saleQty, 0),
    adjustmentQty: 0,
    closingQty: flatRows.reduce((s, r) => s + r.closingQty, 0),
    openingValue: grandTotals.openingValue,
    closingValue: grandTotals.closingValue,
  }), [flatRows, grandTotals]);

  // Exports
  const csvHeaders = ['Group', 'Item Code', 'Item Name', 'Unit', 'Open Qty', 'Open Value', 'Purchase Qty', 'Purchase Value', 'Sales Return Qty', 'Sales Return Value', 'Sale Qty', 'Sale Value', 'Purchase Return Qty', 'Purchase Return Value', 'Close Qty', 'Close Value'];
  const csvRows = () => flatRows.map(r => [
    r.stockGroup, r.itemCode, r.name, r.unit,
    r.openingQty, r.openingValue,
    r.purchaseQty, r.purchaseValue,
    r.salesReturnQty, r.salesReturnValue,
    r.saleQty, r.saleValue,
    r.purchaseReturnQty, r.purchaseReturnValue,
    r.closingQty, r.closingValue,
  ]);

  const handleCSV = () => downloadCSV(csvHeaders, csvRows(), `closing-stock-${fy}`);
  const handleExcel = () => downloadExcelSingle(csvHeaders, csvRows(), `closing-stock-${fy}`, 'Closing Stock');
  const handlePDF = () => generateClosingStockPDF(
    groupedData.map(g => ({
      group: g.group,
      items: g.items.map(r => ({
        name: r.name, unit: r.unit, stockGroup: r.stockGroup,
        openingQty: r.openingQty, openingValue: r.openingValue,
        purchaseQty: r.purchaseQty, purchaseValue: r.purchaseValue,
        salesReturnQty: r.salesReturnQty, salesReturnValue: r.salesReturnValue,
        saleQty: r.saleQty, saleValue: r.saleValue,
        purchaseReturnQty: r.purchaseReturnQty, purchaseReturnValue: r.purchaseReturnValue,
        closingQty: r.closingQty, closingValue: r.closingValue,
      })),
      openingValue: g.openingValue, purchaseValue: g.purchaseValue, salesReturnValue: g.salesReturnValue,
      saleValue: g.saleValue, purchaseReturnValue: g.purchaseReturnValue, closingValue: g.closingValue,
    })),
    grandTotals, society, language
  );

  const fyLabel = fyDates ? `1-Apr-${fyDates.start.split('-')[0]} to 31-Mar-${fyDates.end.split('-')[0]}` : fy;

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
            <p className="text-sm text-muted-foreground">{fyLabel}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={expandAll}>{hi ? 'सब खोलें' : 'Expand All'}</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>{hi ? 'सब बंद' : 'Collapse All'}</Button>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: hi ? 'प्रारंभिक माल' : 'Opening Stock', value: fmtV(grandTotals.openingValue), color: 'text-blue-700' },
          { label: hi ? 'क्रय' : 'Purchases', value: fmtV(grandTotals.purchaseValue), color: 'text-green-700' },
          { label: hi ? 'बिक्री वापसी' : 'Sales Return', value: fmtV(grandTotals.salesReturnValue), color: 'text-teal-700' },
          { label: hi ? 'बिक्री' : 'Sales', value: fmtV(grandTotals.saleValue), color: 'text-red-600' },
          { label: hi ? 'क्रय वापसी' : 'Purchase Return', value: fmtV(grandTotals.purchaseReturnValue), color: 'text-amber-700' },
          { label: hi ? 'समापन माल' : 'Closing Stock', value: fmtV(grandTotals.closingValue), color: 'text-emerald-700' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>Rs. {c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">
            {hi ? 'श्रेणी-वार समापन माल विवरण' : 'Category-wise Closing Stock Statement'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {groupedData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई माल नहीं मिला' : 'No stock items found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="border-r align-bottom">{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    <TableHead colSpan={2} className="text-center border-r bg-blue-50 dark:bg-blue-900/20">{hi ? 'प्रारंभिक शेष' : 'Opening'}</TableHead>
                    <TableHead colSpan={2} className="text-center border-r bg-green-50 dark:bg-green-900/20">{hi ? 'क्रय' : 'Purchase'}</TableHead>
                    <TableHead colSpan={2} className="text-center border-r bg-teal-50 dark:bg-teal-900/20">{hi ? 'बिक्री वापसी' : 'Sales Return'}</TableHead>
                    <TableHead colSpan={2} className="text-center border-r bg-red-50 dark:bg-red-900/20">{hi ? 'बिक्री' : 'Sales'}</TableHead>
                    <TableHead colSpan={2} className="text-center border-r bg-amber-50 dark:bg-amber-900/20">{hi ? 'क्रय वापसी' : 'Purchase Return'}</TableHead>
                    <TableHead colSpan={2} className="text-center bg-emerald-50 dark:bg-emerald-900/20">{hi ? 'समापन शेष' : 'Closing'}</TableHead>
                  </TableRow>
                  <TableRow>
                    {[0, 1, 2, 3, 4].map(i => (
                      <React.Fragment key={i}>
                        <TableHead className="text-right text-xs">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                        <TableHead className="text-right border-r text-xs">{hi ? 'मूल्य' : 'Value'}</TableHead>
                      </React.Fragment>
                    ))}
                    {/* Closing (no trailing border) */}
                    <TableHead className="text-right text-xs">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="text-right text-xs">{hi ? 'मूल्य' : 'Value'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedData.map(group => (
                    <React.Fragment key={group.group}>
                      {/* Group Header Row */}
                      <TableRow
                        className="bg-primary/10 font-semibold cursor-pointer hover:bg-primary/20"
                        onClick={() => toggleGroup(group.group)}
                      >
                        <TableCell className="border-r font-bold">{group.group}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right border-r font-semibold">{fmtV(group.openingValue)}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right border-r font-semibold">{fmtV(group.purchaseValue)}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right border-r font-semibold">{fmtV(group.salesReturnValue)}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right border-r font-semibold">{fmtV(group.saleValue)}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right border-r font-semibold">{fmtV(group.purchaseReturnValue)}</TableCell>
                        <TableCell></TableCell><TableCell className="text-right font-semibold text-emerald-700">{fmtV(group.closingValue)}</TableCell>
                      </TableRow>

                      {/* Expanded Items */}
                      {expandedGroups.has(group.group) && group.items.map(r => (
                        <TableRow key={r.itemCode} className="hover:bg-muted/30 text-sm">
                          <TableCell className="border-r pl-6 text-muted-foreground">{r.name}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.openingQty)} {r.openingQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.openingValue > 0 ? fmtV(r.openingValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.purchaseQty)} {r.purchaseQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.purchaseValue > 0 ? fmtV(r.purchaseValue) : ''}</TableCell>
                          <TableCell className="text-right text-teal-700">{fmtQ(r.salesReturnQty)} {r.salesReturnQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right border-r text-teal-700">{r.salesReturnValue > 0 ? fmtV(r.salesReturnValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.saleQty)} {r.saleQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.saleValue > 0 ? fmtV(r.saleValue) : ''}</TableCell>
                          <TableCell className="text-right text-amber-700">{fmtQ(r.purchaseReturnQty)} {r.purchaseReturnQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right border-r text-amber-700">{r.purchaseReturnValue > 0 ? fmtV(r.purchaseReturnValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.closingQty)} {r.closingQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-700">{r.closingValue > 0 ? fmtV(r.closingValue) : ''}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Grand Total */}
                  <TableRow className="bg-primary/20 font-bold text-sm">
                    <TableCell className="border-r">{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right border-r">{fmtV(grandTotals.openingValue)}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right border-r">{fmtV(grandTotals.purchaseValue)}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right border-r text-teal-700">{fmtV(grandTotals.salesReturnValue)}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right border-r">{fmtV(grandTotals.saleValue)}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right border-r text-amber-700">{fmtV(grandTotals.purchaseReturnValue)}</TableCell>
                    <TableCell></TableCell><TableCell className="text-right text-emerald-700">{fmtV(grandTotals.closingValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-800 dark:text-emerald-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'श्रेणी पंक्ति पर क्लिक करें मदों को देखने/छुपाने के लिए। समापन शेष = प्रारंभिक + क्रय + बिक्री वापसी − बिक्री − क्रय वापसी। मदों की श्रेणी इन्वेंटरी में "Stock Group" फ़ील्ड से आती है।'
            : 'Click a category row to expand/collapse items. Closing = Opening + Purchase + Sales Return − Sales − Purchase Return. Item categories come from the "Stock Group" field in Inventory.'}
        </span>
      </div>

      {/* Signature */}
      <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
        {[hi ? 'लेखाकार' : 'Accountant', hi ? 'सचिव' : 'Secretary', hi ? 'अध्यक्ष' : 'Chairman'].map(label => (
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
