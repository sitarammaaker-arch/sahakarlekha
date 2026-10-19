/**
 * वाहन (Vehicle master) — the society's own vehicles: registration no., type, capacity, the Asset Register
 * row it is (for depreciation in the vehicle-wise profit), and insurance / permit / fitness / PUC expiry with
 * the Insurance page's badge rule (expired · ≤30 days). No accounting here.
 */
import { useState } from 'react';
import { useTransportOps, type NewVehicle } from '@/contexts/TransportOpsContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Trash2, Pencil } from 'lucide-react';
import EntityExportButton from '@/components/export/EntityExportButton';
import { expiryState } from '@/lib/transport/trips';
import type { TransportVehicle, VehicleType } from '@/types';

const TYPES: { id: VehicleType; hi: string; en: string }[] = [
  { id: 'truck', hi: 'ट्रक', en: 'Truck' },
  { id: 'tractor', hi: 'ट्रैक्टर-ट्रॉली', en: 'Tractor-trolley' },
  { id: 'tanker', hi: 'टैंकर', en: 'Tanker' },
  { id: 'pickup', hi: 'पिकअप / छोटा वाहन', en: 'Pickup / LCV' },
  { id: 'bus', hi: 'बस', en: 'Bus' },
  { id: 'other', hi: 'अन्य', en: 'Other' },
];
const DOCS = [
  { key: 'insuranceExpiry', hi: 'बीमा', en: 'Insurance' },
  { key: 'permitExpiry', hi: 'परमिट', en: 'Permit' },
  { key: 'fitnessExpiry', hi: 'फ़िटनेस', en: 'Fitness' },
  { key: 'pucExpiry', hi: 'PUC', en: 'PUC' },
] as const;
type DocKey = typeof DOCS[number]['key'];

const today = () => new Date().toISOString().split('T')[0];
const EMPTY: NewVehicle = { regNo: '', vehicleType: 'truck', capacity: '', status: 'active' };
const NO_ASSET = '__none__';

export default function Vehicles() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useTransportOps();
  const { assets } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [form, setForm] = useState<NewVehicle>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  const vehicleAssets = assets.filter(a => !a.isDeleted && a.category === 'Vehicle' && a.status !== 'disposed');
  const assetLabel = (id?: string) => { const a = assets.find(x => x.id === id); return a ? `${a.assetNo} · ${a.name}` : ''; };
  const typeLabel = (t: VehicleType) => { const x = TYPES.find(y => y.id === t); return x ? (hi ? x.hi : x.en) : t; };
  const list = vehicles.filter(v => !v.isDeleted).sort((a, b) => a.regNo.localeCompare(b.regNo));
  const now = today();
  const dueCount = list.filter(v => DOCS.some(d => { const s = expiryState(v[d.key], now).state; return s === 'expired' || s === 'soon'; })).length;

  const set = (k: keyof NewVehicle, v: string) => setForm(f => ({ ...f, [k]: v }));
  // New: only filled fields. Edit: every optional field is sent ('' = cleared), so clearing a date or the
  // asset link really clears it in the cloud row (an absent key would keep the old value on upsert).
  const clean = (f: NewVehicle, forEdit: boolean): NewVehicle => {
    const out: NewVehicle = { regNo: f.regNo, vehicleType: f.vehicleType, status: f.status };
    const opt = (k: 'capacity' | 'assetId' | 'remarks' | DocKey, val: string | undefined) => { const x = (val || '').trim(); if (x || forEdit) out[k] = x; };
    opt('capacity', f.capacity); opt('assetId', f.assetId); opt('remarks', f.remarks);
    for (const d of DOCS) opt(d.key, f[d.key]);
    return out;
  };
  const save = () => {
    if (editId) { updateVehicle(editId, clean(form, true)); setEditId(null); setForm(EMPTY); return; }
    const v = addVehicle(clean(form, false));
    if (v.id) setForm(EMPTY);
  };
  const edit = (v: TransportVehicle) => {
    setEditId(v.id);
    setForm({ regNo: v.regNo, vehicleType: v.vehicleType, capacity: v.capacity || '', assetId: v.assetId, status: v.status, remarks: v.remarks || '',
      insuranceExpiry: v.insuranceExpiry, permitExpiry: v.permitExpiry, fitnessExpiry: v.fitnessExpiry, pucExpiry: v.pucExpiry });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const badge = (v: TransportVehicle, k: DocKey, label: string) => {
    const { state, days } = expiryState(v[k], now);
    if (state === 'none') return null;
    if (state === 'expired') return <Badge key={k} variant="destructive">{label} {hi ? 'समाप्त' : 'expired'}</Badge>;
    if (state === 'soon') return <Badge key={k} variant="secondary">{label} {hi ? `${days} दिन` : `${days}d left`}</Badge>;
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Truck className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{hi ? 'वाहन' : 'Vehicles'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति के अपने वाहन — नंबर, क्षमता और कागज़ों (बीमा, परमिट, फ़िटनेस, PUC) की समाप्ति' : "The society's own vehicles — number, capacity and document expiry (insurance, permit, fitness, PUC)"}</p>
        </div>
        <div className="ml-auto"><EntityExportButton entityKey="transport_vehicle" /></div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{editId ? (hi ? 'वाहन बदलें' : 'Edit vehicle') : (hi ? 'नया वाहन' : 'New vehicle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{hi ? 'पंजीकरण नंबर' : 'Registration no.'} *</Label><Input value={form.regNo} onChange={e => set('regNo', e.target.value)} placeholder="HR-12-AB-1234" /></div>
            <div className="space-y-2">
              <Label>{hi ? 'वाहन प्रकार' : 'Vehicle type'}</Label>
              <Select value={form.vehicleType} onValueChange={v => set('vehicleType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'क्षमता' : 'Capacity'}</Label><Input value={form.capacity || ''} onChange={e => set('capacity', e.target.value)} placeholder={hi ? 'जैसे 10 टन' : 'e.g. 10 tonne'} /></div>
            <div className="space-y-2">
              <Label>{hi ? 'संपत्ति रजिस्टर से जोड़ें' : 'Asset Register row'}</Label>
              <Select value={form.assetId || NO_ASSET} onValueChange={v => setForm(f => ({ ...f, assetId: v === NO_ASSET ? undefined : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSET}>{hi ? '— नहीं जोड़ा —' : '— not linked —'}</SelectItem>
                  {vehicleAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.assetNo} · {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{hi ? 'जोड़ने पर उस संपत्ति का मूल्यह्रास वाहन-वार लाभ में इसी वाहन पर दिखेगा।' : "Linked: that asset's depreciation shows against this vehicle in Vehicle-wise Profit."}</p>
            </div>
            {DOCS.map(d => (
              <div key={d.key} className="space-y-2"><Label>{hi ? `${d.hi} समाप्ति` : `${d.en} expiry`}</Label><Input type="date" value={form[d.key] || ''} onChange={e => setForm(f => ({ ...f, [d.key]: e.target.value || undefined }))} /></div>
            ))}
            <div className="space-y-2">
              <Label>{hi ? 'स्थिति' : 'Status'}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
                  <SelectItem value="inactive">{hi ? 'निष्क्रिय' : 'Inactive'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'टिप्पणी' : 'Remarks'}</Label><Input value={form.remarks || ''} onChange={e => set('remarks', e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">{editId ? (hi ? 'बदलाव सेव करें' : 'Save changes') : (hi ? 'वाहन जोड़ें' : 'Add vehicle')}</Button>
            {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm(EMPTY); }}>{hi ? 'रद्द' : 'Cancel'}</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'वाहन सूची' : 'Vehicles'} ({list.length}){dueCount > 0 && <span className="text-sm font-normal text-amber-600 ml-2">· {dueCount} {hi ? 'वाहनों के कागज़ 30 दिन में समाप्त / समाप्त' : 'with documents expiring ≤30d / expired'}</span>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई वाहन नहीं।' : 'No vehicles yet.'}</p>}
          {list.map(v => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{v.regNo}</span>
                  <Badge variant="outline">{typeLabel(v.vehicleType)}</Badge>
                  {v.status === 'inactive' && <Badge variant="secondary">{hi ? 'निष्क्रिय' : 'Inactive'}</Badge>}
                  {DOCS.map(d => badge(v, d.key, hi ? d.hi : d.en))}
                </div>
                <div className="text-muted-foreground">
                  {v.capacity || '—'}{v.assetId ? ` · ${assetLabel(v.assetId)}` : ''}
                  {DOCS.filter(d => v[d.key]).map(d => ` · ${hi ? d.hi : d.en} ${v[d.key]}`).join('')}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => edit(v)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(hi ? `वाहन ${v.regNo} हटाएँ?` : `Delete vehicle ${v.regNo}?`)) deleteVehicle(v.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
