/**
 * Purchase Register Report — Date-wise, party-wise, GST+TDS listing
 * with PDF/Excel/CSV export for audit, GST filing, and TDS compliance.
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
import { PackagePlus, Download, FileSpreadsheet, Info, ChevronRight, ChevronDown } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generatePurchaseRegisterPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import { parseFY } from '@/lib/depreciation';
import { getBillSettledMap, getBillStatusFor } from '@/lib/billUtils';

const fmtAmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const PurchaseRegister: React.FC = () => {
  const { language } = useLanguage();
  const { society, purchases, vouchers, matchesActiveBranch } = useData();
  const { purchaseReturns } = useConsumerData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fyDates = parseFY(fy);
  const settledMap = useMemo(() => getBillSettledMap(vouchers), [vouchers]);

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
    return purchases
      .filter(p => {
        if (!matchesActiveBranch(p.branchId)) return false;   // ECR-17 Phase 4: active-branch scope ('all' → no filter)
        if (fromDate && p.date < fromDate) return false;
        if (toDate && p.date > toDate) return false;
        if (partyFilter && !p.supplierName.toLowerCase().includes(partyFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [purchases, fromDate, toDate, partyFilter, matchesActiveBranch]);

  const totals = useMemo(() => ({
    netAmount: filtered.reduce((s, r) => s + r.netAmount, 0),
    cgst: filtered.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: filtered.reduce((s, r) => s + r.sgstAmount, 0),
    igst: filtered.reduce((s, r) => s + r.igstAmount, 0),
    taxAmount: filtered.reduce((s, r) => s + r.taxAmount, 0),
    tds: filtered.reduce((s, r) => s + (r.tdsAmount || 0), 0),
    grandTotal: filtered.reduce((s, r) => s + r.grandTotal, 0),
  }), [filtered]);

  // Purchase returns (debit notes) in the same date/party window — shown separately, netted.
  const filteredReturns = useMemo(() => purchaseReturns
    .filter(r => !r.isDeleted
      && (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate)
      && (!partyFilter || (r.supplierName || '').toLowerCase().includes(partyFilter.toLowerCase())))
    .sort((a, b) => a.date.localeCompare(b.date)), [purchaseReturns, fromDate, toDate, partyFilter]);

  const returnTotals = useMemo(() => ({
    netAmount: filteredReturns.reduce((s, r) => s + (r.netAmount || 0), 0),
    taxAmount: filteredReturns.reduce((s, r) => s + (r.taxAmount || 0), 0),
    grandTotal: filteredReturns.reduce((s, r) => s + (r.grandTotal || 0), 0),
  }), [filteredReturns]);

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
      <div className={`grid grid-cols-2 gap-4 ${filteredReturns.length > 0 ? 'md:grid-cols-4 lg:grid-cols-7' : 'md:grid-cols-5'}`}>
        {[
          { label: hi ? 'कुल बिल' : 'Total Bills', value: String(filtered.length), color: 'text-orange-700' },
          { label: hi ? 'कर योग्य राशि' : 'Taxable Amount', value: fmtAmt(totals.netAmount), color: 'text-foreground' },
          { label: hi ? 'कुल GST' : 'Total GST', value: fmtAmt(totals.taxAmount), color: 'text-amber-700' },
          { label: hi ? 'कुल TDS' : 'Total TDS', value: fmtAmt(totals.tds), color: 'text-red-600' },
          { label: hi ? 'सकल राशि' : 'Gross Total', value: fmtAmt(totals.grandTotal), color: 'text-green-700' },
          ...(filteredReturns.length > 0 ? [
            { label: hi ? 'क्रय वापसी (−)' : 'Purchase Returns (−)', value: fmtAmt(returnTotals.grandTotal), color: 'text-amber-700' },
            { label: hi ? 'शुद्ध क्रय' : 'Net Purchases', value: fmtAmt(totals.grandTotal - returnTotals.grandTotal), color: 'text-emerald-700' },
          ] : []),
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold ${c.color}`}>{c.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{hi ? 'क्रय विवरण' : 'Purchase Details'}</CardTitle>
          <p className="text-xs text-muted-foreground">{hi ? 'किसी बिल पर क्लिक करके उसकी वस्तुओं का विवरण (मात्रा/दर/राशि) देखें।' : 'Click a bill to see its item-wise details (qty / rate / amount).'}</p>
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
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => (
                    <React.Fragment key={p.id}>
                      <TableRow className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {p.items?.length ? (expanded.has(p.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                            {i + 1}
                          </span>
                        </TableCell>
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
                        <TableCell>
                          {p.paymentMode !== 'credit'
                            ? <span className="text-xs text-success font-medium">{hi ? 'चुकता' : 'Paid'}</span>
                            : (() => {
                                const st = getBillStatusFor(p.grandTotal ?? p.netAmount ?? 0, settledMap[p.id] || 0);
                                const cls = st.status === 'paid' ? 'text-success' : st.status === 'partial' ? 'text-amber-700' : 'text-destructive';
                                const lbl = st.status === 'paid' ? (hi ? 'चुकता' : 'Paid') : st.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid');
                                return <span className={`text-xs font-medium ${cls}`}>{lbl}{st.balance > 0.01 ? ` · ${fmtAmt(st.balance)}` : ''}</span>;
                              })()}
                        </TableCell>
                      </TableRow>
                      {expanded.has(p.id) && (p.items?.length ?? 0) > 0 && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={13} className="p-0">
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
                                  {p.items.map((it, j) => (
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
                    <TableCell className="text-right">{fmtAmt(totals.tds)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(totals.grandTotal)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Returns (Debit Notes) — separate section, netted against gross above */}
      {filteredReturns.length > 0 && (
        <Card className="shadow-card border-amber-200 dark:border-amber-900/40">
          <CardHeader className="border-b pb-3 bg-amber-50/50 dark:bg-amber-900/10">
            <CardTitle className="text-base text-amber-800 dark:text-amber-300">{hi ? 'क्रय वापसी (डेबिट नोट)' : 'Purchase Returns (Debit Notes)'}</CardTitle>
            <p className="text-xs text-muted-foreground">{hi ? 'किसी वापसी पर क्लिक करके लौटाई वस्तुओं का विवरण देखें। इनकी राशि ऊपर "शुद्ध क्रय" में घटाई गई है।' : 'Click a return to see the items returned. These reduce the "Net Purchases" shown above.'}</p>
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
                    <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कर योग्य' : 'Taxable'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल कर' : 'Tax'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कुल राशि' : 'Total'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((r, i) => (
                    <React.Fragment key={r.id}>
                      <TableRow className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10 cursor-pointer" onClick={() => toggleRetExpand(r.id)}>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {r.items?.length ? (retExpanded.has(r.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.returnNo}</TableCell>
                        <TableCell>{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.purchaseNo}</TableCell>
                        <TableCell className="font-medium">{r.supplierName}</TableCell>
                        <TableCell className="text-right">{fmtAmt(r.netAmount)}</TableCell>
                        <TableCell className="text-right text-amber-700">{r.taxAmount > 0 ? fmtAmt(r.taxAmount) : '—'}</TableCell>
                        <TableCell className="text-right font-semibold text-amber-700">− {fmtAmt(r.grandTotal)}</TableCell>
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
                  <TableRow className="bg-amber-100/60 dark:bg-amber-900/20 font-bold">
                    <TableCell colSpan={5}>{hi ? 'कुल वापसी' : 'Total Returns'}</TableCell>
                    <TableCell className="text-right">{fmtAmt(returnTotals.netAmount)}</TableCell>
                    <TableCell className="text-right">{fmtAmt(returnTotals.taxAmount)}</TableCell>
                    <TableCell className="text-right text-amber-700">− {fmtAmt(returnTotals.grandTotal)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-emerald-100/60 dark:bg-emerald-900/20 font-bold text-base">
                    <TableCell colSpan={7}>{hi ? 'शुद्ध क्रय (सकल − वापसी)' : 'Net Purchases (Gross − Returns)'}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtAmt(totals.grandTotal - returnTotals.grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-800 dark:text-orange-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{hi ? 'यह रजिस्टर GSTR-3B ITC दावे, TDS रिटर्न और ऑडिट अनुपालन के लिए उपयोग किया जा सकता है। क्रय वापसी अलग खंड में दिखती है और शुद्ध क्रय में घटाई जाती है।' : 'This register can be used for GSTR-3B ITC claims, TDS returns, and audit compliance. Purchase returns are shown separately and deducted to give Net Purchases.'}</span>
      </div>
    </div>
  );
};

export default PurchaseRegister;
