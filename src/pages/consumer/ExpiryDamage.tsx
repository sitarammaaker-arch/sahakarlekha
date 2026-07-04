import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { computeStockMap, computeStockCostRate } from '@/lib/stockUtils';
import { buildWriteoffRegister, WRITEOFF_REF_PREFIX } from '@/lib/consumer/registers';
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
import { PackageX, Download, AlertTriangle } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

type Reason = 'expiry' | 'damage' | 'theft' | 'other';

const ExpiryDamage: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { stockItems, stockMovements, addStockMovement, society } = useData();
  const { toast } = useToast();

  const REASON: Record<Reason, { hi: string; en: string }> = {
    expiry: { hi: 'समाप्ति (Expiry)', en: 'Expiry' },
    damage: { hi: 'क्षति (Damage)', en: 'Damage' },
    theft: { hi: 'कमी / चोरी', en: 'Shrinkage / Theft' },
    other: { hi: 'अन्य', en: 'Other' },
  };

  const stockMap = useMemo(() => computeStockMap(stockItems, stockMovements), [stockItems, stockMovements]);
  const register = useMemo(() => buildWriteoffRegister(stockMovements), [stockMovements]);

  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState<Reason>('expiry');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [date, setDate] = useState(TODAY());
  const [note, setNote] = useState('');

  const itemName = (id: string) => {
    const s = stockItems.find(x => x.id === id);
    return s ? (hi ? (s.nameHi || s.name) : s.name) : id;
  };
  const avail = itemId ? (stockMap[itemId] ?? 0) : 0;

  const handleWriteOff = () => {
    const item = stockItems.find(s => s.id === itemId);
    if (!item) { toast({ title: hi ? 'वस्तु चुनें' : 'Select an item', variant: 'destructive' }); return; }
    if (!(qty > 0)) { toast({ title: hi ? 'मान्य मात्रा दर्ज करें' : 'Enter a valid quantity', variant: 'destructive' }); return; }
    if (qty > avail) { toast({ title: hi ? 'स्टॉक से अधिक बट्टे नहीं' : 'Cannot write off more than stock', description: `${hi ? 'उपलब्ध' : 'Available'}: ${avail}`, variant: 'destructive' }); return; }
    const costRate = computeStockCostRate(item, stockMovements);
    const value = Math.round(qty * costRate * 100) / 100;
    addStockMovement({
      date,
      itemId,
      type: 'adjustment',
      qty: -Math.abs(qty),               // negative → reduces derived stock (periodic model, no voucher)
      rate: costRate,
      amount: value,
      referenceNo: `${WRITEOFF_REF_PREFIX}${reason}`,
      narration: note.trim() || (hi ? REASON[reason].hi : REASON[reason].en),
      batchNo: batchNo.trim() || undefined,
      expiryDate: expiryDate || undefined,
    });
    toast({ title: hi ? `बट्टे खाते डाला — ${itemName(itemId)} × ${qty}` : `Written off — ${itemName(itemId)} × ${qty}` });
    setItemId(''); setQty(0); setBatchNo(''); setExpiryDate(''); setNote('');
  };

  const exportRegister = () => {
    const headers = ['Date', 'Item', 'Qty', 'Reason', 'Batch', 'Expiry', 'Value'];
    const rows = register.rows.map(r => [fmtDate(r.date), itemName(r.itemId), r.qty, r.reason, r.batchNo || '', r.expiryDate || '', r.value]);
    downloadCSV(headers, rows, `writeoff-register-${TODAY()}.csv`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg"><PackageX className="h-6 w-6 text-red-700" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'समाप्ति एवं क्षति' : 'Expiry & Damage'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{hi ? 'कुल बट्टे (मूल्य)' : 'Total Written Off'}</p>
          <p className="text-lg font-bold text-red-700">{fmt(register.totalValue)}</p>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        {hi
          ? 'बट्टे खाते डालने से स्टॉक घटता है; लागत पहले से खरीद में है, इसलिए साल-अंत क्लोज़िंग स्टॉक अपने-आप घाटे को दर्शाता है (अलग वाउचर नहीं)।'
          : 'A write-off reduces stock; the cost is already in purchases, so year-end closing stock reflects the loss automatically (no separate voucher).'}
      </div>

      {/* Write-off form */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'बट्टे खाते डालें' : 'Record Write-off'}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1 sm:col-span-2">
            <Label>{hi ? 'वस्तु' : 'Item'}{itemId && <span className="ml-2 text-xs text-muted-foreground">{hi ? 'उपलब्ध' : 'avail'}: {avail}</span>}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder={hi ? 'वस्तु चुनें' : 'Select item'} /></SelectTrigger>
              <SelectContent>
                {stockItems.filter(s => s.isActive).map(s => (
                  <SelectItem key={s.id} value={s.id}>{(hi ? (s.nameHi || s.name) : s.name)} · {hi ? 'स्टॉक' : 'stock'} {stockMap[s.id] ?? 0}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'मात्रा' : 'Quantity'}</Label>
            <Input type="number" min={0} value={qty} onChange={e => setQty(Math.max(0, Number(e.target.value)))} className={cn(itemId && qty > avail && 'border-destructive')} />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'कारण' : 'Reason'}</Label>
            <Select value={reason} onValueChange={v => setReason(v as Reason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON) as Reason[]).map(r => <SelectItem key={r} value={r}>{hi ? REASON[r].hi : REASON[r].en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'बैच नं. (वैकल्पिक)' : 'Batch No. (optional)'}</Label>
            <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'समाप्ति तिथि (वैकल्पिक)' : 'Expiry date (optional)'}</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'तिथि' : 'Date'}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{hi ? 'नोट (वैकल्पिक)' : 'Note (optional)'}</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleWriteOff} className="w-full gap-1 bg-red-600 hover:bg-red-700"><PackageX className="h-4 w-4" />{hi ? 'बट्टे खाते डालें' : 'Write Off'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Register */}
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{hi ? 'बट्टा रजिस्टर' : 'Write-off Register'}</CardTitle>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportRegister}><Download className="h-4 w-4" />CSV</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                <TableHead>{hi ? 'कारण' : 'Reason'}</TableHead>
                <TableHead>{hi ? 'बैच' : 'Batch'}</TableHead>
                <TableHead>{hi ? 'समाप्ति' : 'Expiry'}</TableHead>
                <TableHead className="text-right">{hi ? 'मूल्य' : 'Value'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {register.rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">{hi ? 'कोई बट्टा नहीं' : 'No write-offs'}</TableCell></TableRow>
              ) : (
                <>
                  {register.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{itemName(r.itemId)}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{hi ? (REASON[r.reason as Reason]?.hi || r.reason) : (REASON[r.reason as Reason]?.en || r.reason)}</Badge></TableCell>
                      <TableCell className="text-xs">{r.batchNo || '—'}</TableCell>
                      <TableCell className={cn('text-xs', r.expiryDate && r.expiryDate < TODAY() && 'text-red-600 font-medium')}>{r.expiryDate ? fmtDate(r.expiryDate) : '—'}</TableCell>
                      <TableCell className="text-right">{fmt(r.value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-gray-50">
                    <TableCell className="font-bold" colSpan={2}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right font-bold">{register.totalQty}</TableCell>
                    <TableCell colSpan={3} />
                    <TableCell className="text-right font-bold">{fmt(register.totalValue)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiryDamage;
