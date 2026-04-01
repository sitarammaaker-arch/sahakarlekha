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
import { Plus, Download, Search, Edit, Trash2, Landmark, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { generateLoanRegisterPDF } from '@/lib/pdf';
import type { Loan, LoanType, LoanStatus } from '@/types';

const EMPTY_FORM = {
  memberId: '',
  loanType: 'short-term' as LoanType,
  purpose: '',
  amount: '',
  interestRate: '',
  disbursementDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  repaidAmount: '',
  status: 'active' as LoanStatus,
  security: '',
};

interface LoanFormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  hi: boolean;
  members: import('@/types').Member[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ form, setForm, hi, members, onSubmit, onCancel }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1 col-span-2">
        <Label>{hi ? 'सदस्य *' : 'Member *'}</Label>
        <Select value={form.memberId} onValueChange={v => setForm(f => ({ ...f, memberId: v }))}>
          <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
          <SelectContent>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.memberId} — {m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'ऋण प्रकार' : 'Loan Type'}</Label>
        <Select value={form.loanType} onValueChange={v => setForm(f => ({ ...f, loanType: v as LoanType }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="short-term">{hi ? 'अल्पकालीन' : 'Short-term'}</SelectItem>
            <SelectItem value="medium-term">{hi ? 'मध्यकालीन' : 'Medium-term'}</SelectItem>
            <SelectItem value="long-term">{hi ? 'दीर्घकालीन' : 'Long-term'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'ब्याज दर (% वार्षिक)' : 'Interest Rate (% p.a.)'}</Label>
        <Input type="number" step="0.01" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} placeholder="12" />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'राशि (₹) *' : 'Amount (₹) *'}</Label>
        <Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="50000" />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'चुकाई गई राशि (₹)' : 'Repaid Amount (₹)'}</Label>
        <Input type="number" min="0" value={form.repaidAmount} onChange={e => setForm(f => ({ ...f, repaidAmount: e.target.value }))} placeholder="0" />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'वितरण तिथि *' : 'Disbursement Date *'}</Label>
        <Input type="date" value={form.disbursementDate} onChange={e => setForm(f => ({ ...f, disbursementDate: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'देय तिथि *' : 'Due Date *'}</Label>
        <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'स्थिति' : 'Status'}</Label>
        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as LoanStatus }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
            <SelectItem value="overdue">{hi ? 'बकाया' : 'Overdue'}</SelectItem>
            <SelectItem value="cleared">{hi ? 'चुकता' : 'Cleared'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 col-span-2">
        <Label>{hi ? 'उद्देश्य' : 'Purpose'}</Label>
        <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder={hi ? 'ऋण उद्देश्य' : 'Loan purpose'} />
      </div>
      <div className="space-y-1 col-span-2">
        <Label>{hi ? 'सुरक्षा / जमानत' : 'Security / Collateral'}</Label>
        <Textarea rows={2} value={form.security} onChange={e => setForm(f => ({ ...f, security: e.target.value }))} placeholder={hi ? 'भूमि, संपत्ति आदि' : 'Land, property, etc.'} />
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel}>{hi ? 'रद्द' : 'Cancel'}</Button>
      <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
    </div>
  </form>
);

const LoanRegister: React.FC = () => {
  const { language } = useLanguage();
  const { members, loans, addLoan, updateLoan, deleteLoan, society, getTrialBalance } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id;

  const filtered = loans.filter(l => {
    const memberName = getMemberName(l.memberId).toLowerCase();
    const matchSearch = memberName.includes(search.toLowerCase()) || l.loanNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
  const totalOutstanding = loans.filter(l => l.status !== 'cleared').reduce((s, l) => s + (l.amount - l.repaidAmount), 0);
  const overdueCount = loans.filter(l => l.status === 'overdue').length;
  const activeCount = loans.filter(l => l.status === 'active').length;

  // P3-2: Sec 32 compliance — total loans should not exceed 10× (share capital + reserves)
  // Share Capital accounts: 1101–1103 (parentId 1100); Reserve accounts: parentId 1200
  const sec32Limit = (() => {
    const tb = getTrialBalance();
    const shareCapital = tb
      .filter(b => b.account.parentId === '1100' && !b.account.isGroup)
      .reduce((s, b) => s + Math.abs(b.netBalance), 0);
    const reserves = tb
      .filter(b => b.account.parentId === '1200' && !b.account.isGroup)
      .reduce((s, b) => s + Math.abs(b.netBalance), 0);
    const base = shareCapital + reserves;
    return { base, limit: base * 10, shareCapital, reserves };
  })();
  const sec32Breach = sec32Limit.base > 0 && totalOutstanding > sec32Limit.limit;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.amount || !form.dueDate) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    addLoan({
      memberId: form.memberId,
      loanType: form.loanType,
      purpose: form.purpose,
      amount: Number(form.amount),
      interestRate: Number(form.interestRate) || 0,
      disbursementDate: form.disbursementDate,
      dueDate: form.dueDate,
      repaidAmount: Number(form.repaidAmount) || 0,
      status: form.status,
      security: form.security,
    });
    toast({ title: hi ? 'ऋण जोड़ा गया' : 'Loan added' });
    setForm(EMPTY_FORM);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLoan) return;
    updateLoan(editLoan.id, {
      memberId: form.memberId,
      loanType: form.loanType,
      purpose: form.purpose,
      amount: Number(form.amount),
      interestRate: Number(form.interestRate) || 0,
      disbursementDate: form.disbursementDate,
      dueDate: form.dueDate,
      repaidAmount: Number(form.repaidAmount) || 0,
      status: form.status,
      security: form.security,
    });
    toast({ title: hi ? 'ऋण अपडेट किया गया' : 'Loan updated' });
    setEditLoan(null);
  };

  const openEdit = (l: Loan) => {
    setEditLoan(l);
    setForm({
      memberId: l.memberId,
      loanType: l.loanType,
      purpose: l.purpose,
      amount: String(l.amount),
      interestRate: String(l.interestRate),
      disbursementDate: l.disbursementDate,
      dueDate: l.dueDate,
      repaidAmount: String(l.repaidAmount),
      status: l.status,
      security: l.security,
    });
  };

  const statusBadge = (s: LoanStatus) => {
    if (s === 'active') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{hi ? 'सक्रिय' : 'Active'}</Badge>;
    if (s === 'cleared') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{hi ? 'चुकता' : 'Cleared'}</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{hi ? 'बकाया' : 'Overdue'}</Badge>;
  };

  const loanTypeLabel = (t: LoanType) => {
    if (t === 'short-term') return hi ? 'अल्पकालीन' : 'Short-term';
    if (t === 'medium-term') return hi ? 'मध्यकालीन' : 'Medium-term';
    return hi ? 'दीर्घकालीन' : 'Long-term';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            {hi ? 'ऋण रजिस्टर' : 'Loan Register'}
          </h1>
          <p className="text-muted-foreground">{hi ? 'सदस्य ऋण का पूर्ण विवरण' : 'Complete record of member loans'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateLoanRegisterPDF(loans, members, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setForm(EMPTY_FORM); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4" />{hi ? 'नया ऋण' : 'New Loan'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल वितरित' : 'Total Disbursed'}</p>
            <p className="text-lg font-bold text-primary">{fmt(totalDisbursed)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'बकाया राशि' : 'Outstanding'}</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'सक्रिय ऋण' : 'Active Loans'}</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'अतिदेय' : 'Overdue'}</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* P3-2: Sec 32 compliance alert */}
      {sec32Breach && (
        <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-destructive bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-destructive">
              {hi ? 'धारा 32 उल्लंघन — ऋण सीमा पार' : 'Sec. 32 Breach — Loan Limit Exceeded'}
            </p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {hi
                ? `बकाया ऋण (${fmt(totalOutstanding)}) शेयर पूंजी + संचय (${fmt(sec32Limit.base)}) के 10 गुना (${fmt(sec32Limit.limit)}) से अधिक है।`
                : `Outstanding loans (${fmt(totalOutstanding)}) exceed 10× of Share Capital + Reserves (${fmt(sec32Limit.limit)}). Base: Share Capital ${fmt(sec32Limit.shareCapital)} + Reserves ${fmt(sec32Limit.reserves)}.`}
            </p>
          </div>
        </div>
      )}
      {sec32Limit.base > 0 && !sec32Breach && totalOutstanding > sec32Limit.limit * 0.8 && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <span className="text-amber-800 dark:text-amber-300">
            {hi
              ? `सावधान: बकाया ऋण (${fmt(totalOutstanding)}) धारा 32 की सीमा (${fmt(sec32Limit.limit)}) के 80% से अधिक हो गया है।`
              : `Caution: Outstanding loans (${fmt(totalOutstanding)}) have crossed 80% of the Sec. 32 limit (${fmt(sec32Limit.limit)}).`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={hi ? 'ऋण खोजें...' : 'Search loans...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
            <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
            <SelectItem value="overdue">{hi ? 'बकाया' : 'Overdue'}</SelectItem>
            <SelectItem value="cleared">{hi ? 'चुकता' : 'Cleared'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'ऋण सं.' : 'Loan No.'}</TableHead>
                <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                <TableHead>{hi ? 'उद्देश्य' : 'Purpose'}</TableHead>
                <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                <TableHead className="text-right">{hi ? 'ब्याज%' : 'Rate%'}</TableHead>
                <TableHead className="text-right">{hi ? 'चुकाया' : 'Repaid'}</TableHead>
                <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                <TableHead>{hi ? 'देय तिथि' : 'Due Date'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                    <Landmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई ऋण नहीं मिला' : 'No loans found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(l => {
                  const outstanding = l.amount - l.repaidAmount;
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{l.loanNo}</TableCell>
                      <TableCell className="font-medium">{getMemberName(l.memberId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{loanTypeLabel(l.loanType)}</TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">{l.purpose || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(l.amount)}</TableCell>
                      <TableCell className="text-right">{l.interestRate}%</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(l.repaidAmount)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{fmt(outstanding)}</TableCell>
                      <TableCell className="text-sm">{l.dueDate}</TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'नया ऋण जोड़ें' : 'Add New Loan'}</DialogTitle>
          </DialogHeader>
          <LoanForm form={form} setForm={setForm} hi={hi} members={members} onSubmit={handleAdd} onCancel={() => { setIsAddOpen(false); setForm(EMPTY_FORM); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editLoan} onOpenChange={open => !open && setEditLoan(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'ऋण संपादित करें' : 'Edit Loan'} — {editLoan?.loanNo}</DialogTitle>
          </DialogHeader>
          <LoanForm form={form} setForm={setForm} hi={hi} members={members} onSubmit={handleEdit} onCancel={() => setEditLoan(null)} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'ऋण हटाएं?' : 'Delete loan?'}</AlertDialogTitle>
            <AlertDialogDescription>{hi ? 'यह कार्य वापस नहीं किया जा सकता।' : 'This action cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { if (deleteId) { deleteLoan(deleteId); setDeleteId(null); toast({ title: hi ? 'हटाया गया' : 'Deleted' }); } }}>
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LoanRegister;
