import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

export default function WorkerLedger() {
  const { musterEntries } = useData();
  const { workers, workerAdvances } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

  const rows = useMemo(() => {
    const muster = musterEntries.filter(m => !m.isDeleted);
    const advs = workerAdvances.filter(a => !a.isDeleted);
    return workers.filter(w => !w.isDeleted).map(w => {
      const wm = muster.filter(m => m.memberId === w.id);
      const earned = wm.reduce((s, m) => s + (m.daysWorked || 0) * (m.dailyWage || 0), 0);
      const paid = wm.reduce((s, m) => s + (m.paidAmount || 0), 0);
      const wagesDue = +(earned - paid).toFixed(2);
      const wa = advs.filter(a => a.workerId === w.id);
      const advGiven = wa.reduce((s, a) => s + (a.amount || 0), 0);
      const advRec = wa.reduce((s, a) => s + (a.recovered || 0), 0);
      const advOut = +(advGiven - advRec).toFixed(2);
      const netPayable = +(wagesDue - advOut).toFixed(2);   // what we still owe after netting the advance
      return { w, earned, paid, wagesDue, advGiven, advOut, netPayable };
    }).filter(r => r.earned > 0 || r.advGiven > 0);
  }, [workers, musterEntries, workerAdvances]);

  const tot = rows.reduce((a, r) => ({
    earned: a.earned + r.earned, paid: a.paid + r.paid, wagesDue: a.wagesDue + r.wagesDue,
    advGiven: a.advGiven + r.advGiven, advOut: a.advOut + r.advOut, netPayable: a.netPayable + r.netPayable,
  }), { earned: 0, paid: 0, wagesDue: 0, advGiven: 0, advOut: 0, netPayable: 0 });

  const cls = (n: number) => n > 0 ? 'text-foreground' : n < 0 ? 'text-emerald-600' : 'text-muted-foreground';

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'श्रमिक लेजर' : 'Worker Ledger'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'प्रत्येक श्रमिक: कमाई मज़दूरी, चुकाई, बकाया, अग्रिम व शुद्ध देय' : 'Per worker: wages earned, paid, due, advances and net payable'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'श्रमिक-वार स्थिति' : 'By Worker'} ({rows.length})</span>
            {rows.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'शुद्ध देय' : 'Net payable'}: <span className="font-semibold text-foreground">{money(tot.netPayable)}</span></span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">{hi ? 'अभी कोई मज़दूरी/अग्रिम दर्ज नहीं।' : 'No wages/advances recorded yet.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="text-left font-medium px-3 py-2">{hi ? 'श्रमिक' : 'Worker'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'कमाई' : 'Earned'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'चुकाई' : 'Paid'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'मज़दूरी बकाया' : 'Wages due'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'अग्रिम बकाया' : 'Advance due'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'शुद्ध देय' : 'Net payable'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.w.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{r.w.workerCode ? `${r.w.workerCode} · ` : ''}{r.w.name}</td>
                      <td className="px-3 py-2 text-right">{money(r.earned)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{money(r.paid)}</td>
                      <td className="px-3 py-2 text-right">{money(r.wagesDue)}</td>
                      <td className="px-3 py-2 text-right">{money(r.advOut)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${cls(r.netPayable)}`}>{money(r.netPayable)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2">{hi ? 'कुल' : 'Total'}</td>
                    <td className="px-3 py-2 text-right">{money(tot.earned)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.paid)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.wagesDue)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.advOut)}</td>
                    <td className={`px-3 py-2 text-right ${cls(tot.netPayable)}`}>{money(tot.netPayable)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {hi
          ? 'शुद्ध देय = मज़दूरी बकाया − अग्रिम बकाया (श्रमिक को भुगतान करते समय अग्रिम घटाने हेतु संदर्भ)। ऋणात्मक का अर्थ श्रमिक से वसूली शेष।'
          : 'Net payable = wages due − advance due (reference for netting the advance when paying the worker). Negative means net recoverable from the worker.'}
      </p>
    </div>
  );
}
