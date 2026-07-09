/**
 * Godowns (ECR-17 Phase 3) — godown master + godown-wise stock report.
 * Define godowns (optionally under a branch); the Header godown selector stamps
 * new stock movements. The report shows on-hand qty + value per (item × godown).
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Warehouse, Plus, Edit2, Trash2, Package } from 'lucide-react';
import type { Godown } from '@/types';
import { computeGodownStock, godownTotals, UNASSIGNED_GODOWN } from '@/lib/godownStock';

const Godowns: React.FC = () => {
  const { godowns, addGodown, updateGodown, deleteGodown, branches, stockMovements, stockItems } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const isAdmin = user?.role === 'admin';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Godown | null>(null);
  const [form, setForm] = useState({ name: '', code: '', branchId: '', address: '' });

  const openNew = () => { setEditing(null); setForm({ name: '', code: '', branchId: branches.find(b => b.isHeadOffice)?.id || '', address: '' }); setOpen(true); };
  const openEdit = (g: Godown) => { setEditing(g); setForm({ name: g.name, code: g.code || '', branchId: g.branchId || '', address: g.address || '' }); setOpen(true); };
  const save = () => {
    if (!form.name.trim()) { toast({ title: hi ? 'नाम ज़रूरी' : 'Name required', variant: 'destructive' }); return; }
    const data = { name: form.name.trim(), code: form.code.trim(), branchId: form.branchId || undefined, address: form.address.trim() };
    if (editing) updateGodown(editing.id, data); else addGodown({ ...data, isActive: true });
    setOpen(false); toast({ title: hi ? 'गोदाम सहेजा गया' : 'Godown saved' });
  };
  const remove = (g: Godown) => { if (window.confirm(hi ? `${g.name} हटाएँ?` : `Delete ${g.name}?`)) { deleteGodown(g.id); toast({ title: hi ? 'गोदाम हटाया गया' : 'Godown deleted' }); } };

  const nameOfGodown = (id: string) => id === UNASSIGNED_GODOWN ? (hi ? 'बिना गोदाम' : 'Unassigned') : (godowns.find(g => g.id === id)?.name || id);
  const nameOfItem = (id: string) => stockItems.find(s => s.id === id)?.name || id;

  const stock = useMemo(() => computeGodownStock(stockMovements as unknown as Parameters<typeof computeGodownStock>[0]), [stockMovements]);
  const totals = useMemo(() => godownTotals(stock), [stock]);
  const byGodown = useMemo(() => {
    const map = new Map<string, typeof stock>();
    for (const r of stock) { const arr = map.get(r.godownId) || []; arr.push(r); map.set(r.godownId, arr); }
    return [...map.entries()];
  }, [stock]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Warehouse className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{hi ? 'गोदाम' : 'Godowns'}</h1>
            <p className="text-sm text-muted-foreground">{hi ? 'गोदाम-वार स्टॉक (Header में सक्रिय गोदाम चुनें)' : 'Godown-wise stock (pick the active godown in the Header)'}</p>
          </div>
        </div>
        {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नया गोदाम' : 'New Godown'}</Button>}
      </div>

      {/* Godown master */}
      {godowns.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {hi ? 'कोई गोदाम नहीं। पहला गोदाम बनाएँ — फिर Header में उसे चुनकर खरीद/बिक्री उसी में दर्ज होगी।' : 'No godowns yet. Create one, then select it in the Header so purchases/sales are stamped to it.'}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{hi ? 'नाम' : 'Name'}</TableHead><TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
              <TableHead>{hi ? 'शाखा' : 'Branch'}</TableHead><TableHead className="text-right">{hi ? 'स्टॉक मूल्य' : 'Stock Value'}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {godowns.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.code || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{branches.find(b => b.id === g.branchId)?.name || '—'}</TableCell>
                  <TableCell className="text-right">{fmt(totals[g.id] || 0)}</TableCell>
                  <TableCell>{isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {/* Godown-wise stock report */}
      {stock.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{hi ? 'गोदाम-वार स्टॉक' : 'Godown-wise Stock'}</h2>
          {byGodown.map(([godownId, rows]) => (
            <Card key={godownId}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">
                <span>{nameOfGodown(godownId)}</span>
                <span className="text-sm font-normal text-muted-foreground">{fmt(totals[godownId] || 0)}</span>
              </CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                    <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="text-right">{hi ? 'मूल्य' : 'Value'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.itemId}>
                        <TableCell>{nameOfItem(r.itemId)}</TableCell>
                        <TableCell className="text-right">{r.qty}</TableCell>
                        <TableCell className="text-right">{fmt(r.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? (hi ? 'गोदाम संपादित करें' : 'Edit Godown') : (hi ? 'नया गोदाम' : 'New Godown')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{hi ? 'नाम' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'कोड' : 'Code'}</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
              <div><Label>{hi ? 'शाखा' : 'Branch'}</Label>
                <select value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">—</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div><Label>{hi ? 'पता' : 'Address'}</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
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

export default Godowns;
