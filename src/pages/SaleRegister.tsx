/**
 * Sale Register Report — Date-wise, party-wise, GST-wise sale listing
 * with PDF/Excel/CSV export for audit and GST filing.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Download, FileSpreadsheet, Info } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateSaleRegisterPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { parseFY } from '@/lib/depreciation';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const SaleRegister: React.FC = () => {
  const { language } = useLanguage();
  const { society, sales } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);

  const [fromDate, setFromDate] = useState(fyDates?.start || '');
  const [toDate, setToDate] = useState(fyDates?.end || '');
  const [partyFilter, setPartyFilter] = useState('');

  const filtered = useMemo(() => {
    return sales
      .filter(s => {
        if (fromDate && s.date < fromDate) return false;
        if (toDate && s.date > toDate) return false;
        if (partyFilter && !s.customerName.toLowerCase().includes(partyFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales, fromDate, toDate, partyFilter]);

  const totals = useMemo(() => ({
    netAmount: filtered.reduce((s, r) => s + r.netAmount, 0),
    cgst: filtered.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: filtered.reduce((s, r) => s + r.sgstAmount, 0),
    igst: filtered.reduce((s, r) => s + r.igstAmount, 0),
    taxAmount: filtered.reduce((s, r) => s + r.taxAmount, 0),
    grandTotal: filtered.reduce((s, r) => s + r.grandTotal, 0),
  }), [filtered]);

  const headers = ['S.No', 'Invoice No', 'Date', 'Party Name', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Tax Total', 'Grand Total', 'Payment'];
  const rows = () => filtered.map((s, i) => [
    i + 1, s.saleNo, fmtDate(s.date), s.customerName,
    s.netAmount, s.cgstAmount, s.sgstAmount, s.igstAmount, s.taxAmount, s.grandTotal,
    s.paymentMode,
  ]);

  const handleCSV = () => downloadCSV(headers, rows(), `sale-register-${fy}`);
  const handleExcel = () => downloadExcelSingle(headers, rows(), `sale-register-${fy}`, 'Sale Register');
  const handlePDF = () => generateSaleRegisterPDF(filtered, totals, society, language, fromDate, toDate);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <ShoppingCart className="h-6 w-6 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {hi ? 'बिक्री रजिस्टर' : 'Sale Register'}
            </h1>
            <p className="text-sm text-muted-foreground">{hi ? 'तिथि-वार बिक्री विवरण GST सहित' : 'Date-wise sale details with GST'}</p>
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
              <Label className="text-xs">{hi ? 'ग्राहक खोजें' : 'Search Customer'}</Label>
              <Input value={partyFilter} onChange={e => setPartyFilter(e.target.value)} className="h-8 text-sm" placeholder={hi ? 'ग्राहक का नाम...' : 'Customer name...'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: hi ? 'कुल बिक्री' : 'Total Invoices', value: String(filtered.length), color: 'text-blue-700' },
          { label: hi ? 'कर योग्य राशि' : 'Taxable Amount', value: fmtAmt(totals.netAmount), color: 'text-foreground' },
          { label: hi ? 'कुल GST' : 'Total GST', value: fmtAmt(totals.taxAmount), color: 'text-amber-700' },
          { label: hi ? 'कुल राशि' : 'Grand Total', value: fmtAmt(totals.grandTotal), color: 'text-green-700' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.color}`}>{c.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{hi ? 'बिक्री विवरण' : 'Sale Details'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई बिक्री नहीं मिली' : 'No sales found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{hi ? 'चालान नं.' : 'Invoice No'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'ग्राहक' : 'Customer'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कर योग्य' : 'Taxable'}</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल कर' : 'Tax'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल राशि' : 'Grand Total'}</TableHead>
                    <TableHead>{hi ? 'भुगतान' : 'Payment'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.saleNo}</TableCell>
                      <TableCell>{fmtDate(s.date)}</TableCell>
                      <TableCell className="font-medium">{s.customerName}</TableCell>
                      <TableCell className="text-right">{fmtAmt(s.netAmount)}</TableCell>
                      <TableCell className="text-right">{s.cgstAmount > 0 ? fmtAmt(s.cgstAmount) : '—'}</TableCell>
                      <TableCell className="text-right">{s.sgstAmount > 0 ? fmtAmt(s.sgstAmount) : '—'}</TableCell>
                      <TableCell className="text-right">{s.igstAmount > 0 ? fmtAmt(s.igstAmount) : '—'}</TableCell>
                      <TableCell className="text-right text-amber-700">{s.taxAmount > 0 ? fmtAmt(s.taxAmount) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtAmt(s.grandTotal)}</TableCell>
                      <TableCell><span className="text-xs px-1.5 py-0.5 rounded bg-muted">{s.paymentMode}</span></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.netAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.cgst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.sgst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.igst)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.taxAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.grandTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{hi ? 'यह रजिस्टर GSTR-1 दाखिल करने और ऑडिट अनुपालन के लिए उपयोग किया जा सकता है।' : 'This register can be used for GSTR-1 filing and audit compliance.'}</span>
      </div>
    </div>
  );
};

export default SaleRegister;
