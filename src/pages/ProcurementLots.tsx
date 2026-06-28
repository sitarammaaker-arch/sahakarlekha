import { useState } from 'react';
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
import { Wheat, Plus } from 'lucide-react';

// Phase 1.0 — a small fixed crop list (no Crop master CRUD in scope).
const CROPS = [
  { id: 'wheat', name: 'Wheat', nameHi: 'गेहूँ' },
  { id: 'paddy', name: 'Paddy', nameHi: 'धान' },
  { id: 'mustard', name: 'Mustard', nameHi: 'सरसों' },
  { id: 'gram', name: 'Gram', nameHi: 'चना' },
  { id: 'bajra', name: 'Bajra', nameHi: 'बाजरा' },
];

export default function ProcurementLots() {
  const { procurementFarmers, procurementLots, addFarmer, addProcurementLot } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  // Create-lot form
  const [farmerId, setFarmerId] = useState('');
  const [cropId, setCropId] = useState('');
  const [variety, setVariety] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');

  // Add-farmer dialog
  const [farmerOpen, setFarmerOpen] = useState(false);
  const [farmerName, setFarmerName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');

  const cropName = (id: string) => { const c = CROPS.find(x => x.id === id); return c ? (hi ? c.nameHi : c.name) : id; };
  const farmerLabel = (id: string) => { const f = procurementFarmers.find(x => x.id === id); return f ? `${f.farmerName} (${f.farmerCode})` : id; };

  const saveFarmer = () => {
    if (!farmerName.trim()) { toast({ title: hi ? 'किसान का नाम आवश्यक है' : 'Farmer name is required', variant: 'destructive' }); return; }
    const f = addFarmer({ farmerName: farmerName.trim(), fatherName: fatherName.trim() || undefined, mobile: mobile.trim() || undefined });
    if (f.id) { setFarmerId(f.id); toast({ title: hi ? 'किसान जोड़ा गया' : 'Farmer added', description: `${f.farmerName} (${f.farmerCode})` }); }
    setFarmerName(''); setFatherName(''); setMobile(''); setFarmerOpen(false);
  };

  const saveLot = () => {
    const q = Number(qty), r = Number(rate);
    if (!farmerId) { toast({ title: hi ? 'किसान चुनें' : 'Select a farmer', variant: 'destructive' }); return; }
    if (!cropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!(q > 0)) { toast({ title: hi ? 'मात्रा दर्ज करें' : 'Enter a valid quantity', variant: 'destructive' }); return; }
    if (!(r > 0)) { toast({ title: hi ? 'MSP दर दर्ज करें' : 'Enter a valid MSP rate', variant: 'destructive' }); return; }
    const lot = addProcurementLot({ farmerId, cropId, varietyId: variety.trim() || undefined, quantity: { value: q, unit: 'qtl' }, mspRate: { amount: r, currency: 'INR' } });
    if (lot.id) {
      toast({ title: hi ? 'प्रोक्योरमेंट लॉट बना' : 'Procurement Lot created', description: `${farmerLabel(farmerId)} · ${cropName(cropId)} · ${q} qtl` });
      setCropId(''); setVariety(''); setQty(''); setRate('');
    }
  };

  const lots = [...procurementLots].reverse();

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wheat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रोक्योरमेंट लॉट' : 'Procurement Lots'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'किसान चुनें और नया लॉट बनाएँ' : 'Select a farmer and create a new lot'}</p>
        </div>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया लॉट' : 'New Lot'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{hi ? 'किसान' : 'Farmer'}</Label>
            <div className="flex gap-2">
              <Select value={farmerId} onValueChange={setFarmerId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={hi ? 'किसान चुनें' : 'Select farmer'} /></SelectTrigger>
                <SelectContent>
                  {procurementFarmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmerName} ({f.farmerCode})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setFarmerOpen(true)} className="gap-1"><Plus className="h-4 w-4" />{hi ? 'किसान जोड़ें' : 'Add Farmer'}</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फसल' : 'Crop'}</Label>
              <Select value={cropId} onValueChange={setCropId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>
                  {CROPS.map(c => <SelectItem key={c.id} value={c.id}>{hi ? c.nameHi : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'किस्म' : 'Variety'}</Label>
              <Input value={variety} onChange={e => setVariety(e.target.value)} placeholder={hi ? 'किस्म (वैकल्पिक)' : 'Variety (optional)'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मात्रा (क्विंटल)' : 'Quantity (qtl)'}</Label>
              <Input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'MSP दर (₹/क्विंटल)' : 'MSP Rate (₹/qtl)'}</Label>
              <Input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} placeholder="0" />
            </div>
          </div>

          <Button onClick={saveLot} className="w-full">{hi ? 'लॉट सेव करें' : 'Save Lot'}</Button>
        </CardContent>
      </Card>

      {/* Lot list */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'बने हुए लॉट' : 'Created Lots'} ({lots.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {lots.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई लॉट नहीं।' : 'No lots yet.'}</p>}
          {lots.map(l => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <div className="font-medium">{farmerLabel(l.farmerId)} · {cropName(l.cropId)}{l.varietyId ? ` (${l.varietyId})` : ''}</div>
                <div className="text-muted-foreground">
                  {l.quantity?.value ?? 0} {l.quantity?.unit ?? 'qtl'} · ₹{l.mspRate?.amount ?? 0}/{hi ? 'क्विंटल' : 'qtl'}
                </div>
              </div>
              <Badge variant="secondary">{l.operationalStatus}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add-farmer dialog */}
      <Dialog open={farmerOpen} onOpenChange={setFarmerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'नया किसान' : 'Add Farmer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'किसान का नाम' : 'Farmer Name'} *</Label>
              <Input value={farmerName} onChange={e => setFarmerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'पिता का नाम' : 'Father Name'}</Label>
              <Input value={fatherName} onChange={e => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'मोबाइल' : 'Mobile'}</Label>
              <Input value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFarmerOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveFarmer}>{hi ? 'जोड़ें' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
