/**
 * Sale Register Report — Date-wise, party-wise, GST-wise sale listing
 * with PDF/Excel/CSV export for audit and GST filing.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Download, FileSpreadsheet, Info, ChevronRight, ChevronDown } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateSaleRegisterPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { parseFY } from '@/lib/depreciation';
import { getBillReceivedMap, getBillStatus } from '@/lib/billUtils';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const SaleRegister: React.FC = () => {
  const { language } = useLanguage();
  const { society, sales, vouchers, matchesActiveBranch } = useData();
  const { salesReturns } = useConsumerData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);
  const receivedMap = useMemo(() => getBillReceivedMap(vouchers), [vouchers]);

  const [fromDate, setFromDate] = useState(fyDates?.start || '');
  const [toDate, setToDate] = useState(fyDates?.end || '');
  const [partyFilter, setPartyFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retExpanded, setRetExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleRetExpand = (id: string) => setRetExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const filtered = useMemo(() => {
    return sales
      .filter(s => {
        if (!matchesActiveBranch(s.branchId)) return false;   // ECR-17 Phase 4: active-branch scope ('all' → no filter)
        if (fromDate && s.date < fromDate) return false;
        if (toDate && s.date > toDate) return false;
        if (partyFilter && !s.customerName.toLowerCase().includes(partyFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales, fromDate, toDate, partyFilter, matchesActiveBranch]);

  const totals = useMemo(() => ({
    netAmount: filtered.reduce((s, r) => s + r.netAmount, 0),
    cgst: filtered.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: filtered.reduce((s, r) => s + r.sgstAmount, 0),
    igst: filtered.reduce((s, r) => s + r.igstAmount, 0),
    taxAmount: filtered.reduce((s, r) => s + r.taxAmount, 0),
    grandTotal: filtered.reduce((s, r) => s + r.grandTotal, 0),
  }), [filtered]);

  // Sales returns (credit notes) in the same date/party window — shown separately, netted.
  const filteredReturns = useMemo(() => salesReturns
    .filter(r => !r.isDeleted
      && (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate)
      && (!partyFilter || (r.customerName || '').toLowerCase().includes(partyFilter.toLowerCase())))
    .sort((a, b) => a.date.localeCompare(b.date)), [salesReturns, fromDate, toDate, partyFilter]);

  const returnTotals = useMemo(() => ({
    netAmount: filteredReturns.reduce((s, r) => s + (r.netAmount || 0), 0),
    taxAmount: filteredReturns.reduce((s, r) => s + (r.taxAmount || 0), 0),
    grandTotal: filteredReturns.reduce((s, r) => s + (r.grandTotal || 0), 0),
  }), [filteredReturns]);

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
      <div className={`grid grid-cols-2 gap-4 ${filteredReturns.length > 0 ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-4'}`}>
        {[
          { label: hi ? 'कुल बिक्री' : 'Total Invoices', value: String(filtered.length), color: 'text-blue-700' },
          { label: hi ? 'कर योग्य राशि' : 'Taxable Amount', value: fmtAmt(totals.netAmount), color: 'text-foreground' },
          { label: hi ? 'कुल GST' : 'Total GST', value: fmtAmt(totals.taxAmount), color: 'text-amber-700' },
          { label: hi ? 'सकल राशि' : 'Gross Total', value: fmtAmt(totals.grandTotal), color: 'text-green-700' },
          ...(filteredReturns.length > 0 ? [
            { label: hi ? 'बिक्री वापसी (−)' : 'Sales Returns (−)', value: fmtAmt(returnTotals.grandTotal), color: 'text-rose-700' },
            { label: hi ? 'शुद्ध बिक्री' : 'Net Sales', value: fmtAmt(totals.grandTotal - returnTotals.grandTotal), color: 'text-emerald-700' },
          ] : []),
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.color}`}>{c.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{hi ? 'बिक्री विवरण' : 'Sale Details'}</CardTitle>
          <p className="text-xs text-muted-foreground">{hi ? 'किसी बिल पर क्लिक करके उसकी वस्तुओं का विवरण (मात्रा/दर/राशि) देखें।' : 'Click an invoice to see its item-wise details (qty / rate / amount).'}</p>
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
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <React.Fragment key={s.id}>
                      <TableRow className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleExpand(s.id)}>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {s.items?.length ? (expanded.has(s.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                            {i + 1}
                          </span>
                        </TableCell>
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
                        <TableCell>
                          {s.paymentMode !== 'credit'
                            ? <span className="text-xs text-success font-medium">{hi ? 'चुकता' : 'Paid'}</span>
                            : (() => {
                                const st = getBillStatus(s, receivedMap[s.id] || 0);
                                const cls = st.status === 'paid' ? 'text-success' : st.status === 'partial' ? 'text-amber-700' : 'text-destructive';
                                const lbl = st.status === 'paid' ? (hi ? 'चुकता' : 'Paid') : st.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid');
                                return <span className={`text-xs font-medium ${cls}`}>{lbl}{st.balance > 0.01 ? ` · ${fmtAmt(st.balance)}` : ''}</span>;
                              })()}
                        </TableCell>
                      </TableRow>
                      {expanded.has(s.id) && (s.items?.length ?? 0) > 0 && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={12} className="p-0">
                            <div className="px-8 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1 w-8">#</th>
                                    <th className="text-left py-1">{hi ? 'वस्तु' : 'Item'}</th>
                                    <th className="text-right py-1">{hi ? 'मात्रा' : 'Qty'}</th>
                                    <th className="text-left py-1 pl-3">{hi ? 'इकाई' : 'Unit'}</th>
                                    <th className="text-right py-1">{hi ? 'दर' : 'Rate'}</th>
                                    <th className="text-right py-1">{hi ? 'राशि' : 'Amount'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.items.map((it, j) => (
                                    <tr key={j} className="border-t border-border/40">
                                      <td className="py-1 text-muted-foreground">{j + 1}</td>
                                      <td className="py-1">{it.itemName}</td>
                                      <td className="py-1 text-right">{it.qty}</td>
                                      <td className="py-1 pl-3">{it.unit}</td>
                                      <td className="py-1 text-right">{fmtAmt(it.rate)}</td>
                                      <td className="py-1 text-right">{fmtAmt(it.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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

      {/* Sales Returns (Credit Notes) — separate section, netted against gross above */}
      {filteredReturns.length > 0 && (
        <Card className="shadow-card border-rose-200 dark:border-rose-900/40">
          <CardHeader className="border-b pb-3 bg-rose-50/50 dark:bg-rose-900/10">
            <CardTitle className="text-base text-rose-800 dark:text-rose-300">{hi ? 'बिक्री वापसी (क्रेडिट नोट)' : 'Sales Returns (Credit Notes)'}</CardTitle>
            <p className="text-xs text-muted-foreground">{hi ? 'किसी वापसी पर क्लिक करके लौटाई वस्तुओं का विवरण देखें। इनकी राशि ऊपर "शुद्ध बिक्री" में घटाई गई है।' : 'Click a return to see the items returned. These reduce the "Net Sales" shown above.'}</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{hi ? 'वापसी नं.' : 'Return No.'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'मूल बिल' : 'Original Bill'}</TableHead>
                    <TableHead>{hi ? 'ग्राहक' : 'Customer'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कर योग्य' : 'Taxable'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल कर' : 'Tax'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल राशि' : 'Total'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((r, i) => (
                    <React.Fragment key={r.id}>
                      <TableRow className="hover:bg-rose-50/40 dark:hover:bg-rose-900/10 cursor-pointer" onClick={() => toggleRetExpand(r.id)}>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {r.items?.length ? (retExpanded.has(r.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.returnNo}</TableCell>
                        <TableCell>{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.saleNo}</TableCell>
                        <TableCell className="font-medium">{r.customerName}</TableCell>
                        <TableCell className="text-right">{fmtAmt(r.netAmount)}</TableCell>
                        <TableCell className="text-right text-amber-700">{r.taxAmount > 0 ? fmtAmt(r.taxAmount) : '—'}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-700">− {fmtAmt(r.grandTotal)}</TableCell>
                      </TableRow>
                      {retExpanded.has(r.id) && (r.items?.length ?? 0) > 0 && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={8} className="p-0">
                            <div className="px-8 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1 w-8">#</th>
                                    <th className="text-left py-1">{hi ? 'लौटाई वस्तु' : 'Item Returned'}</th>
                                    <th className="text-right py-1">{hi ? 'मात्रा' : 'Qty'}</th>
                                    <th className="text-left py-1 pl-3">{hi ? 'इकाई' : 'Unit'}</th>
                                    <th className="text-right py-1">{hi ? 'दर' : 'Rate'}</th>
                                    <th className="text-right py-1">{hi ? 'राशि' : 'Amount'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.items.map((it, j) => (
                                    <tr key={j} className="border-t border-border/40">
                                      <td className="py-1 text-muted-foreground">{j + 1}</td>
                                      <td className="py-1">{it.itemName}</td>
                                      <td className="py-1 text-right">{it.qty}</td>
                                      <td className="py-1 pl-3">{it.unit}</td>
                                      <td className="py-1 text-right">{fmtAmt(it.rate)}</td>
                                      <td className="py-1 text-right">{fmtAmt(it.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  <TableRow className="bg-rose-100/60 dark:bg-rose-900/20 font-bold">
                    <TableCell colSpan={5}>{hi ? 'कुल वापसी' : 'Total Returns'}</TableCell>
                    <TableCell className="text-right">{fmtAmt(returnTotals.netAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(returnTotals.taxAmount)}</TableCell>
                    <TableCell className="text-right text-rose-700">− {fmtAmt(returnTotals.grandTotal)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-emerald-100/60 dark:bg-emerald-900/20 font-bold text-base">
                    <TableCell colSpan={7}>{hi ? 'शुद्ध बिक्री (सकल − वापसी)' : 'Net Sales (Gross − Returns)'}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtAmt(totals.grandTotal - returnTotals.grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{hi ? 'यह रजिस्टर GSTR-1 दाखिल करने और ऑडिट अनुपालन के लिए उपयोग किया जा सकता है। बिक्री वापसी अलग खंड में दिखती है और शुद्ध बिक्री में घटाई जाती है।' : 'This register can be used for GSTR-1 filing and audit compliance. Sales returns are shown separately and deducted to give Net Sales.'}</span>
      </div>
    </div>
  );
};

export default SaleRegister;
