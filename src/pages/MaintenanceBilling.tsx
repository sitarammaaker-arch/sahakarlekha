import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Trash2 } from 'lucide-react';

const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export default function MaintenanceBilling() {
  const { housingFlats, maintenanceBills, members, generateMaintenanceBills, deleteMaintenanceBill } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [period, setPeriod] = useState(thisMonth());

  const memberLabel = (id?: string) => {
    if (!id) return hi ? '— खाली —' : '— Vacant —';
    const m = members.find(x => x.id === id);
    return m ? `${m.name} (${m.memberId})` : id;
  };

  const flats = housingFlats.filter(f => !f.isDeleted);
  const eligible = flats.filter(f => (f.monthlyMaintenance || 0) > 0);
  const periodBills = maintenanceBills.filter(b => !b.isDeleted && b.period === period);
  const alreadyBilled = new Set(periodBills.map(b => b.flatId));
  const pending = eligible.filter(f => !alreadyBilled.has(f.id));
  const periodTotal = periodBills.reduce((s, b) => s + (b.amount || 0), 0);

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
              {hi ? 'कोई पात्र फ्लैट नहीं — पहले Flats Register में मासिक रखरखाव राशि सेट करें।' : 'No eligible flats — set monthly maintenance in the Flats Register first.'}
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
          {periodBills.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{b.billNo} <Badge variant={b.status === 'paid' ? 'default' : b.status === 'partial' ? 'secondary' : 'outline'}>{b.status === 'paid' ? (hi ? 'भुगतान' : 'Paid') : b.status === 'partial' ? (hi ? 'आंशिक' : 'Partial') : (hi ? 'बकाया' : 'Unpaid')}</Badge></div>
                <div className="text-muted-foreground">{b.flatNo} · {memberLabel(b.memberId)} · {money(b.amount)}</div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => remove(b.id, b.billNo)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
