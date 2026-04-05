/**
 * Closing Stock Report — Category-wise grouped with 4-section format:
 * Opening Balance → Inwards → Outwards → Closing Balance
 * Each section: Quantity, Rate, Value
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

const fmtV = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtQ = (n: number) => n > 0 ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) : '';

interface StockRow {
  itemCode: string;
  name: string;
  unit: string;
  stockGroup: string;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  inwardQty: number;
  inwardRate: number;
  inwardValue: number;
  outwardQty: number;
  outwardRate: number;
  outwardValue: number;
  closingQty: number;
  closingRate: number;
  closingValue: number;
}

interface GroupSummary {
  group: string;
  items: StockRow[];
  openingValue: number;
  inwardValue: number;
  outwardValue: number;
  closingValue: number;
}

const ClosingStockReport: React.FC = () => {
  const { language } = useLanguage();
  const { society, stockItems, stockMovements } = useData();
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
        const fyMovements = stockMovements.filter(m => m.itemId === item.id && m.date >= fyDates.start && m.date <= fyDates.end);

        const inwardMoves = fyMovements.filter(m => m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0));
        const outwardMoves = fyMovements.filter(m => m.type === 'sale' || (m.type === 'adjustment' && m.qty < 0));

        const inwardQty = inwardMoves.reduce((s, m) => s + Math.abs(m.qty), 0);
        const inwardValue = inwardMoves.reduce((s, m) => s + Math.abs(m.amount), 0);
        const inwardRate = inwardQty > 0 ? inwardValue / inwardQty : 0;

        const outwardQty = outwardMoves.reduce((s, m) => s + Math.abs(m.qty), 0);
        const outwardValue = outwardMoves.reduce((s, m) => s + Math.abs(m.amount), 0);
        const outwardRate = outwardQty > 0 ? outwardValue / outwardQty : 0;

        const openingQty = item.openingStock || 0;
        const openingRate = item.purchaseRate || 0;
        const openingValue = openingQty * openingRate;

        const closingQty = Math.max(0, openingQty + inwardQty - outwardQty);
        const closingRate = item.purchaseRate || 0;
        const closingValue = closingQty * closingRate;

        return {
          itemCode: item.itemCode,
          name: item.name,
          unit: item.unit,
          stockGroup: item.stockGroup || 'General',
          openingQty, openingRate, openingValue,
          inwardQty, inwardRate, inwardValue,
          outwardQty, outwardRate, outwardValue,
          closingQty, closingRate, closingValue,
        };
      })
      .filter(r => r.openingQty > 0 || r.inwardQty > 0 || r.outwardQty > 0 || r.closingQty > 0);
  }, [stockItems, stockMovements, fyDates]);

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
        inwardValue: items.reduce((s, r) => s + r.inwardValue, 0),
        outwardValue: items.reduce((s, r) => s + r.outwardValue, 0),
        closingValue: items.reduce((s, r) => s + r.closingValue, 0),
      }));
  }, [itemRows]);

  const grandTotals = useMemo(() => ({
    openingValue: groupedData.reduce((s, g) => s + g.openingValue, 0),
    inwardValue: groupedData.reduce((s, g) => s + g.inwardValue, 0),
    outwardValue: groupedData.reduce((s, g) => s + g.outwardValue, 0),
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
    purchaseQty: flatRows.reduce((s, r) => s + r.inwardQty, 0),
    saleQty: flatRows.reduce((s, r) => s + r.outwardQty, 0),
    adjustmentQty: 0,
    closingQty: flatRows.reduce((s, r) => s + r.closingQty, 0),
    openingValue: grandTotals.openingValue,
    closingValue: grandTotals.closingValue,
  }), [flatRows, grandTotals]);

  // Exports
  const csvHeaders = ['Group', 'Item Code', 'Item Name', 'Unit', 'Open Qty', 'Open Rate', 'Open Value', 'Inward Qty', 'Inward Rate', 'Inward Value', 'Outward Qty', 'Outward Rate', 'Outward Value', 'Close Qty', 'Close Rate', 'Close Value'];
  const csvRows = () => flatRows.map(r => [
    r.stockGroup, r.itemCode, r.name, r.unit,
    r.openingQty, r.openingRate, r.openingValue,
    r.inwardQty, r.inwardRate, r.inwardValue,
    r.outwardQty, r.outwardRate, r.outwardValue,
    r.closingQty, r.closingRate, r.closingValue,
  ]);

  const handleCSV = () => downloadCSV(csvHeaders, csvRows(), `closing-stock-${fy}`);
  const handleExcel = () => downloadExcelSingle(csvHeaders, csvRows(), `closing-stock-${fy}`, 'Closing Stock');
  const handlePDF = () => generateClosingStockPDF(
    flatRows.map(r => ({
      itemCode: r.itemCode, name: r.name, unit: r.unit, hsnCode: '',
      openingQty: r.openingQty, purchaseQty: r.inwardQty, saleQty: r.outwardQty,
      adjustmentQty: 0, closingQty: r.closingQty, rate: r.closingRate, closingValue: r.closingValue,
    })),
    flatTotals, society, language
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: hi ? 'प्रारंभिक माल' : 'Opening Stock', value: fmtV(grandTotals.openingValue), color: 'text-blue-700' },
          { label: hi ? 'अंतर्वाह (क्रय)' : 'Inwards (Purchases)', value: fmtV(grandTotals.inwardValue), color: 'text-green-700' },
          { label: hi ? 'बहिर्वाह (बिक्री)' : 'Outwards (Sales)', value: fmtV(grandTotals.outwardValue), color: 'text-red-600' },
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
                    <TableHead colSpan={3} className="text-center border-r bg-blue-50 dark:bg-blue-900/20">{hi ? 'प्रारंभिक शेष' : 'Opening Balance'}</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-green-50 dark:bg-green-900/20">{hi ? 'अंतर्वाह' : 'Inwards'}</TableHead>
                    <TableHead colSpan={3} className="text-center border-r bg-red-50 dark:bg-red-900/20">{hi ? 'बहिर्वाह' : 'Outwards'}</TableHead>
                    <TableHead colSpan={3} className="text-center bg-emerald-50 dark:bg-emerald-900/20">{hi ? 'समापन शेष' : 'Closing Balance'}</TableHead>
                  </TableRow>
                  <TableRow>
                    {/* Opening */}
                    <TableHead className="text-right border-r text-xs">{hi ? 'मात्रा' : 'Quantity'}</TableHead>
                    <TableHead className="text-right text-xs">{hi ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-right border-r text-xs">{hi ? 'मूल्य' : 'Value'}</TableHead>
                    {/* Inwards */}
                    <TableHead className="text-right text-xs">{hi ? 'मात्रा' : 'Quantity'}</TableHead>
                    <TableHead className="text-right text-xs">{hi ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-right border-r text-xs">{hi ? 'मूल्य' : 'Value'}</TableHead>
                    {/* Outwards */}
                    <TableHead className="text-right text-xs">{hi ? 'मात्रा' : 'Quantity'}</TableHead>
                    <TableHead className="text-right text-xs">{hi ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-right border-r text-xs">{hi ? 'मूल्य' : 'Value'}</TableHead>
                    {/* Closing */}
                    <TableHead className="text-right text-xs">{hi ? 'मात्रा' : 'Quantity'}</TableHead>
                    <TableHead className="text-right text-xs">{hi ? 'दर' : 'Rate'}</TableHead>
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
                        <TableCell className="border-r"></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right border-r font-semibold">{fmtV(group.openingValue)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right border-r font-semibold">{fmtV(group.inwardValue)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right border-r font-semibold">{fmtV(group.outwardValue)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700">{fmtV(group.closingValue)}</TableCell>
                      </TableRow>

                      {/* Expanded Items */}
                      {expandedGroups.has(group.group) && group.items.map(r => (
                        <TableRow key={r.itemCode} className="hover:bg-muted/30 text-sm">
                          <TableCell className="border-r pl-6 text-muted-foreground">{r.name}</TableCell>
                          <TableCell className="text-right border-r">{fmtQ(r.openingQty)} {r.unit}</TableCell>
                          <TableCell className="text-right">{r.openingRate > 0 ? fmtV(r.openingRate) : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.openingValue > 0 ? fmtV(r.openingValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.inwardQty)} {r.inwardQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right">{r.inwardRate > 0 ? fmtV(r.inwardRate) : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.inwardValue > 0 ? fmtV(r.inwardValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.outwardQty)} {r.outwardQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right">{r.outwardRate > 0 ? fmtV(r.outwardRate) : ''}</TableCell>
                          <TableCell className="text-right border-r">{r.outwardValue > 0 ? fmtV(r.outwardValue) : ''}</TableCell>
                          <TableCell className="text-right">{fmtQ(r.closingQty)} {r.closingQty > 0 ? r.unit : ''}</TableCell>
                          <TableCell className="text-right">{r.closingRate > 0 ? fmtV(r.closingRate) : ''}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-700">{r.closingValue > 0 ? fmtV(r.closingValue) : ''}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Grand Total */}
                  <TableRow className="bg-primary/20 font-bold text-base">
                    <TableCell className="border-r">{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                    <TableCell className="border-r"></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right border-r">{fmtV(grandTotals.openingValue)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right border-r">{fmtV(grandTotals.inwardValue)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right border-r">{fmtV(grandTotals.outwardValue)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtV(grandTotals.closingValue)}</TableCell>
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
            ? 'श्रेणी पंक्ति पर क्लिक करें मदों को देखने/छुपाने के लिए। समापन शेष = प्रारंभिक + अंतर्वाह - बहिर्वाह। मदों की श्रेणी इन्वेंटरी में "Stock Group" फ़ील्ड से आती है।'
            : 'Click category row to expand/collapse items. Closing = Opening + Inwards - Outwards. Item categories come from the "Stock Group" field in Inventory.'}
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
