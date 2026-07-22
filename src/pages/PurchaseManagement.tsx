import React, { useState, useMemo, useRef } from 'react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PackagePlus, Plus, Trash2, Eye, Pencil, Printer, Search, FileSpreadsheet, Download } from 'lucide-react';
import { generatePurchaseRecordPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { getBankAccountIds } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { computeInvoiceTotals } from '@/lib/invoiceTotals';
import { toMinor, toRupees, mulMinor } from '@/lib/money';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseItem, PaymentMode } from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const EMPTY_ITEM = (): PurchaseItem => ({
  itemId: '',
  itemName: '',
  unit: '',
  qty: 1,
  rate: 0,
  amount: 0,
});

const paymentModeBadgeClass: Record<PaymentMode, string> = {
  cash: 'bg-green-100 text-green-800 border-green-200',
  bank: 'bg-blue-100 text-blue-800 border-blue-200',
  credit: 'bg-orange-100 text-orange-800 border-orange-200',
};

const paymentModeLabel: Record<PaymentMode, { hi: string; en: string }> = {
  cash: { hi: 'नकद', en: 'Cash' },
  bank: { hi: 'बैंक', en: 'Bank' },
  credit: { hi: 'उधार', en: 'Credit' },
};

const PurchaseManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { purchases, stockItems, suppliers, accounts, addPurchase, updatePurchase, deletePurchase, addStockItem, society } = useData();
  const { toast } = useToast();

  // ── New Purchase form state ───────────────────────────────────────────────
  const [purchaseDate, setPurchaseDate] = useState(TODAY);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([EMPTY_ITEM()]);
  const [discount, setDiscount] = useState<number>(0);
  // GST / TDS / TCS rates (%)
  const [cgstPct, setCgstPct] = useState<number>(0);
  const [sgstPct, setSgstPct] = useState<number>(0);
  const [igstPct, setIgstPct] = useState<number>(0);
  const [tdsPct, setTdsPct] = useState<number>(0);
  const [tcsPct, setTcsPct] = useState<number>(0);
  const [rcmApplicable, setRcmApplicable] = useState<boolean>(false); // ECR-22: reverse charge
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [bankAccountId, setBankAccountId] = useState<string>('');   // which bank, when mode = 'bank'
  const [narration, setNarration] = useState('');
  const [savedPurchaseNo, setSavedPurchaseNo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'new-purchase' | 'purchase-list'>('new-purchase');

  // ── Purchase List filter state ────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterMode, setFilterMode] = useState<PaymentMode | 'all'>('all');

  // ── Dialog / AlertDialog state ───────────────────────────────────────────
  const [viewPurchase, setViewPurchase] = useState<typeof purchases[number] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Quick Add New Item dialog ─────────────────────────────────────────────
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddRowIndex, setQuickAddRowIndex] = useState<number>(0);
  const [qaName, setQaName] = useState('');
  const [qaNameHi, setQaNameHi] = useState('');
  const [qaUnit, setQaUnit] = useState('');
  const [qaRate, setQaRate] = useState<number>(0);
  const qaNameRef = useRef<HTMLInputElement>(null);

  const openQuickAdd = (index: number) => {
    setQuickAddRowIndex(index);
    setQaName(''); setQaNameHi(''); setQaUnit(''); setQaRate(0);
    setQuickAddOpen(true);
    setTimeout(() => qaNameRef.current?.focus(), 100);
  };

  const handleQuickAddSave = () => {
    if (!qaName.trim() || !qaUnit.trim()) {
      toast({ title: language === 'hi' ? 'नाम और इकाई आवश्यक है' : 'Name and unit are required', variant: 'destructive' });
      return;
    }
    const newItem = addStockItem({
      name: qaName.trim(),
      nameHi: qaNameHi.trim() || qaName.trim(),
      unit: qaUnit.trim(),
      openingStock: 0,
      currentStock: 0,
      purchaseRate: qaRate,
      saleRate: 0,
      isActive: true,
    });
    // Auto-select the new item in the row
    updateItem(quickAddRowIndex, {
      itemId: newItem.id,
      itemName: language === 'hi' ? newItem.nameHi : newItem.name,
      unit: newItem.unit,
      rate: newItem.purchaseRate,
    });
    setQuickAddOpen(false);
    toast({ title: language === 'hi' ? `"${newItem.name}" जोड़ा गया` : `"${newItem.name}" added to inventory` });
  };

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  // T-02: net / GST / TDS / TCS / grand-total born exact in integer paise (shared with SaleManagement).
  const { netAmount, cgstAmount, sgstAmount, igstAmount, taxAmount, tdsAmount, tcsAmount, grandTotal } =
    computeInvoiceTotals({ items, discount, cgstPct, sgstPct, igstPct, tdsPct, tcsPct });

  // ── Item row helpers ──────────────────────────────────────────────────────
  const updateItem = (index: number, patch: Partial<PurchaseItem>) => {
    setItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...patch };
        merged.amount = toRupees(mulMinor(toMinor(Number(merged.rate) || 0), Number(merged.qty) || 0).minor); // T-02: qty × rate born exact
        return merged;
      });
      return next;
    });
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const stock = stockItems.find(s => s.id === itemId);
    if (!stock) return;
    updateItem(index, {
      itemId: stock.id,
      itemName: language === 'hi' ? stock.nameHi : stock.name,
      unit: stock.unit,
      rate: stock.purchaseRate,
      qty: items[index].qty,
    });
  };

  const addItemRow = () => setItems(prev => [...prev, EMPTY_ITEM()]);

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ── Reset form helper ─────────────────────────────────────────────────────
  const resetForm = () => {
    setPurchaseDate(TODAY);
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setItems([EMPTY_ITEM()]);
    setDiscount(0);
    setCgstPct(0); setSgstPct(0); setIgstPct(0); setTdsPct(0); setTcsPct(0); setRcmApplicable(false);
    setPaymentMode('cash');
    setBankAccountId('');
    setNarration('');
    setEditingId(null);
  };

  // ── Load purchase into form for editing ──────────────────────────────────
  const handleEdit = (purchase: typeof purchases[number]) => {
    setEditingId(purchase.id);
    setPurchaseDate(purchase.date);
    setSupplierId(purchase.supplierId || '');
    setSupplierName(purchase.supplierName);
    setSupplierPhone(purchase.supplierPhone || '');
    setItems(purchase.items.length ? purchase.items.map(it => ({ ...it })) : [EMPTY_ITEM()]);
    setDiscount(purchase.discount || 0);
    setCgstPct(purchase.cgstPct || 0);
    setSgstPct(purchase.sgstPct || 0);
    setIgstPct(purchase.igstPct || 0);
    setTdsPct(purchase.tdsPct || 0);
    setTcsPct(purchase.tcsPct || 0);
    setRcmApplicable(!!purchase.rcmApplicable);
    setPaymentMode(purchase.paymentMode);
    setBankAccountId(purchase.bankAccountId || '');
    setNarration(purchase.narration || '');
    setSavedPurchaseNo(null);
    setActiveTab('new-purchase');
  };

  // ── Save purchase (create or update) ──────────────────────────────────────
  const handleSave = () => {
    if (!supplierName.trim()) {
      toast({
        title: language === 'hi' ? 'कृपया आपूर्तिकर्ता चुनें' : 'Please select a supplier',
        variant: 'destructive',
      });
      return;
    }
    const validItems = items.filter(i => i.itemId && i.qty > 0 && i.rate >= 0);
    if (validItems.length === 0) {
      toast({
        title: language === 'hi' ? 'कृपया कम से कम एक वस्तु जोड़ें' : 'Please add at least one item',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      date: purchaseDate,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone.trim() || undefined,
      supplierId: supplierId || undefined,
      items: validItems,
      totalAmount,
      discount,
      netAmount,
      cgstPct, sgstPct, igstPct, tdsPct, tcsPct,
      cgstAmount, sgstAmount, igstAmount, tdsAmount, tcsAmount,
      taxAmount, grandTotal,
      rcmApplicable,
      paymentMode,
      bankAccountId: paymentMode === 'bank' ? (bankAccountId || undefined) : undefined,
      narration: narration.trim(),
      createdBy: user?.name ?? 'Unknown',
    };

    try {
      if (editingId) {
        const updated = updatePurchase(editingId, payload);
        if (updated) {
          setSavedPurchaseNo(updated.purchaseNo);
          toast({
            title: language === 'hi'
              ? `खरीद अपडेट हुई: ${updated.purchaseNo}`
              : `Purchase updated: ${updated.purchaseNo}`,
          });
          resetForm();
          setActiveTab('purchase-list');
        }
      } else {
        const newPurchase = addPurchase(payload);
        setSavedPurchaseNo(newPurchase.purchaseNo);
        toast({
          title: language === 'hi'
            ? `खरीद सहेजी गई: ${newPurchase.purchaseNo}`
            : `Purchase saved: ${newPurchase.purchaseNo}`,
        });
        resetForm();
      }
    } catch (err) {
      toast({
        title: language === 'hi' ? 'खरीद पोस्ट नहीं हुई' : 'Purchase not posted',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  // ── Delete purchase ───────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteId) return;
    deletePurchase(deleteId);
    setDeleteId(null);
    toast({ title: language === 'hi' ? 'खरीद हटाई गई' : 'Purchase deleted' });
  };

  // ── Download Purchase Record PDF (internal) ───────────────────────────────
  const handleDownloadRecord = (purchase: typeof purchases[number]) => {
    const supplier = purchase.supplierId ? suppliers.find(s => s.id === purchase.supplierId) : undefined;
    const recordSupplier = supplier ? {
      legalName: supplier.legalName || supplier.name,
      name: supplier.name,
      tradeName: supplier.tradeName,
      supplierType: supplier.supplierType,
      addressLine1: supplier.addressLine1 || supplier.address,
      addressLine2: supplier.addressLine2,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      pincode: supplier.pincode,
      country: supplier.country,
      mobile: supplier.mobile || supplier.phone,
      phone: supplier.phone,
      email: supplier.email,
      gstin: supplier.gstin || supplier.gstNo,
      gstNo: supplier.gstNo,
      pan: supplier.pan,
      placeOfSupply: supplier.placeOfSupply,
      contactPerson: supplier.contactPerson,
      bankName: supplier.bankName,
      accountNo: supplier.accountNo,
      ifsc: supplier.ifsc,
      branch: supplier.branch,
      upiId: supplier.upiId,
      tdsSection: supplier.tdsSection,
    } : {
      name: purchase.supplierName,
      legalName: purchase.supplierName,
      phone: purchase.supplierPhone,
      mobile: purchase.supplierPhone,
    };
    const enrichedItems = purchase.items.map(it => ({
      itemName: it.itemName,
      unit: it.unit,
      qty: it.qty,
      rate: it.rate,
      amount: it.amount,
      hsn: stockItems.find(s => s.id === it.itemId)?.hsnCode,
    }));
    try {
      generatePurchaseRecordPDF({
        purchaseNo: purchase.purchaseNo,
        date: purchase.date,
        supplier: recordSupplier,
        items: enrichedItems,
        totalAmount: purchase.totalAmount,
        discount: purchase.discount || 0,
        netAmount: purchase.netAmount,
        cgstPct: purchase.cgstPct || 0,
        sgstPct: purchase.sgstPct || 0,
        igstPct: purchase.igstPct || 0,
        tdsPct: purchase.tdsPct || 0,
        tcsPct: purchase.tcsPct || 0,
        cgstAmount: purchase.cgstAmount || 0,
        sgstAmount: purchase.sgstAmount || 0,
        igstAmount: purchase.igstAmount || 0,
        tdsAmount: purchase.tdsAmount || 0,
        tcsAmount: purchase.tcsAmount || 0,
        taxAmount: purchase.taxAmount || 0,
        grandTotal: purchase.grandTotal || purchase.netAmount,
        paymentMode: purchase.paymentMode,
        narration: purchase.narration,
      }, society);
      toast({ title: language === 'hi' ? `Purchase Record: ${purchase.purchaseNo}` : `Purchase Record: ${purchase.purchaseNo}` });
    } catch (err) {
      toast({
        title: language === 'hi' ? 'PDF नहीं बना' : 'Could not generate PDF',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  // ── Filtered purchases ────────────────────────────────────────────────────
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (filterFrom && p.date < filterFrom) return false;
      if (filterTo && p.date > filterTo) return false;
      if (filterSupplier && !p.supplierName.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
      if (filterMode !== 'all' && p.paymentMode !== filterMode) return false;
      return true;
    });
  }, [purchases, filterFrom, filterTo, filterSupplier, filterMode]);

  const handleCSV = () => {
    const headers = ['Purchase No', 'Date', 'Supplier', 'Phone', 'Items', 'Net Amount', 'Payment Mode'];
    const rows = filteredPurchases.map(p => [p.purchaseNo || '', p.date, p.supplierName || '', p.supplierPhone || '', p.items?.length || 0, p.netAmount || 0, p.paymentMode || '']);
    downloadCSV(headers, rows, 'purchases.csv');
  };
  const handleExcel = () => {
    const headers = ['Purchase No', 'Date', 'Supplier', 'Phone', 'Items', 'Net Amount', 'Payment Mode'];
    const rows = filteredPurchases.map(p => [p.purchaseNo || '', p.date, p.supplierName || '', p.supplierPhone || '', p.items?.length || 0, p.netAmount || 0, p.paymentMode || '']);
    downloadExcelSingle(headers, rows, 'purchases.xlsx', 'Purchases');
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalCount = filteredPurchases.length;
  const totalNet = filteredPurchases.reduce((s, p) => s + p.netAmount, 0);
  const cashTotal = filteredPurchases.filter(p => p.paymentMode === 'cash').reduce((s, p) => s + p.netAmount, 0);
  const creditTotal = filteredPurchases.filter(p => p.paymentMode === 'credit').reduce((s, p) => s + p.netAmount, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <PackagePlus className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'hi' ? 'खरीद प्रबंधन' : 'Purchase Management'}
          </h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new-purchase' | 'purchase-list')}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="new-purchase">
            {editingId
              ? (language === 'hi' ? 'खरीद संपादन' : 'Edit Purchase')
              : (language === 'hi' ? 'नई खरीद' : 'New Purchase')}
          </TabsTrigger>
          <TabsTrigger value="purchase-list">
            {language === 'hi' ? 'खरीद सूची' : 'Purchase List'}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: New Purchase Entry ─────────────────────────────────── */}
        <TabsContent value="new-purchase" className="space-y-4 mt-4">
          {editingId && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Pencil className="h-4 w-4 text-amber-700" />
              <span className="text-amber-800 font-medium text-sm">
                {language === 'hi'
                  ? `संपादन मोड — पुरानी एंट्री बदली जाएगी, स्टॉक एडजस्ट होगा`
                  : `Editing mode — original entry will be replaced, stock will be re-adjusted`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-amber-700"
                onClick={() => { resetForm(); }}
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel Edit'}
              </Button>
            </div>
          )}
          {savedPurchaseNo && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700 font-medium">
                {language === 'hi'
                  ? `खरीद सफलतापूर्वक सहेजी गई — ${savedPurchaseNo}`
                  : `Purchase saved successfully — ${savedPurchaseNo}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-green-700"
                onClick={() => setSavedPurchaseNo(null)}
              >
                ×
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === 'hi' ? 'खरीद विवरण' : 'Purchase Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'तिथि' : 'Date'}</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {language === 'hi' ? 'आपूर्तिकर्ता' : 'Supplier'}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={supplierId}
                  onValueChange={val => {
                    setSupplierId(val);
                    const sup = suppliers.find(s => s.id === val);
                    setSupplierName(sup?.name || '');
                    setSupplierPhone(sup?.phone || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'hi' ? 'आपूर्तिकर्ता चुनें' : 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.isActive).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {suppliers.filter(s => s.isActive).length === 0 && (
                      <SelectItem value="__none__" disabled>
                        {language === 'hi' ? 'कोई आपूर्तिकर्ता नहीं — पहले जोड़ें' : 'No suppliers — add first'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'फोन' : 'Phone'}</Label>
                <Input
                  value={supplierPhone}
                  readOnly
                  placeholder={language === 'hi' ? 'स्वतः भरेगा' : 'Auto-filled'}
                  className="bg-muted/50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">
                {language === 'hi' ? 'वस्तुएं' : 'Items'}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addItemRow}>
                <Plus className="h-4 w-4 mr-1" />
                {language === 'hi' ? 'पंक्ति जोड़ें' : 'Add Row'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">{language === 'hi' ? 'वस्तु' : 'Item'}</TableHead>
                    <TableHead className="w-20">{language === 'hi' ? 'इकाई' : 'Unit'}</TableHead>
                    <TableHead className="w-24">{language === 'hi' ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="w-28">{language === 'hi' ? 'दर (₹)' : 'Rate (₹)'}</TableHead>
                    <TableHead className="w-28">{language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Select
                            value={item.itemId}
                            onValueChange={val => handleItemSelect(index, val)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={language === 'hi' ? 'वस्तु चुनें' : 'Select item'} />
                            </SelectTrigger>
                            <SelectContent>
                              {stockItems.filter(s => s.isActive).map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  {language === 'hi' ? s.nameHi : s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-green-600 border-green-300 hover:bg-green-50"
                            title={language === 'hi' ? 'नया आइटम जोड़ें' : 'Add new item'}
                            onClick={() => openQuickAdd(index)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={item.unit} readOnly className="bg-gray-50 w-20" />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={e => updateItem(index, { qty: Math.max(0, Number(e.target.value)) })}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.rate}
                          onChange={e => updateItem(index, { rate: Math.max(0, Number(e.target.value)) })}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.amount.toFixed(2)}
                          readOnly
                          className="bg-gray-50 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals + Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === 'hi' ? 'राशि व कर विवरण' : 'Amount & Tax Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {/* Subtotal */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === 'hi' ? 'उपयोग कुल' : 'Subtotal'}</span>
                  <span>{fmt(totalAmount)}</span>
                </div>
                {/* Discount */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{language === 'hi' ? 'छूट (₹)' : 'Discount (₹)'}</span>
                  <Input type="number" min={0} value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className="w-28 h-7 text-right text-sm" />
                </div>
                {/* Taxable */}
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">{language === 'hi' ? 'कर योग्य राशि' : 'Taxable Amount'}</span>
                  <span className="font-medium">{fmt(netAmount)}</span>
                </div>

                {/* GST Section */}
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2 mt-1">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wide">GST (Input Tax Credit)</p>
                  {/* CGST */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-20">CGST %</span>
                    <Input type="number" min={0} max={28} step={0.5} value={cgstPct} onChange={e => setCgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right text-sm" />
                    <span className="w-24 text-right text-muted-foreground">{fmt(cgstAmount)}</span>
                  </div>
                  {/* SGST */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-20">SGST %</span>
                    <Input type="number" min={0} max={28} step={0.5} value={sgstPct} onChange={e => setSgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right text-sm" />
                    <span className="w-24 text-right text-muted-foreground">{fmt(sgstAmount)}</span>
                  </div>
                  {/* IGST */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-20">IGST %</span>
                    <Input type="number" min={0} max={28} step={0.5} value={igstPct} onChange={e => setIgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right text-sm" />
                    <span className="w-24 text-right text-muted-foreground">{fmt(igstAmount)}</span>
                  </div>
                  {/* ECR-22: Reverse Charge Mechanism */}
                  <label className="flex items-center gap-2 pt-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={rcmApplicable} onChange={e => setRcmApplicable(e.target.checked)} className="h-4 w-4" />
                    <span>{language === 'hi' ? 'रिवर्स चार्ज (RCM) लागू' : 'Reverse Charge (RCM) applicable'}</span>
                  </label>
                  {taxAmount > 0 && (
                    <div className="flex justify-between border-t border-blue-200 pt-1 font-medium text-blue-700 dark:text-blue-300">
                      <span>{language === 'hi' ? 'कुल GST' : 'Total GST'}</span>
                      <span>{fmt(taxAmount)}</span>
                    </div>
                  )}
                </div>

                {/* TDS Section — WE deduct; the supplier gets paid less */}
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-orange-700 dark:text-orange-300 text-xs uppercase tracking-wide">
                    TDS {language === 'hi' ? 'कटौती — हम काटते हैं (घटेगा)' : 'Deduction — we deduct (reduces)'}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-20">TDS %</span>
                    <Input type="number" min={0} max={30} step={0.1} value={tdsPct} onChange={e => setTdsPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right text-sm" />
                    {/* Always show a figure. This read '—' at zero while every GST row read ₹0.00,
                        so an empty form looked like the field was dead — a real society burned half
                        an hour on it before sending a screenshot. */}
                    <span className="w-24 text-right text-destructive font-medium">{tdsAmount > 0 ? `(${fmt(tdsAmount)})` : fmt(0)}</span>
                  </div>
                </div>

                {/* TCS Section — the SELLER collects; the bill goes UP. Forest-depot timber, scrap,
                    minerals etc. carry this. Never the same field as TDS: opposite sign, opposite ledger. */}
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-xs uppercase tracking-wide">
                    TCS {language === 'hi' ? 'आयकर — विक्रेता वसूलता है (जुड़ेगा)' : 'Income tax — seller collects (adds)'}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-20">TCS %</span>
                    <Input type="number" min={0} max={30} step={0.1} value={tcsPct} onChange={e => setTcsPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right text-sm" />
                    <span className="w-24 text-right text-emerald-700 dark:text-emerald-300 font-medium">{fmt(tcsAmount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi'
                      ? 'बिल पर "I.T." लिखा हो और रकम में जुड़ा हो — तो यहाँ भरें, TDS में नहीं।'
                      : 'If the bill shows "I.T." ADDED to the total, it belongs here — not in TDS.'}
                  </p>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between font-bold text-base border-t-2 pt-2 text-primary">
                  <span>{language === 'hi' ? 'कुल देय राशि' : 'Grand Total'}</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi'
                      ? `* GST के लिए अलग जर्नल एंट्री स्वतः बनेगी (Dr GST Input / Cr ${supplierName || 'आपूर्तिकर्ता'})`
                      : `* Separate journal entry will be auto-created for GST (Dr GST Input / Cr ${supplierName || 'Supplier'})`}
                  </p>
                )}
                {tdsAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi'
                      ? `* TDS के लिए अलग जर्नल एंट्री स्वतः बनेगी (Dr ${supplierName || 'आपूर्तिकर्ता'} / Cr TDS देय)`
                      : `* Separate journal entry will be auto-created for TDS (Dr ${supplierName || 'Supplier'} / Cr TDS Payable)`}
                  </p>
                )}
                {tcsAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi'
                      ? `* TCS आपका आयकर क्रेडिट है — "प्राप्य TDS / TCS" खाते में जाएगा (Dr), देय में नहीं`
                      : `* TCS is your income-tax credit — booked to "TDS / TCS Receivable" (Dr), not to a payable`}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === 'hi' ? 'भुगतान विधि' : 'Payment Mode'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {(['cash', 'bank', 'credit'] as PaymentMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                        paymentMode === mode
                          ? paymentModeBadgeClass[mode] + ' border-current font-semibold'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {paymentModeLabel[mode][language]}
                    </button>
                  ))}
                </div>
                {paymentMode === 'bank' && (
                  <div className="space-y-1">
                    <Label>{language === 'hi' ? 'बैंक खाता' : 'Bank Account'}</Label>
                    <Select value={bankAccountId} onValueChange={setBankAccountId}>
                      <SelectTrigger><SelectValue placeholder={language === 'hi' ? 'बैंक चुनें' : 'Select bank'} /></SelectTrigger>
                      <SelectContent>
                        {getBankAccountIds(accounts).map(id => accounts.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a).map(a => (
                          <SelectItem key={a.id} value={a.id}>{language === 'hi' ? (a.nameHi || a.name) : a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>{language === 'hi' ? 'नोट (वैकल्पिक)' : 'Narration (Optional)'}</Label>
                  <Textarea
                    value={narration}
                    onChange={e => setNarration(e.target.value)}
                    rows={2}
                    placeholder={language === 'hi' ? 'नोट लिखें...' : 'Enter narration...'}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </Button>
            )}
            <Button onClick={handleSave} className="px-8">
              {editingId
                ? (language === 'hi' ? 'अपडेट करें' : 'Update Purchase')
                : (language === 'hi' ? 'खरीद सहेजें' : 'Save Purchase')}
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 2: Purchase List ──────────────────────────────────────── */}
        <TabsContent value="purchase-list" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'कुल खरीद' : 'Total Purchases'}</p>
                <p className="text-2xl font-bold text-purple-700">{totalCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'कुल राशि' : 'Total Amount'}</p>
                <p className="text-xl font-bold text-gray-900">{fmt(totalNet)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'नकद खरीद' : 'Cash Purchases'}</p>
                <p className="text-xl font-bold text-green-700">{fmt(cashTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'उधार खरीद' : 'Credit Purchases'}</p>
                <p className="text-xl font-bold text-orange-700">{fmt(creditTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>{language === 'hi' ? 'तिथि से' : 'From Date'}</Label>
                  <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{language === 'hi' ? 'तिथि तक' : 'To Date'}</Label>
                  <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{language === 'hi' ? 'आपूर्तिकर्ता खोजें' : 'Search Supplier'}</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      className="pl-8"
                      value={filterSupplier}
                      onChange={e => setFilterSupplier(e.target.value)}
                      placeholder={language === 'hi' ? 'नाम...' : 'Name...'}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{language === 'hi' ? 'भुगतान विधि' : 'Payment Mode'}</Label>
                  <Select value={filterMode} onValueChange={(v) => setFilterMode(v as PaymentMode | 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === 'hi' ? 'सभी' : 'All'}</SelectItem>
                      <SelectItem value="cash">{paymentModeLabel.cash[language]}</SelectItem>
                      <SelectItem value="bank">{paymentModeLabel.bank[language]}</SelectItem>
                      <SelectItem value="credit">{paymentModeLabel.credit[language]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export buttons */}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              {language === 'hi' ? 'Excel' : 'Excel'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={handleCSV}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'hi' ? 'खरीद नं.' : 'Purchase No.'}</TableHead>
                    <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{language === 'hi' ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                    <TableHead className="text-center">{language === 'hi' ? 'वस्तुएं' : 'Items'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'शुद्ध राशि' : 'Net Amount'}</TableHead>
                    <TableHead>{language === 'hi' ? 'भुगतान' : 'Payment'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'कार्य' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        {language === 'hi' ? 'कोई डेटा नहीं' : 'No data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchases
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(purchase => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-mono text-sm">{purchase.purchaseNo}</TableCell>
                          <TableCell>{fmtDate(purchase.date)}</TableCell>
                          <TableCell>
                            <div>{purchase.supplierName}</div>
                            {purchase.supplierPhone && (
                              <div className="text-xs text-gray-400">{purchase.supplierPhone}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{purchase.items.length}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(purchase.netAmount)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(paymentModeBadgeClass[purchase.paymentMode])}
                            >
                              {paymentModeLabel[purchase.paymentMode][language]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewPurchase(purchase)}
                                title={language === 'hi' ? 'देखें' : 'View'}
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadRecord(purchase)}
                                title={language === 'hi' ? 'Purchase Record PDF' : 'Purchase Record PDF'}
                              >
                                <Printer className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(purchase)}
                                title={language === 'hi' ? 'संपादन' : 'Edit'}
                              >
                                <Pencil className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(purchase.id)}
                                title={language === 'hi' ? 'हटाएं' : 'Delete'}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
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
      </Tabs>

      {/* ── View Purchase Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!viewPurchase} onOpenChange={() => setViewPurchase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === 'hi' ? 'खरीद विवरण' : 'Purchase Details'} — {viewPurchase?.purchaseNo}
            </DialogTitle>
          </DialogHeader>
          {viewPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'तिथि' : 'Date'}</p>
                  <p className="font-medium">{fmtDate(viewPurchase.date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'आपूर्तिकर्ता' : 'Supplier'}</p>
                  <p className="font-medium">{viewPurchase.supplierName}</p>
                </div>
                {viewPurchase.supplierPhone && (
                  <div>
                    <p className="text-gray-500">{language === 'hi' ? 'फोन' : 'Phone'}</p>
                    <p className="font-medium">{viewPurchase.supplierPhone}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'भुगतान विधि' : 'Payment'}</p>
                  <Badge variant="outline" className={cn(paymentModeBadgeClass[viewPurchase.paymentMode])}>
                    {paymentModeLabel[viewPurchase.paymentMode][language]}
                  </Badge>
                </div>
                {viewPurchase.narration && (
                  <div className="col-span-2">
                    <p className="text-gray-500">{language === 'hi' ? 'नोट' : 'Narration'}</p>
                    <p className="font-medium">{viewPurchase.narration}</p>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{language === 'hi' ? 'वस्तु' : 'Item'}</TableHead>
                    <TableHead>{language === 'hi' ? 'इकाई' : 'Unit'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'दर' : 'Rate'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPurchase.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">{fmt(item.rate)}</TableCell>
                      <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-1 text-sm text-right border-t pt-2">
                <div className="flex justify-between">
                  <span>{language === 'hi' ? 'उपयोग कुल' : 'Subtotal'}</span>
                  <span>{fmt(viewPurchase.totalAmount)}</span>
                </div>
                {(viewPurchase.discount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>{language === 'hi' ? 'छूट' : 'Discount'}</span>
                    <span className="text-red-600">- {fmt(viewPurchase.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{language === 'hi' ? 'कर योग्य राशि' : 'Taxable Amount'}</span>
                  <span className="font-semibold">{fmt(viewPurchase.netAmount)}</span>
                </div>
                {/* GST Input Tax Credit */}
                {((viewPurchase.cgstAmount || 0) > 0 || (viewPurchase.sgstAmount || 0) > 0 || (viewPurchase.igstAmount || 0) > 0) && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-2 space-y-1 text-left">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                      {language === 'hi' ? 'GST (इनपुट टैक्स क्रेडिट)' : 'GST (INPUT TAX CREDIT)'}
                    </p>
                    {(viewPurchase.cgstAmount || 0) > 0 && (
                      <div className="flex justify-between text-blue-700">
                        <span>CGST ({viewPurchase.cgstPct || 0}%)</span>
                        <span>{fmt(viewPurchase.cgstAmount!)}</span>
                      </div>
                    )}
                    {(viewPurchase.sgstAmount || 0) > 0 && (
                      <div className="flex justify-between text-blue-700">
                        <span>SGST ({viewPurchase.sgstPct || 0}%)</span>
                        <span>{fmt(viewPurchase.sgstAmount!)}</span>
                      </div>
                    )}
                    {(viewPurchase.igstAmount || 0) > 0 && (
                      <div className="flex justify-between text-blue-700">
                        <span>IGST ({viewPurchase.igstPct || 0}%)</span>
                        <span>{fmt(viewPurchase.igstAmount!)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-blue-200 pt-1 text-blue-800">
                      <span>{language === 'hi' ? 'कुल GST' : 'Total GST'}</span>
                      <span>{fmt(viewPurchase.taxAmount || 0)}</span>
                    </div>
                  </div>
                )}
                {/* TDS Deduction */}
                {(viewPurchase.tdsAmount || 0) > 0 && (
                  <div className="rounded-md bg-orange-50 border border-orange-200 p-2 space-y-1 text-left">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-1">
                      {language === 'hi' ? 'TDS कटौती' : 'TDS DEDUCTION'}
                    </p>
                    <div className="flex justify-between text-orange-700">
                      <span>TDS ({viewPurchase.tdsPct || 0}%)</span>
                      <span className="text-red-600">- {fmt(viewPurchase.tdsAmount!)}</span>
                    </div>
                  </div>
                )}
                {/* TCS collected by the seller — shown as an addition, mirroring the bill */}
                {(viewPurchase.tcsAmount || 0) > 0 && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 space-y-1 text-left">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
                      {language === 'hi' ? 'TCS (आयकर — विक्रेता द्वारा वसूल)' : 'TCS (income tax — collected by seller)'}
                    </p>
                    <div className="flex justify-between text-emerald-700">
                      <span>TCS ({viewPurchase.tcsPct || 0}%)</span>
                      <span>+ {fmt(viewPurchase.tcsAmount!)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t-2 pt-2">
                  <span>{language === 'hi' ? 'कुल राशि (Grand Total)' : 'Grand Total'}</span>
                  <span className="text-primary">{fmt(viewPurchase.grandTotal || viewPurchase.netAmount)}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => { const p = viewPurchase; setViewPurchase(null); handleEdit(p); }}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {language === 'hi' ? 'इस खरीद को संपादित करें' : 'Edit this Purchase'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm AlertDialog ────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'hi' ? 'क्या आप वाकई हटाना चाहते हैं?' : 'Are you sure you want to delete?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'hi'
                ? 'यह खरीद स्थायी रूप से हटा दी जाएगी।'
                : 'This purchase will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {language === 'hi' ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Quick Add New Item Dialog ───────────────────────────────────── */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'hi' ? '➕ नई वस्तु जोड़ें' : '➕ Add New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>{language === 'hi' ? 'नाम (अंग्रेज़ी)' : 'Name (English)'} *</Label>
              <Input ref={qaNameRef} value={qaName} onChange={e => setQaName(e.target.value)} placeholder="e.g. Wheat 50kg" />
            </div>
            <div>
              <Label>{language === 'hi' ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
              <Input value={qaNameHi} onChange={e => setQaNameHi(e.target.value)} placeholder="जैसे गेहूं 50 किलो" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{language === 'hi' ? 'इकाई' : 'Unit'} *</Label>
                <Input value={qaUnit} onChange={e => setQaUnit(e.target.value)} placeholder="Bag / Kg / Ltr" />
              </div>
              <div>
                <Label>{language === 'hi' ? 'क्रय दर (₹)' : 'Purchase Rate (₹)'}</Label>
                <Input type="number" min={0} value={qaRate} onChange={e => setQaRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleQuickAddSave}>
                {language === 'hi' ? 'सहेजें और चुनें' : 'Save & Select'}
              </Button>
              <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseManagement;
