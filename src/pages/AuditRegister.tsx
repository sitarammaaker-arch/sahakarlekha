import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Download, Search, Edit, Trash2, ShieldCheck, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateAuditRegisterPDF } from '@/lib/pdf';
import type { AuditObjection, ObjectionStatus, ObjectionCategory } from '@/types';

const CATEGORIES: { value: ObjectionCategory; en: string; hi: string }[] = [
  { value: 'cash', en: 'Cash', hi: 'नकद' },
  { value: 'stock', en: 'Stock', hi: 'स्टॉक' },
  { value: 'loan', en: 'Loan', hi: 'ऋण' },
  { value: 'accounts', en: 'Accounts', hi: 'लेखा' },
  { value: 'compliance', en: 'Compliance', hi: 'अनुपालन' },
  { value: 'other', en: 'Other', hi: 'अन्य' },
];

const EMPTY_FORM = {
  auditYear: new Date().getFullYear().toString(),
  paraNo: '',
  category: 'accounts' as ObjectionCategory,
  objection: '',
  amountInvolved: '',
  dueDate: '',
  actionTaken: '',
  rectifiedDate: '',
  status: 'pending' as ObjectionStatus,
  remarks: '',
};

const AuditRegister: React.FC = () => {
  const { language } = useLanguage();
  const { auditObjections, addAuditObjection, updateAuditObjection, deleteAuditObjection, society, vouchers } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editObj, setEditObj] = useState<AuditObjection | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (n: number) => n > 0 ? new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n) : '—';
  const cancelledCount = vouchers.filter(v => v.isDeleted).length;

  const filtered = auditObjections.filter(o => {
    const matchSearch = o.objection.toLowerCase().includes(search.toLowerCase()) || o.paraNo.toLowerCase().includes(search.toLowerCase()) || o.objectionNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = auditObjections.filter(o => o.status === 'pending').length;
  const partialCount = auditObjections.filter(o => o.status === 'partial').length;
  const rectifiedCount = auditObjections.filter(o => o.status === 'rectified').length;
  const totalAmount = auditObjections.reduce((s, o) => s + o.amountInvolved, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.paraNo || !form.objection || !form.auditYear) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    addAuditObjection({
      auditYear: form.auditYear,
      paraNo: form.paraNo,
      category: form.category,
      objection: form.objection,
      amountInvolved: Number(form.amountInvolved) || 0,
      dueDate: form.dueDate,
      actionTaken: form.actionTaken,
      rectifiedDate: form.rectifiedDate,
      status: form.status,
      remarks: form.remarks,
    });
    toast({ title: hi ? 'आपत्ति जोड़ी गई' : 'Objection added' });
    setForm(EMPTY_FORM);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editObj) return;
    updateAuditObjection(editObj.id, {
      auditYear: form.auditYear,
      paraNo: form.paraNo,
      category: form.category,
      objection: form.objection,
      amountInvolved: Number(form.amountInvolved) || 0,
      dueDate: form.dueDate,
      actionTaken: form.actionTaken,
      rectifiedDate: form.rectifiedDate,
      status: form.status,
      remarks: form.remarks,
    });
    toast({ title: hi ? 'अपडेट किया गया' : 'Updated' });
    setEditObj(null);
  };

  const openEdit = (o: AuditObjection) => {
    setEditObj(o);
    setForm({
      auditYear: o.auditYear,
      paraNo: o.paraNo,
      category: o.category,
      objection: o.objection,
      amountInvolved: String(o.amountInvolved || ''),
      dueDate: o.dueDate,
      actionTaken: o.actionTaken,
      rectifiedDate: o.rectifiedDate,
      status: o.status,
      remarks: o.remarks,
    });
  };

  const statusBadge = (s: ObjectionStatus) => {
    if (s === 'rectified') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1"><CheckCircle2 className="h-3 w-3" />{hi ? 'निराकृत' : 'Rectified'}</Badge>;
    if (s === 'partial') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 gap-1"><Clock className="h-3 w-3" />{hi ? 'आंशिक' : 'Partial'}</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 gap-1"><XCircle className="h-3 w-3" />{hi ? 'लंबित' : 'Pending'}</Badge>;
  };

  const catLabel = (c: ObjectionCategory) => CATEGORIES.find(x => x.value === c)?.[hi ? 'hi' : 'en'] || c;

  const ObjectionForm = ({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{hi ? 'लेखा परीक्षा वर्ष *' : 'Audit Year *'}</Label>
          <Input value={form.auditYear} onChange={e => setForm(f => ({ ...f, auditYear: e.target.value }))} placeholder="2023-24" />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'पैरा सं. *' : 'Para No. *'}</Label>
          <Input value={form.paraNo} onChange={e => setForm(f => ({ ...f, paraNo: e.target.value }))} placeholder="1, 2a, 3(ii)" />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'श्रेणी' : 'Category'}</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ObjectionCategory }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{hi ? c.hi : c.en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'राशि (₹)' : 'Amount Involved (₹)'}</Label>
          <Input type="number" min="0" value={form.amountInvolved} onChange={e => setForm(f => ({ ...f, amountInvolved: e.target.value }))} placeholder="0" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>{hi ? 'आपत्ति विवरण *' : 'Objection Details *'}</Label>
          <Textarea rows={3} value={form.objection} onChange={e => setForm(f => ({ ...f, objection: e.target.value }))} placeholder={hi ? 'आपत्ति का विवरण...' : 'Describe the audit objection...'} />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'सुधार की अंतिम तिथि' : 'Rectification Due Date'}</Label>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'स्थिति' : 'Status'}</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ObjectionStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{hi ? 'लंबित' : 'Pending'}</SelectItem>
              <SelectItem value="partial">{hi ? 'आंशिक' : 'Partial'}</SelectItem>
              <SelectItem value="rectified">{hi ? 'निराकृत' : 'Rectified'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label>{hi ? 'की गई कार्रवाई' : 'Action Taken'}</Label>
          <Textarea rows={2} value={form.actionTaken} onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))} placeholder={hi ? 'सुधारात्मक कार्रवाई का विवरण...' : 'Describe corrective action taken...'} />
        </div>
        {form.status === 'rectified' && (
          <div className="space-y-1">
            <Label>{hi ? 'सुधार तिथि' : 'Rectified Date'}</Label>
            <Input type="date" value={form.rectifiedDate} onChange={e => setForm(f => ({ ...f, rectifiedDate: e.target.value }))} />
          </div>
        )}
        <div className={`space-y-1 ${form.status === 'rectified' ? '' : 'col-span-2'}`}>
          <Label>{hi ? 'टिप्पणी' : 'Remarks'}</Label>
          <Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder={hi ? 'अतिरिक्त टिप्पणी...' : 'Additional remarks...'} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditObj(null); }}>{hi ? 'रद्द' : 'Cancel'}</Button>
        <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            {hi ? 'ऑडिट सुधार रजिस्टर' : 'Audit Rectification Register'}
          </h1>
          <p className="text-muted-foreground">{hi ? 'लेखा परीक्षा आपत्तियां एवं सुधार विवरण' : 'Audit objections & rectification record'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateAuditRegisterPDF(auditObjections, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setForm(EMPTY_FORM); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4" />{hi ? 'नई आपत्ति' : 'Add Objection'}
          </Button>
        </div>
      </div>

      {/* Cancelled Vouchers Alert */}
      {cancelledCount > 0 && (
        <Card className="bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {hi
                ? `${cancelledCount} रद्द वाउचर ऑडिट रिकॉर्ड में हैं। इन्हें वाउचर पृष्ठ पर देखा जा सकता है।`
                : `${cancelledCount} cancelled voucher(s) are in the audit trail. View them on the Vouchers page.`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'लंबित' : 'Pending'}</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'आंशिक' : 'Partial'}</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{partialCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'निराकृत' : 'Rectified'}</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{rectifiedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल राशि' : 'Total Amount'}</p>
            <p className="text-lg font-bold text-primary">{fmt(totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={hi ? 'खोजें...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
            <SelectItem value="pending">{hi ? 'लंबित' : 'Pending'}</SelectItem>
            <SelectItem value="partial">{hi ? 'आंशिक' : 'Partial'}</SelectItem>
            <SelectItem value="rectified">{hi ? 'निराकृत' : 'Rectified'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'सं.' : 'No.'}</TableHead>
                <TableHead>{hi ? 'वर्ष' : 'Year'}</TableHead>
                <TableHead>{hi ? 'पैरा' : 'Para'}</TableHead>
                <TableHead>{hi ? 'श्रेणी' : 'Category'}</TableHead>
                <TableHead className="max-w-[200px]">{hi ? 'आपत्ति' : 'Objection'}</TableHead>
                <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                <TableHead>{hi ? 'की गई कार्रवाई' : 'Action Taken'}</TableHead>
                <TableHead>{hi ? 'देय तिथि' : 'Due Date'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई आपत्ति नहीं मिली' : 'No objections found'}
                    {auditObjections.length === 0 && (
                      <p className="text-xs mt-1 text-green-600">{hi ? 'शून्य आपत्ति — उत्कृष्ट ऑडिट रिकॉर्ड!' : 'Zero objections — excellent audit record!'}</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(o => (
                  <TableRow key={o.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{o.objectionNo}</TableCell>
                    <TableCell className="text-sm">{o.auditYear}</TableCell>
                    <TableCell className="font-semibold">{o.paraNo}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{catLabel(o.category)}</Badge></TableCell>
                    <TableCell className="max-w-[200px] text-sm">
                      <div className="line-clamp-2">{o.objection}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(o.amountInvolved)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px]">
                      <div className="line-clamp-2">{o.actionTaken || '—'}</div>
                    </TableCell>
                    <TableCell className="text-sm">{o.dueDate || '—'}</TableCell>
                    <TableCell>{statusBadge(o.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'नई ऑडिट आपत्ति' : 'Add Audit Objection'}</DialogTitle>
          </DialogHeader>
          <ObjectionForm onSubmit={handleAdd} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editObj} onOpenChange={open => !open && setEditObj(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'आपत्ति संपादित करें' : 'Edit Objection'} — {editObj?.objectionNo}</DialogTitle>
          </DialogHeader>
          <ObjectionForm onSubmit={handleEdit} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'आपत्ति हटाएं?' : 'Delete objection?'}</AlertDialogTitle>
            <AlertDialogDescription>{hi ? 'यह कार्य वापस नहीं किया जा सकता।' : 'This action cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { if (deleteId) { deleteAuditObjection(deleteId); setDeleteId(null); toast({ title: hi ? 'हटाई गई' : 'Deleted' }); } }}>
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuditRegister;
