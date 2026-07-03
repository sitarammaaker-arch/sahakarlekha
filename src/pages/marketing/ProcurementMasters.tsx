import { useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Wheat, Plus, Sprout, Pencil, Trash2 } from 'lucide-react';

/**
 * Procurement Masters (Marketing M1a) — Crop & Variety master data.
 * Config only (no accounting). Consumed by the Procurement Lots screen for the crop/variety
 * pickers (replacing the old hardcoded crop list + free-text variety).
 */
export default function ProcurementMasters() {
  const { crops, varieties, addCrop, updateCrop, deleteCrop, seedStandardCrops, addVariety, updateVariety, deleteVariety } = useMarketingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const cropLabel = (c: { name: string; nameHi?: string }) => (hi && c.nameHi ? c.nameHi : c.name);

  // Crop dialog (add / edit)
  const [cropOpen, setCropOpen] = useState(false);
  const [editCropId, setEditCropId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cNameHi, setCNameHi] = useState('');
  const [cCode, setCCode] = useState('');

  const openAddCrop = () => { setEditCropId(null); setCName(''); setCNameHi(''); setCCode(''); setCropOpen(true); };
  const openEditCrop = (id: string) => {
    const c = crops.find(x => x.id === id);
    if (!c) return;
    setEditCropId(id); setCName(c.name); setCNameHi(c.nameHi || ''); setCCode(c.code); setCropOpen(true);
  };
  const saveCrop = () => {
    if (!cName.trim()) { toast({ title: hi ? 'फसल का नाम आवश्यक' : 'Crop name required', variant: 'destructive' }); return; }
    if (!cCode.trim()) { toast({ title: hi ? 'कोड आवश्यक' : 'Code required', variant: 'destructive' }); return; }
    if (editCropId) updateCrop(editCropId, { name: cName.trim(), code: cCode.trim().toUpperCase(), nameHi: cNameHi.trim() || undefined });
    else addCrop({ name: cName.trim(), code: cCode.trim().toUpperCase(), nameHi: cNameHi.trim() || undefined });
    setCropOpen(false);
  };

  // Variety dialog (add / edit)
  const [varOpen, setVarOpen] = useState(false);
  const [editVarId, setEditVarId] = useState<string | null>(null);
  const [vCropId, setVCropId] = useState('');
  const [vName, setVName] = useState('');
  const [vNameHi, setVNameHi] = useState('');

  const openAddVariety = (cropId?: string) => { setEditVarId(null); setVCropId(cropId || ''); setVName(''); setVNameHi(''); setVarOpen(true); };
  const openEditVariety = (id: string) => {
    const v = varieties.find(x => x.id === id);
    if (!v) return;
    setEditVarId(id); setVCropId(v.cropId); setVName(v.name); setVNameHi(v.nameHi || ''); setVarOpen(true);
  };
  const saveVariety = () => {
    if (!vCropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!vName.trim()) { toast({ title: hi ? 'किस्म का नाम आवश्यक' : 'Variety name required', variant: 'destructive' }); return; }
    if (editVarId) updateVariety(editVarId, { name: vName.trim(), nameHi: vNameHi.trim() || undefined });
    else addVariety({ cropId: vCropId, name: vName.trim(), nameHi: vNameHi.trim() || undefined });
    setVarOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wheat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रोक्योरमेंट मास्टर' : 'Procurement Masters'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'फसल व किस्म — एक बार सेट करें, लॉट बनाते समय चुनें' : 'Crops & varieties — set once, pick when creating lots'}</p>
        </div>
      </div>

      {/* Crops */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{hi ? 'फसलें' : 'Crops'} ({crops.length})</CardTitle>
          <div className="flex gap-2">
            {crops.length === 0 && (
              <Button size="sm" variant="secondary" className="gap-1" onClick={seedStandardCrops}>
                <Sprout className="h-4 w-4" />{hi ? 'मानक फसलें जोड़ें' : 'Seed standard crops'}
              </Button>
            )}
            <Button size="sm" className="gap-1" onClick={openAddCrop}><Plus className="h-4 w-4" />{hi ? 'फसल' : 'Crop'}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {crops.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई फसल नहीं। "मानक फसलें जोड़ें" से शुरू करें।' : 'No crops yet. Start with "Seed standard crops".'}</p>}
          {crops.map(c => {
            const vs = varieties.filter(v => v.cropId === c.id);
            return (
              <div key={c.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{cropLabel(c)} <Badge variant="outline" className="ml-1 font-mono">{c.code}</Badge></div>
                    {c.nameHi && !hi && <div className="text-xs text-muted-foreground">{c.nameHi}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditCrop(c.id)} aria-label="edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteCrop(c.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  {vs.length === 0 && <span className="text-xs text-muted-foreground">{hi ? 'कोई किस्म नहीं' : 'No varieties'}</span>}
                  {vs.map(v => (
                    <Badge key={v.id} variant="secondary" className="gap-1 font-normal">
                      <button className="hover:underline" onClick={() => openEditVariety(v.id)}>{hi && v.nameHi ? v.nameHi : v.name}</button>
                      <button className="text-destructive/70 hover:text-destructive" onClick={() => deleteVariety(v.id)} aria-label="remove variety">×</button>
                    </Badge>
                  ))}
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => openAddVariety(c.id)}><Plus className="h-3 w-3" />{hi ? 'किस्म' : 'Variety'}</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCropId ? (hi ? 'फसल संपादित करें' : 'Edit Crop') : (hi ? 'नई फसल' : 'Add Crop')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label>
              <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="Wheat" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
              <Input value={cNameHi} onChange={e => setCNameHi(e.target.value)} placeholder="गेहूँ" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'कोड' : 'Code'} *</Label>
              <Input value={cCode} onChange={e => setCCode(e.target.value)} placeholder="WHT" maxLength={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveCrop}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variety dialog */}
      <Dialog open={varOpen} onOpenChange={setVarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editVarId ? (hi ? 'किस्म संपादित करें' : 'Edit Variety') : (hi ? 'नई किस्म' : 'Add Variety')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'फसल' : 'Crop'} *</Label>
              <Select value={vCropId} onValueChange={setVCropId} disabled={!!editVarId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>{crops.map(c => <SelectItem key={c.id} value={c.id}>{cropLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label>
              <Input value={vName} onChange={e => setVName(e.target.value)} placeholder="HD 2967" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
              <Input value={vNameHi} onChange={e => setVNameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVarOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveVariety}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
