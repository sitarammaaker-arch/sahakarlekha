import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBankAccountIds } from '@/lib/storage';
import { todayStr } from '@/lib/dateUtils';
import { tripFreight, tripBalance } from '@/lib/marketing/transport';
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
 * Transport — hired transporters (T1 master) and, from E2, hired-truck trips: recording a trip POSTS
 * the freight (Dr the freight expense ledger / Cr the transporter's own payable ledger); payments are
 * recorded against the trip. The society's OWN vehicles are in the separate Trips module.
 * Capability-gated by 'transport' (granted to marketing_processing).
 */
export default function Transport() {
  const { transporters, addTransporter, updateTransporter, deleteTransporter, hiredTrips, addHiredTrip, payHiredTrip, deleteHiredTrip, tripPayments, dispatches } = useMarketingData();
  const { accounts, addAccount } = useData();
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
  const [ledgerId, setLedgerId] = useState('');

  const openAdd = () => { setEditId(null); setName(''); setNameHi(''); setVehicleNo(''); setPhone(''); setRate(''); setLedgerId(''); setOpen(true); };
  const openEdit = (id: string) => {
    const t = transporters.find(x => x.id === id);
    if (!t) return;
    setEditId(id); setName(t.name); setNameHi(t.nameHi || ''); setVehicleNo(t.vehicleNo || ''); setPhone(t.phone || ''); setRate(t.ratePerQtl != null ? String(t.ratePerQtl) : ''); setLedgerId(t.ledgerAccountId || ''); setOpen(true);
  };
  const save = () => {
    if (!name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    const payload = { name: name.trim(), nameHi: nameHi.trim() || undefined, vehicleNo: vehicleNo.trim().toUpperCase() || undefined, phone: phone.trim() || undefined, ratePerQtl: rate.trim() ? Number(rate) : undefined, ledgerAccountId: ledgerId || undefined };
    if (editId) updateTransporter(editId, payload);
    else addTransporter(payload);
    setOpen(false);
  };

  // ── E2: transporter ledger + hired trips ──
  const accLabel = (a: (typeof accounts)[number]) => `${a.id.length <= 6 ? `${a.id} · ` : ''}${hi && a.nameHi ? a.nameHi : a.name}`;
  const liabilityLeaves = accounts.filter(a => !a.isGroup && a.type === 'liability');
  const creditorsGroup = accounts.find(a => a.id === '2101' && a.isGroup) || accounts.find(a => a.isGroup && a.type === 'liability' && /creditor|लेनदार|देनदार/i.test(`${a.name} ${a.nameHi || ''}`));
  const createLedger = () => {
    if (!name.trim()) { toast({ title: hi ? 'पहले नाम भरें' : 'Enter the name first', variant: 'destructive' }); return; }
    const a = addAccount({ name: name.trim(), nameHi: nameHi.trim() || name.trim(), type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isGroup: false, parentId: creditorsGroup?.id } as Parameters<typeof addAccount>[0], { onSaved: (acc) => setLedgerId(acc.id) });
    if (a.id) setLedgerId(a.id);
  };
  const expenseLeaves = accounts.filter(a => !a.isGroup && a.type === 'expense');
  const freightGuess = expenseLeaves.find(a => /freight|भाड़ा|carriage|transport/i.test(`${a.name} ${a.nameHi || ''}`))?.id || '';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const [tf, setTf] = useState({ date: todayStr(), transporterId: '', dispatchId: '', vehicleNo: '', fromPlace: '', toPlace: '', qty: '', rate: '', lump: '', expenseAccountId: '', note: '' });
  const tfTransporter = transporters.find(t => t.id === tf.transporterId);
  const tfFreight = tripFreight(Number(tf.qty), Number(tf.rate || tfTransporter?.ratePerQtl), Number(tf.lump));
  const saveTrip = () => {
    addHiredTrip({ date: tf.date, transporterId: tf.transporterId, dispatchId: tf.dispatchId || undefined, vehicleNo: tf.vehicleNo, fromPlace: tf.fromPlace, toPlace: tf.toPlace, qty: Number(tf.qty) || undefined, rate: Number(tf.rate || tfTransporter?.ratePerQtl) || undefined, lump: Number(tf.lump) || undefined, expenseAccountId: tf.expenseAccountId || freightGuess, note: tf.note });
    setTf(p => ({ ...p, dispatchId: '', qty: '', lump: '', note: '' }));
  };
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const [pay, setPay] = useState<Record<string, { amount: string; date: string; mode: 'bank' | 'cash'; ref: string }>>({});
  const trName = (id: string) => { const t = transporters.find(x => x.id === id); return t ? (hi && t.nameHi ? t.nameHi : t.name) : id; };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Truck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'परिवहन' : 'Transport'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'किराये के ट्रांसपोर्टर, उनकी trips, भाड़ा और भुगतान — अपने वाहनों की trip "ट्रिप" मॉड्यूल में' : 'Hired transporters, their trips, freight and payment — own-vehicle trips are in the Trips module'}</p>
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
                  {hi && t.nameHi ? (t.nameHi || t.name) : t.name}
                  {t.vehicleNo ? <Badge variant="outline" className="ml-2 font-mono">{t.vehicleNo}</Badge> : null}
                  {t.ratePerQtl != null ? <Badge variant="secondary" className="ml-1">₹{t.ratePerQtl}/{hi ? 'क्विं' : 'qtl'}</Badge> : null}
                </div>
                <div className="text-xs text-muted-foreground">{t.phone || ''}{t.ledgerAccountId ? `${t.phone ? ' · ' : ''}${hi ? 'खाता' : 'ledger'}: ${accounts.find(a => a.id === t.ledgerAccountId)?.name || t.ledgerAccountId}` : (hi ? ' · खाता नहीं — trip से पहले चुनें' : ' · no ledger yet')}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t.id)} aria-label="edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(hi ? 'यह ट्रांसपोर्टर हटाएँ?' : 'Delete this transporter?')) deleteTransporter(t.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── E2: hired-truck trips ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'किराये की trip (भाड़ा)' : 'Hired trips (freight)'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="space-y-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={tf.date} max={todayStr()} onChange={e => setTf(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{hi ? 'ट्रांसपोर्टर' : 'Transporter'}</Label>
              <Select value={tf.transporterId} onValueChange={v => setTf(p => ({ ...p, transporterId: v }))}><SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{transporters.map(t => <SelectItem key={t.id} value={t.id}>{trName(t.id)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>{hi ? 'डिस्पैच (वैकल्पिक)' : 'Dispatch (optional)'}</Label>
              <Select value={tf.dispatchId || '__none__'} onValueChange={v => setTf(p => ({ ...p, dispatchId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">—</SelectItem>{dispatches.filter(d => !d.isDeleted).map(d => <SelectItem key={d.id} value={d.id}>{d.dispatchNo} · {d.date}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>{hi ? 'कहाँ से' : 'From'}</Label><Input value={tf.fromPlace} onChange={e => setTf(p => ({ ...p, fromPlace: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{hi ? 'कहाँ तक' : 'To'}</Label><Input value={tf.toPlace} onChange={e => setTf(p => ({ ...p, toPlace: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{hi ? 'वाहन नं.' : 'Vehicle no.'}</Label><Input value={tf.vehicleNo} onChange={e => setTf(p => ({ ...p, vehicleNo: e.target.value.toUpperCase() }))} placeholder={tfTransporter?.vehicleNo || ''} /></div>
            <div className="space-y-1"><Label>{hi ? 'मात्रा (क्विं)' : 'Qty (qtl)'}</Label><Input type="number" min={0} step="0.001" value={tf.qty} onChange={e => setTf(p => ({ ...p, qty: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{hi ? 'दर ₹/क्विं' : 'Rate ₹/qtl'}</Label><Input type="number" min={0} step="0.01" value={tf.rate} onChange={e => setTf(p => ({ ...p, rate: e.target.value }))} placeholder={tfTransporter?.ratePerQtl != null ? String(tfTransporter.ratePerQtl) : ''} /></div>
            <div className="space-y-1"><Label>{hi ? 'या कुल भाड़ा ₹' : 'or lump sum ₹'}</Label><Input type="number" min={0} step="0.01" value={tf.lump} onChange={e => setTf(p => ({ ...p, lump: e.target.value }))} /></div>
            <div className="space-y-1 col-span-2 sm:col-span-3"><Label>{hi ? 'भाड़े का खर्च खाता (Dr)' : 'Freight expense ledger (Dr)'}</Label>
              <Select value={tf.expenseAccountId || freightGuess} onValueChange={v => setTf(p => ({ ...p, expenseAccountId: v }))}><SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{expenseLeaves.map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <Button onClick={saveTrip} disabled={!tf.transporterId || !(tfFreight > 0)}>{hi ? `trip दर्ज करें · भाड़ा ${money(tfFreight)}` : `Record trip · freight ${money(tfFreight)}`}</Button>
          <p className="text-[11px] text-muted-foreground">{hi ? 'दर्ज करने पर बहीखाते में: Dr भाड़ा खर्च / Cr ट्रांसपोर्टर। एजेंसी यह भाड़ा लौटाती हो तो उसे एजेंसी बिल की खर्च-पंक्ति में भी जोड़ें।' : 'Posts Dr freight expense / Cr transporter. If the agency reimburses it, add it as an incidental line on the agency bill too.'}</p>
          <div className="space-y-2">
            {hiredTrips.filter(t => !t.isDeleted).sort((a, b) => (a.date < b.date ? 1 : -1)).map(t => {
              const bal = tripBalance(t, tripPayments);
              const f = pay[t.id] ?? { amount: String(bal.outstanding), date: todayStr(), mode: 'bank' as const, ref: '' };
              return (
                <div key={t.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{t.tripNo} · {t.date} · {trName(t.transporterId)} {bal.outstanding <= 0.005 ? <Badge variant="secondary">{hi ? 'चुकता' : 'Paid'}</Badge> : null}</div>
                      <div className="text-xs text-muted-foreground">{t.vehicleNo || ''}{t.fromPlace || t.toPlace ? ` · ${t.fromPlace || ''} → ${t.toPlace || ''}` : ''}{t.qty ? ` · ${t.qty} ${hi ? 'क्विं' : 'qtl'}` : ''} · {hi ? 'भाड़ा' : 'freight'} {money(t.freight)} · {hi ? 'चुकाया' : 'paid'} {money(bal.paid)} · <b>{hi ? 'बकाया' : 'due'} {money(bal.outstanding)}</b></div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { if (window.confirm(hi ? `trip ${t.tripNo} हटाएँ? भाड़े का वाउचर भी रद्द होगा।` : `Delete trip ${t.tripNo}?`)) void deleteHiredTrip(t.id); }} aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {bal.outstanding > 0.005 && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <Input type="number" min={0} step="0.01" value={f.amount} onChange={e => setPay(p => ({ ...p, [t.id]: { ...f, amount: e.target.value } }))} />
                      <Input type="date" value={f.date} onChange={e => setPay(p => ({ ...p, [t.id]: { ...f, date: e.target.value } }))} />
                      <Select value={f.mode} onValueChange={v => setPay(p => ({ ...p, [t.id]: { ...f, mode: v as 'bank' | 'cash' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem></SelectContent></Select>
                      <Input value={f.ref} onChange={e => setPay(p => ({ ...p, [t.id]: { ...f, ref: e.target.value } }))} placeholder={hi ? 'संदर्भ' : 'Ref'} />
                      <Button size="sm" onClick={() => payHiredTrip(t.id, { amount: Number(f.amount), date: f.date, mode: f.mode, bankAccountId: f.mode === 'bank' ? bankAccounts[0]?.id : undefined, reference: f.ref.trim() || undefined })}>{hi ? 'भुगतान' : 'Pay'}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            <div className="space-y-1.5">
              <Label>{hi ? 'ट्रांसपोर्टर का खाता (देनदार)' : 'Transporter ledger (creditor)'}</Label>
              <div className="flex gap-2">
                <Select value={ledgerId || '__none__'} onValueChange={v => setLedgerId(v === '__none__' ? '' : v)}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">—</SelectItem>{liabilityLeaves.map(a => <SelectItem key={a.id} value={a.id}>{accLabel(a)}</SelectItem>)}</SelectContent></Select>
                <Button type="button" variant="outline" onClick={createLedger}>{hi ? 'नया बनाएँ' : 'Create'}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'भाड़ा इसी खाते में जमा (Cr) होगा और भुगतान इसी से घटेगा।' : 'Freight is credited here; payments reduce it.'}</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button><Button onClick={save}>{hi ? 'सेव करें' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
