import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { computeStatutory } from '@/lib/payrollStatutory';
import { tdsBasisNote, type TaxRegime } from '@/lib/tdsProjection';
import { resolveTaxBasis } from '@/lib/rules/incomeTax';
import { cumulativeMonthlyTds, monthsLeftInFy, fyBounds, isInFy } from '@/lib/payroll/cumulativeTds';
import { isPeriodLocked } from '@/lib/periodLock';
import { getTdsChallanLinks, getBankAccountIds } from '@/lib/storage';
import { professionalTaxForState } from '@/lib/professionalTax';
import { build24Q, type Quarter } from '@/lib/form24Q';
import { daysInMonth, prorate } from '@/lib/attendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { BadgeDollarSign, UserPlus, Pencil, Trash2, Search, CheckCircle, Users, AlertTriangle, Download, FileSpreadsheet, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import type { Employee, SalaryRecord, PaymentMode, EntityLink } from '@/types';
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import { generateSalarySlipPDF } from '@/lib/pdf';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

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
  pan: '',
  status: 'active' as 'active' | 'inactive',
};

// ── row state for salary processing ──────────────────────────────────────────

interface ProcessRow {
  employee: Employee;
  allowances: number;
  deductions: number;
  pt: number;        // ECR-14: professional tax
  tds: number;       // ECR-14: TDS u/s 192 — cumulative (see tdsFor)
  /** > 0 ⇒ MORE was deducted earlier this FY than the year owes. Payroll cannot refund
   *  it, so it must be shown: the employee only gets it back by filing their ITR (or,
   *  if it was never challan-deposited, by the society simply returning it). */
  tdsExcess: number;
  paidDays: number;  // ECR-14: attendance (paid days this month)
  paymentMode: PaymentMode;
  processed: boolean;
  // Manual overrides for the auto PF/ESI figures (₹). null ⇒ use the computed rate. The society can
  // fine-tune any statutory amount; clearing the box reverts to auto.
  pfEmployeeOverride: number | null;
  pfEmployerOverride: number | null;
  esiEmployeeOverride: number | null;
  esiEmployerOverride: number | null;
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
        <Label>{hi ? 'PAN (Form 24Q हेतु)' : 'PAN (for Form 24Q)'}</Label>
        <Input
          value={empForm.pan}
          onChange={e => setEmpForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
          placeholder="ABCDE1234F"
          maxLength={10}
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
    accounts,
    society,
    getEntityLinks,
  } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';

  // ── Tab 1 – Employees state ──────────────────────────────────────────────
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteEmpGuard, setDeleteEmpGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });

  const handleDeleteEmpClick = (emp: Employee) => {
    const links = getEntityLinks('employee', emp.id);
    setDeleteEmpGuard({ open: true, id: emp.id, name: `${emp.name} (${emp.empNo})`, links });
  };
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);

  // ── Tab 2 – Salary Processing state ─────────────────────────────────────
  const [processingMonth, setProcessingMonth] = useState(currentMonth());
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);
  const [taxRegime, setTaxRegime] = useState<TaxRegime>('new');   // ECR-14: TDS-192 projection regime
  // Warn on BOTH failure modes (rules/incomeTax.ts): the law does not cover today
  // (stale), OR it does but nobody has verified the figures. Unverified is quieter than
  // stale but it is not safe — the clerk is about to accept this number into a salary
  // record either way, so both earn the amber.
  const tdsBasis = resolveTaxBasis(new Date().toISOString().slice(0, 10));
  const tdsStale = tdsBasis.stale || !tdsBasis.set.verified;

  /**
   * Is the month being processed inside a CLOSED period? (ECR-07 / RULE 6)
   *
   * `addSalaryRecord` already honours the whole-FY audit lock (`guardFYLocked`), but not
   * the date-based period lock — so a clerk could set processingMonth to a closed month
   * and the cumulative TDS recompute would happily re-derive it. A closed period must not
   * be silently recomputed: per the CA (docs/CA-VERIFICATION-2026-07.md follow-up), a
   * settled year is corrected by a TDS **correction statement**, not by a quiet re-run.
   * The month's LAST day is what matters — a period locked mid-month still closes it.
   */
  const monthEnd = `${processingMonth}-${String(daysInMonth(processingMonth)).padStart(2, '0')}`;
  const periodClosed = isPeriodLocked(monthEnd, society.periodLockDate);
  // Employees already over-deducted this FY — surfaced below the TDS note, never hidden.
  const excessRows = processRows.filter(r => !r.processed && r.tdsExcess > 0);
  const totalExcess = excessRows.reduce((s, r) => s + r.tdsExcess, 0);

  /* WHICH RECOVERY ROUTE APPLIES — the point of task B.
     Until salary TDS became a TdsEntry (`sal-<recordId>`, TdsRegister), the software
     could only recite both routes and let the clerk work it out. Now it can look: a
     salary month whose entry carries a challan link has been DEPOSITED, so the excess is
     already the employee's tax credit and only an ITR gets it back. If it was never
     deposited, the money is still with the society and can simply be returned — which is
     enormously better for the employee, and time-boxed: after the FY closes that route
     shuts.
     Read straight from the same store TdsRegister writes; no copy, no new table. */
  const excessDeposited = useMemo(() => {
    if (!excessRows.length) return false;
    const links = new Set(getTdsChallanLinks().filter(l => l.challanId).map(l => l.entryId));
    const fy = fyBounds(processingMonth);
    // Any prior salary run this FY, for an over-deducted employee, already challan-linked.
    return salaryRecords.some(r =>
      (r.tds || 0) > 0 &&
      isInFy(r.month, fy) &&
      excessRows.some(x => x.employee.id === r.employeeId) &&
      links.has(`sal-${r.id}`));
  }, [excessRows, salaryRecords, processingMonth]);

  // ── Tab 3 – Salary History state ────────────────────────────────────────
  // ECR-14: Form 24Q dialog
  const [q24Open, setQ24Open] = useState(false);
  const [q24Quarter, setQ24Quarter] = useState<Quarter>('Q1');
  const form24Q = useMemo(() => build24Q(salaryRecords, employees, society.financialYear, q24Quarter), [salaryRecords, employees, society.financialYear, q24Quarter]);
  const export24Q = () => {
    const headers = ['Emp No', 'Name', 'PAN', 'Gross Salary', 'TDS'];
    const rows = form24Q.rows.map(r => [r.empNo, r.name, r.pan, r.grossSalary, r.tds]);
    downloadCSV(headers, rows, `form24Q_${society.financialYear}_${q24Quarter}.csv`);
  };

  const [historyMonth, setHistoryMonth] = useState('');
  const [historyEmpFilter, setHistoryEmpFilter] = useState('all');
  const [historyPaidFilter, setHistoryPaidFilter] = useState('all');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidMode, setMarkPaidMode] = useState<PaymentMode>('bank');
  const [markPaidBankId, setMarkPaidBankId] = useState<string>('');   // which bank, when mode = 'bank'
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
      pan: empForm.pan.toUpperCase().trim() || undefined,
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
      pan: empForm.pan.toUpperCase().trim() || undefined,
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
      pan: emp.pan || '',
      status: emp.status,
    });
  };

  // ── Tab 2 handlers ───────────────────────────────────────────────────────

  const alreadyProcessedForMonth = useMemo(() => {
    return salaryRecords.some(r => r.month === processingMonth);
  }, [salaryRecords, processingMonth]);

  /**
   * Salary TDS is CUMULATIVE, not annual÷12 (rules: lib/payroll/cumulativeTds.ts).
   * Each run re-estimates the year, subtracts what was ACTUALLY deducted so far this FY,
   * and spreads only the balance over the months that remain — so an over- or
   * under-deduction in an earlier month is absorbed here rather than left for the
   * employee's ITR. This is what the old `suggestMonthlyTds(gross, regime)` call could
   * not do: it passed neither the months left nor the year-to-date.
   */
  const tdsFor = (emp: Employee, allowances = 0, regime: TaxRegime = taxRegime) => {
    // A closed period is not recomputed — at all. The banner explains; this enforces.
    // Returning the recomputed figure "just for display" would be the trap: a clerk sees
    // an authoritative-looking number for a settled month and edits toward it.
    if (periodClosed) return { tds: 0, annualTax: 0, ytdDeducted: 0, balance: 0, excess: 0 };
    const fy = fyBounds(processingMonth);
    // Prior runs only — exclude the month being processed, or a re-run would count its
    // own deduction as already-paid and drive the balance to zero.
    const ytdDeducted = salaryRecords
      .filter(r => r.employeeId === emp.id && r.month !== processingMonth && isInFy(r.month, fy))
      .reduce((sum, r) => sum + (r.tds || 0), 0);
    return cumulativeMonthlyTds({
      annualGross: (emp.basicSalary + allowances) * 12,
      regime,
      ytdDeducted,
      monthsRemaining: monthsLeftInFy(processingMonth),
      // asOf comes from the MONTH BEING PROCESSED, never from today. Re-running a
      // March-2025 payslip must apply FY 2024-25 law, not this year's. Omitting this
      // defaults to today — which is the exact defect this whole file spent the day
      // fixing (tdsProjection applying FY 2024-25 slabs in FY 2026-27), reintroduced
      // one layer up. monthsRemaining already derives from processingMonth; the law
      // has to come from the same place or the two disagree.
      asOf: `${processingMonth}-01`,
    });
  };

  const loadEmployees = () => {
    const active = employees.filter(e => e.status === 'active');
    setProcessRows(
      active.map(emp => ({
        employee: emp,
        allowances: 0,
        deductions: 0,
        pt: professionalTaxForState(emp.basicSalary, society.state),   // ECR-14: auto PT by state (editable)
        tds: tdsFor(emp).tds,          // ECR-14: TDS-192, cumulative (editable)
        tdsExcess: tdsFor(emp).excess,
        paidDays: daysInMonth(processingMonth),   // ECR-14: full month by default
        paymentMode: 'bank' as PaymentMode,
        processed: salaryRecords.some(r => r.employeeId === emp.id && r.month === processingMonth),
        pfEmployeeOverride: null, pfEmployerOverride: null,
        esiEmployeeOverride: null, esiEmployerOverride: null,   // all auto until the user changes them
      }))
    );
    setRowsLoaded(true);
  };

  // Re-project TDS for unprocessed rows when the regime changes — cumulative, as above.
  const reprojectTds = (regime: TaxRegime) => {
    setTaxRegime(regime);
    setProcessRows(rows => rows.map(r => {
      if (r.processed) return r;
      const t = tdsFor(r.employee, r.allowances, regime);
      return { ...r, tds: t.tds, tdsExcess: t.excess };
    }));
  };

  const updateRow = (empId: string, field: keyof Pick<ProcessRow, 'allowances' | 'deductions' | 'pt' | 'tds' | 'paidDays' | 'paymentMode' | 'pfEmployeeOverride' | 'pfEmployerOverride' | 'esiEmployeeOverride' | 'esiEmployerOverride'>, value: number | PaymentMode | null) => {
    setProcessRows(rows =>
      rows.map(r => (r.employee.id === empId ? { ...r, [field]: value } : r))
    );
  };

  // ECR-14: statutory computation for a process row. Earnings are pro-rated by attendance
  // (paid days / days-in-month) first, so PF/ESI compute on the actually-earned wage.
  // withOverrides=false ⇒ the AUTO baseline (what the rate computes), used to pre-fill the override
  // boxes and show the "auto" value; the default (true) ⇒ the EFFECTIVE figures that drive the
  // Deduction total, Net Salary and the saved record.
  const rowStatutory = (row: ProcessRow, withOverrides = true) => {
    const monthDays = daysInMonth(processingMonth);
    return computeStatutory({
      basic: prorate(row.employee.basicSalary, row.paidDays, monthDays),
      allowances: prorate(row.allowances, row.paidDays, monthDays),
      pfApplicable: row.employee.pfApplicable ?? true,
      esiApplicable: row.employee.esiApplicable ?? true,
      pt: row.pt,
      tds: row.tds,
      ...(withOverrides ? {
        pfEmployeeOverride: row.pfEmployeeOverride,
        pfEmployerOverride: row.pfEmployerOverride,
        esiEmployeeOverride: row.esiEmployeeOverride,
        esiEmployerOverride: row.esiEmployerOverride,
      } : {}),
    });
  };

  const salaryRecordFromRow = (row: ProcessRow) => {
    const s = rowStatutory(row);
    const monthDays = daysInMonth(processingMonth);
    return {
      employeeId: row.employee.id,
      month: processingMonth,
      basicSalary: prorate(row.employee.basicSalary, row.paidDays, monthDays),   // earned (attendance-prorated)
      allowances: prorate(row.allowances, row.paidDays, monthDays),
      deductions: s.totalEmployeeDeductions,
      netSalary: s.netSalary,
      pfEmployee: s.pfEmployee, pfEmployer: s.pfEmployer,
      esiEmployee: s.esiEmployee, esiEmployer: s.esiEmployer,
      pt: s.pt, tds: s.tds,
      paymentMode: row.paymentMode,
      isPaid: false,
    };
  };

  const processRow = (row: ProcessRow) => {
    addSalaryRecord(salaryRecordFromRow(row));
    setProcessRows(rows => rows.map(r => (r.employee.id === row.employee.id ? { ...r, processed: true } : r)));
    toast({ title: hi ? 'वेतन प्रोसेस किया गया' : `Salary processed for ${row.employee.name}` });
  };

  const processAll = () => {
    const pending = processRows.filter(r => !r.processed);
    if (pending.length === 0) {
      toast({ title: hi ? 'सभी वेतन पहले से प्रोसेस हो चुके हैं' : 'All salaries already processed', variant: 'destructive' });
      return;
    }
    pending.forEach(row => { addSalaryRecord(salaryRecordFromRow(row)); });
    setProcessRows(rows => rows.map(r => ({ ...r, processed: true })));
    toast({ title: hi ? `${pending.length} कर्मचारियों का वेतन प्रोसेस किया गया` : `${pending.length} salaries processed` });
  };

  // ── Tab 3 handlers ───────────────────────────────────────────────────────

  const handleMarkPaid = () => {
    if (!markPaidId) return;
    updateSalaryRecord(markPaidId, { isPaid: true, paidDate: markPaidDate, paymentMode: markPaidMode, bankAccountId: markPaidMode === 'bank' ? (markPaidBankId || undefined) : undefined });
    toast({ title: hi ? 'भुगतान चिह्नित किया गया' : 'Marked as paid' });
    setMarkPaidId(null);
  };

  const handleSalaryCSV = () => {
    const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || id;
    const headers = ['Slip No', 'Month', 'Employee', 'Net Salary', 'Payment Mode', 'Status'];
    const rows = salaryRecords.map(r => [r.slipNo || '', r.month || '', getEmpName(r.employeeId), r.netSalary || 0, r.paymentMode || '', r.isPaid ? 'Paid' : 'Pending']);
    downloadCSV(headers, rows, 'salary_history.csv');
  };
  const handleSalaryExcel = () => {
    const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || id;
    const headers = ['Slip No', 'Month', 'Employee', 'Net Salary', 'Payment Mode', 'Status'];
    const rows = salaryRecords.map(r => [r.slipNo || '', r.month || '', getEmpName(r.employeeId), r.netSalary || 0, r.paymentMode || '', r.isPaid ? 'Paid' : 'Pending']);
    downloadExcelSingle(headers, rows, 'salary_history.xlsx', 'Salary History');
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
                          {fmtDate(emp.joinDate)}
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
                              onClick={() => handleDeleteEmpClick(emp)}
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
                <div className="space-y-1">
                  <Label>{hi ? 'TDS व्यवस्था' : 'TDS Regime'}</Label>
                  <Select value={taxRegime} onValueChange={v => reprojectTds(v as TaxRegime)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">{hi ? 'नई व्यवस्था' : 'New regime'}</SelectItem>
                      <SelectItem value="old">{hi ? 'पुरानी व्यवस्था' : 'Old regime'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadEmployees} className="gap-2">
                  <Users className="h-4 w-4" />
                  {hi ? 'कर्मचारी लोड करें' : 'Load Employees'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{hi ? 'TDS स्वतः projected (वार्षिक अनुमान से मासिक) — हर पंक्ति में बदल सकते हैं।' : 'TDS is auto-projected (annual estimate → monthly) — editable per row.'}</p>
              {/* WHICH YEAR'S LAW produced this number. It used to say nothing, and an
                  auto-filled figure that says nothing is taken as settled — that is how
                  FY 2024-25 slabs quietly computed FY 2026-27 salaries. The projection is
                  editable, so the clerk can act on this; they just have to be told. */}
              {/* A CLOSED period must not be silently recomputed (ECR-07 / RULE 6). The
                  cumulative TDS engine would happily re-derive an old month, and the
                  figures would look authoritative — but that year is settled with the
                  department. Per the CA: correct it with a TDS correction statement, not
                  a quiet re-run. Say why, and say the way out. */}
              {periodClosed && (
                <p className="text-[11px] mt-1 text-destructive font-medium">
                  {hi
                    ? `🔒 ${processingMonth} एक बंद अवधि में है (${society.periodLockDate} तक लॉक)। इस महीने का वेतन/TDS दोबारा नहीं गिना जाएगा — बंद वर्ष का सुधार TDS correction statement से होता है, चुपचाप दोबारा गणना से नहीं।`
                    : `🔒 ${processingMonth} falls in a closed period (locked through ${society.periodLockDate}). Salary/TDS will not be recomputed — a settled year is corrected by a TDS correction statement, not a quiet re-run.`}
                </p>
              )}
              <p className={`text-[11px] mt-1 ${tdsStale ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {tdsBasisNote()}
              </p>
              {/* An over-deduction MUST be said out loud. Payroll cannot refund it — the
                  remaining months simply go to ₹0 — so if nobody tells the clerk, the
                  employee never learns they are owed money and quietly loses it. A silent
                  zero here would be the same class of defect as the FY 2024-25 slabs:
                  correct-looking, and wrong for the person. */}
              {/* Task B's payoff: name the route that applies instead of reciting both.
                  The "not deposited" case is the good one and it is TIME-BOXED — the
                  money is still with the society and can go back with this month's
                  salary, but only until the FY closes. A clerk told "it might be either"
                  does nothing; a clerk told "you are holding their money" acts. */}
              {excessRows.length > 0 && (
                <p className={`text-[11px] mt-1 font-medium ${excessDeposited ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'}`}>
                  {hi
                    ? `⚠️ ${excessRows.length} कर्मचारी से इस वर्ष ₹${totalExcess.toLocaleString('en-IN')} अधिक TDS कट चुका है। आगे के महीनों में ₹0 कटेगा। ` +
                      (excessDeposited
                        ? `यह राशि चालान से जमा हो चुकी है — इसलिए वेतन से वापस नहीं की जा सकती। कर्मचारी को ITR भरने पर refund मिलेगा (Form 26AS में क्रेडिट दिखेगा)।`
                        : `✅ यह राशि अभी चालान से जमा नहीं हुई — यानी पैसा अभी समिति के पास है और कर्मचारी को इसी वेतन में सीधे लौटाया जा सकता है। वित्तीय वर्ष बंद होने के बाद यह रास्ता बंद हो जाएगा। अपने CA से प्रक्रिया पूछ लें।`)
                    : `⚠️ ${excessRows.length} employee(s) have had ₹${totalExcess.toLocaleString('en-IN')} over-deducted this FY. Remaining months are ₹0. ` +
                      (excessDeposited
                        ? `It has already been deposited by challan, so payroll cannot refund it — the employee claims it via ITR (it shows as credit in Form 26AS).`
                        : `✅ It has NOT been deposited yet — the money is still with the society and can be returned directly in this month's salary. This route closes once the FY does. Confirm the procedure with your CA.`)}
                </p>
              )}
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
                          <TableHead className="font-semibold text-right">{hi ? 'उपस्थिति (दिन)' : 'Days'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'भत्ते' : 'Allowances'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'व्यावसायिक कर' : 'PT'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'TDS' : 'TDS'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'कटौती (PF/ESI+PT+TDS)' : 'Deductions (PF/ESI+PT+TDS)'}</TableHead>
                          <TableHead className="font-semibold text-right">{hi ? 'शुद्ध वेतन' : 'Net Salary'}</TableHead>
                          <TableHead className="font-semibold">{hi ? 'भुगतान विधि' : 'Payment Mode'}</TableHead>
                          <TableHead className="font-semibold text-center">{hi ? 'क्रिया' : 'Action'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processRows.map(row => {
                          const s = rowStatutory(row);              // effective (overrides applied)
                          const autoS = rowStatutory(row, false);   // auto baseline (for the override boxes)
                          const net = s.netSalary;
                          const pfEsiOverridden = row.pfEmployeeOverride !== null || row.pfEmployerOverride !== null
                            || row.esiEmployeeOverride !== null || row.esiEmployerOverride !== null;
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
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number" min="0" max={daysInMonth(processingMonth)}
                                    value={row.paidDays}
                                    onChange={e => updateRow(row.employee.id, 'paidDays', Number(e.target.value) || 0)}
                                    className="w-16 text-right h-8" disabled={row.processed}
                                  />
                                  <span className="text-[10px] text-muted-foreground">/{daysInMonth(processingMonth)}</span>
                                </div>
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
                                  type="number" min="0" value={row.pt || ''}
                                  onChange={e => updateRow(row.employee.id, 'pt', Number(e.target.value) || 0)}
                                  className="w-20 text-right h-8" disabled={row.processed} placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number" min="0" value={row.tds || ''}
                                  onChange={e => updateRow(row.employee.id, 'tds', Number(e.target.value) || 0)}
                                  className="w-20 text-right h-8" disabled={row.processed} placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div>
                                    <div className="font-medium text-sm">{fmt(s.totalEmployeeDeductions)}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      PF {fmt(s.pfEmployee)}{(s.esiEligible || s.esiEmployee > 0) ? ` · ESI ${fmt(s.esiEmployee)}` : ''}
                                      {pfEsiOverridden && <span className="ml-1 text-amber-600 dark:text-amber-500">• बदला गया</span>}
                                    </div>
                                  </div>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button" variant="ghost" size="icon"
                                        className={`h-7 w-7 shrink-0 ${pfEsiOverridden ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}
                                        disabled={row.processed}
                                        title={hi ? 'PF/ESI समायोजित करें' : 'Adjust PF/ESI'}
                                      >
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72" align="end">
                                      <p className="text-sm font-semibold mb-1">{hi ? 'PF / ESI समायोजित करें' : 'Adjust PF / ESI'}</p>
                                      <p className="text-[11px] text-muted-foreground mb-3">
                                        {hi ? 'खाली छोड़ने पर अपने-आप गणना (auto) लागू रहेगी।' : 'Leave blank to keep the auto-computed amount.'}
                                      </p>
                                      {([
                                        { key: 'pfEmployeeOverride' as const, label: hi ? 'PF — कर्मचारी' : 'PF — Employee', auto: autoS.pfEmployee, ov: row.pfEmployeeOverride },
                                        { key: 'pfEmployerOverride' as const, label: hi ? 'PF — नियोक्ता' : 'PF — Employer', auto: autoS.pfEmployer, ov: row.pfEmployerOverride },
                                        { key: 'esiEmployeeOverride' as const, label: hi ? 'ESI — कर्मचारी' : 'ESI — Employee', auto: autoS.esiEmployee, ov: row.esiEmployeeOverride },
                                        { key: 'esiEmployerOverride' as const, label: hi ? 'ESI — नियोक्ता' : 'ESI — Employer', auto: autoS.esiEmployer, ov: row.esiEmployerOverride },
                                      ]).map(f => (
                                        <div key={f.key} className="flex items-center justify-between gap-2 mb-2">
                                          <span className="text-xs w-28">{f.label}</span>
                                          <Input
                                            type="number" min="0"
                                            value={f.ov ?? ''}
                                            placeholder={fmt(f.auto).replace('₹', '')}
                                            onChange={e => updateRow(row.employee.id, f.key, e.target.value === '' ? null : (Number(e.target.value) || 0))}
                                            className="w-24 text-right h-8"
                                          />
                                          <Button
                                            type="button" variant="ghost" size="icon"
                                            className="h-7 w-7 shrink-0"
                                            disabled={f.ov === null}
                                            title={hi ? 'auto पर लौटाएँ' : 'Reset to auto'}
                                            onClick={() => updateRow(row.employee.id, f.key, null)}
                                          >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </PopoverContent>
                                  </Popover>
                                </div>
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
          {/* History header with export */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {hi ? 'वेतन इतिहास' : 'Salary History'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSalaryCSV} className="gap-1">
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handleSalaryExcel} className="gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQ24Open(true)} className="gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {hi ? 'फॉर्म 24Q' : 'Form 24Q'}
              </Button>
            </div>
          </div>
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
                                    setMarkPaidBankId(record.bankAccountId || '');
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

      {/* ── Delete Employee Guard ─────────────────────────────────────────── */}
      <LinkedDeleteDialog
        open={deleteEmpGuard.open}
        onOpenChange={o => setDeleteEmpGuard(g => ({ ...g, open: o }))}
        entityName={deleteEmpGuard.name}
        links={deleteEmpGuard.links}
        language={hi ? 'hi' : 'en'}
        onConfirmDelete={() => {
          if (deleteEmpGuard.id) {
            deleteEmployee(deleteEmpGuard.id);
            toast({ title: hi ? 'कर्मचारी हटाया गया' : 'Employee deleted' });
          }
        }}
      />

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
            {markPaidMode === 'bank' && (
              <div className="space-y-1">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={markPaidBankId} onValueChange={setMarkPaidBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'बैंक चुनें' : 'Select bank'} /></SelectTrigger>
                  <SelectContent>
                    {getBankAccountIds(accounts).map(id => accounts.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a).map(a => (
                      <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

      {/* ECR-14: Form 24Q — quarterly salary TDS return */}
      <Dialog open={q24Open} onOpenChange={setQ24Open}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{hi ? 'फॉर्म 24Q — त्रैमासिक वेतन TDS' : 'Form 24Q — Quarterly Salary TDS'} ({society.financialYear})</DialogTitle>
            <DialogDescription>{hi ? 'चुनी हुई तिमाही में हर कर्मचारी का वेतन व TDS सारांश।' : 'Per-employee salary + TDS summary for the selected quarter.'}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={q24Quarter} onValueChange={v => setQ24Quarter(v as Quarter)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1">Q1 (Apr–Jun)</SelectItem>
                <SelectItem value="Q2">Q2 (Jul–Sep)</SelectItem>
                <SelectItem value="Q3">Q3 (Oct–Dec)</SelectItem>
                <SelectItem value="Q4">Q4 (Jan–Mar)</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="gap-1" onClick={export24Q} disabled={form24Q.rows.length === 0}>
              <Download className="h-4 w-4" />CSV
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {form24Q.totals.deductees} {hi ? 'कर्मचारी' : 'deductees'} · TDS <strong>{fmt(form24Q.totals.tds)}</strong>
            </span>
          </div>
          <div className="max-h-[55vh] overflow-y-auto mt-2">
            {form24Q.rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{hi ? 'इस तिमाही में कोई वेतन रिकॉर्ड नहीं।' : 'No salary records in this quarter.'}</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'कर्म. नं.' : 'Emp No.'}</TableHead>
                  <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead className="text-right">{hi ? 'सकल वेतन' : 'Gross Salary'}</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {form24Q.rows.map(r => (
                    <TableRow key={r.empNo + r.name}>
                      <TableCell className="font-mono text-xs">{r.empNo}</TableCell>
                      <TableCell className="text-sm">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.pan || <span className="text-destructive">{hi ? 'PAN नहीं' : 'no PAN'}</span>}</TableCell>
                      <TableCell className="text-right">{fmt(r.grossSalary)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.tds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalaryManagement;
