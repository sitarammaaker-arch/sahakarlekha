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
import { ShoppingCart, Plus, Trash2, Eye, Search, FileSpreadsheet, Download, AlertTriangle } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { SaleItem, PaymentMode } from '@/types';

const TODAY = new Date().toISOString().split('T')[0];

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const EMPTY_ITEM = (): SaleItem => ({
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

const SaleManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { sales, stockItems, customers, addSale, deleteSale, addStockItem, society } = useData();
  const { toast } = useToast();

  // ── New Sale form state ───────────────────────────────────────────────────
  const [saleDate, setSaleDate] = useState(TODAY);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<SaleItem[]>([EMPTY_ITEM()]);
  const [discount, setDiscount] = useState<number>(0);
  const [cgstPct, setCgstPct] = useState<number>(0);
  const [sgstPct, setSgstPct] = useState<number>(0);
  const [igstPct, setIgstPct] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [narration, setNarration] = useState('');
  const [savedSaleNo, setSavedSaleNo] = useState<string | null>(null);

  // ── Sale List filter state ────────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterMode, setFilterMode] = useState<PaymentMode | 'all'>('all');

  // ── Dialog / AlertDialog state ───────────────────────────────────────────
  const [viewSale, setViewSale] = useState<typeof sales[number] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Quick Add New Item dialog ─────────────────────────────────────────────
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddRowIndex, setQuickAddRowIndex] = useState<number>(0);
  const [qaName, setQaName] = useState('');
  const [qaNameHi, setQaNameHi] = useState('');
  const [qaUnit, setQaUnit] = useState('');
  const [qaSaleRate, setQaSaleRate] = useState<number>(0);
  const qaNameRef = useRef<HTMLInputElement>(null);

  const openQuickAdd = (index: number) => {
    setQuickAddRowIndex(index);
    setQaName(''); setQaNameHi(''); setQaUnit(''); setQaSaleRate(0);
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
      purchaseRate: 0,
      saleRate: qaSaleRate,
      isActive: true,
    });
    updateItem(quickAddRowIndex, {
      itemId: newItem.id,
      itemName: language === 'hi' ? newItem.nameHi : newItem.name,
      unit: newItem.unit,
      rate: newItem.saleRate,
    });
    setQuickAddOpen(false);
    toast({ title: language === 'hi' ? `"${newItem.name}" जोड़ा गया` : `"${newItem.name}" added to inventory` });
  };

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalAmount  = items.reduce((s, i) => s + i.amount, 0);
  const netAmount    = Math.max(0, totalAmount - discount);
  const cgstAmount   = Math.round(netAmount * (cgstPct / 100) * 100) / 100;
  const sgstAmount   = Math.round(netAmount * (sgstPct / 100) * 100) / 100;
  const igstAmount   = Math.round(netAmount * (igstPct / 100) * 100) / 100;
  const taxAmount    = cgstAmount + sgstAmount + igstAmount;
  const grandTotal   = netAmount + taxAmount;

  // ── Item row helpers ──────────────────────────────────────────────────────
  const updateItem = (index: number, patch: Partial<SaleItem>) => {
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
      rate: stock.saleRate,
      qty: items[index].qty,
    });
  };

  const addItemRow = () => setItems(prev => [...prev, EMPTY_ITEM()]);

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ── Save sale ─────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!customerName.trim()) {
      toast({
        title: language === 'hi' ? 'कृपया ग्राहक चुनें' : 'Please select a customer',
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

    // Stock availability warning (soft — sale still proceeds)
    const lowStockItems = validItems.filter(i => {
      const si = stockItems.find(s => s.id === i.itemId);
      return si && i.qty > si.currentStock;
    });
    if (lowStockItems.length > 0) {
      const names = lowStockItems.map(i => {
        const si = stockItems.find(s => s.id === i.itemId);
        return `${i.itemName} (${language === 'hi' ? 'उपलब्ध' : 'avail'}: ${si?.currentStock ?? 0}, ${language === 'hi' ? 'बिक्री' : 'selling'}: ${i.qty})`;
      }).join(', ');
      toast({
        title: language === 'hi' ? 'अपर्याप्त स्टॉक चेतावनी' : 'Insufficient Stock Warning',
        description: names,
        variant: 'default',
      });
    }

    try {
      const newSale = addSale({
        date: saleDate,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerId: customerId || undefined,
        items: validItems,
        totalAmount,
        discount,
        netAmount,
        cgstPct, sgstPct, igstPct,
        cgstAmount, sgstAmount, igstAmount,
        taxAmount, grandTotal,
        paymentMode,
        narration: narration.trim(),
        createdBy: user?.name ?? 'Unknown',
      });

      setSavedSaleNo(newSale.saleNo);
      toast({
        title: language === 'hi'
          ? `बिक्री सहेजी गई: ${newSale.saleNo}`
          : `Sale saved: ${newSale.saleNo}`,
      });

      // Reset form
      setSaleDate(TODAY);
      setCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setItems([EMPTY_ITEM()]);
      setDiscount(0);
      setCgstPct(0); setSgstPct(0); setIgstPct(0);
      setPaymentMode('cash');
      setNarration('');
    } catch {
      toast({
        title: language === 'hi' ? 'कोई त्रुटि हुई' : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  // ── Delete sale ───────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteId) return;
    deleteSale(deleteId);
    setDeleteId(null);
    toast({ title: language === 'hi' ? 'बिक्री हटाई गई' : 'Sale deleted' });
  };

  // ── Filtered sales ────────────────────────────────────────────────────────
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (filterFrom && s.date < filterFrom) return false;
      if (filterTo && s.date > filterTo) return false;
      if (filterCustomer && !s.customerName.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
      if (filterMode !== 'all' && s.paymentMode !== filterMode) return false;
      return true;
    });
  }, [sales, filterFrom, filterTo, filterCustomer, filterMode]);

  const handleCSV = () => {
    const headers = ['Sale No', 'Date', 'Customer', 'Phone', 'Items', 'Net Amount', 'Payment Mode'];
    const rows = filteredSales.map(s => [s.saleNo || '', s.date, s.customerName || '', s.customerPhone || '', s.items?.length || 0, s.netAmount || 0, s.paymentMode || '']);
    downloadCSV(headers, rows, 'sales.csv');
  };
  const handleExcel = () => {
    const headers = ['Sale No', 'Date', 'Customer', 'Phone', 'Items', 'Net Amount', 'Payment Mode'];
    const rows = filteredSales.map(s => [s.saleNo || '', s.date, s.customerName || '', s.customerPhone || '', s.items?.length || 0, s.netAmount || 0, s.paymentMode || '']);
    downloadExcelSingle(headers, rows, 'sales.xlsx', 'Sales');
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalCount = filteredSales.length;
  const totalNet = filteredSales.reduce((s, sale) => s + sale.netAmount, 0);
  const cashTotal = filteredSales.filter(s => s.paymentMode === 'cash').reduce((s, sale) => s + sale.netAmount, 0);
  const creditTotal = filteredSales.filter(s => s.paymentMode === 'credit').reduce((s, sale) => s + sale.netAmount, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <ShoppingCart className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'hi' ? 'बिक्री प्रबंधन' : 'Sale Management'}
          </h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <Tabs defaultValue="new-sale">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="new-sale">
            {language === 'hi' ? 'नई बिक्री' : 'New Sale'}
          </TabsTrigger>
          <TabsTrigger value="sale-list">
            {language === 'hi' ? 'बिक्री सूची' : 'Sale List'}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: New Sale Entry ─────────────────────────────────────── */}
        <TabsContent value="new-sale" className="space-y-4 mt-4">
          {savedSaleNo && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700 font-medium">
                {language === 'hi'
                  ? `बिक्री सफलतापूर्वक सहेजी गई — ${savedSaleNo}`
                  : `Sale saved successfully — ${savedSaleNo}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-green-700"
                onClick={() => setSavedSaleNo(null)}
              >
                ×
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === 'hi' ? 'बिक्री विवरण' : 'Sale Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'तिथि' : 'Date'}</Label>
                <Input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {language === 'hi' ? 'ग्राहक' : 'Customer'}
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={customerId || (customerName === 'Cash' ? '__cash__' : '')}
                  onValueChange={val => {
                    if (val === '__cash__') {
                      setCustomerId('');
                      setCustomerName('Cash');
                      setCustomerPhone('');
                    } else {
                      const cus = customers.find(c => c.id === val);
                      setCustomerId(val);
                      setCustomerName(cus?.name || '');
                      setCustomerPhone(cus?.phone || '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'hi' ? 'ग्राहक चुनें' : 'Select customer'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__cash__">
                      {language === 'hi' ? '💵 नकद ग्राहक' : '💵 Cash Customer'}
                    </SelectItem>
                    {customers.filter(c => c.isActive).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{language === 'hi' ? 'फोन' : 'Phone'}</Label>
                <Input
                  value={customerPhone}
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
                    <TableHead className="w-20">{language === 'hi' ? 'स्टॉक' : 'Stock'}</TableHead>
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
                        {(() => {
                          const si = stockItems.find(s => s.id === item.itemId);
                          const avail = si?.currentStock ?? 0;
                          const insufficient = item.itemId && item.qty > avail;
                          return item.itemId ? (
                            <Badge variant="outline" className={cn('text-xs font-mono', insufficient ? 'border-destructive text-destructive bg-destructive/10' : 'border-success text-success bg-success/10')}>
                              {avail}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const si = stockItems.find(s => s.id === item.itemId);
                          const avail = si?.currentStock ?? 0;
                          const insufficient = item.itemId && item.qty > avail;
                          return (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={e => updateItem(index, { qty: Math.max(0, Number(e.target.value)) })}
                                className={cn('w-20', insufficient && 'border-destructive')}
                              />
                              {insufficient && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                            </div>
                          );
                        })()}
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
                  {language === 'hi' ? 'राशि एवं GST विवरण' : 'Amount & GST'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{language === 'hi' ? 'उपयोग कुल' : 'Subtotal'}</span>
                  <span>{fmt(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>{language === 'hi' ? 'छूट (₹)' : 'Discount (₹)'}</span>
                  <Input type="number" min={0} value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className="w-28 h-7 text-right" />
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>{language === 'hi' ? 'कर योग्य राशि' : 'Taxable Amount'}</span>
                  <span>{fmt(netAmount)}</span>
                </div>
                <div className="border-t pt-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">CGST %</span>
                    <Input type="number" min={0} max={14} step={0.5} value={cgstPct} onChange={e => setCgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right" />
                    <span className="w-24 text-right text-blue-600">{cgstAmount > 0 ? fmt(cgstAmount) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">SGST %</span>
                    <Input type="number" min={0} max={14} step={0.5} value={sgstPct} onChange={e => setSgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right" />
                    <span className="w-24 text-right text-blue-600">{sgstAmount > 0 ? fmt(sgstAmount) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">IGST %</span>
                    <Input type="number" min={0} max={28} step={0.5} value={igstPct} onChange={e => setIgstPct(Math.max(0, Number(e.target.value)))} className="w-20 h-7 text-right" />
                    <span className="w-24 text-right text-blue-600">{igstAmount > 0 ? fmt(igstAmount) : '—'}</span>
                  </div>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground border-t pt-1">
                    <span>{language === 'hi' ? 'कुल GST' : 'Total GST'}</span>
                    <span className="text-blue-600">{fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{language === 'hi' ? 'कुल देय राशि' : 'Grand Total'}</span>
                  <span className="text-green-700">{fmt(grandTotal)}</span>
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
              {language === 'hi' ? 'बिक्री सहेजें' : 'Save Sale'}
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 2: Sale List ──────────────────────────────────────────── */}
        <TabsContent value="sale-list" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'कुल बिक्री' : 'Total Sales'}</p>
                <p className="text-2xl font-bold text-blue-700">{totalCount}</p>
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
                <p className="text-xs text-gray-500">{language === 'hi' ? 'नकद बिक्री' : 'Cash Sales'}</p>
                <p className="text-xl font-bold text-green-700">{fmt(cashTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{language === 'hi' ? 'उधार बिक्री' : 'Credit Sales'}</p>
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
                  <Label>{language === 'hi' ? 'ग्राहक खोजें' : 'Search Customer'}</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      className="pl-8"
                      value={filterCustomer}
                      onChange={e => setFilterCustomer(e.target.value)}
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
                    <TableHead>{language === 'hi' ? 'बिक्री नं.' : 'Sale No.'}</TableHead>
                    <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{language === 'hi' ? 'ग्राहक' : 'Customer'}</TableHead>
                    <TableHead className="text-center">{language === 'hi' ? 'वस्तुएं' : 'Items'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'शुद्ध राशि' : 'Net Amount'}</TableHead>
                    <TableHead>{language === 'hi' ? 'भुगतान' : 'Payment'}</TableHead>
                    <TableHead className="text-right">{language === 'hi' ? 'कार्य' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        {language === 'hi' ? 'कोई डेटा नहीं' : 'No data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(sale => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-sm">{sale.saleNo}</TableCell>
                          <TableCell>{fmtDate(sale.date)}</TableCell>
                          <TableCell>
                            <div>{sale.customerName}</div>
                            {sale.customerPhone && (
                              <div className="text-xs text-gray-400">{sale.customerPhone}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{sale.items.length}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(sale.netAmount)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(paymentModeBadgeClass[sale.paymentMode])}
                            >
                              {paymentModeLabel[sale.paymentMode][language]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewSale(sale)}
                                title={language === 'hi' ? 'देखें' : 'View'}
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(sale.id)}
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

      {/* ── View Sale Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === 'hi' ? 'बिक्री विवरण' : 'Sale Details'} — {viewSale?.saleNo}
            </DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'तिथि' : 'Date'}</p>
                  <p className="font-medium">{fmtDate(viewSale.date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'ग्राहक' : 'Customer'}</p>
                  <p className="font-medium">{viewSale.customerName}</p>
                </div>
                {viewSale.customerPhone && (
                  <div>
                    <p className="text-gray-500">{language === 'hi' ? 'फोन' : 'Phone'}</p>
                    <p className="font-medium">{viewSale.customerPhone}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">{language === 'hi' ? 'भुगतान विधि' : 'Payment'}</p>
                  <Badge variant="outline" className={cn(paymentModeBadgeClass[viewSale.paymentMode])}>
                    {paymentModeLabel[viewSale.paymentMode][language]}
                  </Badge>
                </div>
                {viewSale.narration && (
                  <div className="col-span-2">
                    <p className="text-gray-500">{language === 'hi' ? 'नोट' : 'Narration'}</p>
                    <p className="font-medium">{viewSale.narration}</p>
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
                  {viewSale.items.map((item, i) => (
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

              <div className="space-y-1 text-sm border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">{language === 'hi' ? 'उपयोग कुल' : 'Subtotal'}</span>
                  <span>{fmt(viewSale.totalAmount)}</span>
                </div>
                {viewSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{language === 'hi' ? 'छूट' : 'Discount'}</span>
                    <span className="text-red-600">- {fmt(viewSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>{language === 'hi' ? 'कर योग्य राशि' : 'Taxable Amount'}</span>
                  <span>{fmt(viewSale.netAmount)}</span>
                </div>
                {(viewSale.cgstAmount > 0) && (
                  <div className="flex justify-between text-blue-600">
                    <span>CGST ({viewSale.cgstPct}%)</span>
                    <span>{fmt(viewSale.cgstAmount)}</span>
                  </div>
                )}
                {(viewSale.sgstAmount > 0) && (
                  <div className="flex justify-between text-blue-600">
                    <span>SGST ({viewSale.sgstPct}%)</span>
                    <span>{fmt(viewSale.sgstAmount)}</span>
                  </div>
                )}
                {(viewSale.igstAmount > 0) && (
                  <div className="flex justify-between text-blue-600">
                    <span>IGST ({viewSale.igstPct}%)</span>
                    <span>{fmt(viewSale.igstAmount)}</span>
                  </div>
                )}
                {(viewSale.taxAmount > 0) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{language === 'hi' ? 'कुल GST' : 'Total GST'}</span>
                    <span className="text-blue-600">{fmt(viewSale.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{language === 'hi' ? 'कुल देय राशि' : 'Grand Total'}</span>
                  <span className="text-green-700">{fmt(viewSale.grandTotal ?? viewSale.netAmount)}</span>
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
                ? 'यह बिक्री स्थायी रूप से हटा दी जाएगी।'
                : 'This sale will be permanently deleted.'}
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
                <Label>{language === 'hi' ? 'बिक्री दर (₹)' : 'Sale Rate (₹)'}</Label>
                <Input type="number" min={0} value={qaSaleRate} onChange={e => setQaSaleRate(Number(e.target.value))} />
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

export default SaleManagement;
