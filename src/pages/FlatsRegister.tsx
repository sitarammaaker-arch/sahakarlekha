import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Pencil, Trash2, Search } from 'lucide-react';
import type { HousingFlat } from '@/types';

const UNIT_TYPES = [
  { id: '1bhk', en: '1 BHK', hi: '1 BHK' },
  { id: '2bhk', en: '2 BHK', hi: '2 BHK' },
  { id: '3bhk', en: '3 BHK', hi: '3 BHK' },
  { id: 'shop', en: 'Shop', hi: 'दुकान' },
  { id: 'office', en: 'Office', hi: 'कार्यालय' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];

type Occupancy = 'self' | 'rented' | 'vacant';
const OCCUPANCY: { id: Occupancy; en: string; hi: string }[] = [
  { id: 'self', en: 'Self-occupied', hi: 'स्वयं' },
  { id: 'rented', en: 'Rented', hi: 'किराये पर' },
  { id: 'vacant', en: 'Vacant', hi: 'खाली' },
];
const NONE = '__none__';

// Legacy flats only carry `ownerType` (owner/tenant). Derive a display occupancy:
// tenant → rented; has owner → self; else vacant.
const effectiveOccupancy = (f: HousingFlat): Occupancy =>
  f.occupancy || (f.ownerType === 'tenant' ? 'rented' : f.memberId ? 'self' : 'vacant');

export default function FlatsRegister() {
  const { members } = useData();
  const { housingFlats, addHousingFlat, updateHousingFlat, deleteHousingFlat } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  // Create form
  const [flatNo, setFlatNo] = useState('');
  const [blockNo, setBlockNo] = useState('');
  const [floor, setFloor] = useState('');
  const [unitType, setUnitType] = useState('');
  const [memberId, setMemberId] = useState('');
  const [associateMemberId, setAssociateMemberId] = useState('');
  const [occupancy, setOccupancy] = useState<Occupancy>('self');
  const [area, setArea] = useState('');
  const [maintenance, setMaintenance] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eFlatNo, setEFlatNo] = useState('');
  const [eBlockNo, setEBlockNo] = useState('');
  const [eFloor, setEFloor] = useState('');
  const [eUnitType, setEUnitType] = useState('');
  const [eMemberId, setEMemberId] = useState('');
  const [eAssociateMemberId, setEAssociateMemberId] = useState('');
  const [eOccupancy, setEOccupancy] = useState<Occupancy>('self');
  const [eArea, setEArea] = useState('');
  const [eMaintenance, setEMaintenance] = useState('');

  const [query, setQuery] = useState('');

  const memberLabel = (id?: string) => {
    if (!id) return hi ? '— खाली —' : '— Vacant —';
    const m = members.find(x => x.id === id);
    return m ? `${m.name} (${m.memberId})` : id;
  };
  const memberName = (id?: string) => (id ? members.find(x => x.id === id)?.name || '' : '');
  const unitTypeLabel = (id?: string) => { const t = UNIT_TYPES.find(x => x.id === id); return t ? (hi ? t.hi : t.en) : ''; };
  const occLabel = (o: Occupancy) => { const t = OCCUPANCY.find(x => x.id === o)!; return hi ? t.hi : t.en; };
  // `occupancy` is the source of truth; keep legacy `ownerType` in sync (L9 back-compat).
  const ownerTypeFrom = (o: Occupancy): 'owner' | 'tenant' => (o === 'rented' ? 'tenant' : 'owner');

  const resetForm = () => {
    setFlatNo(''); setBlockNo(''); setFloor(''); setUnitType(''); setMemberId('');
    setAssociateMemberId(''); setOccupancy('self'); setArea(''); setMaintenance('');
  };

  const saveFlat = () => {
    const m = Number(maintenance);
    if (!flatNo.trim()) { toast({ title: hi ? 'फ्लैट नंबर आवश्यक' : 'Flat number required', variant: 'destructive' }); return; }
    if (!(m >= 0)) { toast({ title: hi ? 'मासिक रखरखाव राशि दर्ज करें' : 'Enter a valid maintenance amount', variant: 'destructive' }); return; }
    if (housingFlats.some(f => !f.isDeleted && f.flatNo.trim().toLowerCase() === flatNo.trim().toLowerCase() && (f.blockNo || '') === blockNo.trim())) {
      toast({ title: hi ? 'यह फ्लैट पहले से है' : 'This flat already exists', variant: 'destructive' }); return;
    }
    const f = addHousingFlat({
      flatNo: flatNo.trim(),
      blockNo: blockNo.trim() || undefined,
      floor: floor.trim() || undefined,
      unitType: unitType || undefined,
      memberId: memberId || undefined,
      associateMemberId: associateMemberId || undefined,
      occupancy,
      ownerType: ownerTypeFrom(occupancy),
      area: area ? Number(area) : undefined,
      monthlyMaintenance: m,
      registrationDate: new Date().toISOString().split('T')[0],
    });
    if (f.id) { toast({ title: hi ? 'फ्लैट जोड़ा गया' : 'Flat added', description: `${f.flatNo}${f.blockNo ? ` / ${f.blockNo}` : ''}` }); resetForm(); }
  };

  const openEdit = (f: HousingFlat) => {
    setEditId(f.id); setEFlatNo(f.flatNo); setEBlockNo(f.blockNo || ''); setEFloor(f.floor || '');
    setEUnitType(f.unitType || ''); setEMemberId(f.memberId || ''); setEAssociateMemberId(f.associateMemberId || '');
    setEOccupancy(effectiveOccupancy(f)); setEArea(f.area ? String(f.area) : ''); setEMaintenance(String(f.monthlyMaintenance));
    setEditOpen(true);
  };

  const saveEdit = () => {
    const m = Number(eMaintenance);
    if (!eFlatNo.trim()) { toast({ title: hi ? 'फ्लैट नंबर आवश्यक' : 'Flat number required', variant: 'destructive' }); return; }
    if (!(m >= 0)) { toast({ title: hi ? 'राशि दर्ज करें' : 'Enter a valid amount', variant: 'destructive' }); return; }
    updateHousingFlat(editId, {
      flatNo: eFlatNo.trim(), blockNo: eBlockNo.trim() || undefined, floor: eFloor.trim() || undefined,
      unitType: eUnitType || undefined, memberId: eMemberId || undefined, associateMemberId: eAssociateMemberId || undefined,
      occupancy: eOccupancy, ownerType: ownerTypeFrom(eOccupancy),
      area: eArea ? Number(eArea) : undefined, monthlyMaintenance: m,
    });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const removeFlat = (f: HousingFlat) => {
    if (!window.confirm(hi ? `फ्लैट ${f.flatNo} हटाएँ?` : `Delete flat ${f.flatNo}?`)) return;
    deleteHousingFlat(f.id);
    toast({ title: hi ? 'फ्लैट हटाया गया' : 'Flat deleted' });
  };

  const allFlats = housingFlats.filter(f => !f.isDeleted);
  const q = query.trim().toLowerCase();
  const flats = q
    ? allFlats.filter(f => [f.flatNo, f.blockNo, f.floor, unitTypeLabel(f.unitType), memberName(f.memberId), memberName(f.associateMemberId)]
        .some(v => (v || '').toLowerCase().includes(q)))
    : allFlats;
  const totalMaintenance = allFlats.reduce((s, f) => s + (f.monthlyMaintenance || 0), 0);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'फ्लैट / यूनिट रजिस्टर' : 'Flats / Units Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति की इकाइयाँ, सदस्य आवंटन और मासिक रखरखाव दर्ज करें' : 'Record society units, member allocation and monthly maintenance'}</p>
        </div>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया फ्लैट / यूनिट' : 'New Flat / Unit'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फ्लैट / यूनिट नंबर' : 'Flat / Unit No'} *</Label>
              <Input value={flatNo} onChange={e => setFlatNo(e.target.value)} placeholder={hi ? 'जैसे A-101' : 'e.g. A-101'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'ब्लॉक / विंग' : 'Block / Wing'}</Label>
              <Input value={blockNo} onChange={e => setBlockNo(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मंज़िल' : 'Floor'}</Label>
              <Input value={floor} onChange={e => setFloor(e.target.value)} placeholder={hi ? 'जैसे 3 / ग्राउंड' : 'e.g. 3 / Ground'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'यूनिट प्रकार' : 'Unit Type'}</Label>
              <Select value={unitType} onValueChange={setUnitType}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें (वैकल्पिक)' : 'Select (optional)'} /></SelectTrigger>
                <SelectContent>{UNIT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मालिक (सदस्य)' : 'Owner (member)'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें (वैकल्पिक)' : 'Select member (optional)'} /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'सह-सदस्य' : 'Associate member'}</Label>
              <Select value={associateMemberId || NONE} onValueChange={v => setAssociateMemberId(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें (वैकल्पिक)' : 'Select (optional)'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{hi ? '— कोई नहीं —' : '— None —'}</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'अधिवास स्थिति' : 'Occupancy'}</Label>
              <Select value={occupancy} onValueChange={v => setOccupancy(v as Occupancy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OCCUPANCY.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'क्षेत्रफल (sq ft)' : 'Area (sq ft)'}</Label>
              <Input type="number" min={0} value={area} onChange={e => setArea(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'मासिक रखरखाव (₹)' : 'Monthly Maintenance (₹)'} *</Label>
              <Input type="number" min={0} value={maintenance} onChange={e => setMaintenance(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={saveFlat} className="w-full">{hi ? 'फ्लैट सेव करें' : 'Save Flat'}</Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'दर्ज फ्लैट' : 'Registered Flats'} ({allFlats.length})</span>
            {allFlats.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल मासिक रखरखाव' : 'Total monthly'}: {money(totalMaintenance)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allFlats.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={query} onChange={e => setQuery(e.target.value)} placeholder={hi ? 'फ्लैट / ब्लॉक / मालिक खोजें…' : 'Search flat / block / owner…'} />
            </div>
          )}
          {allFlats.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई फ्लैट नहीं।' : 'No flats yet.'}</p>}
          {allFlats.length > 0 && flats.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'खोज से मेल खाता कोई फ्लैट नहीं।' : 'No flats match your search.'}</p>}
          {flats.map(f => {
            const occ = effectiveOccupancy(f);
            return (
              <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-1">
                    <span>{f.flatNo}{f.blockNo ? ` · ${f.blockNo}` : ''}{f.floor ? ` · ${hi ? 'मंज़िल' : 'Fl'} ${f.floor}` : ''}</span>
                    {f.unitType && <Badge variant="outline">{unitTypeLabel(f.unitType)}</Badge>}
                    <Badge variant="secondary">{occLabel(occ)}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {memberLabel(f.memberId)}{f.associateMemberId ? ` + ${memberName(f.associateMemberId)}` : ''}
                    {f.area ? ` · ${f.area} sq ft` : ''} · {hi ? 'रखरखाव' : 'Maintenance'} {money(f.monthlyMaintenance)}/{hi ? 'माह' : 'mo'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeFlat(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'फ्लैट संपादित करें' : 'Edit Flat'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'फ्लैट नंबर' : 'Flat No'} *</Label><Input value={eFlatNo} onChange={e => setEFlatNo(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'ब्लॉक' : 'Block'}</Label><Input value={eBlockNo} onChange={e => setEBlockNo(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'मंज़िल' : 'Floor'}</Label><Input value={eFloor} onChange={e => setEFloor(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>{hi ? 'यूनिट प्रकार' : 'Unit Type'}</Label>
                <Select value={eUnitType} onValueChange={setEUnitType}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                  <SelectContent>{UNIT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'मालिक (सदस्य)' : 'Owner (member)'}</Label>
              <Select value={eMemberId} onValueChange={setEMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'सह-सदस्य' : 'Associate member'}</Label>
              <Select value={eAssociateMemberId || NONE} onValueChange={v => setEAssociateMemberId(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{hi ? '— कोई नहीं —' : '— None —'}</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{hi ? 'अधिवास स्थिति' : 'Occupancy'}</Label>
                <Select value={eOccupancy} onValueChange={v => setEOccupancy(v as Occupancy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OCCUPANCY.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{hi ? 'क्षेत्रफल' : 'Area'}</Label><Input type="number" min={0} value={eArea} onChange={e => setEArea(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>{hi ? 'मासिक रखरखाव (₹)' : 'Monthly Maintenance (₹)'} *</Label><Input type="number" min={0} value={eMaintenance} onChange={e => setEMaintenance(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveEdit}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
