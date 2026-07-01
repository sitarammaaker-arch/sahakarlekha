import { useState, useMemo } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building, Trash2 } from 'lucide-react';

export default function Buildings() {
  const { buildings, addBuilding, deleteBuilding, housingFlats, maintenanceBills } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const [name, setName] = useState('');
  const [floors, setFloors] = useState('');
  const [totalUnits, setTotalUnits] = useState('');
  const [address, setAddress] = useState('');

  const flats = housingFlats.filter(f => !f.isDeleted);
  // Per-building rollup: flats, monthly maintenance, outstanding.
  const summary = useMemo(() => {
    const outstandingByFlat = new Map<string, number>();
    for (const b of maintenanceBills) {
      if (b.isDeleted) continue;
      const out = (b.amount || 0) - (b.paidAmount || 0);
      if (out > 0.005) outstandingByFlat.set(b.flatId, (outstandingByFlat.get(b.flatId) || 0) + out);
    }
    const m = new Map<string, { flats: number; monthly: number; outstanding: number }>();
    for (const f of flats) {
      const key = f.buildingId || '';
      const cur = m.get(key) || { flats: 0, monthly: 0, outstanding: 0 };
      cur.flats += 1;
      cur.monthly += f.monthlyMaintenance || 0;
      cur.outstanding += outstandingByFlat.get(f.id) || 0;
      m.set(key, cur);
    }
    return m;
  }, [flats, maintenanceBills]);

  const save = () => {
    if (!name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    if (buildings.some(b => !b.isDeleted && b.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      toast({ title: hi ? 'यह भवन पहले से है' : 'Building already exists', variant: 'destructive' }); return;
    }
    const b = addBuilding({ name: name.trim(), floors: floors ? Number(floors) : undefined, totalUnits: totalUnits ? Number(totalUnits) : undefined, address: address.trim() || undefined });
    if (b.id) { toast({ title: hi ? 'भवन जोड़ा गया' : 'Building added', description: b.name }); setName(''); setFloors(''); setTotalUnits(''); setAddress(''); }
  };

  const list = buildings.filter(b => !b.isDeleted).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const unassigned = summary.get('');

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'भवन / विंग मास्टर' : 'Building / Wing Master'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'बहु-टावर समिति के भवन/विंग और उनका सारांश' : 'Buildings/wings for multi-tower societies with per-building summary'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया भवन / विंग' : 'New Building / Wing'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{hi ? 'नाम' : 'Name'} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={hi ? 'जैसे Tower A' : 'e.g. Tower A'} /></div>
            <div className="space-y-2"><Label>{hi ? 'पता' : 'Address'}</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            <div className="space-y-2"><Label>{hi ? 'मंज़िलें' : 'Floors'}</Label><Input type="number" min={0} value={floors} onChange={e => setFloors(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'कुल यूनिट' : 'Total Units'}</Label><Input type="number" min={0} value={totalUnits} onChange={e => setTotalUnits(e.target.value)} /></div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'भवन सेव करें' : 'Save Building'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'फ्लैट को भवन से जोड़ने के लिए Flats Register में भवन चुनें।' : 'Link flats to a building via the building field in the Flats Register.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'भवन' : 'Buildings'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई भवन नहीं।' : 'No buildings yet.'}</p>}
          {list.map(b => {
            const s = summary.get(b.id) || { flats: 0, monthly: 0, outstanding: 0 };
            return (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-1">
                    <span>{b.name}</span>
                    <Badge variant="outline">{s.flats} {hi ? 'फ्लैट' : 'flats'}</Badge>
                    {s.outstanding > 0.005 && <Badge variant="secondary" className="text-amber-700">{hi ? 'बकाया' : 'Due'} {money(s.outstanding)}</Badge>}
                  </div>
                  <div className="text-muted-foreground">
                    {b.floors ? `${b.floors} ${hi ? 'मंज़िल' : 'floors'} · ` : ''}{b.totalUnits ? `${b.totalUnits} ${hi ? 'यूनिट' : 'units'} · ` : ''}{hi ? 'मासिक' : 'monthly'} {money(s.monthly)}{b.address ? ` · ${b.address}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? `भवन "${b.name}" हटाएँ? (फ्लैट नहीं हटेंगे)` : `Delete building "${b.name}"? (flats are not deleted)`)) deleteBuilding(b.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            );
          })}
          {unassigned && unassigned.flats > 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {hi ? 'बिना भवन के फ्लैट' : 'Flats without a building'}: {unassigned.flats}{unassigned.outstanding > 0.005 ? ` · ${hi ? 'बकाया' : 'Due'} ${money(unassigned.outstanding)}` : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
