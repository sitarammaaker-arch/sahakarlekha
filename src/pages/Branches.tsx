/**
 * Branch master (ECR-17 multi-branch, Phase 1). Define the society's branches;
 * one is the Head Office (unbranched legacy records + "all" reports map here).
 * Vouchers are stamped with the active branch (Header selector); reports view a
 * single branch or consolidated.
 */
import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Edit2, Trash2, Home, ArrowLeftRight } from 'lucide-react';
import type { Branch } from '@/types';
import { INTER_BRANCH_CONTROL_ID } from '@/lib/interBranch';

const today = () => new Date().toISOString().split('T')[0];

const Branches: React.FC = () => {
  const { branches, addBranch, updateBranch, deleteBranch, transferBetweenBranches, getAccountBalance } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', isHeadOffice: false });

  // Inter-branch transfer (Phase 2)
  const [xferOpen, setXferOpen] = useState(false);
  const [xfer, setXfer] = useState({ from: '', to: '', amount: '', mode: 'cash' as 'cash' | 'bank', date: today() });
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const controlBalance = getAccountBalance(INTER_BRANCH_CONTROL_ID);

  const isAdmin = user?.role === 'admin';

  const openXfer = () => { setXfer({ from: branches.find(b => b.isHeadOffice)?.id || branches[0]?.id || '', to: '', amount: '', mode: 'cash', date: today() }); setXferOpen(true); };
  const doTransfer = () => {
    const amt = parseFloat(xfer.amount);
    if (!xfer.from || !xfer.to || xfer.from === xfer.to || !(amt > 0)) { toast({ title: hi ? 'From/To अलग शाखा व राशि > 0 दें' : 'Pick two different branches and an amount > 0', variant: 'destructive' }); return; }
    transferBetweenBranches({ fromBranchId: xfer.from, toBranchId: xfer.to, amount: amt, mode: xfer.mode, date: xfer.date });
    setXferOpen(false);
  };

  const openNew = () => { setEditing(null); setForm({ name: '', code: '', address: '', isHeadOffice: branches.length === 0 }); setOpen(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, code: b.code || '', address: b.address || '', isHeadOffice: !!b.isHeadOffice }); setOpen(true); };

  const save = () => {
    if (!form.name.trim()) { toast({ title: hi ? 'नाम ज़रूरी' : 'Name required', variant: 'destructive' }); return; }
    if (editing) updateBranch(editing.id, { name: form.name.trim(), code: form.code.trim(), address: form.address.trim(), isHeadOffice: form.isHeadOffice });
    else addBranch({ name: form.name.trim(), code: form.code.trim(), address: form.address.trim(), isHeadOffice: form.isHeadOffice, isActive: true });
    setOpen(false);
    toast({ title: hi ? 'शाखा सहेजी गई' : 'Branch saved' });
  };

  const remove = (b: Branch) => {
    if (b.isHeadOffice) { toast({ title: hi ? 'हेड ऑफ़िस नहीं हटा सकते' : 'Cannot delete the Head Office', variant: 'destructive' }); return; }
    if (!window.confirm(hi ? `${b.name} हटाएँ? इसकी entries "All" में दिखती रहेंगी।` : `Delete ${b.name}? Its entries stay visible under "All".`)) return;
    deleteBranch(b.id);
    toast({ title: hi ? 'शाखा हटाई गई' : 'Branch deleted' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Building2 className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{hi ? 'शाखाएँ' : 'Branches'}</h1>
            <p className="text-sm text-muted-foreground">{hi ? 'बहु-शाखा — voucher व reports शाखा-वार' : 'Multi-branch — vouchers & reports by branch'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && branches.length >= 2 && <Button variant="outline" onClick={openXfer} className="gap-2"><ArrowLeftRight className="h-4 w-4" />{hi ? 'अंतर-शाखा ट्रांसफर' : 'Inter-branch transfer'}</Button>}
          {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नई शाखा' : 'New Branch'}</Button>}
        </div>
      </div>

      {branches.length >= 2 && Math.abs(controlBalance) > 0.5 && (
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'अंतर-शाखा नियंत्रण खाता (चुनी शाखा दृश्य में)' : 'Inter-Branch Control A/c (in the active-branch view)'}</p>
          <p className="text-xl font-bold">{fmt(Math.abs(controlBalance))} <span className="text-sm font-normal">{controlBalance >= 0 ? 'Dr' : 'Cr'}</span></p>
          <p className="text-[11px] text-muted-foreground">{hi ? '"सभी शाखाएँ" पर यह ₹0 होना चाहिए (net-zero) — शाखा-वार दृश्य में उस शाखा की inter-branch स्थिति दिखती है।' : 'Under "All branches" this should be ₹0 (net-zero); a single-branch view shows that branch’s inter-branch position.'}</p>
        </CardContent></Card>
      )}

      {branches.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {hi ? 'अभी कोई शाखा नहीं। पहली शाखा (Head Office) बनाएँ — तब से नए voucher उसमें दर्ज होंगे।' : 'No branches yet. Create the first (Head Office) — new vouchers will then be stamped to it.'}
        </CardContent></Card>
      )}

      {branches.length > 0 && (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
              <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
              <TableHead>{hi ? 'पता' : 'Address'}</TableHead>
              <TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {branches.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.name}
                    {b.isHeadOffice && <Badge variant="outline" className="ml-2 gap-1 text-[10px]"><Home className="h-3 w-3" />{hi ? 'हेड ऑफ़िस' : 'Head Office'}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.code || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.address || '—'}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(b)} disabled={b.isHeadOffice}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? (hi ? 'शाखा संपादित करें' : 'Edit Branch') : (hi ? 'नई शाखा' : 'New Branch')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{hi ? 'नाम' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>{hi ? 'कोड' : 'Code'}</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. BR01" /></div>
            <div><Label>{hi ? 'पता' : 'Address'}</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isHeadOffice} onChange={e => setForm(p => ({ ...p, isHeadOffice: e.target.checked }))} className="h-4 w-4" />
              <span>{hi ? 'हेड ऑफ़िस (एक ही हो सकती है)' : 'Head Office (only one)'}</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={save}>{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inter-branch transfer dialog */}
      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'अंतर-शाखा ट्रांसफर' : 'Inter-branch transfer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'से (शाखा)' : 'From (branch)'}</Label>
                <select value={xfer.from} onChange={e => setXfer(p => ({ ...p, from: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><Label>{hi ? 'को (शाखा)' : 'To (branch)'}</Label>
                <select value={xfer.to} onChange={e => setXfer(p => ({ ...p, to: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>{branches.filter(b => b.id !== xfer.from).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1"><Label>{hi ? 'राशि' : 'Amount'}</Label><Input type="number" min={0} value={xfer.amount} onChange={e => setXfer(p => ({ ...p, amount: e.target.value }))} /></div>
              <div className="col-span-1"><Label>{hi ? 'माध्यम' : 'Mode'}</Label>
                <select value={xfer.mode} onChange={e => setXfer(p => ({ ...p, mode: e.target.value as 'cash' | 'bank' }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="cash">{hi ? 'नकद' : 'Cash'}</option><option value="bank">{hi ? 'बैंक' : 'Bank'}</option>
                </select>
              </div>
              <div className="col-span-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={xfer.date} onChange={e => setXfer(p => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{hi ? 'दो balanced vouchers बनेंगे (Inter-Branch Control A/c से) — consolidated पर net-zero।' : 'Posts two balanced vouchers via the Inter-Branch Control A/c — net-zero consolidated.'}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setXferOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={doTransfer}>{hi ? 'ट्रांसफर करें' : 'Transfer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Branches;
