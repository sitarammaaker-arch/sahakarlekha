import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { generateGstSummaryPDF } from '@/lib/pdf';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

// Derive current FY bounds from a FY string like "2024-25"
function fyBounds(fy: string): { from: string; to: string } {
  const parts = fy.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;
  return { from: `${startYear}-04-01`, to: `${endYear}-03-31` };
}

export default function GstSummary() {
  const { sales, purchases, society } = useData();
  const { language } = useLanguage();

  const { from: defaultFrom, to: defaultTo } = fyBounds(society.financialYear);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const hi = language === 'hi';

  // ── Filter active records in date range ───────────────────────────────────
  const activeSales = useMemo(() =>
    sales.filter(s => !(s as any).isDeleted && s.date >= fromDate && s.date <= toDate),
    [sales, fromDate, toDate]);

  const activePurchases = useMemo(() =>
    purchases.filter(p => !(p as any).isDeleted && p.date >= fromDate && p.date <= toDate),
    [purchases, fromDate, toDate]);

  // ── Output Tax (Sales) ─────────────────────────────────────────────────────
  // Group by GST rate (cgstPct + sgstPct or igstPct)
  interface GstSlabRow {
    rate: number;      // total GST rate e.g. 5, 12, 18, 28
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    count: number;
  }

  const outputByRate = useMemo(() => {
    const map = new Map<number, GstSlabRow>();
    for (const s of activeSales) {
      const rate = s.cgstPct + s.sgstPct + s.igstPct;
      if (rate === 0 && s.taxAmount === 0) continue; // exempt / nil-rated
      const existing = map.get(rate) ?? { rate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
      existing.taxableAmount += s.netAmount;
      existing.cgst += s.cgstAmount;
      existing.sgst += s.sgstAmount;
      existing.igst += s.igstAmount;
      existing.total += s.taxAmount;
      existing.count += 1;
      map.set(rate, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }, [activeSales]);

  // Nil / exempt sales
  const nilSales = useMemo(() =>
    activeSales.filter(s => s.taxAmount === 0),
    [activeSales]);

  const outputTotals = useMemo(() => ({
    taxable: activeSales.reduce((s, r) => s + r.netAmount, 0),
    cgst: activeSales.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: activeSales.reduce((s, r) => s + r.sgstAmount, 0),
    igst: activeSales.reduce((s, r) => s + r.igstAmount, 0),
    tax: activeSales.reduce((s, r) => s + r.taxAmount, 0),
    grand: activeSales.reduce((s, r) => s + r.grandTotal, 0),
  }), [activeSales]);

  // ── Input Tax Credit (Purchases) ──────────────────────────────────────────
  const itcByRate = useMemo(() => {
    const map = new Map<number, GstSlabRow>();
    for (const p of activePurchases) {
      const rate = p.cgstPct + p.sgstPct + p.igstPct;
      if (rate === 0 && p.taxAmount === 0) continue;
      const existing = map.get(rate) ?? { rate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
      existing.taxableAmount += p.netAmount;
      existing.cgst += p.cgstAmount;
      existing.sgst += p.sgstAmount;
      existing.igst += p.igstAmount;
      existing.total += p.taxAmount;
      existing.count += 1;
      map.set(rate, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }, [activePurchases]);

  const itcTotals = useMemo(() => ({
    taxable: activePurchases.reduce((s, r) => s + r.netAmount, 0),
    cgst: activePurchases.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: activePurchases.reduce((s, r) => s + r.sgstAmount, 0),
    igst: activePurchases.reduce((s, r) => s + r.igstAmount, 0),
    tax: activePurchases.reduce((s, r) => s + r.taxAmount, 0),
    grand: activePurchases.reduce((s, r) => s + r.grandTotal, 0),
  }), [activePurchases]);

  // Net GST payable / refundable
  const netCgst = outputTotals.cgst - itcTotals.cgst;
  const netSgst = outputTotals.sgst - itcTotals.sgst;
  const netIgst = outputTotals.igst - itcTotals.igst;
  const netGst  = outputTotals.tax  - itcTotals.tax;

  // ── Rate slab summary table ───────────────────────────────────────────────
  const allRates = Array.from(new Set([
    ...outputByRate.map(r => r.rate),
    ...itcByRate.map(r => r.rate),
  ])).sort((a, b) => a - b);

  const handleDownload = () => {
    generateGstSummaryPDF({
      society,
      fromDate,
      toDate,
      outputByRate,
      outputTotals,
      itcByRate,
      itcTotals,
      netCgst,
      netSgst,
      netIgst,
      netGst,
      language,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-blue-600" />
            {hi ? 'GST सारांश रिपोर्ट' : 'GST Summary Report'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hi ? 'आउटपुट टैक्स एवं इनपुट टैक्स क्रेडिट (ITC) सारांश' : 'Output Tax & Input Tax Credit (ITC) Summary'}
          </p>
        </div>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          {hi ? 'PDF डाउनलोड' : 'Download PDF'}
        </Button>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label>{hi ? 'दिनांक से' : 'From Date'}</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{hi ? 'दिनांक तक' : 'To Date'}</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const { from, to } = fyBounds(society.financialYear);
                setFromDate(from); setToDate(to);
              }}>
                {hi ? 'वित्त वर्ष' : 'Current FY'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const now = new Date();
                const y = now.getFullYear(), m = now.getMonth() + 1;
                const firstDay = `${y}-${String(m).padStart(2,'0')}-01`;
                const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
                setFromDate(firstDay); setToDate(lastDay);
              }}>
                {hi ? 'इस माह' : 'This Month'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-700 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">{hi ? 'कुल बिक्री' : 'Total Sales'}</span>
            </div>
            <p className="text-lg font-bold text-green-800">{fmt(outputTotals.grand)}</p>
            <p className="text-xs text-green-600">{activeSales.length} {hi ? 'बिल' : 'bills'}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">{hi ? 'कुल खरीद' : 'Total Purchases'}</span>
            </div>
            <p className="text-lg font-bold text-blue-800">{fmt(itcTotals.grand)}</p>
            <p className="text-xs text-blue-600">{activePurchases.length} {hi ? 'बिल' : 'bills'}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-orange-700 mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium">{hi ? 'आउटपुट GST' : 'Output GST'}</span>
            </div>
            <p className="text-lg font-bold text-orange-800">{fmt(outputTotals.tax)}</p>
            <p className="text-xs text-orange-600">CGST {fmt(outputTotals.cgst)} + SGST {fmt(outputTotals.sgst)}</p>
          </CardContent>
        </Card>
        <Card className={netGst >= 0 ? 'border-red-200 bg-red-50' : 'border-purple-200 bg-purple-50'}>
          <CardContent className="pt-4">
            <div className={`flex items-center gap-2 mb-1 ${netGst >= 0 ? 'text-red-700' : 'text-purple-700'}`}>
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium">{hi ? 'शुद्ध GST देय' : 'Net GST Payable'}</span>
            </div>
            <p className={`text-lg font-bold ${netGst >= 0 ? 'text-red-800' : 'text-purple-800'}`}>{fmt(Math.abs(netGst))}</p>
            <Badge variant={netGst >= 0 ? 'destructive' : 'secondary'} className="text-xs mt-0.5">
              {netGst >= 0 ? (hi ? 'देय' : 'Payable') : (hi ? 'वापसी योग्य' : 'Refundable')}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output">
            {hi ? 'आउटपुट टैक्स (बिक्री)' : 'Output Tax (Sales)'}
          </TabsTrigger>
          <TabsTrigger value="itc">
            {hi ? 'इनपुट टैक्स क्रेडिट (खरीद)' : 'Input Tax Credit (Purchases)'}
          </TabsTrigger>
          <TabsTrigger value="net">
            {hi ? 'शुद्ध GST विवरण' : 'Net GST Statement'}
          </TabsTrigger>
        </TabsList>

        {/* Output Tax tab */}
        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                {hi ? 'GST आउटपुट — दर अनुसार सारांश' : 'GST Output — Summary by Rate'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outputByRate.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {hi ? 'इस अवधि में कोई GST युक्त बिक्री नहीं' : 'No taxable sales in this period'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'GST दर' : 'GST Rate'}</TableHead>
                      <TableHead>{hi ? 'बिल संख्या' : 'Bills'}</TableHead>
                      <TableHead className="text-right">{hi ? 'कर योग्य राशि' : 'Taxable Value'}</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">{hi ? 'कुल GST' : 'Total GST'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputByRate.map(row => (
                      <TableRow key={row.rate}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{pct(row.rate)}</Badge>
                        </TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.taxableAmount)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.cgst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.sgst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.igst)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    {nilSales.length > 0 && (
                      <TableRow className="text-muted-foreground">
                        <TableCell><Badge variant="secondary">{hi ? 'शून्य' : 'Nil/Exempt'}</Badge></TableCell>
                        <TableCell>{nilSales.length}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(nilSales.reduce((s, r) => s + r.netAmount, 0))}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    )}
                    {/* Totals row */}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.taxable)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.cgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.sgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.igst)}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">{fmt(outputTotals.tax)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ITC tab */}
        <TabsContent value="itc">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-600" />
                {hi ? 'इनपुट टैक्स क्रेडिट — दर अनुसार सारांश' : 'Input Tax Credit — Summary by Rate'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itcByRate.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {hi ? 'इस अवधि में कोई GST युक्त खरीद नहीं' : 'No taxable purchases in this period'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'GST दर' : 'GST Rate'}</TableHead>
                      <TableHead>{hi ? 'बिल संख्या' : 'Bills'}</TableHead>
                      <TableHead className="text-right">{hi ? 'कर योग्य राशि' : 'Taxable Value'}</TableHead>
                      <TableHead className="text-right">CGST (ITC)</TableHead>
                      <TableHead className="text-right">SGST (ITC)</TableHead>
                      <TableHead className="text-right">IGST (ITC)</TableHead>
                      <TableHead className="text-right">{hi ? 'कुल ITC' : 'Total ITC'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itcByRate.map(row => (
                      <TableRow key={row.rate}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{pct(row.rate)}</Badge>
                        </TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.taxableAmount)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.cgst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.sgst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.igst)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(itcTotals.taxable)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(itcTotals.cgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(itcTotals.sgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(itcTotals.igst)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcTotals.tax)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Net GST Statement tab */}
        <TabsContent value="net">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {hi ? 'शुद्ध GST देयता विवरण' : 'Net GST Liability Statement'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                      <TableHead className="text-right">CGST (₹)</TableHead>
                      <TableHead className="text-right">SGST (₹)</TableHead>
                      <TableHead className="text-right">IGST (₹)</TableHead>
                      <TableHead className="text-right">{hi ? 'कुल GST (₹)' : 'Total GST (₹)'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-green-700">
                        {hi ? 'आउटपुट टैक्स (बिक्री पर GST)' : 'Output Tax (GST on Sales)'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.cgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.sgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.igst)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-700">{fmt(outputTotals.tax)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-blue-700">
                        {hi ? 'कम: इनपुट टैक्स क्रेडिट (खरीद पर GST)' : 'Less: Input Tax Credit (GST on Purchases)'}
                      </TableCell>
                      <TableCell className="text-right font-mono">({fmt(itcTotals.cgst)})</TableCell>
                      <TableCell className="text-right font-mono">({fmt(itcTotals.sgst)})</TableCell>
                      <TableCell className="text-right font-mono">({fmt(itcTotals.igst)})</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-blue-700">({fmt(itcTotals.tax)})</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-muted/50">
                      <TableCell className="font-bold">
                        {netGst >= 0
                          ? (hi ? 'शुद्ध GST देय' : 'Net GST Payable')
                          : (hi ? 'शुद्ध GST वापसी योग्य' : 'Net GST Refundable')}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${netCgst >= 0 ? 'text-red-700' : 'text-purple-700'}`}>
                        {fmt(Math.abs(netCgst))}
                        <span className="text-xs ml-1">{netCgst >= 0 ? 'Dr' : 'Cr'}</span>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${netSgst >= 0 ? 'text-red-700' : 'text-purple-700'}`}>
                        {fmt(Math.abs(netSgst))}
                        <span className="text-xs ml-1">{netSgst >= 0 ? 'Dr' : 'Cr'}</span>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${netIgst >= 0 ? 'text-red-700' : 'text-purple-700'}`}>
                        {fmt(Math.abs(netIgst))}
                        <span className="text-xs ml-1">{netIgst >= 0 ? 'Dr' : 'Cr'}</span>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-lg ${netGst >= 0 ? 'text-red-700' : 'text-purple-700'}`}>
                        {fmt(Math.abs(netGst))}
                        <Badge variant={netGst >= 0 ? 'destructive' : 'secondary'} className="ml-2 text-xs">
                          {netGst >= 0 ? (hi ? 'देय' : 'Pay') : (hi ? 'वापसी' : 'Refund')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Rate-wise reconciliation */}
              {allRates.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    {hi ? 'दर-अनुसार विवरण' : 'Rate-wise Breakup'}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'GST दर' : 'Rate'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बिक्री योग्य राशि' : 'Sales Taxable'}</TableHead>
                        <TableHead className="text-right">{hi ? 'आउटपुट GST' : 'Output GST'}</TableHead>
                        <TableHead className="text-right">{hi ? 'खरीद योग्य राशि' : 'Purchase Taxable'}</TableHead>
                        <TableHead className="text-right">ITC</TableHead>
                        <TableHead className="text-right">{hi ? 'शुद्ध देय' : 'Net Payable'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRates.map(rate => {
                        const out = outputByRate.find(r => r.rate === rate);
                        const itc = itcByRate.find(r => r.rate === rate);
                        const net = (out?.total ?? 0) - (itc?.total ?? 0);
                        return (
                          <TableRow key={rate}>
                            <TableCell><Badge variant="outline" className="font-mono">{pct(rate)}</Badge></TableCell>
                            <TableCell className="text-right font-mono">{fmt(out?.taxableAmount ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono text-green-700">{fmt(out?.total ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(itc?.taxableAmount ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-700">{fmt(itc?.total ?? 0)}</TableCell>
                            <TableCell className={`text-right font-mono font-semibold ${net >= 0 ? 'text-red-600' : 'text-purple-600'}`}>
                              {net >= 0 ? fmt(net) : `(${fmt(Math.abs(net))})`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
