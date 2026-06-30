import { useMemo, useState } from 'react';
import { useLabourData, PF_ESI_DEFAULTS, type PfEsiConfig } from '@/contexts/LabourDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { ShieldCheck, IndianRupee, Trash2 } from 'lucide-react';

export default function PfEsi() {
  const { workers, pfEsiRuns, computePfEsi, postPfEsi, depositPfEsi, deletePfEsiRun } = useLabourData();
  const { accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || (hi ? 'अज्ञात' : 'Unknown');
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [cfg, setCfg] = useState<PfEsiConfig>(PF_ESI_DEFAULTS);
  const setRate = (k: keyof PfEsiConfig, v: string) => setCfg(c => ({ ...c, [k]: Number(v) || 0 }));

  const comp = useMemo(() => computePfEsi(period, cfg), [computePfEsi, period, cfg]);
  const alreadyPosted = pfEsiRuns.some(r => !r.isDeleted && r.period === period);
  const epfTotal = +(comp.epfEmployee + comp.epfEmployer + comp.epfAdminEdli).toFixed(2);
  const esiTotal = +(comp.esiEmployee + comp.esiEmployer).toFixed(2);
  // ECR account-head breakup (for challan reconciliation):
  const acEpf = +(comp.epfEmployee + (comp.epfEmployer - comp.epfEps)).toFixed(2);  // A/c 1: employee 12% + employer 3.67%
  const acEps = comp.epfEps;                                                         // A/c 10: EPS 8.33%
  const acEdli = +(comp.epfAdminEdli / 2).toFixed(2);                                // A/c 21: EDLI 0.5%
  const acAdmin = +(comp.epfAdminEdli - acEdli).toFixed(2);                          // A/c 2: admin 0.5%

  const runs = pfEsiRuns.filter(r => !r.isDeleted).sort((a, b) => (b.period || '').localeCompare(a.period || ''));

  // Deposit dialog
  const [depOpen, setDepOpen] = useState(false);
  const [depRunId, setDepRunId] = useState('');
  const [depMode, setDepMode] = useState<'cash' | 'bank'>('bank');
  const [depBankId, setDepBankId] = useState('');
  const [depDate, setDepDate] = useState('');

  const post = () => {
    const r = postPfEsi(period, cfg, new Date().toISOString().slice(0, 10));
    if (r.id) { /* success toast shown by context */ }
  };
  const openDep = (runId: string) => { setDepRunId(runId); setDepMode('bank'); setDepBankId(bankAccounts[0]?.id || ''); setDepDate(new Date().toISOString().slice(0, 10)); setDepOpen(true); };
  const confirmDep = () => {
    const v = depositPfEsi({ runId: depRunId, mode: depMode, bankAccountId: depMode === 'bank' ? (depBankId || undefined) : undefined, date: depDate });
    if (v.id) setDepOpen(false);
  };
  const remove = (id: string, p: string, deposited: boolean) => {
    // A deposited run was likely already filed with EPFO/ESIC — warn explicitly before reversing.
    const msg = deposited
      ? (hi ? `${p} की EPF/ESI जमा हो चुकी है — संभवतः EPFO/ESIC में दाख़िल। हटाने पर देयता व जमा दोनों voucher उलट जाएँगे। फिर भी हटाएँ?` : `${p} EPF/ESI is already deposited — likely filed with EPFO/ESIC. Deleting reverses BOTH the liability and deposit vouchers. Delete anyway?`)
      : (hi ? `${p} की EPF/ESI रन हटाएँ? (इसके voucher रद्द होंगे)` : `Delete EPF/ESI run for ${p}? (its vouchers cancel)`);
    if (!window.confirm(msg)) return;
    deletePfEsiRun(id);
    toast({ title: hi ? 'रन हटाया गया' : 'Run deleted' });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'EPF / ESI' : 'EPF / ESI'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'मासिक मज़दूरी पर EPF व ESI अंशदान की गणना, लेखांकन व जमा' : 'Monthly EPF & ESI contribution on wages — computation, posting & deposit'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'मासिक गणना' : 'Monthly Computation'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>{hi ? 'महीना' : 'Month'}</Label><Input type="month" value={period} onChange={e => setPeriod(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'EPF दर %' : 'EPF rate %'}</Label><Input type="number" value={cfg.epfRate} onChange={e => setRate('epfRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'EPF सीमा (₹)' : 'EPF ceiling (₹)'}</Label><Input type="number" value={cfg.epfCeiling} onChange={e => setRate('epfCeiling', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'EPS दर % (A/c10)' : 'EPS rate % (A/c10)'}</Label><Input type="number" value={cfg.epsRate} onChange={e => setRate('epsRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'EDLI दर % (A/c21)' : 'EDLI rate % (A/c21)'}</Label><Input type="number" value={cfg.edliRate} onChange={e => setRate('edliRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'Admin दर % (A/c2)' : 'Admin rate % (A/c2)'}</Label><Input type="number" value={cfg.adminRate} onChange={e => setRate('adminRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'ESI कर्म. %' : 'ESI emp %'}</Label><Input type="number" value={cfg.esiEmpRate} onChange={e => setRate('esiEmpRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'ESI नियोक्ता %' : 'ESI er %'}</Label><Input type="number" value={cfg.esiErRate} onChange={e => setRate('esiErRate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'ESI सीमा (₹)' : 'ESI ceiling (₹)'}</Label><Input type="number" value={cfg.esiCeiling} onChange={e => setRate('esiCeiling', e.target.value)} /></div>
          </div>

          {comp.perWorker.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'इस महीने की कोई मज़दूरी नहीं — पहले Muster Roll भरें।' : 'No wages for this month — fill the Muster Roll first.'}</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="text-left font-medium px-2 py-2">{hi ? 'श्रमिक' : 'Worker'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'मज़दूरी' : 'Wage'}</th>
                    <th className="text-right font-medium px-2 py-2">EPF {hi ? 'कर्म.' : 'EE'}</th>
                    <th className="text-right font-medium px-2 py-2">EPF {hi ? 'नियो.' : 'ER'}</th>
                    <th className="text-right font-medium px-2 py-2">ESI {hi ? 'कर्म.' : 'EE'}</th>
                    <th className="text-right font-medium px-2 py-2">ESI {hi ? 'नियो.' : 'ER'}</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.perWorker.map(w => (
                    <tr key={w.workerId} className="border-b last:border-0">
                      <td className="px-2 py-2">{workerName(w.workerId)}</td>
                      <td className="px-2 py-2 text-right">{money(w.wage)}</td>
                      <td className="px-2 py-2 text-right">{money(w.epfEmp)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{money(w.epfEr)}</td>
                      <td className="px-2 py-2 text-right">{money(w.esiEmp)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{money(w.esiEr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-2 py-2">{hi ? 'कुल' : 'Total'}</td>
                    <td className="px-2 py-2 text-right">{money(comp.grossWages)}</td>
                    <td className="px-2 py-2 text-right">{money(comp.epfEmployee)}</td>
                    <td className="px-2 py-2 text-right">{money(comp.epfEmployer)}</td>
                    <td className="px-2 py-2 text-right">{money(comp.esiEmployee)}</td>
                    <td className="px-2 py-2 text-right">{money(comp.esiEmployer)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {comp.perWorker.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{hi ? 'देय EPF' : 'EPF payable'}: <span className="font-semibold text-foreground">{money(epfTotal)}</span></span>
                <span>{hi ? 'देय ESI' : 'ESI payable'}: <span className="font-semibold text-foreground">{money(esiTotal)}</span></span>
              </div>
              {/* EPFO challan (ECR) account-head breakup */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground border-t pt-1.5">
                <span>A/c 1 (EPF): <span className="text-foreground">{money(acEpf)}</span></span>
                <span>A/c 10 (EPS): <span className="text-foreground">{money(acEps)}</span></span>
                <span>A/c 21 (EDLI): <span className="text-foreground">{money(acEdli)}</span></span>
                <span>A/c 2 (Admin): <span className="text-foreground">{money(acAdmin)}</span></span>
              </div>
              <p className="text-muted-foreground border-t pt-1.5">
                {hi
                  ? 'लेखा: नाम देय मज़दूरी(2109, कर्म.) + PF नियो.(5203) + EDLI/Admin(5209) + ESI नियो.(5204) / जमा देय EPF(2203) + देय ESI(2204)'
                  : 'Dr Wages Payable(2109, EE) + PF employer(5203) + EDLI/Admin(5209) + ESI employer(5204) / Cr EPF(2203) + ESI(2204) Payable'}
              </p>
            </div>
          )}

          <Button onClick={post} className="w-full" disabled={alreadyPosted || comp.perWorker.length === 0 || (epfTotal + esiTotal) <= 0}>
            {alreadyPosted ? (hi ? 'इस माह की देयता पहले से दर्ज' : 'Liability already posted for this month') : (hi ? 'EPF/ESI देयता पोस्ट करें' : 'Post EPF/ESI Liability')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'दर्ज रन' : 'Posted Runs'} ({runs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई रन नहीं।' : 'No runs yet.'}</p>}
          {runs.map(r => {
            const epf = +(r.epfEmployee + r.epfEmployer).toFixed(2); const esi = +(r.esiEmployee + r.esiEmployer).toFixed(2);
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {r.period}
                    <Badge variant={r.status === 'deposited' ? 'secondary' : 'destructive'}>{r.status === 'deposited' ? (hi ? 'जमा' : 'Deposited') : (hi ? 'देय' : 'Payable')}</Badge>
                  </div>
                  <div className="text-muted-foreground">{hi ? 'देय EPF' : 'EPF'} {money(epf)} · {hi ? 'देय ESI' : 'ESI'} {money(esi)} · {hi ? 'कुल' : 'total'} {money(epf + esi)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.status !== 'deposited' && <Button size="sm" onClick={() => openDep(r.id)}><IndianRupee className="h-4 w-4 mr-1" />{hi ? 'जमा करें' : 'Deposit'}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id, r.period, r.status === 'deposited')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'EPF/ESI जमा' : 'Deposit EPF/ESI'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{hi ? 'माध्यम' : 'Mode'}</Label>
                <Select value={depMode} onValueChange={v => setDepMode(v as 'cash' | 'bank')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                    <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} /></div>
            </div>
            {depMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={depBankId} onValueChange={setDepBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{hi ? 'लेखा: नाम देय EPF(2203)+देय ESI(2204) / जमा ' : 'Entry: Dr EPF(2203)+ESI(2204) Payable / Cr '}{depMode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={confirmDep}>{hi ? 'जमा दर्ज करें' : 'Record Deposit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
