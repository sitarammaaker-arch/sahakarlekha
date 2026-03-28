import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BadgeDollarSign, UserPlus, Pencil, Trash2, Search, CheckCircle, Users, AlertTriangle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Employee, SalaryRecord, PaymentMode } from '@/types';
import { generateSalarySlipPDF } from '@/lib/pdf';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const monthLabel = (ym: string) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
};

// ── empty forms ───────────────────────────────────────────────────────────────

const EMPTY_EMP_FORM = {
  name: '',
  nameHi: '',
  designation: '',
  joinDate: new Date().toISOString().split('T')[0],
  basicSalary: '',
  phone: '',
  bankAccount: '',
  status: 'active' as 'active' | 'inactive',
};

// ── row state for salary processing ──────────────────────────────────────────

interface ProcessRow {
  employee: Employee;
  allowances: number;
  deductions: number;
  paymentMode: PaymentMode;
  processed: boolean;
}

// ── EmployeeForm component (outside SalaryManagement to prevent remount) ─────

interface EmployeeFormProps {
  empForm: typeof EMPTY_EMP_FORM;
  setEmpForm: React.Dispatch<React.SetStateAction<typeof EMPTY_EMP_FORM>>;
  hi: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ empForm, setEmpForm, hi, onSubmit, onCancel, submitLabel }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'नाम (अंग्रेजी) *' : 'Name (English) *'}</Label>
        <Input
          value={empForm.name}
          onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Full Name"
          required
        />
      </div>
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
        <Input
          value={empForm.nameHi}
          onChange={e => setEmpForm(f => ({ ...f, nameHi: e.target.value }))}
          placeholder="पूरा नाम"
        />
      </div>
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'पदनाम *' : 'Designation *'}</Label>
        <Input
          value={empForm.designation}
          onChange={e => setEmpForm(f => ({ ...f, designation: e.target.value }))}
          placeholder={hi ? 'लेखाकार' : 'Accountant'}
          required
        />
      </div>
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'नियुक्ति तिथि *' : 'Join Date *'}</Label>
        <Input
          type="date"
          value={empForm.joinDate}
          onChange={e => setEmpForm(f => ({ ...f, joinDate: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'मूल वेतन (₹) *' : 'Basic Salary (₹) *'}</Label>
        <Input
          type="number"
          min="0"
          value={empForm.basicSalary}
          onChange={e => setEmpForm(f => ({ ...f, basicSalary: e.target.value }))}
          placeholder="15000"
          required
        />
      </div>
      <div className="space-y-1 col-span-2 sm:col-span-1">
        <Label>{hi ? 'फोन' : 'Phone'}</Label>
        <Input
          type="tel"
          value={empForm.phone}
          onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="9876543210"
        />
      </div>
      <div className="space-y-1 col-span-2">
        <Label>{hi ? 'बैंक खाता (वैकल्पिक)' : 'Bank Account (optional)'}</Label>
        <Input
          value={empForm.bankAccount}
          onChange={e => setEmpForm(f => ({ ...f, bankAccount: e.target.value }))}
          placeholder={hi ? 'खाता संख्या' : 'Account number'}
        />
      </div>
      <div className="space-y-1 col-span-2">
        <Label>{hi ? 'स्थिति' : 'Status'}</Label>
        <Select value={empForm.status} onValueChange={v => setEmpForm(f => ({ ...f, status: v as 'active' | 'inactive' }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
            <SelectItem value="inactive">{hi ? 'निष्क्रिय' : 'Inactive'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        {hi ? 'रद्द' : 'Cancel'}
      </Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  </form>
);

// ── main component ────────────────────────────────────────────────────────────

const SalaryManagement: React.FC = () => {
  const { language } = useLanguage();
  const {
    employees,
    salaryRecords,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addSalaryRecord,
    updateSalaryRecord,
    deleteSalaryRecord,
    society,
  } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';

  // ── Tab 1 – Employees state ──────────────────────────────────────────────
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteEmpId, setDeleteEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);

  // ── Tab 2 – Salary Processing state ─────────────────────────────────────
  const [processingMonth, setProcessingMonth] = useState(currentMonth());
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);

  // ── Tab 3 – Salary History state ────────────────────────────────────────
  const [historyMonth, setHistoryMonth] = useState('');
  const [historyEmpFilter, setHistoryEmpFilter] = useState('all');
  const [historyPaidFilter, setHistoryPaidFilter] = useState('all');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidMode, setMarkPaidMode] = useState<PaymentMode>('bank');
  const [deleteSlipId, setDeleteSlipId] = useState<string | null>(null);

  // ── derived – Employees ──────────────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch =
        e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.empNo.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.designation.toLowerCase().includes(empSearch.toLowerCase());
      const matchStatus = empStatusFilter === 'all' || e.status === empStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [employees, empSearch, empStatusFilter]);

  const totalStaff = employees.length;
  const activeStaff = employees.filter(e => e.status === 'active').length;
  const monthlyPayroll = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.basicSalary, 0);

  // ── derived – History ────────────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    return salaryRecords.filter(r => {
      const matchMonth = !historyMonth || r.month === historyMonth;
      const matchEmp = historyEmpFilter === 'all' || r.employeeId === historyEmpFilter;
      const matchPaid =
        historyPaidFilter === 'all' ||
        (historyPaidFilter === 'paid' && r.isPaid) ||
        (historyPaidFilter === 'pending' && !r.isPaid);
      return matchMonth && matchEmp && matchPaid;
    });
  }, [salaryRecords, historyMonth, historyEmpFilter, historyPaidFilter]);

  const totalProcessed = filteredHistory.reduce((s, r) => s + r.netSalary, 0);
  const totalPaid = filteredHistory.filter(r => r.isPaid).reduce((s, r) => s + r.netSalary, 0);
  const totalPending = filteredHistory.filter(r => !r.isPaid).reduce((s, r) => s + r.netSalary, 0);

  const getEmpName = (id: string) => {
    const e = employees.find(x => x.id === id);
    return e ? (hi && e.nameHi ? e.nameHi : e.name) : id;
  };

  // ── Tab 1 handlers ───────────────────────────────────────────────────────

  const handleAddEmp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.designation || !empForm.joinDate || !empForm.basicSalary) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    addEmployee({
      name: empForm.name,
      nameHi: empForm.nameHi,
      designation: empForm.designation,
      joinDate: empForm.joinDate,
      basicSalary: Number(empForm.basicSalary),
      phone: empForm.phone,
      bankAccount: empForm.bankAccount || undefined,
      status: empForm.status,
    });
    toast({ title: hi ? 'कर्मचारी जोड़ा गया' : 'Employee added' });
    setEmpForm(EMPTY_EMP_FORM);
    setIsAddEmpOpen(false);
  };

  const handleEditEmp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmp) return;
    if (!empForm.name || !empForm.designation || !empForm.joinDate || !empForm.basicSalary) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    updateEmployee(editEmp.id, {
      name: empForm.name,
      nameHi: empForm.nameHi,
      designation: empForm.designation,
      joinDate: empForm.joinDate,
      basicSalary: Number(empForm.basicSalary),
      phone: empForm.phone,
      bankAccount: empForm.bankAccount || undefined,
      status: empForm.status,
    });
    toast({ title: hi ? 'कर्मचारी अपडेट किया गया' : 'Employee updated' });
    setEditEmp(null);
  };

  const openEditEmp = (emp: Employee) => {
    setEditEmp(emp);
    setEmpForm({
      name: emp.name,
      nameHi: emp.nameHi,
      designation: emp.designation,
      joinDate: emp.joinDate,
      basicSalary: String(emp.basicSalary),
      phone: emp.phone,
      bankAccount: emp.bankAccount || '',
      status: emp.status,
    });
  };

  // ── Tab 2 handlers ───────────────────────────────────────────────────────

  const alreadyProcessedForMonth = useMemo(() => {
    return salaryRecords.some(r => r.month === processingMonth);
  }, [salaryRecords, processingMonth]);

  const loadEmployees = () => {
    const active = employees.filter(e => e.status === 'active');
    setProcessRows(
      active.map(emp => ({
        employee: emp,
        allowances: 0,
        deductions: 0,
        paymentMode: 'bank' as PaymentMode,
        processed: salaryRecords.some(r => r.employeeId === emp.id && r.month === processingMonth),
      }))
    );
    setRowsLoaded(true);
  };

  const updateRow = (empId: string, field: keyof Pick<ProcessRow, 'allowances' | 'deductions' | 'paymentMode'>, value: number | PaymentMode) => {
    setProcessRows(rows =>
      rows.map(r => (r.employee.id === empId ? { ...r, [field]: value } : r))
    );
  };

  const processRow = (row: ProcessRow) => {
    const netSalary = row.employee.basicSalary + row.allowances - row.deductions;
    addSalaryRecord({
      employeeId: row.employee.id,
      month: processingMonth,
      basicSalary: row.employee.basicSalary,
      allowances: row.allowances,
      deductions: row.deductions,
      netSalary,
      paymentMode: row.paymentMode,
      isPaid: false,
    });
    setProcessRows(rows => rows.map(r => (r.employee.id === row.employee.id ? { ...r, processed: true } : r)));
    toast({ title: hi ? 'वेतन प्रोसेस किया गया' : `Salary processed for ${row.employee.name}` });
  };

  const processAll = () => {
    const pending = processRows.filter(r => !r.processed);
    if (pending.length === 0) {
      toast({ title: hi ? 'सभी वेतन पहले से प्रोसेस हो चुके हैं' : 'All salaries already processed', variant: 'destructive' });
      return;
    }
    pending.forEach(row => {
      const netSalary = row.employee.basicSalary + row.allowances - row.deductions;
      addSalaryRecord({
        employeeId: row.employee.id,
        month: processingMonth,
        basicSalary: row.employee.basicSalary,
        allowances: row.allowances,
        deductions: row.deductions,
        netSalary,
        paymentMode: row.paymentMode,
        isPaid: false,
      });
    });
    setProcessRows(rows => rows.map(r => ({ ...r, processed: true })));
    toast({ title: hi ? `${pending.length} कर्मचारियों का वेतन प्रोसेस किया गया` : `${pending.length} salaries processed` });
  };

  // ── Tab 3 handlers ───────────────────────────────────────────────────────

  const handleMarkPaid = () => {
    if (!markPaidId) return;
    updateSalaryRecord(markPaidId, { isPaid: true, paidDate: markPaidDate, paymentMode: markPaidMode });
    toast({ title: hi ? 'भुगतान चिह्नित किया गया' : 'Marked as paid' });
    setMarkPaidId(null);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BadgeDollarSign className="h-7 w-7 text-primary" />
          {hi ? 'वेतन प्रबंधन' : 'Salary Management'}
        </h1>
        <p className="text-muted-foreground">
          {hi ? 'कर्मचारी और वेतन का पूर्ण प्रबंधन' : 'Complete employee and salary management'}
        </p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">{hi ? 'कर्मचारी' : 'Employees'}</TabsTrigger>
          <TabsTrigger value="processing">{hi ? 'वेतन प्रोसेसिंग' : 'Salary Processing'}</TabsTrigger>
          <TabsTrigger value="history">{hi ? 'वेतन इतिहास' : 'Salary History'}</TabsTrigger>
        </TabsList>

        {/* ══ TAB 1 – EMPLOYEES ════════════════════════════════════════════ */}
        <TabsContent value="employees" className="space-y-4 mt-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {hi ? 'समिति के सभी कर्मचारियों का विवरण' : 'All society employees'}
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEmpForm(EMPTY_EMP_FORM);
                setIsAddEmpOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {hi ? 'कर्मचारी जोड़ें' : 'Add Employee'}
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{hi ? 'कुल स्टाफ' : 'Total Staff'}</p>
                    <p className="text-2xl font-bold text-primary">{totalStaff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-green-100 dark:bg-green-800/30 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{hi ? 'सक्रिय' : 'Active'}</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{activeStaff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-accent/10 border-accent/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-accent/20 flex items-center justify-center">
                    <BadgeDollarSign className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{hi ? 'मासिक वेतन राशि' : 'Monthly Payroll'}</p>
                    <p className="text-xl font-bold text-accent">{fmt(monthlyPayroll)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={hi ? 'नाम, कर्मचारी नं. या पदनाम से खोजें...' : 'Search by name, emp no or designation...'}
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={empStatusFilter} onValueChange={setEmpStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
                <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
                <SelectItem value="inactive">{hi ? 'निष्क्रिय' : 'Inactive'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employees table */}
          <Card className="shadow-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{hi ? 'कर्म. नं.' : 'Emp No.'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'नाम' : 'Name'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'पदनाम' : 'Designation'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'नियुक्ति तिथि' : 'Join Date'}</TableHead>
                    <TableHead className="font-semibold text-right">{hi ? 'मूल वेतन' : 'Basic Salary'}</TableHead>
                    <TableHead className="font-semibold text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>
                    <TableHead className="font-semibold text-center">{hi ? 'क्रियाएं' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {hi ? 'कोई कर्मचारी नहीं मिला' : 'No employees found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map(emp => (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {emp.empNo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            {emp.nameHi && <p className="text-xs text-muted-foreground">{emp.nameHi}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{emp.designation}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(emp.joinDate).toLocaleDateString('hi-IN')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(emp.basicSalary)}</TableCell>
                        <TableCell className="text-center">
                          {emp.status === 'active' ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              {hi ? 'सक्रिय' : 'Active'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{hi ? 'निष्क्रिय' : 'Inactive'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditEmp(emp)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteEmpId(emp.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB 2 – SALARY PROCESSING ════════════════════════════════════ */}
        <TabsContent value="processing" className="space-y-4 mt-4">
          {/* Month picker + load */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="space-y-1">
                  <Label>{hi ? 'माह चुनें' : 'Select Month'}</Label>
                  <Input
                    type="month"
                    value={processingMonth}
                    onChange={e => {
                      setProcessingMonth(e.target.value);
                      setRowsLoaded(false);
                      setProcessRows([]);
                    }}
                    className="w-44"
                  />
                </div>
                <Button onClick={loadEmployees} className="gap-2">
                  <Users className="h-4 w-4" />
                  {hi ? 'कर्मचारी लोड करें' : 'Load Employees'}
                </Button>
              </div>
              {rowsLoaded && alreadyProcessedForMonth && (
                <div className="mt-3 flex items-center gap-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {hi
                    ? `${monthLabel(processingMonth)} का वेतन पहले से प्रोसेस हो चुका है।`
                    : `Salary for ${monthLabel(processingMonth)} has already been processed (partially or fully).`}
                </div>
              )}
            </CardContent>
          </Card>

          {rowsLoaded && (
            <>
              {processRows.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {hi ? 'कोई सक्रिय कर्मचारी नहीं' : 'No active employees found'}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {hi ? `${monthLabel(processingMonth)} — वेतन प्रोसेसिंग` : `Salary Processing — ${monthLabel(processingMonth)}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">{hi ? 'कर्मचारी' : 'Employee'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'मूल वेतन' : 'Basic'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'भत्ते' : 'Allowances'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'कटौती' : 'Deductions'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'शुद्ध वेतन' : 'Net Salary'}</TableHead>
                          <TableHead className="font-semibold">{hi ? 'भुगतान विधि' : 'Payment Mode'}</TableHead>
                          <TableHead className="font-semibold text-center">{hi ? 'क्रिया' : 'Action'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processRows.map(row => {
                          const net = row.employee.basicSalary + row.allowances - row.deductions;
                          return (
                            <TableRow
                              key={row.employee.id}
                              className={row.processed ? 'bg-green-50/60 dark:bg-green-900/10' : 'hover:bg-muted/30'}
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{row.employee.name}</p>
                                  <p className="text-xs text-muted-foreground">{row.employee.designation}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-sm">
                                {fmt(row.employee.basicSalary)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.allowances || ''}
                                  onChange={e =>
                                    updateRow(row.employee.id, 'allowances', Number(e.target.value) || 0)
                                  }
                                  className="w-24 text-right h-8"
                                  disabled={row.processed}
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.deductions || ''}
                                  onChange={e =>
                                    updateRow(row.employee.id, 'deductions', Number(e.target.value) || 0)
                                  }
                                  className="w-24 text-right h-8"
                                  disabled={row.processed}
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                {fmt(net)}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={row.paymentMode}
                                  onValueChange={v =>
                                    updateRow(row.employee.id, 'paymentMode', v as PaymentMode)
                                  }
                                  disabled={row.processed}
                                >
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                                    <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                                    <SelectItem value="credit">{hi ? 'उधार' : 'Credit'}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center">
                                {row.processed ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    {hi ? 'हो गया' : 'Done'}
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => processRow(row)}>
                                    {hi ? 'प्रोसेस' : 'Process'}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {processRows.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    onClick={processAll}
                    className="gap-2"
                    disabled={processRows.every(r => r.processed)}
                  >
                    <BadgeDollarSign className="h-4 w-4" />
                    {hi ? 'सभी प्रोसेस करें' : 'Process All'}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ TAB 3 – SALARY HISTORY ═══════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">{hi ? 'माह' : 'Month'}</Label>
                  <Input
                    type="month"
                    value={historyMonth}
                    onChange={e => setHistoryMonth(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{hi ? 'कर्मचारी' : 'Employee'}</Label>
                  <Select value={historyEmpFilter} onValueChange={setHistoryEmpFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder={hi ? 'सभी' : 'All'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{hi ? 'सभी कर्मचारी' : 'All Employees'}</SelectItem>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.empNo} — {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{hi ? 'स्थिति' : 'Status'}</Label>
                  <Select value={historyPaidFilter} onValueChange={setHistoryPaidFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
                      <SelectItem value="paid">{hi ? 'भुगतान किया' : 'Paid'}</SelectItem>
                      <SelectItem value="pending">{hi ? 'लंबित' : 'Pending'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{hi ? 'कुल प्रोसेस' : 'Total Processed'}</p>
                <p className="text-lg font-bold text-primary">{fmt(totalProcessed)}</p>
                <p className="text-xs text-muted-foreground">{filteredHistory.length} {hi ? 'रिकॉर्ड' : 'records'}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{hi ? 'कुल भुगतान' : 'Total Paid'}</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">
                  {filteredHistory.filter(r => r.isPaid).length} {hi ? 'रिकॉर्ड' : 'records'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{hi ? 'कुल लंबित' : 'Total Pending'}</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(totalPending)}</p>
                <p className="text-xs text-muted-foreground">
                  {filteredHistory.filter(r => !r.isPaid).length} {hi ? 'रिकॉर्ड' : 'records'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* History table */}
          <Card className="shadow-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{hi ? 'स्लिप नं.' : 'Slip No.'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'माह' : 'Month'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'कर्मचारी' : 'Employee'}</TableHead>
                    <TableHead className="font-semibold text-right">{hi ? 'शुद्ध वेतन' : 'Net Salary'}</TableHead>
                    <TableHead className="font-semibold">{hi ? 'भुगतान विधि' : 'Payment Mode'}</TableHead>
                    <TableHead className="font-semibold text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>
                    <TableHead className="font-semibold text-center">{hi ? 'क्रियाएं' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <BadgeDollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {hi ? 'कोई वेतन रिकॉर्ड नहीं मिला' : 'No salary records found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map(record => {
                      const payModeLabel =
                        record.paymentMode === 'cash'
                          ? hi ? 'नकद' : 'Cash'
                          : record.paymentMode === 'bank'
                          ? hi ? 'बैंक' : 'Bank'
                          : hi ? 'उधार' : 'Credit';
                      return (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {record.slipNo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{monthLabel(record.month)}</TableCell>
                          <TableCell className="font-medium text-sm">{getEmpName(record.employeeId)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(record.netSalary)}</TableCell>
                          <TableCell className="text-sm">{payModeLabel}</TableCell>
                          <TableCell className="text-center">
                            {record.isPaid ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {hi ? 'भुगतान किया' : 'Paid'}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                {hi ? 'लंबित' : 'Pending'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {!record.isPaid && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                  title={hi ? 'भुगतान चिह्नित करें' : 'Mark as paid'}
                                  onClick={() => {
                                    setMarkPaidId(record.id);
                                    setMarkPaidDate(new Date().toISOString().split('T')[0]);
                                    setMarkPaidMode(record.paymentMode);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                title={hi ? 'वेतन स्लिप डाउनलोड करें' : 'Download salary slip'}
                                onClick={() => {
                                  const emp = employees.find(e => e.id === record.employeeId);
                                  if (emp) generateSalarySlipPDF(record, emp, society);
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteSlipId(record.id)}
                              >
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Employee Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={isAddEmpOpen}
        onOpenChange={o => {
          setIsAddEmpOpen(o);
          if (!o) setEmpForm(EMPTY_EMP_FORM);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'नया कर्मचारी जोड़ें' : 'Add New Employee'}</DialogTitle>
            <DialogDescription>
              {hi ? 'कर्मचारी का विवरण भरें' : 'Fill in employee details'}
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            empForm={empForm}
            setEmpForm={setEmpForm}
            hi={hi}
            onSubmit={handleAddEmp}
            onCancel={() => {
              setIsAddEmpOpen(false);
              setEmpForm(EMPTY_EMP_FORM);
            }}
            submitLabel={hi ? 'सहेजें' : 'Save'}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Employee Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!editEmp}
        onOpenChange={o => {
          if (!o) setEditEmp(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {hi ? 'कर्मचारी संपादित करें' : 'Edit Employee'} — {editEmp?.empNo}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm
            empForm={empForm}
            setEmpForm={setEmpForm}
            hi={hi}
            onSubmit={handleEditEmp}
            onCancel={() => setEditEmp(null)}
            submitLabel={hi ? 'अपडेट करें' : 'Update'}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Employee AlertDialog ───────────────────────────────────── */}
      <AlertDialog open={!!deleteEmpId} onOpenChange={o => !o && setDeleteEmpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'कर्मचारी हटाएं?' : 'Delete employee?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {hi
                ? 'यह कर्मचारी स्थायी रूप से हटा दिया जाएगा। यह क्रिया वापस नहीं की जा सकती।'
                : 'This employee will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteEmpId) {
                  deleteEmployee(deleteEmpId);
                  setDeleteEmpId(null);
                  toast({ title: hi ? 'कर्मचारी हटाया गया' : 'Employee deleted' });
                }
              }}
            >
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Mark Paid Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!markPaidId} onOpenChange={o => !o && setMarkPaidId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'भुगतान चिह्नित करें' : 'Mark as Paid'}</DialogTitle>
            <DialogDescription>
              {hi ? 'भुगतान की जानकारी दर्ज करें' : 'Enter payment details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{hi ? 'भुगतान तिथि' : 'Payment Date'}</Label>
              <Input
                type="date"
                value={markPaidDate}
                onChange={e => setMarkPaidDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'भुगतान विधि' : 'Payment Mode'}</Label>
              <Select value={markPaidMode} onValueChange={v => setMarkPaidMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                  <SelectItem value="credit">{hi ? 'उधार' : 'Credit'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMarkPaidId(null)}>
              {hi ? 'रद्द' : 'Cancel'}
            </Button>
            <Button onClick={handleMarkPaid} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {hi ? 'भुगतान चिह्नित करें' : 'Mark Paid'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Salary Record AlertDialog ─────────────────────────────── */}
      <AlertDialog open={!!deleteSlipId} onOpenChange={o => !o && setDeleteSlipId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'वेतन रिकॉर्ड हटाएं?' : 'Delete salary record?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {hi
                ? 'यह वेतन स्लिप स्थायी रूप से हटा दी जाएगी।'
                : 'This salary slip will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteSlipId) {
                  deleteSalaryRecord(deleteSlipId);
                  setDeleteSlipId(null);
                  toast({ title: hi ? 'वेतन रिकॉर्ड हटाया गया' : 'Salary record deleted' });
                }
              }}
            >
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalaryManagement;
