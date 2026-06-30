import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Printer } from 'lucide-react';

const thisMonth = new Date().toISOString().slice(0, 7);

export default function WageRegister() {
  const { workOrders, musterEntries, members, society } = useData();
  const { workers } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const openOrders = workOrders.filter(w => !w.isDeleted);
  const [workOrderId, setWorkOrderId] = useState(openOrders[0]?.id || '');
  const [period, setPeriod] = useState(thisMonth);

  const labourerName = (id: string) => workers.find(w => w.id === id)?.name || members.find(m => m.id === id)?.name || (hi ? 'अज्ञात' : 'Unknown');
  const labourerCode = (id: string) => workers.find(w => w.id === id)?.workerCode || '';
  const CAT: Record<string, { en: string; hi: string }> = {
    skilled: { en: 'Skilled', hi: 'कुशल' }, semi_skilled: { en: 'Semi-skilled', hi: 'अर्ध-कुशल' }, unskilled: { en: 'Unskilled', hi: 'अकुशल' },
    operator: { en: 'Operator', hi: 'ऑपरेटर' }, helper: { en: 'Helper', hi: 'सहायक' }, supervisor: { en: 'Supervisor', hi: 'पर्यवेक्षक' },
  };
  const labourerCat = (id: string) => { const c = workers.find(w => w.id === id)?.category; return c ? (hi ? CAT[c]?.hi : CAT[c]?.en) || c : ''; };
  const unitWord = (b?: string) => b === 'piece' ? (hi ? 'नग' : 'units') : b === 'hourly' ? (hi ? 'घंटे' : 'hrs') : (hi ? 'दिन' : 'days');
  const wo = openOrders.find(o => o.id === workOrderId);

  const rows = useMemo(
    () => musterEntries.filter(m => !m.isDeleted && m.workOrderId === workOrderId && m.period === period),
    [musterEntries, workOrderId, period],
  );
  const tot = rows.reduce((a, r) => {
    const wage = (r.daysWorked || 0) * (r.dailyWage || 0);
    return { days: a.days + (r.daysWorked || 0), wage: a.wage + wage, paid: a.paid + (r.paidAmount || 0) };
  }, { days: 0, wage: 0, paid: 0 });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Print stylesheet — when printing, show only the register */}
      <style>{`@media print { body * { visibility: hidden !important; } #wage-register, #wage-register * { visibility: visible !important; } #wage-register { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; } .no-print { display: none !important; } }`}</style>

      <div className="flex items-center gap-3 no-print">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'मज़दूरी रजिस्टर' : 'Wage Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'कार्य आदेश व महीने का श्रमिक-वार हाज़िरी-सह-मज़दूरी रजिस्टर (छपने-योग्य, सांविधिक)' : 'Per work order & month — muster-cum-wage register (printable, statutory)'}</p>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'कार्य आदेश' : 'Work Order'}</Label>
              <Select value={workOrderId} onValueChange={setWorkOrderId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{openOrders.map(w => <SelectItem key={w.id} value={w.id}>{w.workOrderNo} · {w.clientName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'महीना' : 'Month'}</Label>
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer className="h-4 w-4 mr-1" />{hi ? 'रजिस्टर प्रिंट करें' : 'Print Register'}
          </Button>
        </CardContent>
      </Card>

      {/* Printable register */}
      <Card id="wage-register">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-lg">{society?.name || (hi ? 'सहकारी समिति' : 'Cooperative Society')}</CardTitle>
          <p className="text-sm font-medium">{hi ? 'मज़दूरी-सह-हाज़िरी रजिस्टर' : 'Muster-cum-Wage Register'}</p>
          <p className="text-xs text-muted-foreground">
            {hi ? 'कार्य आदेश' : 'Work Order'}: {wo ? `${wo.workOrderNo} · ${wo.clientName}` : '—'} · {hi ? 'महीना' : 'Month'}: {period}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">{hi ? 'इस कार्य आदेश/महीने की कोई हाज़िरी नहीं।' : 'No attendance for this work order/month.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="text-left font-medium px-2 py-2 w-8">#</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'श्रमिक' : 'Worker'}</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'श्रेणी' : 'Category'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'दिन/मात्रा' : 'Days/Qty'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'दर' : 'Rate'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'मज़दूरी' : 'Wage'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'चुकाया' : 'Paid'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'बकाया' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const wage = (r.daysWorked || 0) * (r.dailyWage || 0);
                    const bal = +(wage - (r.paidAmount || 0)).toFixed(2);
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2">{labourerCode(r.memberId) ? `${labourerCode(r.memberId)} · ` : ''}{labourerName(r.memberId)}</td>
                        <td className="px-2 py-2">{labourerCat(r.memberId)}</td>
                        <td className="px-2 py-2 text-right">{r.daysWorked}{r.workBasis && r.workBasis !== 'daily' ? ` ${unitWord(r.workBasis)}` : ''}</td>
                        <td className="px-2 py-2 text-right">{money(r.dailyWage)}</td>
                        <td className="px-2 py-2 text-right font-medium">{money(wage)}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{money(r.paidAmount || 0)}</td>
                        <td className="px-2 py-2 text-right">{money(bal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-2 py-2" colSpan={3}>{hi ? 'कुल' : 'Total'} ({rows.length} {hi ? 'श्रमिक' : 'workers'})</td>
                    <td className="px-2 py-2 text-right">{tot.days}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right">{money(tot.wage)}</td>
                    <td className="px-2 py-2 text-right">{money(tot.paid)}</td>
                    <td className="px-2 py-2 text-right">{money(+(tot.wage - tot.paid).toFixed(2))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground p-4 pt-8">
            <span>{hi ? 'तैयारकर्ता' : 'Prepared by'}: ____________</span>
            <span>{hi ? 'अधिकृत हस्ताक्षर' : 'Authorised signatory'}: ____________</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
