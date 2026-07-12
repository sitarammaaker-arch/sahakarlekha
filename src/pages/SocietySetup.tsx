import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { trackEvent } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Building2, Calendar, Wallet, Save, History, HardDrive, Download, Upload, AlertTriangle, Plus, Trash2, Lock, Unlock, FastForward, CheckCircle2, Warehouse } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getVoucherLines } from '@/lib/voucherUtils';
import { unlockAction } from '@/lib/dualControlUnlock';
import { NotificationChannelsCard } from '@/components/settings/NotificationChannelsCard';
import { SOCIETY_TYPES, INDIAN_STATES } from '@/lib/constants';
import { ucasReserveMinPct } from '@/lib/rules/ucas';
import { SOCIETY_TEMPLATES } from '@/lib/storage';
import type { SocietyType, VoucherType } from '@/types';

const SocietySetup: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { society, updateSociety, accounts, vouchers, updateAccount, addAccount, deleteAccount, resetAccounts, getAccountBalance, getTrialBalance, getProfitLoss, getReceiptsPayments } = useData();

  // ECR-07: period-lock date input (back-dating prevention)
  const [periodLockInput, setPeriodLockInput] = useState(society.periodLockDate || '');
  const handleSetPeriodLock = () => {
    if (!periodLockInput) return;
    updateSociety({ periodLockDate: periodLockInput, periodLockBy: 'Admin' });
    toast({ title: language === 'hi' ? 'अवधि लॉक की गई' : 'Period Locked', description: language === 'hi' ? `${periodLockInput} तक की सभी एंट्रियां अब लॉक हैं।` : `All entries up to ${periodLockInput} are now locked.` });
  };
  const handleClearPeriodLock = () => {
    updateSociety({ periodLockDate: undefined, periodLockBy: undefined });
    setPeriodLockInput('');
    toast({ title: language === 'hi' ? 'अवधि लॉक हटाई गई' : 'Period Lock Cleared', description: language === 'hi' ? 'अब पिछली अवधि में भी एंट्री हो सकती है।' : 'Back-dated entries are allowed again.' });
  };

  // ECR-11: approval matrix config (threshold + all-manual toggle)
  const [approvalThresholdInput, setApprovalThresholdInput] = useState(String(society.approvalThresholdAmount ?? ''));
  const saveApprovalThreshold = () => {
    updateSociety({ approvalThresholdAmount: approvalThresholdInput === '' ? undefined : Number(approvalThresholdInput) });
    toast({ title: language === 'hi' ? 'अनुमोदन सीमा सहेजी' : 'Approval threshold saved' });
  };
  // ECR-20: godown storage-loss norm %
  const [storageLossNormInput, setStorageLossNormInput] = useState(String(society.storageLossNormPct ?? ''));
  const saveStorageLossNorm = () => {
    updateSociety({ storageLossNormPct: storageLossNormInput === '' ? undefined : Number(storageLossNormInput) });
    toast({ title: language === 'hi' ? 'भंडारण-हानि norm सहेजा' : 'Storage-loss norm saved' });
  };
  const toggleApprovalRequired = () => {
    const next = !society.approvalRequired;
    updateSociety({ approvalRequired: next });
    toast({ title: next ? (language === 'hi' ? 'हर manual वाउचर अनुमोदन-आवश्यक' : 'All manual vouchers need approval') : (language === 'hi' ? 'सभी-manual अनुमोदन बंद' : 'All-manual approval off') });
  };
  // ECR-11: per-type approval rule — toggle a voucher type that always needs approval.
  const APPROVAL_VOUCHER_TYPES: { value: VoucherType; label: string }[] = [
    { value: 'receipt', label: language === 'hi' ? 'रसीद' : 'Receipt' },
    { value: 'payment', label: language === 'hi' ? 'भुगतान' : 'Payment' },
    { value: 'journal', label: language === 'hi' ? 'जर्नल' : 'Journal' },
    { value: 'contra', label: language === 'hi' ? 'कॉन्ट्रा' : 'Contra' },
    { value: 'purchase', label: language === 'hi' ? 'खरीद' : 'Purchase' },
    { value: 'sale', label: language === 'hi' ? 'बिक्री' : 'Sale' },
    { value: 'debit_note', label: language === 'hi' ? 'डेबिट नोट' : 'Debit Note' },
    { value: 'credit_note', label: language === 'hi' ? 'क्रेडिट नोट' : 'Credit Note' },
  ];
  const toggleApprovalType = (type: VoucherType) => {
    const cur = society.approvalVoucherTypes ?? [];
    const next = cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type];
    updateSociety({ approvalVoucherTypes: next.length ? next : undefined });
    toast({ title: language === 'hi' ? 'प्रकार-वार अनुमोदन नियम सहेजा' : 'Per-type approval rule saved' });
  };

  // Basic info form state
  const [form, setForm] = useState({
    name: society.name,
    nameHi: society.nameHi,
    shortName: society.shortName || '',
    shortNameHi: society.shortNameHi || '',
    registrationNo: society.registrationNo,
    address: society.address,
    district: society.district,
    state: society.state,
    pinCode: society.pinCode,
    phone: society.phone,
    email: society.email,
    societyType: society.societyType || 'marketing_processing',
    // Statutory reserve minimum from the UCAS rule SSOT (T-16), not a local literal — national
    // default resolves to 25% (value-identical to the prior hardcoded fallback).
    reserveFundPct: society.reserveFundPct ?? ucasReserveMinPct({ asOf: new Date().toISOString() }),
    maintenanceGstEnabled: society.maintenanceGstEnabled ?? false,
    maintenanceGstRate: society.maintenanceGstRate ?? 18,
    gstin: society.gstin || '',
    tan: society.tan || '',
    entityPan: society.entityPan || '',
  });

  // Financial year form state
  const [fyForm, setFyForm] = useState({
    financialYear: society.financialYear,
    financialYearStart: society.financialYearStart,
  });

  // Opening balances: one entry per account
  const [obForm, setObForm] = useState<Record<string, string>>({});

  // Previous year balances
  const [pyForm, setPyForm] = useState<Record<string, string>>({});
  const [pyYear, setPyYear] = useState(society.previousFinancialYear || '');

  useEffect(() => {
    const init: Record<string, string> = {};
    accounts.forEach(a => { init[a.id] = String(a.openingBalance); });
    setObForm(init);
    const pyInit: Record<string, string> = {};
    accounts.forEach(a => { pyInit[a.id] = String(society.previousYearBalances?.[a.id] ?? ''); });
    setPyForm(pyInit);
  }, [accounts, society.previousYearBalances]);

  const handleSaveBasic = () => {
    updateSociety(form);
    toast({
      title: language === 'hi' ? 'सहेजा गया' : 'Saved',
      description: language === 'hi' ? 'समिति विवरण अपडेट हो गया' : 'Society details updated successfully',
    });
    trackEvent('society_setup_saved', { tab: 'basic' });
  };

  const handleSaveFY = () => {
    updateSociety(fyForm);
    toast({
      title: language === 'hi' ? 'सहेजा गया' : 'Saved',
      description: language === 'hi' ? 'वित्तीय वर्ष अपडेट हो गया' : 'Financial year updated',
    });
  };

  // ECR-07 dual-control: locking is single-admin; UNLOCKING needs a request by one
  // admin and approval by a different admin.
  const handleLockFY = () => {
    updateSociety({ fyLocked: true, fyLockedAt: new Date().toISOString().split('T')[0], fyLockedBy: user?.name || 'Admin', fyUnlockRequestedBy: undefined, fyUnlockRequestedAt: undefined });
    toast({ title: language === 'hi' ? `FY ${society.financialYear} लॉक किया गया` : `FY ${society.financialYear} Locked`, description: language === 'hi' ? 'अब इस वर्ष में कोई नई एंट्री नहीं हो सकती।' : 'No new vouchers can be added to this financial year.' });
  };
  const handleRequestUnlock = () => {
    updateSociety({ fyUnlockRequestedBy: user?.email || '', fyUnlockRequestedAt: new Date().toISOString().split('T')[0] });
    toast({ title: language === 'hi' ? 'अनलॉक अनुरोध दर्ज' : 'Unlock requested', description: language === 'hi' ? 'किसी दूसरे admin की मंज़ूरी के बाद FY अनलॉक होगा।' : 'A different admin must approve before the FY unlocks.' });
  };
  const handleApproveUnlock = () => {
    updateSociety({ fyLocked: false, fyLockedAt: undefined, fyLockedBy: undefined, fyUnlockRequestedBy: undefined, fyUnlockRequestedAt: undefined });
    toast({ title: language === 'hi' ? 'वित्तीय वर्ष अनलॉक किया गया' : 'Financial Year Unlocked', description: language === 'hi' ? 'दूसरे admin ने मंज़ूरी दी — अब नई एंट्रियां हो सकती हैं।' : 'Approved by a second admin — new entries are now allowed.' });
  };
  const handleCancelUnlock = () => {
    updateSociety({ fyUnlockRequestedBy: undefined, fyUnlockRequestedAt: undefined });
    toast({ title: language === 'hi' ? 'अनलॉक अनुरोध रद्द' : 'Unlock request cancelled' });
  };

  const handleSaveOB = () => {
    accounts.forEach(a => {
      const val = parseFloat(obForm[a.id] || '0');
      if (!isNaN(val) && val !== a.openingBalance) {
        updateAccount(a.id, { openingBalance: val });
      }
    });
    toast({
      title: language === 'hi' ? 'सहेजा गया' : 'Saved',
      description: language === 'hi' ? 'ओपनिंग बैलेंस अपडेट हो गया' : 'Opening balances updated',
    });
  };

  const handleSavePY = () => {
    const balances: Record<string, number> = {};
    accounts.filter(a => !a.isGroup).forEach(a => {
      const val = parseFloat(pyForm[a.id] || '0');
      if (!isNaN(val) && val !== 0) balances[a.id] = val;
    });
    updateSociety({ previousFinancialYear: pyYear, previousYearBalances: balances });
    toast({ title: language === 'hi' ? 'सहेजा गया' : 'Saved', description: language === 'hi' ? 'पिछले वर्ष की शेष राशि सहेजी गई' : 'Previous year balances saved' });
  };

  const handleFillFromCurrentClosing = () => {
    const filled: Record<string, string> = {};
    accounts.filter(a => !a.isGroup).forEach(a => {
      const bal = getAccountBalance(a.id);
      if (bal !== 0) filled[a.id] = String(Math.round(Math.abs(bal) * 100) / 100);
    });
    setPyForm(prev => ({ ...prev, ...filled }));
    toast({
      title: language === 'hi' ? 'वर्तमान वर्ष शेष भरा गया' : 'Filled from current year closing',
      description: language === 'hi' ? 'कृपया समीक्षा करें और सहेजें' : 'Please review and save',
    });
  };

  // --- Reset COA to Template (4-layer security) ---
  const [resetCoaOpen, setResetCoaOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const activeVoucherCount = vouchers.filter(v => !v.isDeleted).length;
  const isAdmin = user?.role === 'admin';

  const handleResetCoaClick = () => {
    // Security 1: Admin-only
    if (!isAdmin) {
      toast({ title: language === 'hi' ? 'केवल Admin ही COA रीसेट कर सकता है' : 'Only Admin can reset COA', variant: 'destructive' });
      return;
    }
    // Security 2: Block if vouchers exist
    if (activeVoucherCount > 0) {
      toast({
        title: language === 'hi' ? 'COA रीसेट नहीं हो सकता' : 'Cannot Reset COA',
        description: language === 'hi'
          ? `${activeVoucherCount} वाउचर मौजूद हैं। पहले सभी वाउचर हटाएं या नई समिति बनाएं।`
          : `${activeVoucherCount} vouchers exist. Delete all vouchers first or register a new society.`,
        variant: 'destructive',
      });
      return;
    }
    setResetConfirmText('');
    setResetCoaOpen(true);
  };

  const handleResetCoa = () => {
    // Security 3: Type-to-confirm
    if (resetConfirmText.trim().toLowerCase() !== society.name.trim().toLowerCase()) {
      toast({ title: language === 'hi' ? 'समिति का नाम सही नहीं है' : 'Society name does not match', variant: 'destructive' });
      return;
    }
    // Security 4: Auto-backup before reset
    try {
      const backupData = { accounts, society, timestamp: new Date().toISOString(), reason: 'pre-reset-backup' };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-before-reset-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* backup download failed — proceed anyway */ }

    const type = form.societyType || society.societyType || 'marketing_processing';
    const template = SOCIETY_TEMPLATES[type] || SOCIETY_TEMPLATES['marketing_processing'];
    resetAccounts(template);
    setResetCoaOpen(false);
    setResetConfirmText('');
    toast({
      title: language === 'hi' ? 'खाता संरचना रीसेट हो गई' : 'COA Reset to Template',
      description: language === 'hi'
        ? `${template.length} खाते लोड किए गए — ${SOCIETY_TYPES.find(t => t.value === type)?.labelHi || type}`
        : `${template.length} accounts loaded — ${SOCIETY_TYPES.find(t => t.value === type)?.label || type}`,
    });
  };

  // --- P5-1: New FY Rollover Wizard ---
  const [rolloverOpen, setRolloverOpen] = useState(false);

  // Un-appropriated surplus = net surplus − everything already moved out of Net Surplus
  // (1208) this FY to any reserve/fund/dividend/bonus. A positive value at rollover means
  // the surplus would carry forward un-appropriated (a bye-law concern) — warn, don't block.
  const unAppropriatedSurplus = useMemo(() => {
    let netProfit = 0;
    try { netProfit = getProfitLoss().netProfit || 0; } catch { netProfit = 0; }
    if (netProfit <= 0) return 0;
    const appropriated = vouchers
      .filter(v => !(v as { isDeleted?: boolean }).isDeleted && v.narration?.includes(society.financialYear))
      .reduce((sum, v) => {
        const lines = getVoucherLines(v);
        if (!lines.some(l => l.accountId === '1208' && l.type === 'Dr')) return sum;
        return sum + lines.filter(l => l.type === 'Cr' && l.accountId !== '1208').reduce((s, l) => s + l.amount, 0);
      }, 0);
    return Math.round((netProfit - appropriated) * 100) / 100;
  }, [getProfitLoss, vouchers, society.financialYear]);

  const handleRolloverFY = () => {
    const [startYY, endYY] = society.financialYear.split('-');
    const newFY = `${parseInt(startYY) + 1}-${String(parseInt(endYY) + 1).slice(-2)}`;

    // Snapshot BS closing balances → previousYearBalances
    const tb = getTrialBalance();
    const bsBalances: Record<string, number> = {};
    tb.filter(b => (b.account.type === 'asset' || b.account.type === 'equity' || b.account.type === 'liability') && !b.account.isGroup)
      .forEach(b => { if (Math.abs(b.netBalance) > 0.01) bsBalances[b.account.id] = b.netBalance; });

    // Snapshot I&E → previousYearIE
    const { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit } = getProfitLoss();
    const prevIE = { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit };

    // Snapshot R&P → previousYearRP
    const rpData = getReceiptsPayments();
    const prevRP = {
      openingCash: rpData.openingCash, openingBank: rpData.openingBank,
      receipts: rpData.receipts.map(r => ({ accountName: r.accountName, accountNameHi: r.accountNameHi || r.accountName, amount: r.amount })),
      payments: rpData.payments.map(p => ({ accountName: p.accountName, accountNameHi: p.accountNameHi || p.accountName, amount: p.amount })),
      closingCash: rpData.closingCash, closingBank: rpData.closingBank,
      totalReceipts: rpData.receipts.reduce((s, r) => s + r.amount, 0),
      totalPayments: rpData.payments.reduce((s, p) => s + p.amount, 0),
    };

    updateSociety({
      previousFinancialYear: society.financialYear,
      previousYearBalances: bsBalances,
      previousYearIE: prevIE,
      previousYearRP: prevRP,
      financialYear: newFY,
      fyLocked: false,
      fyLockedAt: undefined,
      fyLockedBy: undefined,
    });

    setRolloverOpen(false);
    toast({
      title: language === 'hi' ? `वित्त वर्ष ${newFY} प्रारंभ हुआ` : `Rolled over to FY ${newFY}`,
      description: language === 'hi'
        ? `पिछले वर्ष ${society.financialYear} के शेष सहेजे गए। अब ${newFY} में एंट्रियां करें।`
        : `Closing balances of ${society.financialYear} saved as previous year data. Start entries for ${newFY}.`,
    });
  };

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccForm, setNewAccForm] = useState({ name: '', nameHi: '', type: 'asset' as 'asset' | 'liability' | 'income' | 'expense', openingBalance: '0', openingBalanceType: 'debit' as 'debit' | 'credit' });

  const handleAddAccount = () => {
    if (!newAccForm.name.trim()) {
      toast({ title: language === 'hi' ? 'नाम आवश्यक है' : 'Name is required', variant: 'destructive' });
      return;
    }
    addAccount({
      name: newAccForm.name.trim(),
      nameHi: newAccForm.nameHi.trim() || newAccForm.name.trim(),
      type: newAccForm.type,
      openingBalance: parseFloat(newAccForm.openingBalance) || 0,
      openingBalanceType: newAccForm.openingBalanceType,
      isSystem: false,
    });
    setNewAccForm({ name: '', nameHi: '', type: 'asset', openingBalance: '0', openingBalanceType: 'debit' });
    setShowAddAccount(false);
    toast({ title: language === 'hi' ? 'खाता जोड़ा गया' : 'Account added' });
  };

  const handleDeleteAccount = (id: string, name: string) => {
    if (!window.confirm(language === 'hi' ? `"${name}" खाता हटाएं?` : `Delete account "${name}"?`)) return;
    deleteAccount(id);
    toast({ title: language === 'hi' ? 'खाता हटाया गया' : 'Account deleted' });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    const KEYS = [
      'sahayata_vouchers', 'sahayata_members', 'sahayata_accounts', 'sahayata_society',
      'sahayata_counters', 'sahayata_loans', 'sahayata_assets', 'sahayata_loan_counter',
      'sahayata_asset_counter', 'sahayata_audit_objections', 'sahayata_objection_counter',
    ];
    const backup: Record<string, unknown> = { _version: 1, _exportedAt: new Date().toISOString() };
    KEYS.forEach(k => {
      const val = localStorage.getItem(k);
      if (val) backup[k] = JSON.parse(val);
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sahayata_backup_${society.financialYear}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: language === 'hi' ? 'बैकअप तैयार' : 'Backup ready', description: language === 'hi' ? 'डेटा फ़ाइल डाउनलोड हो रही है' : 'Data file downloaded' });
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const KEYS = [
          'sahayata_vouchers', 'sahayata_members', 'sahayata_accounts', 'sahayata_society',
          'sahayata_counters', 'sahayata_loans', 'sahayata_assets', 'sahayata_loan_counter',
          'sahayata_asset_counter', 'sahayata_audit_objections', 'sahayata_objection_counter',
        ];
        KEYS.forEach(k => {
          if (data[k] !== undefined) localStorage.setItem(k, JSON.stringify(data[k]));
        });
        toast({ title: language === 'hi' ? 'डेटा पुनर्स्थापित' : 'Data restored', description: language === 'hi' ? 'पृष्ठ रीफ्रेश हो रहा है…' : 'Refreshing page…' });
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: language === 'hi' ? 'अमान्य बैकअप फ़ाइल' : 'Invalid backup file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Leaf accounts only (no group headers) for balance entry
  const leafAccounts = accounts.filter(a => !a.isGroup);
  const assetAccounts = leafAccounts.filter(a => a.type === 'asset');
  const liabilityAccounts = leafAccounts.filter(a => a.type === 'liability');
  const incomeAccounts = leafAccounts.filter(a => a.type === 'income');
  const expenseAccounts = leafAccounts.filter(a => a.type === 'expense');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" />
            {t('societySetup')}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'समिति का मास्टर विवरण व सेटिंग्स' : 'Society master details and settings'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 max-w-3xl h-auto gap-1">
          <TabsTrigger value="basic" className="gap-2">
            <Building2 className="h-4 w-4" />
            {language === 'hi' ? 'मूल विवरण' : 'Basic Info'}
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <Calendar className="h-4 w-4" />
            {language === 'hi' ? 'वित्तीय वर्ष' : 'Financial Year'}
          </TabsTrigger>
          <TabsTrigger value="opening" className="gap-1 text-xs sm:text-sm">
            <Wallet className="h-4 w-4" />
            {language === 'hi' ? 'ओपनिंग बैलेंस' : 'Opening Balance'}
          </TabsTrigger>
          <TabsTrigger value="prevyear" className="gap-1 text-xs sm:text-sm">
            <History className="h-4 w-4" />
            {language === 'hi' ? 'पिछला वर्ष' : 'Prev. Year'}
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-1 text-xs sm:text-sm">
            <HardDrive className="h-4 w-4" />
            {language === 'hi' ? 'बैकअप' : 'Backup'}
          </TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>{language === 'hi' ? 'समिति का विवरण' : 'Society Details'}</CardTitle>
              <CardDescription>
                {language === 'hi' ? 'समिति का पंजीकृत नाम और पता भरें' : 'Enter registered name and address'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'समिति का नाम (हिंदी)' : 'Society Name (Hindi)'} *</Label>
                  <Input
                    value={form.nameHi}
                    onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'समिति का नाम (English)' : 'Society Name (English)'} *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Short Name for mobile header display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>
                    {language === 'hi' ? 'संक्षिप्त नाम (हिंदी) — मोबाइल हेडर' : 'Short Name (Hindi) — Mobile Header'}
                    <span className="ml-1 text-xs text-muted-foreground">{language === 'hi' ? '(वैकल्पिक)' : '(optional)'}</span>
                  </Label>
                  <Input
                    value={form.shortNameHi}
                    onChange={e => setForm(f => ({ ...f, shortNameHi: e.target.value }))}
                    placeholder={language === 'hi' ? 'जैसे: सीएमएस रानियाँ' : 'e.g. CMS Rania'}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {language === 'hi' ? 'संक्षिप्त नाम (English) — मोबाइल हेडर' : 'Short Name (English) — Mobile Header'}
                    <span className="ml-1 text-xs text-muted-foreground">{language === 'hi' ? '(वैकल्पिक)' : '(optional)'}</span>
                  </Label>
                  <Input
                    value={form.shortName}
                    onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                    placeholder={language === 'hi' ? 'जैसे: CMS Rania' : 'e.g. CMS Rania'}
                    className="h-11"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                {language === 'hi'
                  ? '💡 संक्षिप्त नाम मोबाइल header में दिखेगा। PDF/रिपोर्ट में पूरा नाम ही दिखेगा। खाली रहने पर पूरा नाम truncate होकर दिखेगा।'
                  : '💡 Short name appears in mobile header. Full name is used in PDFs/reports. If blank, full name is shown truncated.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('registrationNo')} *</Label>
                  <Input
                    value={form.registrationNo}
                    onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'समिति का प्रकार' : 'Society Type'}</Label>
                  <Select
                    value={form.societyType}
                    onValueChange={v => setForm(f => ({ ...f, societyType: v as SocietyType }))}
                  >
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOCIETY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{language === 'hi' ? t.labelHi : t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" maxLength={15} className="h-11 font-mono" />
                  <p className="text-xs text-muted-foreground">{language === 'hi' ? 'GST पहचान संख्या (15 अंक)' : 'GST Identification Number (15 chars)'}</p>
                </div>
                <div className="space-y-2">
                  <Label>TAN</Label>
                  <Input value={form.tan} onChange={e => setForm(f => ({ ...f, tan: e.target.value.toUpperCase() }))} placeholder="AAAA11111A" maxLength={10} className="h-11 font-mono" />
                  <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कर कटौती खाता संख्या' : 'Tax Deduction Account No.'}</p>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'समिति PAN' : 'Society PAN'}</Label>
                  <Input value={form.entityPan} onChange={e => setForm(f => ({ ...f, entityPan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} className="h-11 font-mono" />
                  <p className="text-xs text-muted-foreground">{language === 'hi' ? 'स्थायी खाता संख्या' : 'Permanent Account Number'}</p>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'रिज़र्व फंड (%)' : 'Reserve Fund %'}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.reserveFundPct}
                    onChange={e => setForm(f => ({ ...f, reserveFundPct: Number(e.target.value) }))}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'सुझाव: 25% (वैकल्पिक — आवंटन के समय बदला जा सकता है)' : 'Suggested 25% (optional — can be changed at appropriation time)'}
                  </p>
                </div>
                {form.societyType === 'housing' && (
                  <>
                    <div className="space-y-2">
                      <Label>{language === 'hi' ? 'रखरखाव पर GST' : 'GST on Maintenance'}</Label>
                      <Select value={form.maintenanceGstEnabled ? 'yes' : 'no'} onValueChange={v => setForm(f => ({ ...f, maintenanceGstEnabled: v === 'yes' }))}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">{language === 'hi' ? 'नहीं' : 'No'}</SelectItem>
                          <SelectItem value="yes">{language === 'hi' ? 'हाँ, लागू करें' : 'Yes, apply'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {language === 'hi' ? 'CA की सलाह पर चालू करें — GST तभी लगता है जब प्रति-सदस्य रखरखाव ₹7,500/माह से अधिक AND समिति का टर्नओवर ₹20 लाख से अधिक हो।' : 'Enable on your CA’s advice — GST applies only if per-member maintenance exceeds ₹7,500/month AND society turnover exceeds ₹20 lakh.'}
                      </p>
                    </div>
                    {form.maintenanceGstEnabled && (
                      <div className="space-y-2">
                        <Label>{language === 'hi' ? 'GST दर (%)' : 'GST Rate (%)'}</Label>
                        <Input type="number" min={0} max={28} value={form.maintenanceGstRate} onChange={e => setForm(f => ({ ...f, maintenanceGstRate: Number(e.target.value) }))} className="h-11" />
                        <p className="text-xs text-muted-foreground">{language === 'hi' ? 'सामान्यतः 18%. कर योग्य मदें Charge Heads में "GST लागू" से चुनें।' : 'Usually 18%. Mark taxable heads with "GST applicable" in Charge Heads.'}</p>
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'खाता संरचना रीसेट' : 'Reset COA'}</Label>
                  <Button variant="outline" className="h-11 w-full border-destructive text-destructive hover:bg-destructive/10" onClick={handleResetCoaClick}>
                    {language === 'hi' ? 'COA टेम्पलेट से रीसेट करें' : 'Reset COA to Template'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'चयनित समिति प्रकार के अनुसार सभी खाते रीसेट करें' : 'Reset all accounts based on selected society type'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('address')} *</Label>
                <Textarea
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="min-h-20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'जिला' : 'District'}</Label>
                  <Input
                    value={form.district}
                    onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'राज्य' : 'State'}</Label>
                  <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{language === 'hi' ? s.labelHi : s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'पिन कोड' : 'PIN Code'}</Label>
                  <Input
                    value={form.pinCode}
                    onChange={e => setForm(f => ({ ...f, pinCode: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('phone')}</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveBasic} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Year */}
        <TabsContent value="financial" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>{t('financialYear')}</CardTitle>
              <CardDescription>
                {language === 'hi' ? 'वित्तीय वर्ष की सेटिंग्स' : 'Financial year settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'चालू वित्तीय वर्ष' : 'Current Financial Year'}</Label>
                  <Select
                    value={fyForm.financialYear}
                    onValueChange={v => setFyForm(f => ({ ...f, financialYear: v }))}
                  >
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const now = new Date();
                        const curYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                        const options: string[] = [];
                        for (let y = curYear + 1; y >= curYear - 5; y--) {
                          options.push(`${y}-${String(y + 1).slice(-2)}`);
                        }
                        const currentFY = `${curYear}-${String(curYear + 1).slice(-2)}`;
                        return options.map(fy => (
                          <SelectItem key={fy} value={fy}>{fy}{fy === currentFY ? ' (Current)' : ''}</SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'वर्ष प्रारंभ' : 'Year Start'}</Label>
                  <Select
                    value={fyForm.financialYearStart}
                    onValueChange={v => setFyForm(f => ({ ...f, financialYearStart: v }))}
                  >
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="april">{language === 'hi' ? '1 अप्रैल' : '1st April'}</SelectItem>
                      <SelectItem value="january">{language === 'hi' ? '1 जनवरी' : '1st January'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-700 font-medium">
                  ⚠️ {language === 'hi'
                    ? 'वित्तीय वर्ष बदलने से वाउचर नंबरिंग रीसेट होगी'
                    : 'Changing financial year will reset voucher numbering'}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveFY} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t('save')}
                </Button>
              </div>

              {/* FY Lock / Audit Lock */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${society.fyLocked ? 'border-destructive bg-destructive/5' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      {society.fyLocked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-amber-600" />}
                      <span className={society.fyLocked ? 'text-destructive' : 'text-amber-800 dark:text-amber-300'}>
                        {language === 'hi' ? 'ऑडिट लॉक' : 'Audit Lock'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {society.fyLocked
                        ? (language === 'hi'
                          ? `वित्तीय वर्ष ${society.financialYear} लॉक है। कोई नई एंट्री नहीं हो सकती। लॉक: ${society.fyLockedAt || ''}`
                          : `FY ${society.financialYear} is locked. No new entries allowed. Locked on: ${society.fyLockedAt || ''}`)
                        : (language === 'hi'
                          ? 'लॉक करने के बाद इस वित्तीय वर्ष में कोई नई वाउचर एंट्री नहीं हो सकती।'
                          : 'Locking prevents any new voucher entries for this financial year. Use after audit completion.')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {!society.fyLocked ? (
                      <Button variant="destructive" size="sm" className="gap-2" onClick={handleLockFY}>
                        <Lock className="h-4 w-4" />{language === 'hi' ? 'FY लॉक करें' : 'Lock FY'}
                      </Button>
                    ) : (() => {
                      const act = unlockAction({ locked: true, requestedBy: society.fyUnlockRequestedBy }, user?.email || '');
                      if (act === 'request') return (
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleRequestUnlock}>
                          <Unlock className="h-4 w-4" />{language === 'hi' ? 'अनलॉक अनुरोध करें' : 'Request unlock'}
                        </Button>
                      );
                      if (act === 'awaiting') return (
                        <div className="text-right space-y-1">
                          <p className="text-xs text-amber-700 dark:text-amber-400 max-w-[220px]">
                            {language === 'hi' ? 'आपने अनलॉक अनुरोध किया है — किसी दूसरे admin की मंज़ूरी बाकी है।' : 'You requested unlock — waiting for a different admin to approve.'}
                          </p>
                          <Button variant="ghost" size="sm" onClick={handleCancelUnlock}>{language === 'hi' ? 'अनुरोध रद्द करें' : 'Cancel request'}</Button>
                        </div>
                      );
                      return (
                        <div className="text-right space-y-1">
                          <p className="text-xs text-muted-foreground max-w-[220px]">
                            {language === 'hi' ? `अनलॉक अनुरोध: ${society.fyUnlockRequestedBy}` : `Unlock requested by ${society.fyUnlockRequestedBy}`}
                          </p>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={handleCancelUnlock}>{language === 'hi' ? 'रद्द' : 'Cancel'}</Button>
                            <Button variant="outline" size="sm" className="gap-2" onClick={handleApproveUnlock}>
                              <Unlock className="h-4 w-4" />{language === 'hi' ? 'अनलॉक मंज़ूर करें' : 'Approve unlock'}
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ECR-07: Period Lock (back-dating prevention) */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${society.periodLockDate ? 'border-destructive/60 bg-destructive/5' : 'border-muted bg-muted/30'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 font-semibold">
                      {society.periodLockDate ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                      <span className={society.periodLockDate ? 'text-destructive' : 'text-muted-foreground'}>
                        {language === 'hi' ? 'अवधि लॉक (बैक-डेटिंग रोक)' : 'Period Lock (back-dating)'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {society.periodLockDate
                        ? (language === 'hi'
                          ? `${society.periodLockDate} तक की अवधि लॉक है — उस तारीख या उससे पहले की वाउचर add/edit नहीं हो सकती।`
                          : `Period up to ${society.periodLockDate} is locked — vouchers dated on/before it cannot be added or edited.`)
                        : (language === 'hi'
                          ? 'किसी माह/अवधि के audit के बाद उस तारीख तक lock करें ताकि उसमें back-dated entry न हो सके।'
                          : 'Lock everything up to a date (e.g. after a month is audited) so no back-dated entries can slip in.')}
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <Input
                      type="date"
                      value={periodLockInput}
                      onChange={e => setPeriodLockInput(e.target.value)}
                      className="w-40 h-9"
                    />
                    <Button variant="destructive" size="sm" className="gap-2" onClick={handleSetPeriodLock} disabled={!periodLockInput}>
                      <Lock className="h-4 w-4" />{language === 'hi' ? 'लॉक करें' : 'Lock'}
                    </Button>
                    {society.periodLockDate && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleClearPeriodLock}>
                        <Unlock className="h-4 w-4" />{language === 'hi' ? 'हटाएं' : 'Clear'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* ECR-11: Approval rules (maker-checker matrix) */}
              <div className="mt-6 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 font-semibold text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      {language === 'hi' ? 'अनुमोदन नियम (Maker-Checker)' : 'Approval Rules (Maker-Checker)'}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'hi'
                        ? 'manual वाउचर तभी अनुमोदन हेतु रुकते हैं जब ये नियम लागू हों। ऑटो/सिस्टम वाउचर कभी नहीं रुकते।'
                        : 'Manual vouchers are held for approval only when these rules match. Auto/system vouchers are never held.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant={society.approvalRequired ? 'default' : 'outline'} size="sm" onClick={toggleApprovalRequired}>
                      {society.approvalRequired
                        ? (language === 'hi' ? 'हर manual वाउचर: चालू' : 'Every manual voucher: ON')
                        : (language === 'hi' ? 'हर manual वाउचर: बंद' : 'Every manual voucher: OFF')}
                    </Button>
                    <div className="flex items-end gap-2">
                      <div>
                        <Label className="text-xs">{language === 'hi' ? 'सीमा राशि ≥ (₹)' : 'Threshold ≥ (₹)'}</Label>
                        <Input type="number" min="0" value={approvalThresholdInput} onChange={e => setApprovalThresholdInput(e.target.value)} className="w-32 h-9 mt-1" placeholder="0" />
                      </div>
                      <Button variant="outline" size="sm" className="h-9" onClick={saveApprovalThreshold}>{language === 'hi' ? 'सहेजें' : 'Save'}</Button>
                    </div>
                  </div>
                  {/* ECR-11: per-type approval rules — types held regardless of amount */}
                  <div className="basis-full mt-2">
                    <Label className="text-xs">{language === 'hi' ? 'ये वाउचर प्रकार हमेशा अनुमोदन चाहिए (राशि चाहे कुछ भी हो)' : 'These voucher types always need approval (any amount)'}</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {APPROVAL_VOUCHER_TYPES.map(t => {
                        const on = (society.approvalVoucherTypes ?? []).includes(t.value);
                        return (
                          <Button key={t.value} type="button" variant={on ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => toggleApprovalType(t.value)}>
                            {t.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ECR-20: godown storage-loss norm */}
              <div className="mt-6 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 font-semibold text-primary">
                      <Warehouse className="h-4 w-4" />
                      {language === 'hi' ? 'भंडारण-हानि norm' : 'Storage-loss Norm'}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'hi'
                        ? 'गोदाम में अनुमत हानि (driage/shrinkage) %. इससे अधिक हानि वाले items गोदाम पेज पर flag होंगे।'
                        : 'Permitted godown loss (driage/shrinkage) %. Items exceeding it are flagged on the Godowns page.'}
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs">{language === 'hi' ? 'norm %' : 'Norm %'}</Label>
                      <Input type="number" min="0" step="0.1" value={storageLossNormInput} onChange={e => setStorageLossNormInput(e.target.value)} className="w-28 h-9 mt-1" placeholder="0" />
                    </div>
                    <Button variant="outline" size="sm" className="h-9" onClick={saveStorageLossNorm}>{language === 'hi' ? 'सहेजें' : 'Save'}</Button>
                  </div>
                </div>
              </div>

              {/* P5-1: New FY Rollover Wizard */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${society.fyLocked ? 'border-success/40 bg-success/5' : 'border-muted bg-muted/30'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <FastForward className={`h-4 w-4 ${society.fyLocked ? 'text-success' : 'text-muted-foreground'}`} />
                      <span className={society.fyLocked ? 'text-success' : 'text-muted-foreground'}>
                        {language === 'hi' ? 'नए वित्त वर्ष में जाएं' : 'Roll Over to New Financial Year'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {society.fyLocked
                        ? (language === 'hi'
                          ? `वित्त वर्ष ${society.financialYear} लॉक है। सभी शेष राशियां सहेज कर ${society.financialYear.split('-')[0] ? `${parseInt(society.financialYear.split('-')[0]) + 1}-${String(parseInt(society.financialYear.split('-')[1]) + 1).slice(-2)}` : '?'} प्रारंभ करें।`
                          : `FY ${society.financialYear} is locked and ready for rollover. Closing balances will be saved as previous year data.`)
                        : (language === 'hi'
                          ? 'नए वित्त वर्ष में जाने के लिए पहले FY को ऑडिट लॉक करें।'
                          : 'Lock the FY (after audit) before rolling over to the next financial year.')}
                    </p>
                    {society.fyLocked && (
                      <div className="mt-2 space-y-1">
                        {[
                          language === 'hi' ? `BS शेष → पिछले वर्ष की शेष राशि (${society.financialYear})` : `BS closing balances saved as previous year (${society.financialYear})`,
                          language === 'hi' ? 'आय-व्यय खाता डेटा → तुलना हेतु सहेजा जाएगा' : 'I&E data saved for year-on-year comparison',
                          language === 'hi' ? 'रसीद-भुगतान डेटा → तुलना हेतु सहेजा जाएगा' : 'R&P data saved for comparison column',
                          language === 'hi' ? 'FY लॉक हटेगा — नई एंट्रियां संभव होंगी' : 'FY lock cleared — new entries allowed in new year',
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                            {item}
                          </div>
                        ))}
                        {unAppropriatedSurplus > 1 && (
                          <div className="flex items-start gap-1.5 text-xs text-amber-700 mt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            {language === 'hi'
                              ? `₹${unAppropriatedSurplus.toLocaleString('en-IN')} सरप्लस अभी आवंटित नहीं — पहले "फंड आवंटन" में पोस्ट करें।`
                              : `Rs. ${unAppropriatedSurplus.toLocaleString('en-IN')} surplus not yet appropriated — post it in "Fund Appropriation" first.`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 flex-shrink-0"
                    disabled={!society.fyLocked}
                    onClick={() => setRolloverOpen(true)}
                  >
                    <FastForward className="h-4 w-4" />
                    {language === 'hi' ? 'रोलओवर करें' : 'Roll Over'}
                  </Button>
                </div>
              </div>
              <NotificationChannelsCard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opening Balances */}
        <TabsContent value="opening" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{t('openingBalance')}</CardTitle>
                  <CardDescription>
                    {language === 'hi'
                      ? 'वित्तीय वर्ष के प्रारंभ में प्रत्येक खाते की शेष राशि'
                      : 'Opening balance for each account at start of financial year'}
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddAccount(true)}>
                  <Plus className="h-4 w-4" />
                  {language === 'hi' ? 'नया खाता' : 'Add Account'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: language === 'hi' ? 'संपत्ति खाते' : 'Asset Accounts', list: assetAccounts },
                { label: language === 'hi' ? 'लायबिलिटी खाते' : 'Liability Accounts', list: liabilityAccounts },
                { label: language === 'hi' ? 'आय खाते' : 'Income Accounts', list: incomeAccounts },
                { label: language === 'hi' ? 'व्यय खाते' : 'Expense Accounts', list: expenseAccounts },
              ].map(group => group.list.length > 0 && (
                <div key={group.label}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">{group.label}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.list.map(acc => (
                      <div key={acc.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">{language === 'hi' ? acc.nameHi : acc.name}</Label>
                          {!acc.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAccount(acc.id, language === 'hi' ? acc.nameHi : acc.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={obForm[acc.id] ?? '0'}
                            onChange={e => setObForm(f => ({ ...f, [acc.id]: e.target.value }))}
                            className="h-10"
                          />
                          <Select
                            value={acc.openingBalanceType}
                            onValueChange={v => updateAccount(acc.id, { openingBalanceType: v as 'debit' | 'credit' })}
                          >
                            <SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit">Dr</SelectItem>
                              <SelectItem value="credit">Cr</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button onClick={handleSaveOB} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add Account Dialog */}
          <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{language === 'hi' ? 'नया खाता जोड़ें' : 'Add New Account'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'नाम (English)' : 'Name (English)'} *</Label>
                    <Input value={newAccForm.name} onChange={e => setNewAccForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Loan Fund" />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
                    <Input value={newAccForm.nameHi} onChange={e => setNewAccForm(f => ({ ...f, nameHi: e.target.value }))} placeholder="e.g. ऋण फंड" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'प्रकार' : 'Account Type'}</Label>
                  <Select value={newAccForm.type} onValueChange={v => setNewAccForm(f => ({ ...f, type: v as typeof f.type }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">{language === 'hi' ? 'संपत्ति' : 'Asset'}</SelectItem>
                      <SelectItem value="liability">{language === 'hi' ? 'लायबिलिटी' : 'Liability'}</SelectItem>
                      <SelectItem value="income">{language === 'hi' ? 'आय' : 'Income'}</SelectItem>
                      <SelectItem value="expense">{language === 'hi' ? 'व्यय' : 'Expense'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'ओपनिंग बैलेंस' : 'Opening Balance'}</Label>
                    <Input type="number" value={newAccForm.openingBalance} onChange={e => setNewAccForm(f => ({ ...f, openingBalance: e.target.value }))} min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'Dr / Cr' : 'Balance Type'}</Label>
                    <Select value={newAccForm.openingBalanceType} onValueChange={v => setNewAccForm(f => ({ ...f, openingBalanceType: v as 'debit' | 'credit' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit (Dr)</SelectItem>
                        <SelectItem value="credit">Credit (Cr)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddAccount(false)}>{t('cancel')}</Button>
                  <Button onClick={handleAddAccount}><Plus className="h-4 w-4 mr-1" />{language === 'hi' ? 'जोड़ें' : 'Add'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Previous Year Balances */}
        <TabsContent value="prevyear" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>{language === 'hi' ? 'पिछले वर्ष की शेष राशि' : 'Previous Year Closing Balances'}</CardTitle>
                  <CardDescription className="mt-1">
                    {language === 'hi'
                      ? 'बैलेंस शीट में पिछले वर्ष के आंकड़े दर्ज करें (कानूनी तुलनात्मक कॉलम के लिए)'
                      : 'Enter previous year closing figures for the Balance Sheet comparison column (statutory requirement)'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-blue-700 border-blue-300 hover:bg-blue-50"
                  onClick={handleFillFromCurrentClosing}
                  title={language === 'hi' ? 'वर्तमान वर्ष के क्लोज़िंग बैलेंस से भरें' : 'Pre-fill from current year closing balances'}
                >
                  <History className="h-4 w-4" />
                  {language === 'hi' ? 'वर्तमान शेष से भरें' : 'Fill from Current Closing'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-xs">
                <Label>{language === 'hi' ? 'पिछला वित्तीय वर्ष' : 'Previous Financial Year'}</Label>
                <Input
                  placeholder="2023-24"
                  value={pyYear}
                  onChange={e => setPyYear(e.target.value)}
                />
              </div>

              {[
                { label: language === 'hi' ? 'संपत्ति खाते' : 'Asset Accounts', list: assetAccounts },
                { label: language === 'hi' ? 'लायबिलिटी खाते' : 'Liability Accounts', list: liabilityAccounts },
                { label: language === 'hi' ? 'आय खाते' : 'Income Accounts', list: incomeAccounts },
                { label: language === 'hi' ? 'व्यय खाते' : 'Expense Accounts', list: expenseAccounts },
              ].map(group => group.list.length > 0 && (
                <div key={group.label}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">{group.label}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.list.map(acc => (
                      <div key={acc.id} className="space-y-1">
                        <Label className="text-sm flex items-center gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            acc.openingBalanceType === 'debit'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-orange-50 text-orange-700'
                          }`}>
                            {acc.openingBalanceType === 'debit' ? 'Dr' : 'Cr'}
                          </span>
                          <span className="truncate">{language === 'hi' ? acc.nameHi : acc.name}</span>
                          <span className="text-gray-400 text-xs ml-auto">#{acc.id}</span>
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={pyForm[acc.id] ?? ''}
                          onChange={e => setPyForm(f => ({ ...f, [acc.id]: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button onClick={handleSavePY} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Backup & Restore */}
        <TabsContent value="backup" className="mt-6">
          <div className="space-y-6">
            {/* Export */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  {language === 'hi' ? 'डेटा बैकअप' : 'Data Backup'}
                </CardTitle>
                <CardDescription>
                  {language === 'hi'
                    ? 'सभी डेटा (वाउचर, सदस्य, खाते, ऋण, संपत्ति) एक JSON फ़ाइल में डाउनलोड करें'
                    : 'Download all data (vouchers, members, accounts, loans, assets) as a JSON file'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{language === 'hi' ? 'पूर्ण डेटा बैकअप' : 'Full Data Backup'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'hi'
                        ? `फ़ाइल नाम: sahayata_backup_${society.financialYear}_<date>.json`
                        : `Filename: sahayata_backup_${society.financialYear}_<date>.json`}
                    </p>
                  </div>
                  <Button onClick={handleBackup} className="gap-2 shrink-0">
                    <Download className="h-4 w-4" />
                    {language === 'hi' ? 'बैकअप डाउनलोड करें' : 'Download Backup'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Restore */}
            <Card className="shadow-card border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Upload className="h-5 w-5" />
                  {language === 'hi' ? 'डेटा पुनर्स्थापना' : 'Data Restore'}
                </CardTitle>
                <CardDescription>
                  {language === 'hi'
                    ? 'पहले से डाउनलोड की गई बैकअप फ़ाइल से डेटा पुनर्स्थापित करें'
                    : 'Restore data from a previously downloaded backup file'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {language === 'hi'
                      ? 'चेतावनी: पुनर्स्थापना से वर्तमान सभी डेटा बदल जाएगा। पहले बैकअप लें।'
                      : 'Warning: Restoring will replace ALL current data. Take a backup first.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{language === 'hi' ? 'बैकअप फ़ाइल चुनें (.json)' : 'Select backup file (.json)'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'hi' ? 'केवल sahayata बैकअप फ़ाइलें स्वीकार की जाती हैं' : 'Only Sahayata backup files are accepted'}
                    </p>
                  </div>
                  <Button variant="destructive" className="gap-2 shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {language === 'hi' ? 'फ़ाइल से पुनर्स्थापित करें' : 'Restore from File'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleRestore}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset COA Confirmation Dialog — with type-to-confirm + auto-backup */}
      <AlertDialog open={resetCoaOpen} onOpenChange={o => { setResetCoaOpen(o); if (!o) setResetConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {language === 'hi' ? 'खाता संरचना रीसेट करें?' : 'Reset Chart of Accounts?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="font-medium text-destructive">
                  {language === 'hi'
                    ? 'यह सभी मौजूदा खातों को हटाकर डिफॉल्ट टेम्पलेट लोड करेगा। यह क्रिया पूर्ववत नहीं की जा सकती।'
                    : 'This will DELETE all existing accounts and load the default template. This action CANNOT be undone.'}
                </p>
                <p className="text-muted-foreground">
                  {language === 'hi'
                    ? 'रीसेट से पहले एक बैकअप फ़ाइल स्वचालित रूप से डाउनलोड होगी।'
                    : 'A backup file will be automatically downloaded before reset.'}
                </p>
                <div className="space-y-2 pt-2">
                  <Label className="text-foreground font-medium">
                    {language === 'hi'
                      ? `पुष्टि के लिए समिति का नाम टाइप करें: "${society.name}"`
                      : `Type society name to confirm: "${society.name}"`}
                  </Label>
                  <Input
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder={society.name}
                    className="border-destructive"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCoa}
              disabled={resetConfirmText.trim().toLowerCase() !== society.name.trim().toLowerCase()}
              className="bg-destructive hover:bg-destructive/90 text-white disabled:opacity-50"
            >
              {language === 'hi' ? 'रीसेट करें' : 'Reset COA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* P5-1: FY Rollover Confirmation Dialog */}
      <AlertDialog open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'hi' ? `वित्त वर्ष ${society.financialYear} से रोलओवर करें?` : `Roll Over from FY ${society.financialYear}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {language === 'hi'
                    ? `यह क्रिया निम्न कार्य करेगी:`
                    : `This action will:`}
                </p>
                <ul className="space-y-1.5 text-muted-foreground">
                  {[
                    language === 'hi' ? `वर्तमान बैलेंस शीट शेष → पिछले वर्ष (${society.financialYear}) डेटा में सहेजेगा` : `Save current Balance Sheet closing balances as ${society.financialYear} previous year data`,
                    language === 'hi' ? `आय-व्यय और रसीद-भुगतान → तुलना के लिए सहेजेगा` : `Save I&E and R&P figures for year-on-year comparison columns`,
                    language === 'hi' ? `वित्त वर्ष ${parseInt(society.financialYear.split('-')[0]) + 1}-${String(parseInt(society.financialYear.split('-')[1]) + 1).slice(-2)} शुरू करेगा` : `Switch to FY ${parseInt(society.financialYear.split('-')[0]) + 1}-${String(parseInt(society.financialYear.split('-')[1]) + 1).slice(-2)}`,
                    language === 'hi' ? `FY ऑडिट लॉक हटाएगा — नई एंट्रियां संभव होंगी` : `Clear the audit lock — new entries allowed in the new year`,
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                {unAppropriatedSurplus > 1 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {language === 'hi'
                        ? `₹${unAppropriatedSurplus.toLocaleString('en-IN')} सरप्लस अभी रिज़र्व/शिक्षा फंड या डिविडेंड में आवंटित नहीं हुआ — रोलओवर के बाद यह बिना-आवंटित आगे चला जाएगा। पहले "फंड आवंटन" में पोस्ट करना उचित है (उपनियमों अनुसार अनुशंसित; अनिवार्य नहीं)।`
                        : `Rs. ${unAppropriatedSurplus.toLocaleString('en-IN')} of surplus has not been appropriated to reserve/education funds or dividend — after rollover it carries forward un-appropriated. Consider posting it in "Fund Appropriation" first (recommended per bye-laws; not mandatory).`}
                    </span>
                  </div>
                )}
                <p className="font-medium text-foreground">
                  {language === 'hi'
                    ? 'यह क्रिया पूर्ववत नहीं की जा सकती। क्या आप निश्चित हैं?'
                    : 'This cannot be undone. Are you sure you want to proceed?'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRolloverFY} className="bg-success hover:bg-success/90 text-white">
              <FastForward className="h-4 w-4 mr-2" />
              {language === 'hi' ? 'रोलओवर करें' : 'Roll Over Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SocietySetup;
