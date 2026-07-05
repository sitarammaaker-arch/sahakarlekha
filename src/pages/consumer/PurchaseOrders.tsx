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
import { ClipboardList, Plus, Trash2, CheckCircle2, PackageCheck } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrderItem, PurchaseOrderStatus } from '@/types';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const emptyRow = (): PurchaseOrderItem => ({ itemId: '', itemName: '', unit: '', qty: 1, rate: 0, amount: 0 });

const STATUS: Record<PurchaseOrderStatus, { hi: string; en: string; cls: string }> = {
  draft: { hi: 'ड्राफ्ट', en: 'Draft', cls: 'border-amber-400 text-amber-700 bg-amber-50' },
  approved: { hi: 'स्वीकृत', en: 'Approved', cls: 'border-blue-500 text-blue-700 bg-blue-50' },
  received: { hi: 'माल प्राप्त', en: 'Received', cls: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
  cancelled: { hi: 'रद्द', en: 'Cancelled', cls: 'border-gray-300 text-gray-500 bg-gray-50' },
};

const PurchaseOrders: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { suppliers, stockItems, society } = useData();
  const { purchaseOrders, createPurchaseOrder, approvePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } = useConsumerData();
  const { toast } = useToast();

  // Create form
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(TODAY());
  const [expectedDate, setExpectedDate] = useState('');
  const [rows, setRows] = useState<PurchaseOrderItem[]>([emptyRow()]);
  const [notes, setNotes] = useState('');

  // Selected PO (approve / GRN)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionNo, setResolutionNo] = useState('');
  const [recvQty, setRecvQty] = useState<Record<string, number>>({});
  const [recvMode, setRecvMode] = useState<'cash' | 'bank' | 'credit'>('credit');
  const [recvDate, setRecvDate] = useState(TODAY());

  const list = useMemo(() => purchaseOrders.filter(p => !p.isDeleted).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [purchaseOrders]);
  const selected = selectedId ? list.find(p => p.id === selectedId) : undefined;

  const itemName = (s: { name: string; nameHi?: string }) => hi ? (s.nameHi || s.name) : s.name;

  const updateRow = (idx: number, patch: Partial<PurchaseOrderItem>) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const merged = { ...r, ...patch };
      merged.amount = +(merged.qty * merged.rate).toFixed(2);
      return merged;
    }));
  };
  const pickItem = (idx: number, id: string) => {
    const s = stockItems.find(x => x.id === id);
    if (!s) return;
    updateRow(idx, { itemId: s.id, itemName: itemName(s), unit: s.unit, rate: s.purchaseRate || 0 });
  };
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  const handleCreate = () => {
    const sup = suppliers.find(s => s.id === supplierId);
    if (!sup) { toast({ title: hi ? 'आपूर्तिकर्ता चुनें' : 'Select a supplier', variant: 'destructive' }); return; }
    const po = createPurchaseOrder({
      supplierId: sup.id, supplierName: sup.name, supplierPhone: sup.phone,
      date, expectedDate: expectedDate || undefined,
      items: rows.filter(r => r.itemId && r.qty > 0), notes: notes.trim() || undefined,
    });
    if (po) { setRows([emptyRow()]); setNotes(''); setExpectedDate(''); setSelectedId(po.id); }
  };

  const openReceive = (id: string) => {
    setSelectedId(id);
    const po = list.find(p => p.id === id);
    if (po) setRecvQty(Object.fromEntries(po.items.map(i => [i.itemId, i.qty])));
    setRecvDate(TODAY());
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg"><ClipboardList className="h-6 w-6 text-violet-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'खरीद ऑर्डर (PO / GRN)' : 'Purchase Orders (PO / GRN)'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {hi
          ? 'ऑर्डर बनाएँ → अनुमोदन → माल प्राप्ति (GRN)। GRN पर असली खरीद (invoice) बनती है — स्टॉक बढ़ता है व लेखांकन होता है। PO/GRN खुद non-financial रिकॉर्ड हैं।'
          : 'Create PO → approve → goods receipt (GRN). GRN creates the real Purchase (invoice) — stock increases and it posts to accounting. PO/GRN themselves are non-financial records.'}
      </div>

      {/* Create PO */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'नया खरीद ऑर्डर' : 'New Purchase Order'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'आपूर्तिकर्ता चुनें' : 'Select supplier'} /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.isActive).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'अपेक्षित प्राप्ति तिथि' : 'Expected date'}</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">{hi ? 'वस्तु' : 'Item'}</TableHead>
                  <TableHead className="w-24">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                  <TableHead className="w-28">{hi ? 'दर (₹)' : 'Rate (₹)'}</TableHead>
                  <TableHead className="w-28 text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={r.itemId} onValueChange={v => pickItem(i, v)}>
                        <SelectTrigger><SelectValue placeholder={hi ? 'वस्तु चुनें' : 'Select item'} /></SelectTrigger>
                        <SelectContent>
                          {stockItems.filter(s => s.isActive).map(s => <SelectItem key={s.id} value={s.id}>{itemName(s)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={0} value={r.qty} onChange={e => updateRow(i, { qty: Math.max(0, Number(e.target.value)) })} className="w-20" /></TableCell>
                    <TableCell><Input type="number" min={0} step={0.01} value={r.rate} onChange={e => updateRow(i, { rate: Math.max(0, Number(e.target.value)) })} className="w-24" /></TableCell>
                    <TableCell className="text-right">{fmt(r.amount)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="text-red-500" disabled={rows.length === 1} onClick={() => setRows(prev => prev.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setRows(prev => [...prev, emptyRow()])}><Plus className="h-4 w-4" />{hi ? 'पंक्ति जोड़ें' : 'Add row'}</Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{hi ? 'कुल' : 'Total'}: <b className="text-gray-900">{fmt(total)}</b></span>
              <Button onClick={handleCreate} className="gap-1"><ClipboardList className="h-4 w-4" />{hi ? 'ऑर्डर बनाएँ' : 'Create PO'}</Button>
            </div>
          </div>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={hi ? 'नोट (वैकल्पिक)' : 'Notes (optional)'} />
        </CardContent>
      </Card>

      {/* PO list */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'PO नं.' : 'PO No.'}</TableHead>
                <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                <TableHead className="text-center">{hi ? 'वस्तुएं' : 'Items'}</TableHead>
                <TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead className="text-right">{hi ? 'कार्य' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">{hi ? 'कोई खरीद ऑर्डर नहीं' : 'No purchase orders'}</TableCell></TableRow>
              ) : list.map(po => (
                <TableRow key={po.id} className={cn('cursor-pointer', selectedId === po.id && 'bg-violet-50')} onClick={() => setSelectedId(po.id)}>
                  <TableCell className="font-mono text-sm">{po.poNo}</TableCell>
                  <TableCell>{fmtDate(po.date)}</TableCell>
                  <TableCell>{po.supplierName}</TableCell>
                  <TableCell className="text-center">{po.items.length}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(po.total)}</TableCell>
                  <TableCell><Badge variant="outline" className={cn('text-[10px]', STATUS[po.status].cls)}>{hi ? STATUS[po.status].hi : STATUS[po.status].en}{po.purchaseNo ? ` · ${po.purchaseNo}` : ''}</Badge></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      {po.status === 'draft' && <Button size="sm" variant="outline" onClick={() => { setSelectedId(po.id); setResolutionNo(''); }}>{hi ? 'अनुमोदन' : 'Approve'}</Button>}
                      {po.status === 'approved' && <Button size="sm" onClick={() => openReceive(po.id)} className="gap-1"><PackageCheck className="h-4 w-4" />{hi ? 'माल प्राप्ति' : 'Receive'}</Button>}
                      {po.status !== 'received' && <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => { deletePurchaseOrder(po.id); if (selectedId === po.id) setSelectedId(null); }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected PO — approve or GRN */}
      {selected && selected.status !== 'received' && selected.status !== 'cancelled' && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">{selected.poNo} — {selected.supplierName}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selected.status === 'draft' ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end p-3 bg-gray-50 rounded-lg">
                <div className="space-y-1 flex-1"><Label>{hi ? 'प्रस्ताव संख्या (वैकल्पिक)' : 'Resolution No. (optional)'}</Label><Input value={resolutionNo} onChange={e => setResolutionNo(e.target.value)} placeholder={hi ? 'समिति/बोर्ड प्रस्ताव' : 'Committee/board ref'} /></div>
                <Button className="gap-1" onClick={() => { const r = approvePurchaseOrder(selected.id, { resolutionNo }); if (r) setResolutionNo(''); }}><CheckCircle2 className="h-4 w-4" />{hi ? 'अनुमोदित करें' : 'Approve'}</Button>
                <Button variant="outline" onClick={() => cancelPurchaseOrder(selected.id)}>{hi ? 'रद्द' : 'Cancel PO'}</Button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg space-y-3">
                <p className="text-sm text-emerald-800 font-medium">{hi ? 'माल प्राप्ति (GRN) — प्राप्त मात्रा दर्ज करें' : 'Goods receipt (GRN) — enter received quantity'}</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead><TableHead className="w-28">{hi ? 'ऑर्डर' : 'Ordered'}</TableHead><TableHead className="w-32">{hi ? 'प्राप्त' : 'Received'}</TableHead><TableHead className="w-28 text-right">{hi ? 'दर' : 'Rate'}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {selected.items.map(it => (
                        <TableRow key={it.itemId}>
                          <TableCell className="font-medium">{it.itemName}<span className="text-xs text-muted-foreground ml-1">/ {it.unit}</span></TableCell>
                          <TableCell>{it.qty}</TableCell>
                          <TableCell><Input type="number" min={0} value={recvQty[it.itemId] ?? it.qty} onChange={e => setRecvQty(p => ({ ...p, [it.itemId]: Math.max(0, Number(e.target.value)) }))} className="w-24 h-8" /></TableCell>
                          <TableCell className="text-right">{fmt(it.rate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <Label>{hi ? 'भुगतान विधि' : 'Payment'}</Label>
                    <Select value={recvMode} onValueChange={v => setRecvMode(v as 'cash' | 'bank' | 'credit')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">{hi ? 'उधार' : 'Credit'}</SelectItem>
                        <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                        <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={recvDate} onChange={e => setRecvDate(e.target.value)} /></div>
                  <Button className="gap-1" onClick={() => { const p = receivePurchaseOrder(selected.id, { receivedQty: recvQty, paymentMode: recvMode, date: recvDate }); if (p) setSelectedId(null); }}>
                    <PackageCheck className="h-4 w-4" />{hi ? 'माल प्राप्त करें' : 'Receive Goods'}
                  </Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader><TableRow><TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead><TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead><TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead></TableRow></TableHeader>
              <TableBody>
                {selected.items.map(it => (
                  <TableRow key={it.itemId}><TableCell>{it.itemName}</TableCell><TableCell className="text-right">{it.qty}</TableCell><TableCell className="text-right">{fmt(it.rate)}</TableCell><TableCell className="text-right">{fmt(it.amount)}</TableCell></TableRow>
                ))}
                <TableRow className="border-t-2"><TableCell className="font-bold" colSpan={3}>{hi ? 'कुल' : 'Total'}</TableCell><TableCell className="text-right font-bold">{fmt(selected.total)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PurchaseOrders;
