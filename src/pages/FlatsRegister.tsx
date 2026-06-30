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
import { Building2, Pencil, Trash2 } from 'lucide-react';
import type { HousingFlat } from '@/types';

const OWNER_TYPES = [
  { id: 'owner', en: 'Owner', hi: 'मालिक' },
  { id: 'tenant', en: 'Tenant', hi: 'किरायेदार' },
];

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
  const [memberId, setMemberId] = useState('');
  const [ownerType, setOwnerType] = useState<'owner' | 'tenant'>('owner');
  const [area, setArea] = useState('');
  const [maintenance, setMaintenance] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eFlatNo, setEFlatNo] = useState('');
  const [eBlockNo, setEBlockNo] = useState('');
  const [eMemberId, setEMemberId] = useState('');
  const [eOwnerType, setEOwnerType] = useState<'owner' | 'tenant'>('owner');
  const [eArea, setEArea] = useState('');
  const [eMaintenance, setEMaintenance] = useState('');

  const memberLabel = (id?: string) => {
    if (!id) return hi ? '— खाली —' : '— Vacant —';
    const m = members.find(x => x.id === id);
    return m ? `${m.name} (${m.memberId})` : id;
  };

  const resetForm = () => { setFlatNo(''); setBlockNo(''); setMemberId(''); setOwnerType('owner'); setArea(''); setMaintenance(''); };

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
      memberId: memberId || undefined,
      ownerType,
      area: area ? Number(area) : undefined,
      monthlyMaintenance: m,
      registrationDate: new Date().toISOString().split('T')[0],
    });
    if (f.id) { toast({ title: hi ? 'फ्लैट जोड़ा गया' : 'Flat added', description: `${f.flatNo}${f.blockNo ? ` / ${f.blockNo}` : ''}` }); resetForm(); }
  };

  const openEdit = (f: HousingFlat) => {
    setEditId(f.id); setEFlatNo(f.flatNo); setEBlockNo(f.blockNo || ''); setEMemberId(f.memberId || '');
    setEOwnerType(f.ownerType || 'owner'); setEArea(f.area ? String(f.area) : ''); setEMaintenance(String(f.monthlyMaintenance));
    setEditOpen(true);
  };

  const saveEdit = () => {
    const m = Number(eMaintenance);
    if (!eFlatNo.trim()) { toast({ title: hi ? 'फ्लैट नंबर आवश्यक' : 'Flat number required', variant: 'destructive' }); return; }
    if (!(m >= 0)) { toast({ title: hi ? 'राशि दर्ज करें' : 'Enter a valid amount', variant: 'destructive' }); return; }
    updateHousingFlat(editId, {
      flatNo: eFlatNo.trim(), blockNo: eBlockNo.trim() || undefined, memberId: eMemberId || undefined,
      ownerType: eOwnerType, area: eArea ? Number(eArea) : undefined, monthlyMaintenance: m,
    });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const removeFlat = (f: HousingFlat) => {
    if (!window.confirm(hi ? `फ्लैट ${f.flatNo} हटाएँ?` : `Delete flat ${f.flatNo}?`)) return;
    deleteHousingFlat(f.id);
    toast({ title: hi ? 'फ्लैट हटाया गया' : 'Flat deleted' });
  };

  const flats = housingFlats.filter(f => !f.isDeleted);
  const totalMaintenance = flats.reduce((s, f) => s + (f.monthlyMaintenance || 0), 0);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'फ्लैट / यूनिट रजिस्टर' : 'Flats / Units Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति की इकाइयाँ और मासिक रखरखाव दर्ज करें' : 'Record society units and monthly maintenance'}</p>
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
              <Label>{hi ? 'मालिक (सदस्य)' : 'Owner (member)'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें (वैकल्पिक)' : 'Select member (optional)'} /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'प्रकार' : 'Type'}</Label>
              <Select value={ownerType} onValueChange={v => setOwnerType(v as 'owner' | 'tenant')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OWNER_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
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
            <span>{hi ? 'दर्ज फ्लैट' : 'Registered Flats'} ({flats.length})</span>
            {flats.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल मासिक रखरखाव' : 'Total monthly'}: {money(totalMaintenance)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flats.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई फ्लैट नहीं।' : 'No flats yet.'}</p>}
          {flats.map(f => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{f.flatNo}{f.blockNo ? ` · ${f.blockNo}` : ''} <Badge variant="secondary" className="ml-1">{(OWNER_TYPES.find(t => t.id === (f.ownerType || 'owner')) || OWNER_TYPES[0])[hi ? 'hi' : 'en']}</Badge></div>
                <div className="text-muted-foreground">
                  {memberLabel(f.memberId)}{f.area ? ` · ${f.area} sq ft` : ''} · {hi ? 'रखरखाव' : 'Maintenance'} {money(f.monthlyMaintenance)}/{hi ? 'माह' : 'mo'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => removeFlat(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
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
            <div className="space-y-1.5">
              <Label>{hi ? 'मालिक (सदस्य)' : 'Owner (member)'}</Label>
              <Select value={eMemberId} onValueChange={setEMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{hi ? 'प्रकार' : 'Type'}</Label>
                <Select value={eOwnerType} onValueChange={v => setEOwnerType(v as 'owner' | 'tenant')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OWNER_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
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
