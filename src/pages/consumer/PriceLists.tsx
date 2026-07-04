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
import { Tags, Plus, Trash2 } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';

const TODAY = () => new Date().toISOString().split('T')[0];

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const PriceLists: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { stockItems, society } = useData();
  const { consumerPrices, addConsumerPrice, deleteConsumerPrice } = useConsumerData();
  const { toast } = useToast();

  const [itemId, setItemId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [effectiveFrom, setEffectiveFrom] = useState(TODAY());

  const itemName = (id: string) => {
    const s = stockItems.find(x => x.id === id);
    return s ? (hi ? (s.nameHi || s.name) : s.name) : id;
  };
  const baseRate = (id: string) => stockItems.find(x => x.id === id)?.saleRate ?? 0;

  const memberPrices = useMemo(
    () => consumerPrices
      .filter(p => p.tier === 'member' && !p.isDeleted)
      .sort((a, b) => itemName(a.itemId).localeCompare(itemName(b.itemId)) || (a.effectiveFrom < b.effectiveFrom ? 1 : -1)),
    [consumerPrices, stockItems, hi],
  );

  const handleAdd = () => {
    if (!itemId) {
      toast({ title: hi ? 'वस्तु चुनें' : 'Select an item', variant: 'destructive' });
      return;
    }
    if (!(price > 0)) {
      toast({ title: hi ? 'मान्य मूल्य दर्ज करें' : 'Enter a valid price', variant: 'destructive' });
      return;
    }
    addConsumerPrice({ itemId, tier: 'member', price, effectiveFrom });
    toast({ title: hi ? `सदस्य मूल्य जोड़ा गया — ${itemName(itemId)}` : `Member price added — ${itemName(itemId)}` });
    setItemId(''); setPrice(0); setEffectiveFrom(TODAY());
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Tags className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'सदस्य मूल्य सूची' : 'Member Price List'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {hi
          ? 'यहाँ केवल सदस्य दर (retail से अलग) तय करें। रिटेल दर इन्वेंटरी की बिक्री दर (saleRate) रहती है। नई दर लागू करने के लिए नई "लागू तिथि" वाली पंक्ति जोड़ें — पुरानी पंक्ति इतिहास के लिए बनी रहती है।'
          : 'Set only the member rate here (distinct from retail). Retail stays the Inventory sale rate. To revise, add a new row with a later effective date — the old row stays for history.'}
      </div>

      {/* Add form */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'सदस्य दर जोड़ें' : 'Add Member Price'}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1 sm:col-span-2">
            <Label>{hi ? 'वस्तु' : 'Item'}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder={hi ? 'वस्तु चुनें' : 'Select item'} /></SelectTrigger>
              <SelectContent>
                {stockItems.filter(s => s.isActive).map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {(hi ? (s.nameHi || s.name) : s.name)} · {hi ? 'रिटेल' : 'retail'} {fmt(s.saleRate || 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'सदस्य दर (₹)' : 'Member Rate (₹)'}</Label>
            <Input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(Math.max(0, Number(e.target.value)))} />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'लागू तिथि' : 'Effective From'}</Label>
            <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <Button onClick={handleAdd} className="gap-1"><Plus className="h-4 w-4" />{hi ? 'जोड़ें' : 'Add'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                <TableHead className="text-right">{hi ? 'रिटेल दर' : 'Retail Rate'}</TableHead>
                <TableHead className="text-right">{hi ? 'सदस्य दर' : 'Member Rate'}</TableHead>
                <TableHead>{hi ? 'लागू तिथि' : 'Effective From'}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberPrices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                    {hi ? 'कोई सदस्य दर तय नहीं — ऊपर से जोड़ें' : 'No member prices set — add one above'}
                  </TableCell>
                </TableRow>
              ) : memberPrices.map(p => {
                const retail = baseRate(p.itemId);
                const cheaper = p.price < retail;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{itemName(p.itemId)}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmt(retail)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(p.price)}
                      {cheaper && <Badge variant="outline" className="ml-2 border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px]">{hi ? 'बचत' : 'saves'} {fmt(retail - p.price)}</Badge>}
                    </TableCell>
                    <TableCell>{fmtDate(p.effectiveFrom)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => deleteConsumerPrice(p.id)}>
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
  );
};

export default PriceLists;
