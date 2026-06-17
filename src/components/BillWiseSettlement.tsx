/**
 * BillWiseSettlement — shared Tally-style "Bill-wise Details" entry panel.
 *
 * mode 'receive' → collect a customer payment, settle open sale bills (Against Reference),
 *                  Dr Cash/Bank · Cr Customer  (uses addBillReceipt).
 * mode 'pay'     → make a supplier payment, settle open purchase bills,
 *                  Dr Supplier · Cr Cash/Bank  (uses addBillPayment).
 *
 * Also supports an unallocated remainder held as Advance (before/without a bill) or
 * On Account (over the bills). Reused by ReceivePayment, MakePayment, and the Vouchers
 * page (compact mode) so the same flow is available "inside the voucher" like Tally.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HandCoins, CheckCircle2, Wand2 } from 'lucide-react';
import type { Voucher } from '@/types';
import { getOpenBills, getOpenPurchaseBills, getBillSettledMap } from '@/lib/billUtils';
import { getBankAccountIds } from '@/lib/storage';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface OpenItem { id: string; no: string; date: string; total: number; received: number; balance: number; }

interface Props {
  mode: 'receive' | 'pay';
  /** Hide the big page heading (for embedding inside the Vouchers screen). */
  compact?: boolean;
  onDone?: (v: Voucher) => void;
}

const BillWiseSettlement: React.FC<Props> = ({ mode, compact, onDone }) => {
  const { customers, suppliers, sales, purchases, vouchers, accounts, addBillReceipt, addBillPayment, society } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { toast } = useToast();
  const isPay = mode === 'pay';

  const [partyId, setPartyId] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState('');
  const [bulk, setBulk] = useState('');
  const [extra, setExtra] = useState('');                                  // advance / on-account amount
  const [extraMethod, setExtraMethod] = useState<'advance' | 'on-account'>('advance');

  const bankAccounts = useMemo(() => {
    const ids = getBankAccountIds(accounts);
    return accounts.filter(a => ids.includes(a.id));
  }, [accounts]);

  const settledMap = useMemo(() => getBillSettledMap(vouchers), [vouchers]);

  const openItems = useMemo<OpenItem[]>(() => {
    if (!partyId) return [];
    if (isPay) {
      return getOpenPurchaseBills(purchases, vouchers, partyId).map(({ purchase: p, balance }) => ({
        id: p.id, no: p.purchaseNo, date: p.date, total: p.grandTotal ?? p.netAmount ?? 0, received: settledMap[p.id] || 0, balance,
      }));
    }
    return getOpenBills(sales, vouchers, partyId).map(({ sale: s, balance }) => ({
      id: s.id, no: s.saleNo, date: s.date, total: s.grandTotal ?? s.netAmount ?? 0, received: settledMap[s.id] || 0, balance,
    }));
  }, [partyId, isPay, sales, purchases, vouchers, settledMap]);

  // All parties, those with open bills first (so advances to a new party are possible too).
  const parties = useMemo(() => {
    const base = isPay ? suppliers : customers;
    return base
      .map(p => ({ id: p.id, name: p.name, count: (isPay ? getOpenPurchaseBills(purchases, vouchers, p.id) : getOpenBills(sales, vouchers, p.id)).length }))
      .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
  }, [isPay, customers, suppliers, sales, purchases, vouchers]);

  const allocTotal = useMemo(
    () => openItems.reduce((s, b) => s + (parseFloat(alloc[b.id]) || 0), 0),
    [openItems, alloc],
  );
  const extraNum = Math.max(0, parseFloat(extra) || 0);
  const totalEntered = +(allocTotal + extraNum).toFixed(2);

  const setBillAmt = (id: string, val: string, max: number) => {
    const n = Math.max(0, Math.min(parseFloat(val) || 0, max));
    setAlloc(prev => ({ ...prev, [id]: val === '' ? '' : String(n) }));
  };

  // Distribute a lump sum across open bills, oldest first; remainder → advance/on-account.
  const autoAllocate = () => {
    let remaining = parseFloat(bulk) || 0;
    const next: Record<string, string> = {};
    for (const b of openItems) {
      if (remaining <= 0) { next[b.id] = ''; continue; }
      const give = Math.min(remaining, b.balance);
      next[b.id] = give > 0 ? String(+give.toFixed(2)) : '';
      remaining = +(remaining - give).toFixed(2);
    }
    setAlloc(next);
    if (remaining > 0.01) {
      setExtra(String(+remaining.toFixed(2)));
      setExtraMethod('on-account');
      toast({ title: hi ? 'अतिरिक्त राशि' : 'Extra amount', description: hi ? `₹${fmt(remaining)} "On Account" में रखी गई (कुल बकाया से ज़्यादा)।` : `₹${fmt(remaining)} kept On Account (exceeds total dues).` });
    }
  };

  const reset = () => { setAlloc({}); setBulk(''); setExtra(''); setNarration(''); };

  const handleSubmit = () => {
    if (society.fyLocked) return;
    const allocations = openItems
      .map(b => ({ id: b.id, amount: parseFloat(alloc[b.id]) || 0 }))
      .filter(a => a.amount > 0);
    if (allocations.length === 0 && extraNum <= 0) {
      toast({ title: hi ? 'राशि भरें' : 'Enter amount', description: hi ? 'किसी बिल के विरुद्ध राशि डालें, या अग्रिम/On-Account भरें।' : 'Allocate against a bill, or enter advance/on-account.', variant: 'destructive' });
      return;
    }
    if (paymentMode === 'bank' && !bankAccountId && bankAccounts.length > 0) {
      toast({ title: hi ? 'बैंक चुनें' : 'Select bank', description: hi ? 'कौन-सा बैंक खाता?' : 'Which bank account?', variant: 'destructive' });
      return;
    }
    const advance = extraMethod === 'advance' ? extraNum : 0;
    const onAccount = extraMethod === 'on-account' ? extraNum : 0;
    const v = isPay
      ? addBillPayment({ supplierId: partyId, date, paymentMode, bankAccountId: paymentMode === 'bank' ? bankAccountId : undefined, allocations: allocations.map(a => ({ purchaseId: a.id, amount: a.amount })), advance, onAccount, narration })
      : addBillReceipt({ customerId: partyId, date, paymentMode, bankAccountId: paymentMode === 'bank' ? bankAccountId : undefined, allocations: allocations.map(a => ({ saleId: a.id, amount: a.amount })), advance, onAccount, narration });
    if (v) {
      const party = (isPay ? suppliers : customers).find(p => p.id === partyId);
      toast({
        title: isPay ? (hi ? '✅ भुगतान दर्ज हुआ' : '✅ Payment recorded') : (hi ? '✅ प्राप्ति दर्ज हुई' : '✅ Receipt recorded'),
        description: hi
          ? `${party?.name || ''} ${isPay ? 'को' : 'से'} ₹${fmt(v.amount)} — रसीद: ${v.voucherNo}`
          : `₹${fmt(v.amount)} ${isPay ? 'to' : 'from'} ${party?.name || ''}. Voucher: ${v.voucherNo}`,
      });
      reset();
      onDone?.(v);
    }
  };

  // ── Labels per mode ──
  const L = {
    title: isPay ? (hi ? 'आपूर्तिकर्ता भुगतान' : 'Make Payment') : (hi ? 'भुगतान प्राप्ति' : 'Receive Payment'),
    subtitle: isPay
      ? (hi ? 'आपूर्तिकर्ता को भुगतान किस बिल के विरुद्ध — चुनकर दर्ज करें' : 'Apply a payment to specific purchase bills (Against Reference)')
      : (hi ? 'ग्राहक का भुगतान किस बिल के विरुद्ध — चुनकर दर्ज करें' : 'Apply a customer payment to specific bills (Against Reference)'),
    party: isPay ? (hi ? 'आपूर्तिकर्ता' : 'Supplier') : (hi ? 'ग्राहक' : 'Customer'),
    pickParty: isPay ? (hi ? 'आपूर्तिकर्ता चुनें…' : 'Select supplier…') : (hi ? 'ग्राहक चुनें…' : 'Select customer…'),
    noParty: isPay ? (hi ? 'कोई आपूर्तिकर्ता नहीं' : 'No suppliers') : (hi ? 'कोई ग्राहक नहीं' : 'No customers'),
    noBills: hi ? 'इस का कोई बकाया उधार बिल नहीं — आप नीचे अग्रिम/On-Account राशि दर्ज कर सकते हैं।' : 'No open credit bills — you can still record an advance / on-account below.',
    submit: isPay ? (hi ? 'भुगतान दर्ज करें' : 'Record Payment') : (hi ? 'भुगतान दर्ज करें' : 'Record Payment'),
    totalLbl: isPay ? (hi ? 'कुल भुगतान' : 'Total payment') : (hi ? 'कुल प्राप्ति' : 'Total received'),
  };

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{L.title}</h1>
            <p className="text-sm text-muted-foreground">{L.subtitle}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isPay ? (hi ? 'आपूर्तिकर्ता चुनें' : 'Select Supplier') : (hi ? 'ग्राहक चुनें' : 'Select Customer')}</CardTitle>
          <CardDescription>{isPay ? (hi ? 'जिसे उधार का भुगतान करना है' : 'Supplier you are paying') : (hi ? 'जिसका उधार भुगतान लेना है' : 'Customer whose credit bill is being paid')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{L.party}</Label>
            <Select value={partyId} onValueChange={(v) => { setPartyId(v); setAlloc({}); setBulk(''); setExtra(''); }}>
              <SelectTrigger><SelectValue placeholder={L.pickParty} /></SelectTrigger>
              <SelectContent>
                {parties.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">{L.noParty}</div>}
                {parties.map(({ id, name, count }) => (
                  <SelectItem key={id} value={id}>{name}{count > 0 ? ` (${count} ${hi ? 'बकाया' : 'open'})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'दिनांक' : 'Date'}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {partyId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'बकाया बिल' : 'Open Bills'}</CardTitle>
            <CardDescription>{hi ? 'हर बिल के सामने इस बार की राशि भरें (आंशिक भी चलेगा)' : 'Enter the amount against each bill (partial allowed)'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">{L.noBills}</p>
            ) : (
              <>
                {/* Auto-allocate helper */}
                <div className="flex flex-wrap items-end gap-2 bg-muted/40 rounded-lg p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'कुल राशि (ऑटो-आवंटन)' : 'Total amount (auto-split)'}</Label>
                    <Input type="number" inputMode="decimal" className="w-44" value={bulk} onChange={e => setBulk(e.target.value)} placeholder="0.00" />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={autoAllocate}>
                    <Wand2 className="h-4 w-4" /> {hi ? 'पुराने बिल पहले बाँटें' : 'Split oldest-first'}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'बिल नं' : 'Bill No'}</TableHead>
                        <TableHead>{hi ? 'दिनांक' : 'Date'}</TableHead>
                        <TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
                        <TableHead className="text-right">{hi ? 'पहले' : 'Settled'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                        <TableHead className="text-right w-36">{hi ? 'इस बार' : 'Now'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openItems.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.no}</TableCell>
                          <TableCell>{b.date}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(b.total)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(b.received)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-amber-700">{fmt(b.balance)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              inputMode="decimal"
                              className="h-9 text-right"
                              value={alloc[b.id] ?? ''}
                              onChange={e => setBillAmt(b.id, e.target.value, b.balance)}
                              placeholder="0"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Advance / On-Account (unallocated) */}
            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'अतिरिक्त राशि (बिना बिल)' : 'Extra (no bill)'}</Label>
                <Input type="number" inputMode="decimal" className="w-40" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'किस रूप में' : 'Treat as'}</Label>
                <Select value={extraMethod} onValueChange={v => setExtraMethod(v as 'advance' | 'on-account')}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">{hi ? 'अग्रिम (Advance)' : 'Advance'}</SelectItem>
                    <SelectItem value="on-account">On Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground flex-1 min-w-[12rem]">
                {hi ? 'अग्रिम = बिल बनने से पहले लिया/दिया पैसा · On Account = अभी किस बिल का पता नहीं।' : 'Advance = money before a bill · On Account = bill not yet known.'}
              </p>
            </div>

            {/* Payment mode + total + submit */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div className="space-y-1">
                  <Label className="text-xs">{hi ? 'भुगतान माध्यम' : 'Payment mode'}</Label>
                  <div className="flex gap-2">
                    {(['cash', 'bank'] as const).map(m => (
                      <Button key={m} type="button" size="sm" variant={paymentMode === m ? 'default' : 'outline'} onClick={() => setPaymentMode(m)}>
                        {m === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}
                      </Button>
                    ))}
                  </div>
                </div>
                {paymentMode === 'bank' && (
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                    <Select value={bankAccountId} onValueChange={setBankAccountId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi || a.name : a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{hi ? 'टिप्पणी (वैकल्पिक)' : 'Narration (optional)'}</Label>
                  <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder={hi ? 'जैसे: चेक नं 12345' : 'e.g. Cheque No 12345'} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{L.totalLbl}</p>
                <p className="text-2xl font-bold text-primary tabular-nums">₹{fmt(totalEntered)}</p>
                <Button className="mt-2 gap-2" disabled={totalEntered <= 0 || society.fyLocked} onClick={handleSubmit}>
                  <CheckCircle2 className="h-4 w-4" /> {L.submit}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillWiseSettlement;
