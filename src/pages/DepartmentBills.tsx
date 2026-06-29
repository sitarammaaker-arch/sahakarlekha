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
import { Receipt, IndianRupee, Trash2 } from 'lucide-react';
import type { DepartmentBill, DeptBillType } from '@/types';

const BILL_TYPES: { id: DeptBillType; en: string; hi: string }[] = [
  { id: 'running', en: 'Running Bill', hi: 'रनिंग बिल' },
  { id: 'final', en: 'Final Bill', hi: 'अंतिम बिल' },
];

export default function DepartmentBills() {
  const { departments, departmentBills, addDepartmentBill, recordDepartmentCollection, deleteDepartmentBill } = useLabourData();
  const { workOrders, accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  const activeDepts = departments.filter(d => !d.isDeleted && d.status !== 'inactive');
  const openOrders = workOrders.filter(w => !w.isDeleted);
  const deptName = (id: string) => departments.find(d => d.id === id)?.name || (hi ? 'अज्ञात विभाग' : 'Unknown dept');
  const woLabel = (id?: string) => { if (!id) return ''; const w = openOrders.find(o => o.id === id); return w ? `${w.workOrderNo} · ${w.clientName}` : ''; };
  const typeLabel = (id: DeptBillType) => { const t = BILL_TYPES.find(x => x.id === id); return t ? (hi ? t.hi : t.en) : id; };

  // Create form
  const [departmentId, setDepartmentId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [billType, setBillType] = useState<DeptBillType>('running');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  // Collect dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payBillId, setPayBillId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payRef, setPayRef] = useState('');

  const bills = departmentBills.filter(b => !b.isDeleted);
  const outstandingOf = (b: DepartmentBill) => +(b.amount - b.paidAmount).toFixed(2);
  const totalBilled = bills.reduce((s, b) => s + b.amount, 0);
  const totalOutstanding = bills.reduce((s, b) => s + outstandingOf(b), 0);

  const save = () => {
    if (!departmentId) { toast({ title: hi ? 'विभाग चुनें' : 'Select a department', variant: 'destructive' }); return; }
    const v = Number(amount);
    if (!(v > 0)) { toast({ title: hi ? 'बिल राशि दर्ज करें' : 'Enter a valid amount', variant: 'destructive' }); return; }
    const bill = addDepartmentBill({ departmentId, workOrderId: workOrderId || undefined, billType, date, amount: v, narration: narration.trim() || undefined });
    if (bill.id) { setAmount(''); setNarration(''); setWorkOrderId(''); }
  };

  const openPay = (b: DepartmentBill) => {
    setPayBillId(b.id); setPayAmount(String(outstandingOf(b))); setPayMode('cash'); setPayBankId(bankAccounts[0]?.id || '');
    setPayDate(new Date().toISOString().slice(0, 10)); setPayRef('');
    setPayOpen(true);
  };

  const confirmPay = () => {
    const amt = Number(payAmount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const v = recordDepartmentCollection({ billId: payBillId, amount: amt, mode: payMode, bankAccountId: payMode === 'bank' ? (payBankId || undefined) : undefined, date: payDate, reference: payRef.trim() || undefined });
    if (v.id) setPayOpen(false);
  };

  const remove = (b: DepartmentBill) => {
    if (!window.confirm(hi ? `बिल ${b.billNo} हटाएँ? (इसके वसूली voucher भी रद्द होंगे)` : `Delete bill ${b.billNo}? (its collection vouchers will be cancelled too)`)) return;
    deleteDepartmentBill(b.id);
    toast({ title: hi ? 'बिल हटाया गया' : 'Bill deleted' });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'विभाग बिल' : 'Department Bills'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'विभाग/नियोक्ता को कार्य के विरुद्ध बिल बनाएँ व वसूली दर्ज करें (आय व प्राप्य)' : 'Raise bills on departments/employers for work done and record collection (income & receivable)'}</p>
        </div>
      </div>

      {activeDepts.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          {hi ? 'पहले "विभाग / नियोक्ता" मास्टर में विभाग जोड़ें — बिल विभाग के विरुद्ध बनता है।' : 'Add a department in the "Department / Employer" master first — a bill is raised against a department.'}
        </CardContent></Card>
      )}

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया बिल' : 'New Bill'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'विभाग / नियोक्ता' : 'Department / Employer'} *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'विभाग चुनें' : 'Select department'} /></SelectTrigger>
                <SelectContent>{activeDepts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'कार्य आदेश (वैकल्पिक)' : 'Work Order (optional)'}</Label>
              <Select value={workOrderId || undefined} onValueChange={setWorkOrderId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{openOrders.map(w => <SelectItem key={w.id} value={w.id}>{w.workOrderNo} · {w.clientName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'बिल प्रकार' : 'Bill Type'}</Label>
              <Select value={billType} onValueChange={v => setBillType(v as DeptBillType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BILL_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तिथि' : 'Date'}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'बिल राशि (₹)' : 'Bill Amount (₹)'} *</Label>
              <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'विवरण (वैकल्पिक)' : 'Narration (optional)'}</Label>
              <Input value={narration} onChange={e => setNarration(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{hi ? 'लेखा प्रविष्टि: नाम विभाग-प्राप्य / जमा श्रम-प्रभार आय (4203)' : 'Entry: Dr Department receivable / Cr Labour Charges income (4203)'}</p>
          <Button onClick={save} className="w-full" disabled={activeDepts.length === 0}>{hi ? 'बिल सेव करें' : 'Save Bill'}</Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'दर्ज बिल' : 'Bills'} ({bills.length})</span>
            {bills.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल' : 'Billed'} {money(totalBilled)} · {hi ? 'बकाया' : 'Outstanding'} {money(totalOutstanding)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bills.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई बिल नहीं।' : 'No bills yet.'}</p>}
          {bills.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {b.billNo} · {deptName(b.departmentId)}
                  <Badge variant="secondary">{typeLabel(b.billType)}</Badge>
                  <Badge variant={b.status === 'paid' ? 'default' : b.status === 'partial' ? 'outline' : 'destructive'}>{b.status === 'paid' ? (hi ? 'वसूल' : 'Paid') : b.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid')}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {woLabel(b.workOrderId) ? `${woLabel(b.workOrderId)} · ` : ''}{b.date} · {money(b.amount)}
                  {b.paidAmount > 0 && b.status !== 'paid' && <span> · {hi ? 'वसूल' : 'collected'} {money(b.paidAmount)} · {hi ? 'बकाया' : 'due'} {money(outstandingOf(b))}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {b.status !== 'paid' && <Button size="sm" onClick={() => openPay(b)}><IndianRupee className="h-4 w-4 mr-1" />{hi ? 'वसूली' : 'Collect'}</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Collect dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'वसूली दर्ज करें' : 'Record Collection'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'भुगतान माध्यम' : 'Mode'}</Label>
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
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>{hi ? 'संदर्भ (वैकल्पिक)' : 'Reference (optional)'}</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">{hi ? 'लेखा प्रविष्टि: नाम ' : 'Entry: Dr '}{payMode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}{hi ? ' / जमा विभाग-प्राप्य' : ' / Cr Department receivable'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={confirmPay}>{hi ? 'वसूली दर्ज करें' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
