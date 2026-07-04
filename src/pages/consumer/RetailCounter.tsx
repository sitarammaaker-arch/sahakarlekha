import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { computeStockMap } from '@/lib/stockUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScanBarcode, Trash2, Plus, Minus, AlertTriangle, Printer, X, CheckCircle2 } from 'lucide-react';
import { generateSaleInvoicePDF } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { SaleItem, PaymentMode } from '@/types';

const TODAY = () => new Date().toISOString().split('T')[0];

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

// POS tender is cash or bank only. Member credit (paymentMode 'credit') is a
// separate future slice (needs member receivable sub-ledger + credit limits).
type CounterTender = Extract<PaymentMode, 'cash' | 'bank'>;

const RetailCounter: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { sales, stockItems, stockMovements, customers, members, addSale, society } = useData();
  const { resolvePrice } = useConsumerData();

  const { toast } = useToast();

  // Available qty is ALWAYS movement-based (RULE 2) — never stockItem.currentStock.
  const stockMap = useMemo(() => computeStockMap(stockItems, stockMovements), [stockItems, stockMovements]);

  // ── Cart + tender state ────────────────────────────────────────────────────
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [tender, setTender] = useState<CounterTender>('cash');
  const [customerId, setCustomerId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [query, setQuery] = useState('');
  const [lastSaleNo, setLastSaleNo] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => setTimeout(() => searchRef.current?.focus(), 0), []);
  useEffect(() => { focusSearch(); }, [focusSearch]);

  // Member selected → member tier price; else base retail (saleRate).
  const priceFor = useCallback(
    (si: { id: string; saleRate: number }) => memberId ? resolvePrice(si, 'member') : (si.saleRate || 0),
    [memberId, resolvePrice],
  );

  // Re-price the whole cart when the member is changed (member on → member rates, off → retail).
  useEffect(() => {
    setCart(prev => prev.map(i => {
      const si = stockItems.find(s => s.id === i.itemId);
      if (!si) return i;
      const r = memberId ? resolvePrice(si, 'member') : (si.saleRate || 0);
      return { ...i, rate: r, amount: +(i.qty * r).toFixed(2) };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  // ── Derived total (v1 = final-price billing: no separate GST/discount line;
  //    full GST tax-invoices are done on the Sale Management screen) ───────────
  const total = useMemo(() => cart.reduce((s, i) => s + i.amount, 0), [cart]);

  const hi = language === 'hi';

  // ── Add item by barcode / code / name ──────────────────────────────────────
  const addByQuery = useCallback(() => {
    const raw = query.trim();
    if (!raw) return;
    const q = raw.toLowerCase();
    const active = stockItems.filter(s => s.isActive);
    // Exact barcode / item-code first (a real scan), then name contains.
    const match =
      active.find(s => s.barcodeValue && s.barcodeValue.toLowerCase() === q) ||
      active.find(s => s.itemCode && s.itemCode.toLowerCase() === q) ||
      active.find(s => s.name.toLowerCase().includes(q) || (s.nameHi ?? '').includes(raw));
    if (!match) {
      toast({ title: hi ? 'वस्तु नहीं मिली' : 'Item not found', description: raw, variant: 'destructive' });
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.itemId === match.id);
      if (idx >= 0) {
        return prev.map((i, k) => k === idx
          ? { ...i, qty: i.qty + 1, amount: +((i.qty + 1) * i.rate).toFixed(2) }
          : i);
      }
      const rate = priceFor(match);
      return [...prev, {
        itemId: match.id,
        itemName: hi ? (match.nameHi || match.name) : match.name,
        unit: match.unit,
        qty: 1,
        rate,
        amount: +rate.toFixed(2),
      }];
    });
    setQuery('');
    focusSearch();
  }, [query, stockItems, hi, toast, focusSearch, priceFor]);

  const setQty = (itemId: string, qty: number) =>
    setCart(prev => prev.map(i => i.itemId === itemId
      ? { ...i, qty: Math.max(0, qty), amount: +(Math.max(0, qty) * i.rate).toFixed(2) }
      : i));

  const setRate = (itemId: string, rate: number) =>
    setCart(prev => prev.map(i => i.itemId === itemId
      ? { ...i, rate: Math.max(0, rate), amount: +(i.qty * Math.max(0, rate)).toFixed(2) }
      : i));

  const removeLine = (itemId: string) => setCart(prev => prev.filter(i => i.itemId !== itemId));
  const clearCart = () => { setCart([]); focusSearch(); };

  // ── Complete sale — reuses addSale (posting, stock reduction, two-step persist,
  //    FY-lock guard all handled by the shared engine) ─────────────────────────
  const completeSale = useCallback(() => {
    const valid = cart.filter(i => i.itemId && i.qty > 0 && i.rate >= 0);
    if (valid.length === 0) {
      toast({ title: hi ? 'कार्ट खाली है' : 'Cart is empty', variant: 'destructive' });
      return;
    }

    // Block oversell (same guard as Sale Management — a 0-stock item can't be sold).
    const oversold = valid.filter(i => i.qty > (stockMap[i.itemId] ?? 0));
    if (oversold.length > 0) {
      const names = oversold.map(i => `${i.itemName} (${hi ? 'उपलब्ध' : 'avail'}: ${stockMap[i.itemId] ?? 0})`).join(', ');
      toast({
        title: hi ? 'स्टॉक से अधिक बिक्री नहीं हो सकती' : 'Cannot sell more than available stock',
        description: (hi ? 'पहले खरीद/स्टॉक जोड़ें: ' : 'Add purchase/stock first: ') + names,
        variant: 'destructive',
      });
      return;
    }

    // Sales A/c mapping guard (addSale throws otherwise) — surface it early & clearly
    // so the operator fixes it in Inventory instead of hitting a raw error at tender.
    const unmapped = valid
      .map(i => stockItems.find(s => s.id === i.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.salesAccountId)
      .map(s => hi ? (s.nameHi || s.name) : s.name);
    if (unmapped.length > 0) {
      toast({
        title: hi ? 'बिक्री खाता असाइन करें' : 'Assign a Sales A/c first',
        description: (hi
          ? 'इन वस्तुओं को Inventory में बिक्री खाता (group) दें: '
          : 'Set a Sales A/c (group) on these items in Inventory: ') + unmapped.join(', '),
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }

    const cus = customerId ? customers.find(c => c.id === customerId) : undefined;
    const mem = memberId ? members.find(m => m.id === memberId) : undefined;
    const buyerName = mem?.name || cus?.name || (hi ? 'नकद ग्राहक' : 'Cash Customer');
    try {
      const newSale = addSale({
        date: TODAY(),
        customerName: buyerName,
        customerPhone: mem?.phone || cus?.phone || undefined,
        customerId: customerId || undefined,
        memberId: memberId || undefined,
        items: valid,
        totalAmount: total,
        discount: 0,
        netAmount: total,
        cgstPct: 0, sgstPct: 0, igstPct: 0,
        cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
        taxAmount: 0, grandTotal: total,
        paymentMode: tender,
        narration: mem ? (hi ? `रिटेल काउंटर बिक्री — सदस्य ${mem.memberId}` : `Retail counter sale — member ${mem.memberId}`) : (hi ? 'रिटेल काउंटर बिक्री' : 'Retail counter sale'),
        createdBy: user?.name ?? 'Counter',
      });
      setLastSaleNo(newSale.saleNo);
      setCart([]);
      setCustomerId('');
      setMemberId('');
      toast({ title: hi ? `बिक्री दर्ज: ${newSale.saleNo}` : `Sale posted: ${newSale.saleNo}` });
      focusSearch();
    } catch (err) {
      toast({
        title: hi ? 'बिक्री पोस्ट नहीं हुई' : 'Sale not posted',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
        duration: 10000,
      });
    }
  }, [cart, stockMap, stockItems, customerId, customers, memberId, members, addSale, total, tender, user, hi, toast, focusSearch]);

  // F2 = complete sale (keyboard-first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); completeSale(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completeSale]);

  // ── Print last receipt (reuses the shared invoice PDF) ─────────────────────
  const printReceipt = (saleNo: string) => {
    const sale = sales.find(s => s.saleNo === saleNo);
    if (!sale) return;
    const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : undefined;
    try {
      generateSaleInvoicePDF({
        saleNo: sale.saleNo,
        date: sale.date,
        customer: customer
          ? { name: customer.name, legalName: customer.legalName || customer.name, phone: customer.phone, mobile: customer.mobile || customer.phone }
          : { name: sale.customerName, legalName: sale.customerName, phone: sale.customerPhone, mobile: sale.customerPhone },
        items: sale.items.map(it => ({
          itemName: it.itemName, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount,
          hsn: stockItems.find(s => s.id === it.itemId)?.hsnCode,
        })),
        totalAmount: sale.totalAmount,
        discount: sale.discount || 0,
        netAmount: sale.netAmount,
        cgstPct: 0, sgstPct: 0, igstPct: 0,
        cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
        taxAmount: 0,
        grandTotal: sale.grandTotal || sale.netAmount,
        paymentMode: sale.paymentMode,
        narration: sale.narration,
      }, society);
    } catch (err) {
      toast({ title: hi ? 'रसीद नहीं बनी' : 'Could not print receipt', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  // ── Today's counter summary ────────────────────────────────────────────────
  const today = TODAY();
  const todaySales = sales.filter(s => s.date === today);
  const todayCount = todaySales.length;
  const todayTotal = todaySales.reduce((s, x) => s + (x.netAmount || 0), 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <ScanBarcode className="h-6 w-6 text-emerald-700" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'रिटेल काउंटर' : 'Retail Counter'}
          </h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{hi ? 'आज की बिक्री' : "Today's Sales"}</p>
          <p className="text-lg font-bold text-emerald-700">{todayCount} · {fmt(todayTotal)}</p>
        </div>
      </div>

      {lastSaleNo && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span className="text-green-700 font-medium">
            {hi ? `बिक्री दर्ज हुई — ${lastSaleNo}` : `Sale posted — ${lastSaleNo}`}
          </span>
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => printReceipt(lastSaleNo)}>
            <Printer className="h-4 w-4" />
            {hi ? 'रसीद' : 'Receipt'}
          </Button>
          <Button variant="ghost" size="icon" className="text-green-700" onClick={() => setLastSaleNo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Cart (main) ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Label className="text-xs text-muted-foreground">
                {hi ? 'बारकोड स्कैन करें या नाम/कोड लिखकर Enter दबाएँ' : 'Scan barcode, or type name/code and press Enter'}
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addByQuery(); } }}
                  placeholder={hi ? 'बारकोड / वस्तु का नाम…' : 'Barcode / item name…'}
                  className="text-base"
                />
                <Button onClick={addByQuery} className="gap-1 shrink-0">
                  <Plus className="h-4 w-4" />
                  {hi ? 'जोड़ें' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                    <TableHead className="w-20">{hi ? 'स्टॉक' : 'Stock'}</TableHead>
                    <TableHead className="w-32">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                    <TableHead className="w-28">{hi ? 'दर (₹)' : 'Rate (₹)'}</TableHead>
                    <TableHead className="w-28 text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                        {hi ? 'कार्ट खाली है — वस्तु स्कैन करें' : 'Cart is empty — scan an item'}
                      </TableCell>
                    </TableRow>
                  ) : cart.map(item => {
                    const avail = stockMap[item.itemId] ?? 0;
                    const insufficient = item.qty > avail;
                    return (
                      <TableRow key={item.itemId}>
                        <TableCell className="font-medium">{item.itemName}<span className="text-xs text-muted-foreground ml-1">/ {item.unit}</span></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('font-mono text-xs', insufficient ? 'border-destructive text-destructive bg-destructive/10' : 'border-emerald-500 text-emerald-700 bg-emerald-50')}>
                            {avail}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => setQty(item.itemId, item.qty - 1)}><Minus className="h-3 w-3" /></Button>
                            <Input
                              type="number" min={0} value={item.qty}
                              onChange={e => setQty(item.itemId, Number(e.target.value))}
                              className={cn('w-14 h-7 text-center', insufficient && 'border-destructive')}
                            />
                            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => setQty(item.itemId, item.qty + 1)}><Plus className="h-3 w-3" /></Button>
                            {insufficient && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} step={0.01} value={item.rate} onChange={e => setRate(item.itemId, Number(e.target.value))} className="w-24 h-7 text-right" />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(item.amount)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => removeLine(item.itemId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ── Tender panel ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{hi ? 'भुगतान' : 'Payment'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-baseline border-b pb-3">
                <span className="text-sm text-gray-500">{hi ? 'कुल देय' : 'Amount Due'}</span>
                <span className="text-3xl font-bold text-emerald-700">{fmt(total)}</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  {hi ? 'सदस्य (वैकल्पिक)' : 'Member (optional)'}
                  {memberId && <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px]">{hi ? 'सदस्य दर लागू' : 'member price'}</Badge>}
                </Label>
                <Select value={memberId || '__none__'} onValueChange={v => setMemberId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{hi ? '— सदस्य नहीं —' : '— No member —'}</SelectItem>
                    {members.filter(m => m.status === 'active').map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.memberId} · {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{hi ? 'ग्राहक (वैकल्पिक)' : 'Customer (optional)'}</Label>
                <Select value={customerId || '__cash__'} onValueChange={v => setCustomerId(v === '__cash__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__cash__">{hi ? '💵 नकद ग्राहक' : '💵 Cash Customer'}</SelectItem>
                    {customers.filter(c => c.isActive).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{hi ? 'भुगतान विधि' : 'Tender'}</Label>
                <div className="flex gap-2">
                  {(['cash', 'bank'] as CounterTender[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTender(mode)}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                        tender === mode
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {mode === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक / UPI' : 'Bank / UPI')}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={completeSale} disabled={cart.length === 0} className="w-full h-12 text-base gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {hi ? 'बिक्री पूरी करें' : 'Complete Sale'}
                <kbd className="ml-1 text-xs opacity-70">F2</kbd>
              </Button>
              {cart.length > 0 && (
                <Button variant="outline" onClick={clearCart} className="w-full gap-1 text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                  {hi ? 'कार्ट खाली करें' : 'Clear Cart'}
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                {hi
                  ? 'GST टैक्स-इनवॉइस के लिए बिक्री प्रबंधन स्क्रीन का उपयोग करें।'
                  : 'For GST tax-invoices use the Sale Management screen.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RetailCounter;
