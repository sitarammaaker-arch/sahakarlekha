/**
 * भुगतान प्राप्ति — Receive Payment (Bill-wise / "Against Reference")
 * Collect a customer payment and apply it to one or more open credit bills.
 * Public app page (auth required via ProtectedRoute).
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HandCoins, CheckCircle2, Wand2 } from 'lucide-react';
import { getOpenBills, getBillReceivedMap } from '@/lib/billUtils';
import { getBankAccountIds } from '@/lib/storage';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const ReceivePayment: React.FC = () => {
  const { customers, sales, vouchers, accounts, addBillReceipt, society } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState('');
  const [bulk, setBulk] = useState('');

  const bankAccounts = useMemo(() => {
    const ids = getBankAccountIds(accounts);
    return accounts.filter(a => ids.includes(a.id));
  }, [accounts]);

  const receivedMap = useMemo(() => getBillReceivedMap(vouchers), [vouchers]);
  const openBills = useMemo(
    () => (customerId ? getOpenBills(sales, vouchers, customerId) : []),
    [sales, vouchers, customerId],
  );

  // Customers that actually have at least one open bill (most useful first)
  const customersWithDues = useMemo(() => {
    return customers
      .map(c => ({ c, count: getOpenBills(sales, vouchers, c.id).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [customers, sales, vouchers]);

  const totalEntered = useMemo(
    () => openBills.reduce((s, b) => s + (parseFloat(alloc[b.sale.id]) || 0), 0),
    [openBills, alloc],
  );

  const setBillAmt = (saleId: string, val: string, max: number) => {
    const n = Math.max(0, Math.min(parseFloat(val) || 0, max));
    setAlloc(prev => ({ ...prev, [saleId]: val === '' ? '' : String(n) }));
  };

  // Distribute a lump sum across open bills, oldest first.
  const autoAllocate = () => {
    let remaining = parseFloat(bulk) || 0;
    const next: Record<string, string> = {};
    for (const b of openBills) {
      if (remaining <= 0) { next[b.sale.id] = ''; continue; }
      const give = Math.min(remaining, b.balance);
      next[b.sale.id] = give > 0 ? String(+give.toFixed(2)) : '';
      remaining = +(remaining - give).toFixed(2);
    }
    setAlloc(next);
    if (remaining > 0.01) {
      toast({ title: hi ? 'अतिरिक्त राशि' : 'Extra amount', description: hi ? `₹${fmt(remaining)} किसी बिल में नहीं लगी (कुल बकाया से ज़्यादा)।` : `₹${fmt(remaining)} could not be applied (exceeds total dues).` });
    }
  };

  const reset = () => { setAlloc({}); setBulk(''); setNarration(''); };

  const handleSubmit = () => {
    if (society.fyLocked) return;
    const allocations = openBills
      .map(b => ({ saleId: b.sale.id, amount: parseFloat(alloc[b.sale.id]) || 0 }))
      .filter(a => a.amount > 0);
    if (allocations.length === 0) {
      toast({ title: hi ? 'राशि भरें' : 'Enter amount', description: hi ? 'कम से कम एक बिल के विरुद्ध राशि डालें।' : 'Allocate against at least one bill.', variant: 'destructive' });
      return;
    }
    if (paymentMode === 'bank' && !bankAccountId && bankAccounts.length > 0) {
      toast({ title: hi ? 'बैंक चुनें' : 'Select bank', description: hi ? 'किस बैंक खाते में आया?' : 'Which bank account?', variant: 'destructive' });
      return;
    }
    const v = addBillReceipt({ customerId, date, paymentMode, bankAccountId: paymentMode === 'bank' ? bankAccountId : undefined, allocations, narration });
    if (v) {
      const cust = customers.find(c => c.id === customerId);
      toast({
        title: hi ? '✅ भुगतान दर्ज हुआ' : '✅ Payment recorded',
        description: hi
          ? `${cust?.name || ''} से ₹${fmt(v.amount)} — ${allocations.length} बिल के विरुद्ध। रसीद: ${v.voucherNo}`
          : `₹${fmt(v.amount)} from ${cust?.name || ''} against ${allocations.length} bill(s). Receipt: ${v.voucherNo}`,
      });
      reset();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <HandCoins className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'भुगतान प्राप्ति' : 'Receive Payment'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'ग्राहक का भुगतान किस बिल के विरुद्ध है — चुनकर दर्ज करें' : 'Apply a customer payment against specific bills (Against Reference)'}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{hi ? 'ग्राहक चुनें' : 'Select Customer'}</CardTitle>
          <CardDescription>{hi ? 'जिस ग्राहक का उधार भुगतान लेना है' : 'Customer whose credit bill is being paid'}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{hi ? 'ग्राहक' : 'Customer'}</Label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setAlloc({}); setBulk(''); }}>
              <SelectTrigger><SelectValue placeholder={hi ? 'ग्राहक चुनें…' : 'Select customer…'} /></SelectTrigger>
              <SelectContent>
                {customersWithDues.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">{hi ? 'किसी ग्राहक का बकाया बिल नहीं' : 'No customers with open bills'}</div>}
                {customersWithDues.map(({ c, count }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({count} {hi ? 'बकाया' : 'open'})</SelectItem>
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

      {customerId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'बकाया बिल' : 'Open Bills'}</CardTitle>
            <CardDescription>{hi ? 'हर बिल के सामने इस बार ली जा रही राशि भरें (आंशिक भी चलेगा)' : 'Enter the amount received against each bill (partial allowed)'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {openBills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{hi ? 'इस ग्राहक का कोई बकाया उधार बिल नहीं है। 🎉' : 'No open credit bills for this customer. 🎉'}</p>
            ) : (
              <>
                {/* Auto-allocate helper */}
                <div className="flex flex-wrap items-end gap-2 bg-muted/40 rounded-lg p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{hi ? 'कुल प्राप्त राशि (ऑटो-आवंटन)' : 'Total received (auto-split)'}</Label>
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
                        <TableHead className="text-right">{hi ? 'पहले प्राप्त' : 'Received'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                        <TableHead className="text-right w-36">{hi ? 'इस बार' : 'Now'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openBills.map(({ sale, balance }) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.saleNo}</TableCell>
                          <TableCell>{sale.date}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(sale.grandTotal ?? sale.netAmount ?? 0)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(receivedMap[sale.id] || 0)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-amber-700">{fmt(balance)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              inputMode="decimal"
                              className="h-9 text-right"
                              value={alloc[sale.id] ?? ''}
                              onChange={e => setBillAmt(sale.id, e.target.value, balance)}
                              placeholder="0"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total + payment mode */}
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
                    <p className="text-xs text-muted-foreground">{hi ? 'कुल भुगतान' : 'Total payment'}</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">₹{fmt(totalEntered)}</p>
                    <Button className="mt-2 gap-2" disabled={totalEntered <= 0 || society.fyLocked} onClick={handleSubmit}>
                      <CheckCircle2 className="h-4 w-4" /> {hi ? 'भुगतान दर्ज करें' : 'Record Payment'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReceivePayment;
