/**
 * Procurement 3-Way Match (ECR-21 Phase 1) — read-only variance report.
 * For every received Purchase Order, compares PO (ordered) ↔ GRN (received) ↔
 * Invoice (the linked Purchase) and flags per-line variances beyond tolerance.
 * No posting, no mutation — purely diagnostic.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GitCompareArrows, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { threeWayMatch, type MatchStatus, type MatchReason } from '@/lib/consumer/threeWayMatch';

const STATUS: Record<MatchStatus, { hi: string; en: string; cls: string }> = {
  matched: { hi: 'मिलान', en: 'Matched', cls: 'bg-green-100 text-green-800 border-green-300' },
  'within-tolerance': { hi: 'सहनशीलता में', en: 'Within tolerance', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  exception: { hi: 'अपवाद', en: 'Exception', cls: 'bg-red-100 text-red-800 border-red-300' },
};

const REASON: Record<MatchReason, { hi: string; en: string }> = {
  'short-delivery': { hi: 'कम डिलीवरी', en: 'Short delivery' },
  'over-delivery': { hi: 'ज़्यादा डिलीवरी', en: 'Over delivery' },
  'over-billed-qty': { hi: 'ज़्यादा बिल (मात्रा)', en: 'Over-billed qty' },
  'under-billed-qty': { hi: 'कम बिल (मात्रा)', en: 'Under-billed qty' },
  'price-variance': { hi: 'दर अंतर', en: 'Price variance' },
  'unbilled': { hi: 'बिल नहीं', en: 'Unbilled' },
  'extra-invoice-line': { hi: 'अतिरिक्त बिल पंक्ति', en: 'Extra invoice line' },
};

const ProcurementMatch: React.FC = () => {
  const { purchases } = useData();
  const { purchaseOrders } = useConsumerData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  const num = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Every received PO joined to its linked Purchase (invoice), matched 3 ways.
  const rows = useMemo(() => {
    const purchaseById = new Map(purchases.map(p => [p.id, p]));
    return purchaseOrders
      .filter(po => !po.isDeleted && po.status === 'received')
      .map(po => {
        const invoice = po.purchaseId ? purchaseById.get(po.purchaseId) : undefined;
        const match = threeWayMatch(po.items, invoice?.items ?? []);
        return { po, invoice, match };
      })
      .sort((a, b) => (b.po.receivedAt || b.po.date).localeCompare(a.po.receivedAt || a.po.date));
  }, [purchaseOrders, purchases]);

  const shown = onlyExceptions ? rows.filter(r => r.match.summary.status === 'exception') : rows;
  const counts = useMemo(() => ({
    total: rows.length,
    matched: rows.filter(r => r.match.summary.status === 'matched').length,
    within: rows.filter(r => r.match.summary.status === 'within-tolerance').length,
    exceptions: rows.filter(r => r.match.summary.status === 'exception').length,
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><GitCompareArrows className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? '3-तरफ़ा मिलान' : '3-Way Match'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'क्रय आदेश (ऑर्डर) ↔ प्राप्ति (GRN) ↔ बिल (Invoice) — भुगतान से पहले अंतर जाँचें। सहनशीलता 2%।' : 'Purchase Order (ordered) ↔ Receipt (GRN) ↔ Invoice (billed) — catch variances before payment. Tolerance 2%.'}</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">{hi ? 'कुल प्राप्त PO' : 'Received POs'}</div><div className="text-2xl font-bold">{counts.total}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />{hi ? 'मिलान' : 'Matched'}</div><div className="text-2xl font-bold text-green-700">{counts.matched}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><CircleAlert className="h-3.5 w-3.5 text-amber-600" />{hi ? 'सहनशीलता में' : 'Within tol.'}</div><div className="text-2xl font-bold text-amber-700">{counts.within}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-600" />{hi ? 'अपवाद' : 'Exceptions'}</div><div className="text-2xl font-bold text-red-700">{counts.exceptions}</div></CardContent></Card>
      </div>

      {counts.exceptions > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant={onlyExceptions ? 'default' : 'outline'} onClick={() => setOnlyExceptions(v => !v)} className="gap-2">
            <AlertTriangle className="h-4 w-4" />{hi ? 'सिर्फ़ अपवाद' : 'Only exceptions'}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <GitCompareArrows className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {hi ? 'कोई प्राप्त क्रय आदेश नहीं। PO बनाकर, स्वीकृत कर, माल प्राप्त करने पर यहाँ मिलान दिखेगा।' : 'No received purchase orders yet. Create a PO, approve it, and receive goods — the match appears here.'}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8" />
              <TableHead>{hi ? 'PO' : 'PO'}</TableHead>
              <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
              <TableHead>{hi ? 'बिल' : 'Invoice'}</TableHead>
              <TableHead className="text-right">{hi ? 'प्राप्ति मूल्य' : 'Received ₹'}</TableHead>
              <TableHead className="text-right">{hi ? 'बिल मूल्य' : 'Billed ₹'}</TableHead>
              <TableHead className="text-right">{hi ? 'अंतर' : 'Variance'}</TableHead>
              <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shown.map(({ po, invoice, match }) => {
                const isOpen = expanded.has(po.id);
                const s = match.summary;
                return (
                  <React.Fragment key={po.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(po.id)}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{po.poNo}</TableCell>
                      <TableCell className="text-sm">{po.supplierName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invoice?.purchaseNo || (hi ? '—' : '—')}</TableCell>
                      <TableCell className="text-right">{fmt(s.receivedTotal)}</TableCell>
                      <TableCell className="text-right">{fmt(s.billedTotal)}</TableCell>
                      <TableCell className={cn('text-right font-medium', Math.abs(s.amountVarianceTotal) > 0.005 ? 'text-red-700' : 'text-muted-foreground')}>{s.amountVarianceTotal === 0 ? '—' : fmt(s.amountVarianceTotal)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 items-start">
                          <Badge variant="outline" className={cn('text-[10px]', STATUS[s.status].cls)}>{hi ? STATUS[s.status].hi : STATUS[s.status].en}</Badge>
                          {po.varianceStatus === 'approved' && (
                            <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50" title={po.varianceReason || (po.varianceApprovedBy ? `${po.varianceApprovedBy}` : '')}>
                              {hi ? 'अंतर approve' : 'Variance approved'}{po.varianceApprovedBy ? ` · ${po.varianceApprovedBy}` : ''}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <div className="p-3 overflow-x-auto">
                            <Table>
                              <TableHeader><TableRow className="text-xs">
                                <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                                <TableHead className="text-right">{hi ? 'ऑर्डर' : 'Ordered'}</TableHead>
                                <TableHead className="text-right">{hi ? 'प्राप्त' : 'Received'}</TableHead>
                                <TableHead className="text-right">{hi ? 'बिल मात्रा' : 'Billed qty'}</TableHead>
                                <TableHead className="text-right">{hi ? 'PO दर' : 'PO rate'}</TableHead>
                                <TableHead className="text-right">{hi ? 'बिल दर' : 'Bill rate'}</TableHead>
                                <TableHead className="text-right">{hi ? 'राशि अंतर' : 'Amt var'}</TableHead>
                                <TableHead>{hi ? 'टिप्पणी' : 'Flags'}</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {match.lines.map(l => (
                                  <TableRow key={l.itemId} className="text-xs">
                                    <TableCell>{l.itemName}</TableCell>
                                    <TableCell className="text-right">{num(l.orderedQty)}</TableCell>
                                    <TableCell className="text-right">{num(l.receivedQty)}</TableCell>
                                    <TableCell className={cn('text-right', Math.abs(l.qtyVarReceivedBilled) > 0.005 && 'text-red-700 font-medium')}>{num(l.billedQty)}</TableCell>
                                    <TableCell className="text-right">{num(l.poRate)}</TableCell>
                                    <TableCell className={cn('text-right', Math.abs(l.priceVar) > 0.005 && 'text-red-700 font-medium')}>{num(l.billedRate)}</TableCell>
                                    <TableCell className={cn('text-right', Math.abs(l.amountVar) > 0.005 ? 'text-red-700 font-medium' : 'text-muted-foreground')}>{l.amountVar === 0 ? '—' : fmt(l.amountVar)}</TableCell>
                                    <TableCell><div className="flex flex-wrap gap-1">{l.reasons.map(rn => <Badge key={rn} variant="outline" className="text-[9px]">{hi ? REASON[rn].hi : REASON[rn].en}</Badge>)}</div></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
};

export default ProcurementMatch;
