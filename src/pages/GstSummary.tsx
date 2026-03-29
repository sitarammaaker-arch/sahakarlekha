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
import { FileText, Download, TrendingUp, TrendingDown, Percent, ClipboardList } from 'lucide-react';
import { generateGstSummaryPDF } from '@/lib/pdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // ── GSTR-1: HSN Summary (from sale items with hsnCode) ────────────────────
  const hsnSummary = useMemo(() => {
    const map = new Map<string, { hsn: string; description: string; uqc: string; totalQty: number; taxableValue: number; igst: number; cgst: number; sgst: number }>();
    for (const s of activeSales) {
      for (const item of s.items) {
        const hsn = (item as any).hsnCode || 'N/A';
        const key = hsn;
        const existing = map.get(key) ?? { hsn, description: item.itemName, uqc: item.unit || 'NOS', totalQty: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
        existing.totalQty += item.qty;
        const ratio = s.netAmount > 0 ? (item.qty * item.rate) / s.netAmount : 0;
        existing.taxableValue += item.qty * item.rate;
        existing.igst += s.igstAmount * ratio;
        existing.cgst += s.cgstAmount * ratio;
        existing.sgst += s.sgstAmount * ratio;
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
  }, [activeSales]);

  // ── GSTR-1: B2CS (B2C small — all consumer sales grouped by rate + state) ─
  const b2csSummary = useMemo(() => {
    const map = new Map<number, { rate: number; taxableValue: number; igst: number; cgst: number; sgst: number; count: number }>();
    for (const s of activeSales) {
      const rate = s.cgstPct + s.sgstPct + s.igstPct;
      const existing = map.get(rate) ?? { rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, count: 0 };
      existing.taxableValue += s.netAmount;
      existing.igst += s.igstAmount;
      existing.cgst += s.cgstAmount;
      existing.sgst += s.sgstAmount;
      existing.count++;
      map.set(rate, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }, [activeSales]);

  // ── GSTR-3B: Table 3.1 outward supplies ────────────────────────────────────
  const outwardTaxable = { taxable: outputTotals.taxable, igst: outputTotals.igst, cgst: outputTotals.cgst, sgst: outputTotals.sgst };
  const outwardNil = useMemo(() => {
    const s = activeSales.filter(s => s.taxAmount === 0);
    return { taxable: s.reduce((a, r) => a + r.netAmount, 0), igst: 0, cgst: 0, sgst: 0 };
  }, [activeSales]);

  // ── GSTR-3B: Table 4 ITC ───────────────────────────────────────────────────
  const itcAvailable = { taxable: itcTotals.taxable, igst: itcTotals.igst, cgst: itcTotals.cgst, sgst: itcTotals.sgst };

  // GSTR-3B JSON export
  const handleGstr3bJson = () => {
    const payload = {
      gstin: society.gstNo || 'GSTIN_NOT_SET',
      ret_period: fromDate.slice(0, 7).replace('-', ''),
      sup_details: {
        osup_det: { txval: outwardTaxable.taxable, iamt: outwardTaxable.igst, camt: outwardTaxable.cgst, samt: outwardTaxable.sgst, csamt: 0 },
        osup_zero: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
        osup_nil_exmp: { txval: outwardNil.taxable, iamt: 0, camt: 0, samt: 0, csamt: 0 },
        isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
        osup_nongst: { txval: 0 },
      },
      itc_elg: {
        itc_avl: [
          { ty: 'IMPG', iamt: 0, camt: 0, samt: 0, csamt: 0 },
          { ty: 'IMPS', iamt: 0, camt: 0, samt: 0, csamt: 0 },
          { ty: 'ISRC', iamt: 0, camt: 0, samt: 0, csamt: 0 },
          { ty: 'ISD', iamt: 0, camt: 0, samt: 0, csamt: 0 },
          { ty: 'OTH', iamt: itcAvailable.igst, camt: itcAvailable.cgst, samt: itcAvailable.sgst, csamt: 0 },
        ],
        itc_rev: [
          { ty: 'RUL_42_43', iamt: 0, camt: 0, samt: 0, csamt: 0 },
          { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 },
        ],
      },
      intr_ltfee: { intr_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 } },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GSTR3B_${society.gstNo || 'society'}_${fromDate.slice(0,7)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // GSTR-3B PDF
  const handleGstr3bPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('FORM GSTR-3B', w / 2, 14, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`[See rule 61(5)]`, w / 2, 20, { align: 'center' });
    doc.text(`GSTIN: ${society.gstNo || 'N/A'}  |  ${society.name}  |  Period: ${fromDate} to ${toDate}`, w / 2, 26, { align: 'center' });

    autoTable(doc, {
      startY: 34,
      head: [['3.1', 'Nature of Supplies', 'Total Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']],
      body: [
        ['(a)', 'Outward taxable supplies (other than zero rated, nil, exempted)', outwardTaxable.taxable.toFixed(2), outwardTaxable.igst.toFixed(2), outwardTaxable.cgst.toFixed(2), outwardTaxable.sgst.toFixed(2), '0.00'],
        ['(b)', 'Outward taxable supplies (zero rated)', '0.00', '0.00', '0.00', '0.00', '0.00'],
        ['(c)', 'Other outward supplies (Nil rated, exempted)', outwardNil.taxable.toFixed(2), '0.00', '0.00', '0.00', '0.00'],
        ['(d)', 'Inward supplies (liable to reverse charge)', '0.00', '0.00', '0.00', '0.00', '0.00'],
        ['(e)', 'Non-GST outward supplies', '0.00', '', '', '', ''],
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 65 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: y2,
      head: [['4', 'Eligible ITC', 'IGST', 'CGST', 'SGST', 'Cess']],
      body: [
        ['(A)(v)', 'ITC Available — All other ITC (purchases)', itcAvailable.igst.toFixed(2), itcAvailable.cgst.toFixed(2), itcAvailable.sgst.toFixed(2), '0.00'],
        ['(B)', 'ITC Reversed', '0.00', '0.00', '0.00', '0.00'],
        ['(C)', 'Net ITC Available [(A)-(B)]', itcAvailable.igst.toFixed(2), itcAvailable.cgst.toFixed(2), itcAvailable.sgst.toFixed(2), '0.00'],
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 75 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    const y3 = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: y3,
      head: [['5', 'Values of exempt, nil-rated and non-GST inward supplies', 'Inter-State', 'Intra-State']],
      body: [
        ['(a)', 'From a supplier under composition scheme, exempt & nil rated supply', '0.00', '0.00'],
        ['(b)', 'Non-GST supply', '0.00', '0.00'],
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 82, 163], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    });

    const y4 = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: y4,
      head: [['6.1', 'Payment of Tax', 'IGST', 'CGST', 'SGST', 'Cess']],
      body: [
        ['Tax payable', 'Total Tax Payable (Output)', outwardTaxable.igst.toFixed(2), outwardTaxable.cgst.toFixed(2), outwardTaxable.sgst.toFixed(2), '0.00'],
        ['Less ITC', 'Input Tax Credit Utilised', itcAvailable.igst.toFixed(2), itcAvailable.cgst.toFixed(2), itcAvailable.sgst.toFixed(2), '0.00'],
        ['Net', 'Tax to be paid in Cash', Math.max(0, netIgst).toFixed(2), Math.max(0, netCgst).toFixed(2), Math.max(0, netSgst).toFixed(2), '0.00'],
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    doc.save(`GSTR3B_${society.gstNo || 'society'}_${fromDate.slice(0, 7)}.pdf`);
  };

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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="output">
            {hi ? 'आउटपुट टैक्स (बिक्री)' : 'Output Tax (Sales)'}
          </TabsTrigger>
          <TabsTrigger value="itc">
            {hi ? 'इनपुट टैक्स क्रेडिट (खरीद)' : 'Input Tax Credit (Purchases)'}
          </TabsTrigger>
          <TabsTrigger value="net">
            {hi ? 'शुद्ध GST विवरण' : 'Net GST Statement'}
          </TabsTrigger>
          <TabsTrigger value="gstr1">GSTR-1</TabsTrigger>
          <TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger>
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
        {/* GSTR-1 tab */}
        <TabsContent value="gstr1">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-orange-600" />
                  {hi ? 'GSTR-1 — B2C सारांश (उपभोक्ता बिक्री)' : 'GSTR-1 — B2CS Summary (Consumer Sales)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {hi ? 'नोट: GSTIN-युक्त खरीदारों का डेटा उपलब्ध नहीं है, इसलिए सभी बिक्री B2CS (Small) में दिखाई गई हैं।'
                      : 'Note: Customer GSTIN not stored, so all sales shown as B2CS (Small Consumer).'}
                </p>
                {b2csSummary.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">{hi ? 'कोई बिक्री नहीं' : 'No sales in period'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'GST दर' : 'GST Rate'}</TableHead>
                        <TableHead>{hi ? 'बिल' : 'Bills'}</TableHead>
                        <TableHead className="text-right">{hi ? 'कर योग्य मूल्य' : 'Taxable Value'}</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">{hi ? 'कुल GST' : 'Total GST'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b2csSummary.map(r => (
                        <TableRow key={r.rate}>
                          <TableCell><Badge variant="outline" className="font-mono">{pct(r.rate)}</Badge></TableCell>
                          <TableCell>{r.count}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.taxableValue)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.igst)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.cgst)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.sgst)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(r.igst + r.cgst + r.sgst)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={2}>{hi ? 'कुल' : 'Total'}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(b2csSummary.reduce((s, r) => s + r.taxableValue, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(b2csSummary.reduce((s, r) => s + r.igst, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(b2csSummary.reduce((s, r) => s + r.cgst, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(b2csSummary.reduce((s, r) => s + r.sgst, 0))}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{fmt(outputTotals.tax)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{hi ? 'HSN / SAC सारांश' : 'HSN / SAC Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                {hsnSummary.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">{hi ? 'कोई HSN डेटा नहीं' : 'No HSN data in items'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>HSN/SAC</TableHead>
                        <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
                        <TableHead>UQC</TableHead>
                        <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                        <TableHead className="text-right">{hi ? 'कर योग्य मूल्य' : 'Taxable Value'}</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hsnSummary.map(h => (
                        <TableRow key={h.hsn}>
                          <TableCell className="font-mono font-medium">{h.hsn}</TableCell>
                          <TableCell className="text-sm">{h.description}</TableCell>
                          <TableCell className="text-xs">{h.uqc}</TableCell>
                          <TableCell className="text-right font-mono">{h.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(h.taxableValue)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(h.igst)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(h.cgst)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(h.sgst)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{hi ? 'दस्तावेज़ सारांश' : 'Document Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'दस्तावेज़ प्रकार' : 'Document Type'}</TableHead>
                      <TableHead className="text-right">{hi ? 'कुल जारी' : 'Total Issued'}</TableHead>
                      <TableHead className="text-right">{hi ? 'रद्द' : 'Cancelled'}</TableHead>
                      <TableHead className="text-right">{hi ? 'शुद्ध जारी' : 'Net Issued'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{hi ? 'कर चालान' : 'Invoices for outward supply'}</TableCell>
                      <TableCell className="text-right font-mono">{activeSales.length}</TableCell>
                      <TableCell className="text-right font-mono">0</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{activeSales.length}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GSTR-3B tab */}
        <TabsContent value="gstr3b">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleGstr3bPdf}>
                <Download className="h-4 w-4 mr-2" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleGstr3bJson}>
                <FileText className="h-4 w-4 mr-2" />JSON (GST Portal)
              </Button>
            </div>

            {/* 3.1 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  {hi ? 'सारणी 3.1 — बाह्य आपूर्ति एवं आवक आपूर्ति (रिवर्स चार्ज)' : 'Table 3.1 — Outward Supplies & Inward Supplies liable to Reverse Charge'}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>{hi ? 'आपूर्ति की प्रकृति' : 'Nature of Supplies'}</TableHead>
                      <TableHead className="text-right">{hi ? 'कर योग्य मूल्य' : 'Total Taxable Value'}</TableHead>
                      <TableHead className="text-right">IGST (₹)</TableHead>
                      <TableHead className="text-right">CGST (₹)</TableHead>
                      <TableHead className="text-right">SGST (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: '(a)', label: hi ? 'कर योग्य बाह्य आपूर्ति (शून्य दर, nil, मुक्त को छोड़कर)' : 'Outward taxable supplies (other than zero rated, nil rated and exempted)', data: outwardTaxable },
                      { key: '(b)', label: hi ? 'बाह्य कर योग्य आपूर्ति (शून्य दर)' : 'Outward taxable supplies (zero rated)', data: { taxable: 0, igst: 0, cgst: 0, sgst: 0 } },
                      { key: '(c)', label: hi ? 'अन्य बाह्य आपूर्ति (Nil/मुक्त)' : 'Other outward supplies (Nil rated, exempted)', data: outwardNil },
                      { key: '(d)', label: hi ? 'आवक आपूर्ति (रिवर्स चार्ज)' : 'Inward supplies (liable to reverse charge)', data: { taxable: 0, igst: 0, cgst: 0, sgst: 0 } },
                      { key: '(e)', label: hi ? 'गैर-GST बाह्य आपूर्ति' : 'Non-GST outward supplies', data: { taxable: 0, igst: 0, cgst: 0, sgst: 0 } },
                    ].map(row => (
                      <TableRow key={row.key}>
                        <TableCell className="font-mono text-xs font-medium">{row.key}</TableCell>
                        <TableCell className="text-sm">{row.label}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.data.taxable)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.data.igst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.data.cgst)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.data.sgst)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 4 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  {hi ? 'सारणी 4 — पात्र इनपुट टैक्स क्रेडिट' : 'Table 4 — Eligible ITC'}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{hi ? 'विवरण' : 'Details'}</TableHead>
                      <TableHead className="text-right">IGST (₹)</TableHead>
                      <TableHead className="text-right">CGST (₹)</TableHead>
                      <TableHead className="text-right">SGST (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs">(A)(v)</TableCell>
                      <TableCell className="text-sm">{hi ? 'उपलब्ध ITC — सभी अन्य ITC (खरीद)' : 'ITC Available — All other ITC (purchases)'}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.igst)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.cgst)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.sgst)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-xs">(B)</TableCell>
                      <TableCell className="text-sm">{hi ? 'ITC उलटाई' : 'ITC Reversed'}</TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="font-mono text-xs">(C)</TableCell>
                      <TableCell className="text-sm">{hi ? 'शुद्ध उपलब्ध ITC [(A)-(B)]' : 'Net ITC Available [(A)-(B)]'}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.igst)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.cgst)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">{fmt(itcAvailable.sgst)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 6.1 Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  {hi ? 'सारणी 6.1 — कर का भुगतान' : 'Table 6.1 — Payment of Tax'}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50">
                      <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
                      <TableHead className="text-right">IGST (₹)</TableHead>
                      <TableHead className="text-right">CGST (₹)</TableHead>
                      <TableHead className="text-right">SGST (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{hi ? 'देय कर (आउटपुट)' : 'Tax Payable (Output)'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.igst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.cgst)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(outputTotals.sgst)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{hi ? 'ITC से समायोजित' : 'Adjusted from ITC'}</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">({fmt(itcAvailable.igst)})</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">({fmt(itcAvailable.cgst)})</TableCell>
                      <TableCell className="text-right font-mono text-blue-700">({fmt(itcAvailable.sgst)})</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>{hi ? 'नकद में देय कर' : 'Tax to be paid in Cash'}</TableCell>
                      <TableCell className={`text-right font-mono ${netIgst > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(Math.max(0, netIgst))}</TableCell>
                      <TableCell className={`text-right font-mono ${netCgst > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(Math.max(0, netCgst))}</TableCell>
                      <TableCell className={`text-right font-mono ${netSgst > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(Math.max(0, netSgst))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
