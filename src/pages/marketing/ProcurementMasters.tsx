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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Wheat, Plus, Sprout, Pencil, Trash2, CalendarDays, Building2, IndianRupee } from 'lucide-react';

const AGENCY_KINDS = ['FCI', 'HAFED', 'MARKFED', 'NAFED', 'state'];

/**
 * Procurement Masters (Marketing M1a + M1b) — Crop, Variety, Season, Agency & Centre master data.
 * Config only (no accounting). Consumed by the Procurement Lots screen (crop/variety/season/centre
 * pickers). Owned by MarketingDataContext; the frozen event-sourced chain stays in DataContext.
 */
export default function ProcurementMasters() {
  const {
    crops, varieties, addCrop, updateCrop, deleteCrop, seedStandardCrops, addVariety, updateVariety, deleteVariety,
    seasons, addSeason, updateSeason, deleteSeason,
    agencies, addAgency, updateAgency, deleteAgency,
    centres, addCentre, updateCentre, deleteCentre,
    mspRates, addMspRate, deleteMspRate,
  } = useMarketingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const cropLabel = (c: { name: string; nameHi?: string }) => (hi && c.nameHi ? c.nameHi : c.name);

  // ── Crop dialog ────────────────────────────────────────────────────────────────
  const [cropOpen, setCropOpen] = useState(false);
  const [editCropId, setEditCropId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cNameHi, setCNameHi] = useState('');
  const [cCode, setCCode] = useState('');
  const openAddCrop = () => { setEditCropId(null); setCName(''); setCNameHi(''); setCCode(''); setCropOpen(true); };
  const openEditCrop = (id: string) => { const c = crops.find(x => x.id === id); if (!c) return; setEditCropId(id); setCName(c.name); setCNameHi(c.nameHi || ''); setCCode(c.code); setCropOpen(true); };
  const saveCrop = () => {
    if (!cName.trim()) { toast({ title: hi ? 'फसल का नाम आवश्यक' : 'Crop name required', variant: 'destructive' }); return; }
    if (!cCode.trim()) { toast({ title: hi ? 'कोड आवश्यक' : 'Code required', variant: 'destructive' }); return; }
    if (editCropId) updateCrop(editCropId, { name: cName.trim(), code: cCode.trim().toUpperCase(), nameHi: cNameHi.trim() || undefined });
    else addCrop({ name: cName.trim(), code: cCode.trim().toUpperCase(), nameHi: cNameHi.trim() || undefined });
    setCropOpen(false);
  };

  // ── Variety dialog ───────────────────────────────────────────────────────────────
  const [varOpen, setVarOpen] = useState(false);
  const [editVarId, setEditVarId] = useState<string | null>(null);
  const [vCropId, setVCropId] = useState('');
  const [vName, setVName] = useState('');
  const [vNameHi, setVNameHi] = useState('');
  const openAddVariety = (cropId?: string) => { setEditVarId(null); setVCropId(cropId || ''); setVName(''); setVNameHi(''); setVarOpen(true); };
  const openEditVariety = (id: string) => { const v = varieties.find(x => x.id === id); if (!v) return; setEditVarId(id); setVCropId(v.cropId); setVName(v.name); setVNameHi(v.nameHi || ''); setVarOpen(true); };
  const saveVariety = () => {
    if (!vCropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!vName.trim()) { toast({ title: hi ? 'किस्म का नाम आवश्यक' : 'Variety name required', variant: 'destructive' }); return; }
    if (editVarId) updateVariety(editVarId, { name: vName.trim(), nameHi: vNameHi.trim() || undefined });
    else addVariety({ cropId: vCropId, name: vName.trim(), nameHi: vNameHi.trim() || undefined });
    setVarOpen(false);
  };

  // ── Season dialog ────────────────────────────────────────────────────────────────
  const [seaOpen, setSeaOpen] = useState(false);
  const [editSeaId, setEditSeaId] = useState<string | null>(null);
  const [sName, setSName] = useState('');
  const [sNameHi, setSNameHi] = useState('');
  const [sCropYear, setSCropYear] = useState('');
  const [sStart, setSStart] = useState('');
  const [sEnd, setSEnd] = useState('');
  const openAddSeason = () => { setEditSeaId(null); setSName(''); setSNameHi(''); setSCropYear(''); setSStart(''); setSEnd(''); setSeaOpen(true); };
  const openEditSeason = (id: string) => { const s = seasons.find(x => x.id === id); if (!s) return; setEditSeaId(id); setSName(s.name); setSNameHi(s.nameHi || ''); setSCropYear(s.cropYear); setSStart(s.startDate); setSEnd(s.endDate); setSeaOpen(true); };
  const saveSeason = () => {
    if (!sName.trim()) { toast({ title: hi ? 'सीज़न का नाम आवश्यक' : 'Season name required', variant: 'destructive' }); return; }
    const payload = { name: sName.trim(), nameHi: sNameHi.trim() || undefined, cropYear: sCropYear.trim(), startDate: sStart, endDate: sEnd };
    if (editSeaId) updateSeason(editSeaId, payload);
    else addSeason(payload);
    setSeaOpen(false);
  };

  // ── Agency dialog ────────────────────────────────────────────────────────────────
  const [agOpen, setAgOpen] = useState(false);
  const [editAgId, setEditAgId] = useState<string | null>(null);
  const [aName, setAName] = useState('');
  const [aNameHi, setANameHi] = useState('');
  const [aCode, setACode] = useState('');
  const [aKind, setAKind] = useState('');
  const openAddAgency = () => { setEditAgId(null); setAName(''); setANameHi(''); setACode(''); setAKind(''); setAgOpen(true); };
  const openEditAgency = (id: string) => { const a = agencies.find(x => x.id === id); if (!a) return; setEditAgId(id); setAName(a.name); setANameHi(a.nameHi || ''); setACode(a.code); setAKind(a.kind); setAgOpen(true); };
  const saveAgency = () => {
    if (!aName.trim()) { toast({ title: hi ? 'एजेंसी का नाम आवश्यक' : 'Agency name required', variant: 'destructive' }); return; }
    const payload = { name: aName.trim(), nameHi: aNameHi.trim() || undefined, code: aCode.trim().toUpperCase(), kind: aKind || 'state' };
    if (editAgId) updateAgency(editAgId, payload);
    else addAgency(payload);
    setAgOpen(false);
  };

  // ── Centre dialog ────────────────────────────────────────────────────────────────
  const [cenOpen, setCenOpen] = useState(false);
  const [editCenId, setEditCenId] = useState<string | null>(null);
  const [cenAgencyId, setCenAgencyId] = useState('');
  const [cenName, setCenName] = useState('');
  const [cenNameHi, setCenNameHi] = useState('');
  const [cenCode, setCenCode] = useState('');
  const openAddCentre = (agencyId?: string) => { setEditCenId(null); setCenAgencyId(agencyId || ''); setCenName(''); setCenNameHi(''); setCenCode(''); setCenOpen(true); };
  const openEditCentre = (id: string) => { const c = centres.find(x => x.id === id); if (!c) return; setEditCenId(id); setCenAgencyId(c.agencyId); setCenName(c.name); setCenNameHi(c.nameHi || ''); setCenCode(c.code); setCenOpen(true); };
  const saveCentre = () => {
    if (!cenAgencyId) { toast({ title: hi ? 'एजेंसी चुनें' : 'Select an agency', variant: 'destructive' }); return; }
    if (!cenName.trim()) { toast({ title: hi ? 'केंद्र का नाम आवश्यक' : 'Centre name required', variant: 'destructive' }); return; }
    if (editCenId) updateCentre(editCenId, { name: cenName.trim(), code: cenCode.trim().toUpperCase(), nameHi: cenNameHi.trim() || undefined });
    else addCentre({ agencyId: cenAgencyId, name: cenName.trim(), code: cenCode.trim().toUpperCase(), nameHi: cenNameHi.trim() || undefined });
    setCenOpen(false);
  };

  // ── MSP rate dialog (add only; rates are effective-dated records) ──────────────────
  const [mspOpen, setMspOpen] = useState(false);
  const [mCropId, setMCropId] = useState('');
  const [mSeasonId, setMSeasonId] = useState('');
  const [mRate, setMRate] = useState('');
  const [mFrom, setMFrom] = useState('');
  const openAddMsp = () => { setMCropId(''); setMSeasonId(''); setMRate(''); setMFrom(new Date().toISOString().slice(0, 10)); setMspOpen(true); };
  const saveMsp = () => {
    const r = Number(mRate);
    if (!mCropId) { toast({ title: hi ? 'फसल चुनें' : 'Select a crop', variant: 'destructive' }); return; }
    if (!mSeasonId) { toast({ title: hi ? 'सीज़न चुनें' : 'Select a season', variant: 'destructive' }); return; }
    if (!(r > 0)) { toast({ title: hi ? 'दर दर्ज करें' : 'Enter a rate', variant: 'destructive' }); return; }
    if (!mFrom) { toast({ title: hi ? 'प्रभावी तिथि चुनें' : 'Select effective date', variant: 'destructive' }); return; }
    addMspRate({ cropId: mCropId, seasonId: mSeasonId, rate: r, effectiveFrom: mFrom });
    setMspOpen(false);
  };
  const seasonName = (id: string) => { const s = seasons.find(x => x.id === id); return s ? (hi && s.nameHi ? s.nameHi : s.name) : id; };
  const sortedMsp = [...mspRates].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wheat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रोक्योरमेंट मास्टर' : 'Procurement Masters'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'फसल · किस्म · सीज़न · एजेंसी · केंद्र — एक बार सेट करें' : 'Crops · varieties · seasons · agencies · centres — set once'}</p>
        </div>
      </div>

      <Tabs defaultValue="crops">
        <TabsList className="w-full">
          <TabsTrigger value="crops" className="flex-1 gap-1"><Sprout className="h-4 w-4" />{hi ? 'फसल व किस्म' : 'Crops'}</TabsTrigger>
          <TabsTrigger value="seasons" className="flex-1 gap-1"><CalendarDays className="h-4 w-4" />{hi ? 'सीज़न' : 'Seasons'}</TabsTrigger>
          <TabsTrigger value="agencies" className="flex-1 gap-1"><Building2 className="h-4 w-4" />{hi ? 'एजेंसी व केंद्र' : 'Agencies'}</TabsTrigger>
          <TabsTrigger value="msp" className="flex-1 gap-1"><IndianRupee className="h-4 w-4" />{hi ? 'MSP दर' : 'MSP'}</TabsTrigger>
        </TabsList>

        {/* ── Crops & Varieties ── */}
        <TabsContent value="crops">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'फसलें' : 'Crops'} ({crops.length})</CardTitle>
              <div className="flex gap-2">
                {crops.length === 0 && <Button size="sm" variant="secondary" className="gap-1" onClick={seedStandardCrops}><Sprout className="h-4 w-4" />{hi ? 'मानक फसलें' : 'Seed standard'}</Button>}
                <Button size="sm" className="gap-1" onClick={openAddCrop}><Plus className="h-4 w-4" />{hi ? 'फसल' : 'Crop'}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {crops.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई फसल नहीं। "मानक फसलें" से शुरू करें।' : 'No crops yet. Start with "Seed standard".'}</p>}
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
        </TabsContent>

        {/* ── Seasons ── */}
        <TabsContent value="seasons">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'सीज़न' : 'Seasons'} ({seasons.length})</CardTitle>
              <Button size="sm" className="gap-1" onClick={openAddSeason}><Plus className="h-4 w-4" />{hi ? 'सीज़न' : 'Season'}</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {seasons.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई सीज़न नहीं। उदा. "रबी 2025-26"।' : 'No seasons yet. e.g. "Rabi 2025-26".'}</p>}
              {seasons.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{hi && s.nameHi ? s.nameHi : s.name}{s.cropYear ? <Badge variant="outline" className="ml-2 font-mono">{s.cropYear}</Badge> : null}</div>
                    {(s.startDate || s.endDate) && <div className="text-xs text-muted-foreground">{s.startDate || '…'} → {s.endDate || '…'}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditSeason(s.id)} aria-label="edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteSeason(s.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Agencies & Centres ── */}
        <TabsContent value="agencies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'एजेंसियाँ' : 'Agencies'} ({agencies.length})</CardTitle>
              <Button size="sm" className="gap-1" onClick={openAddAgency}><Plus className="h-4 w-4" />{hi ? 'एजेंसी' : 'Agency'}</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {agencies.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई एजेंसी नहीं। उदा. HAFED, FCI।' : 'No agencies yet. e.g. HAFED, FCI.'}</p>}
              {agencies.map(a => {
                const cs = centres.filter(c => c.agencyId === a.id);
                return (
                  <div key={a.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{hi && a.nameHi ? a.nameHi : a.name} <Badge variant="outline" className="ml-1 font-mono">{a.code}</Badge> <Badge variant="secondary" className="ml-1">{a.kind}</Badge></div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditAgency(a.id)} aria-label="edit"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteAgency(a.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      {cs.length === 0 && <span className="text-xs text-muted-foreground">{hi ? 'कोई केंद्र नहीं' : 'No centres'}</span>}
                      {cs.map(c => (
                        <Badge key={c.id} variant="secondary" className="gap-1 font-normal">
                          <button className="hover:underline" onClick={() => openEditCentre(c.id)}>{hi && c.nameHi ? c.nameHi : c.name}{c.code ? ` (${c.code})` : ''}</button>
                          <button className="text-destructive/70 hover:text-destructive" onClick={() => deleteCentre(c.id)} aria-label="remove centre">×</button>
                        </Badge>
                      ))}
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => openAddCentre(a.id)}><Plus className="h-3 w-3" />{hi ? 'केंद्र' : 'Centre'}</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MSP Rates ── */}
        <TabsContent value="msp">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{hi ? 'MSP दरें' : 'MSP Rates'} ({mspRates.length})</CardTitle>
              <Button size="sm" className="gap-1" onClick={openAddMsp} disabled={crops.length === 0 || seasons.length === 0}><Plus className="h-4 w-4" />{hi ? 'दर' : 'Rate'}</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(crops.length === 0 || seasons.length === 0) && (
                <p className="text-sm text-muted-foreground">{hi ? 'पहले फसल व सीज़न जोड़ें, फिर MSP दर।' : 'Add crops & seasons first, then MSP rates.'}</p>
              )}
              {crops.length > 0 && seasons.length > 0 && sortedMsp.length === 0 && (
                <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई MSP दर नहीं। दर जोड़ें — लॉट बनाते समय अपने-आप भर जाएगी।' : 'No MSP rates yet. Add one — it auto-fills when creating a lot.'}</p>
              )}
              {sortedMsp.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{cropLabel(crops.find(c => c.id === r.cropId) || { name: r.cropId })} · {seasonName(r.seasonId)}</div>
                    <div className="text-xs text-muted-foreground">₹{r.rate.amount.toLocaleString('en-IN')}/{hi ? 'क्विंटल' : 'qtl'} · {hi ? 'प्रभावी' : 'w.e.f.'} {r.effectiveFrom}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteMspRate(r.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCropId ? (hi ? 'फसल संपादित करें' : 'Edit Crop') : (hi ? 'नई फसल' : 'Add Crop')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={cName} onChange={e => setCName(e.target.value)} placeholder="Wheat" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={cNameHi} onChange={e => setCNameHi(e.target.value)} placeholder="गेहूँ" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'कोड' : 'Code'} *</Label><Input value={cCode} onChange={e => setCCode(e.target.value)} placeholder="WHT" maxLength={8} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCropOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveCrop}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
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
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={vName} onChange={e => setVName(e.target.value)} placeholder="HD 2967" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={vNameHi} onChange={e => setVNameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVarOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveVariety}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Season dialog */}
      <Dialog open={seaOpen} onOpenChange={setSeaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editSeaId ? (hi ? 'सीज़न संपादित करें' : 'Edit Season') : (hi ? 'नया सीज़न' : 'Add Season')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={sName} onChange={e => setSName(e.target.value)} placeholder="Rabi 2025-26" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={sNameHi} onChange={e => setSNameHi(e.target.value)} placeholder="रबी 2025-26" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'फसल वर्ष' : 'Crop Year'}</Label><Input value={sCropYear} onChange={e => setSCropYear(e.target.value)} placeholder="2025-26" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'आरंभ' : 'Start'}</Label><Input type="date" value={sStart} onChange={e => setSStart(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'समाप्ति' : 'End'}</Label><Input type="date" value={sEnd} onChange={e => setSEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSeaOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveSeason}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agency dialog */}
      <Dialog open={agOpen} onOpenChange={setAgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editAgId ? (hi ? 'एजेंसी संपादित करें' : 'Edit Agency') : (hi ? 'नई एजेंसी' : 'Add Agency')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={aName} onChange={e => setAName(e.target.value)} placeholder="HAFED" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={aNameHi} onChange={e => setANameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'कोड' : 'Code'}</Label><Input value={aCode} onChange={e => setACode(e.target.value)} placeholder="HFD" maxLength={8} /></div>
              <div className="space-y-1.5">
                <Label>{hi ? 'प्रकार' : 'Kind'}</Label>
                <Select value={aKind} onValueChange={setAKind}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'प्रकार' : 'Kind'} /></SelectTrigger>
                  <SelectContent>{AGENCY_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAgOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveAgency}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Centre dialog */}
      <Dialog open={cenOpen} onOpenChange={setCenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCenId ? (hi ? 'केंद्र संपादित करें' : 'Edit Centre') : (hi ? 'नया केंद्र' : 'Add Centre')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'एजेंसी' : 'Agency'} *</Label>
              <Select value={cenAgencyId} onValueChange={setCenAgencyId} disabled={!!editCenId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'एजेंसी चुनें' : 'Select agency'} /></SelectTrigger>
                <SelectContent>{agencies.map(a => <SelectItem key={a.id} value={a.id}>{hi && a.nameHi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={cenName} onChange={e => setCenName(e.target.value)} placeholder="Kaithal Mandi" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={cenNameHi} onChange={e => setCenNameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            <div className="space-y-1.5"><Label>{hi ? 'कोड' : 'Code'}</Label><Input value={cenCode} onChange={e => setCenCode(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} maxLength={12} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCenOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveCentre}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MSP rate dialog */}
      <Dialog open={mspOpen} onOpenChange={setMspOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'नई MSP दर' : 'Add MSP Rate'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'फसल' : 'Crop'} *</Label>
              <Select value={mCropId} onValueChange={setMCropId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फसल चुनें' : 'Select crop'} /></SelectTrigger>
                <SelectContent>{crops.map(c => <SelectItem key={c.id} value={c.id}>{cropLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'सीज़न' : 'Season'} *</Label>
              <Select value={mSeasonId} onValueChange={setMSeasonId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सीज़न चुनें' : 'Select season'} /></SelectTrigger>
                <SelectContent>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{hi && s.nameHi ? s.nameHi : s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'दर (₹/क्विंटल)' : 'Rate (₹/qtl)'} *</Label><Input type="number" min={0} value={mRate} onChange={e => setMRate(e.target.value)} placeholder="2425" /></div>
              <div className="space-y-1.5"><Label>{hi ? 'प्रभावी तिथि' : 'Effective from'} *</Label><Input type="date" value={mFrom} onChange={e => setMFrom(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">{hi ? 'दर बदलने पर नई प्रभावी-तिथि वाली दर जोड़ें — पुरानी दर इतिहास के लिए बनी रहती है।' : 'To revise, add a new rate with a later effective date — the old one stays for history.'}</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMspOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={saveMsp}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
