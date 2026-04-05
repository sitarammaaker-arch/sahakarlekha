/**
 * Purchase Register Report — Date-wise, party-wise, GST+TDS listing
 * with PDF/Excel/CSV export for audit, GST filing, and TDS compliance.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackagePlus, Download, FileSpreadsheet, Info } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generatePurchaseRegisterPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { parseFY } from '@/lib/depreciation';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const PurchaseRegister: React.FC = () => {
  const { language } = useLanguage();
  const { society, purchases } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);

  const [fromDate, setFromDate] = useState(fyDates?.start || '');
  const [toDate, setToDate] = useState(fyDates?.end || '');
  const [partyFilter, setPartyFilter] = useState('');

  const filtered = useMemo(() => {
    return purchases
      .filter(p => {
        if (fromDate && p.date < fromDate) return false;
        if (toDate && p.date > toDate) return false;
        if (partyFilter && !p.supplierName.toLowerCase().includes(partyFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [purchases, fromDate, toDate, partyFilter]);

  const totals = useMemo(() => ({
    netAmount: filtered.reduce((s, r) => s + r.netAmount, 0),
    cgst: filtered.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: filtered.reduce((s, r) => s + r.sgstAmount, 0),
    igst: filtered.reduce((s, r) => s + r.igstAmount, 0),
    taxAmount: filtered.reduce((s, r) => s + r.taxAmount, 0),
    tds: filtered.reduce((s, r) => s + (r.tdsAmount || 0), 0),
    grandTotal: filtered.reduce((s, r) => s + r.grandTotal, 0),
  }), [filtered]);

  const headers = ['S.No', 'Bill No', 'Date', 'Supplier', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Tax Total', 'TDS', 'Grand Total', 'Payment'];
  const rows = () => filtered.map((p, i) => [
    i + 1, p.purchaseNo, fmtDate(p.date), p.supplierName,
    p.netAmount, p.cgstAmount, p.sgstAmount, p.igstAmount, p.taxAmount,
    p.tdsAmount || 0, p.grandTotal, p.paymentMode,
  ]);

  const handleCSV = () => downloadCSV(headers, rows(), `purchase-register-${fy}`);
  const handleExcel = () => downloadExcelSingle(headers, rows(), `purchase-register-${fy}`, 'Purchase Register');
  const handlePDF = () => generatePurchaseRegisterPDF(filtered, totals, society, language, fromDate, toDate);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <PackagePlus className="h-6 w-6 text-orange-700 dark:text-orange-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {hi ? 'क्रय रजिस्टर' : 'Purchase Register'}
            </h1>
            <p className="text-sm text-muted-foreground">{hi ? 'तिथि-वार क्रय विवरण GST एवं TDS सहित' : 'Date-wise purchase details with GST & TDS'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDF}><Download className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'तिथि से' : 'From Date'}</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'तिथि तक' : 'To Date'}</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">{hi ? 'आपूर्तिकर्ता खोजें' : 'Search Supplier'}</Label>
              <Input value={partyFilter} onChange={e => setPartyFilter(e.target.value)} className="h-8 text-sm" placeholder={hi ? 'आपूर्तिकर्ता का नाम...' : 'Supplier name...'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: hi ? 'कुल बिल' : 'Total Bills', value: String(filtered.length), color: 'text-orange-700' },
          { label: hi ? 'कर योग्य राशि' : 'Taxable Amount', value: fmtAmt(totals.netAmount), color: 'text-foreground' },
          { label: hi ? 'कुल GST' : 'Total GST', value: fmtAmt(totals.taxAmount), color: 'text-amber-700' },
          { label: hi ? 'कुल TDS' : 'Total TDS', value: fmtAmt(totals.tds), color: 'text-red-600' },
          { label: hi ? 'कुल राशि' : 'Grand Total', value: fmtAmt(totals.grandTotal), color: 'text-green-700' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.color}`}>{c.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{hi ? 'क्रय विवरण' : 'Purchase Details'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackagePlus className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई क्रय नहीं मिला' : 'No purchases found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{hi ? 'बिल नं.' : 'Bill No'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कर योग्य' : 'Taxable'}</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल कर' : 'Tax'}</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल राशि' : 'Grand Total'}</TableHead>
                    <TableHead>{hi ? 'भुगतान' : 'Payment'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{p.purchaseNo}</TableCell>
                      <TableCell>{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{p.supplierName}</TableCell>
                      <TableCell className="text-right">{fmtAmt(p.netAmount)}</TableCell>
                      <TableCell className="text-right">{p.cgstAmount > 0 ? fmtAmt(p.cgstAmount) : '—'}</TableCell>
                      <TableCell className="text-right">{p.sgstAmount > 0 ? fmtAmt(p.sgstAmount) : '—'}</TableCell>
                      <TableCell className="text-right">{p.igstAmount > 0 ? fmtAmt(p.igstAmount) : '—'}</TableCell>
                      <TableCell className="text-right text-amber-700">{p.taxAmount > 0 ? fmtAmt(p.taxAmount) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600">{(p.tdsAmount || 0) > 0 ? fmtAmt(p.tdsAmount) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtAmt(p.grandTotal)}</TableCell>
                      <TableCell><span className="text-xs px-1.5 py-0.5 rounded bg-muted">{p.paymentMode}</span></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.netAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.cgst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.sgst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.igst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.taxAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.tds)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.grandTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-800 dark:text-orange-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{hi ? 'यह रजिस्टर GSTR-3B ITC दावे, TDS रिटर्न और ऑडिट अनुपालन के लिए उपयोग किया जा सकता है।' : 'This register can be used for GSTR-3B ITC claims, TDS returns, and audit compliance.'}</span>
      </div>
    </div>
  );
};

export default PurchaseRegister;
