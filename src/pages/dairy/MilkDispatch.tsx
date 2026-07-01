import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Trash2, HandCoins } from 'lucide-react';
import type { DairyDispatch, MilkShift } from '@/types';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const due = (d: DairyDispatch) => Math.max(0, +(d.amount - d.amountReceived).toFixed(2));

function DispatchRow({ d }: { d: DairyDispatch }) {
  const { accounts } = useData();
  const { receiveUnionPayment, deleteDairyDispatch } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const banks = useMemo(() => accounts.filter(a => a.subtype === 'cash_bank' && a.id !== '3301'), [accounts]);
  const [amt, setAmt] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('bank');
  const [bank, setBank] = useState('');
  const [date, setDate] = useState(today());
  const outstanding = due(d);

  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium flex flex-wrap items-center gap-1">
            <span>{d.unionName}</span>
            <Badge variant="outline">{d.qty} {hi ? 'लीटर' : 'L'}</Badge>
            {d.fat ? <Badge variant="secondary">fat {d.fat}</Badge> : null}
            {d.shortage ? <Badge variant="destructive">{hi ? 'शॉर्टेज' : 'short'} {d.shortage}</Badge> : null}
          </div>
          <div className="text-muted-foreground text-xs">{d.date}{d.shift ? ` · ${d.shift === 'morning' ? (hi ? 'सुबह' : 'AM') : (hi ? 'शाम' : 'PM')}` : ''}{d.vehicleNo ? ` · ${d.vehicleNo}` : ''}</div>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'डिस्पैच हटाएँ?' : 'Delete dispatch?')) deleteDairyDispatch(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><div className="text-muted-foreground">{hi ? 'बिक्री' : 'Sale'}</div><div className="font-medium">{inr(d.amount)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'प्राप्त' : 'Received'}</div><div className="font-medium">{inr(d.amountReceived)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'बकाया' : 'Due'}</div><div className="font-medium text-amber-700">{inr(outstanding)}</div></div>
      </div>
      {outstanding > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-md border-dashed border p-2">
          <div className="space-y-1"><Label className="text-xs">{hi ? 'राशि' : 'Amount'}</Label><Input type="number" className="h-8" value={amt} onChange={e => setAmt(e.target.value)} placeholder={String(outstanding)} /></div>
          <div className="space-y-1"><Label className="text-xs">{hi ? 'माध्यम' : 'Mode'}</Label>
            <Select value={mode} onValueChange={v => setMode(v as 'cash' | 'bank')}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem></SelectContent></Select></div>
          {mode === 'bank' && <div className="space-y-1"><Label className="text-xs">{hi ? 'बैंक' : 'Bank'}</Label>
            <Select value={bank} onValueChange={setBank}><SelectTrigger className="h-8"><SelectValue placeholder="3302" /></SelectTrigger>
              <SelectContent>{banks.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>}
          <div className="space-y-1"><Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label><Input type="date" className="h-8" value={date} onChange={e => setDate(e.target.value)} /></div>
          <Button size="sm" onClick={() => { receiveUnionPayment({ dispatchId: d.id, amount: Number(amt) || outstanding, mode, bankAccountId: mode === 'bank' ? (bank || undefined) : undefined, date }); setAmt(''); }}><HandCoins className="h-4 w-4 mr-1" />{hi ? 'प्राप्ति' : 'Receive'}</Button>
        </div>
      )}
    </div>
  );
}

export default function MilkDispatch() {
  const { dispatches, recordDairyDispatch } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [date, setDate] = useState(today());
  const [shift, setShift] = useState<MilkShift>('morning');
  const [unionName, setUnionName] = useState('');
  const [qty, setQty] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [rate, setRate] = useState('');
  const [shortage, setShortage] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const amount = +((Number(qty) || 0) * (Number(rate) || 0)).toFixed(2);
  const list = dispatches.filter(d => !d.isDeleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));

  const save = () => {
    const d = recordDairyDispatch({
      date, shift, unionName: unionName.trim() || (hi ? 'यूनियन' : 'Union'),
      qty: Number(qty) || 0, fat: fat ? Number(fat) : undefined, snf: snf ? Number(snf) : undefined,
      rate: Number(rate) || 0, shortage: shortage ? Number(shortage) : undefined, vehicleNo: vehicleNo.trim() || undefined,
    });
    if (d.id) { setQty(''); setFat(''); setSnf(''); setShortage(''); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Truck className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'दुग्ध डिस्पैच (यूनियन बिक्री)' : 'Milk Dispatch (Union Sales)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'यूनियन को दूध भेजें → Dr देनदार / Cr दुग्ध बिक्री; भुगतान प्राप्त करें' : 'Dispatch to the union → Dr receivable / Cr milk sales; receive payment'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया डिस्पैच' : 'New Dispatch'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'पाली' : 'Shift'}</Label>
              <Select value={shift} onValueChange={v => setShift(v as MilkShift)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="morning">{hi ? 'सुबह' : 'Morning'}</SelectItem><SelectItem value="evening">{hi ? 'शाम' : 'Evening'}</SelectItem></SelectContent></Select></div>
            <div className="space-y-1 col-span-2"><Label>{hi ? 'यूनियन' : 'Union'}</Label><Input value={unionName} onChange={e => setUnionName(e.target.value)} placeholder={hi ? 'जैसे ज़िला संघ' : 'e.g. District Union'} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>{hi ? 'लीटर' : 'Litres'}</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'दर ₹/लीटर' : 'Rate ₹/L'}</Label><Input type="number" value={rate} onChange={e => setRate(e.target.value)} /></div>
            <div className="space-y-1"><Label>fat %</Label><Input type="number" value={fat} onChange={e => setFat(e.target.value)} /></div>
            <div className="space-y-1"><Label>SNF %</Label><Input type="number" value={snf} onChange={e => setSnf(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>{hi ? 'शॉर्टेज (लीटर)' : 'Shortage (L)'}</Label><Input type="number" value={shortage} onChange={e => setShortage(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'वाहन नं.' : 'Vehicle No'}</Label><Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} /></div>
            <div className="sm:col-span-2 self-end text-sm text-muted-foreground">{hi ? 'बिक्री मूल्य' : 'Sale value'}: <b className="text-foreground">{inr(amount)}</b></div>
          </div>
          <Button className="w-full" disabled={!(Number(qty) > 0 && Number(rate) > 0)} onClick={save}>{hi ? 'डिस्पैच दर्ज करें' : 'Record Dispatch'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'पोस्ट: Dr यूनियन देनदार (3303) / Cr दुग्ध बिक्री — यूनियन (4106)।' : 'Posts: Dr Union Receivable (3303) / Cr Milk Sales — Bulk (4106).'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'डिस्पैच' : 'Dispatches'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई डिस्पैच नहीं।' : 'No dispatches yet.'}</p>}
          {list.map(d => <DispatchRow key={d.id} d={d} />)}
        </CardContent>
      </Card>
    </div>
  );
}
