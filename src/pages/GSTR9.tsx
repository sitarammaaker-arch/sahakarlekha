/**
 * GSTR-9 Annual Return (ECR-22 slice 1) — a read-only annual consolidation of
 * outward supplies (net of credit notes) and inward ITC (net of debit notes),
 * computed from the year's sales/purchases via src/lib/gstr9.ts. Additive: it
 * does not change any existing report or data.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { computeGSTR9, type GstRecord } from '@/lib/gstr9';
import { validateGstBatch, validateGSTIN, type GstCheckRecord } from '@/lib/gstTdsValidation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

function fyBounds(fy: string): { from: string; to: string } {
  const startYear = parseInt(fy.split('-')[0], 10);
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

const GSTR9: React.FC = () => {
  const { sales, purchases, society } = useData();
  const { salesReturns, purchaseReturns } = useConsumerData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const { from: defFrom, to: defTo } = fyBounds(society.financialYear);
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(defTo);

  const g = useMemo(() => computeGSTR9({
    sales: sales as unknown as GstRecord[],
    purchases: purchases as unknown as GstRecord[],
    salesReturns: salesReturns as unknown as GstRecord[],
    purchaseReturns: purchaseReturns as unknown as GstRecord[],
    from, to,
  }), [sales, purchases, salesReturns, purchaseReturns, from, to]);

  // ECR-22 slice C: read-only data checks over the period's GST records.
  const issues = useMemo(() => {
    const inFY = (d?: string) => !!d && d >= from && d <= to;
    const recs: GstCheckRecord[] = [
      ...sales.filter((s: { date?: string }) => inFY(s.date)).map((s: Record<string, unknown>) => ({ ref: `Sale ${(s.invoiceNo || s.saleNo || s.id) as string}`, netAmount: s.netAmount as number, cgstAmount: s.cgstAmount as number, sgstAmount: s.sgstAmount as number, igstAmount: s.igstAmount as number, cgstPct: s.cgstPct as number, sgstPct: s.sgstPct as number, igstPct: s.igstPct as number, isDeleted: s.isDeleted as boolean })),
      ...purchases.filter((p: { date?: string }) => inFY(p.date)).map((p: Record<string, unknown>) => ({ ref: `Purchase ${(p.billNo || p.purchaseNo || p.id) as string}`, netAmount: p.netAmount as number, cgstAmount: p.cgstAmount as number, sgstAmount: p.sgstAmount as number, igstAmount: p.igstAmount as number, cgstPct: p.cgstPct as number, sgstPct: p.sgstPct as number, igstPct: p.igstPct as number, isDeleted: p.isDeleted as boolean })),
    ];
    const list = validateGstBatch(recs);
    if (society.gstin && !validateGSTIN(society.gstin)) list.unshift({ ref: hi ? 'समिति' : 'Society', field: 'gstin', severity: 'error', message: `Invalid society GSTIN: ${society.gstin}` });
    return list;
  }, [sales, purchases, society.gstin, from, to, hi]);

  const exportCsv = () => {
    const headers = ['Table', 'Description', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'];
    const rows: (string | number)[][] = [
      ['4', 'Outward supplies (net of credit notes)', g.outward.taxableValue, g.outward.cgst, g.outward.sgst, g.outward.igst, g.outward.tax],
      ['6', 'ITC availed on inward supplies', g.itcAvailed.taxableValue, g.itcAvailed.cgst, g.itcAvailed.sgst, g.itcAvailed.igst, g.itcAvailed.tax],
      ['7', 'ITC reversed (debit notes)', g.itcReversed.taxableValue, g.itcReversed.cgst, g.itcReversed.sgst, g.itcReversed.igst, g.itcReversed.tax],
      ['', 'Net ITC (6 − 7)', g.netItc.taxableValue, g.netItc.cgst, g.netItc.sgst, g.netItc.igst, g.netItc.tax],
      ['9', 'Net tax payable (output − net ITC)', '', g.netLiability.cgst, g.netLiability.sgst, g.netLiability.igst, g.netLiability.total],
      ['', 'ITC carried forward', '', g.creditCarryForward.cgst, g.creditCarryForward.sgst, g.creditCarryForward.igst, g.creditCarryForward.total],
    ];
    downloadCSV(headers, rows, `GSTR9_${from}_to_${to}.csv`);
  };

  const rowCells = (label: string, t: { taxableValue: number; cgst: number; sgst: number; igst: number; tax: number }, showTaxable = true) => (
    <>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">{showTaxable ? fmt(t.taxableValue) : '—'}</TableCell>
      <TableCell className="text-right">{fmt(t.cgst)}</TableCell>
      <TableCell className="text-right">{fmt(t.sgst)}</TableCell>
      <TableCell className="text-right">{fmt(t.igst)}</TableCell>
      <TableCell className="text-right font-semibold">{fmt(t.tax)}</TableCell>
    </>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><FileText className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{hi ? 'GSTR-9 वार्षिक रिटर्न' : 'GSTR-9 Annual Return'}</h1>
            <p className="text-sm text-muted-foreground">{society.gstin ? `GSTIN: ${society.gstin}` : (hi ? 'सालाना GST consolidation' : 'Annual GST consolidation')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div><Label htmlFor="g9-from">{hi ? 'से' : 'From'}</Label><Input id="g9-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></div>
        <div><Label htmlFor="g9-to">{hi ? 'तक' : 'To'}</Label><Input id="g9-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" /></div>
      </div>

      {/* Part II — outward + tax */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'भाग II — बहिर्गामी आपूर्ति व कर (Table 4/9)' : 'Part II — Outward supplies & tax (Table 4/9)'}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
              <TableHead className="text-right">{hi ? 'कर योग्य मूल्य' : 'Taxable Value'}</TableHead>
              <TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead><TableHead className="text-right">{hi ? 'कुल कर' : 'Total Tax'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow>{rowCells(hi ? 'बहिर्गामी आपूर्ति (क्रेडिट नोट घटाकर)' : 'Outward supplies (net of credit notes)', g.outward)}</TableRow>
              {g.outwardByRate.map(r => (
                <TableRow key={r.rate} className="text-sm text-muted-foreground">
                  <TableCell className="pl-8">{hi ? 'दर' : 'Rate'} {r.rate}%</TableCell>
                  <TableCell className="text-right">{fmt(r.taxableValue)}</TableCell>
                  <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                  <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                  <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                  <TableCell className="text-right">{fmt(r.cgst + r.sgst + r.igst)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Part III — ITC */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'भाग III — इनपुट टैक्स क्रेडिट (Table 6/7)' : 'Part III — Input Tax Credit (Table 6/7)'}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
              <TableHead className="text-right">{hi ? 'कर योग्य मूल्य' : 'Taxable Value'}</TableHead>
              <TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead><TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow>{rowCells(hi ? 'ITC प्राप्त (Table 6)' : 'ITC availed (Table 6)', g.itcAvailed)}</TableRow>
              <TableRow>{rowCells(hi ? 'ITC वापस (Table 7)' : 'ITC reversed (Table 7)', g.itcReversed)}</TableRow>
              <TableRow className="bg-muted/50 font-semibold">{rowCells(hi ? 'शुद्ध ITC' : 'Net ITC', g.netItc, false)}</TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Net liability */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'शुद्ध देय GST (नकद) — Table 9' : 'Net GST payable (cash) — Table 9'}</p>
          <p className="text-2xl font-bold">{fmt(g.netLiability.total)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">C {fmt(g.netLiability.cgst)} · S {fmt(g.netLiability.sgst)} · I {fmt(g.netLiability.igst)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'आगे ले जाया गया ITC' : 'ITC carried forward'}</p>
          <p className="text-2xl font-bold">{fmt(g.creditCarryForward.total)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">C {fmt(g.creditCarryForward.cgst)} · S {fmt(g.creditCarryForward.sgst)} · I {fmt(g.creditCarryForward.igst)}</p>
        </CardContent></Card>
      </div>

      {/* ECR-22 C — data checks */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
          {issues.length === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          {hi ? 'डेटा जाँच (GST/TDS)' : 'Data checks (GST/TDS)'}
          {issues.length > 0 && <span className="text-xs font-normal text-muted-foreground">— {issues.length} {hi ? 'चेतावनी' : issues.length === 1 ? 'issue' : 'issues'}</span>}
        </CardTitle></CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="text-sm text-emerald-700">{hi ? 'कोई समस्या नहीं मिली — GST डेटा consistent है।' : 'No issues found — GST data looks consistent.'}</p>
          ) : (
            <ul className="space-y-1 text-sm max-h-64 overflow-y-auto">
              {issues.slice(0, 100).map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 text-[10px] font-semibold uppercase ${it.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>{it.severity}</span>
                  <span><span className="font-medium">{it.ref}:</span> {it.message}</span>
                </li>
              ))}
              {issues.length > 100 && <li className="text-xs text-muted-foreground">…{issues.length - 100} {hi ? 'और' : 'more'}</li>}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        {hi
          ? 'यह वार्षिक consolidation आपके sales/purchases GST डेटा से गणना किया गया है (क्रेडिट/डेबिट नोट सहित)। कर offset सरलीकृत है — वास्तविक GSTR-9 भरते समय GSTN portal के आँकड़ों से मिलान करें।'
          : 'Computed from your sales/purchases GST data (incl. credit/debit notes). Tax offset is simplified — reconcile with GSTN portal figures when filing the actual GSTR-9.'}
      </p>
    </div>
  );
};

export default GSTR9;
