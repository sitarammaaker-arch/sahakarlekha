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
import type { SalesReturnRefund } from '@/types';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const SalesReturn: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { sales, society } = useData();
  const { salesReturns, addSalesReturn, deleteSalesReturn } = useConsumerData();
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [refundMode, setRefundMode] = useState<SalesReturnRefund>('cash');
  const [date, setDate] = useState(TODAY());

  const matches = useMemo(() => {
    const raw = q.trim().toLowerCase();
    if (!raw) return sales.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
    return sales.filter(s => (s.saleNo || '').toLowerCase().includes(raw) || (s.customerName || '').toLowerCase().includes(raw)).slice(0, 12);
  }, [sales, q]);

  const sale = selectedSaleId ? sales.find(s => s.id === selectedSaleId) : undefined;

  // Already-returned qty per item on the selected sale (to cap).
  const priorByItem = useMemo(() => {
    const m = new Map<string, number>();
    if (sale) salesReturns.filter(r => !r.isDeleted && r.originalSaleId === sale.id).forEach(r => r.items.forEach(it => m.set(it.itemId, (m.get(it.itemId) || 0) + it.qty)));
    return m;
  }, [salesReturns, sale]);

  const selectSale = (id: string) => {
    setSelectedSaleId(id);
    const s = sales.find(x => x.id === id);
    setRetQty({});
    setRefundMode(s && (s.paymentMode === 'credit' || s.memberId) ? 'credit-adjust' : 'cash');
  };

  const returnNet = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum, it) => sum + (retQty[it.itemId] || 0) * it.rate, 0);
  }, [sale, retQty]);

  const handleReturn = () => {
    if (!sale) { toast({ title: hi ? 'बिक्री चुनें' : 'Select a sale', variant: 'destructive' }); return; }
    const items = sale.items
      .filter(it => (retQty[it.itemId] || 0) > 0)
      .map(it => ({ itemId: it.itemId, itemName: it.itemName, unit: it.unit, qty: retQty[it.itemId], rate: it.rate, amount: retQty[it.itemId] * it.rate }));
    if (items.length === 0) { toast({ title: hi ? 'कोई वापसी मात्रा नहीं' : 'No return quantity', variant: 'destructive' }); return; }
    const r = addSalesReturn({ originalSaleId: sale.id, items, refundMode, date });
    if (r) { setSelectedSaleId(''); setRetQty({}); setQ(''); }
  };

  const register = useMemo(() => salesReturns.filter(r => !r.isDeleted).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [salesReturns]);
  const exportRegister = () => {
    downloadCSV(['Return No', 'Date', 'Sale No', 'Customer', 'Net', 'GST', 'Total', 'Refund'],
      register.map(r => [r.returnNo, r.date, r.saleNo, r.customerName, r.netAmount, r.taxAmount, r.grandTotal, r.refundMode]),
      `sales-returns-${TODAY()}.csv`);
  };

  const REFUND_LABEL: Record<SalesReturnRefund, string> = {
    cash: hi ? 'नकद वापसी' : 'Cash refund', bank: hi ? 'बैंक वापसी' : 'Bank refund', 'credit-adjust': hi ? 'उधार में समायोजन' : 'Adjust against credit',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-100 rounded-lg"><Undo2 className="h-6 w-6 text-rose-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'बिक्री वापसी' : 'Sales Return'}</h1>
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
              <Label className="text-xs text-muted-foreground">{hi ? 'मूल बिक्री खोजें (बिक्री नं. / ग्राहक)' : 'Find original sale (sale no. / customer)'}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder={hi ? 'बिक्री नं. / ग्राहक…' : 'Sale no. / customer…'} />
              </div>
              {!sale && (
                <div className="border rounded-lg divide-y max-h-64 overflow-auto">
                  {matches.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">{hi ? 'कोई बिक्री नहीं' : 'No sales'}</div>
                  ) : matches.map(s => (
                    <button key={s.id} type="button" onClick={() => selectSale(s.id)} className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50">
                      <span><span className="font-mono text-xs">{s.saleNo}</span> · {s.customerName} <span className="text-xs text-muted-foreground">{fmtDate(s.date)}</span></span>
                      <span className="font-semibold text-sm">{fmt(s.grandTotal || s.netAmount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {sale && (
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{sale.saleNo} — {sale.customerName}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedSaleId(''); setRetQty({}); }}>{hi ? 'बदलें' : 'Change'}</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बेची' : 'Sold'}</TableHead>
                        <TableHead className="text-right">{hi ? 'पहले वापस' : 'Returned'}</TableHead>
                        <TableHead className="w-32">{hi ? 'वापसी मात्रा' : 'Return qty'}</TableHead>
                        <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                        <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.items.map(it => {
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
                    <Select value={refundMode} onValueChange={v => setRefundMode(v as SalesReturnRefund)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">{REFUND_LABEL.cash}</SelectItem>
                        <SelectItem value="bank">{REFUND_LABEL.bank}</SelectItem>
                        {(sale.paymentMode === 'credit' || sale.memberId) && <SelectItem value="credit-adjust">{REFUND_LABEL['credit-adjust']}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{hi ? 'वापसी राशि' : 'Return value'}</p>
                    <p className="text-xl font-bold text-rose-700">{fmt(returnNet)}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleReturn} disabled={returnNet <= 0} className="gap-1 bg-rose-600 hover:bg-rose-700"><Undo2 className="h-4 w-4" />{hi ? 'वापसी दर्ज करें' : 'Post Return'}</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {hi ? 'माल स्टॉक में वापस जाएगा, बिक्री घटेगी, GST उलटेगा, और उधार/नकद समायोजित होगा।' : 'Goods go back to stock, sales reduce, GST reverses, and cash/credit is adjusted.'}
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
                    <TableHead>{hi ? 'बिक्री नं.' : 'Sale No.'}</TableHead>
                    <TableHead>{hi ? 'ग्राहक' : 'Customer'}</TableHead>
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
                      <TableCell className="font-mono text-xs">{r.saleNo}</TableCell>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.grandTotal)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{REFUND_LABEL[r.refundMode]}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => { deleteSalesReturn(r.id); toast({ title: hi ? 'वापसी रद्द' : 'Return reversed' }); }}>
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

export default SalesReturn;
