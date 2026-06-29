import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Pencil, Trash2 } from 'lucide-react';
import type { MusterEntry } from '@/types';

const thisMonth = '2026-06'; // safe default; user can change. (No Date.now in module scope.)

export default function MusterRoll() {
  const { workOrders, members, musterEntries, addMusterEntry, updateMusterEntry, deleteMusterEntry } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const openOrders = workOrders.filter(w => !w.isDeleted);
  const memberName = (id: string) => members.find(m => m.id === id)?.name || (hi ? 'अज्ञात सदस्य' : 'Unknown member');
  const orderLabel = (id: string) => { const w = openOrders.find(o => o.id === id); return w ? `${w.workOrderNo} · ${w.clientName}` : (hi ? 'अज्ञात कार्य आदेश' : 'Unknown order'); };

  // Filters / context for the muster sheet
  const [workOrderId, setWorkOrderId] = useState(openOrders[0]?.id || '');
  const [period, setPeriod] = useState(thisMonth);

  // Add-row form
  const [memberId, setMemberId] = useState('');
  const [daysWorked, setDaysWorked] = useState('');
  const [dailyWage, setDailyWage] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [eMember, setEMember] = useState('');
  const [eDays, setEDays] = useState('');
  const [eWage, setEWage] = useState('');

  const rows = useMemo(
    () => musterEntries.filter(m => !m.isDeleted && m.workOrderId === workOrderId && m.period === period),
    [musterEntries, workOrderId, period],
  );
  const totalWage = rows.reduce((s, r) => s + (r.daysWorked || 0) * (r.dailyWage || 0), 0);
  const totalDays = rows.reduce((s, r) => s + (r.daysWorked || 0), 0);

  const addRow = () => {
    if (!workOrderId) { toast({ title: hi ? 'पहले कार्य आदेश चुनें' : 'Select a work order first', variant: 'destructive' }); return; }
    if (!memberId) { toast({ title: hi ? 'सदस्य चुनें' : 'Select a member', variant: 'destructive' }); return; }
    if (rows.some(r => r.memberId === memberId)) { toast({ title: hi ? 'इस सदस्य की हाज़िरी पहले से दर्ज है' : 'This member is already recorded for this sheet', variant: 'destructive' }); return; }
    const d = Number(daysWorked); const w = Number(dailyWage);
    if (!(d > 0)) { toast({ title: hi ? 'काम किए दिन दर्ज करें' : 'Enter days worked', variant: 'destructive' }); return; }
    if (!(w >= 0)) { toast({ title: hi ? 'दैनिक मज़दूरी दर्ज करें' : 'Enter daily wage', variant: 'destructive' }); return; }
    const entry = addMusterEntry({ workOrderId, period, memberId, daysWorked: d, dailyWage: w });
    if (entry.id) { toast({ title: hi ? 'हाज़िरी जोड़ी गई' : 'Attendance added', description: `${memberName(memberId)} · ${d} ${hi ? 'दिन' : 'days'}` }); setMemberId(''); setDaysWorked(''); setDailyWage(''); }
  };

  const openEdit = (m: MusterEntry) => { setEditId(m.id); setEMember(m.memberId); setEDays(String(m.daysWorked)); setEWage(String(m.dailyWage)); setEditOpen(true); };

  const saveEdit = () => {
    const d = Number(eDays); const w = Number(eWage);
    if (!(d > 0)) { toast({ title: hi ? 'दिन दर्ज करें' : 'Enter days', variant: 'destructive' }); return; }
    if (!(w >= 0)) { toast({ title: hi ? 'मज़दूरी दर्ज करें' : 'Enter wage', variant: 'destructive' }); return; }
    updateMusterEntry(editId, { memberId: eMember, daysWorked: d, dailyWage: w });
    toast({ title: hi ? 'अपडेट हुआ' : 'Updated' });
    setEditOpen(false);
  };

  const remove = (m: MusterEntry) => {
    if (!window.confirm(hi ? `${memberName(m.memberId)} की हाज़िरी हटाएँ?` : `Delete attendance for ${memberName(m.memberId)}?`)) return;
    deleteMusterEntry(m.id);
    toast({ title: hi ? 'हाज़िरी हटाई गई' : 'Attendance deleted' });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <UserCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'मस्टर रोल / हाज़िरी' : 'Muster Roll'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'कार्य आदेश व महीने के अनुसार श्रमिक हाज़िरी व मज़दूरी-आधार दर्ज करें' : 'Record labourer attendance & wage basis by work order and month'}</p>
        </div>
      </div>

      {openOrders.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          {hi ? 'पहले कोई कार्य आदेश बनाएँ — मस्टर रोल कार्य आदेश के विरुद्ध दर्ज होता है।' : 'Create a work order first — the muster roll is recorded against a work order.'}
        </CardContent></Card>
      )}

      {/* Sheet context */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'मस्टर शीट' : 'Muster Sheet'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'कार्य आदेश' : 'Work Order'}</Label>
              <Select value={workOrderId} onValueChange={setWorkOrderId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{openOrders.map(w => <SelectItem key={w.id} value={w.id}>{w.workOrderNo} · {w.clientName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'महीना' : 'Month'}</Label>
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </div>
          </div>

          {/* Add-row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-t pt-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'सदस्य (श्रमिक)' : 'Member (labourer)'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'दिन' : 'Days'}</Label>
              <Input type="number" min={0} value={daysWorked} onChange={e => setDaysWorked(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'दैनिक मज़दूरी (₹)' : 'Daily wage (₹)'}</Label>
              <Input type="number" min={0} value={dailyWage} onChange={e => setDailyWage(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={addRow} className="w-full" disabled={openOrders.length === 0}>{hi ? 'हाज़िरी जोड़ें' : 'Add Attendance'}</Button>
        </CardContent>
      </Card>

      {/* Sheet rows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'हाज़िरी' : 'Attendance'} — {workOrderId ? orderLabel(workOrderId) : '—'} · {period}</span>
            {rows.length > 0 && <span className="text-sm font-normal text-muted-foreground">{rows.length} {hi ? 'श्रमिक' : 'labourers'} · {totalDays} {hi ? 'दिन' : 'days'} · {hi ? 'कुल मज़दूरी' : 'total wages'} {money(totalWage)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'इस शीट में अभी कोई हाज़िरी नहीं।' : 'No attendance recorded in this sheet yet.'}</p>}
          {rows.map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium">{memberName(m.memberId)}</div>
                <div className="text-muted-foreground">{m.daysWorked} {hi ? 'दिन' : 'days'} × {money(m.dailyWage)} = <span className="font-medium text-foreground">{money((m.daysWorked || 0) * (m.dailyWage || 0))}</span></div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">{hi ? 'नोट: यह मज़दूरी-आधार रजिस्टर है। वास्तविक भुगतान (लेखांकन) अगली Wage Payment सुविधा से होगा।' : 'Note: this is the wage-basis register. Actual payment (accounting) comes in the next Wage Payment feature.'}</p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'हाज़िरी संपादित करें' : 'Edit Attendance'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={eMember} onValueChange={setEMember}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{members.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'दिन' : 'Days'}</Label><Input type="number" min={0} value={eDays} onChange={e => setEDays(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'दैनिक मज़दूरी (₹)' : 'Daily wage (₹)'}</Label><Input type="number" min={0} value={eWage} onChange={e => setEWage(e.target.value)} /></div>
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
