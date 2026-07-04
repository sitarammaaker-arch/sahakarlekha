import { useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { Landmark, Trash2 } from 'lucide-react';

/**
 * Agency Receipt (Marketing M3c) — records MSP reimbursement received from the procurement agency
 * (FCI / NAFED / the society's own State Federation etc. — defined in the Agency master):
 * Dr Bank|Cash / Cr 3308 MSP Receivable. Society-level bulk (one receipt clears part of the total
 * 3308 outstanding). The voucher is the record; outstanding is derived from vouchers.
 */
export default function AgencyReceipts() {
  const { agencyReceipts, agencyReceivableOutstanding, recordAgencyReceipt, deleteAgencyReceipt } = useMarketingData();
  const { accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const accountName = (id?: string) => { const a = accounts.find(x => x.id === id); return a ? (hi ? a.nameHi : a.name) : id || ''; };

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('bank');
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const save = () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const v = recordAgencyReceipt({ amount: amt, mode, bankAccountId: mode === 'bank' ? (bankId || undefined) : undefined, date, note: note.trim() || undefined });
    if (v.id) { setAmount(''); setNote(''); }
  };

  const receiptDr = (v: { lines?: { accountId: string; type: string; amount: number }[]; debitAccountId?: string }) => {
    const dr = v.lines?.find(l => l.type === 'Dr');
    return dr ? accountName(dr.accountId) : accountName(v.debitAccountId);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'एजेंसी रसीद' : 'Agency Receipt'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'एजेंसी से MSP प्रतिपूर्ति दर्ज करें (Dr बैंक / Cr MSP प्राप्य)' : 'Record MSP reimbursement from the agency (Dr Bank / Cr MSP Receivable)'}</p>
        </div>
      </div>

      <Card className="border-primary/30">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">{hi ? 'बकाया MSP प्राप्य (एजेंसी से)' : 'Outstanding MSP Receivable (from agency)'}</span>
          <span className={`text-xl font-bold ${agencyReceivableOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(agencyReceivableOutstanding)}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई रसीद' : 'New Receipt'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'राशि प्राप्त' : 'Amount received'} *</Label>
              <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'माध्यम' : 'Mode'} *</Label>
              <Select value={mode} onValueChange={v => setMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'bank' && (
              <div className="space-y-2">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'संदर्भ / टिप्पणी' : 'Reference / Note'}</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder={hi ? 'वैकल्पिक (बिल सं. / UTR)' : 'optional (bill no. / UTR)'} />
          </div>
          <Button onClick={save} className="w-full">{hi ? 'रसीद दर्ज करें' : 'Record Receipt'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'दर्ज रसीदें' : 'Recorded Receipts'} ({agencyReceipts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {agencyReceipts.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई रसीद नहीं।' : 'No receipts yet.'}</p>}
          {[...agencyReceipts].reverse().map(v => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{money(v.amount)} <span className="text-muted-foreground font-normal">· {v.voucherNo}</span></div>
                <div className="text-xs text-muted-foreground">{v.date} · {receiptDr(v)} {v.narration ? `· ${v.narration}` : ''}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteAgencyReceipt(v.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
