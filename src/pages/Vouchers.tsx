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
import { FileText, ArrowDownLeft, ArrowUpRight, RefreshCw, Save, X, Trash2, CheckCircle, RotateCcw, EyeOff, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { VoucherType } from '@/types';

const Vouchers: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { accounts, members, vouchers, addVoucher, updateVoucher, cancelVoucher, restoreVoucher } = useData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'entry' | 'list'>('entry');
  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [linkedMemberId, setLinkedMemberId] = useState('');
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
    if (!editId || !editDebit || !editCredit || !editAmount || Number(editAmount) <= 0) return;
    if (editDebit === editCredit) {
      toast({ title: language === 'hi' ? 'डेबिट और क्रेडिट खाता अलग होना चाहिए' : 'Debit and Credit accounts must be different', variant: 'destructive' });
      return;
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
  };

  const currentVoucher = voucherConfig[voucherType];
  const VoucherIcon = currentVoucher.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitAccount || !creditAccount || !amount || Number(amount) <= 0) {
      toast({ title: language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    if (debitAccount === creditAccount) {
      toast({ title: language === 'hi' ? 'डेबिट और क्रेडिट खाता अलग होना चाहिए' : 'Debit and Credit accounts must be different', variant: 'destructive' });
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
    return 'bg-info/20 text-info border-info/30';
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
        <div className="flex gap-2">
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

          <Tabs value={voucherType} onValueChange={(v) => { setVoucherType(v as VoucherType); setSavedVoucherNo(null); }}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="receipt" className="gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                {language === 'hi' ? 'रसीद' : 'Receipt'}
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                {language === 'hi' ? 'भुगतान' : 'Payment'}
              </TabsTrigger>
              <TabsTrigger value="journal" className="gap-2">
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
                  <div className="text-right text-white/80 text-sm">
                    {language === 'hi' ? 'वाउचर नं. स्वतः उत्पन्न होगा' : 'Voucher No. auto-generated'}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <span className="text-destructive font-bold">Dr.</span>
                          {t('debit')} {language === 'hi' ? 'खाता' : 'Account'}
                        </Label>
                        <Select value={debitAccount} onValueChange={setDebitAccount} required>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {language === 'hi' ? a.nameHi : a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <span className="text-success font-bold">Cr.</span>
                          {t('credit')} {language === 'hi' ? 'खाता' : 'Account'}
                        </Label>
                        <Select value={creditAccount} onValueChange={setCreditAccount} required>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select account'} />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {language === 'hi' ? a.nameHi : a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

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
                              {v.type === 'receipt' ? (language === 'hi' ? 'रसीद' : 'Receipt')
                                : v.type === 'payment' ? (language === 'hi' ? 'भुगतान' : 'Payment')
                                : (language === 'hi' ? 'जर्नल' : 'Journal')}
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
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{language === 'hi' ? a.nameHi : a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><span className="text-success font-bold">Cr.</span> {language === 'hi' ? 'जमा खाता' : 'Credit Account'}</Label>
              <Select value={editCredit} onValueChange={setEditCredit}>
                <SelectTrigger className="h-9"><SelectValue placeholder={language === 'hi' ? 'खाता चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{language === 'hi' ? a.nameHi : a.name}</SelectItem>)}
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
