import React, { useState, useMemo } from 'react';
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
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import type { EntityLink } from '@/types';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ListTree, Pencil, Trash2, Plus, Search, FolderOpen, FileSpreadsheet, Download, Merge, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { LedgerAccount } from '@/types';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

type AccountType = LedgerAccount['type'];

const EMPTY_FORM = {
  name: '',
  nameHi: '',
  type: 'asset' as AccountType,
  openingBalance: '',
  openingBalanceType: 'debit' as 'debit' | 'credit',
  isGroup: false,
  parentId: '',
};

const TYPE_OPTIONS: { value: AccountType; label: string; labelHi: string }[] = [
  { value: 'equity',    label: 'Equity',    labelHi: 'पूंजी (Equity)' },
  { value: 'asset',     label: 'Asset',     labelHi: 'संपत्ति' },
  { value: 'liability', label: 'Liability', labelHi: 'दायित्व' },
  { value: 'income',    label: 'Income',    labelHi: 'आय' },
  { value: 'expense',   label: 'Expense',   labelHi: 'व्यय' },
];

const TYPE_BADGE_CLASS: Record<AccountType, string> = {
  equity:    'bg-purple-100 text-purple-700 border-purple-200',
  asset:     'bg-blue-100 text-blue-700 border-blue-200',
  liability: 'bg-orange-100 text-orange-700 border-orange-200',
  income:    'bg-green-100 text-green-700 border-green-200',
  expense:   'bg-red-100 text-red-700 border-red-200',
};

const LedgerHeads: React.FC = () => {
  const { language } = useLanguage();
  const { accounts, addAccount, updateAccount, deleteAccount, mergeAccounts, getEntityLinks, getAccountBalance } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AccountType>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<LedgerAccount | null>(null);
  const [deleteGuard, setDeleteGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const fmtBalance = (amount: number, type: 'debit' | 'credit') =>
    `${fmt(amount)} ${type === 'debit' ? (hi ? 'ना.' : 'Dr') : (hi ? 'ज.' : 'Cr')}`;

  // Compute depth for each account in the hierarchy
  const depthMap = useMemo(() => {
    const map: Record<string, number> = {};
    const computeDepth = (id: string, visited = new Set<string>()): number => {
      if (id in map) return map[id];
      if (visited.has(id)) return 0; // cycle guard
      visited.add(id);
      const acc = accounts.find(a => a.id === id);
      if (!acc || !acc.parentId) { map[id] = 0; return 0; }
      const d = computeDepth(acc.parentId, visited) + 1;
      map[id] = d;
      return d;
    };
    accounts.forEach(a => computeDepth(a.id));
    return map;
  }, [accounts]);

  // Build display list — hierarchical when no filter, flat when searching/filtering
  const displayList = useMemo(() => {
    const isFiltering = search.trim() || typeFilter !== 'all';

    if (isFiltering) {
      return accounts
        .filter(acc => {
          const matchSearch = !search.trim() ||
            acc.name.toLowerCase().includes(search.toLowerCase()) ||
            (acc.nameHi && acc.nameHi.includes(search)) ||
            acc.id.includes(search);
          const matchType = typeFilter === 'all' || acc.type === typeFilter;
          return matchSearch && matchType;
        })
        .map(acc => ({ acc, depth: 0 }));
    }

    // Hierarchical sort: parent first, then children grouped under parent
    const sorted: { acc: typeof accounts[0]; depth: number }[] = [];
    const addWithChildren = (parentId: string | undefined, depth: number) => {
      const children = accounts
        .filter(a => (a.parentId || undefined) === parentId)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      children.forEach(child => {
        sorted.push({ acc: child, depth });
        addWithChildren(child.id, depth + 1);
      });
    };
    // Start with root accounts (no parentId)
    addWithChildren(undefined, 0);
    // Add any orphaned accounts (parentId set but parent doesn't exist)
    const sortedIds = new Set(sorted.map(s => s.acc.id));
    accounts.filter(a => !sortedIds.has(a.id)).forEach(a => sorted.push({ acc: a, depth: 0 }));
    return sorted;
  }, [accounts, search, typeFilter, depthMap]);

  // Summary counts
  const leafAccounts = accounts.filter(a => !a.isGroup);
  const equityCount    = accounts.filter(a => a.type === 'equity').length;
  const assetCount     = accounts.filter(a => a.type === 'asset').length;
  const liabilityCount = accounts.filter(a => a.type === 'liability').length;
  const incExpCount    = accounts.filter(a => a.type === 'income' || a.type === 'expense').length;

  // Duplicate detection: group non-group accounts by normalized name
  const duplicateGroups = useMemo(() => {
    const groups: Record<string, LedgerAccount[]> = {};
    accounts.filter(a => !a.isGroup).forEach(a => {
      const key = a.name.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return Object.values(groups).filter(g => g.length > 1);
  }, [accounts]);

  const handleMerge = (keepId: string, removeId: string, name: string) => {
    const count = mergeAccounts(keepId, removeId);
    toast({
      title: hi ? 'खाते मर्ज किए गए' : 'Accounts Merged',
      description: hi
        ? `"${name}" — ${count} वाउचर अपडेट किए गए, डुप्लिकेट हटाया गया`
        : `"${name}" — ${count} voucher${count !== 1 ? 's' : ''} updated, duplicate removed`,
    });
  };

  const handleCSV = () => {
    const headers = ['Name', 'Name (Hindi)', 'Type', 'Opening Balance', 'Balance Type', 'Group'];
    const rows = displayList.map(({ acc }) => [acc.name, acc.nameHi || '', acc.type, acc.openingBalance || 0, acc.openingBalanceType || '', acc.isGroup ? 'Group' : 'Ledger']);
    downloadCSV(headers, rows, 'ledger_heads.csv');
  };
  const handleExcel = () => {
    const headers = ['Name', 'Name (Hindi)', 'Type', 'Opening Balance', 'Balance Type', 'Group'];
    const rows = displayList.map(({ acc }) => [acc.name, acc.nameHi || '', acc.type, acc.openingBalance || 0, acc.openingBalanceType || '', acc.isGroup ? 'Group' : 'Ledger']);
    downloadExcelSingle(headers, rows, 'ledger_heads.xlsx', 'Ledger Heads');
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const openAdd = () => { resetForm(); setIsAddOpen(true); };

  const openEdit = (acc: LedgerAccount) => {
    setEditAccount(acc);
    setForm({
      name: acc.name,
      nameHi: acc.nameHi || '',
      type: acc.type,
      openingBalance: String(acc.openingBalance ?? ''),
      openingBalanceType: acc.openingBalanceType ?? 'debit',
      isGroup: !!acc.isGroup,
      parentId: acc.parentId || '',
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.type) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    // P1-6: Enforce account name uniqueness (case-insensitive) before creating
    const nameNorm = form.name.trim().toLowerCase();
    if (accounts.some(a => a.name.toLowerCase() === nameNorm)) {
      toast({
        title: hi ? 'खाता नाम पहले से मौजूद है' : 'Account name already exists',
        description: hi ? 'कृपया अलग नाम चुनें।' : 'Please choose a different name.',
        variant: 'destructive',
      });
      return;
    }
    addAccount({
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      type: form.type,
      openingBalance: form.isGroup ? 0 : (Number(form.openingBalance) || 0),
      openingBalanceType: form.openingBalanceType,
      isGroup: form.isGroup || undefined,
      parentId: form.parentId || undefined,
    });
    toast({ title: hi ? (form.isGroup ? 'ग्रुप बनाया गया' : 'खाता जोड़ा गया') : (form.isGroup ? 'Group created' : 'Account added successfully') });
    resetForm();
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccount) return;
    if (!form.name.trim()) {
      toast({ title: hi ? 'नाम आवश्यक है' : 'Name is required', variant: 'destructive' });
      return;
    }
    // P1-6: Prevent rename to an existing name (excluding self)
    const nameNorm = form.name.trim().toLowerCase();
    if (accounts.some(a => a.id !== editAccount.id && a.name.toLowerCase() === nameNorm)) {
      toast({
        title: hi ? 'खाता नाम पहले से मौजूद है' : 'Account name already exists',
        description: hi ? 'कृपया अलग नाम चुनें।' : 'Please choose a different name.',
        variant: 'destructive',
      });
      return;
    }
    updateAccount(editAccount.id, {
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      openingBalance: form.isGroup ? 0 : (Number(form.openingBalance) || 0),
      openingBalanceType: form.openingBalanceType,
      isGroup: form.isGroup || undefined,
      parentId: form.parentId || undefined,
    });
    toast({ title: hi ? 'खाता अपडेट किया गया' : 'Account updated successfully' });
    setEditAccount(null);
    resetForm();
  };

  const handleDeleteClick = (acc: LedgerAccount) => {
    if (acc.isSystem) {
      toast({ title: hi ? 'सिस्टम खाता हटाया नहीं जा सकता' : 'Cannot delete system account', variant: 'destructive' });
      return;
    }
    if (acc.isGroup) {
      const hasChildren = accounts.some(a => a.parentId === acc.id);
      if (hasChildren) {
        toast({ title: hi ? 'पहले इस खाते के उप-खाते हटाएं' : 'Delete child accounts first', variant: 'destructive' });
        return;
      }
    }
    const links = getEntityLinks('account', acc.id);
    setDeleteGuard({ open: true, id: acc.id, name: acc.name, links });
  };

  const getTypeLabel = (type: AccountType) => {
    const opt = TYPE_OPTIONS.find(o => o.value === type);
    return opt ? (hi ? opt.labelHi : opt.label) : type;
  };

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
            {hi ? 'लेखा खातों का पदानुक्रम प्रबंधन' : 'Hierarchical chart of accounts'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button className="gap-2 w-fit" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {hi ? 'नया खाता' : 'Add New'}
          </Button>
        </div>
      </div>

      {/* Duplicate accounts warning + merge */}
      {duplicateGroups.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              {hi
                ? `${duplicateGroups.length} डुप्लिकेट खाते पाए गए`
                : `${duplicateGroups.length} Duplicate Account${duplicateGroups.length > 1 ? 's' : ''} Found`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {duplicateGroups.map((group, gi) => {
              const sorted = [...group].sort((a, b) => {
                const aVouchers = Math.abs(getAccountBalance(a.id));
                const bVouchers = Math.abs(getAccountBalance(b.id));
                return bVouchers - aVouchers;
              });
              const keep = sorted[0];
              const remove = sorted[1];
              return (
                <div key={gi} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-white dark:bg-background border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{keep.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {hi ? `${group.length} खाते एक ही नाम` : `${group.length} accounts with same name`}
                      {' · '}
                      {hi ? 'रखें' : 'Keep'}: <span className="font-mono">{keep.id.length > 8 ? keep.id.slice(0, 8) + '…' : keep.id}</span>
                      {' → '}
                      {hi ? 'हटाएं' : 'Remove'}: <span className="font-mono">{remove.id.length > 8 ? remove.id.slice(0, 8) + '…' : remove.id}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => handleMerge(keep.id, remove.id, keep.name)}
                  >
                    <Merge className="h-3.5 w-3.5" />
                    {hi ? 'मर्ज करें' : 'Merge'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <ListTree className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'पूंजी (Equity)' : 'Equity'}</p>
                <p className="text-2xl font-bold text-purple-700">{equityCount}</p>
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
                <p className="text-2xl font-bold text-green-700">{incExpCount}</p>
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
                placeholder={hi ? 'नाम या कोड से खोजें...' : 'Search by name or code...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={val => setTypeFilter(val as 'all' | AccountType)}>
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

      {/* Accounts Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {hi ? 'खाता शीर्ष सूची' : 'Chart of Accounts'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({displayList.length} / {accounts.length} {hi ? 'खाते' : 'accounts'} · {leafAccounts.length} {hi ? 'लेनयोग्य' : 'ledger'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayList.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {hi ? 'कोई डेटा नहीं' : 'No data available'}
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold w-20">{hi ? 'कोड' : 'Code'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'नाम' : 'Name'}</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">{hi ? 'हिंदी नाम' : 'Hindi Name'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'प्रकार' : 'Type'}</TableHead>
                    <TableHead className="font-semibold text-right hidden sm:table-cell">
                      {hi ? 'प्रा. शेष' : 'Opening Bal.'}
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      {hi ? 'क्रियाएं' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayList.map(({ acc, depth }) => (
                    <TableRow
                      key={acc.id}
                      className={cn(
                        'hover:bg-muted/30',
                        acc.isGroup && 'bg-muted/20 font-semibold',
                      )}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{acc.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
                          {acc.isGroup && <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className={cn(acc.isGroup ? 'font-semibold' : 'font-medium')}>
                            {acc.name}
                          </span>
                          {acc.isSystem && (
                            <Badge variant="secondary" className="text-xs ml-1 px-1 py-0">
                              {hi ? 'सिस्टम' : 'Sys'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {acc.nameHi || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', TYPE_BADGE_CLASS[acc.type])}>
                          {getTypeLabel(acc.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold hidden sm:table-cell">
                        {!acc.isGroup && acc.openingBalance
                          ? fmtBalance(acc.openingBalance, acc.openingBalanceType ?? 'debit')
                          : <span className="text-muted-foreground text-xs">—</span>}
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
                          {!acc.isSystem && !acc.isGroup && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteClick(acc)}
                              title={hi ? 'हटाएं' : 'Delete'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
      <Dialog open={isAddOpen} onOpenChange={o => { setIsAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'नया खाता शीर्ष जोड़ें' : 'Add New Ledger Account'}</DialogTitle>
            <DialogDescription>
              {hi ? 'नए खाते का विवरण भरें' : 'Fill in the details for the new account'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'नाम (अंग्रेजी)' : 'Name (English)'} <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cash in Hand" required />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
                <Input value={form.nameHi} onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))} placeholder="जैसे नकद" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'खाता प्रकार' : 'Account Type'} <span className="text-destructive">*</span></Label>
                <Select value={form.type} onValueChange={val => setForm(f => ({ ...f, type: val as AccountType, parentId: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{hi ? opt.labelHi : opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'पैरेंट ग्रुप' : 'Parent Group'}</Label>
                <Select value={form.parentId || '__none__'} onValueChange={val => setForm(f => ({ ...f, parentId: val === '__none__' ? '' : val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{hi ? 'कोई नहीं (Top Level)' : 'None (Top Level)'}</SelectItem>
                    {accounts.filter(a => a.isGroup && a.type === form.type).map(g => (
                      <SelectItem key={g.id} value={g.id}>{hi ? g.nameHi || g.name : g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <input
                type="checkbox"
                id="isGroupAdd"
                checked={form.isGroup}
                onChange={e => setForm(f => ({ ...f, isGroup: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isGroupAdd" className="text-sm font-medium cursor-pointer select-none">
                <FolderOpen className="inline h-4 w-4 mr-1 text-amber-600" />
                {hi ? 'यह एक ग्रुप है (इसके अंदर खाते आएंगे)' : 'This is a Group (sub-accounts will go under it)'}
              </label>
            </div>
            {!form.isGroup && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{hi ? 'प्रारंभिक शेष' : 'Opening Balance'} (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>{hi ? 'शेष प्रकार' : 'Balance Type'}</Label>
                  <Select value={form.openingBalanceType} onValueChange={val => setForm(f => ({ ...f, openingBalanceType: val as 'debit' | 'credit' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">{hi ? 'नाम (Dr)' : 'Debit (Dr)'}</SelectItem>
                      <SelectItem value="credit">{hi ? 'जमा (Cr)' : 'Credit (Cr)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => { setIsAddOpen(false); resetForm(); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
              <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — name/nameHi/openingBalance editable; type locked for group/system */}
      <Dialog open={!!editAccount} onOpenChange={o => { if (!o) { setEditAccount(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'खाता संपादित करें' : 'Edit Account'} — <span className="font-mono text-sm">{editAccount?.id}</span></DialogTitle>
            <DialogDescription>
              {hi ? 'नाम और प्रारंभिक शेष बदला जा सकता है' : 'You can edit name and opening balance'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'नाम (अंग्रेजी)' : 'Name (English)'} <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
                <Input value={form.nameHi} onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'पैरेंट ग्रुप' : 'Parent Group'}</Label>
              <Select value={form.parentId || '__none__'} onValueChange={val => setForm(f => ({ ...f, parentId: val === '__none__' ? '' : val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? 'कोई नहीं (Top Level)' : 'None (Top Level)'}</SelectItem>
                  {accounts.filter(a => a.isGroup && a.type === (editAccount?.type || form.type) && a.id !== editAccount?.id).map(g => (
                    <SelectItem key={g.id} value={g.id}>{hi ? g.nameHi || g.name : g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <input
                type="checkbox"
                id="isGroupEdit"
                checked={form.isGroup}
                onChange={e => setForm(f => ({ ...f, isGroup: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isGroupEdit" className="text-sm font-medium cursor-pointer select-none">
                <FolderOpen className="inline h-4 w-4 mr-1 text-amber-600" />
                {hi ? 'यह एक ग्रुप है' : 'This is a Group'}
              </label>
            </div>
            {/* Opening balance — only for leaf (non-group) accounts */}
            {!form.isGroup && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{hi ? 'प्रारंभिक शेष' : 'Opening Balance'} (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>{hi ? 'शेष प्रकार' : 'Balance Type'}</Label>
                  <Select value={form.openingBalanceType} onValueChange={val => setForm(f => ({ ...f, openingBalanceType: val as 'debit' | 'credit' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">{hi ? 'नाम (Dr)' : 'Debit (Dr)'}</SelectItem>
                      <SelectItem value="credit">{hi ? 'जमा (Cr)' : 'Credit (Cr)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => { setEditAccount(null); resetForm(); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
              <Button type="submit">{hi ? 'अपडेट करें' : 'Update'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Guard */}
      <LinkedDeleteDialog
        open={deleteGuard.open}
        onOpenChange={o => setDeleteGuard(g => ({ ...g, open: o }))}
        entityName={deleteGuard.name}
        links={deleteGuard.links}
        language={hi ? 'hi' : 'en'}
        onConfirmDelete={() => {
          if (deleteGuard.id) {
            deleteAccount(deleteGuard.id);
            toast({ title: hi ? 'खाता हटाया गया' : 'Account deleted' });
          }
        }}
      />
    </div>
  );
};

export default LedgerHeads;
