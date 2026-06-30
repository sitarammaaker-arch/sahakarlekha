import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLabourData, PF_ESI_DEFAULTS } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BadgeDollarSign, Printer } from 'lucide-react';

const thisMonth = new Date().toISOString().slice(0, 7);

export default function WageSlip() {
  const { musterEntries, society } = useData();
  const { workers, computePfEsi, workerAdvances } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

  const activeWorkers = workers.filter(w => !w.isDeleted);
  const [workerId, setWorkerId] = useState(activeWorkers[0]?.id || '');
  const [period, setPeriod] = useState(thisMonth);

  const CAT: Record<string, { en: string; hi: string }> = {
    skilled: { en: 'Skilled', hi: 'कुशल' }, semi_skilled: { en: 'Semi-skilled', hi: 'अर्ध-कुशल' }, unskilled: { en: 'Unskilled', hi: 'अकुशल' },
    operator: { en: 'Operator', hi: 'ऑपरेटर' }, helper: { en: 'Helper', hi: 'सहायक' }, supervisor: { en: 'Supervisor', hi: 'पर्यवेक्षक' },
  };
  const worker = activeWorkers.find(w => w.id === workerId);

  const slip = useMemo(() => {
    const rows = musterEntries.filter(m => !m.isDeleted && m.period === period && m.memberId === workerId);
    const gross = rows.reduce((s, r) => s + (r.daysWorked || 0) * (r.dailyWage || 0), 0);
    const days = rows.reduce((s, r) => s + (r.daysWorked || 0), 0);
    const pf = computePfEsi(period, PF_ESI_DEFAULTS).perWorker.find(p => p.workerId === workerId);
    const epfEmp = pf?.epfEmp || 0;
    const esiEmp = pf?.esiEmp || 0;
    const net = +(gross - epfEmp - esiEmp).toFixed(2);
    const advanceOut = workerAdvances
      .filter(a => !a.isDeleted && a.workerId === workerId && a.status !== 'cleared')
      .reduce((s, a) => s + ((a.amount || 0) - (a.recovered || 0)), 0);
    return { gross, days, epfEmp, esiEmp, net, advanceOut, hasData: rows.length > 0 };
  }, [musterEntries, workerId, period, computePfEsi, workerAdvances]);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <style>{`@media print { body * { visibility: hidden !important; } #wage-slip, #wage-slip * { visibility: visible !important; } #wage-slip { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; } .no-print { display: none !important; } }`}</style>

      <div className="flex items-center gap-3 no-print">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BadgeDollarSign className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'मज़दूरी पर्ची' : 'Wage Slip'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'श्रमिक-वार मासिक मज़दूरी पर्ची (EPF/ESI कटौती सहित, छपने-योग्य)' : 'Per-worker monthly wage slip with EPF/ESI deductions (printable)'}</p>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'श्रमिक' : 'Worker'}</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{activeWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.workerCode} · {w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'महीना' : 'Month'}</Label>
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={() => window.print()} disabled={!slip.hasData}>
            <Printer className="h-4 w-4 mr-1" />{hi ? 'पर्ची प्रिंट करें' : 'Print Slip'}
          </Button>
        </CardContent>
      </Card>

      {/* Printable slip */}
      <Card id="wage-slip">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-lg">{society?.name || (hi ? 'सहकारी समिति' : 'Cooperative Society')}</CardTitle>
          <p className="text-sm font-medium">{hi ? 'मज़दूरी पर्ची' : 'Wage Slip'} · {period}</p>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {!worker ? (
            <p className="text-sm text-muted-foreground">{hi ? 'श्रमिक चुनें।' : 'Select a worker.'}</p>
          ) : !slip.hasData ? (
            <p className="text-sm text-muted-foreground">{hi ? 'इस श्रमिक/महीने की कोई मज़दूरी नहीं।' : 'No wages for this worker/month.'}</p>
          ) : (
            <>
              {/* Worker details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><span className="text-muted-foreground">{hi ? 'नाम' : 'Name'}: </span>{worker.name}</div>
                <div><span className="text-muted-foreground">{hi ? 'कोड' : 'Code'}: </span>{worker.workerCode}</div>
                {worker.fatherHusbandName && <div><span className="text-muted-foreground">{hi ? 'पिता/पति' : 'Father/Husband'}: </span>{worker.fatherHusbandName}</div>}
                <div><span className="text-muted-foreground">{hi ? 'श्रेणी' : 'Category'}: </span>{hi ? CAT[worker.category]?.hi : CAT[worker.category]?.en}</div>
                {worker.uan && <div><span className="text-muted-foreground">UAN: </span>{worker.uan}</div>}
                {worker.esiIp && <div><span className="text-muted-foreground">ESI IP: </span>{worker.esiIp}</div>}
              </div>

              {/* Earnings & deductions */}
              <table className="w-full text-sm border-t pt-2">
                <tbody>
                  <tr className="border-b">
                    <td className="py-1.5">{hi ? 'सकल मज़दूरी' : 'Gross wages'} <span className="text-muted-foreground">({slip.days} {hi ? 'दिन/मात्रा' : 'days/qty'})</span></td>
                    <td className="py-1.5 text-right font-medium">{money(slip.gross)}</td>
                  </tr>
                  {slip.epfEmp > 0 && (
                    <tr className="border-b text-muted-foreground">
                      <td className="py-1.5">(−) {hi ? 'EPF कर्मचारी अंश' : 'EPF (employee)'} </td>
                      <td className="py-1.5 text-right">{money(slip.epfEmp)}</td>
                    </tr>
                  )}
                  {slip.esiEmp > 0 && (
                    <tr className="border-b text-muted-foreground">
                      <td className="py-1.5">(−) {hi ? 'ESI कर्मचारी अंश' : 'ESI (employee)'} </td>
                      <td className="py-1.5 text-right">{money(slip.esiEmp)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2">{hi ? 'शुद्ध देय मज़दूरी' : 'Net wages payable'}</td>
                    <td className="py-2 text-right">{money(slip.net)}</td>
                  </tr>
                </tbody>
              </table>

              {slip.advanceOut > 0 && (
                <p className="text-xs text-muted-foreground">
                  {hi ? 'टिप्पणी: बकाया अग्रिम' : 'Note: outstanding advance'} {money(slip.advanceOut)} — {hi ? 'अलग से वसूली योग्य (शुद्ध मज़दूरी में से नहीं काटा गया)।' : 'recoverable separately (not deducted from net wages above).'}
                </p>
              )}

              <div className="flex justify-between text-xs text-muted-foreground pt-8">
                <span>{hi ? 'श्रमिक हस्ताक्षर/अंगूठा' : 'Worker signature/thumb'}: ____________</span>
                <span>{hi ? 'अधिकृत हस्ताक्षर' : 'Authorised signatory'}: ____________</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
