/**
 * Statutory Reconciliation (ECR-14, bounded slice) — a READ-ONLY combined PF/ESI
 * view across the two payroll paths: salaried employees (SalaryRecord) and
 * daily-wage labour (muster). It does not merge the write paths — it surfaces
 * both so the monthly PF/ESI challan figure ties out in one place.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData, PF_ESI_DEFAULTS } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scale } from 'lucide-react';
import { reconcileStatutory, salariedRow, labourRow } from '@/lib/statutoryReconciliation';

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const StatutoryReconciliation: React.FC = () => {
  const { salaryRecords } = useData();
  const { computePfEsi } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [period, setPeriod] = useState(currentMonth());
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const rec = useMemo(() => {
    const sal = salariedRow(salaryRecords.filter(r => r.month === period));
    const comp = computePfEsi(period, PF_ESI_DEFAULTS);
    const lab = labourRow(comp, comp.perWorker.length);
    return reconcileStatutory([sal, lab]);
  }, [salaryRecords, computePfEsi, period]);

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

      <p className="text-[11px] text-muted-foreground">
        {hi
          ? 'यह केवल-पढ़ने योग्य संयुक्त दृश्य है — वेतन और श्रमिक की अलग एंट्री/पोस्टिंग यथावत रहती है। दोनों स्रोत एक ही माह-प्रारूप (YYYY-MM) पर मिलते हैं।'
          : 'Read-only combined view — salary and labour keep their own entry/posting. Both sources are matched on the same month format (YYYY-MM).'}
      </p>
    </div>
  );
};

export default StatutoryReconciliation;
