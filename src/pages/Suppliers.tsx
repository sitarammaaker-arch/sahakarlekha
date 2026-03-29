import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Truck, Plus, Pencil, Trash2, Search, IndianRupee, FileSpreadsheet, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/types';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const EMPTY_FORM = (): Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'> => ({
  name: '',
  address: '',
  gstNo: '',
  phone: '',
  isActive: true,
});

const Suppliers: React.FC = () => {
  const { language } = useLanguage();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, getAccountBalance } = useData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    suppliers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search) ||
      (s.gstNo || '').toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search]);

  const handleCSV = () => {
    const headers = ['Supplier Code', 'Name', 'Phone', 'GST No', 'Status'];
    const rows = filtered.map(s => [s.supplierCode || '', s.name, s.phone || '', s.gstNo || '', s.isActive ? 'Active' : 'Inactive']);
    downloadCSV(headers, rows, 'suppliers.csv');
  };
  const handleExcel = () => {
    const headers = ['Supplier Code', 'Name', 'Phone', 'GST No', 'Status'];
    const rows = filtered.map(s => [s.supplierCode || '', s.name, s.phone || '', s.gstNo || '', s.isActive ? 'Active' : 'Inactive']);
    downloadExcelSingle(headers, rows, 'suppliers.xlsx', 'Suppliers');
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM()); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, address: s.address || '', gstNo: s.gstNo || '', phone: s.phone || '', isActive: s.isActive });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: language === 'hi' ? 'नाम आवश्यक है' : 'Name is required', variant: 'destructive' });
      return;
    }
    if (editId) {
      updateSupplier(editId, form);
      toast({ title: language === 'hi' ? 'आपूर्तिकर्ता अपडेट हुआ' : 'Supplier updated' });
    } else {
      addSupplier(form);
      toast({ title: language === 'hi' ? 'आपूर्तिकर्ता जोड़ा गया' : 'Supplier added' });
    }
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSupplier(deleteId);
    setDeleteId(null);
    toast({ title: language === 'hi' ? 'आपूर्तिकर्ता हटाया गया' : 'Supplier deleted' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            {language === 'hi' ? 'आपूर्तिकर्ता मास्टर' : 'Supplier Master'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'पंजीकृत आपूर्तिकर्ता प्रबंधन' : 'Manage registered suppliers'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {language === 'hi' ? 'नया आपूर्तिकर्ता' : 'New Supplier'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल आपूर्तिकर्ता' : 'Total Suppliers'}</p>
            <p className="text-2xl font-bold text-primary">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'सक्रिय' : 'Active'}</p>
            <p className="text-2xl font-bold text-success">{suppliers.filter(s => s.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल देय (उधार)' : 'Total Payable'}</p>
            <p className="text-2xl font-bold text-destructive">
              {fmt(suppliers.reduce((sum, s) => sum + getAccountBalance(s.accountId), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'hi' ? 'नाम, फोन या GST से खोजें…' : 'Search by name, phone or GST…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{language === 'hi' ? 'कोड' : 'Code'}</TableHead>
                  <TableHead>{language === 'hi' ? 'नाम' : 'Name'}</TableHead>
                  <TableHead>{language === 'hi' ? 'फोन' : 'Phone'}</TableHead>
                  <TableHead>{language === 'hi' ? 'GST नं.' : 'GST No.'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'देय शेष' : 'Outstanding'}</TableHead>
                  <TableHead>{language === 'hi' ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'कार्य' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      {language === 'hi' ? 'कोई आपूर्तिकर्ता नहीं मिला' : 'No suppliers found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(s => {
                    const outstanding = getAccountBalance(s.accountId);
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-muted-foreground">{s.supplierCode}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.phone || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{s.gstNo || '—'}</TableCell>
                        <TableCell className="text-right">
                          {outstanding !== 0 ? (
                            <span className="font-semibold flex items-center justify-end gap-1">
                              <IndianRupee className="h-3 w-3" />
                              {Math.abs(outstanding).toLocaleString('hi-IN')}
                              <span className="text-xs text-muted-foreground ml-1">
                                {outstanding > 0 ? '(Dr)' : '(Cr)'}
                              </span>
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={s.isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
                            {s.isActive ? (language === 'hi' ? 'सक्रिय' : 'Active') : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (language === 'hi' ? 'आपूर्तिकर्ता संपादित करें' : 'Edit Supplier')
                : (language === 'hi' ? 'नया आपूर्तिकर्ता जोड़ें' : 'Add New Supplier')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'नाम *' : 'Name *'}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={language === 'hi' ? 'आपूर्तिकर्ता का नाम' : 'Supplier name'} />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'पता' : 'Address'}</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={language === 'hi' ? 'पता' : 'Address'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'फोन' : 'Phone'}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9XXXXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label>GST {language === 'hi' ? 'नं.' : 'No.'}</Label>
                <Input value={form.gstNo} onChange={e => setForm(f => ({ ...f, gstNo: e.target.value }))} placeholder="07XXXXX..." className="uppercase" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="sup-active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="sup-active">{language === 'hi' ? 'सक्रिय' : 'Active'}</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {language === 'hi' ? 'सहेजें' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'hi' ? 'आपूर्तिकर्ता हटाएं?' : 'Delete Supplier?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'hi'
                ? 'यह आपूर्तिकर्ता और उनका खाता स्थायी रूप से हट जाएगा।'
                : 'This supplier and their linked ledger account will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'hi' ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Suppliers;
