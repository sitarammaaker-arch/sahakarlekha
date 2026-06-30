import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

export default function WorkOrderProfit() {
  const { workOrders, musterEntries } = useData();
  const { departmentBills, departments } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
  const deptName = (id?: string) => departments.find(d => d.id === id)?.name;

  const rows = useMemo(() => {
    const bills = departmentBills.filter(b => !b.isDeleted);
    const muster = musterEntries.filter(m => !m.isDeleted);
    return workOrders.filter(w => !w.isDeleted).map(w => {
      const woBills = bills.filter(b => b.workOrderId === w.id);
      const billed = woBills.reduce((s, b) => s + (b.amount || 0), 0);
      const collected = woBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
      const woMuster = muster.filter(m => m.workOrderId === w.id);
      const wageExpense = woMuster.reduce((s, m) => s + (m.daysWorked || 0) * (m.dailyWage || 0), 0);
      const wagesPaid = woMuster.reduce((s, m) => s + (m.paidAmount || 0), 0);
      const profit = +(billed - wageExpense).toFixed(2);
      const margin = billed > 0 ? (profit / billed) * 100 : 0;
      return { w, billed, collected, wageExpense, wagesPaid, profit, margin };
    });
  }, [workOrders, departmentBills, musterEntries]);

  const active = rows.filter(r => r.billed > 0 || r.wageExpense > 0);
  const tot = active.reduce((a, r) => ({
    billed: a.billed + r.billed, collected: a.collected + r.collected,
    wageExpense: a.wageExpense + r.wageExpense, wagesPaid: a.wagesPaid + r.wagesPaid,
    profit: a.profit + r.profit,
  }), { billed: 0, collected: 0, wageExpense: 0, wagesPaid: 0, profit: 0 });
  const totMargin = tot.billed > 0 ? (tot.profit / tot.billed) * 100 : 0;

  const profitClass = (n: number) => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'कार्य आदेश लाभ-विश्लेषण' : 'Work Order Profit Analysis'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'प्रत्येक कार्य आदेश की आय (बिल) − मज़दूरी-व्यय = लाभ' : 'Per work order: income (bills) − wage expense = profit'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'कार्य आदेश-वार लाभ' : 'Profit by Work Order'} ({active.length})</span>
            {active.length > 0 && (
              <span className="text-sm font-normal">
                {hi ? 'कुल लाभ' : 'Total profit'}: <span className={`font-semibold ${profitClass(tot.profit)}`}>{money(tot.profit)}</span> · {totMargin.toFixed(1)}%
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">{hi ? 'अभी कोई बिल/मज़दूरी दर्ज नहीं — पहले Muster Roll व Department Bills भरें।' : 'No bills/wages recorded yet — add Muster Roll and Department Bills first.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="text-left font-medium px-3 py-2">{hi ? 'कार्य आदेश' : 'Work Order'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'बिल (आय)' : 'Billed'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'वसूल' : 'Collected'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'मज़दूरी-व्यय' : 'Wage exp.'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'मज़दूरी चुकाई' : 'Wages paid'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'लाभ' : 'Profit'}</th>
                    <th className="text-right font-medium px-3 py-2">{hi ? 'मार्जिन' : 'Margin'}</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(r => (
                    <tr key={r.w.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.w.workOrderNo} · {deptName(r.w.departmentId) || r.w.clientName}</div>
                        {r.w.contractValue ? <div className="text-xs text-muted-foreground">{hi ? 'ठेका' : 'contract'} {money(r.w.contractValue)}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right">{money(r.billed)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{money(r.collected)}</td>
                      <td className="px-3 py-2 text-right">{money(r.wageExpense)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{money(r.wagesPaid)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${profitClass(r.profit)}`}>{money(r.profit)}</td>
                      <td className={`px-3 py-2 text-right ${profitClass(r.profit)}`}>{r.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2">{hi ? 'कुल' : 'Total'}</td>
                    <td className="px-3 py-2 text-right">{money(tot.billed)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.collected)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.wageExpense)}</td>
                    <td className="px-3 py-2 text-right">{money(tot.wagesPaid)}</td>
                    <td className={`px-3 py-2 text-right ${profitClass(tot.profit)}`}>{money(tot.profit)}</td>
                    <td className={`px-3 py-2 text-right ${profitClass(tot.profit)}`}>{totMargin.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {hi
          ? 'नोट: आय = कार्य आदेश के विभाग-बिल (श्रम-प्रभार आय 4203); मज़दूरी-व्यय = उस कार्य आदेश की मस्टर रोल मज़दूरी (दिन × दर)। लाभ = बिल − मज़दूरी-व्यय। (अन्य प्रत्यक्ष खर्च जैसे सामग्री/किराया इसमें शामिल नहीं — वे I&E में दिखते हैं।)'
          : 'Note: income = the work order’s department bills (Labour Charges 4203); wage expense = that order’s muster-roll wages (days × rate). Profit = billed − wage expense. (Other direct costs like material/rent are not included here — see I&E.)'}
      </p>
    </div>
  );
}
