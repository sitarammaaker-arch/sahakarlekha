import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, ArrowDownLeft, ArrowUpRight, RefreshCw, Save, X, Trash2, CheckCircle, RotateCcw, EyeOff, Eye, Pencil, Zap, Settings2, ArrowLeft, ArrowLeftRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { VoucherType } from '@/types';
import { getNextVoucherNo, VOUCHER_TEMPLATES, ACCOUNT_IDS } from '@/lib/storage';
import type { LedgerAccount } from '@/types';
import { validateVoucher } from '@/lib/validation';

type EntryMode = 'aasan' | 'expert';

// Searchable account combobox — type account name/id to filter
const AccountSearch: React.FC<{
  value: string;
  onChange: (id: string) => void;
  accounts: LedgerAccount[];
  placeholder: string;
  language: 'hi' | 'en';
}> = ({ value, onChange, accounts, placeholder, language }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = accounts.find(a => a.id === value);
  const filtered = query.trim()
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.nameHi.includes(query) ||
        a.id.startsWith(query)
      )
    : accounts;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={open ? query : (selected ? `${selected.id} — ${language === 'hi' ? selected.nameHi : selected.name}` : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder={placeholder}
          className="h-12 text-base pl-9"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">{language === 'hi' ? 'कोई खाता नहीं मिला' : 'No account found'}</p>
          ) : filtered.slice(0, 25).map(a => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => { onChange(a.id); setOpen(false); setQuery(''); }}
              className={cn(
                'w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b last:border-0 flex items-center gap-3',
                a.id === value && 'bg-primary/5 font-medium'
              )}
            >
              <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{a.id}</span>
              <span>{language === 'hi' ? a.nameHi : a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Vouchers: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { accounts, members, vouchers, society, addVoucher, updateVoucher, cancelVoucher, restoreVoucher } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'entry' | 'list'>('entry');
  const [entryMode, setEntryMode] = useState<EntryMode>(() => {
    return (localStorage.getItem('sahayata_entry_mode') as EntryMode) || 'aasan';
  });
  const [selectedTemplate, setSelectedTemplate] = useState<typeof VOUCHER_TEMPLATES[0] | null>(null);

  const switchMode = (mode: EntryMode) => {
    setEntryMode(mode);
    localStorage.setItem('sahayata_entry_mode', mode);
    setSelectedTemplate(null);
    handleClear();
  };

  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [contraDir, setContraDir] = useState<'cash_to_bank' | 'bank_to_cash'>('cash_to_bank');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [linkedMemberId, setLinkedMemberId] = useState('');
  const [voucherNoInput, setVoucherNoInput] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [savedVoucherNo, setSavedVoucherNo] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<VoucherType>('receipt');
  const [editDebit, setEditDebit] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNarration, setEditNarration] = useState('');
  const [editMemberId, setEditMemberId] = useState('');

  const openEdit = (v: { id: string; date: string; type: VoucherType; debitAccountId: string; creditAccountId: string; amount: number; narration?: string; memberId?: string }) => {
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
      description: language === 'hi' ? 'नकद/बैंक प्राप्ति के लिए' : 'For cash/bank receipts',
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
      description: language === 'hi' ? 'समायोजन प्रविष्टि के लिए' : 'For adjustment entries',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For Contra: auto-set Dr/Cr based on direction
    if (voucherType === 'contra') {
      const drAcc = contraDir === 'cash_to_bank' ? ACCOUNT_IDS.BANK : ACCOUNT_IDS.CASH;
      const crAcc = contraDir === 'cash_to_bank' ? ACCOUNT_IDS.CASH : ACCOUNT_IDS.BANK;
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
      });
      setSavedVoucherNo(v.voucherNo);
      toast({ title: language === 'hi' ? 'कोंट्रा वाउचर सहेजा गया' : 'Contra Voucher saved', description: v.voucherNo });
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
    });
    setSavedVoucherNo(v.voucherNo);
    toast({ title: language === 'hi' ? 'वाउचर सहेजा गया' : 'Voucher saved', description: `${v.voucherNo}` });
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
  };

  const sortedVouchers = [...vouchers]
    .filter(v => showCancelled ? v.isDeleted : !v.isDeleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeCount = vouchers.filter(v => !v.isDeleted).length;
  const cancelledCount = vouchers.filter(v => v.isDeleted).length;

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            {t('vouchers')}
          </h1>
          <p className="text-muted-foreground">
            {language === 'hi' ? 'वाउचर प्रविष्टि प्रणाली' : 'Voucher Entry System'}
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
            {language === 'hi' ? 'नई प्रविष्टि' : 'New Entry'}
          </Button>
          <Button variant={activeTab === 'list' ? 'default' : 'outline'} onClick={() => setActiveTab('list')}>
            {language === 'hi' ? 'सूची' : 'List'} ({activeCount})
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

          {/* ── AASAN MODE ── */}
          {entryMode === 'aasan' && (
            <div className="space-y-4">
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
                          onClick={() => {
                            setSelectedTemplate(tmpl);
                            setVoucherType(tmpl.type);
                            setDebitAccount(tmpl.debitAccountId);
                            setCreditAccount(tmpl.creditAccountId);
                            setSavedVoucherNo(null);
                          }}
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
                          onClick={() => {
                            setSelectedTemplate(tmpl);
                            setVoucherType(tmpl.type);
                            setDebitAccount(tmpl.debitAccountId);
                            setCreditAccount(tmpl.creditAccountId);
                            setSavedVoucherNo(null);
                          }}
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
                            type="number"
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
                      <div className="flex gap-3 pt-2 border-t">
                        <Button type="submit" size="lg" className="flex-1 h-12 text-lg gap-2">
                          <Save className="h-5 w-5" />
                          {t('save')}
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
          {entryMode === 'expert' && (
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
                  <form onSubmit={handleSubmit} className="space-y-6">
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

                    {/* Dr/Cr account search — hidden for Contra (auto-set) */}
                    {voucherType !== 'contra' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <span className="text-destructive font-bold">Dr.</span>
                          {t('debit')} {language === 'hi' ? 'खाता' : 'Account'}
                        </Label>
                        <AccountSearch
                          value={debitAccount}
                          onChange={setDebitAccount}
                          accounts={accounts.filter(a => !a.isGroup)}
                          placeholder={language === 'hi' ? 'नाम या कोड से खोजें...' : 'Search by name or code...'}
                          language={language}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <span className="text-success font-bold">Cr.</span>
                          {t('credit')} {language === 'hi' ? 'खाता' : 'Account'}
                        </Label>
                        <AccountSearch
                          value={creditAccount}
                          onChange={setCreditAccount}
                          accounts={accounts.filter(a => !a.isGroup)}
                          placeholder={language === 'hi' ? 'नाम या कोड से खोजें...' : 'Search by name or code...'}
                          language={language}
                        />
                      </div>
                    </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">{t('amount')} (₹)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        min="1"
                        className="h-14 text-2xl font-bold text-center"
                        required
                      />
                      {amount && Number(amount) > 0 && (
                        <p className="text-sm text-muted-foreground text-center">
                          {new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(amount))}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">{t('narration')}</Label>
                      <Textarea
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder={language === 'hi' ? 'लेनदेन का विवरण लिखें...' : 'Enter transaction details...'}
                        className="min-h-24 text-base"
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
                          {language === 'hi' ? 'यह लेनदेन सदस्य के खाता बही में दिखेगा' : 'This transaction will appear in the member\'s share ledger'}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                      <Button type="submit" size="lg" className="flex-1 h-12 text-lg gap-2">
                        <Save className="h-5 w-5" />
                        {t('save')}
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
                      const debitAcc = accounts.find(a => a.id === v.debitAccountId);
                      const creditAcc = accounts.find(a => a.id === v.creditAccountId);
                      const cancelled = !!v.isDeleted;
                      return (
                        <TableRow key={v.id} className={cn('hover:bg-muted/30', cancelled && 'opacity-50 bg-red-50/30 dark:bg-red-900/10')}>
                          <TableCell>
                            <Badge variant="outline" className={cn('font-mono text-xs', cancelled && 'line-through opacity-60')}>{v.voucherNo}</Badge>
                            {cancelled && <Badge variant="destructive" className="ml-1 text-xs py-0">{language === 'hi' ? 'रद्द' : 'Cancelled'}</Badge>}
                          </TableCell>
                          <TableCell className={cn('font-medium', cancelled && 'line-through')}>
                            {new Date(v.date).toLocaleDateString('hi-IN')}
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
                            {new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(v.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                            {cancelled ? <span className="text-destructive text-xs">{v.deletedReason || 'Cancelled'}</span> : v.narration}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!cancelled && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                                  title={language === 'hi' ? 'संपादित करें' : 'Edit'}
                                  onClick={() => openEdit(v)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {cancelled ? (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" title={language === 'hi' ? 'पुनर्स्थापित करें' : 'Restore'}
                                  onClick={() => restoreVoucher(v.id)}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => { setCancelId(v.id); setCancelReason(''); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
              <Select value={editDebit} onValueChange={setEditDebit}>
                <SelectTrigger className="h-9"><SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.isGroup).map(a => <SelectItem key={a.id} value={a.id}>{a.id} — {language === 'hi' ? (a.nameHi || a.name) : a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-success font-bold">Cr.</span> {language === 'hi' ? 'जमा खाता' : 'Credit Account'}</Label>
              <Select value={editCredit} onValueChange={setEditCredit}>
                <SelectTrigger className="h-9"><SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => !a.isGroup).map(a => <SelectItem key={a.id} value={a.id}>{a.id} — {language === 'hi' ? (a.nameHi || a.name) : a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('amount')} (₹)</Label>
              <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="1" className="h-10 text-lg font-bold text-center" />
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
                  cancelVoucher(cancelId, cancelReason.trim(), user?.name || 'System');
                  setCancelId(null);
                  toast({ title: language === 'hi' ? 'वाउचर रद्द किया गया' : 'Voucher cancelled' });
                }
              }}
              disabled={!cancelReason.trim()}
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel Voucher'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Vouchers;
