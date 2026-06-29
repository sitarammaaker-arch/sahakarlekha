import { useState } from 'react';
import { useLabourData } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Landmark, Pencil, Trash2 } from 'lucide-react';
import type { Department, DepartmentType } from '@/types';

const TYPES: { id: DepartmentType; en: string; hi: string }[] = [
  { id: 'govt_department', en: 'Govt Department', hi: 'सरकारी विभाग' },
  { id: 'principal_employer', en: 'Principal Employer', hi: 'मुख्य नियोक्ता' },
  { id: 'private_client', en: 'Private Client', hi: 'निजी क्लाइंट' },
];

export default function DepartmentMaster() {
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useLabourData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const typeLabel = (id: DepartmentType) => { const t = TYPES.find(x => x.id === id); return t ? (hi ? t.hi : t.en) : id; };

  const blank = { name: '', departmentType: 'govt_department' as DepartmentType, contactPerson: '', phone: '', address: '', gstin: '', tdsApplicable: 'yes', openingBalance: '' };
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eForm, setEForm] = useState(blank);
  const eset = (k: keyof typeof form, v: string) => setEForm(f => ({ ...f, [k]: v }));

  const active = departments.filter(d => !d.isDeleted);

  const buildPayload = (f: typeof form) => ({
    name: f.name.trim(),
    departmentType: f.departmentType,
    contactPerson: f.contactPerson.trim() || undefined,
    phone: f.phone.trim() || undefined,
    address: f.address.trim() || undefined,
    gstin: f.gstin.trim() || undefined,
    tdsApplicable: f.tdsApplicable === 'yes',
    openingBalance: f.openingBalance ? Number(f.openingBalance) : undefined,
    status: 'active' as const,
  });

  const save = () => {
    if (!form.name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    const d = addDepartment(buildPayload(form));
    if (d.id) { toast({ title: hi ? 'विभाग जोड़ा गया' : 'Department added', description: `${d.departmentCode} · ${d.name}` }); setForm(blank); }
  };

  const openEdit = (d: Department) => {
    setEditId(d.id);
    setEForm({ name: d.name, departmentType: d.departmentType, contactPerson: d.contactPerson || '', phone: d.phone || '', address: d.address || '', gstin: d.gstin || '', tdsApplicable: d.tdsApplicable ? 'yes' : 'no', openingBalance: d.openingBalance != null ? String(d.openingBalance) : '' });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!eForm.name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    const { openingBalance, ...rest } = buildPayload(eForm);   // opening balance is fixed at creation
    void openingBalance;
    updateDepartment(editId, rest);
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const remove = (d: Department) => {
    if (!window.confirm(hi ? `विभाग ${d.name} हटाएँ?` : `Delete department ${d.name}?`)) return;
    deleteDepartment(d.id);
    toast({ title: hi ? 'विभाग हटाया गया' : 'Department deleted' });
  };

  const fields = (f: typeof form, s: typeof set, isNew: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2 sm:col-span-2">
        <Label>{hi ? 'विभाग / नियोक्ता का नाम' : 'Department / Employer name'} *</Label>
        <Input value={f.name} onChange={e => s('name', e.target.value)} placeholder={hi ? 'जैसे PWD, नगर पालिका' : 'e.g. PWD, Municipality'} />
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'प्रकार' : 'Type'}</Label>
        <Select value={f.departmentType} onValueChange={v => s('departmentType', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map(t => <SelectItem key={t.id} value={t.id}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'TDS कटौती करता है?' : 'Deducts TDS?'}</Label>
        <Select value={f.tdsApplicable} onValueChange={v => s('tdsApplicable', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">{hi ? 'हाँ' : 'Yes'}</SelectItem>
            <SelectItem value="no">{hi ? 'नहीं' : 'No'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'संपर्क व्यक्ति' : 'Contact person'}</Label>
        <Input value={f.contactPerson} onChange={e => s('contactPerson', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'फ़ोन' : 'Phone'}</Label>
        <Input value={f.phone} onChange={e => s('phone', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
      </div>
      <div className="space-y-2">
        <Label>GSTIN</Label>
        <Input value={f.gstin} onChange={e => s('gstin', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'आरंभिक बकाया (₹)' : 'Opening balance (₹)'}</Label>
        <Input type="number" value={f.openingBalance} onChange={e => s('openingBalance', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} disabled={!isNew} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>{hi ? 'पता' : 'Address'}</Label>
        <Input value={f.address} onChange={e => s('address', e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'विभाग / नियोक्ता' : 'Department / Employer'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'कार्य आदेश देने वाले विभाग/नियोक्ता दर्ज करें — हर एक का प्राप्य खाता बनेगा (बिलिंग की नींव)' : 'Record departments/employers that award work orders — each gets a receivable ledger (basis for billing)'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया विभाग / नियोक्ता' : 'New Department / Employer'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields(form, set, true)}
          <Button onClick={save} className="w-full">{hi ? 'सेव करें' : 'Save'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'दर्ज विभाग / नियोक्ता' : 'Departments / Employers'} ({active.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {active.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई दर्ज नहीं।' : 'None yet.'}</p>}
          {active.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {d.departmentCode} · {d.name}
                  <Badge variant="secondary">{typeLabel(d.departmentType)}</Badge>
                  {d.tdsApplicable && <Badge variant="outline">TDS</Badge>}
                </div>
                <div className="text-muted-foreground">
                  {d.contactPerson ? `${d.contactPerson} · ` : ''}{d.phone ? `${d.phone} · ` : ''}{d.gstin ? `GSTIN ${d.gstin}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{hi ? 'विभाग / नियोक्ता संपादित करें' : 'Edit Department / Employer'}</DialogTitle></DialogHeader>
          {fields(eForm, eset, false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveEdit}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
