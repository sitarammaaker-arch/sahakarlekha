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
import { Building2, Plus, Edit2, Trash2, Home } from 'lucide-react';
import type { Branch } from '@/types';

const Branches: React.FC = () => {
  const { branches, addBranch, updateBranch, deleteBranch } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', isHeadOffice: false });

  const isAdmin = user?.role === 'admin';

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
        {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नई शाखा' : 'New Branch'}</Button>}
      </div>

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
    </div>
  );
};

export default Branches;
