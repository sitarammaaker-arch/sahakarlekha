import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
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
import { Settings, Building2, Calendar, Wallet, Save, History, HardDrive, Download, Upload, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SocietySetup: React.FC = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { society, updateSociety, accounts, updateAccount, addAccount, deleteAccount, getAccountBalance } = useData();

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
  };

  const handleSaveFY = () => {
    updateSociety(fyForm);
    toast({
      title: language === 'hi' ? 'सहेजा गया' : 'Saved',
      description: language === 'hi' ? 'वित्तीय वर्ष अपडेट हो गया' : 'Financial year updated',
    });
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
      description: language === 'hi' ? 'प्रारंभिक शेष अपडेट हो गया' : 'Opening balances updated',
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
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
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
            {language === 'hi' ? 'प्रारंभिक शेष' : 'Opening Balance'}
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

              <div className="space-y-2">
                <Label>{t('registrationNo')} *</Label>
                <Input
                  value={form.registrationNo}
                  onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))}
                  className="h-11"
                />
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
                      <SelectItem value="mp">मध्य प्रदेश</SelectItem>
                      <SelectItem value="up">उत्तर प्रदेश</SelectItem>
                      <SelectItem value="rj">राजस्थान</SelectItem>
                      <SelectItem value="gj">गुजरात</SelectItem>
                      <SelectItem value="mh">महाराष्ट्र</SelectItem>
                      <SelectItem value="br">बिहार</SelectItem>
                      <SelectItem value="jh">झारखंड</SelectItem>
                      <SelectItem value="cg">छत्तीसगढ़</SelectItem>
                      <SelectItem value="uk">उत्तराखंड</SelectItem>
                      <SelectItem value="hr">हरियाणा</SelectItem>
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
                      <SelectItem value="2025-26">2025-26</SelectItem>
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2023-24">2023-24</SelectItem>
                      <SelectItem value="2022-23">2022-23</SelectItem>
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
                { label: language === 'hi' ? 'देयता खाते' : 'Liability Accounts', list: liabilityAccounts },
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
                    <Input value={newAccForm.nameHi} onChange={e => setNewAccForm(f => ({ ...f, nameHi: e.target.value }))} placeholder="e.g. ऋण निधि" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'hi' ? 'प्रकार' : 'Account Type'}</Label>
                  <Select value={newAccForm.type} onValueChange={v => setNewAccForm(f => ({ ...f, type: v as typeof f.type }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">{language === 'hi' ? 'संपत्ति' : 'Asset'}</SelectItem>
                      <SelectItem value="liability">{language === 'hi' ? 'देयता' : 'Liability'}</SelectItem>
                      <SelectItem value="income">{language === 'hi' ? 'आय' : 'Income'}</SelectItem>
                      <SelectItem value="expense">{language === 'hi' ? 'व्यय' : 'Expense'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'hi' ? 'प्रारंभिक शेष' : 'Opening Balance'}</Label>
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
                      ? 'तुलन पत्र में पिछले वर्ष के आंकड़े दर्ज करें (वैधानिक तुलनात्मक स्तंभ के लिए)'
                      : 'Enter previous year closing figures for the Balance Sheet comparison column (statutory requirement)'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-blue-700 border-blue-300 hover:bg-blue-50"
                  onClick={handleFillFromCurrentClosing}
                  title={language === 'hi' ? 'वर्तमान वर्ष के समापन शेष से भरें' : 'Pre-fill from current year closing balances'}
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
                { label: language === 'hi' ? 'देयता खाते' : 'Liability Accounts', list: liabilityAccounts },
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
    </div>
  );
};

export default SocietySetup;
