/**
 * वाहन खर्च (Vehicle expenses) — diesel, tyres, repairs, toll … paid for ONE vehicle. Each entry is one
 * payment voucher (Dr expense head / Cr cash-bank) owned by the expense row; the row is what puts the cost on
 * the vehicle in Vehicle-wise Profit. A cost entered as a plain payment voucher has no vehicle and shows
 * there as "unallocated".
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTransportOps } from '@/contexts/TransportOpsContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBankAccountIds } from '@/lib/storage';
import { Fuel, Trash2 } from 'lucide-react';
import EntityExportButton from '@/components/export/EntityExportButton';
import { resolveTransportAccounts, TRANSPORT_EXPENSE_ROLES } from '@/lib/transport/accounts';
import type { VehicleExpense } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function VehicleExpenses() {
  const { vehicles, vehicleExpenses, addVehicleExpense, deleteVehicleExpense } = useTransportOps();
  const { accounts } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const accName = (id: string) => { const a = accounts.find(x => x.id === id); return a ? (hi ? (a.nameHi || a.name) : a.name) : id; };

  // Transport heads first (5701 Diesel …), then every other expense ledger (driver wages, depreciation …).
  const heads = useMemo(() => {
    const ids = resolveTransportAccounts(accounts);
    const transport = TRANSPORT_EXPENSE_ROLES.map(r => ids[r]).filter((x): x is string => !!x);
    const set = new Set(transport);
    const others = accounts.filter(a => a.type === 'expense' && !a.isGroup && !set.has(a.id)).map(a => a.id);
    return { transport, others };
  }, [accounts]);

  const activeVehicles = vehicles.filter(v => !v.isDeleted && v.status === 'active');
  const vehicleNo = (id: string) => vehicles.find(v => v.id === id)?.regNo || (hi ? 'अज्ञात वाहन' : 'Unknown vehicle');

  const [vehicleId, setVehicleId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [narration, setNarration] = useState('');

  const list = vehicleExpenses.filter(e => !e.isDeleted).sort((a, b) => (b.date + b.expenseNo).localeCompare(a.date + a.expenseNo));
  const total = list.reduce((s, e) => s + e.amount, 0);

  const save = () => {
    addVehicleExpense(
      { date, vehicleId, accountId, amount: Number(amount) || 0, mode, bankAccountId: mode === 'bank' ? (bankId || bankAccounts[0]?.id) : undefined, narration: narration.trim() || undefined },
      { onSaved: () => { setAmount(''); setNarration(''); } },
    );
  };
  const remove = (e: VehicleExpense) => {
    if (!window.confirm(hi ? `खर्च ${e.expenseNo} हटाएँ? (इसका वाउचर भी रद्द होगा)` : `Delete expense ${e.expenseNo}? (its voucher will be cancelled too)`)) return;
    deleteVehicleExpense(e.id);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Fuel className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{hi ? 'वाहन खर्च' : 'Vehicle Expenses'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'डीज़ल, टायर, मरम्मत, टोल … हर खर्च किसी एक वाहन के नाम — ताकि वाहन-वार लाभ निकले' : 'Diesel, tyres, repairs, toll … each cost against one vehicle, so vehicle-wise profit can be worked out'}</p>
        </div>
        <div className="ml-auto"><EntityExportButton entityKey="transport_vehicle_expense" /></div>
      </div>

      {heads.transport.length === 0 && (
        <Card className="border-amber-300"><CardContent className="py-4 text-sm">
          {hi ? 'वाहन खर्च के खाते (डीज़ल, टायर …) आपके chart में नहीं हैं — ' : 'Your chart has no vehicle-expense ledgers (diesel, tyres …) — '}
          <Link to="/ledger-hygiene" className="text-primary underline">{hi ? 'Ledger Hygiene → "डोमेन खाते बनाएँ"' : 'Ledger Hygiene → "Create domain accounts"'}</Link>
        </CardContent></Card>
      )}
      {activeVehicles.length === 0 && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground">{hi ? 'पहले ' : 'First add a vehicle in '}<Link to="/transport-vehicles" className="text-primary underline">{hi ? 'वाहन' : 'Vehicles'}</Link>{hi ? ' में वाहन जोड़ें।' : '.'}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया खर्च' : 'New expense'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'वाहन' : 'Vehicle'} *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'वाहन चुनें' : 'Select vehicle'} /></SelectTrigger>
                <SelectContent>{activeVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.regNo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'खर्च का खाता' : 'Expense head'} *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select head'} /></SelectTrigger>
                <SelectContent>
                  {heads.transport.map(id => <SelectItem key={id} value={id}>{accName(id)}</SelectItem>)}
                  {heads.others.map(id => <SelectItem key={id} value={id}>{accName(id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'} *</Label><Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div className="space-y-2">
              <Label>{hi ? 'भुगतान माध्यम' : 'Paid by'}</Label>
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
                <Select value={bankId || bankAccounts[0]?.id || ''} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2"><Label>{hi ? 'विवरण (वैकल्पिक)' : 'Narration (optional)'}</Label><Input value={narration} onChange={e => setNarration(e.target.value)} placeholder={hi ? 'जैसे पंप का बिल नं., लीटर' : 'e.g. pump bill no., litres'} /></div>
          </div>
          <p className="text-xs text-muted-foreground">{hi ? 'लेखा प्रविष्टि: नाम खर्च खाता / जमा नकद-बैंक' : 'Entry: Dr expense head / Cr cash-bank'}</p>
          <Button onClick={save} className="w-full" disabled={activeVehicles.length === 0}>{hi ? 'खर्च सेव करें' : 'Save expense'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center justify-between flex-wrap gap-2"><span>{hi ? 'दर्ज खर्च' : 'Expenses'} ({list.length})</span>{list.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल' : 'Total'} {money(total)}</span>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई खर्च नहीं।' : 'No expenses yet.'}</p>}
          {list.map(e => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{e.expenseNo} · {vehicleNo(e.vehicleId)} · {accName(e.accountId)}</div>
                <div className="text-muted-foreground">{e.date} · {money(e.amount)} · {e.mode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}{e.narration ? ` · ${e.narration}` : ''}</div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
