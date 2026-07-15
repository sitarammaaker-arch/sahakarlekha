import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { trackEvent } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AccountPicker } from '@/components/AccountPicker';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, ArrowDownLeft, ArrowUpRight, RefreshCw, Save, X, Trash2, CheckCircle, RotateCcw, EyeOff, Eye, Pencil, Printer, Zap, Settings2, ArrowLeft, ArrowLeftRight, Search, FileSpreadsheet, Download, HandCoins } from 'lucide-react';
import BillWiseSettlement from '@/components/BillWiseSettlement';
import { generateVoucherPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { VoucherType, VoucherLine } from '@/types';
import { Plus, Minus } from 'lucide-react';
import { getNextVoucherNo, VOUCHER_TEMPLATES, ACCOUNT_IDS, getBankAccountIds } from '@/lib/storage';
import type { LedgerAccount } from '@/types';
import { validateVoucher } from '@/lib/validation';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';

type EntryMode = 'aasan' | 'expert';

// Searchable account combobox — type account name/id to filter
const Vouchers: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, can } = useAuth();
  // ECR-06 17-role: gate affordances on the RBAC permission model, not a hardcoded legacy
  // role list — so operational roles (cashier, manager, …) can enter/edit vouchers while
  // viewer/boardMember stay read-only. Uses `update` (not `create`): the auditor family's
  // `create` is scoped to audit objections, so `update` keeps them read-only on financial
  // pages — byte-identical to the old hardcoded gate for all 4 legacy roles.
  const canEdit = can('update');    // create + edit + reverse (correction)
  const canDelete = can('delete');  // cancel / restore — admin/societyAdmin/secretary only
  const { accounts, members, vouchers, sales, purchases, customers, suppliers, society, addVoucher, updateVoucher, cancelVoucher, reverseVoucher, restoreVoucher, getTrialBalance, matchesActiveBranch } = useData();
  const [submitForApproval, setSubmitForApproval] = useState(false);
  const { toast } = useToast();

  // P1-4: Alert when any expense account develops an abnormal credit balance after a voucher save.
  // Uses a ref to track voucher count so the effect fires only when a new voucher is added (not on mount).
  const prevVoucherCountRef = useRef(vouchers.filter(v => !v.isDeleted).length);
  useEffect(() => {
    const activeCount = vouchers.filter(v => !v.isDeleted).length;
    if (activeCount <= prevVoucherCountRef.current) { prevVoucherCountRef.current = activeCount; return; }
    prevVoucherCountRef.current = activeCount;
    const tb = getTrialBalance();
    const abnormal = tb.filter(b => b.account.type === 'expense' && b.netBalance < 0);
    if (abnormal.length > 0) {
      const names = abnormal.map(b => b.account.name).join(', ');
      toast({
        title: language === 'hi' ? 'असामान्य शेष राशि चेतावनी' : 'Abnormal Balance Warning',
        description: language === 'hi'
          ? `इन व्यय खातों में क्रेडिट शेष आ गया है: ${names}। कृपया जांचें।`
          : `These expense accounts have an abnormal credit balance: ${names}. Please verify.`,
        variant: 'destructive',
      });
    }
  }, [vouchers]);

  const [activeTab, setActiveTab] = useState<'entry' | 'list'>('entry');
  const [entryMode, setEntryMode] = useState<EntryMode>(() => {
    return (localStorage.getItem('sahayata_entry_mode') as EntryMode) || 'aasan';
  });
  const [selectedTemplate, setSelectedTemplate] = useState<typeof VOUCHER_TEMPLATES[0] | null>(null);
  // Bill-wise settlement (Tally "Against Reference") opened inline within the voucher screen.
  const [billWiseMode, setBillWiseMode] = useState<'receive' | 'pay' | null>(null);

  const switchMode = (mode: EntryMode) => {
    setEntryMode(mode);
    localStorage.setItem('sahayata_entry_mode', mode);
    setSelectedTemplate(null);
    handleClear();
  };

  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [contraDir, setContraDir] = useState<'cash_to_bank' | 'bank_to_cash'>('cash_to_bank');
  const bankIds = useMemo(() => getBankAccountIds(accounts), [accounts]);
  const [contraBankId, setContraBankId] = useState('');
  // Easy templates hardcode the bank side to the '3302' Bank Accounts GROUP. When the society
  // has real bank child accounts, substitute the first one (a postable account, never a group)
  // so a cash↔bank contra never posts to a group; the simplified form lets the operator pick
  // WHICH bank among several. (Fixes: contra posted to a group + no bank choice in Easy mode.)
  const applyTemplate = (tmpl: typeof VOUCHER_TEMPLATES[0]) => {
    const realBank = bankIds[0] || ACCOUNT_IDS.BANK;
    setSelectedTemplate(tmpl);
    setVoucherType(tmpl.type);
    setDebitAccount(tmpl.debitAccountId === ACCOUNT_IDS.BANK ? realBank : tmpl.debitAccountId);
    setCreditAccount(tmpl.creditAccountId === ACCOUNT_IDS.BANK ? realBank : tmpl.creditAccountId);
    setSavedVoucherNo(null);
  };
  // Which side of the selected template is the bank — drives the Easy-mode bank picker.
  const bankTplSide: 'debit' | 'credit' | null = !selectedTemplate ? null
    : selectedTemplate.debitAccountId === ACCOUNT_IDS.BANK ? 'debit'
    : selectedTemplate.creditAccountId === ACCOUNT_IDS.BANK ? 'credit' : null;
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [linkedMemberId, setLinkedMemberId] = useState('');
  const [voucherNoInput, setVoucherNoInput] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  // ECR-08: reversal reason dialog
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [savedVoucherNo, setSavedVoucherNo] = useState<string | null>(null);

  // Multi-line expert mode state
  type LineEntry = { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: string; narration: string };
  const makeBlankLine = (type: 'Dr' | 'Cr'): LineEntry => ({ id: crypto.randomUUID(), accountId: '', type, amount: '', narration: '' });
  const [lines, setLines] = useState<LineEntry[]>(() => [makeBlankLine('Dr'), makeBlankLine('Cr')]);

  const drTotal = lines.filter(l => l.type === 'Dr').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const crTotal = lines.filter(l => l.type === 'Cr').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const lineDiff = Math.abs(drTotal - crTotal);
  const linesBalanced = drTotal > 0 && crTotal > 0 && lineDiff < 0.001;

  const handleAddLine = (type: 'Dr' | 'Cr') => setLines(prev => [...prev, makeBlankLine(type)]);
  const handleRemoveLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const handleLineChange = (id: string, field: keyof LineEntry, value: string) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const handleClearLines = () => setLines([makeBlankLine('Dr'), makeBlankLine('Cr')]);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<VoucherType>('receipt');
  const [editDebit, setEditDebit] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNarration, setEditNarration] = useState('');
  const [editMemberId, setEditMemberId] = useState('');

  // ── Print voucher PDF (A5, Tally-style narrative) ──────────────────────────
  const handlePrintVoucher = (voucherId: string) => {
    const v = vouchers.find(x => x.id === voucherId);
    if (!v) return;
    // If this voucher is linked to a sale/purchase, prefer the customer/supplier
    // name+address for the "from/to" narrative line.
    let partyName: string | undefined;
    let partyAddress: string | undefined;
    if (v.refType === 'sale' && v.refId) {
      const sale = sales.find(s => s.id === v.refId);
      if (sale) {
        const cust = sale.customerId ? customers.find(c => c.id === sale.customerId) : undefined;
        partyName = cust?.legalName || cust?.name || sale.customerName;
        partyAddress = [cust?.addressLine1 || cust?.address, cust?.city, cust?.state, cust?.pincode ? `PIN: ${cust.pincode}` : null].filter(Boolean).join(', ');
      }
    } else if (v.refType === 'purchase' && v.refId) {
      const purchase = purchases.find(p => p.id === v.refId);
      if (purchase) {
        const sup = purchase.supplierId ? suppliers.find(s => s.id === purchase.supplierId) : undefined;
        partyName = sup?.legalName || sup?.name || purchase.supplierName;
        partyAddress = [sup?.addressLine1 || sup?.address, sup?.city, sup?.state, sup?.pincode ? `PIN: ${sup.pincode}` : null].filter(Boolean).join(', ');
      }
    }
    try {
      generateVoucherPDF({
        voucher: {
          id: v.id,
          voucherNo: v.voucherNo,
          type: v.type,
          date: v.date,
          debitAccountId: v.debitAccountId,
          creditAccountId: v.creditAccountId,
          amount: v.amount,
          narration: v.narration,
          memberId: v.memberId,
          createdBy: v.createdBy,
          lines: v.lines,
        },
        accounts,
        members,
        partyName,
        partyAddress: partyAddress || undefined,
      }, society);
      toast({ title: language === 'hi' ? `Voucher PDF: ${v.voucherNo}` : `Voucher PDF: ${v.voucherNo}` });
    } catch (err) {
      toast({ title: language === 'hi' ? 'PDF नहीं बना' : 'PDF generation failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const openEdit = (v: { id: string; date: string; type: VoucherType; debitAccountId: string; creditAccountId: string; amount: number; narration?: string; memberId?: string; refType?: string }) => {
    if (v.refType === 'purchase') {
      toast({ title: language === 'hi' ? 'वाउचर यहाँ से edit नहीं होगा' : 'Cannot edit here', description: language === 'hi' ? 'Purchase Management से edit करें' : 'Edit from Purchase Management', variant: 'destructive' });
      return;
    }
    if (v.refType === 'sale') {
      toast({ title: language === 'hi' ? 'वाउचर यहाँ से edit नहीं होगा' : 'Cannot edit here', description: language === 'hi' ? 'Sale Management से edit करें' : 'Edit from Sale Management', variant: 'destructive' });
      return;
    }
    setEditId(v.id);
    setEditDate(v.date);
    setEditType(v.type);
    setEditDebit(v.debitAccountId);
    setEditCredit(v.creditAccountId);
    setEditAmount(String(v.amount));
    setEditNarration(v.narration || '');
    setEditMemberId(v.memberId || '');
  };

  const handleEditSave = () => {
    if (!editId) return;
    const eResult = validateVoucher(editDebit, editCredit, editAmount, editDate, accounts, society, editType);
    if (!eResult.valid) {
      toast({ title: eResult.errors[0], variant: 'destructive' });
      return;
    }
    if (eResult.warnings.length > 0) {
      toast({ title: language === 'hi' ? 'चेतावनी' : 'Warning', description: eResult.warnings[0] });
    }
    updateVoucher(editId, {
      type: editType,
      date: editDate,
      debitAccountId: editDebit,
      creditAccountId: editCredit,
      amount: Number(editAmount),
      narration: editNarration,
      memberId: editMemberId || undefined,
    });
    toast({ title: language === 'hi' ? 'वाउचर अपडेट किया गया' : 'Voucher updated successfully' });
    setEditId(null);
  };

  const voucherConfig = {
    receipt: {
      icon: ArrowDownLeft,
      bgColor: 'bg-success',
      label: language === 'hi' ? 'रसीद वाउचर' : 'Receipt Voucher',
      description: language === 'hi' ? 'नकद/बैंक रसीद के लिए' : 'For cash/bank receipts',
    },
    payment: {
      icon: ArrowUpRight,
      bgColor: 'bg-destructive',
      label: language === 'hi' ? 'भुगतान वाउचर' : 'Payment Voucher',
      description: language === 'hi' ? 'नकद/बैंक भुगतान के लिए' : 'For cash/bank payments',
    },
    journal: {
      icon: RefreshCw,
      bgColor: 'bg-info',
      label: language === 'hi' ? 'जर्नल वाउचर' : 'Journal Voucher',
      description: language === 'hi' ? 'समायोजन एंट्री के लिए' : 'For adjustment entries',
    },
    contra: {
      icon: ArrowLeftRight,
      bgColor: 'bg-purple-600',
      label: language === 'hi' ? 'कोंट्रा वाउचर' : 'Contra Voucher',
      description: language === 'hi' ? 'नकद ↔ बैंक हस्तांतरण के लिए' : 'For Cash ↔ Bank transfers',
    },
  };

  const currentVoucher = voucherConfig[voucherType];
  const VoucherIcon = currentVoucher.icon;

  // Expert mode multi-line submit (called from handleExpertSubmit)
  const handleExpertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linesBalanced) {
      toast({ title: language === 'hi' ? 'डेबिट और क्रेडिट का योग बराबर होना चाहिए' : 'Debit and Credit totals must be equal', variant: 'destructive' });
      return;
    }
    const emptyAcc = lines.find(l => !l.accountId || !(parseFloat(l.amount) > 0));
    if (emptyAcc) {
      toast({ title: language === 'hi' ? 'सभी पंक्तियों में खाता और राशि भरें' : 'All lines must have an account and amount', variant: 'destructive' });
      return;
    }
    const customNo = voucherNoInput.trim();
    if (customNo && vouchers.some(v => !v.isDeleted && v.voucherNo === customNo)) {
      toast({ title: language === 'hi' ? 'यह वाउचर नंबर पहले से मौजूद है' : 'Voucher number already exists', variant: 'destructive' });
      return;
    }
    const vLines: VoucherLine[] = lines.map(l => ({
      id: l.id,
      accountId: l.accountId,
      type: l.type,
      amount: parseFloat(l.amount),
      narration: l.narration || undefined,
    }));
    const drAccId = lines.find(l => l.type === 'Dr')?.accountId || '';
    const crAccId = lines.find(l => l.type === 'Cr')?.accountId || '';
    const v = addVoucher({
      type: voucherType,
      date: voucherDate,
      lines: vLines,
      debitAccountId: drAccId,
      creditAccountId: crAccId,
      amount: drTotal,
      narration,
      memberId: linkedMemberId || undefined,
      createdBy: user?.name || 'System',
      voucherNo: customNo || undefined,
      approvalStatus: submitForApproval ? 'pending' : undefined,
      origin: 'manual',   // ECR-11: subject to the approval matrix (threshold / all-manual)
    });
    setSavedVoucherNo(v.voucherNo);
    toast({ title: language === 'hi' ? 'वाउचर सहेजा गया' : 'Voucher saved', description: v.voucherNo });
    if (v.id) trackEvent('voucher_created', { type: v.type, mode: 'expert' });
    handleClear();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For Contra: auto-set Dr/Cr based on direction
    if (voucherType === 'contra') {
      const selectedBankForContra = contraBankId || bankIds[0] || ACCOUNT_IDS.BANK;
      const drAcc = contraDir === 'cash_to_bank' ? selectedBankForContra : ACCOUNT_IDS.CASH;
      const crAcc = contraDir === 'cash_to_bank' ? ACCOUNT_IDS.CASH : selectedBankForContra;
      setDebitAccount(drAcc);
      setCreditAccount(crAcc);
      if (!amount || Number(amount) <= 0) {
        toast({ title: language === 'hi' ? 'राशि दर्ज करें' : 'Enter amount', variant: 'destructive' });
        return;
      }
      const customNo = voucherNoInput.trim();
      const v = addVoucher({
        type: 'contra',
        date: voucherDate,
        debitAccountId: drAcc,
        creditAccountId: crAcc,
        amount: Number(amount),
        narration,
        createdBy: user?.name || 'System',
        voucherNo: customNo || undefined,
        approvalStatus: submitForApproval ? 'pending' : undefined,
      origin: 'manual',   // ECR-11: subject to the approval matrix (threshold / all-manual)
      });
      setSavedVoucherNo(v.voucherNo);
      toast({ title: language === 'hi' ? 'कोंट्रा वाउचर सहेजा गया' : 'Contra Voucher saved', description: v.voucherNo });
    if (v.id) trackEvent('voucher_created', { type: v.type, mode: 'contra' });
      handleClear();
      return;
    }
    // ── Double-entry validation (6 rules) ────────────────────────────────────
    const vResult = validateVoucher(debitAccount, creditAccount, amount, voucherDate, accounts, society, voucherType);
    if (!vResult.valid) {
      toast({ title: vResult.errors[0], variant: 'destructive' });
      return;
    }
    if (vResult.warnings.length > 0) {
      toast({ title: language === 'hi' ? 'चेतावनी' : 'Warning', description: vResult.warnings[0] });
    }
    const customNo = voucherNoInput.trim();
    if (customNo && vouchers.some(v => !v.isDeleted && v.voucherNo === customNo)) {
      toast({ title: language === 'hi' ? 'यह वाउचर नंबर पहले से मौजूद है' : 'Voucher number already exists', variant: 'destructive' });
      return;
    }
    const v = addVoucher({
      type: voucherType,
      date: voucherDate,
      debitAccountId: debitAccount,
      creditAccountId: creditAccount,
      amount: Number(amount),
      narration,
      memberId: linkedMemberId || undefined,
      createdBy: user?.name || 'System',
      voucherNo: customNo || undefined,
      approvalStatus: submitForApproval ? 'pending' : undefined,
      origin: 'manual',   // ECR-11: subject to the approval matrix (threshold / all-manual)
    });
    setSavedVoucherNo(v.voucherNo);
    toast({ title: language === 'hi' ? 'वाउचर सहेजा गया' : 'Voucher saved', description: `${v.voucherNo}` });
    if (v.id) trackEvent('voucher_created', { type: v.type, mode: 'simple' });
    handleClear();
  };

  const handleClear = () => {
    setDebitAccount('');
    setCreditAccount('');
    setAmount('');
    setNarration('');
    setLinkedMemberId('');
    setVoucherNoInput('');
    setSavedVoucherNo(null);
    handleClearLines();
  };

  // ECR-17: honour the active branch — the Trial Balance / Day Book are branch-scoped, so the list
  // you drill into must be too, or the numbers contradict each other ('all' = no filter, as ever).
  const branchVouchers = vouchers.filter(v => matchesActiveBranch(v.branchId));
  const sortedVouchers = branchVouchers
    .filter(v => showCancelled ? v.isDeleted : !v.isDeleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeCount = branchVouchers.filter(v => !v.isDeleted).length;
  const cancelledCount = branchVouchers.filter(v => v.isDeleted).length;

  // A sale/purchase voucher still actively referenced by its parent CANNOT be cancelled
  // here — it must be deleted from Sale/Purchase Management so stock + sub-ledger reverse.
  const cancelTarget = cancelId ? vouchers.find(x => x.id === cancelId) : null;
  const cancelLinkedActive = !!cancelTarget && (
    (cancelTarget.refType === 'sale' && sales.find(s => s.id === cancelTarget.refId)?.voucherId === cancelTarget.id) ||
    (cancelTarget.refType === 'purchase' && purchases.find(p => p.id === cancelTarget.refId)?.voucherId === cancelTarget.id)
  );

  const typeBadgeClass = (type: VoucherType) => {
    if (type === 'receipt') return 'bg-success/20 text-success border-success/30';
    if (type === 'payment') return 'bg-destructive/20 text-destructive border-destructive/30';
    if (type === 'contra') return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300';
    return 'bg-info/20 text-info border-info/30';
  };

  const typeLabel = (type: VoucherType) => {
    if (type === 'receipt') return language === 'hi' ? 'रसीद' : 'Receipt';
    if (type === 'payment') return language === 'hi' ? 'भुगतान' : 'Payment';
    if (type === 'contra') return language === 'hi' ? 'कोंट्रा' : 'Contra';
    return language === 'hi' ? 'जर्नल' : 'Journal';
  };

  const handleCSV = () => {
    const getAccName = (id: string) => accounts.find(a => a.id === id)?.name || id;
    const getDr = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.type === 'Dr').map(l => getAccName(l.accountId)).join('; ');
    const getCr = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.type === 'Cr').map(l => getAccName(l.accountId)).join('; ');
    const headers = ['Voucher No', 'Date', 'Type', 'Debit Account', 'Credit Account', 'Amount', 'Narration'];
    const allVouchers = branchVouchers.filter(v => !v.isDeleted);
    const rows = allVouchers.map(v => [v.voucherNo || '', v.date, v.type, getDr(v), getCr(v), v.amount, v.narration || '']);
    downloadCSV(headers, rows, 'vouchers.csv');
  };
  const handleExcel = () => {
    const getAccName = (id: string) => accounts.find(a => a.id === id)?.name || id;
    const getDr = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.type === 'Dr').map(l => getAccName(l.accountId)).join('; ');
    const getCr = (v: typeof vouchers[0]) => getVoucherLines(v).filter(l => l.type === 'Cr').map(l => getAccName(l.accountId)).join('; ');
    const headers = ['Voucher No', 'Date', 'Type', 'Debit Account', 'Credit Account', 'Amount', 'Narration'];
    const allVouchers = branchVouchers.filter(v => !v.isDeleted);
    const rows = allVouchers.map(v => [v.voucherNo || '', v.date, v.type, getDr(v), getCr(v), v.amount, v.narration || '']);
    downloadExcelSingle(headers, rows, 'vouchers.xlsx', 'Vouchers');
  };

  // ── Bill-wise settlement (Tally "Against Reference") — shared by Aasan & Expert modes ──
  const billWiseTiles = (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <HandCoins className="h-4 w-4 text-primary" />
        {language === 'hi' ? 'बिल-वार निपटान (Against Reference)' : 'Bill-wise Settlement (Against Reference)'}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <button
          onClick={() => setBillWiseMode('receive')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-success/5 hover:border-success/40 hover:bg-success/10 transition-all text-center"
        >
          <span className="text-3xl">🧾</span>
          <span className="text-sm font-medium text-foreground leading-tight">{language === 'hi' ? 'ग्राहक से वसूली' : 'Receive from Customer'}</span>
        </button>
        <button
          onClick={() => setBillWiseMode('pay')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-destructive/5 hover:border-destructive/30 hover:bg-destructive/10 transition-all text-center"
        >
          <span className="text-3xl">💵</span>
          <span className="text-sm font-medium text-foreground leading-tight">{language === 'hi' ? 'आपूर्तिकर्ता को भुगतान' : 'Pay Supplier'}</span>
        </button>
      </div>
    </div>
  );
  const billWisePanel = billWiseMode && (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setBillWiseMode(null)}>
        <ArrowLeft className="h-4 w-4" /> {language === 'hi' ? 'वापस' : 'Back'}
      </Button>
      <BillWiseSettlement mode={billWiseMode} compact onDone={() => { setBillWiseMode(null); setActiveTab('list'); }} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            {t('vouchers')}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'वाउचर एंट्री प्रणाली' : 'Voucher Entry System'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Mode Toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => switchMode('aasan')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                entryMode === 'aasan'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              {language === 'hi' ? 'आसान' : 'Easy'}
            </button>
            <button
              onClick={() => switchMode('expert')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l',
                entryMode === 'expert'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {language === 'hi' ? 'विशेषज्ञ' : 'Expert'}
            </button>
          </div>
          <Button variant={activeTab === 'entry' ? 'default' : 'outline'} onClick={() => setActiveTab('entry')}>
            {language === 'hi' ? 'नई एंट्री' : 'New Entry'}
          </Button>
          <Button variant={activeTab === 'list' ? 'default' : 'outline'} onClick={() => setActiveTab('list')}>
            {language === 'hi' ? 'सूची' : 'List'} ({activeCount})
          </Button>
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExcel} className="gap-1">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {activeTab === 'entry' && (
        <>
          {savedVoucherNo && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30 text-success">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                {language === 'hi' ? 'वाउचर सफलतापूर्वक सहेजा गया:' : 'Voucher saved successfully:'} {savedVoucherNo}
              </span>
            </div>
          )}

          {billWisePanel}

          {/* ── AASAN MODE ── */}
          {entryMode === 'aasan' && !billWiseMode && (
            <div className="space-y-4">
              {!selectedTemplate && billWiseTiles}
              {!selectedTemplate ? (
                /* Template selection grid */
                <div className="space-y-4">
                  {/* Receipt templates */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                      {language === 'hi' ? 'पैसा आया (रसीद)' : 'Money Received (Receipt)'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {VOUCHER_TEMPLATES.filter(t => t.category === 'receipt').map(tmpl => (
                        <button
                          key={tmpl.id}
                          onClick={() => applyTemplate(tmpl)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-success/5 hover:border-success/40 hover:bg-success/10 transition-all text-center"
                        >
                          <span className="text-3xl">{tmpl.icon}</span>
                          <span className="text-sm font-medium text-foreground leading-tight">
                            {language === 'hi' ? tmpl.labelHi : tmpl.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Payment templates */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                      {language === 'hi' ? 'पैसा गया (भुगतान)' : 'Money Paid (Payment)'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {VOUCHER_TEMPLATES.filter(t => t.category === 'payment').map(tmpl => (
                        <button
                          key={tmpl.id}
                          onClick={() => applyTemplate(tmpl)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-destructive/5 hover:border-destructive/30 hover:bg-destructive/10 transition-all text-center"
                        >
                          <span className="text-3xl">{tmpl.icon}</span>
                          <span className="text-sm font-medium text-foreground leading-tight">
                            {language === 'hi' ? tmpl.labelHi : tmpl.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Simplified entry form after template selected */
                <Card className="shadow-card">
                  <div className={cn('p-4 rounded-t-lg flex items-center justify-between text-white', selectedTemplate.category === 'receipt' ? 'bg-success' : 'bg-destructive')}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{selectedTemplate.icon}</span>
                      <div>
                        <h2 className="font-bold text-lg">
                          {language === 'hi' ? selectedTemplate.labelHi : selectedTemplate.label}
                        </h2>
                        <p className="text-sm text-white/80">
                          {(() => {
                            const dr = accounts.find(a => a.id === selectedTemplate.debitAccountId);
                            const cr = accounts.find(a => a.id === selectedTemplate.creditAccountId);
                            return `Dr: ${language === 'hi' ? dr?.nameHi : dr?.name} / Cr: ${language === 'hi' ? cr?.nameHi : cr?.name}`;
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-white/60 text-xs mb-1">{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</p>
                        <Input
                          value={voucherNoInput}
                          onChange={e => setVoucherNoInput(e.target.value)}
                          placeholder={getNextVoucherNo(selectedTemplate.type, society.financialYear, vouchers)}
                          className="h-8 w-36 text-sm bg-white/20 border-white/30 text-white placeholder:text-white/50 text-right"
                        />
                      </div>
                      <button
                        onClick={() => { setSelectedTemplate(null); handleClear(); }}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors ml-2"
                        title={language === 'hi' ? 'वापस जाएं' : 'Go back'}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">{t('date')}</Label>
                          <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12 text-lg" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">{t('amount')} (₹)</Label>
                          <Input
                            type="number" step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            min="1"
                            className="h-12 text-2xl font-bold text-center"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                      {/* Bank picker for cash↔bank templates — choose WHICH bank (never post to the group). */}
                      {bankTplSide && bankIds.length >= 1 && (
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">{language === 'hi' ? 'बैंक खाता' : 'Bank Account'}</Label>
                          <select
                            value={bankTplSide === 'debit' ? debitAccount : creditAccount}
                            onChange={e => bankTplSide === 'debit' ? setDebitAccount(e.target.value) : setCreditAccount(e.target.value)}
                            className="h-12 w-full rounded-md border border-input bg-background px-3 text-lg"
                          >
                            {bankIds.map(bid => {
                              const acc = accounts.find(a => a.id === bid);
                              return <option key={bid} value={bid}>{acc?.name || bid}{acc?.nameHi && language === 'hi' ? ` (${acc.nameHi})` : ''}</option>;
                            })}
                          </select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">{t('narration')} ({language === 'hi' ? 'वैकल्पिक' : 'Optional'})</Label>
                        <Input
                          value={narration}
                          onChange={(e) => setNarration(e.target.value)}
                          placeholder={language === 'hi' ? 'विवरण...' : 'Details...'}
                          className="h-11"
                        />
                      </div>
                      {members.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">
                            {language === 'hi' ? 'सदस्य से लिंक करें (वैकल्पिक)' : 'Link to Member (Optional)'}
                          </Label>
                          <Select value={linkedMemberId || '__none__'} onValueChange={v => setLinkedMemberId(v === '__none__' ? '' : v)}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={language === 'hi' ? 'कोई सदस्य नहीं' : 'No member linked'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{language === 'hi' ? 'कोई नहीं' : 'None'}</SelectItem>
                              {members.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.memberId} — {m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pb-2">
                        <input
                          type="checkbox"
                          id="approvalChk1"
                          checked={submitForApproval}
                          onChange={e => setSubmitForApproval(e.target.checked)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="approvalChk1" className="text-sm text-gray-600 cursor-pointer">
                          {language === 'hi' ? 'अनुमोदन हेतु भेजें (Maker-Checker)' : 'Submit for Approval (Maker-Checker)'}
                        </label>
                      </div>
                      <div className="flex gap-3 pt-2 border-t">
                        <Button type="submit" size="lg" className="flex-1 h-12 text-lg gap-2">
                          <Save className="h-5 w-5" />
                          {submitForApproval ? (language === 'hi' ? 'अनुमोदन हेतु भेजें' : 'Submit for Approval') : t('save')}
                        </Button>
                        <Button type="button" variant="outline" size="lg" className="gap-2" onClick={() => { setSelectedTemplate(null); handleClear(); }}>
                          <X className="h-5 w-5" />
                          {language === 'hi' ? 'रद्द' : 'Cancel'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── EXPERT MODE ── */}
          {entryMode === 'expert' && !billWiseMode && (
          <div className="space-y-4">
          {billWiseTiles}
          <Tabs value={voucherType} onValueChange={(v) => { setVoucherType(v as VoucherType); setSavedVoucherNo(null); handleClear(); }}>
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="receipt" className="gap-1.5">
                <ArrowDownLeft className="h-4 w-4" />
                {language === 'hi' ? 'रसीद' : 'Receipt'}
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-1.5">
                <ArrowUpRight className="h-4 w-4" />
                {language === 'hi' ? 'भुगतान' : 'Payment'}
              </TabsTrigger>
              <TabsTrigger value="contra" className="gap-1.5">
                <ArrowLeftRight className="h-4 w-4" />
                {language === 'hi' ? 'कोंट्रा' : 'Contra'}
              </TabsTrigger>
              <TabsTrigger value="journal" className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                {language === 'hi' ? 'जर्नल' : 'Journal'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={voucherType} className="mt-6">
              <Card className="shadow-card">
                <div className={cn('p-4 rounded-t-lg flex items-center justify-between text-white', currentVoucher.bgColor)}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <VoucherIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{currentVoucher.label}</h2>
                      <p className="text-sm text-white/80">{currentVoucher.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-xs mb-1">{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</p>
                    <Input
                      value={voucherNoInput}
                      onChange={e => setVoucherNoInput(e.target.value)}
                      placeholder={getNextVoucherNo(voucherType, society.financialYear, vouchers)}
                      className="h-8 w-36 text-sm bg-white/20 border-white/30 text-white placeholder:text-white/50 text-right"
                    />
                  </div>
                </div>

                <CardContent className="pt-6">
                  <form onSubmit={voucherType === 'contra' ? handleSubmit : handleExpertSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">{t('date')}</Label>
                        <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-12 text-lg" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">{language === 'hi' ? 'वाउचर प्रकार' : 'Voucher Type'}</Label>
                        <div className="h-12 flex items-center">
                          <Badge className={cn('text-base px-4 py-2', currentVoucher.bgColor)}>{currentVoucher.label}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Contra: direction picker */}
                    {voucherType === 'contra' && (
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">{language === 'hi' ? 'हस्तांतरण दिशा' : 'Transfer Direction'}</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setContraDir('cash_to_bank')}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                              contraDir === 'cash_to_bank'
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-border hover:border-purple-300'
                            )}
                          >
                            <span className="text-2xl">💵→🏦</span>
                            <span className="text-sm font-semibold">{language === 'hi' ? 'नकद → बैंक में जमा' : 'Cash → Bank Deposit'}</span>
                            <span className="text-xs text-muted-foreground">Dr: Bank / Cr: Cash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setContraDir('bank_to_cash')}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                              contraDir === 'bank_to_cash'
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-border hover:border-purple-300'
                            )}
                          >
                            <span className="text-2xl">🏦→💵</span>
                            <span className="text-sm font-semibold">{language === 'hi' ? 'बैंक से नकद निकाला' : 'Bank → Cash Withdrawal'}</span>
                            <span className="text-xs text-muted-foreground">Dr: Cash / Cr: Bank</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Contra bank selector — show whenever at least one bank ledger
                        exists, so the user can always see/choose which bank account the
                        transfer uses (not only when there are 2+ banks). */}
                    {voucherType === 'contra' && bankIds.length >= 1 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{language === 'hi' ? 'बैंक खाता' : 'Bank Account'}</Label>
                        <select
                          value={contraBankId || bankIds[0] || ACCOUNT_IDS.BANK}
                          onChange={e => setContraBankId(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          {bankIds.map(bid => {
                            const acc = accounts.find(a => a.id === bid);
                            return <option key={bid} value={bid}>{acc?.name || bid}{acc?.nameHi && language === 'hi' ? ` (${acc.nameHi})` : ''}</option>;
                          })}
                        </select>
                        {bankIds.length === 1 && (
                          <p className="text-xs text-muted-foreground">
                            {language === 'hi'
                              ? 'और बैंक खाते जोड़ने के लिए: Ledger Heads → "Bank Accounts" के नीचे नया खाता बनाएं।'
                              : 'To add more bank accounts: Ledger Heads → create an account under "Bank Accounts".'}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Multi-line entry table (hidden for Contra) ── */}
                    {voucherType !== 'contra' && (
                      <div className="space-y-3">
                        <Label className="text-base font-semibold">{language === 'hi' ? 'नाम-जमा पंक्तियाँ' : 'Debit / Credit Lines'}</Label>
                        <div className="rounded-lg border overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/40 border-b">
                                <th className="w-8 text-xs font-medium text-left px-3 py-2">#</th>
                                <th className="text-xs font-medium text-left px-3 py-2">{language === 'hi' ? 'खाता' : 'Account'}</th>
                                <th className="w-20 text-xs font-medium text-left px-3 py-2">Dr/Cr</th>
                                <th className="w-32 text-xs font-medium text-left px-3 py-2">{language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}</th>
                                <th className="text-xs font-medium text-left px-3 py-2">{language === 'hi' ? 'विवरण' : 'Narration'}</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((line, idx) => (
                                <tr key={line.id} className={`border-b last:border-0 ${line.type === 'Dr' ? 'bg-blue-50/30' : 'bg-green-50/30'}`}>
                                  <td className="text-xs text-muted-foreground py-2 px-3">{idx + 1}</td>
                                  <td className="py-1 px-1 relative">
                                    <AccountPicker
                                      value={line.accountId}
                                      onChange={id => handleLineChange(line.id, 'accountId', id)}
                                      triggerClassName="h-11"
                                    />
                                  </td>
                                  <td className="py-1 px-1">
                                    <Select value={line.type} onValueChange={v => handleLineChange(line.id, 'type', v)}>
                                      <SelectTrigger className="h-9 w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Dr"><span className="font-bold text-blue-700">Dr</span></SelectItem>
                                        <SelectItem value="Cr"><span className="font-bold text-green-700">Cr</span></SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-1 px-1">
                                    <Input
                                      type="number" step="any"
                                      value={line.amount}
                                      onChange={e => handleLineChange(line.id, 'amount', e.target.value)}
                                      placeholder="0"
                                      min="0"
                                      className="h-9 text-right font-mono"
                                    />
                                  </td>
                                  <td className="py-1 px-1">
                                    <Input
                                      value={line.narration}
                                      onChange={e => handleLineChange(line.id, 'narration', e.target.value)}
                                      placeholder={language === 'hi' ? 'विवरण...' : 'Note...'}
                                      className="h-9"
                                    />
                                  </td>
                                  <td className="py-1 px-1">
                                    {lines.length > 2 && (
                                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleRemoveLine(line.id)}>
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Add line buttons */}
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-blue-700 border-blue-300" onClick={() => handleAddLine('Dr')}>
                            <Plus className="h-3.5 w-3.5" />
                            {language === 'hi' ? 'डेबिट पंक्ति जोड़ें' : 'Add Dr Line'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-green-700 border-green-300" onClick={() => handleAddLine('Cr')}>
                            <Plus className="h-3.5 w-3.5" />
                            {language === 'hi' ? 'क्रेडिट पंक्ति जोड़ें' : 'Add Cr Line'}
                          </Button>
                        </div>
                        {/* Balance indicator */}
                        <div className={cn(
                          'flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium',
                          linesBalanced ? 'bg-success/10 border border-success/30 text-success' : 'bg-amber-50 border border-amber-300 text-amber-700'
                        )}>
                          <div className="flex gap-4">
                            <span>{language === 'hi' ? 'नाम (Dr)' : 'Dr'}: <strong>₹{drTotal.toLocaleString('hi-IN')}</strong></span>
                            <span>{language === 'hi' ? 'जमा (Cr)' : 'Cr'}: <strong>₹{crTotal.toLocaleString('hi-IN')}</strong></span>
                          </div>
                          {linesBalanced
                            ? <span className="flex items-center gap-1">{language === 'hi' ? 'संतुलित' : 'Balanced'} ✓</span>
                            : <span>{language === 'hi' ? 'अंतर' : 'Diff'}: ₹{lineDiff.toLocaleString('hi-IN')}</span>
                          }
                        </div>
                      </div>
                    )}

                    {/* Contra still uses single amount */}
                    {voucherType === 'contra' && (
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">{t('amount')} (₹)</Label>
                      <Input
                        type="number" step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        min="1"
                        className="h-14 text-2xl font-bold text-center"
                        required
                      />
                      {amount && Number(amount) > 0 && (
                        <p className="text-sm text-muted-foreground text-center">
                          {new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(amount))}
                        </p>
                      )}
                    </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">{t('narration')}</Label>
                      <Textarea
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder={language === 'hi' ? 'लेनदेन का विवरण लिखें...' : 'Enter transaction details...'}
                        className="min-h-20 text-base"
                      />
                    </div>

                    {members.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">
                          {language === 'hi' ? 'सदस्य से लिंक करें (वैकल्पिक)' : 'Link to Member (Optional)'}
                        </Label>
                        <Select
                          value={linkedMemberId || '__none__'}
                          onValueChange={v => setLinkedMemberId(v === '__none__' ? '' : v)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={language === 'hi' ? 'कोई सदस्य नहीं' : 'No member linked'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{language === 'hi' ? 'कोई नहीं' : 'None'}</SelectItem>
                            {members.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.memberId} — {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {language === 'hi' ? 'यह लेनदेन सदस्य के लेजर में दिखेगा' : 'This transaction will appear in the member\'s share ledger'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        id="approvalChk2"
                        checked={submitForApproval}
                        onChange={e => setSubmitForApproval(e.target.checked)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="approvalChk2" className="text-sm text-gray-600 cursor-pointer">
                        {language === 'hi' ? 'अनुमोदन हेतु भेजें (Maker-Checker)' : 'Submit for Approval (Maker-Checker)'}
                      </label>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                      <Button type="submit" size="lg" className="flex-1 h-12 text-lg gap-2" disabled={voucherType !== 'contra' && !linesBalanced}>
                        <Save className="h-5 w-5" />
                        {submitForApproval ? (language === 'hi' ? 'अनुमोदन हेतु भेजें' : 'Submit for Approval') : t('save')}
                      </Button>
                      <Button type="button" variant="outline" size="lg" className="gap-2" onClick={handleClear}>
                        <X className="h-5 w-5" />
                        {language === 'hi' ? 'साफ़ करें' : 'Clear'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
          )}
        </>
      )}

      {activeTab === 'list' && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {showCancelled
                ? (language === 'hi' ? `रद्द वाउचर (${cancelledCount})` : `Cancelled Vouchers (${cancelledCount})`)
                : (language === 'hi' ? `सभी वाउचर (${activeCount})` : `All Vouchers (${activeCount})`)}
            </CardTitle>
            {cancelledCount > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCancelled(s => !s)}>
                {showCancelled ? <><Eye className="h-4 w-4" />{language === 'hi' ? 'सक्रिय दिखाएं' : 'Show Active'}</> : <><EyeOff className="h-4 w-4" />{language === 'hi' ? `रद्द (${cancelledCount})` : `Cancelled (${cancelledCount})`}</>}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {sortedVouchers.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{t('noData')}</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">{t('voucherNo')}</TableHead>
                      <TableHead className="font-semibold">{t('date')}</TableHead>
                      <TableHead className="font-semibold">{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                      <TableHead className="font-semibold">{language === 'hi' ? 'डेबिट खाता' : 'Debit A/c'}</TableHead>
                      <TableHead className="font-semibold">{language === 'hi' ? 'क्रेडिट खाता' : 'Credit A/c'}</TableHead>
                      <TableHead className="font-semibold text-right">{t('amount')}</TableHead>
                      <TableHead className="font-semibold">{t('narration')}</TableHead>
                      <TableHead className="font-semibold text-center">{language === 'hi' ? 'क्रिया' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVouchers.map(v => {
                      const drLines = getVoucherLines(v).filter(l => l.type === 'Dr');
                      const crLines = getVoucherLines(v).filter(l => l.type === 'Cr');
                      const debitAcc = accounts.find(a => a.id === drLines[0]?.accountId);
                      const creditAcc = accounts.find(a => a.id === crLines[0]?.accountId);
                      const cancelled = !!v.isDeleted;
                      // ECR-08: reversed / reversal entries are edit-locked; correct via reversal.
                      const editLocked = !!v.reversedBy || (!!society.approvalRequired && v.approvalStatus === 'approved');
                      return (
                        <TableRow key={v.id} className={cn('hover:bg-muted/30', cancelled && 'opacity-50 bg-red-50/30 dark:bg-red-900/10')}>
                          <TableCell>
                            <Badge variant="outline" className={cn('font-mono text-xs', cancelled && 'line-through opacity-60')}>{v.voucherNo}</Badge>
                            {cancelled && <Badge variant="destructive" className="ml-1 text-xs py-0">{language === 'hi' ? 'रद्द' : 'Cancelled'}</Badge>}
                            {v.reversedBy && <Badge className="ml-1 text-xs py-0 bg-amber-100 text-amber-800 border-amber-300">{language === 'hi' ? 'उलटा गया' : 'Reversed'}</Badge>}
                            {v.reversalOf && <Badge className="ml-1 text-xs py-0 bg-blue-100 text-blue-800 border-blue-300">{language === 'hi' ? 'रिवर्सल' : 'Reversal'}</Badge>}
                          </TableCell>
                          <TableCell className={cn('font-medium', cancelled && 'line-through')}>
                            {fmtDate(v.date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeBadgeClass(v.type)}>
                              {typeLabel(v.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn('text-sm', cancelled && 'line-through')}>
                            {language === 'hi' ? debitAcc?.nameHi : debitAcc?.name}
                          </TableCell>
                          <TableCell className={cn('text-sm', cancelled && 'line-through')}>
                            {language === 'hi' ? creditAcc?.nameHi : creditAcc?.name}
                          </TableCell>
                          <TableCell className={cn('text-right font-semibold', cancelled && 'line-through')}>
                            {new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                            {cancelled ? <span className="text-destructive text-xs">{v.deletedReason || 'Cancelled'}</span> : v.narration}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:bg-green-50"
                                title={language === 'hi' ? 'Voucher PDF' : 'Voucher PDF'}
                                onClick={() => handlePrintVoucher(v.id)}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              {canEdit && !cancelled && !editLocked && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10"
                                  title={language === 'hi' ? 'संपादित करें' : 'Edit'}
                                  onClick={() => openEdit(v)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canEdit && !cancelled && !v.reversedBy && !v.reversalOf && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 hover:bg-amber-50"
                                  title={language === 'hi' ? 'रिवर्स करें (Reversal voucher बनेगा)' : 'Reverse (posts a reversal voucher)'}
                                  onClick={() => { setReverseId(v.id); setReverseReason(''); }}>
                                  <ArrowLeftRight className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (cancelled ? (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:text-blue-700" title={language === 'hi' ? 'पुनर्स्थापित करें' : 'Restore'}
                                  onClick={() => restoreVoucher(v.id)}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => { setCancelId(v.id); setCancelReason(''); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Voucher Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'वाउचर संपादित करें' : 'Edit Voucher'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('date')}</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>{language === 'hi' ? 'वाउचर प्रकार' : 'Voucher Type'}</Label>
                <Select value={editType} onValueChange={v => setEditType(v as VoucherType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">{language === 'hi' ? 'रसीद' : 'Receipt'}</SelectItem>
                    <SelectItem value="payment">{language === 'hi' ? 'भुगतान' : 'Payment'}</SelectItem>
                    <SelectItem value="journal">{language === 'hi' ? 'जर्नल' : 'Journal'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-destructive font-bold">Dr.</span> {language === 'hi' ? 'नाम खाता' : 'Debit Account'}</Label>
              <AccountPicker value={editDebit} onChange={setEditDebit} triggerClassName="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-success font-bold">Cr.</span> {language === 'hi' ? 'जमा खाता' : 'Credit Account'}</Label>
              <AccountPicker value={editCredit} onChange={setEditCredit} triggerClassName="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('amount')} (₹)</Label>
              <Input type="number" step="any" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="1" className="h-10 text-lg font-bold text-center" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('narration')}</Label>
              <Textarea value={editNarration} onChange={e => setEditNarration(e.target.value)} rows={2} placeholder={language === 'hi' ? 'विवरण...' : 'Narration...'} />
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label>{language === 'hi' ? 'सदस्य (वैकल्पिक)' : 'Member (Optional)'}</Label>
                <Select value={editMemberId || '__none__'} onValueChange={v => setEditMemberId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'hi' ? 'कोई नहीं' : 'None'}</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.memberId} — {m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="gap-1.5">
              <X className="h-4 w-4" />{language === 'hi' ? 'रद्द' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={handleEditSave} className="gap-1.5">
              <Save className="h-4 w-4" />{language === 'hi' ? 'सहेजें' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelId} onOpenChange={open => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'hi' ? 'वाउचर रद्द करें?' : 'Cancel Voucher?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'hi'
                ? 'यह वाउचर रद्द (cancelled) किया जाएगा। यह लेखांकन से हट जाएगा लेकिन ऑडिट रिकॉर्ड में रहेगा।'
                : 'This voucher will be marked as cancelled. It will be excluded from accounts but remain in audit records.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Warning for purchase/sale linked vouchers — only show "go to module" when the
              parent record actually points to THIS voucher. If it points elsewhere (or
              parent doesn't exist), this is a duplicate/orphan and is safe to cancel here. */}
          {cancelId && (() => {
            const v = vouchers.find(x => x.id === cancelId);
            if (v?.refType === 'purchase') {
              const parent = purchases.find(p => p.id === v.refId);
              const isActive = parent && parent.voucherId === v.id;
              if (isActive) return (
                <div className="mx-4 mb-2 p-3 bg-orange-50 border border-orange-300 rounded text-sm text-orange-800">
                  ⚠️ <strong>{language === 'hi' ? 'चेतावनी:' : 'Warning:'}</strong>{' '}
                  {language === 'hi'
                    ? 'यह वाउचर Purchase Management से बना है — इसे यहाँ रद्द नहीं किया जा सकता। Purchase Management → Purchase List से delete करें (तभी stock भी सही रहेगा)।'
                    : 'This voucher was created by Purchase Management — it cannot be cancelled here. Delete it from Purchase Management → Purchase List (so stock stays correct).'}
                </div>
              );
              return (
                <div className="mx-4 mb-2 p-3 bg-blue-50 border border-blue-300 rounded text-sm text-blue-800">
                  ℹ️ <strong>{language === 'hi' ? 'Orphan/Duplicate:' : 'Orphan/Duplicate:'}</strong>{' '}
                  {language === 'hi'
                    ? 'यह purchase voucher है पर इसका parent purchase अब इसे reference नहीं करता (duplicate/orphan है)। यहाँ से safely cancel कर सकते हैं।'
                    : 'This is a purchase voucher whose parent purchase no longer references it (duplicate/orphan). It is safe to cancel here.'}
                </div>
              );
            }
            if (v?.refType === 'sale') {
              const parent = sales.find(s => s.id === v.refId);
              const isActive = parent && parent.voucherId === v.id;
              if (isActive) return (
                <div className="mx-4 mb-2 p-3 bg-orange-50 border border-orange-300 rounded text-sm text-orange-800">
                  ⚠️ <strong>{language === 'hi' ? 'चेतावनी:' : 'Warning:'}</strong>{' '}
                  {language === 'hi'
                    ? 'यह वाउचर Sale Management से बना है — इसे यहाँ रद्द नहीं किया जा सकता। Sale Management → Sale List से delete करें (तभी stock वापस आएगी)।'
                    : 'This voucher was created by Sale Management — it cannot be cancelled here. Delete it from Sale Management → Sale List (so stock is restored).'}
                </div>
              );
              return (
                <div className="mx-4 mb-2 p-3 bg-blue-50 border border-blue-300 rounded text-sm text-blue-800">
                  ℹ️ <strong>{language === 'hi' ? 'Orphan/Duplicate:' : 'Orphan/Duplicate:'}</strong>{' '}
                  {language === 'hi'
                    ? 'यह sale voucher है पर इसका parent sale अब इसे reference नहीं करता (duplicate/orphan है)। यहाँ से safely cancel कर सकते हैं।'
                    : 'This is a sale voucher whose parent sale no longer references it (duplicate/orphan). It is safe to cancel here.'}
                </div>
              );
            }
            return null;
          })()}
          <div className="px-4 pb-2">
            <Label className="text-sm font-medium">{language === 'hi' ? 'रद्द करने का कारण *' : 'Cancellation Reason *'}</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder={language === 'hi' ? 'कारण लिखें...' : 'Enter reason...'}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelId(null)}>{language === 'hi' ? 'वापस' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (cancelId && cancelReason.trim()) {
                  const ok = cancelVoucher(cancelId, cancelReason.trim(), user?.name || 'System');
                  if (ok) toast({ title: language === 'hi' ? 'वाउचर रद्द किया गया' : 'Voucher cancelled' });
                  setCancelId(null);
                }
              }}
              disabled={!cancelReason.trim() || cancelLinkedActive}
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel Voucher'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ECR-08: Reverse voucher (posts a linked contra reversal) */}
      <AlertDialog open={!!reverseId} onOpenChange={open => !open && setReverseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'hi' ? 'वाउचर रिवर्स करें?' : 'Reverse Voucher?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'hi'
                ? 'इस वाउचर को edit करने के बजाय एक Reversal voucher (उल्टी Dr/Cr entry) पोस्ट होगा। मूल और reversal दोनों ledger में रहेंगे (net zero) — audit के लिए दोनों दिखेंगे।'
                : 'Instead of editing, a Reversal voucher (contra Dr/Cr entry) will be posted. Both the original and the reversal stay in the ledger (net zero) — audit-visible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-4 pb-2">
            <Label className="text-sm font-medium">{language === 'hi' ? 'रिवर्स करने का कारण *' : 'Reversal Reason *'}</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder={language === 'hi' ? 'कारण लिखें...' : 'Enter reason...'}
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReverseId(null)}>{language === 'hi' ? 'वापस' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                if (reverseId && reverseReason.trim()) {
                  reverseVoucher(reverseId, reverseReason.trim());
                  setReverseId(null);
                }
              }}
              disabled={!reverseReason.trim()}
            >
              {language === 'hi' ? 'रिवर्स करें' : 'Reverse'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Vouchers;
