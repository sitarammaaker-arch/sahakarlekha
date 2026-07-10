import { useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Truck, Plus, Pencil, Trash2 } from 'lucide-react';
import EntityExportButton from '@/components/export/EntityExportButton';

/**
 * Transport (T1) — transporter master. Trips + freight posting + settlement land in T2.
 * Capability-gated by 'transport' (granted to marketing_processing).
 */
export default function Transport() {
  const { transporters, addTransporter, updateTransporter, deleteTransporter } = useMarketingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');

  const openAdd = () => { setEditId(null); setName(''); setNameHi(''); setVehicleNo(''); setPhone(''); setRate(''); setOpen(true); };
  const openEdit = (id: string) => {
    const t = transporters.find(x => x.id === id);
    if (!t) return;
    setEditId(id); setName(t.name); setNameHi(t.nameHi || ''); setVehicleNo(t.vehicleNo || ''); setPhone(t.phone || ''); setRate(t.ratePerQtl != null ? String(t.ratePerQtl) : ''); setOpen(true);
  };
  const save = () => {
    if (!name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    const payload = { name: name.trim(), nameHi: nameHi.trim() || undefined, vehicleNo: vehicleNo.trim().toUpperCase() || undefined, phone: phone.trim() || undefined, ratePerQtl: rate.trim() ? Number(rate) : undefined };
    if (editId) updateTransporter(editId, payload);
    else addTransporter(payload);
    setOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Truck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'परिवहन' : 'Transport'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'ट्रांसपोर्टर मास्टर — ट्रिप व भाड़ा निपटान अगले चरण में' : 'Transporter master — trips & freight settlement next'}</p>
        </div>
        {/* T-21: this register had no export at all (audit gap EXP-10). The
            Export Registry decides whether it renders, which columns leave, and whether
            the audit row was written before any bytes did. */}
        <div className="ml-auto">
          <EntityExportButton entityKey="marketing_transporter" />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{hi ? 'ट्रांसपोर्टर' : 'Transporters'} ({transporters.length})</CardTitle>
          <Button size="sm" className="gap-1" onClick={openAdd}><Plus className="h-4 w-4" />{hi ? 'ट्रांसपोर्टर' : 'Transporter'}</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {transporters.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई ट्रांसपोर्टर नहीं। जोड़ें।' : 'No transporters yet. Add one.'}</p>}
          {transporters.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {hi && t.nameHi ? t.nameHi : t.name}
                  {t.vehicleNo ? <Badge variant="outline" className="ml-2 font-mono">{t.vehicleNo}</Badge> : null}
                  {t.ratePerQtl != null ? <Badge variant="secondary" className="ml-1">₹{t.ratePerQtl}/{hi ? 'क्विं' : 'qtl'}</Badge> : null}
                </div>
                {t.phone && <div className="text-xs text-muted-foreground">{t.phone}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t.id)} aria-label="edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteTransporter(t.id)} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? (hi ? 'ट्रांसपोर्टर संपादित करें' : 'Edit Transporter') : (hi ? 'नया ट्रांसपोर्टर' : 'Add Transporter')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{hi ? 'नाम (English)' : 'Name (English)'} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ram Transport" /></div>
            <div className="space-y-1.5"><Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label><Input value={nameHi} onChange={e => setNameHi(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{hi ? 'वाहन सं.' : 'Vehicle No.'}</Label><Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="HR-01-AB-1234" /></div>
              <div className="space-y-1.5"><Label>{hi ? 'मोबाइल' : 'Phone'}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            </div>
            <div className="space-y-1.5"><Label>{hi ? 'भाड़ा दर (₹/क्विंटल)' : 'Freight rate (₹/qtl)'}</Label><Input type="number" min={0} step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder={hi ? 'वैकल्पिक — ट्रिप पर बदल सकते हैं' : 'optional — overridable per trip'} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={save}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
