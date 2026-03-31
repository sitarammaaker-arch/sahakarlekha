import { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Plus, Edit2, CheckCircle2, TrendingUp, TrendingDown, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { Budget, BudgetHead } from '@/types';
import { supabase } from '@/lib/supabase';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

function variance(actual: number, budget: number) {
  if (budget === 0) return { pct: 0, fav: true };
  const diff = actual - budget;
  return { pct: Math.abs((diff / budget) * 100), fav: diff <= 0 };
}

export default function BudgetModule() {
  const { accounts, vouchers, society } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || 'SOC001';

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedFY, setSelectedFY] = useState(society.financialYear);
  const [showEditor, setShowEditor] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Load from Supabase
  useEffect(() => {
    if (!societyId) return;
    supabase
      .from('budgets')
      .select('*')
      .eq('society_id', societyId)
      .then(({ data, error }) => {
        if (error) { console.error('Budget load error:', error.message); return; }
        // Parse heads from jsonb
        const parsed = (data || []).map((b: any) => ({
          ...b,
          heads: Array.isArray(b.heads) ? b.heads : [],
        })) as Budget[];
        setBudgets(parsed);
      });
  }, [societyId]);

  function fyBounds(fy: string) {
    const [startYear] = fy.split('-').map(Number);
    return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
  }
  const { from, to } = fyBounds(selectedFY);

  const incomeExpAccounts = useMemo(() =>
    accounts.filter(a => a.type === 'income' || a.type === 'expense'),
    [accounts]);

  const actualMap = useMemo(() => {
    const map: Record<string, number> = {};
    const active = vouchers.filter(v => !v.isDeleted && v.date >= from && v.date <= to);
    for (const v of active) {
      map[v.debitAccountId] = (map[v.debitAccountId] || 0) + v.amount;
      map[v.creditAccountId] = (map[v.creditAccountId] || 0) + v.amount;
    }
    return map;
  }, [vouchers, from, to]);

  const currentBudget = useMemo(() =>
    budgets.find(b => b.financialYear === selectedFY),
    [budgets, selectedFY]);

  const budgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    (currentBudget?.heads || []).forEach(h => { map[h.accountId] = h.budgetAmount; });
    return map;
  }, [currentBudget]);

  const rows = useMemo(() => {
    return incomeExpAccounts.map(a => {
      const budgeted = budgetMap[a.id] || 0;
      const actual = actualMap[a.id] || 0;
      const v = variance(actual, budgeted);
      return { account: a, budgeted, actual, variancePct: v.pct, favourable: v.fav };
    });
  }, [incomeExpAccounts, budgetMap, actualMap]);

  const incomeRows = rows.filter(r => r.account.type === 'income');
  const expenseRows = rows.filter(r => r.account.type === 'expense');

  const totalBudgetIncome = incomeRows.reduce((s, r) => s + r.budgeted, 0);
  const totalActualIncome = incomeRows.reduce((s, r) => s + r.actual, 0);
  const totalBudgetExpense = expenseRows.reduce((s, r) => s + r.budgeted, 0);
  const totalActualExpense = expenseRows.reduce((s, r) => s + r.actual, 0);

  const handleSaveBudget = useCallback(async (heads: BudgetHead[]) => {
    const existing = budgets.find(b => b.financialYear === selectedFY);

    if (existing) {
      const updated = { heads, approvedBy: user?.name, approvedAt: new Date().toISOString() };
      const { error } = await supabase.from('budgets').update(updated).eq('id', existing.id);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return;
      }
      setBudgets(prev => prev.map(b =>
        b.financialYear === selectedFY ? { ...b, ...updated } : b
      ));
    } else {
      const newBudget: Budget & { society_id: string } = {
        id: `bgt_${Date.now()}`,
        financialYear: selectedFY,
        heads,
        approvedBy: user?.name,
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: user?.name || '',
        society_id: societyId,
      };
      const { error } = await supabase.from('budgets').insert(newBudget);
      if (error) {
        toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return;
      }
      setBudgets(prev => [...prev, newBudget]);
    }

    setShowEditor(false);
    toast({ title: hi ? 'बजट सहेजा गया' : 'Budget saved' });
  }, [budgets, selectedFY, user, hi, toast, societyId]);

  const budgetHeaders = ['Code', 'Account', 'Budget (₹)', 'Actual (₹)', 'Variance (₹)', 'Var %', 'Status'];
  const budgetDataRows = () =>
    rows.map(r => [
      r.account.code,
      r.account.name,
      r.budgeted,
      r.actual,
      r.actual - r.budgeted,
      r.budgeted > 0 ? `${r.variancePct.toFixed(1)}%` : '—',
      r.budgeted > 0 ? (r.favourable ? 'Favourable' : 'Adverse') : '—',
    ]);

  const handleCSV = () => downloadCSV(budgetHeaders, budgetDataRows(), 'budget-vs-actual');
  const handleExcel = () => downloadExcelSingle(budgetHeaders, budgetDataRows(), 'budget-vs-actual', 'Budget vs Actual');

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(13);
    doc.text(society.name, w / 2, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Budget vs Actual — ${selectedFY}`, w / 2, 21, { align: 'center' });

    const buildBody = (data: typeof rows) =>
      data.map(r => [
        r.account.code,
        r.account.name,
        r.budgeted.toFixed(2),
        r.actual.toFixed(2),
        `${r.variancePct.toFixed(1)}%`,
        r.favourable ? 'Fav' : 'Adv',
      ]);

    doc.setFontSize(10);
    doc.text('Income', 14, 30);
    autoTable(doc, {
      startY: 33,
      head: [['Code', 'Account', 'Budget', 'Actual', 'Var %', 'Status']],
      body: buildBody(incomeRows),
      foot: [['', 'Total', totalBudgetIncome.toFixed(2), totalActualIncome.toFixed(2), '', '']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96] },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 6;
    doc.text('Expenses', 14, y2);
    autoTable(doc, {
      startY: y2 + 3,
      head: [['Code', 'Account', 'Budget', 'Actual', 'Var %', 'Status']],
      body: buildBody(expenseRows),
      foot: [['', 'Total', totalBudgetExpense.toFixed(2), totalActualExpense.toFixed(2), '', '']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [192, 57, 43] },
    });

    doc.save(`budget-vs-actual-${selectedFY}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'बजट मॉड्यूल' : 'Budget Module'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'बजट बनाएं और वास्तविक व्यय से तुलना करें' : 'Create budget and compare with actual expenditure'}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
            <Button variant="outline" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</Button>
          </div>
          {(user?.role === 'admin' || user?.role === 'accountant') && (
            <Button onClick={() => { setEditingBudget(currentBudget || null); setShowEditor(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {currentBudget ? (hi ? 'बजट संपादित करें' : 'Edit Budget') : (hi ? 'बजट बनाएं' : 'Create Budget')}
            </Button>
          )}
        </div>
      </div>

      {/* FY selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">{hi ? 'वित्तीय वर्ष:' : 'Financial Year:'}</label>
        <Select value={selectedFY} onValueChange={setSelectedFY}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['2022-23', '2023-24', '2024-25', '2025-26', '2026-27'].map(fy => (
              <SelectItem key={fy} value={fy}>{fy}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentBudget ? (
          <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />{hi ? 'बजट उपलब्ध' : 'Budget Set'}</Badge>
        ) : (
          <Badge variant="secondary">{hi ? 'बजट नहीं है' : 'No Budget'}</Badge>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'बजट आय' : 'Budget Income'}</p>
          <p className="font-bold text-green-700">{fmt(totalBudgetIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'वास्तविक आय' : 'Actual Income'}</p>
          <p className="font-bold text-green-600">{fmt(totalActualIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'बजट व्यय' : 'Budget Expense'}</p>
          <p className="font-bold text-red-700">{fmt(totalBudgetExpense)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'वास्तविक व्यय' : 'Actual Expense'}</p>
          <p className="font-bold text-red-600">{fmt(totalActualExpense)}</p>
        </CardContent></Card>
      </div>

      <BudgetTable title={hi ? 'आय' : 'Income'} rows={incomeRows} totalBudget={totalBudgetIncome} totalActual={totalActualIncome} hi={hi} color="green" />
      <BudgetTable title={hi ? 'व्यय' : 'Expenses'} rows={expenseRows} totalBudget={totalBudgetExpense} totalActual={totalActualExpense} hi={hi} color="red" />

      {showEditor && (
        <BudgetEditorDialog
          open={showEditor}
          onClose={() => setShowEditor(false)}
          accounts={incomeExpAccounts}
          existing={editingBudget}
          hi={hi}
          onSave={handleSaveBudget}
        />
      )}
    </div>
  );
}

function BudgetTable({ title, rows, totalBudget, totalActual, hi, color }: {
  title: string;
  rows: Array<{ account: any; budgeted: number; actual: number; variancePct: number; favourable: boolean }>;
  totalBudget: number; totalActual: number; hi: boolean; color: 'green' | 'red';
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                <TableHead>{hi ? 'खाता' : 'Account'}</TableHead>
                <TableHead className="text-right">{hi ? 'बजट' : 'Budget'}</TableHead>
                <TableHead className="text-right">{hi ? 'वास्तविक' : 'Actual'}</TableHead>
                <TableHead className="text-right">{hi ? 'अंतर' : 'Variance'}</TableHead>
                <TableHead className="text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.account.id}>
                  <TableCell className="font-mono text-xs">{r.account.code}</TableCell>
                  <TableCell>{r.account.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.budgeted)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.actual)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.budgeted > 0 ? `${r.variancePct.toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.budgeted > 0 ? (
                      r.favourable
                        ? <Badge className="bg-green-100 text-green-800 text-xs">{hi ? 'अनुकूल' : 'Favourable'}</Badge>
                        : <Badge className="bg-red-100 text-red-800 text-xs">{hi ? 'प्रतिकूल' : 'Adverse'}</Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/30">
                <TableCell colSpan={2} className="text-right">{hi ? 'कुल' : 'Total'}</TableCell>
                <TableCell className="text-right font-mono">{fmt(totalBudget)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(totalActual)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetEditorDialog({ open, onClose, accounts, existing, hi, onSave }: {
  open: boolean; onClose: () => void;
  accounts: any[]; existing: Budget | null; hi: boolean;
  onSave: (heads: BudgetHead[]) => void;
}) {
  const [heads, setHeads] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (existing?.heads || []).forEach(h => { init[h.accountId] = String(h.budgetAmount); });
    return init;
  });

  const handleSave = () => {
    const headArr: BudgetHead[] = accounts
      .filter(a => heads[a.id] && Number(heads[a.id]) > 0)
      .map(a => ({ accountId: a.id, accountName: a.name, budgetAmount: Number(heads[a.id]) }));
    onSave(headArr);
  };

  const incomeAccounts = accounts.filter(a => a.type === 'income');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{hi ? 'बजट प्रविष्टि' : 'Budget Entry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{hi ? 'प्रत्येक खाते के लिए बजट राशि दर्ज करें (0 छोड़ें अगर शामिल नहीं करना)' : 'Enter budget amount for each account (leave 0 to exclude)'}</p>
          <div className="space-y-2">
            <p className="font-semibold text-green-700">{hi ? 'आय' : 'Income'}</p>
            {incomeAccounts.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-16 text-xs font-mono text-muted-foreground">{a.code}</span>
                <span className="flex-1 text-sm">{a.name}</span>
                <Input
                  type="number" min="0" className="w-36 text-right"
                  value={heads[a.id] || ''}
                  placeholder="0"
                  onChange={e => setHeads(p => ({ ...p, [a.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-red-700">{hi ? 'व्यय' : 'Expenses'}</p>
            {expenseAccounts.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-16 text-xs font-mono text-muted-foreground">{a.code}</span>
                <span className="flex-1 text-sm">{a.name}</span>
                <Input
                  type="number" min="0" className="w-36 text-right"
                  value={heads[a.id] || ''}
                  placeholder="0"
                  onChange={e => setHeads(p => ({ ...p, [a.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={handleSave}>{hi ? 'सहेजें' : 'Save Budget'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
