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
import { Wrench, Trash2 } from 'lucide-react';

const EQUIPMENT = [
  { id: 'lift', en: 'Lift / Elevator', hi: 'लिफ्ट' },
  { id: 'pump', en: 'Pump / Motor', hi: 'पंप / मोटर' },
  { id: 'generator', en: 'Generator', hi: 'जनरेटर' },
  { id: 'cctv', en: 'CCTV / Security', hi: 'CCTV / सुरक्षा' },
  { id: 'fire', en: 'Fire Safety', hi: 'अग्निशमन' },
  { id: 'housekeeping', en: 'Housekeeping', hi: 'स्वच्छता' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];
const today = () => new Date().toISOString().split('T')[0];
const daysTo = (d?: string) => d ? Math.floor((Date.parse(d) - Date.parse(today())) / 86400000) : null;

export default function Amc() {
  const { amcs, addAmc, deleteAmc } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [contractNo, setContractNo] = useState('');
  const [vendor, setVendor] = useState('');
  const [equipment, setEquipment] = useState('lift');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const eqLabel = (id?: string) => { const e = EQUIPMENT.find(x => x.id === id); return e ? (hi ? e.hi : e.en) : id; };

  const save = () => {
    if (!contractNo.trim()) { toast({ title: hi ? 'अनुबंध सं. आवश्यक' : 'Contract no. required', variant: 'destructive' }); return; }
    const p = addAmc({
      contractNo: contractNo.trim(), vendor: vendor.trim() || undefined, equipment,
      amount: amount ? Number(amount) : undefined,
      startDate: startDate || undefined, expiryDate: expiryDate || undefined,
    });
    if (p.id) { toast({ title: hi ? 'अनुबंध जोड़ा गया' : 'Contract added', description: p.contractNo }); setContractNo(''); setVendor(''); setAmount(''); setStartDate(''); setExpiryDate(''); }
  };

  const list = amcs.filter(a => !a.isDeleted).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
  const expiringSoon = list.filter(a => { const d = daysTo(a.expiryDate); return d !== null && d >= 0 && d <= 30; }).length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wrench className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'AMC / अनुबंध रजिस्टर' : 'AMC / Contract Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'लिफ्ट/पंप/सुरक्षा आदि के वार्षिक अनुबंध और नवीनीकरण ट्रैकिंग' : 'Annual maintenance contracts (lift/pump/security) with renewal tracking'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया अनुबंध' : 'New Contract'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{hi ? 'अनुबंध सं.' : 'Contract No.'} *</Label><Input value={contractNo} onChange={e => setContractNo(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'वेंडर' : 'Vendor'}</Label><Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder={hi ? 'सेवा प्रदाता' : 'service provider'} /></div>
            <div className="space-y-2">
              <Label>{hi ? 'उपकरण' : 'Equipment'}</Label>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIPMENT.map(e => <SelectItem key={e.id} value={e.id}>{hi ? e.hi : e.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'राशि (₹/वर्ष)' : 'Amount (₹/yr)'}</Label><Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'आरंभ तिथि' : 'Start Date'}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'समाप्ति तिथि' : 'Expiry Date'}</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'अनुबंध सेव करें' : 'Save Contract'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'अनुबंध' : 'Contracts'} ({list.length}){expiringSoon > 0 && <span className="text-sm font-normal text-amber-600 ml-2">· {expiringSoon} {hi ? '30 दिन में समाप्त' : 'expiring ≤30d'}</span>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई अनुबंध नहीं।' : 'No contracts yet.'}</p>}
          {list.map(a => {
            const d = daysTo(a.expiryDate);
            const expired = d !== null && d < 0;
            const soon = d !== null && d >= 0 && d <= 30;
            return (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-1">
                    <span>{a.contractNo}</span>
                    <Badge variant="outline">{eqLabel(a.equipment)}</Badge>
                    {expired && <Badge variant="destructive">{hi ? 'समाप्त' : 'Expired'}</Badge>}
                    {soon && <Badge variant="secondary">{hi ? `${d} दिन` : `${d}d left`}</Badge>}
                  </div>
                  <div className="text-muted-foreground">
                    {a.vendor || '—'}{a.amount ? ` · ${money(a.amount)}/${hi ? 'वर्ष' : 'yr'}` : ''}{a.expiryDate ? ` · ${hi ? 'समाप्ति' : 'exp'} ${a.expiryDate}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'अनुबंध हटाएँ?' : 'Delete contract?')) deleteAmc(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
