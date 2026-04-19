/**
 * Recoverables Register — for HAFED Proforma 2 (Recoverable Position).
 *
 * CRUD UI for individual recoverable cases. Each case tracks:
 *  - Party, Category (fert/advance/embezzlement/other)
 *  - Opening / Additions / Recoveries (for the selected FY)
 *  - Legal Stage (police/arbitration/execution/award/confirmed/unconfirmed)
 *  - Narration
 *
 * P2 totals auto-aggregate on the Annual Review page.
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
import type { Recoverable, RecoverableCategory, RecoverableLegalStage } from '@/types';
import { RECOVERABLE_CATEGORY_LABELS, RECOVERABLE_STAGE_LABELS } from '@/lib/annualReview/p2Calculator';

const EMPTY_FORM = {
  partyName: '',
  category: 'fertPesticide' as RecoverableCategory,
  legalStage: 'none' as RecoverableLegalStage,
  openingBalance: '',
  additions: '',
  recoveries: '',
  fyStartDate: '',
  narration: '',
};

const CATEGORY_COLORS: Record<RecoverableCategory, string> = {
  fertPesticide: 'bg-blue-100 text-blue-700 border-blue-200',
  advance:       'bg-amber-100 text-amber-700 border-amber-200',
  embezzlement:  'bg-red-100 text-red-700 border-red-200',
  other:         'bg-gray-100 text-gray-700 border-gray-200',
};

const STAGE_COLORS: Record<RecoverableLegalStage, string> = {
  none:        'bg-slate-100 text-slate-700',
  police:      'bg-red-100 text-red-700',
  arbitration: 'bg-purple-100 text-purple-700',
  execution:   'bg-orange-100 text-orange-700',
  award:       'bg-indigo-100 text-indigo-700',
  confirmed:   'bg-green-100 text-green-700',
  unconfirmed: 'bg-yellow-100 text-yellow-700',
};

const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const RecoverablesRegister: React.FC = () => {
  const { recoverables, addRecoverable, updateRecoverable, deleteRecoverable, society } = useData();
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';
  const canEdit = hasPermission(['admin', 'accountant']);

  const defaultFyStart = society.financialYearStart || new Date().toISOString().split('T')[0];

  const [fyFilter, setFyFilter] = useState<string>(defaultFyStart);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RecoverableCategory>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, fyStartDate: defaultFyStart });

  const filteredRecoverables = useMemo(() => {
    return recoverables
      .filter(r => !r.isDeleted)
      .filter(r => !fyFilter || r.fyStartDate === fyFilter)
      .filter(r => categoryFilter === 'all' || r.category === categoryFilter)
      .filter(r => !search.trim() || r.partyName.toLowerCase().includes(search.toLowerCase()));
  }, [recoverables, fyFilter, categoryFilter, search]);

  // Distinct FY start dates across all recoverables (plus society default)
  const availableFYs = useMemo(() => {
    const set = new Set<string>();
    recoverables.forEach(r => set.add(r.fyStartDate));
    if (defaultFyStart) set.add(defaultFyStart);
    return Array.from(set).sort().reverse();
  }, [recoverables, defaultFyStart]);

  // ── Summary cards ──
  const summary = useMemo(() => {
    let opening = 0, additions = 0, recoveries = 0;
    filteredRecoverables.forEach(r => {
      opening += r.openingBalance || 0;
      additions += r.additions || 0;
      recoveries += r.recoveries || 0;
    });
    return { opening, additions, recoveries, closing: opening + additions - recoveries };
  }, [filteredRecoverables]);

  const resetForm = () => setForm({ ...EMPTY_FORM, fyStartDate: fyFilter || defaultFyStart });

  const openAdd = () => {
    resetForm();
    setEditId(null);
    setIsAddOpen(true);
  };

  const openEdit = (r: Recoverable) => {
    setEditId(r.id);
    setForm({
      partyName: r.partyName,
      category: r.category,
      legalStage: r.legalStage,
      openingBalance: String(r.openingBalance || ''),
      additions: String(r.additions || ''),
      recoveries: String(r.recoveries || ''),
      fyStartDate: r.fyStartDate,
      narration: r.narration || '',
    });
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partyName.trim() || !form.fyStartDate) {
      toast({ title: hi ? 'पार्टी का नाम और FY आवश्यक है' : 'Party name and FY start date required', variant: 'destructive' });
      return;
    }
    const data = {
      partyName: form.partyName.trim(),
      category: form.category,
      legalStage: form.legalStage,
      openingBalance: Number(form.openingBalance) || 0,
      additions: Number(form.additions) || 0,
      recoveries: Number(form.recoveries) || 0,
      fyStartDate: form.fyStartDate,
      narration: form.narration.trim() || undefined,
    };
    if (editId) {
      updateRecoverable(editId, data);
      toast({ title: hi ? 'केस अपडेट हुआ' : 'Case updated' });
    } else {
      addRecoverable(data);
      toast({ title: hi ? 'केस जोड़ा गया' : 'Case added' });
    }
    setIsAddOpen(false);
    setEditId(null);
    resetForm();
  };

  const handleDelete = (r: Recoverable) => {
    if (!confirm(hi ? `"${r.partyName}" का रिकॉर्ड हटाएं?` : `Delete recoverable for "${r.partyName}"?`)) return;
    deleteRecoverable(r.id);
    toast({ title: hi ? 'हटाया गया' : 'Deleted' });
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            {hi ? 'वसूली योग्य रजिस्टर (Recoverables)' : 'Recoverables Register'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hi
              ? 'HAFED Proforma 2 — बकाया राशि एवं कानूनी स्थिति ट्रैकिंग'
              : 'HAFED Proforma 2 — Outstanding amounts & legal-stage tracking'}
          </p>
        </div>
        {canEdit && (
          <Dialog open={isAddOpen} onOpenChange={o => { if (!o) { setEditId(null); resetForm(); } setIsAddOpen(o); }}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नया केस' : 'New Case'}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editId ? (hi ? 'केस संपादित करें' : 'Edit Case') : (hi ? 'नया वसूली केस' : 'New Recoverable Case')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">{hi ? 'पार्टी का नाम' : 'Party Name'} *</Label>
                    <Input value={form.partyName} onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'श्रेणी' : 'Category'}</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as RecoverableCategory }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(RECOVERABLE_CATEGORY_LABELS) as [RecoverableCategory, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'कानूनी स्थिति' : 'Legal Stage'}</Label>
                    <Select value={form.legalStage} onValueChange={v => setForm(f => ({ ...f, legalStage: v as RecoverableLegalStage }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(RECOVERABLE_STAGE_LABELS) as [RecoverableLegalStage, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'FY प्रारंभ तिथि' : 'FY Start Date'} *</Label>
                    <Input type="date" value={form.fyStartDate} onChange={e => setForm(f => ({ ...f, fyStartDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'प्रारंभिक बकाया (₹)' : 'Opening Balance (₹)'}</Label>
                    <Input type="number" step="0.01" min="0" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'साल में जोड़ा गया (₹)' : 'Additions during FY (₹)'}</Label>
                    <Input type="number" step="0.01" min="0" value={form.additions} onChange={e => setForm(f => ({ ...f, additions: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'साल में वसूली (₹)' : 'Recoveries during FY (₹)'}</Label>
                    <Input type="number" step="0.01" min="0" value={form.recoveries} onChange={e => setForm(f => ({ ...f, recoveries: e.target.value }))} />
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'प्रारंभिक बकाया' : 'Opening'}</p>
          <p className="text-lg font-bold text-blue-700">{fmt(summary.opening)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'साल में जोड़ा' : 'Additions'}</p>
          <p className="text-lg font-bold text-amber-700">{fmt(summary.additions)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'वसूली' : 'Recoveries'}</p>
          <p className="text-lg font-bold text-green-700">{fmt(summary.recoveries)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{hi ? 'अंतिम बकाया' : 'Closing Balance'}</p>
          <p className="text-lg font-bold text-red-700">{fmt(summary.closing)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">{hi ? 'खोजें' : 'Search party'}</Label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={hi ? 'पार्टी का नाम...' : 'Party name...'} />
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
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as 'all' | RecoverableCategory)}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(Object.entries(RECOVERABLE_CATEGORY_LABELS) as [RecoverableCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{hi ? 'केस सूची' : 'Recoverable Cases'} ({filteredRecoverables.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRecoverables.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>{hi ? 'कोई वसूली केस नहीं मिला' : 'No recoverable cases found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                    <TableHead>{hi ? 'श्रेणी' : 'Category'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Legal Stage'}</TableHead>
                    <TableHead className="text-right">{hi ? 'प्रारंभिक' : 'Opening'}</TableHead>
                    <TableHead className="text-right">{hi ? 'जोड़ा' : 'Added'}</TableHead>
                    <TableHead className="text-right">{hi ? 'वसूली' : 'Recovered'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                    {canEdit && <TableHead className="w-24"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecoverables.map(r => {
                    const bal = (r.openingBalance || 0) + (r.additions || 0) - (r.recoveries || 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.partyName}</TableCell>
                        <TableCell><Badge variant="outline" className={CATEGORY_COLORS[r.category]}>{RECOVERABLE_CATEGORY_LABELS[r.category]}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={STAGE_COLORS[r.legalStage]}>{RECOVERABLE_STAGE_LABELS[r.legalStage]}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(r.openingBalance || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(r.additions || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(r.recoveries || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{fmt(bal)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecoverablesRegister;
