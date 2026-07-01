import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, Trash2, Sparkles } from 'lucide-react';

const BASES = [
  { id: 'fixed', en: 'Fixed ₹ / flat', hi: 'निश्चित ₹ / फ्लैट' },
  { id: 'per_sqft', en: '₹ / sq ft', hi: '₹ / वर्ग फुट' },
] as const;

// Standard housing charge heads (housing chart codes) — one-click starter schedule.
const STANDARD = [
  { code: 'SVC', nameEn: 'Service Charges', nameHi: 'सेवा शुल्क', accountId: '4101', basis: 'fixed' as const },
  { code: 'WTR', nameEn: 'Water Charges', nameHi: 'जल शुल्क', accountId: '4102', basis: 'fixed' as const },
  { code: 'PRK', nameEn: 'Parking Charges', nameHi: 'पार्किंग शुल्क', accountId: '4103', basis: 'fixed' as const },
  { code: 'NOC', nameEn: 'Non-Occupancy Charges', nameHi: 'अनिवासी प्रभार', accountId: '4104', basis: 'fixed' as const },
  { code: 'SINK', nameEn: 'Sinking Fund', nameHi: 'मरम्मत संचय निधि', accountId: '1202', basis: 'fixed' as const },
  { code: 'RMF', nameEn: 'Repair & Maintenance Fund', nameHi: 'मरम्मत एवं रखरखाव निधि', accountId: '1204', basis: 'fixed' as const },
];

export default function ChargeHeads() {
  const { accounts } = useData();
  const { chargeHeads, addChargeHead, updateChargeHead, deleteChargeHead } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [accountId, setAccountId] = useState('');
  const [basis, setBasis] = useState<'fixed' | 'per_sqft'>('fixed');
  const [rate, setRate] = useState('');

  // Leaf income / fund (equity) / pass-through (liability) accounts are valid charge targets.
  const targetAccounts = accounts.filter(a => !a.isGroup && ['income', 'equity', 'liability'].includes(a.type));
  const acc = (id: string) => accounts.find(a => a.id === id);
  const isFundAcc = (id: string) => acc(id)?.type === 'equity';
  const kindLabel = (id: string) => {
    const t = acc(id)?.type;
    if (t === 'equity') return hi ? 'निधि' : 'Fund';
    if (t === 'liability') return hi ? 'पास-थ्रू' : 'Pass-through';
    return hi ? 'आय' : 'Income';
  };
  const accLabel = (id: string) => { const a = acc(id); return a ? `${a.id} — ${hi ? a.nameHi : a.name}` : id; };

  const reset = () => { setNameEn(''); setNameHi(''); setAccountId(''); setBasis('fixed'); setRate(''); };

  const save = () => {
    const r = Number(rate);
    if (!nameEn.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    if (!accountId) { toast({ title: hi ? 'खाता चुनें' : 'Pick a target account', variant: 'destructive' }); return; }
    if (!(r >= 0)) { toast({ title: hi ? 'दर दर्ज करें' : 'Enter a valid rate', variant: 'destructive' }); return; }
    const h = addChargeHead({
      nameEn: nameEn.trim(), nameHi: nameHi.trim() || nameEn.trim(),
      accountId, isFund: isFundAcc(accountId), basis, rate: r,
      order: (chargeHeads.filter(x => !x.isDeleted).length) + 1, isActive: true,
    });
    if (h.id) { toast({ title: hi ? 'शुल्क मद जोड़ी' : 'Charge head added', description: h.nameEn }); reset(); }
  };

  const seedStandard = () => {
    const existing = new Set(chargeHeads.filter(h => !h.isDeleted).map(h => h.accountId));
    let n = 0;
    STANDARD.forEach((s, i) => {
      if (existing.has(s.accountId) || !acc(s.accountId)) return;
      addChargeHead({ code: s.code, nameEn: s.nameEn, nameHi: s.nameHi, accountId: s.accountId, isFund: isFundAcc(s.accountId), basis: s.basis, rate: 0, order: chargeHeads.length + i + 1, isActive: true });
      n++;
    });
    toast({ title: hi ? 'मानक मदें जोड़ी गईं' : 'Standard heads added', description: hi ? `${n} मदें · दरें भरें` : `${n} heads · now set the rates` });
  };

  const heads = chargeHeads.filter(h => !h.isDeleted).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ListChecks className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'शुल्क मदें (रखरखाव)' : 'Charge Heads (Maintenance)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति की मासिक बिल मदें — हर मद अपने खाते में पोस्ट होती है' : 'Society-wide maintenance bill heads — each posts to its own account'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center justify-between">
          <span>{hi ? 'नई शुल्क मद' : 'New Charge Head'}</span>
          <Button size="sm" variant="outline" onClick={seedStandard}><Sparkles className="h-4 w-4 mr-1" />{hi ? 'मानक मदें' : 'Standard heads'}</Button>
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={hi ? 'जैसे Service Charges' : 'e.g. Service Charges'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
              <Input value={nameHi} onChange={e => setNameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'खाता (आय / निधि / पास-थ्रू)' : 'Target account (Income / Fund / Pass-through)'} *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                <SelectContent>{targetAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} — {hi ? a.nameHi : a.name} · {kindLabel(a.id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'आधार' : 'Basis'}</Label>
              <Select value={basis} onValueChange={v => setBasis(v as 'fixed' | 'per_sqft')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BASES.map(b => <SelectItem key={b.id} value={b.id}>{hi ? b.hi : b.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{basis === 'per_sqft' ? (hi ? 'दर (₹ / वर्ग फुट)' : 'Rate (₹ / sq ft)') : (hi ? 'राशि (₹ / फ्लैट)' : 'Amount (₹ / flat)')} *</Label>
              <Input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'शुल्क मद सेव करें' : 'Save Charge Head'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'शुल्क अनुसूची' : 'Charge Schedule'} ({heads.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {heads.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई मद नहीं — "मानक मदें" से शुरू करें।' : 'No heads yet — start with "Standard heads".'}</p>}
          {heads.map(h => (
            <div key={h.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{hi ? h.nameHi : h.nameEn}</span>
                  <Badge variant={h.isFund ? 'default' : 'secondary'}>{kindLabel(h.accountId)}</Badge>
                  {h.isActive === false && <Badge variant="outline">{hi ? 'निष्क्रिय' : 'Inactive'}</Badge>}
                </div>
                <div className="text-muted-foreground">{accLabel(h.accountId)} · {h.basis === 'per_sqft' ? (hi ? '₹/वर्ग फुट' : '₹/sq ft') : (hi ? '₹/फ्लैट' : '₹/flat')}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input type="number" min={0} className="w-24 h-8" defaultValue={h.rate}
                  onBlur={e => { const r = Number(e.target.value); if (r >= 0 && r !== h.rate) updateChargeHead(h.id, { rate: r }); }} />
                <Switch checked={h.isActive !== false} onCheckedChange={c => updateChargeHead(h.id, { isActive: c })} />
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(hi ? `"${h.nameEn}" हटाएँ?` : `Delete "${h.nameEn}"?`)) deleteChargeHead(h.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
