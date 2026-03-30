import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Package, TrendingUp, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { StockMovement, StockItem } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const fmtQty = (n: number, unit: string) => `${n.toFixed(3)} ${unit}`;

interface FifoLayer { qty: number; rate: number }

function valueFifo(movements: StockMovement[], openingStock = 0, openingRate = 0): { qty: number; value: number; avgRate: number } {
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  const layers: FifoLayer[] = openingStock > 0 ? [{ qty: openingStock, rate: openingRate }] : [];

  for (const m of sorted) {
    if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) {
      layers.push({ qty: m.qty, rate: m.rate });
    } else if (m.type === 'sale' || (m.type === 'adjustment' && m.qty < 0)) {
      let remaining = Math.abs(m.qty);
      while (remaining > 0 && layers.length > 0) {
        if (layers[0].qty <= remaining) {
          remaining -= layers[0].qty;
          layers.shift();
        } else {
          layers[0].qty -= remaining;
          remaining = 0;
        }
      }
    }
  }

  const totalQty = layers.reduce((s, l) => s + l.qty, 0);
  const totalValue = layers.reduce((s, l) => s + l.qty * l.rate, 0);
  return { qty: totalQty, value: totalValue, avgRate: totalQty > 0 ? totalValue / totalQty : 0 };
}

function valueWeightedAvg(movements: StockMovement[], openingStock = 0, openingRate = 0): { qty: number; value: number; avgRate: number } {
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let runningQty = openingStock;
  let runningValue = openingStock * openingRate;

  for (const m of sorted) {
    if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) {
      runningQty += m.qty;
      runningValue += m.qty * m.rate;
    } else {
      const avgRate = runningQty > 0 ? runningValue / runningQty : m.rate;
      const qty = Math.min(Math.abs(m.qty), runningQty);
      runningQty -= qty;
      runningValue -= qty * avgRate;
      if (runningValue < 0) runningValue = 0;
    }
  }

  return { qty: runningQty, value: runningValue, avgRate: runningQty > 0 ? runningValue / runningQty : 0 };
}

interface ValuationRow {
  item: StockItem;
  qty: number;
  avgRate: number;
  value: number;
  method: string;
}

export default function StockValuation() {
  const { stockItems, stockMovements, society } = useData();
  const { language } = useLanguage();
  const [method, setMethod] = useState<'fifo' | 'weighted_avg'>('weighted_avg');

  const hi = language === 'hi';

  const activeItems = useMemo(() =>
    stockItems.filter(i => i.isActive),
    [stockItems]);

  const rows: ValuationRow[] = useMemo(() => {
    return activeItems.map(item => {
      const movs = stockMovements.filter(m => m.itemId === item.id);
      // Use item-level method if set, else use global selector
      const itemMethod = item.valuationMethod || method;
      const openingStock = item.openingStock || 0;
      const openingRate = item.purchaseRate || 0;
      const result = itemMethod === 'fifo' ? valueFifo(movs, openingStock, openingRate) : valueWeightedAvg(movs, openingStock, openingRate);
      return {
        item,
        qty: result.qty,
        avgRate: result.avgRate,
        value: result.value,
        method: itemMethod === 'fifo' ? 'FIFO' : 'WA',
      };
    });
  }, [activeItems, stockMovements, method]);

  const totalValue = useMemo(() => rows.reduce((s, r) => s + r.value, 0), [rows]);
  const totalItems = rows.filter(r => r.qty > 0).length;

  const stockHeaders = ['Sr.', 'Code', 'Item Name', 'HSN/SAC', 'Unit', 'GST %', 'Method', 'Qty', 'Rate (₹)', 'Value (₹)'];

  const stockDataRows = () =>
    rows.map((r, i) => [
      i + 1,
      r.item.itemCode,
      r.item.name,
      r.item.hsnCode || r.item.sacCode || '-',
      r.item.unit,
      r.item.gstRate != null ? `${r.item.gstRate}%` : '-',
      r.method,
      r.qty.toFixed(3),
      r.avgRate.toFixed(2),
      r.value.toFixed(2),
    ]);

  const handleCSV = () => {
    downloadCSV(stockHeaders, stockDataRows(), 'stock-valuation');
  };

  const handleExcel = () => {
    downloadExcelSingle(stockHeaders, stockDataRows(), 'stock-valuation', 'Stock Valuation');
  };

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.text(society.name, w / 2, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Stock Valuation Report', w / 2, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Method: ${method === 'fifo' ? 'FIFO' : 'Weighted Average'}`, w / 2, 26, { align: 'center' });

    autoTable(doc, {
      startY: 32,
      head: [[
        'Sr.',
        'Code',
        'Item Name',
        'HSN/SAC',
        'Unit',
        'GST %',
        'Method',
        'Qty',
        'Rate (₹)',
        'Value (₹)',
      ]],
      body: rows.map((r, i) => [
        i + 1,
        r.item.itemCode,
        r.item.name,
        r.item.hsnCode || r.item.sacCode || '-',
        r.item.unit,
        r.item.gstRate != null ? `${r.item.gstRate}%` : '-',
        r.method,
        r.qty.toFixed(3),
        r.avgRate.toFixed(2),
        r.value.toFixed(2),
      ]),
      foot: [['', '', 'Total', '', '', '', '', '', '', totalValue.toFixed(2)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [236, 240, 241], fontStyle: 'bold' },
    });

    doc.save(`stock-valuation-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'स्टॉक मूल्यांकन' : 'Stock Valuation'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'FIFO / भारित औसत विधि से स्टॉक का मूल्य' : 'Inventory value using FIFO or Weighted Average method'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handlePDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />PDF
          </Button>
          <Button onClick={handleExcel} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
          </Button>
          <Button onClick={handleCSV} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल स्टॉक मूल्य' : 'Total Stock Value'}</p>
            <p className="text-2xl font-bold text-green-700">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{hi ? 'स्टॉक वाली वस्तुएं' : 'Items in Stock'}</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल वस्तुएं' : 'Total Items'}</p>
            <p className="text-2xl font-bold">{activeItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Method selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">{hi ? 'वैश्विक विधि:' : 'Default Method:'}</label>
        <Select value={method} onValueChange={(v) => setMethod(v as 'fifo' | 'weighted_avg')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weighted_avg">{hi ? 'भारित औसत (WA)' : 'Weighted Average (WA)'}</SelectItem>
            <SelectItem value="fifo">FIFO (First In First Out)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{hi ? '(वस्तु-स्तर पर ओवरराइड किया जा सकता है)' : '(can be overridden per item in Inventory)'}</span>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{hi ? 'सभी' : 'All Items'}</TabsTrigger>
          <TabsTrigger value="instock">{hi ? 'स्टॉक में' : 'In Stock'}</TabsTrigger>
          <TabsTrigger value="nil">{hi ? 'शून्य स्टॉक' : 'Nil Stock'}</TabsTrigger>
        </TabsList>

        {(['all', 'instock', 'nil'] as const).map(tab => {
          const filtered = tab === 'instock' ? rows.filter(r => r.qty > 0)
            : tab === 'nil' ? rows.filter(r => r.qty <= 0)
            : rows;

          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                          <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                          <TableHead>{hi ? 'HSN/SAC' : 'HSN/SAC'}</TableHead>
                          <TableHead className="text-right">{hi ? 'GST %' : 'GST %'}</TableHead>
                          <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                          <TableHead className="text-right">{hi ? 'औसत दर' : 'Avg Rate'}</TableHead>
                          <TableHead className="text-right">{hi ? 'मूल्य' : 'Value'}</TableHead>
                          <TableHead className="text-center">{hi ? 'विधि' : 'Method'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              {hi ? 'कोई डेटा नहीं' : 'No data available'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map(r => (
                            <TableRow key={r.item.id} className={r.qty <= 0 ? 'opacity-50' : ''}>
                              <TableCell className="font-mono text-xs">{r.item.itemCode}</TableCell>
                              <TableCell>
                                <div>{r.item.name}</div>
                                <div className="text-xs text-muted-foreground">{r.item.nameHi}</div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {r.item.hsnCode || r.item.sacCode || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {r.item.gstRate != null ? `${r.item.gstRate}%` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {fmtQty(r.qty, r.item.unit)}
                              </TableCell>
                              <TableCell className="text-right font-mono">₹{r.avgRate.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {fmt(r.value)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={r.method === 'FIFO' ? 'default' : 'secondary'} className="text-xs">
                                  {r.method}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        {filtered.length > 0 && (
                          <TableRow className="font-bold bg-muted/30">
                            <TableCell colSpan={6} className="text-right">{hi ? 'कुल' : 'Total'}</TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(filtered.reduce((s, r) => s + r.value, 0))}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
