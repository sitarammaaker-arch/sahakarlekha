import { useState } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Trash2 } from 'lucide-react';
import EntityExportButton from '@/components/export/EntityExportButton';

const COVERAGE = [
  { id: 'building', en: 'Building', hi: 'भवन' },
  { id: 'fire', en: 'Fire', hi: 'अग्नि' },
  { id: 'asset', en: 'Asset / Equipment', hi: 'संपत्ति / उपकरण' },
  { id: 'liability', en: 'Public Liability', hi: 'सार्वजनिक दायित्व' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];
const today = () => new Date().toISOString().split('T')[0];
const daysTo = (d?: string) => d ? Math.floor((Date.parse(d) - Date.parse(today())) / 86400000) : null;

export default function Insurance() {
  const { insurances, addInsurance, deleteInsurance } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [policyNo, setPolicyNo] = useState('');
  const [insurer, setInsurer] = useState('');
  const [coverageType, setCoverageType] = useState('building');
  const [sumInsured, setSumInsured] = useState('');
  const [premium, setPremium] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const covLabel = (id?: string) => { const c = COVERAGE.find(x => x.id === id); return c ? (hi ? c.hi : c.en) : id; };

  const save = () => {
    if (!policyNo.trim()) { toast({ title: hi ? 'पॉलिसी सं. आवश्यक' : 'Policy no. required', variant: 'destructive' }); return; }
    const p = addInsurance({
      policyNo: policyNo.trim(), insurer: insurer.trim() || undefined, coverageType,
      sumInsured: sumInsured ? Number(sumInsured) : undefined, premium: premium ? Number(premium) : undefined,
      startDate: startDate || undefined, expiryDate: expiryDate || undefined,
    });
    if (p.id) { toast({ title: hi ? 'पॉलिसी जोड़ी गई' : 'Policy added', description: p.policyNo }); setPolicyNo(''); setInsurer(''); setSumInsured(''); setPremium(''); setStartDate(''); setExpiryDate(''); }
  };

  const list = insurances.filter(i => !i.isDeleted).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
  const expiringSoon = list.filter(i => { const d = daysTo(i.expiryDate); return d !== null && d >= 0 && d <= 30; }).length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'बीमा रजिस्टर' : 'Insurance Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'भवन/संपत्ति बीमा पॉलिसियाँ और समाप्ति ट्रैकिंग' : 'Building/asset insurance policies with expiry tracking'}</p>
        </div>
        {/* T-20: this register had no export at all (audit gap EXP-10). The
            Export Registry decides whether it renders, which columns leave, and whether
            the audit row was written before any bytes did. */}
        <div className="ml-auto">
          <EntityExportButton entityKey="housing_insurance" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई पॉलिसी' : 'New Policy'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{hi ? 'पॉलिसी सं.' : 'Policy No.'} *</Label><Input value={policyNo} onChange={e => setPolicyNo(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'बीमाकर्ता' : 'Insurer'}</Label><Input value={insurer} onChange={e => setInsurer(e.target.value)} placeholder={hi ? 'जैसे HDFC Ergo' : 'e.g. HDFC Ergo'} /></div>
            <div className="space-y-2">
              <Label>{hi ? 'कवरेज' : 'Coverage'}</Label>
              <Select value={coverageType} onValueChange={setCoverageType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COVERAGE.map(c => <SelectItem key={c.id} value={c.id}>{hi ? c.hi : c.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'बीमा राशि (₹)' : 'Sum Insured (₹)'}</Label><Input type="number" min={0} value={sumInsured} onChange={e => setSumInsured(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'प्रीमियम (₹)' : 'Premium (₹)'}</Label><Input type="number" min={0} value={premium} onChange={e => setPremium(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'आरंभ तिथि' : 'Start Date'}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'समाप्ति तिथि' : 'Expiry Date'}</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'पॉलिसी सेव करें' : 'Save Policy'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'पॉलिसियाँ' : 'Policies'} ({list.length}){expiringSoon > 0 && <span className="text-sm font-normal text-amber-600 ml-2">· {expiringSoon} {hi ? '30 दिन में समाप्त' : 'expiring ≤30d'}</span>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई पॉलिसी नहीं।' : 'No policies yet.'}</p>}
          {list.map(i => {
            const d = daysTo(i.expiryDate);
            const expired = d !== null && d < 0;
            const soon = d !== null && d >= 0 && d <= 30;
            return (
              <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-1">
                    <span>{i.policyNo}</span>
                    <Badge variant="outline">{covLabel(i.coverageType)}</Badge>
                    {expired && <Badge variant="destructive">{hi ? 'समाप्त' : 'Expired'}</Badge>}
                    {soon && <Badge variant="secondary">{hi ? `${d} दिन` : `${d}d left`}</Badge>}
                  </div>
                  <div className="text-muted-foreground">
                    {i.insurer || '—'}{i.sumInsured ? ` · ${hi ? 'बीमा' : 'SI'} ${money(i.sumInsured)}` : ''}{i.expiryDate ? ` · ${hi ? 'समाप्ति' : 'exp'} ${i.expiryDate}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'पॉलिसी हटाएँ?' : 'Delete policy?')) deleteInsurance(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
