import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Undo2, Search, Trash2, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseReturnRefund } from '@/types';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const PurchaseReturn: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { purchases, society } = useData();
  const { purchaseReturns, addPurchaseReturn, deletePurchaseReturn } = useConsumerData();
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [refundMode, setRefundMode] = useState<PurchaseReturnRefund>('credit-adjust');
  const [date, setDate] = useState(TODAY());

  const activePurchases = useMemo(() => purchases.filter(p => !(p as { isDeleted?: boolean }).isDeleted), [purchases]);

  const matches = useMemo(() => {
    const raw = q.trim().toLowerCase();
    if (!raw) return activePurchases.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
    return activePurchases.filter(p => (p.purchaseNo || '').toLowerCase().includes(raw) || (p.supplierName || '').toLowerCase().includes(raw)).slice(0, 12);
  }, [activePurchases, q]);

  const purchase = selectedPurchaseId ? activePurchases.find(p => p.id === selectedPurchaseId) : undefined;

  // Already-returned qty per item on the selected purchase (to cap).
  const priorByItem = useMemo(() => {
    const m = new Map<string, number>();
    if (purchase) purchaseReturns.filter(r => !r.isDeleted && r.originalPurchaseId === purchase.id).forEach(r => r.items.forEach(it => m.set(it.itemId, (m.get(it.itemId) || 0) + it.qty)));
    return m;
  }, [purchaseReturns, purchase]);

  const selectPurchase = (id: string) => {
    setSelectedPurchaseId(id);
    const p = activePurchases.find(x => x.id === id);
    setRetQty({});
    setRefundMode(p && p.paymentMode === 'credit' ? 'credit-adjust' : 'cash');
  };

  const returnNet = useMemo(() => {
    if (!purchase) return 0;
    return purchase.items.reduce((sum, it) => sum + (retQty[it.itemId] || 0) * it.rate, 0);
  }, [purchase, retQty]);

  const handleReturn = () => {
    if (!purchase) { toast({ title: hi ? 'खरीद चुनें' : 'Select a purchase', variant: 'destructive' }); return; }
    const items = purchase.items
      .filter(it => (retQty[it.itemId] || 0) > 0)
      .map(it => ({ itemId: it.itemId, itemName: it.itemName, unit: it.unit, qty: retQty[it.itemId], rate: it.rate, amount: retQty[it.itemId] * it.rate }));
    if (items.length === 0) { toast({ title: hi ? 'कोई वापसी मात्रा नहीं' : 'No return quantity', variant: 'destructive' }); return; }
    const r = addPurchaseReturn({ originalPurchaseId: purchase.id, items, refundMode, date });
    if (r) { setSelectedPurchaseId(''); setRetQty({}); setQ(''); }
  };

  const register = useMemo(() => purchaseReturns.filter(r => !r.isDeleted).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [purchaseReturns]);
  const exportRegister = () => {
    downloadCSV(['Return No', 'Date', 'Purchase No', 'Supplier', 'Net', 'GST', 'Total', 'Refund'],
      register.map(r => [r.returnNo, r.date, r.purchaseNo, r.supplierName, r.netAmount, r.taxAmount, r.grandTotal, r.refundMode]),
      `purchase-returns-${TODAY()}.csv`);
  };

  const REFUND_LABEL: Record<PurchaseReturnRefund, string> = {
    cash: hi ? 'नकद वापसी' : 'Cash refund', bank: hi ? 'बैंक वापसी' : 'Bank refund', 'credit-adjust': hi ? 'देय में समायोजन' : 'Adjust against payable',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-lg"><Undo2 className="h-6 w-6 text-amber-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'खरीद वापसी' : 'Purchase Return'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">{hi ? 'नई वापसी' : 'New Return'}</TabsTrigger>
          <TabsTrigger value="register">{hi ? 'वापसी रजिस्टर' : 'Returns Register'}</TabsTrigger>
        </TabsList>

        {/* New Return */}
        <TabsContent value="new" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">{hi ? 'मूल खरीद खोजें (खरीद नं. / आपूर्तिकर्ता)' : 'Find original purchase (purchase no. / supplier)'}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder={hi ? 'खरीद नं. / आपूर्तिकर्ता…' : 'Purchase no. / supplier…'} />
              </div>
              {!purchase && (
                <div className="border rounded-lg divide-y max-h-64 overflow-auto">
                  {matches.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">{hi ? 'कोई खरीद नहीं' : 'No purchases'}</div>
                  ) : matches.map(p => (
                    <button key={p.id} type="button" onClick={() => selectPurchase(p.id)} className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50">
                      <span><span className="font-mono text-xs">{p.purchaseNo}</span> · {p.supplierName} <span className="text-xs text-muted-foreground">{fmtDate(p.date)}</span></span>
                      <span className="font-semibold text-sm">{fmt(p.grandTotal || p.netAmount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {purchase && (
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{purchase.purchaseNo} — {purchase.supplierName}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedPurchaseId(''); setRetQty({}); }}>{hi ? 'बदलें' : 'Change'}</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                        <TableHead className="text-right">{hi ? 'खरीदी' : 'Bought'}</TableHead>
                        <TableHead className="text-right">{hi ? 'पहले वापस' : 'Returned'}</TableHead>
                        <TableHead className="w-32">{hi ? 'वापसी मात्रा' : 'Return qty'}</TableHead>
                        <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                        <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.items.map(it => {
                        const already = priorByItem.get(it.itemId) || 0;
                        const maxRet = it.qty - already;
                        const val = retQty[it.itemId] || 0;
                        return (
                          <TableRow key={it.itemId}>
                            <TableCell className="font-medium">{it.itemName}<span className="text-xs text-muted-foreground ml-1">/ {it.unit}</span></TableCell>
                            <TableCell className="text-right">{it.qty}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{already || '—'}</TableCell>
                            <TableCell>
                              <Input type="number" min={0} max={maxRet} value={val}
                                onChange={e => setRetQty(p => ({ ...p, [it.itemId]: Math.max(0, Math.min(maxRet, Number(e.target.value))) }))}
                                disabled={maxRet <= 0} className={cn('w-24 h-8', val > maxRet && 'border-destructive')} />
                            </TableCell>
                            <TableCell className="text-right">{fmt(it.rate)}</TableCell>
                            <TableCell className="text-right">{fmt(val * it.rate)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <Label>{hi ? 'वापसी विधि' : 'Refund'}</Label>
                    <Select value={refundMode} onValueChange={v => setRefundMode(v as PurchaseReturnRefund)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {purchase.paymentMode === 'credit' && <SelectItem value="credit-adjust">{REFUND_LABEL['credit-adjust']}</SelectItem>}
                        <SelectItem value="cash">{REFUND_LABEL.cash}</SelectItem>
                        <SelectItem value="bank">{REFUND_LABEL.bank}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{hi ? 'वापसी राशि' : 'Return value'}</p>
                    <p className="text-xl font-bold text-amber-700">{fmt(returnNet)}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleReturn} disabled={returnNet <= 0} className="gap-1 bg-amber-600 hover:bg-amber-700"><Undo2 className="h-4 w-4" />{hi ? 'वापसी दर्ज करें' : 'Post Return'}</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {hi ? 'माल आपूर्तिकर्ता को वापस, खरीद घटेगी, GST ITC उलटेगा, और देय/नकद समायोजित होगा।' : 'Goods go back to supplier, purchases reduce, GST ITC reverses, and payable/cash is adjusted.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Register */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1" onClick={exportRegister}><Download className="h-4 w-4" />CSV</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'वापसी नं.' : 'Return No.'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'खरीद नं.' : 'Purchase No.'}</TableHead>
                    <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                    <TableHead className="text-right">{hi ? 'राशि' : 'Total'}</TableHead>
                    <TableHead>{hi ? 'विधि' : 'Refund'}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {register.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">{hi ? 'कोई वापसी नहीं' : 'No returns'}</TableCell></TableRow>
                  ) : register.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.returnNo}</TableCell>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.purchaseNo}</TableCell>
                      <TableCell>{r.supplierName}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.grandTotal)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{REFUND_LABEL[r.refundMode]}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => { deletePurchaseReturn(r.id); toast({ title: hi ? 'वापसी रद्द' : 'Return reversed' }); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PurchaseReturn;
