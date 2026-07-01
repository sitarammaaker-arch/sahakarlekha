import { useState } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { ArrowLeftRight, Trash2 } from 'lucide-react';

export default function TransferRegister() {
  const { transfers, recordFlatTransfer, deleteFlatTransfer, housingFlats } = useHousingData();
  const { members, accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const today = () => new Date().toISOString().split('T')[0];

  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  const [flatId, setFlatId] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [date, setDate] = useState(today());
  const [fee, setFee] = useState('');
  const [premium, setPremium] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('bank');
  const [bankId, setBankId] = useState('');

  const flats = housingFlats.filter(f => !f.isDeleted);
  const flat = flats.find(f => f.id === flatId);
  const memberLabel = (id?: string) => { const m = members.find(x => x.id === id); return m ? `${m.name} (${m.memberId})` : (hi ? '—' : '—'); };
  const flatLabel = (id?: string) => { const f = housingFlats.find(x => x.id === id); return f ? `${f.flatNo}${f.blockNo ? `/${f.blockNo}` : ''}` : id; };

  const doTransfer = () => {
    if (!flat) { toast({ title: hi ? 'फ्लैट चुनें' : 'Select a flat', variant: 'destructive' }); return; }
    if (!toMemberId) { toast({ title: hi ? 'नया मालिक चुनें' : 'Select the new owner', variant: 'destructive' }); return; }
    if (toMemberId === flat.memberId) { toast({ title: hi ? 'नया मालिक अलग होना चाहिए' : 'New owner must differ', variant: 'destructive' }); return; }
    const t = recordFlatTransfer({
      flatId: flat.id, toMemberId, date,
      transferFee: fee ? Number(fee) : undefined, premium: premium ? Number(premium) : undefined,
      mode, bankAccountId: mode === 'bank' ? (bankId || undefined) : undefined,
    });
    if (t.id) { setFlatId(''); setToMemberId(''); setFee(''); setPremium(''); }
  };

  const list = transfers.filter(t => !t.isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'हस्तांतरण रजिस्टर' : 'Transfer Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'फ्लैट स्वामित्व हस्तांतरण — शुल्क व प्रीमियम सहित' : 'Flat ownership transfers — with fee and premium'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया हस्तांतरण' : 'New Transfer'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फ्लैट' : 'Flat'} *</Label>
              <Select value={flatId} onValueChange={setFlatId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फ्लैट चुनें' : 'Select flat'} /></SelectTrigger>
                <SelectContent>{flats.map(f => <SelectItem key={f.id} value={f.id}>{f.flatNo}{f.blockNo ? `/${f.blockNo}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'वर्तमान मालिक' : 'Current owner'}</Label>
              <Input value={flat ? memberLabel(flat.memberId) : ''} disabled placeholder="—" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'नया मालिक (सदस्य)' : 'New owner (member)'} *</Label>
              <Select value={toMemberId} onValueChange={setToMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'हस्तांतरण शुल्क (₹)' : 'Transfer Fee (₹)'}</Label>
              <Input type="number" min={0} value={fee} onChange={e => setFee(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'प्रीमियम (₹)' : 'Premium (₹)'}</Label>
              <Input type="number" min={0} value={premium} onChange={e => setPremium(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'माध्यम' : 'Received in'}</Label>
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
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={doTransfer} className="w-full">{hi ? 'हस्तांतरण करें' : 'Transfer Flat'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'शुल्क → 4201 (आय), प्रीमियम → 1202 (मरम्मत संचय निधि). नया मालिक निर्धारित होगा; अगला बिल नए मालिक के खाते में जाएगा।' : 'Fee → 4201 (income), premium → 1202 (sinking fund). Owner is reassigned; the next bill posts to the new owner.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'हस्तांतरण' : 'Transfers'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई हस्तांतरण नहीं।' : 'No transfers yet.'}</p>}
          {list.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{flatLabel(t.flatId)} · {t.date}</div>
                <div className="text-muted-foreground">{memberLabel(t.fromMemberId)} → {memberLabel(t.toMemberId)}{(t.transferFee || t.premium) ? ` · ${hi ? 'शुल्क' : 'fee'} ${money((t.transferFee || 0) + (t.premium || 0))}` : ''}</div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'हस्तांतरण हटाएँ? (शुल्क voucher रद्द होगा; स्वामित्व स्वतः वापस नहीं होगा)' : 'Delete transfer? (fee voucher is cancelled; ownership is not auto-reverted)')) deleteFlatTransfer(t.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
