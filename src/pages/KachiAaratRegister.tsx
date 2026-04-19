/**
 * Kachi Aarat Register — HAFED Proforma 8 source data.
 *
 * Captures each transaction where the society acted as Kachi Aarat
 * (commission agent) for a farmer in the mandi. Dami (commission) is
 * recorded BEFORE farmer rebate so it rolls up correctly into P8/P9.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Pencil, Trash2, AlertCircle, Scale } from 'lucide-react';
import type { KachiAaratEntry, KachiAaratCrop } from '@/types';
import { KACHI_CROP_LABELS } from '@/lib/annualReview/p8Calculator';

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  fyStartDate: '',
  crop: 'mustardSeed' as KachiAaratCrop,
  partyName: '',
  businessValue: '',
  damiEarned: '',
  narration: '',
};

const CROP_COLORS: Record<KachiAaratCrop, string> = {
  mustardSeed: 'bg-yellow-100 text-yellow-800',
  gram:        'bg-amber-100 text-amber-800',
  barley:      'bg-orange-100 text-orange-800',
  wheat:       'bg-lime-100 text-lime-800',
  paddy:       'bg-green-100 text-green-800',
  other:       'bg-slate-100 text-slate-800',
};

const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const KachiAaratRegister: React.FC = () => {
  const { kachiAaratEntries, addKachiAaratEntry, updateKachiAaratEntry, deleteKachiAaratEntry, society } = useData();
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';
  const canEdit = hasPermission(['admin', 'accountant']);

  const defaultFy = society.financialYearStart || new Date().toISOString().split('T')[0];
  const [fyFilter, setFyFilter] = useState<string>(defaultFy);
  const [cropFilter, setCropFilter] = useState<'all' | KachiAaratCrop>('all');
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, fyStartDate: defaultFy });

  const filtered = useMemo(() => kachiAaratEntries
    .filter(e => !e.isDeleted)
    .filter(e => !fyFilter || e.fyStartDate === fyFilter)
    .filter(e => cropFilter === 'all' || e.crop === cropFilter)
    .filter(e => !search.trim() || (e.partyName || '').toLowerCase().includes(search.toLowerCase())),
    [kachiAaratEntries, fyFilter, cropFilter, search]);

  const availableFYs = useMemo(() => {
    const set = new Set<string>();
    kachiAaratEntries.forEach(e => set.add(e.fyStartDate));
    if (defaultFy) set.add(defaultFy);
    return Array.from(set).sort().reverse();
  }, [kachiAaratEntries, defaultFy]);

  const summary = useMemo(() => {
    let business = 0, dami = 0;
    filtered.forEach(e => { business += e.businessValue || 0; dami += e.damiEarned || 0; });
    return { business, dami, count: filtered.length };
  }, [filtered]);

  const resetForm = () => setForm({ ...EMPTY_FORM, fyStartDate: fyFilter || defaultFy, date: new Date().toISOString().split('T')[0] });

  const openAdd = () => {
    resetForm(); setEditId(null); setIsAddOpen(true);
  };

  const openEdit = (e: KachiAaratEntry) => {
    setEditId(e.id);
    setForm({
      date: e.date,
      fyStartDate: e.fyStartDate,
      crop: e.crop,
      partyName: e.partyName || '',
      businessValue: String(e.businessValue || ''),
      damiEarned: String(e.damiEarned || ''),
      narration: e.narration || '',
    });
    setIsAddOpen(true);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.fyStartDate || !form.businessValue) {
      toast({ title: hi ? 'FY और व्यापार राशि आवश्यक हैं' : 'FY and business value are required', variant: 'destructive' });
      return;
    }
    const data = {
      date: form.date,
      fyStartDate: form.fyStartDate,
      crop: form.crop,
      partyName: form.partyName.trim() || undefined,
      businessValue: Number(form.businessValue) || 0,
      damiEarned: Number(form.damiEarned) || 0,
      narration: form.narration.trim() || undefined,
    };
    if (editId) {
      updateKachiAaratEntry(editId, data);
      toast({ title: hi ? 'एंट्री अपडेट हुई' : 'Entry updated' });
    } else {
      addKachiAaratEntry(data);
      toast({ title: hi ? 'एंट्री जोड़ी गई' : 'Entry added' });
    }
    setIsAddOpen(false); setEditId(null); resetForm();
  };

  const handleDelete = (e: KachiAaratEntry) => {
    if (!confirm(hi ? 'एंट्री हटाएं?' : 'Delete this entry?')) return;
    deleteKachiAaratEntry(e.id);
    toast({ title: hi ? 'हटाया गया' : 'Deleted' });
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            {hi ? 'कच्ची आढ़त रजिस्टर (Kachi Aarat)' : 'Kachi Aarat Register'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hi
              ? 'HAFED Proforma 8 — मंडी में किसान के लिए कमीशन एजेंट का विवरण'
              : 'HAFED Proforma 8 — Society acting as commission agent (Kachi Aarat) for farmers'}
          </p>
        </div>
        {canEdit && (
          <Dialog open={isAddOpen} onOpenChange={o => { if (!o) { setEditId(null); resetForm(); } setIsAddOpen(o); }}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नई एंट्री' : 'New Entry'}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editId ? (hi ? 'एंट्री संपादित' : 'Edit Entry') : (hi ? 'नई कच्ची आढ़त एंट्री' : 'New Kachi Aarat Entry')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'तिथि' : 'Date'} *</Label>
                    <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'FY प्रारंभ तिथि' : 'FY Start Date'} *</Label>
                    <Input type="date" value={form.fyStartDate} onChange={e => setForm(f => ({ ...f, fyStartDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'फसल' : 'Crop'}</Label>
                    <Select value={form.crop} onValueChange={v => setForm(f => ({ ...f, crop: v as KachiAaratCrop }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(KACHI_CROP_LABELS) as [KachiAaratCrop, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'किसान / पार्टी' : 'Farmer / Party'}</Label>
                    <Input value={form.partyName} onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'व्यापार राशि (₹)' : 'Business Value (₹)'} *</Label>
                    <Input type="number" step="0.01" min="0" value={form.businessValue} onChange={e => setForm(f => ({ ...f, businessValue: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'दामी अर्जित (₹)' : 'Dami Earned (₹)'}</Label>
                    <Input type="number" step="0.01" min="0" value={form.damiEarned} onChange={e => setForm(f => ({ ...f, damiEarned: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground">
                      {hi ? 'किसान को छूट देने से पहले' : 'Before giving rebate to farmer'}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">{hi ? 'टिप्पणी' : 'Narration'}</Label>
                    <Textarea rows={2} value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditId(null); resetForm(); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
                  <Button type="submit">{editId ? (hi ? 'अपडेट' : 'Update') : (hi ? 'सहेजें' : 'Save')}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'एंट्रियाँ' : 'Entries'}</p>
          <p className="text-lg font-bold">{summary.count}</p>
        </CardContent></Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल व्यापार' : 'Total Business Value'}</p>
          <p className="text-lg font-bold text-blue-700">{fmt(summary.business)}</p>
        </CardContent></Card>
        <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल दामी' : 'Total Dami Earned'}</p>
          <p className="text-lg font-bold text-green-700">{fmt(summary.dami)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">{hi ? 'खोजें' : 'Search party'}</Label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={hi ? 'किसान का नाम...' : 'Farmer name...'} />
            </div>
            <div>
              <Label className="text-xs">FY</Label>
              <Select value={fyFilter || '__all__'} onValueChange={v => setFyFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All FYs</SelectItem>
                  {availableFYs.map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Crop</Label>
              <Select value={cropFilter} onValueChange={v => setCropFilter(v as 'all' | KachiAaratCrop)}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Crops</SelectItem>
                  {(Object.entries(KACHI_CROP_LABELS) as [KachiAaratCrop, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{hi ? 'एंट्रियाँ' : 'Entries'} ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>{hi ? 'कोई कच्ची आढ़त एंट्री नहीं मिली' : 'No Kachi Aarat entries found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'फसल' : 'Crop'}</TableHead>
                    <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                    <TableHead className="text-right">{hi ? 'व्यापार' : 'Business'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दामी' : 'Dami'}</TableHead>
                    {canEdit && <TableHead className="w-24"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.date}</TableCell>
                      <TableCell><Badge variant="outline" className={CROP_COLORS[e.crop]}>{KACHI_CROP_LABELS[e.crop]}</Badge></TableCell>
                      <TableCell className="font-medium">{e.partyName || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(e.businessValue)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{fmt(e.damiEarned)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(e)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KachiAaratRegister;
