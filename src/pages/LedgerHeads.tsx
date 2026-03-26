import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ListTree, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { LedgerAccount } from '@/types';

type AccountType = LedgerAccount['type'];

const EMPTY_FORM = {
  name: '',
  nameHi: '',
  type: 'asset' as AccountType,
  openingBalance: '',
  openingBalanceType: 'debit' as 'debit' | 'credit',
};

const TYPE_OPTIONS: { value: AccountType; label: string; labelHi: string }[] = [
  { value: 'asset', label: 'Asset', labelHi: 'संपत्ति' },
  { value: 'liability', label: 'Liability', labelHi: 'दायित्व' },
  { value: 'income', label: 'Income', labelHi: 'आय' },
  { value: 'expense', label: 'Expense', labelHi: 'व्यय' },
];

const TYPE_BADGE_CLASS: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-700 border-blue-200',
  liability: 'bg-orange-100 text-orange-700 border-orange-200',
  income: 'bg-green-100 text-green-700 border-green-200',
  expense: 'bg-red-100 text-red-700 border-red-200',
};

const LedgerHeads: React.FC = () => {
  const { language } = useLanguage();
  const { accounts, addAccount, updateAccount, deleteAccount } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AccountType>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<LedgerAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const fmtBalance = (amount: number, type: 'debit' | 'credit') =>
    `${fmt(amount)} ${type === 'debit' ? (hi ? 'ना.' : 'Dr') : (hi ? 'ज.' : 'Cr')}`;

  const filtered = accounts.filter(acc => {
    const matchSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      (acc.nameHi && acc.nameHi.includes(search));
    const matchType = typeFilter === 'all' || acc.type === typeFilter;
    return matchSearch && matchType;
  });

  // Summary counts
  const totalCount = accounts.length;
  const assetCount = accounts.filter(a => a.type === 'asset').length;
  const liabilityCount = accounts.filter(a => a.type === 'liability').length;
  const incomeExpenseCount = accounts.filter(a => a.type === 'income' || a.type === 'expense').length;

  const resetForm = () => setForm(EMPTY_FORM);

  const openAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEdit = (acc: LedgerAccount) => {
    setEditAccount(acc);
    setForm({
      name: acc.name,
      nameHi: acc.nameHi || '',
      type: acc.type,
      openingBalance: String(acc.openingBalance ?? ''),
      openingBalanceType: acc.openingBalanceType ?? 'debit',
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.type) {
      toast({
        title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields',
        variant: 'destructive',
      });
      return;
    }
    addAccount({
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      type: form.type,
      openingBalance: Number(form.openingBalance) || 0,
      openingBalanceType: form.openingBalanceType,
    });
    toast({ title: hi ? 'खाता जोड़ा गया' : 'Account added successfully' });
    resetForm();
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccount) return;
    if (!form.name.trim()) {
      toast({
        title: hi ? 'नाम आवश्यक है' : 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    updateAccount(editAccount.id, {
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      type: form.type,
      openingBalance: Number(form.openingBalance) || 0,
      openingBalanceType: form.openingBalanceType,
    });
    toast({ title: hi ? 'खाता अपडेट किया गया' : 'Account updated successfully' });
    setEditAccount(null);
    resetForm();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const acc = accounts.find(a => a.id === deleteId);
    if (acc?.isSystem) {
      toast({
        title: hi ? 'सिस्टम खाता हटाया नहीं जा सकता' : 'Cannot delete system account',
        variant: 'destructive',
      });
      setDeleteId(null);
      return;
    }
    deleteAccount(deleteId);
    toast({ title: hi ? 'खाता हटाया गया' : 'Account deleted' });
    setDeleteId(null);
  };

  const getTypeLabel = (type: AccountType) => {
    const opt = TYPE_OPTIONS.find(o => o.value === type);
    return opt ? (hi ? opt.labelHi : opt.label) : type;
  };

  const AccountForm = ({
    onSubmit,
    submitLabel,
    onCancel,
  }: {
    onSubmit: (e: React.FormEvent) => void;
    submitLabel: string;
    onCancel: () => void;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            {hi ? 'नाम (अंग्रेजी)' : 'Name (English)'} <span className="text-destructive">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Cash in Hand"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
          <Input
            value={form.nameHi}
            onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))}
            placeholder="जैसे नकद"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>
          {hi ? 'खाता प्रकार' : 'Account Type'} <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.type}
          onValueChange={val => setForm(f => ({ ...f, type: val as AccountType }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {hi ? opt.labelHi : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{hi ? 'प्रारंभिक शेष' : 'Opening Balance'} (₹)</Label>
          <Input
            type="number"
            min="0"
            value={form.openingBalance}
            onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>{hi ? 'शेष प्रकार' : 'Balance Type'}</Label>
          <Select
            value={form.openingBalanceType}
            onValueChange={val =>
              setForm(f => ({ ...f, openingBalanceType: val as 'debit' | 'credit' }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">{hi ? 'नाम (Dr)' : 'Debit (Dr)'}</SelectItem>
              <SelectItem value="credit">{hi ? 'जमा (Cr)' : 'Credit (Cr)'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          {hi ? 'रद्द करें' : 'Cancel'}
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListTree className="h-7 w-7 text-accent" />
            {hi ? 'खाता शीर्ष प्रबंधन' : 'Ledger Head Management'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hi ? 'लेखा खातों का प्रबंधन करें' : 'Manage ledger accounts / खाता शीर्ष प्रबंधन'}
          </p>
        </div>
        <Button className="gap-2 w-fit" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {hi ? 'नया खाता' : 'Add New'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <ListTree className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'कुल खाते' : 'Total Accounts'}</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ListTree className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'संपत्ति' : 'Assets'}</p>
                <p className="text-2xl font-bold text-blue-700">{assetCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <ListTree className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'दायित्व' : 'Liabilities'}</p>
                <p className="text-2xl font-bold text-orange-700">{liabilityCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <ListTree className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'आय + व्यय' : 'Income + Expense'}</p>
                <p className="text-2xl font-bold text-green-700">{incomeExpenseCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={hi ? 'नाम से खोजें...' : 'Search by name...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={val => setTypeFilter(val as 'all' | AccountType)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={hi ? 'प्रकार चुनें' : 'Filter by type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{hi ? 'सभी प्रकार' : 'All Types'}</SelectItem>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {hi ? opt.labelHi : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {hi ? 'खाता शीर्ष सूची' : 'Ledger Accounts List'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length} {hi ? 'खाते' : 'accounts'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {hi ? 'कोई डेटा नहीं' : 'No data available'}
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{hi ? 'नाम' : 'Name'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'हिंदी नाम' : 'Hindi Name'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'प्रकार' : 'Type'}</TableHead>
                    <TableHead className="font-semibold text-right">
                      {hi ? 'प्रारंभिक शेष' : 'Opening Balance'}
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      {hi ? 'सिस्टम' : 'System'}
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      {hi ? 'क्रियाएं' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(acc => (
                    <TableRow key={acc.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {acc.nameHi || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', TYPE_BADGE_CLASS[acc.type])}
                        >
                          {getTypeLabel(acc.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {acc.openingBalance
                          ? fmtBalance(acc.openingBalance, acc.openingBalanceType ?? 'debit')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {acc.isSystem ? (
                          <Badge variant="secondary" className="text-xs">
                            {hi ? 'सिस्टम' : 'System'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(acc)}
                            title={hi ? 'संपादित करें' : 'Edit'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(acc.id)}
                            title={hi ? 'हटाएं' : 'Delete'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={o => {
          setIsAddOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'नया खाता शीर्ष जोड़ें' : 'Add New Ledger Account'}</DialogTitle>
            <DialogDescription>
              {hi ? 'नए खाते का विवरण भरें' : 'Fill in the details for the new account'}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            onSubmit={handleAdd}
            submitLabel={hi ? 'सहेजें' : 'Save'}
            onCancel={() => {
              setIsAddOpen(false);
              resetForm();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editAccount}
        onOpenChange={o => {
          if (!o) {
            setEditAccount(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'खाता संपादित करें' : 'Edit Ledger Account'}</DialogTitle>
            <DialogDescription>
              {hi ? 'खाते का विवरण अपडेट करें' : 'Update account details'}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            onSubmit={handleEdit}
            submitLabel={hi ? 'अपडेट करें' : 'Update'}
            onCancel={() => {
              setEditAccount(null);
              resetForm();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hi ? 'क्या आप वाकई हटाना चाहते हैं?' : 'Are you sure you want to delete?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hi
                ? 'यह खाता स्थायी रूप से हटा दिया जाएगा। यह क्रिया पूर्ववत नहीं की जा सकती।'
                : 'This account will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LedgerHeads;
