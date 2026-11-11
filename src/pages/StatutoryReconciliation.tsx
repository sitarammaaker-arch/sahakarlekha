/**
 * Statutory Reconciliation (ECR-14, bounded slice) — a READ-ONLY combined PF/ESI
 * view across the two payroll paths: salaried employees (SalaryRecord) and
 * daily-wage labour (muster). It does not merge the write paths — it surfaces
 * both so the monthly PF/ESI challan figure ties out in one place.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData, pfEsiDefaultsFor } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reconcileStatutory, salariedRow, labourRow, checkSlipsAgainstLedger, type SlipLedgerIssue } from '@/lib/statutoryReconciliation';

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const StatutoryReconciliation: React.FC = () => {
  const { salaryRecords, vouchers } = useData();
  const { computePfEsi } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [period, setPeriod] = useState(currentMonth());
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const rec = useMemo(() => {
    const sal = salariedRow(salaryRecords.filter(r => r.month === period));
    const comp = computePfEsi(period, pfEsiDefaultsFor(period));
    const lab = labourRow(comp, comp.perWorker.length);
    return reconcileStatutory([sal, lab]);
  }, [salaryRecords, computePfEsi, period]);

  // Each slip of the month against its own accrual voucher — catches a slip the ledger does not carry.
  const issues = useMemo(() => checkSlipsAgainstLedger(salaryRecords.filter(r => r.month === period), vouchers), [salaryRecords, vouchers, period]);
  const issueText = (i: SlipLedgerIssue) => {
    const slip = i.slipNo ?? i.slipId;
    switch (i.kind) {
      case 'no_voucher': return hi ? `${slip}: पर्ची में PF/ESI है, पर उसका बही-voucher नहीं मिला` : `${slip}: the slip has PF/ESI but no accrual voucher`;
      case 'voucher_cancelled': return hi ? `${slip}: उसका बही-voucher ${i.voucherNo ?? ''} रद्द है` : `${slip}: its accrual voucher ${i.voucherNo ?? ''} is cancelled`;
      case 'pf_mismatch': return hi ? `${slip}: PF पर्ची में ${fmt(i.slip)}, बही (2203) में ${fmt(i.ledger)}` : `${slip}: PF ${fmt(i.slip)} on the slip, ${fmt(i.ledger)} in the ledger (2203)`;
      case 'esi_mismatch': return hi ? `${slip}: ESI पर्ची में ${fmt(i.slip)}, बही (2204) में ${fmt(i.ledger)}` : `${slip}: ESI ${fmt(i.slip)} on the slip, ${fmt(i.ledger)} in the ledger (2204)`;
    }
  };

  const t = rec.totals;
  const sourceLabel = (s: 'salaried' | 'labour') => s === 'salaried' ? (hi ? 'वेतनभोगी कर्मचारी' : 'Salaried employees') : (hi ? 'श्रमिक (मस्टर)' : 'Labour (muster)');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-primary/10 rounded-lg"><Scale className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सांविधिक मिलान (PF/ESI)' : 'Statutory Reconciliation (PF/ESI)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'वेतन + श्रमिक दोनों का संयुक्त PF/ESI — चालान मिलान हेतु' : 'Combined PF/ESI across salary + labour — for challan tie-out'}</p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div>
          <Label htmlFor="rec-month">{hi ? 'माह' : 'Month'}</Label>
          <Input id="rec-month" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'स्रोत' : 'Source'}</TableHead>
                <TableHead className="text-center">{hi ? 'संख्या' : 'Count'}</TableHead>
                <TableHead className="text-right">{hi ? 'सकल' : 'Gross'}</TableHead>
                <TableHead className="text-right">PF ({hi ? 'कर्मचारी' : 'Emp'})</TableHead>
                <TableHead className="text-right">PF ({hi ? 'नियोक्ता' : 'Er'})</TableHead>
                <TableHead className="text-right">ESI ({hi ? 'कर्मचारी' : 'Emp'})</TableHead>
                <TableHead className="text-right">ESI ({hi ? 'नियोक्ता' : 'Er'})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rec.rows.map(r => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{sourceLabel(r.source)}</TableCell>
                  <TableCell className="text-center">{r.count}</TableCell>
                  <TableCell className="text-right">{fmt(r.gross)}</TableCell>
                  <TableCell className="text-right">{fmt(r.pfEmployee)}</TableCell>
                  <TableCell className="text-right">{fmt(r.pfEmployer)}</TableCell>
                  <TableCell className="text-right">{fmt(r.esiEmployee)}</TableCell>
                  <TableCell className="text-right">{fmt(r.esiEmployer)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                <TableCell className="text-center">{t.count}</TableCell>
                <TableCell className="text-right">{fmt(t.gross)}</TableCell>
                <TableCell className="text-right">{fmt(t.pfEmployee)}</TableCell>
                <TableCell className="text-right">{fmt(t.pfEmployer)}</TableCell>
                <TableCell className="text-right">{fmt(t.esiEmployee)}</TableCell>
                <TableCell className="text-right">{fmt(t.esiEmployer)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल PF चालान (कर्मचारी + नियोक्ता)' : 'Total PF challan (Emp + Er)'}</p>
          <p className="text-2xl font-bold">{fmt(t.pfTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल ESI (कर्मचारी + नियोक्ता)' : 'Total ESI (Emp + Er)'}</p>
          <p className="text-2xl font-bold">{fmt(t.esiTotal)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-semibold">{hi ? 'वेतन पर्ची ↔ बही मिलान' : 'Salary slips ↔ ledger'}</p>
          {salaryRecords.every(r => r.month !== period) ? (
            <p className="text-sm text-muted-foreground">{hi ? 'इस माह की कोई वेतन पर्ची नहीं — मिलाने को कुछ नहीं।' : 'No salary slips this month — nothing to match.'}</p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{hi ? 'इस माह की हर पर्ची का PF/ESI उसके बही-voucher से मेल खाता है।' : 'Every slip of this month matches its accrual voucher.'}</p>
          ) : (
            <ul className="space-y-1">
              {issues.map((i, n) => (
                <li key={n} className="text-sm text-destructive flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{issueText(i)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        {hi
          ? 'यह केवल-पढ़ने योग्य संयुक्त दृश्य है — वेतन और श्रमिक की अलग एंट्री/पोस्टिंग यथावत रहती है। दोनों स्रोत एक ही माह-प्रारूप (YYYY-MM) पर मिलते हैं।'
          : 'Read-only combined view — salary and labour keep their own entry/posting. Both sources are matched on the same month format (YYYY-MM).'}
      </p>
    </div>
  );
};

export default StatutoryReconciliation;
