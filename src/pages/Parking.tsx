import { useState } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Car, Trash2 } from 'lucide-react';

const VEHICLES = [
  { id: 'car', en: 'Car', hi: 'कार' },
  { id: 'two_wheeler', en: 'Two-wheeler', hi: 'दुपहिया' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
] as const;

export default function Parking() {
  const { parkingSlots, addParking, updateParking, deleteParking, housingFlats } = useHousingData();
  const { members } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [slotNo, setSlotNo] = useState('');
  const [flatId, setFlatId] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'two_wheeler' | 'other'>('car');
  const [vehicleNo, setVehicleNo] = useState('');
  const [charge, setCharge] = useState('');

  const flats = housingFlats.filter(f => !f.isDeleted);
  const flatLabel = (id?: string) => { const f = flats.find(x => x.id === id); return f ? `${f.flatNo}${f.blockNo ? `/${f.blockNo}` : ''}` : (hi ? '— खाली —' : '— Unassigned —'); };
  const vehLabel = (id?: string) => { const v = VEHICLES.find(x => x.id === id); return v ? (hi ? v.hi : v.en) : ''; };

  const save = () => {
    if (!slotNo.trim()) { toast({ title: hi ? 'स्लॉट नंबर आवश्यक' : 'Slot number required', variant: 'destructive' }); return; }
    if (parkingSlots.some(p => !p.isDeleted && p.slotNo.trim().toLowerCase() === slotNo.trim().toLowerCase())) {
      toast({ title: hi ? 'यह स्लॉट पहले से है' : 'Slot already exists', variant: 'destructive' }); return;
    }
    const flat = flats.find(f => f.id === flatId);
    const p = addParking({
      slotNo: slotNo.trim(), flatId: flatId || undefined, flatNo: flat?.flatNo, memberId: flat?.memberId,
      vehicleType, vehicleNo: vehicleNo.trim() || undefined,
      monthlyCharge: charge ? Number(charge) : undefined,
      status: flatId ? 'allotted' : 'vacant',
    });
    if (p.id) { toast({ title: hi ? 'स्लॉट जोड़ा गया' : 'Slot added', description: p.slotNo }); setSlotNo(''); setFlatId(''); setVehicleNo(''); setCharge(''); }
  };

  const slots = parkingSlots.filter(p => !p.isDeleted).sort((a, b) => a.slotNo.localeCompare(b.slotNo, undefined, { numeric: true }));
  const allotted = slots.filter(p => p.status === 'allotted').length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Car className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'पार्किंग रजिस्टर' : 'Parking Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'पार्किंग स्लॉट आवंटन और वाहन विवरण' : 'Parking slot allotment and vehicle details'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया स्लॉट' : 'New Slot'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'स्लॉट नंबर' : 'Slot No'} *</Label>
              <Input value={slotNo} onChange={e => setSlotNo(e.target.value)} placeholder={hi ? 'जैसे P-12' : 'e.g. P-12'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'फ्लैट (आवंटित)' : 'Flat (allotted to)'}</Label>
              <Select value={flatId} onValueChange={setFlatId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फ्लैट चुनें (वैकल्पिक)' : 'Select flat (optional)'} /></SelectTrigger>
                <SelectContent>{flats.map(f => <SelectItem key={f.id} value={f.id}>{f.flatNo}{f.blockNo ? `/${f.blockNo}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'वाहन प्रकार' : 'Vehicle Type'}</Label>
              <Select value={vehicleType} onValueChange={v => setVehicleType(v as 'car' | 'two_wheeler' | 'other')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VEHICLES.map(v => <SelectItem key={v.id} value={v.id}>{hi ? v.hi : v.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'वाहन नंबर' : 'Vehicle No'}</Label>
              <Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मासिक शुल्क (₹)' : 'Monthly Charge (₹)'}</Label>
              <Input type="number" min={0} value={charge} onChange={e => setCharge(e.target.value)} placeholder={hi ? 'सूचनात्मक' : 'informational'} />
            </div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'स्लॉट सेव करें' : 'Save Slot'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'पार्किंग बिलिंग "शुल्क मदें" के माध्यम से होती है; यह केवल आवंटन रजिस्टर है।' : 'Parking is billed via Charge Heads; this is the allotment register.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'स्लॉट' : 'Slots'} ({slots.length} · {allotted} {hi ? 'आवंटित' : 'allotted'})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {slots.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई स्लॉट नहीं।' : 'No slots yet.'}</p>}
          {slots.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{p.slotNo}</span>
                  <Badge variant="outline">{vehLabel(p.vehicleType)}</Badge>
                  <Badge variant={p.status === 'allotted' ? 'default' : 'secondary'}>{p.status === 'allotted' ? (hi ? 'आवंटित' : 'Allotted') : (hi ? 'खाली' : 'Vacant')}</Badge>
                </div>
                <div className="text-muted-foreground">{flatLabel(p.flatId)}{p.vehicleNo ? ` · ${p.vehicleNo}` : ''}{p.monthlyCharge ? ` · ${money(p.monthlyCharge)}/${hi ? 'माह' : 'mo'}` : ''}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => updateParking(p.id, { status: p.status === 'allotted' ? 'vacant' : 'allotted' })}>{p.status === 'allotted' ? (hi ? 'खाली करें' : 'Vacate') : (hi ? 'आवंटित' : 'Allot')}</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(hi ? 'स्लॉट हटाएँ?' : 'Delete slot?')) deleteParking(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
