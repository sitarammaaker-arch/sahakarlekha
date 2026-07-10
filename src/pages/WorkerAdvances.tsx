import { useState } from 'react';
import { useLabourData } from '@/contexts/LabourDataContext';
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
import { HandCoins, IndianRupee, Trash2 } from 'lucide-react';
import type { WorkerAdvance } from '@/types';
import EntityExportButton from '@/components/export/EntityExportButton';

export default function WorkerAdvances() {
  const { workers, workerAdvances, addWorkerAdvance, recordAdvanceRecovery, deleteWorkerAdvance } = useLabourData();
  const { accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  const activeWorkers = workers.filter(w => !w.isDeleted && w.status === 'active');
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || (hi ? 'अज्ञात श्रमिक' : 'Unknown worker');

  // Give-advance form
  const [workerId, setWorkerId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');

  // Recover dialog
  const [recOpen, setRecOpen] = useState(false);
  const [recId, setRecId] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recMode, setRecMode] = useState<'cash' | 'bank'>('cash');
  const [recBankId, setRecBankId] = useState('');
  const [recDate, setRecDate] = useState('');

  const advances = workerAdvances.filter(a => !a.isDeleted);
  const outstandingOf = (a: WorkerAdvance) => +(a.amount - a.recovered).toFixed(2);
  const totGiven = advances.reduce((s, a) => s + a.amount, 0);
  const totOutstanding = advances.reduce((s, a) => s + outstandingOf(a), 0);

  const give = () => {
    if (!workerId) { toast({ title: hi ? 'श्रमिक चुनें' : 'Select a worker', variant: 'destructive' }); return; }
    const v = Number(amount);
    if (!(v > 0)) { toast({ title: hi ? 'राशि दर्ज करें' : 'Enter a valid amount', variant: 'destructive' }); return; }
    const a = addWorkerAdvance({ workerId, amount: v, mode, bankAccountId: mode === 'bank' ? (bankId || undefined) : undefined, date, narration: narration.trim() || undefined });
    if (a.id) { setAmount(''); setNarration(''); setWorkerId(''); }
  };

  const openRec = (a: WorkerAdvance) => {
    setRecId(a.id); setRecAmount(String(outstandingOf(a))); setRecMode('cash'); setRecBankId(bankAccounts[0]?.id || '');
    setRecDate(new Date().toISOString().slice(0, 10)); setRecOpen(true);
  };
  const confirmRec = () => {
    const amt = Number(recAmount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const v = recordAdvanceRecovery({ advanceId: recId, amount: amt, mode: recMode, bankAccountId: recMode === 'bank' ? (recBankId || undefined) : undefined, date: recDate });
    if (v.id) setRecOpen(false);
  };
  const remove = (a: WorkerAdvance) => {
    if (!window.confirm(hi ? `अग्रिम ${a.advanceNo} हटाएँ? (वसूली voucher भी रद्द होंगे)` : `Delete advance ${a.advanceNo}? (its recovery vouchers cancel too)`)) return;
    deleteWorkerAdvance(a.id);
    toast({ title: hi ? 'अग्रिम हटाया गया' : 'Advance deleted' });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <HandCoins className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'श्रमिक अग्रिम' : 'Worker Advances'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'श्रमिकों को अग्रिम दें व वसूली दर्ज करें (परिसंपत्ति — ऋण एवं अग्रिम 3304)' : 'Give advances to workers and record recovery (asset — Loans & Advances 3304)'}</p>
        </div>
        {/* T-19: this register had no export at all (audit gap EXP-10). The
            Export Registry decides whether it renders, which columns leave, and whether
            the audit row was written before any bytes did. */}
        <div className="ml-auto">
          <EntityExportButton entityKey="worker_advance" />
        </div>
      </div>

      {activeWorkers.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          {hi ? 'पहले "श्रमिक मास्टर" में श्रमिक जोड़ें।' : 'Add workers in Worker Master first.'}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया अग्रिम' : 'New Advance'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'श्रमिक' : 'Worker'} *</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'श्रमिक चुनें' : 'Select worker'} /></SelectTrigger>
                <SelectContent>{activeWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.workerCode ? `${w.workerCode} · ` : ''}{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'} *</Label><Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div className="space-y-2"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>{hi ? 'भुगतान माध्यम' : 'Mode'}</Label>
              <Select value={mode} onValueChange={v => setMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'bank' && (
              <div className="space-y-2">
                <Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2"><Label>{hi ? 'विवरण (वैकल्पिक)' : 'Narration (optional)'}</Label><Input value={narration} onChange={e => setNarration(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">{hi ? 'लेखा प्रविष्टि: नाम ऋण एवं अग्रिम (3304) / जमा ' : 'Entry: Dr Loans & Advances (3304) / Cr '}{mode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}</p>
          <Button onClick={give} className="w-full" disabled={activeWorkers.length === 0}>{hi ? 'अग्रिम दें' : 'Give Advance'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'दर्ज अग्रिम' : 'Advances'} ({advances.length})</span>
            {advances.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल दिया' : 'Given'} {money(totGiven)} · {hi ? 'बकाया' : 'Outstanding'} {money(totOutstanding)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {advances.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई अग्रिम नहीं।' : 'No advances yet.'}</p>}
          {advances.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {a.advanceNo} · {workerName(a.workerId)}
                  <Badge variant={a.status === 'cleared' ? 'secondary' : 'destructive'}>{a.status === 'cleared' ? (hi ? 'चुकता' : 'Cleared') : (hi ? 'बकाया' : 'Open')}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {a.date} · {money(a.amount)}
                  {a.recovered > 0 && a.status !== 'cleared' && <span> · {hi ? 'वसूल' : 'recovered'} {money(a.recovered)} · {hi ? 'बकाया' : 'due'} {money(outstandingOf(a))}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {a.status !== 'cleared' && <Button size="sm" onClick={() => openRec(a)}><IndianRupee className="h-4 w-4 mr-1" />{hi ? 'वसूली' : 'Recover'}</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'अग्रिम वसूली' : 'Recover Advance'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label><Input type="number" min={0} value={recAmount} onChange={e => setRecAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'माध्यम' : 'Mode'}</Label>
              <Select value={recMode} onValueChange={v => setRecMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={recBankId} onValueChange={setRecBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{hi ? 'लेखा प्रविष्टि: नाम ' : 'Entry: Dr '}{recMode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}{hi ? ' / जमा ऋण एवं अग्रिम (3304)' : ' / Cr Loans & Advances (3304)'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={confirmRec}>{hi ? 'वसूली दर्ज करें' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
