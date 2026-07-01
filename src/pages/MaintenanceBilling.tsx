import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
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
import { computeBillLines, billTotal } from '@/lib/housing/billing';
import type { HousingFlat } from '@/types';
import { Receipt, Trash2, HandCoins } from 'lucide-react';

const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const today = () => new Date().toISOString().split('T')[0];

export default function MaintenanceBilling() {
  const { members, accounts } = useData();
  const { housingFlats, maintenanceBills, chargeHeads, generateMaintenanceBills, deleteMaintenanceBill, recordMaintenanceCollection } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [period, setPeriod] = useState(thisMonth());

  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  // Receive-payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payBillId, setPayBillId] = useState('');
  const [payOutstanding, setPayOutstanding] = useState(0);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');

  const memberLabel = (id?: string) => {
    if (!id) return hi ? '— खाली —' : '— Vacant —';
    const m = members.find(x => x.id === id);
    return m ? `${m.name} (${m.memberId})` : id;
  };

  // A flat is billable via the charge-head schedule (if any), else its single monthlyMaintenance.
  const activeHeads = chargeHeads.filter(h => !h.isDeleted && h.isActive !== false);
  const billableTotal = (f: HousingFlat) => activeHeads.length > 0 ? billTotal(computeBillLines(f, chargeHeads)) : +(f.monthlyMaintenance || 0);
  const flats = housingFlats.filter(f => !f.isDeleted);
  const eligible = flats.filter(f => billableTotal(f) > 0);
  const periodBills = maintenanceBills.filter(b => !b.isDeleted && b.period === period);
  const alreadyBilled = new Set(periodBills.map(b => b.flatId));
  const pending = eligible.filter(f => !alreadyBilled.has(f.id));
  const periodTotal = periodBills.reduce((s, b) => s + (b.amount || 0), 0);

  // All open (unpaid/partial) bills across every month — one place to see total dues.
  const openBills = maintenanceBills
    .filter(b => !b.isDeleted && +(b.amount - (b.paidAmount || 0)).toFixed(2) > 0.005)
    .sort((a, b) => (a.flatNo || '').localeCompare(b.flatNo || '') || (a.period || '').localeCompare(b.period || ''));
  const totalOutstanding = openBills.reduce((s, b) => s + (b.amount - (b.paidAmount || 0)), 0);

  const generate = () => {
    if (!period) { toast({ title: hi ? 'महीना चुनें' : 'Select a month', variant: 'destructive' }); return; }
    if (pending.length === 0) { toast({ title: hi ? 'कोई नया बिल नहीं' : 'No new bills', description: hi ? 'इस महीने के सभी पात्र फ्लैट बिल हो चुके हैं।' : 'All eligible flats already billed for this month.' }); return; }
    generateMaintenanceBills({ period });
  };

  const remove = (id: string, billNo: string) => {
    if (!window.confirm(hi ? `बिल ${billNo} हटाएँ? इसका receivable voucher भी रद्द होगा।` : `Delete bill ${billNo}? Its receivable voucher will be cancelled too.`)) return;
    deleteMaintenanceBill(id);
    toast({ title: hi ? 'बिल हटाया गया' : 'Bill deleted' });
  };

  const openReceive = (billId: string, outstanding: number) => {
    setPayBillId(billId); setPayOutstanding(outstanding);
    setPayAmount(String(outstanding)); setPayDate(today()); setPayMode('cash'); setPayBankId(bankAccounts[0]?.id || ''); setPayRef(''); setPayRemarks('');
    setPayOpen(true);
  };
  const saveReceive = () => {
    const amt = Number(payAmount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    if (amt > payOutstanding) { toast({ title: hi ? 'राशि बकाया से अधिक' : 'Exceeds outstanding', description: `${hi ? 'बकाया' : 'Outstanding'} ${money(payOutstanding)}`, variant: 'destructive' }); return; }
    const v = recordMaintenanceCollection({ billId: payBillId, amount: amt, mode: payMode, bankAccountId: payMode === 'bank' ? (payBankId || undefined) : undefined, date: payDate, reference: payRef.trim() || undefined, remarks: payRemarks.trim() || undefined });
    if (v.id) setPayOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'रखरखाव बिलिंग' : 'Maintenance Billing'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'महीने-वार फ्लैट रखरखाव बिल बनाएँ (प्राप्य दर्ज होगा)' : 'Generate monthly flat maintenance bills (posts receivables)'}</p>
        </div>
      </div>

      {/* Generate */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'बिल बनाएँ' : 'Generate Bills'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>{hi ? 'महीना' : 'Month'} *</Label>
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </div>
            <div className="text-sm text-muted-foreground">
              {hi ? 'पात्र फ्लैट' : 'Eligible flats'}: {eligible.length} · {hi ? 'इस महीने बिल' : 'billed this month'}: {periodBills.length} · {hi ? 'बाकी' : 'pending'}: {pending.length}
            </div>
          </div>
          <Button onClick={generate} className="w-full" disabled={pending.length === 0}>
            {hi ? `${pending.length} फ्लैट के लिए बिल बनाएँ` : `Generate bills for ${pending.length} flat(s)`}
          </Button>
          {eligible.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {hi ? 'कोई पात्र फ्लैट नहीं — Charge Heads में शुल्क अनुसूची बनाएँ, या Flats Register में मासिक रखरखाव राशि सेट करें।' : 'No eligible flats — define a schedule in Charge Heads, or set monthly maintenance in the Flats Register.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bills for the selected period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'इस महीने के बिल' : 'Bills this month'} ({periodBills.length})</span>
            {periodBills.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल' : 'Total'}: {money(periodTotal)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {periodBills.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'इस महीने अभी कोई बिल नहीं।' : 'No bills for this month yet.'}</p>}
          {periodBills.map(b => {
            const outstanding = +(b.amount - (b.paidAmount || 0)).toFixed(2);
            return (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{b.billNo} <Badge variant={b.status === 'paid' ? 'default' : b.status === 'partial' ? 'secondary' : 'outline'}>{b.status === 'paid' ? (hi ? 'भुगतान' : 'Paid') : b.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid')}</Badge></div>
                  <div className="text-muted-foreground">{b.flatNo} · {memberLabel(b.memberId)} · {money(b.amount)}{(b.paidAmount || 0) > 0 ? ` · ${hi ? 'भुगतान' : 'Paid'} ${money(b.paidAmount)} · ${hi ? 'बकाया' : 'Outstanding'} ${money(outstanding)}` : ''}</div>
                  {b.lines && b.lines.length > 1 && (
                    <div className="text-xs text-muted-foreground/80 mt-0.5">{b.lines.map(l => `${l.name} ${money(l.amount)}`).join(' · ')}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {outstanding > 0 && <Button size="sm" variant="outline" onClick={() => openReceive(b.id, outstanding)} className="gap-1"><HandCoins className="h-4 w-4" />{hi ? 'भुगतान लें' : 'Receive'}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(b.id, b.billNo)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Outstanding across all months — total dues in one place */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'बकाया (सभी महीने)' : 'Outstanding (all months)'} ({openBills.length})</span>
            {openBills.length > 0 && <span className="text-sm font-normal text-amber-600">{hi ? 'कुल बकाया' : 'Total due'}: {money(totalOutstanding)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {openBills.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई बकाया नहीं — सब वसूल हो गया।' : 'Nothing outstanding — all collected.'}</p>}
          {openBills.map(b => {
            const outstanding = +(b.amount - (b.paidAmount || 0)).toFixed(2);
            return (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{b.flatNo} · {memberLabel(b.memberId)} <Badge variant={b.status === 'partial' ? 'secondary' : 'outline'}>{b.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid')}</Badge></div>
                  <div className="text-muted-foreground">{b.billNo} · {hi ? 'बिल' : 'Bill'} {money(b.amount)}{(b.paidAmount || 0) > 0 ? ` · ${hi ? 'भुगतान' : 'Paid'} ${money(b.paidAmount)}` : ''} · {hi ? 'बकाया' : 'Outstanding'} {money(outstanding)}</div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => openReceive(b.id, outstanding)}><HandCoins className="h-4 w-4" />{hi ? 'भुगतान लें' : 'Receive'}</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Receive payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'रखरखाव भुगतान लें' : 'Receive Maintenance Payment'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{hi ? 'बकाया' : 'Outstanding'}: {money(payOutstanding)}</div>
            <div className="space-y-1.5">
              <Label>{hi ? 'राशि' : 'Amount'} *</Label>
              <Input type="number" min={0} max={payOutstanding} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'माध्यम' : 'Mode'} *</Label>
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
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={payBankId} onValueChange={setPayBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{hi ? 'संदर्भ' : 'Reference'}</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={hi ? 'वैकल्पिक (रसीद/UTR)' : 'optional (receipt/UTR)'} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'टिप्पणी' : 'Remarks'}</Label>
              <Input value={payRemarks} onChange={e => setPayRemarks(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveReceive}>{hi ? 'भुगतान लें' : 'Receive'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
