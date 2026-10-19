/**
 * ट्रिप / भाड़ा बिल (Trips) — a freight trip by one of the society's vehicles for a customer. Posting a trip
 * makes ONE journal voucher: Dr customer / Cr Freight Income (4501) [+ Loading 4503, Detention 4504]. Collection
 * is a receipt against the trip (partial allowed, TDS withheld by the customer → 3307). Deleting a trip cancels
 * its voucher and its receipts. GST is OFF in this slice (no sourced GTA rule yet) — the page says so.
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getBankAccountIds } from '@/lib/storage';
import { Route as RouteIcon, IndianRupee, Trash2 } from 'lucide-react';
import EntityExportButton from '@/components/export/EntityExportButton';
import { resolveTransportAccounts } from '@/lib/transport/accounts';
import { tripAmount } from '@/lib/transport/trips';
import type { TransportTrip } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function Trips() {
  const { vehicles, trips, addTrip, recordTripCollection, deleteTrip } = useTransportOps();
  const { customers, accounts } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const ids = useMemo(() => resolveTransportAccounts(accounts), [accounts]);
  const hasTdsAccount = accounts.some(a => a.id === '3307' && !a.isGroup);

  const activeVehicles = vehicles.filter(v => !v.isDeleted && v.status === 'active');
  const activeCustomers = customers.filter(c => c.isActive !== false && c.accountId);
  const vehicleNo = (id: string) => vehicles.find(v => v.id === id)?.regNo || (hi ? 'अज्ञात वाहन' : 'Unknown vehicle');
  const customerName = (id: string) => customers.find(c => c.id === id)?.name || (hi ? 'अज्ञात ग्राहक' : 'Unknown customer');

  const [vehicleId, setVehicleId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(today());
  const [fromPlace, setFromPlace] = useState('');
  const [toPlace, setToPlace] = useState('');
  const [freight, setFreight] = useState('');
  const [loading, setLoading] = useState('');
  const [detention, setDetention] = useState('');
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);

  const total = tripAmount({ freight: Number(freight) || 0, loading: Number(loading) || 0, detention: Number(detention) || 0 });
  const list = trips.filter(t => !t.isDeleted).sort((a, b) => (b.date + b.tripNo).localeCompare(a.date + a.tripNo));
  const outstandingOf = (t: TransportTrip) => +(t.amount - t.paidAmount).toFixed(2);
  const totalBilled = list.reduce((s, t) => s + t.amount, 0);
  const totalOutstanding = list.reduce((s, t) => s + outstandingOf(t), 0);

  const save = () => {
    setSaving(true);
    const t = addTrip(
      { date, vehicleId, customerId, fromPlace, toPlace, freight: Number(freight) || 0, loading: Number(loading) || 0, detention: Number(detention) || 0, narration: narration.trim() || undefined },
      { onSaved: () => { setFromPlace(''); setToPlace(''); setFreight(''); setLoading(''); setDetention(''); setNarration(''); setSaving(false); } },
    );
    if (!t.id) setSaving(false);
    else setTimeout(() => setSaving(false), 8000); // never leave the button stuck if the cloud is slow
  };

  // Collection dialog
  const [payTrip, setPayTrip] = useState<TransportTrip | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payTds, setPayTds] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payRef, setPayRef] = useState('');
  const openPay = (t: TransportTrip) => {
    setPayTrip(t); setPayAmount(String(outstandingOf(t))); setPayTds(''); setPayMode('cash');
    setPayBankId(bankAccounts[0]?.id || ''); setPayDate(today()); setPayRef('');
  };
  const confirmPay = () => {
    if (!payTrip) return;
    const v = recordTripCollection({ tripId: payTrip.id, amount: Number(payAmount) || 0, tdsAmount: Number(payTds) || 0, mode: payMode, bankAccountId: payMode === 'bank' ? (payBankId || undefined) : undefined, date: payDate, reference: payRef.trim() || undefined });
    if (v.id) setPayTrip(null);
  };
  const payNet = +Math.max(0, (Number(payAmount) || 0) - (Number(payTds) || 0)).toFixed(2);

  const remove = (t: TransportTrip) => {
    if (!window.confirm(hi ? `ट्रिप ${t.tripNo} हटाएँ? (इसका वाउचर और वसूली रसीदें भी रद्द होंगी)` : `Delete trip ${t.tripNo}? (its voucher and receipts will be cancelled too)`)) return;
    deleteTrip(t.id);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><RouteIcon className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{hi ? 'ट्रिप / भाड़ा बिल' : 'Trips / Freight Bills'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'अपने वाहन से ढुलाई — भाड़ा आय और ग्राहक की बकाया राशि, फिर वसूली' : "Hauls by the society's vehicles — freight income and the customer's receivable, then collection"}</p>
        </div>
        <div className="ml-auto"><EntityExportButton entityKey="transport_trip" /></div>
      </div>

      {!ids.freight && (
        <Card className="border-amber-300"><CardContent className="py-4 text-sm space-y-1">
          <p className="font-medium">{hi ? 'भाड़ा आय (Freight Income, 4501) खाता आपके chart में नहीं है।' : 'Your chart has no Freight Income (4501) ledger.'}</p>
          <p className="text-muted-foreground">{hi ? 'परिवहन के खाते एक बार बनाने हैं: ' : 'Create the transport ledgers once: '}<Link to="/ledger-hygiene" className="text-primary underline">{hi ? 'Ledger Hygiene → "डोमेन खाते बनाएँ"' : 'Ledger Hygiene → "Create domain accounts"'}</Link></p>
        </CardContent></Card>
      )}
      {(activeVehicles.length === 0 || activeCustomers.length === 0) && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground space-y-1">
          {activeVehicles.length === 0 && <p>{hi ? 'पहले ' : 'First add a vehicle in '}<Link to="/transport-vehicles" className="text-primary underline">{hi ? 'वाहन' : 'Vehicles'}</Link>{hi ? ' में वाहन जोड़ें।' : '.'}</p>}
          {activeCustomers.length === 0 && <p>{hi ? 'भाड़ा ग्राहक के नाम बनता है — पहले ' : 'Freight is billed to a customer — first add one in '}<Link to="/customers" className="text-primary underline">{hi ? 'ग्राहक' : 'Customers'}</Link>{hi ? ' में ग्राहक जोड़ें।' : '.'}</p>}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई ट्रिप' : 'New trip'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'वाहन' : 'Vehicle'} *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'वाहन चुनें' : 'Select vehicle'} /></SelectTrigger>
                <SelectContent>{activeVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.regNo}{v.capacity ? ` · ${v.capacity}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'ग्राहक' : 'Customer'} *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'ग्राहक चुनें' : 'Select customer'} /></SelectTrigger>
                <SelectContent>{activeCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>{hi ? 'कहाँ से' : 'From'}</Label><Input value={fromPlace} onChange={e => setFromPlace(e.target.value)} /></div>
              <div className="space-y-2"><Label>{hi ? 'कहाँ तक' : 'To'}</Label><Input value={toPlace} onChange={e => setToPlace(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>{hi ? 'भाड़ा (₹)' : 'Freight (₹)'} *</Label><Input type="number" min={0} value={freight} onChange={e => setFreight(e.target.value)} placeholder="0" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>{hi ? 'लदाई/उतराई (₹)' : 'Loading (₹)'}</Label><Input type="number" min={0} value={loading} onChange={e => setLoading(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><Label>{hi ? 'रुकाई (₹)' : 'Detention (₹)'}</Label><Input type="number" min={0} value={detention} onChange={e => setDetention(e.target.value)} placeholder="0" /></div>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>{hi ? 'विवरण (वैकल्पिक)' : 'Narration (optional)'}</Label><Input value={narration} onChange={e => setNarration(e.target.value)} placeholder={hi ? 'जैसे बिल्टी नं., माल' : 'e.g. LR no., goods'} /></div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>{hi ? 'लेखा प्रविष्टि: नाम ग्राहक ' : 'Entry: Dr customer '}<span className="font-medium text-foreground">{money(total)}</span>{hi ? ' / जमा भाड़ा आय (4501)' : ' / Cr Freight Income (4501)'}{(Number(loading) || 0) > 0 ? (hi ? ', लदाई शुल्क (4503)' : ', Loading charges (4503)') : ''}{(Number(detention) || 0) > 0 ? (hi ? ', रुकाई शुल्क (4504)' : ', Detention (4504)') : ''}</p>
            <p>{hi ? 'GST: इस ट्रिप पर GST नहीं जुड़ता। माल-ढुलाई (GTA) पर GST कौन भरेगा (समिति या ग्राहक — reverse charge) और किस दर से, यह आपके विकल्प और ग्राहक पर निर्भर है; इसका स्रोत-सहित नियम अभी app में नहीं है। अपने CA से पूछकर GST अलग वाउचर से दर्ज करें।' : 'GST: none is added to this trip. Who pays GST on goods transport (GTA) — the society or the customer under reverse charge — and at what rate depends on your option and the customer; the app has no sourced rule for it yet. Ask your CA and record GST by a separate voucher.'}</p>
          </div>
          <Button onClick={save} className="w-full" disabled={saving || !ids.freight || activeVehicles.length === 0 || activeCustomers.length === 0}>{saving ? (hi ? 'सेव हो रहा है…' : 'Saving…') : (hi ? 'ट्रिप सेव करें' : 'Save trip')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'दर्ज ट्रिप' : 'Trips'} ({list.length})</span>
            {list.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल' : 'Billed'} {money(totalBilled)} · {hi ? 'बकाया' : 'Outstanding'} {money(totalOutstanding)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई ट्रिप नहीं।' : 'No trips yet.'}</p>}
          {list.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {t.tripNo} · {vehicleNo(t.vehicleId)} · {customerName(t.customerId)}
                  <Badge variant={t.status === 'paid' ? 'default' : t.status === 'partial' ? 'outline' : 'destructive'}>{t.status === 'paid' ? (hi ? 'वसूल' : 'Paid') : t.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid')}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {t.date} · {t.fromPlace || '—'} → {t.toPlace || '—'} · {money(t.amount)}
                  {t.paidAmount > 0 && t.status !== 'paid' && <span> · {hi ? 'वसूल' : 'collected'} {money(t.paidAmount)} · {hi ? 'बकाया' : 'due'} {money(outstandingOf(t))}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.status !== 'paid' && <Button size="sm" onClick={() => openPay(t)}><IndianRupee className="h-4 w-4 mr-1" />{hi ? 'वसूली' : 'Collect'}</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!payTrip} onOpenChange={o => { if (!o) setPayTrip(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'वसूली दर्ज करें' : 'Record collection'}{payTrip ? ` — ${payTrip.tripNo}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'माध्यम' : 'Mode'}</Label>
              <Select value={payMode} onValueChange={v => setPayMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={payBankId} onValueChange={setPayBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {hasTdsAccount && (
              <div className="space-y-1.5">
                <Label>{hi ? 'ग्राहक द्वारा काटा TDS (₹)' : 'TDS withheld by customer (₹)'}</Label>
                <Input type="number" min={0} value={payTds} onChange={e => setPayTds(e.target.value)} placeholder="0" />
                <p className="text-xs text-muted-foreground">{hi ? 'TDS प्राप्य (3307) में जाएगा। शुद्ध नकद' : 'Goes to TDS Receivable (3307). Net cash'}: <span className="font-medium text-foreground">{money(payNet)}</span></p>
              </div>
            )}
            <div className="space-y-1.5"><Label>{hi ? 'संदर्भ (वैकल्पिक)' : 'Reference (optional)'}</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTrip(null)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={confirmPay}>{hi ? 'वसूली दर्ज करें' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
