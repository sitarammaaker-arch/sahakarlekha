import { useState } from 'react';
import { useLabourData } from '@/contexts/LabourDataContext';
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
import { HardHat, Pencil, Trash2 } from 'lucide-react';
import type { Worker, WorkerType, WorkerCategory } from '@/types';

const TYPES: { id: WorkerType; en: string; hi: string }[] = [
  { id: 'member', en: 'Member', hi: 'सदस्य' },
  { id: 'non_member', en: 'Non-member', hi: 'गैर-सदस्य' },
  { id: 'contract', en: 'Contract', hi: 'ठेका' },
];
const CATEGORIES: { id: WorkerCategory; en: string; hi: string }[] = [
  { id: 'skilled', en: 'Skilled', hi: 'कुशल' },
  { id: 'semi_skilled', en: 'Semi-skilled', hi: 'अर्ध-कुशल' },
  { id: 'unskilled', en: 'Unskilled', hi: 'अकुशल' },
  { id: 'operator', en: 'Operator', hi: 'ऑपरेटर' },
  { id: 'helper', en: 'Helper', hi: 'सहायक' },
  { id: 'supervisor', en: 'Supervisor', hi: 'पर्यवेक्षक' },
];

export default function WorkerMaster() {
  const { workers, addWorker, updateWorker, deleteWorker } = useLabourData();
  const { members } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const typeLabel = (id: WorkerType) => { const t = TYPES.find(x => x.id === id); return t ? (hi ? t.hi : t.en) : id; };
  const catLabel = (id: WorkerCategory) => { const c = CATEGORIES.find(x => x.id === id); return c ? (hi ? c.hi : c.en) : id; };

  const blank = { name: '', workerType: 'member' as WorkerType, memberId: '', category: 'unskilled' as WorkerCategory, phone: '', defaultDailyWage: '', workerCode: '' };
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eForm, setEForm] = useState(blank);
  const eset = (k: keyof typeof form, v: string) => setEForm(f => ({ ...f, [k]: v }));

  const activeWorkers = workers.filter(w => !w.isDeleted);

  const save = () => {
    if (!form.name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    const code = form.workerCode.trim() || `W-${String(activeWorkers.length + 1).padStart(4, '0')}`;
    const w = addWorker({
      workerCode: code,
      name: form.name.trim(),
      workerType: form.workerType,
      memberId: form.workerType === 'member' && form.memberId ? form.memberId : undefined,
      category: form.category,
      phone: form.phone.trim() || undefined,
      defaultDailyWage: form.defaultDailyWage ? Number(form.defaultDailyWage) : undefined,
      status: 'active',
    });
    if (w.id) { toast({ title: hi ? 'श्रमिक जोड़ा गया' : 'Worker added', description: `${w.workerCode} · ${w.name}` }); setForm(blank); }
  };

  const openEdit = (w: Worker) => {
    setEditId(w.id);
    setEForm({ name: w.name, workerType: w.workerType, memberId: w.memberId || '', category: w.category, phone: w.phone || '', defaultDailyWage: w.defaultDailyWage != null ? String(w.defaultDailyWage) : '', workerCode: w.workerCode });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!eForm.name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    updateWorker(editId, {
      workerCode: eForm.workerCode.trim() || undefined,
      name: eForm.name.trim(),
      workerType: eForm.workerType,
      memberId: eForm.workerType === 'member' && eForm.memberId ? eForm.memberId : undefined,
      category: eForm.category,
      phone: eForm.phone.trim() || undefined,
      defaultDailyWage: eForm.defaultDailyWage ? Number(eForm.defaultDailyWage) : undefined,
    });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const remove = (w: Worker) => {
    if (!window.confirm(hi ? `श्रमिक ${w.name} हटाएँ?` : `Delete worker ${w.name}?`)) return;
    deleteWorker(w.id);
    toast({ title: hi ? 'श्रमिक हटाया गया' : 'Worker deleted' });
  };

  const memberName = (id?: string) => members.find(m => m.id === id)?.name;

  const formFields = (f: typeof form, s: typeof set) => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{hi ? 'श्रमिक कोड' : 'Worker Code'}</Label>
          <Input value={f.workerCode} onChange={e => s('workerCode', e.target.value)} placeholder={hi ? 'वैकल्पिक (खाली तो स्वतः)' : 'optional (auto if blank)'} />
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'नाम' : 'Name'} *</Label>
          <Input value={f.name} onChange={e => s('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'प्रकार' : 'Type'}</Label>
          <Select value={f.workerType} onValueChange={v => s('workerType', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {f.workerType === 'member' && (
          <div className="space-y-2">
            <Label>{hi ? 'सदस्य' : 'Member'}</Label>
            <Select value={f.memberId || undefined} onValueChange={v => s('memberId', v)}>
              <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
              <SelectContent>{members.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>{hi ? 'श्रेणी' : 'Category'}</Label>
          <Select value={f.category} onValueChange={v => s('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{hi ? c.hi : c.en}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'फ़ोन' : 'Phone'}</Label>
          <Input value={f.phone} onChange={e => s('phone', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'दैनिक मज़दूरी दर (₹)' : 'Default daily wage (₹)'}</Label>
          <Input type="number" min={0} value={f.defaultDailyWage} onChange={e => s('defaultDailyWage', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
        </div>
      </div>
    </>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <HardHat className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'श्रमिक मास्टर' : 'Worker Master'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति के श्रमिक (सदस्य/गैर-सदस्य/ठेका) दर्ज करें — मस्टर रोल व मज़दूरी की नींव' : 'Record the society’s workers (member/non-member/contract) — basis for muster roll & wages'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया श्रमिक' : 'New Worker'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {formFields(form, set)}
          <Button onClick={save} className="w-full">{hi ? 'श्रमिक सेव करें' : 'Save Worker'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? 'दर्ज श्रमिक' : 'Workers'} ({activeWorkers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeWorkers.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई श्रमिक नहीं।' : 'No workers yet.'}</p>}
          {activeWorkers.map(w => (
            <div key={w.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {w.workerCode} · {w.name}
                  <Badge variant="secondary">{typeLabel(w.workerType)}</Badge>
                  <Badge variant="outline">{catLabel(w.category)}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {w.workerType === 'member' && memberName(w.memberId) ? `${hi ? 'सदस्य' : 'Member'}: ${memberName(w.memberId)} · ` : ''}
                  {w.phone ? `${w.phone} · ` : ''}
                  {w.defaultDailyWage != null ? `${hi ? 'दर' : 'rate'} ${money(w.defaultDailyWage)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{hi ? 'श्रमिक संपादित करें' : 'Edit Worker'}</DialogTitle></DialogHeader>
          {formFields(eForm, eset)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveEdit}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
