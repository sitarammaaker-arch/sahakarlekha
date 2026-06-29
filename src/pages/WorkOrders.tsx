import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
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
import { ClipboardList, Pencil, Trash2 } from 'lucide-react';
import type { WorkOrder } from '@/types';

const STATUSES = [
  { id: 'open', en: 'Open', hi: 'चालू' },
  { id: 'completed', en: 'Completed', hi: 'पूर्ण' },
  { id: 'closed', en: 'Closed', hi: 'बंद' },
];

export default function WorkOrders() {
  const { workOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder } = useData();
  const { departments } = useLabourData();
  // Show any non-inactive department (matches Department Master, which lists all !isDeleted).
  // A freshly created department whose status is unset/anything-but-'inactive' must still appear.
  const activeDepts = departments.filter(d => !d.isDeleted && d.status !== 'inactive');
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const statusLabel = (id: string) => { const s = STATUSES.find(x => x.id === id) || STATUSES[0]; return hi ? s.hi : s.en; };

  // Create form
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [clientName, setClientName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'open' | 'completed' | 'closed'>('open');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eWoNo, setEWoNo] = useState('');
  const [eClient, setEClient] = useState('');
  const [eDeptId, setEDeptId] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eValue, setEValue] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eStatus, setEStatus] = useState<'open' | 'completed' | 'closed'>('open');

  const resetForm = () => { setWorkOrderNo(''); setClientName(''); setDepartmentId(''); setDescription(''); setContractValue(''); setStartDate(''); setEndDate(''); setStatus('open'); };

  const save = () => {
    const v = Number(contractValue);
    // When departments exist, the client is the selected department; else fall back to free text.
    const dept = activeDepts.find(d => d.id === departmentId);
    const resolvedClient = dept ? dept.name : clientName.trim();
    if (!resolvedClient) { toast({ title: hi ? 'क्लाइंट/विभाग चुनें' : 'Select a client/department', variant: 'destructive' }); return; }
    if (!(v >= 0)) { toast({ title: hi ? 'ठेका मूल्य दर्ज करें' : 'Enter a valid contract value', variant: 'destructive' }); return; }
    const woNo = workOrderNo.trim() || `WO-${String(workOrders.filter(w => !w.isDeleted).length + 1).padStart(4, '0')}`;
    const wo = addWorkOrder({
      workOrderNo: woNo,
      clientName: resolvedClient,
      departmentId: dept ? dept.id : undefined,
      description: description.trim() || undefined,
      contractValue: v,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
    });
    if (wo.id) { toast({ title: hi ? 'कार्य आदेश जोड़ा गया' : 'Work order added', description: `${wo.workOrderNo} · ${wo.clientName}` }); resetForm(); }
  };

  const openEdit = (w: WorkOrder) => {
    setEditId(w.id); setEWoNo(w.workOrderNo); setEClient(w.clientName); setEDeptId(w.departmentId || ''); setEDesc(w.description || '');
    setEValue(String(w.contractValue)); setEStart(w.startDate || ''); setEEnd(w.endDate || ''); setEStatus(w.status);
    setEditOpen(true);
  };

  const saveEdit = () => {
    const v = Number(eValue);
    const dept = activeDepts.find(d => d.id === eDeptId);
    const resolvedClient = dept ? dept.name : eClient.trim();
    if (!resolvedClient) { toast({ title: hi ? 'क्लाइंट/विभाग चुनें' : 'Select a client/department', variant: 'destructive' }); return; }
    if (!(v >= 0)) { toast({ title: hi ? 'मूल्य दर्ज करें' : 'Enter a valid value', variant: 'destructive' }); return; }
    updateWorkOrder(editId, {
      workOrderNo: eWoNo.trim() || undefined, clientName: resolvedClient, departmentId: dept ? dept.id : undefined,
      description: eDesc.trim() || undefined,
      contractValue: v, startDate: eStart || undefined, endDate: eEnd || undefined, status: eStatus,
    });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const remove = (w: WorkOrder) => {
    if (!window.confirm(hi ? `कार्य आदेश ${w.workOrderNo} हटाएँ?` : `Delete work order ${w.workOrderNo}?`)) return;
    deleteWorkOrder(w.id);
    toast({ title: hi ? 'कार्य आदेश हटाया गया' : 'Work order deleted' });
  };

  const orders = workOrders.filter(w => !w.isDeleted);
  const totalValue = orders.reduce((s, w) => s + (w.contractValue || 0), 0);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'कार्य आदेश / श्रम ठेका' : 'Work Orders'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'समिति के कार्य आदेश/ठेके दर्ज करें (मस्टर रोल व मज़दूरी की नींव)' : 'Record the society’s work orders/contracts (basis for muster roll & wages)'}</p>
        </div>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया कार्य आदेश' : 'New Work Order'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'कार्य आदेश संख्या' : 'Work Order No'}</Label>
              <Input value={workOrderNo} onChange={e => setWorkOrderNo(e.target.value)} placeholder={hi ? 'वैकल्पिक (खाली तो स्वतः)' : 'optional (auto if blank)'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'क्लाइंट / विभाग' : 'Client / Department'} *</Label>
              {activeDepts.length > 0 ? (
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'विभाग चुनें' : 'Select department'} /></SelectTrigger>
                  <SelectContent>{activeDepts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder={hi ? 'विभाग/नियोक्ता मास्टर में जोड़ें' : 'add in Department/Employer master'} />
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'कार्य विवरण' : 'Work Description'}</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'ठेका मूल्य (₹)' : 'Contract Value (₹)'} *</Label>
              <Input type="number" min={0} value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'स्थिति' : 'Status'}</Label>
              <Select value={status} onValueChange={v => setStatus(v as 'open' | 'completed' | 'closed')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{hi ? s.hi : s.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'आरंभ तिथि' : 'Start Date'}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'समाप्ति तिथि' : 'End Date'}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'कार्य आदेश सेव करें' : 'Save Work Order'}</Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'दर्ज कार्य आदेश' : 'Work Orders'} ({orders.length})</span>
            {orders.length > 0 && <span className="text-sm font-normal text-muted-foreground">{hi ? 'कुल ठेका मूल्य' : 'Total value'}: {money(totalValue)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी तक कोई कार्य आदेश नहीं।' : 'No work orders yet.'}</p>}
          {orders.map(w => (
            <div key={w.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{w.workOrderNo} · {w.clientName} <Badge variant={w.status === 'open' ? 'default' : w.status === 'completed' ? 'secondary' : 'outline'}>{statusLabel(w.status)}</Badge></div>
                <div className="text-muted-foreground">{w.description ? `${w.description} · ` : ''}{money(w.contractValue)}{w.startDate ? ` · ${w.startDate}${w.endDate ? ` → ${w.endDate}` : ''}` : ''}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'कार्य आदेश संपादित करें' : 'Edit Work Order'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'आदेश संख्या' : 'Order No'}</Label><Input value={eWoNo} onChange={e => setEWoNo(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'ठेका मूल्य (₹)' : 'Value (₹)'} *</Label><Input type="number" min={0} value={eValue} onChange={e => setEValue(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'क्लाइंट / विभाग' : 'Client / Department'} *</Label>
              {activeDepts.length > 0 ? (
                <Select value={eDeptId || undefined} onValueChange={setEDeptId}>
                  <SelectTrigger><SelectValue placeholder={eClient || (hi ? 'विभाग चुनें' : 'Select department')} /></SelectTrigger>
                  <SelectContent>
                    {eClient && !eDeptId && <SelectItem value="__legacy" disabled>{eClient}</SelectItem>}
                    {activeDepts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={eClient} onChange={e => setEClient(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5"><Label>{hi ? 'कार्य विवरण' : 'Description'}</Label><Input value={eDesc} onChange={e => setEDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'आरंभ' : 'Start'}</Label><Input type="date" value={eStart} onChange={e => setEStart(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'समाप्ति' : 'End'}</Label><Input type="date" value={eEnd} onChange={e => setEEnd(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'स्थिति' : 'Status'}</Label>
              <Select value={eStatus} onValueChange={v => setEStatus(v as 'open' | 'completed' | 'closed')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{hi ? s.hi : s.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
