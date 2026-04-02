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
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import type { EntityLink } from '@/types';
import { UserCheck, Plus, Pencil, Trash2, Search, IndianRupee, FileSpreadsheet, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/types';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const EMPTY_FORM = (): Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'> => ({
  name: '',
  nameHi: '',
  address: '',
  phone: '',
  gstNo: '',
  isActive: true,
});

const Customers: React.FC = () => {
  const { language } = useLanguage();
  const { customers, addCustomer, updateCustomer, deleteCustomer, getAccountBalance, getEntityLinks } = useData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [deleteGuard, setDeleteGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });

  const filtered = useMemo(() =>
    customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    ), [customers, search]);

  const handleCSV = () => {
    const headers = ['Customer Code', 'Name', 'Phone', 'GST No', 'Address', 'Status'];
    const rows = filtered.map(c => [c.customerCode || '', c.name, c.phone || '', c.gstNo || '', c.address || '', c.isActive ? 'Active' : 'Inactive']);
    downloadCSV(headers, rows, 'customers.csv');
  };
  const handleExcel = () => {
    const headers = ['Customer Code', 'Name', 'Phone', 'GST No', 'Address', 'Status'];
    const rows = filtered.map(c => [c.customerCode || '', c.name, c.phone || '', c.gstNo || '', c.address || '', c.isActive ? 'Active' : 'Inactive']);
    downloadExcelSingle(headers, rows, 'customers.xlsx', 'Customers');
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM()); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ name: c.name, nameHi: c.nameHi || '', address: c.address || '', phone: c.phone || '', gstNo: c.gstNo || '', isActive: c.isActive });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: language === 'hi' ? 'नाम आवश्यक है' : 'Name is required', variant: 'destructive' });
      return;
    }
    // Prevent duplicate customer names
    const nameNorm = form.name.trim().toLowerCase();
    const duplicate = customers.find(c => c.name.toLowerCase() === nameNorm && c.id !== editId);
    if (duplicate) {
      toast({ title: language === 'hi' ? 'यह ग्राहक पहले से मौजूद है' : 'Customer with this name already exists', variant: 'destructive' });
      return;
    }
    if (editId) {
      updateCustomer(editId, form);
      toast({ title: language === 'hi' ? 'ग्राहक अपडेट हुआ' : 'Customer updated' });
    } else {
      addCustomer(form);
      toast({ title: language === 'hi' ? 'ग्राहक जोड़ा गया' : 'Customer added' });
    }
    setShowForm(false);
  };

  const handleDeleteClick = (c: { id: string; name: string; customerCode?: string }) => {
    const links = getEntityLinks('customer', c.id);
    setDeleteGuard({ open: true, id: c.id, name: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ''}`, links });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCheck className="h-7 w-7 text-primary" />
            {language === 'hi' ? 'ग्राहक मास्टर' : 'Customer Master'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'पंजीकृत ग्राहक प्रबंधन' : 'Manage registered customers'}
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
            {language === 'hi' ? 'नया ग्राहक' : 'New Customer'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल ग्राहक' : 'Total Customers'}</p>
            <p className="text-2xl font-bold text-primary">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'सक्रिय' : 'Active'}</p>
            <p className="text-2xl font-bold text-success">{customers.filter(c => c.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल प्राप्य (उधार)' : 'Total Receivable'}</p>
            <p className="text-2xl font-bold text-success">
              {fmt(customers.reduce((sum, c) => sum + getAccountBalance(c.accountId), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'hi' ? 'नाम या फोन से खोजें…' : 'Search by name or phone…'}
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
                  <TableHead>{language === 'hi' ? 'पता' : 'Address'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'प्राप्य शेष' : 'Outstanding'}</TableHead>
                  <TableHead>{language === 'hi' ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'कार्य' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      {language === 'hi' ? 'कोई ग्राहक नहीं मिला' : 'No customers found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(c => {
                    const outstanding = getAccountBalance(c.accountId);
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-muted-foreground">{c.customerCode}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.address || '—'}</TableCell>
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
                          <Badge variant="outline" className={c.isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
                            {c.isActive ? (language === 'hi' ? 'सक्रिय' : 'Active') : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(c)}>
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
                ? (language === 'hi' ? 'ग्राहक संपादित करें' : 'Edit Customer')
                : (language === 'hi' ? 'नया ग्राहक जोड़ें' : 'Add New Customer')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'नाम (English) *' : 'Name (English) *'}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" />
              </div>
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
                <Input value={form.nameHi || ''} onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))} placeholder="ग्राहक का नाम" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'पता' : 'Address'}</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={language === 'hi' ? 'पता' : 'Address'} />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'फोन' : 'Phone'}</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9XXXXXXXXX" />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'GST नंबर' : 'GST No.'}</Label>
              <Input value={(form as any).gstNo || ''} onChange={e => setForm(f => ({ ...f, gstNo: e.target.value }))} placeholder="29XXXXX0000X1Z5" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="cus-active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="cus-active">{language === 'hi' ? 'सक्रिय' : 'Active'}</Label>
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

      {/* Delete Guard */}
      <LinkedDeleteDialog
        open={deleteGuard.open}
        onOpenChange={o => setDeleteGuard(g => ({ ...g, open: o }))}
        entityName={deleteGuard.name}
        links={deleteGuard.links}
        language={language as 'hi' | 'en'}
        onConfirmDelete={() => {
          if (deleteGuard.id) {
            deleteCustomer(deleteGuard.id);
            toast({ title: language === 'hi' ? 'ग्राहक हटाया गया' : 'Customer deleted' });
          }
        }}
      />
    </div>
  );
};

export default Customers;
