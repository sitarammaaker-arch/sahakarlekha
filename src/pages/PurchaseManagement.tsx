import React, { useState, useMemo } from 'react';
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
import { PackagePlus, Plus, Trash2, Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseItem, PaymentMode } from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

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
  const { purchases, stockItems, addPurchase, deletePurchase, society } = useData();
  const { toast } = useToast();

  // ── New Purchase form state ───────────────────────────────────────────────
  const [purchaseDate, setPurchaseDate] = useState(TODAY);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([EMPTY_ITEM()]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [narration, setNarration] = useState('');
  const [savedPurchaseNo, setSavedPurchaseNo] = useState<string | null>(null);

  // ── Purchase List filter state ────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterMode, setFilterMode] = useState<PaymentMode | 'all'>('all');

  // ── Dialog / AlertDialog state ───────────────────────────────────────────
  const [viewPurchase, setViewPurchase] = useState<typeof purchases[number] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const netAmount = Math.max(0, totalAmount - discount);

  // ── Item row helpers ──────────────────────────────────────────────────────
  const updateItem = (index: number, patch: Partial<PurchaseItem>) => {
    setItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...patch };
        merged.amount = +(merged.qty * merged.rate).toFixed(2);
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

  // ── Save purchase ─────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!supplierName.trim()) {
      toast({
        title: language === 'hi' ? 'कृपया आपूर्तिकर्ता का नाम दर्ज करें' : 'Please enter supplier name',
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

    try {
      const newPurchase = addPurchase({
        date: purchaseDate,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        items: validItems,
        totalAmount,
        discount,
        netAmount,
        paymentMode,
        narration: narration.trim(),
        createdBy: user?.name ?? 'Unknown',
      });

      setSavedPurchaseNo(newPurchase.purchaseNo);
      toast({
        title: language === 'hi'
          ? `खरीद सहेजी गई: ${newPurchase.purchaseNo}`
          : `Purchase saved: ${newPurchase.purchaseNo}`,
      });

      // Reset form
      setPurchaseDate(TODAY);
      setSupplierName('');
      setSupplierPhone('');
      setItems([EMPTY_ITEM()]);
      setDiscount(0);
      setPaymentMode('cash');
      setNarration('');
    } catch {
      toast({
        title: language === 'hi' ? 'कोई त्रुटि हुई' : 'An error occurred',
        variant: 'destructive',
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

      <Tabs defaultValue="new-purchase">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="new-purchase">
            {language === 'hi' ? 'नई खरीद' : 'New Purchase'}
          </TabsTrigger>
          <TabsTrigger value="purchase-list">
            {language === 'hi' ? 'खरीद सूची' : 'Purchase List'}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: New Purchase Entry ─────────────────────────────────── */}
        <TabsContent value="new-purchase" className="space-y-4 mt-4">
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
                  {language === 'hi' ? 'आपूर्तिकर्ता का नाम' : 'Supplier Name'}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder={language === 'hi' ? 'आपूर्तिकर्ता का नाम' : 'Supplier name'}
                />
              </div>
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'फोन (वैकल्पिक)' : 'Phone (Optional)'}</Label>
                <Input
                  value={supplierPhone}
                  onChange={e => setSupplierPhone(e.target.value)}
                  placeholder={language === 'hi' ? 'फोन नंबर' : 'Phone number'}
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
                  {language === 'hi' ? 'राशि विवरण' : 'Amount Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>{language === 'hi' ? 'उपयोग कुल' : 'Subtotal'}</span>
                  <span>{fmt(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-4">
                  <span>{language === 'hi' ? 'छूट (₹)' : 'Discount (₹)'}</span>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-32 h-8 text-right"
                  />
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{language === 'hi' ? 'शुद्ध राशि' : 'Net Amount'}</span>
                  <span>{fmt(netAmount)}</span>
                </div>
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

          <div className="flex justify-end">
            <Button onClick={handleSave} className="px-8">
              {language === 'hi' ? 'खरीद सहेजें' : 'Save Purchase'}
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
                          <TableCell>{new Date(purchase.date).toLocaleDateString('hi-IN')}</TableCell>
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
                  <p className="font-medium">{new Date(viewPurchase.date).toLocaleDateString('hi-IN')}</p>
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
                <div className="flex justify-between">
                  <span>{language === 'hi' ? 'छूट' : 'Discount'}</span>
                  <span className="text-red-600">- {fmt(viewPurchase.discount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>{language === 'hi' ? 'शुद्ध राशि' : 'Net Amount'}</span>
                  <span>{fmt(viewPurchase.netAmount)}</span>
                </div>
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
    </div>
  );
};

export default PurchaseManagement;
