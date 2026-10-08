import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { accountCode } from '@/lib/accountCode';
import { findDuplicateByName } from '@/lib/masterCreate';
import { QuickCreateMaster } from '@/components/QuickCreateMaster';
import type { StockItem } from '@/types';

/**
 * Quick "new item" from a sale / purchase / purchase-order row (2026-10-08).
 *
 * The old quick-add on the sale/purchase forms created an item WITHOUT a Sales / Purchase A/c, and addSale /
 * addPurchase refuse such an item ("इन वस्तुओं को पहले बिक्री खाता असाइन करें") — so an item made there could
 * not be billed. Both accounts are REQUIRED here (pre-filled with the account most items already use, else
 * 4101 / 5101), a new ledger can be created on the spot, and the item is handed back only once it is SAVED
 * in the cloud (the server posts stock against it).
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  /** Which rate to show first ('sale' on a sale, 'purchase' on a purchase / PO). */
  mode: 'sale' | 'purchase';
  onCreated: (item: StockItem) => void;
}

// The SAME unit keys as the Inventory page's form (Inventory.tsx UNITS), so an item made here reads the same everywhere.
const UNITS: { value: string; en: string; hi: string }[] = [
  { value: 'kg', en: 'Kilogram (kg)', hi: 'किलोग्राम (kg)' }, { value: 'quintal', en: 'Quintal', hi: 'क्विंटल' },
  { value: 'liter', en: 'Liter', hi: 'लीटर' }, { value: 'piece', en: 'Piece', hi: 'नग' },
  { value: 'bag', en: 'Bag', hi: 'बोरी' }, { value: 'other', en: 'Other', hi: 'अन्य' },
];

function mostUsed(ids: (string | undefined)[]): string | undefined {
  const n = new Map<string, number>();
  ids.forEach((id) => { if (id) n.set(id, (n.get(id) || 0) + 1); });
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export const QuickItemDialog: React.FC<Props> = ({ open, onOpenChange, initialName = '', mode, onCreated }) => {
  const { accounts, stockItems, addStockItem } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const nameRef = useRef<HTMLInputElement>(null);

  const salesAccs = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'income')
    .sort((a, b) => (accountCode(a) || a.id).localeCompare(accountCode(b) || b.id, undefined, { numeric: true })), [accounts]);
  const purchaseAccs = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'expense')
    .sort((a, b) => (accountCode(a) || a.id).localeCompare(accountCode(b) || b.id, undefined, { numeric: true })), [accounts]);
  const suggest = (ids: (string | undefined)[], fallback: string, list: typeof accounts) => {
    const m = mostUsed(ids);
    if (m && list.some((a) => a.id === m)) return m;
    return list.some((a) => a.id === fallback) ? fallback : '';
  };

  const [name, setName] = useState(initialName);
  const [nameHi, setNameHi] = useState('');
  const [unit, setUnit] = useState('');
  const [saleRate, setSaleRate] = useState(0);
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [hsn, setHsn] = useState('');
  const [salesAccountId, setSalesAccountId] = useState('');
  const [purchaseAccountId, setPurchaseAccountId] = useState('');
  const [newAccFor, setNewAccFor] = useState<'sales' | 'purchase' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialName); setNameHi(''); setUnit(''); setSaleRate(0); setPurchaseRate(0); setHsn(''); setError(''); setSaving(false);
    setSalesAccountId(suggest(stockItems.map((i) => i.salesAccountId), '4101', salesAccs));
    setPurchaseAccountId(suggest(stockItems.map((i) => i.purchaseAccountId), '5101', purchaseAccs));
    setTimeout(() => nameRef.current?.focus(), 100);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const duplicate = useMemo(() => findDuplicateByName(stockItems.filter((i) => i.isActive !== false), name), [stockItems, name]);

  const save = () => {
    setError('');
    if (!name.trim() || !unit.trim()) { setError(hi ? 'नाम और इकाई आवश्यक हैं' : 'Name and unit are required'); return; }
    if (!salesAccountId) { setError(hi ? 'बिक्री खाता चुनें — इसके बिना बिल सेव नहीं होगा' : 'Choose a Sales A/c — a bill cannot be saved without it'); return; }
    if (!purchaseAccountId) { setError(hi ? 'खरीद खाता चुनें — इसके बिना बिल सेव नहीं होगा' : 'Choose a Purchase A/c — a bill cannot be saved without it'); return; }
    setSaving(true);
    const item = addStockItem({
      name: name.trim(), nameHi: nameHi.trim() || name.trim(), unit: unit.trim(),
      openingStock: 0, currentStock: 0, purchaseRate: Number(purchaseRate) || 0, saleRate: Number(saleRate) || 0,
      isActive: true, salesAccountId, purchaseAccountId, ...(hsn.trim() ? { hsnCode: hsn.trim() } : {}),
    } as Parameters<typeof addStockItem>[0], {
      onSaved: (i) => { setSaving(false); onCreated(i); onOpenChange(false); },
      onFailed: () => setSaving(false),
    });
    if (!item?.id) setSaving(false);
  };

  const accSelect = (value: string, set: (v: string) => void, list: typeof accounts, which: 'sales' | 'purchase') => (
    <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={value}
      onChange={(e) => { if (e.target.value === '__new__') { setNewAccFor(which); return; } set(e.target.value); }}>
      <option value="">{hi ? '— चुनें —' : '— choose —'}</option>
      {list.map((a) => <option key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : a.name}{accountCode(a) ? ` (${accountCode(a)})` : ''}</option>)}
      <option value="__new__">{which === 'sales' ? (hi ? '+ नया बिक्री खाता…' : '+ New Sales A/c…') : (hi ? '+ नया खरीद खाता…' : '+ New Purchase A/c…')}</option>
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{hi ? '➕ नई वस्तु जोड़ें' : '➕ Add new item'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>{hi ? 'नाम *' : 'Name *'}</Label><Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={hi ? 'जैसे यूरिया 45 किलो' : 'e.g. Urea 45kg'} /></div>
          <div className="space-y-1"><Label>{hi ? 'हिंदी नाम (वैकल्पिक)' : 'Hindi name (optional)'}</Label><Input value={nameHi} onChange={(e) => setNameHi(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{hi ? 'इकाई *' : 'Unit *'}</Label>
              <select className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">{hi ? '— चुनें —' : '— choose —'}</option>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{hi ? u.hi : u.en}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>HSN / SAC</Label><Input value={hsn} onChange={(e) => setHsn(e.target.value.replace(/\s/g, '').slice(0, 8))} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{hi ? 'बिक्री दर (₹)' : 'Sale rate (₹)'}</Label><Input type="number" min={0} value={saleRate} onChange={(e) => setSaleRate(Number(e.target.value))} autoFocus={mode === 'sale' && !!initialName} /></div>
            <div className="space-y-1"><Label>{hi ? 'खरीद दर (₹)' : 'Purchase rate (₹)'}</Label><Input type="number" min={0} value={purchaseRate} onChange={(e) => setPurchaseRate(Number(e.target.value))} /></div>
          </div>
          <div className="space-y-1"><Label>{hi ? 'बिक्री खाता *' : 'Sales A/c *'}</Label>{accSelect(salesAccountId, setSalesAccountId, salesAccs, 'sales')}</div>
          <div className="space-y-1"><Label>{hi ? 'खरीद खाता *' : 'Purchase A/c *'}</Label>{accSelect(purchaseAccountId, setPurchaseAccountId, purchaseAccs, 'purchase')}</div>
          <p className="text-xs text-muted-foreground">{hi ? 'इन्हीं खातों से व्यापार खाते में वस्तु-वार बिक्री/खरीद दिखती है। प्रारंभिक स्टॉक बाद में इन्वेंटरी पेज पर भर सकते हैं।' : 'These accounts route the item in the Trading A/c. Opening stock can be set later on the Inventory page.'}</p>
          {duplicate && <p className="text-sm text-amber-700">{hi ? `"${duplicate.name}" नाम की वस्तु पहले से है — सूची में उसे चुनें।` : `"${duplicate.name}" already exists — pick it from the list.`}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
          <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{hi ? 'बन रहा है…' : 'Saving…'}</> : (hi ? 'बनाएँ और चुनें' : 'Create & select')}</Button>
        </DialogFooter>
        <QuickCreateMaster open={newAccFor !== null} onOpenChange={(o) => { if (!o) setNewAccFor(null); }} kinds={['general']}
          defaultType={newAccFor === 'sales' ? 'income' : 'expense'}
          onCreated={(c) => { if (newAccFor === 'sales') setSalesAccountId(c.accountId); else setPurchaseAccountId(c.accountId); setNewAccFor(null); }} />
      </DialogContent>
    </Dialog>
  );
};

export default QuickItemDialog;
