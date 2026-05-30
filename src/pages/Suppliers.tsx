import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import type { EntityLink, Supplier, SupplierType, GstRegistrationType, TdsSection } from '@/types';
import { Truck, Plus, Pencil, Trash2, Search, IndianRupee, FileSpreadsheet, Download, User, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const STATES_IN: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
];

type FormShape = Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>;

const EMPTY_FORM = (): FormShape => ({
  name: '',
  nameHi: '',
  legalName: '',
  tradeName: '',
  mailingName: '',
  supplierType: 'individual',
  address: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  mobile: '',
  landline: '',
  email: '',
  website: '',
  contactPerson: '',
  contactDesignation: '',
  salesRep: '',
  gstNo: '',
  gstin: '',
  pan: '',
  registrationType: 'unregistered',
  placeOfSupply: '',
  tdsApplicable: false,
  tdsSection: undefined,
  tcsApplicable: false,
  bankName: '',
  accountNo: '',
  ifsc: '',
  branch: '',
  upiId: '',
  beneficiaryName: '',
  creditDays: 0,
  creditLimit: 0,
  discountPercent: 0,
  openingBalance: 0,
  openingBalanceType: 'credit',
  notes: '',
  isActive: true,
});

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Suppliers: React.FC = () => {
  const { language } = useLanguage();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, getAccountBalance, getEntityLinks } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(EMPTY_FORM());
  const [deleteGuard, setDeleteGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });

  const isBusiness = form.supplierType && form.supplierType !== 'individual';

  const filtered = useMemo(() =>
    suppliers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.legalName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search) ||
      (s.mobile || '').includes(search) ||
      (s.gstin || s.gstNo || '').toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search]);

  const handleCSV = () => {
    const headers = ['Code', 'Name', 'Type', 'Mobile', 'GSTIN', 'State', 'City', 'Status'];
    const rows = filtered.map(s => [
      s.supplierCode || '', s.legalName || s.name, s.supplierType || 'individual',
      s.mobile || s.phone || '', s.gstin || s.gstNo || '', s.state || '', s.city || '',
      s.isActive ? 'Active' : 'Inactive',
    ]);
    downloadCSV(headers, rows, 'suppliers.csv');
  };
  const handleExcel = () => {
    const headers = ['Code', 'Name', 'Type', 'Mobile', 'GSTIN', 'State', 'City', 'Status'];
    const rows = filtered.map(s => [
      s.supplierCode || '', s.legalName || s.name, s.supplierType || 'individual',
      s.mobile || s.phone || '', s.gstin || s.gstNo || '', s.state || '', s.city || '',
      s.isActive ? 'Active' : 'Inactive',
    ]);
    downloadExcelSingle(headers, rows, 'suppliers.xlsx', 'Suppliers');
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM()); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({
      ...EMPTY_FORM(),
      ...s,
      legalName: s.legalName || s.name || '',
      mobile: s.mobile || s.phone || '',
      gstin: s.gstin || s.gstNo || '',
      supplierType: s.supplierType || (s.gstin || s.gstNo ? 'proprietorship' : 'individual'),
    });
    setShowForm(true);
  };

  const handleGstinChange = (raw: string) => {
    const v = raw.toUpperCase().slice(0, 15);
    setForm(f => {
      const next = { ...f, gstin: v, gstNo: v };
      if (v.length >= 12) {
        const pan = v.slice(2, 12);
        if (PAN_RE.test(pan)) next.pan = pan;
      }
      if (v.length >= 2) {
        const stateCode = v.slice(0, 2);
        const st = STATES_IN.find(s => s.code === stateCode);
        if (st) { next.state = st.name; next.placeOfSupply = st.name; }
      }
      return next;
    });
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return hi ? 'नाम आवश्यक है' : 'Name is required';
    if (form.gstin && !GSTIN_RE.test(form.gstin)) return hi ? 'GSTIN format गलत है (15 chars)' : 'Invalid GSTIN format (15 chars)';
    if (form.pan && !PAN_RE.test(form.pan)) return hi ? 'PAN format गलत है (10 chars)' : 'Invalid PAN format (10 chars)';
    if (form.mobile && !MOBILE_RE.test(form.mobile)) return hi ? 'Mobile 10 अंक का (6-9 से शुरू)' : 'Mobile must be 10 digits (starting 6-9)';
    if (form.pincode && !PINCODE_RE.test(form.pincode)) return hi ? 'Pincode 6 अंक का होना चाहिए' : 'Pincode must be 6 digits';
    if (form.email && !EMAIL_RE.test(form.email)) return hi ? 'Email format गलत है' : 'Invalid email format';
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) { toast({ title: err, variant: 'destructive' }); return; }

    const nameNorm = (form.legalName || form.name).trim().toLowerCase();
    const duplicate = suppliers.find(s => (s.legalName || s.name).toLowerCase() === nameNorm && s.id !== editId);
    if (duplicate) {
      toast({ title: hi ? 'इस नाम का supplier पहले से है' : 'Supplier with this name already exists', variant: 'destructive' });
      return;
    }

    const sanitized: FormShape = {
      ...form,
      legalName: form.legalName?.trim() || form.name.trim(),
      phone: form.mobile?.trim() || form.phone?.trim() || '',
      mobile: form.mobile?.trim() || form.phone?.trim() || '',
      gstNo: form.gstin?.trim() || form.gstNo?.trim() || '',
      gstin: form.gstin?.trim() || form.gstNo?.trim() || '',
      mailingName: form.mailingName?.trim() || form.legalName?.trim() || form.name.trim(),
    };

    if (editId) {
      updateSupplier(editId, sanitized);
      toast({ title: hi ? 'सप्लायर अपडेट हुआ' : 'Supplier updated' });
    } else {
      addSupplier(sanitized);
      toast({ title: hi ? 'सप्लायर जोड़ा गया' : 'Supplier added' });
    }
    setShowForm(false);
  };

  const handleDeleteClick = (s: { id: string; name: string; supplierCode?: string }) => {
    const links = getEntityLinks('supplier', s.id);
    setDeleteGuard({ open: true, id: s.id, name: `${s.name}${s.supplierCode ? ` (${s.supplierCode})` : ''}`, links });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            {hi ? 'सप्लायर मास्टर' : 'Supplier Master'}
          </h1>
          <p className="text-muted-foreground">
            {hi ? 'पंजीकृत सप्लायर प्रबंधन (Individual + Business)' : 'Manage registered suppliers (Individual + Business)'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {hi ? 'नया सप्लायर' : 'New Supplier'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल सप्लायर' : 'Total Suppliers'}</p>
            <p className="text-2xl font-bold text-primary">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'सक्रिय' : 'Active'}</p>
            <p className="text-2xl font-bold text-success">{suppliers.filter(s => s.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल देय (Payable)' : 'Total Payable'}</p>
            <p className="text-2xl font-bold text-destructive">
              {fmt(suppliers.reduce((sum, s) => sum + getAccountBalance(s.accountId), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={hi ? 'नाम, फोन, GSTIN से खोजें…' : 'Search by name / phone / GSTIN…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                  <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'फोन' : 'Phone'}</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-right">{hi ? 'देय शेष' : 'Outstanding'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कार्य' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      {hi ? 'कोई सप्लायर नहीं मिला' : 'No suppliers found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(s => {
                    const outstanding = getAccountBalance(s.accountId);
                    const type = s.supplierType || (s.gstin || s.gstNo ? 'proprietorship' : 'individual');
                    const isB = type !== 'individual';
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-muted-foreground">{s.supplierCode}</TableCell>
                        <TableCell className="font-medium">
                          <div>{s.legalName || s.name}</div>
                          {s.tradeName && <div className="text-xs text-muted-foreground">{s.tradeName}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={isB ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200'}>
                            {isB ? <Building2 className="h-3 w-3 mr-1 inline" /> : <User className="h-3 w-3 mr-1 inline" />}
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.mobile || s.phone || '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{s.gstin || s.gstNo || '—'}</TableCell>
                        <TableCell className="text-right">
                          {outstanding !== 0 ? (
                            <span className="font-semibold flex items-center justify-end gap-1">
                              <IndianRupee className="h-3 w-3" />
                              {Math.abs(outstanding).toLocaleString('hi-IN')}
                              <span className="text-xs text-muted-foreground ml-1">
                                {outstanding > 0 ? '(Dr)' : '(Cr)'}
                              </span>
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={s.isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
                            {s.isActive ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(s)}>
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
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog — Tally-style sectioned form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (hi ? 'सप्लायर संपादित करें' : 'Edit Supplier')
                : (hi ? 'नया सप्लायर जोड़ें' : 'Add New Supplier')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 p-2 bg-muted/40 rounded-lg">
            <Button
              type="button"
              variant={form.supplierType === 'individual' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setForm(f => ({ ...f, supplierType: 'individual' }))}
            >
              <User className="h-4 w-4" />
              {hi ? 'Individual / आम सप्लायर' : 'Individual'}
            </Button>
            <Button
              type="button"
              variant={isBusiness ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setForm(f => ({ ...f, supplierType: f.supplierType === 'individual' ? 'proprietorship' : f.supplierType }))}
            >
              <Building2 className="h-4 w-4" />
              {hi ? 'Business / संस्था' : 'Business / Society'}
            </Button>
          </div>

          <Accordion type="multiple" defaultValue={['basic', 'contact']} className="w-full">
            {/* Basic */}
            <AccordionItem value="basic">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 मूल जानकारी / Basic Info' : '🟦 Basic Info'}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'Legal Name (English) *' : 'Legal Name (English) *'}</Label>
                    <Input
                      value={form.legalName || form.name}
                      onChange={e => setForm(f => ({ ...f, legalName: e.target.value, name: e.target.value }))}
                      placeholder={hi ? 'GSTIN के अनुसार नाम' : 'Name as per GSTIN'}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
                    <Input value={form.nameHi || ''} onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))} placeholder="सप्लायर का नाम" />
                  </div>
                </div>
                {isBusiness && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{hi ? 'Trade Name / Brand' : 'Trade Name / Brand'}</Label>
                      <Input value={form.tradeName || ''} onChange={e => setForm(f => ({ ...f, tradeName: e.target.value }))} placeholder="e.g. Hafed Marketing Division" />
                    </div>
                    <div className="space-y-1">
                      <Label>{hi ? 'Business Type' : 'Business Type'}</Label>
                      <Select value={form.supplierType} onValueChange={v => setForm(f => ({ ...f, supplierType: v as SupplierType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proprietorship">Proprietorship</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="llp">LLP</SelectItem>
                          <SelectItem value="pvtLtd">Pvt Ltd</SelectItem>
                          <SelectItem value="publicLtd">Public Ltd</SelectItem>
                          <SelectItem value="society">Society / Cooperative</SelectItem>
                          <SelectItem value="trust">Trust</SelectItem>
                          <SelectItem value="huf">HUF</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="manufacturer">Manufacturer</SelectItem>
                          <SelectItem value="distributor">Distributor</SelectItem>
                          <SelectItem value="wholesaler">Wholesaler</SelectItem>
                          <SelectItem value="retailer">Retailer</SelectItem>
                          <SelectItem value="serviceProvider">Service Provider</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>{hi ? 'Mailing Name (voucher पर print होगा)' : 'Mailing Name (printed on voucher)'}</Label>
                  <Input value={form.mailingName || ''} onChange={e => setForm(f => ({ ...f, mailingName: e.target.value }))} placeholder={hi ? 'खाली रखें तो Legal Name use होगा' : 'Defaults to Legal Name if blank'} />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
                  <Label>{hi ? 'सक्रिय / Active' : 'Active'}</Label>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Address */}
            <AccordionItem value="address">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 पता / Address & Location' : '🟦 Address & Location'}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>{hi ? 'पता पंक्ति 1 / Address Line 1' : 'Address Line 1'}</Label>
                  <Input value={form.addressLine1 || form.address || ''} onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value, address: e.target.value }))} placeholder={hi ? 'गली / मकान नं.' : 'Street / Building'} />
                </div>
                <div className="space-y-1">
                  <Label>{hi ? 'पता पंक्ति 2 / Address Line 2' : 'Address Line 2'}</Label>
                  <Input value={form.addressLine2 || ''} onChange={e => setForm(f => ({ ...f, addressLine2: e.target.value }))} placeholder={hi ? 'क्षेत्र / Locality' : 'Area / Locality'} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'शहर / City' : 'City'}</Label>
                    <Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Sirsa" />
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'राज्य / State *' : 'State *'}</Label>
                    <Select value={form.state || ''} onValueChange={v => setForm(f => ({ ...f, state: v, placeOfSupply: v }))}>
                      <SelectTrigger><SelectValue placeholder={hi ? '— चुनें —' : '— Select —'} /></SelectTrigger>
                      <SelectContent>
                        {STATES_IN.map(s => <SelectItem key={s.code} value={s.name}>{s.code} — {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'पिनकोड / Pincode' : 'Pincode'}</Label>
                    <Input value={form.pincode || ''} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} maxLength={6} placeholder="125076" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{hi ? 'देश / Country' : 'Country'}</Label>
                  <Input value={form.country || 'India'} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contact */}
            <AccordionItem value="contact">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 संपर्क / Contact' : '🟦 Contact'}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'मोबाइल / Mobile *' : 'Mobile *'}</Label>
                    <Input value={form.mobile || form.phone || ''} onChange={e => setForm(f => ({ ...f, mobile: e.target.value, phone: e.target.value }))} placeholder="9XXXXXXXXX" maxLength={10} />
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'लैंडलाइन / Landline' : 'Landline'}</Label>
                    <Input value={form.landline || ''} onChange={e => setForm(f => ({ ...f, landline: e.target.value }))} placeholder="01666-XXXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@example.com" />
                  </div>
                  {isBusiness && (
                    <div className="space-y-1">
                      <Label>Website</Label>
                      <Input value={form.website || ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                    </div>
                  )}
                </div>
                {isBusiness && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>{hi ? 'संपर्क व्यक्ति / Contact Person' : 'Contact Person'}</Label>
                        <Input value={form.contactPerson || ''} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Mr. / Mrs." />
                      </div>
                      <div className="space-y-1">
                        <Label>{hi ? 'पद / Designation' : 'Designation'}</Label>
                        <Input value={form.contactDesignation || ''} onChange={e => setForm(f => ({ ...f, contactDesignation: e.target.value }))} placeholder="Manager / Owner" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>{hi ? 'Sales Rep (हमसे deal करने वाला)' : 'Sales Representative (deals with us)'}</Label>
                      <Input value={form.salesRep || ''} onChange={e => setForm(f => ({ ...f, salesRep: e.target.value }))} placeholder={hi ? 'सप्लायर का sales executive' : 'Supplier-side sales executive'} />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* GST/Tax */}
            {isBusiness && (
              <AccordionItem value="gst">
                <AccordionTrigger className="text-sm font-semibold">
                  {hi ? '🟦 GST / Tax जानकारी' : '🟦 GST / Tax Info'}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>GSTIN (15-digit)</Label>
                      <Input value={form.gstin || ''} onChange={e => handleGstinChange(e.target.value)} placeholder="06AAAAA0000A1Z5" className="font-mono" />
                      {form.gstin && form.gstin.length === 15 && !GSTIN_RE.test(form.gstin) && (
                        <p className="text-xs text-destructive">{hi ? 'GSTIN format गलत है' : 'Invalid GSTIN format'}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>PAN (10-digit)</Label>
                      <Input value={form.pan || ''} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase().slice(0, 10) }))} placeholder="ABCDE1234F" className="font-mono" maxLength={10} />
                      {form.pan && form.pan.length === 10 && !PAN_RE.test(form.pan) && (
                        <p className="text-xs text-destructive">{hi ? 'PAN format गलत है' : 'Invalid PAN format'}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{hi ? 'पंजीकरण प्रकार' : 'Registration Type'}</Label>
                      <Select value={form.registrationType || 'unregistered'} onValueChange={v => setForm(f => ({ ...f, registrationType: v as GstRegistrationType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="composition">Composition</SelectItem>
                          <SelectItem value="consumer">Consumer</SelectItem>
                          <SelectItem value="unregistered">Unregistered</SelectItem>
                          <SelectItem value="sez">SEZ</SelectItem>
                          <SelectItem value="overseas">Overseas / Import</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>{hi ? 'Place of Supply' : 'Place of Supply'}</Label>
                      <Input value={form.placeOfSupply || ''} onChange={e => setForm(f => ({ ...f, placeOfSupply: e.target.value }))} placeholder={hi ? 'राज्य (GSTIN से auto)' : 'State (auto from GSTIN)'} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={!!form.tdsApplicable} onCheckedChange={v => setForm(f => ({ ...f, tdsApplicable: v }))} />
                      <Label className="text-sm">{hi ? 'TDS लागू' : 'TDS Applicable'}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!form.tcsApplicable} onCheckedChange={v => setForm(f => ({ ...f, tcsApplicable: v }))} />
                      <Label className="text-sm">{hi ? 'TCS लागू' : 'TCS Applicable'}</Label>
                    </div>
                  </div>
                  {form.tdsApplicable && (
                    <div className="space-y-1">
                      <Label>{hi ? 'TDS Section' : 'TDS Section'}</Label>
                      <Select value={form.tdsSection || ''} onValueChange={v => setForm(f => ({ ...f, tdsSection: v as TdsSection }))}>
                        <SelectTrigger><SelectValue placeholder={hi ? '— चुनें —' : '— Select —'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="192">192 — Salary</SelectItem>
                          <SelectItem value="194A">194A — Interest</SelectItem>
                          <SelectItem value="194C">194C — Contractor</SelectItem>
                          <SelectItem value="194H">194H — Commission / Brokerage</SelectItem>
                          <SelectItem value="194I">194I — Rent</SelectItem>
                          <SelectItem value="194J">194J — Professional / Technical</SelectItem>
                          <SelectItem value="194Q">194Q — Purchase of Goods</SelectItem>
                          <SelectItem value="195">195 — Non-Resident</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Banking */}
            <AccordionItem value="bank">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 बैंकिंग / Banking (Payment के लिए)' : '🟦 Banking (for Payment)'}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>{hi ? 'Beneficiary Name (A/c name अलग हो तो)' : 'Beneficiary Name (if A/c name differs)'}</Label>
                  <Input value={form.beneficiaryName || ''} onChange={e => setForm(f => ({ ...f, beneficiaryName: e.target.value }))} placeholder={hi ? 'खाली रखें तो Legal Name use होगा' : 'Defaults to Legal Name if blank'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'बैंक का नाम' : 'Bank Name'}</Label>
                    <Input value={form.bankName || ''} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="State Bank of India" />
                  </div>
                  <div className="space-y-1">
                    <Label>Account No.</Label>
                    <Input value={form.accountNo || ''} onChange={e => setForm(f => ({ ...f, accountNo: e.target.value }))} placeholder="XXXXXXXXXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>IFSC</Label>
                    <Input value={form.ifsc || ''} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() }))} placeholder="SBIN0XXXXXX" className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>Branch</Label>
                    <Input value={form.branch || ''} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} placeholder="Sirsa Main" />
                  </div>
                  <div className="space-y-1">
                    <Label>UPI ID</Label>
                    <Input value={form.upiId || ''} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))} placeholder="name@upi" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Credit Terms */}
            <AccordionItem value="credit">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 उधारी की शर्तें / Credit Terms' : '🟦 Credit Terms'}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'उधारी दिन (हम पाते हैं)' : 'Credit Days (we get)'}</Label>
                    <Input type="number" min={0} value={form.creditDays ?? 0} onChange={e => setForm(f => ({ ...f, creditDays: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'उधार सीमा ₹' : 'Credit Limit ₹'}</Label>
                    <Input type="number" min={0} value={form.creditLimit ?? 0} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{hi ? 'डिफ़ॉल्ट छूट %' : 'Default Discount %'}</Label>
                    <Input type="number" min={0} max={100} step={0.1} value={form.discountPercent ?? 0} onChange={e => setForm(f => ({ ...f, discountPercent: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{hi ? 'प्रारंभिक शेष ₹' : 'Opening Balance ₹'}</Label>
                    <Input type="number" value={form.openingBalance ?? 0} onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Dr / Cr</Label>
                    <Select value={form.openingBalanceType || 'credit'} onValueChange={v => setForm(f => ({ ...f, openingBalanceType: v as 'debit' | 'credit' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Cr (we owe supplier)</SelectItem>
                        <SelectItem value="debit">Dr (supplier owes us)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notes */}
            <AccordionItem value="notes">
              <AccordionTrigger className="text-sm font-semibold">
                {hi ? '🟦 आंतरिक नोट्स / Internal Notes' : '🟦 Internal Notes'}
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={hi ? 'कोई भी नोट / यादगार जानकारी' : 'Any internal notes about this supplier'} rows={3} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-background pb-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
              {hi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} className="flex-1">
              {editId ? (hi ? 'अपडेट करें' : 'Update') : (hi ? 'सहेजें' : 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LinkedDeleteDialog
        open={deleteGuard.open}
        onOpenChange={o => setDeleteGuard(g => ({ ...g, open: o }))}
        entityName={deleteGuard.name}
        links={deleteGuard.links}
        language={language as 'hi' | 'en'}
        onConfirmDelete={() => {
          if (deleteGuard.id) {
            deleteSupplier(deleteGuard.id);
            toast({ title: hi ? 'सप्लायर हटाया गया' : 'Supplier deleted' });
          }
        }}
      />
    </div>
  );
};

export default Suppliers;
