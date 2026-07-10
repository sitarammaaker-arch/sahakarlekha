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
import EntityExportButton from '@/components/export/EntityExportButton';

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
  const { workers, addWorker, updateWorker, deleteWorker, workerAdvances } = useLabourData();
  const { members, musterEntries } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const typeLabel = (id: WorkerType) => { const t = TYPES.find(x => x.id === id); return t ? (hi ? t.hi : t.en) : id; };
  const catLabel = (id: WorkerCategory) => { const c = CATEGORIES.find(x => x.id === id); return c ? (hi ? c.hi : c.en) : id; };

  const blank = {
    name: '', workerType: 'member' as WorkerType, memberId: '', category: 'unskilled' as WorkerCategory, phone: '', defaultDailyWage: '', workerCode: '',
    // Statutory / payout (all optional)
    uan: '', esiIp: '', pan: '', aadhaar: '', bankAccountNo: '', ifsc: '', dateOfBirth: '', gender: '', fatherHusbandName: '', joiningDate: '', permanentAddress: '',
  };
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  // The optional statutory/payout fields, normalised (empty → undefined) for save.
  const statutoryPayload = (f: typeof blank) => ({
    uan: f.uan.trim() || undefined,
    esiIp: f.esiIp.trim() || undefined,
    pan: f.pan.trim().toUpperCase() || undefined,
    aadhaar: f.aadhaar.trim() || undefined,
    bankAccountNo: f.bankAccountNo.trim() || undefined,
    ifsc: f.ifsc.trim().toUpperCase() || undefined,
    dateOfBirth: f.dateOfBirth || undefined,
    gender: (f.gender || undefined) as Worker['gender'],
    fatherHusbandName: f.fatherHusbandName.trim() || undefined,
    joiningDate: f.joiningDate || undefined,
    permanentAddress: f.permanentAddress.trim() || undefined,
  });

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
      ...statutoryPayload(form),
      status: 'active',
    });
    if (w.id) { toast({ title: hi ? 'श्रमिक जोड़ा गया' : 'Worker added', description: `${w.workerCode} · ${w.name}` }); setForm(blank); }
  };

  const openEdit = (w: Worker) => {
    setEditId(w.id);
    setEForm({
      name: w.name, workerType: w.workerType, memberId: w.memberId || '', category: w.category, phone: w.phone || '',
      defaultDailyWage: w.defaultDailyWage != null ? String(w.defaultDailyWage) : '', workerCode: w.workerCode,
      uan: w.uan || '', esiIp: w.esiIp || '', pan: w.pan || '', aadhaar: w.aadhaar || '', bankAccountNo: w.bankAccountNo || '', ifsc: w.ifsc || '',
      dateOfBirth: w.dateOfBirth || '', gender: w.gender || '', fatherHusbandName: w.fatherHusbandName || '', joiningDate: w.joiningDate || '', permanentAddress: w.permanentAddress || '',
    });
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
      ...statutoryPayload(eForm),
    });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const remove = (w: Worker) => {
    // RULE-3: block deletion while live dependents exist (their wage-accrual / advance
    // vouchers would otherwise dangle on the books with no owning worker).
    const hasMuster = musterEntries.some(m => !m.isDeleted && m.memberId === w.id);
    const openAdv = workerAdvances.some(a => !a.isDeleted && a.workerId === w.id && a.status !== 'cleared');
    if (hasMuster || openAdv) {
      toast({
        title: hi ? 'श्रमिक हटाया नहीं जा सकता' : 'Cannot delete worker',
        description: hasMuster
          ? (hi ? 'इस श्रमिक की मस्टर/मज़दूरी प्रविष्टियाँ हैं। पहले वे हटाएँ।' : 'This worker has muster/wage entries. Remove them first.')
          : (hi ? 'इस श्रमिक का बकाया अग्रिम है। पहले वसूली पूरी करें।' : 'This worker has an outstanding advance. Recover it first.'),
        variant: 'destructive', duration: 9000,
      });
      return;
    }
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

      {/* Statutory & payout details — CLRA Form XIII / EPF / ESI / NEFT. All optional. */}
      <details className="mt-4 rounded-lg border bg-muted/20">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          {hi ? 'सांविधिक एवं भुगतान विवरण (EPF/ESI/बैंक) — वैकल्पिक' : 'Statutory & payout details (EPF/ESI/bank) — optional'}
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 pt-1">
          <div className="space-y-2">
            <Label>UAN <span className="text-muted-foreground">({hi ? 'EPF' : 'EPF'})</span></Label>
            <Input value={f.uan} onChange={e => s('uan', e.target.value)} placeholder={hi ? '12 अंक' : '12 digits'} inputMode="numeric" maxLength={12} />
          </div>
          <div className="space-y-2">
            <Label>ESI IP {hi ? 'नंबर' : 'No.'}</Label>
            <Input value={f.esiIp} onChange={e => s('esiIp', e.target.value)} placeholder={hi ? 'बीमा संख्या' : 'insurance no.'} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'पिता / पति का नाम' : 'Father / Husband name'}</Label>
            <Input value={f.fatherHusbandName} onChange={e => s('fatherHusbandName', e.target.value)} placeholder={hi ? 'CLRA Form XIII' : 'CLRA Form XIII'} />
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'लिंग' : 'Gender'}</Label>
            <Select value={f.gender || undefined} onValueChange={v => s('gender', v)}>
              <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{hi ? 'पुरुष' : 'Male'}</SelectItem>
                <SelectItem value="female">{hi ? 'महिला' : 'Female'}</SelectItem>
                <SelectItem value="other">{hi ? 'अन्य' : 'Other'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'जन्म तिथि' : 'Date of birth'}</Label>
            <Input type="date" value={f.dateOfBirth} onChange={e => s('dateOfBirth', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'कार्य-ग्रहण तिथि' : 'Date of joining'}</Label>
            <Input type="date" value={f.joiningDate} onChange={e => s('joiningDate', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'आधार' : 'Aadhaar'}</Label>
            <Input value={f.aadhaar} onChange={e => s('aadhaar', e.target.value)} placeholder={hi ? '12 अंक' : '12 digits'} inputMode="numeric" maxLength={12} />
          </div>
          <div className="space-y-2">
            <Label>PAN</Label>
            <Input value={f.pan} onChange={e => s('pan', e.target.value)} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'बैंक खाता संख्या' : 'Bank account no.'}</Label>
            <Input value={f.bankAccountNo} onChange={e => s('bankAccountNo', e.target.value)} placeholder={hi ? 'NEFT भुगतान हेतु' : 'for NEFT payout'} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label>IFSC</Label>
            <Input value={f.ifsc} onChange={e => s('ifsc', e.target.value)} placeholder="SBIN0001234" maxLength={11} className="uppercase" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{hi ? 'स्थायी पता' : 'Permanent address'}</Label>
            <Input value={f.permanentAddress} onChange={e => s('permanentAddress', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
          </div>
        </div>
      </details>
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
        {/* T-19: this register had no export at all (audit gap EXP-10). The
            Export Registry decides whether it renders, which columns leave, and whether
            the audit row was written before any bytes did. */}
        <div className="ml-auto">
          <EntityExportButton entityKey="worker" />
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
                {(w.uan || w.esiIp || w.bankAccountNo || w.aadhaar) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {w.uan ? `UAN ${w.uan} · ` : ''}
                    {w.esiIp ? `ESI ${w.esiIp} · ` : ''}
                    {w.aadhaar ? `${hi ? 'आधार' : 'Aadhaar'} ••••${w.aadhaar.slice(-4)} · ` : ''}
                    {w.bankAccountNo ? `${hi ? 'बैंक' : 'Bank'} ${w.ifsc ? `${w.ifsc}/` : ''}${w.bankAccountNo}` : ''}
                  </div>
                )}
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
