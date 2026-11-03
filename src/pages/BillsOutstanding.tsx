/**
 * बकाया बिल / Bills Outstanding (Ageing) — Tally-style Receivables & Payables report.
 * Lists every open credit bill (sale = receivable, purchase = payable) with its age in
 * days and ageing bucket, plus unallocated advance / on-account balances per party.
 * Balances are DERIVED from active bill-allocations (lib/billUtils) — single source of truth.
 * Due dates and the late charge come from the terms frozen on each bill (lib/lateFee). The charge is only
 * calculated here: nothing is posted, so it is in no ledger or report.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Download, FileSpreadsheet, Percent } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import LateFeeRuleFields from '@/components/LateFeeRuleFields';
import { asDayCount } from '@/lib/interestDayCount';
import { billPaymentsMap, computeLateFee, daysOverdue, describeLateFeeRule, isActiveRule, withAdjustedReturns } from '@/lib/lateFee';
import type { LateFeeRule } from '@/types';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate, todayStr } from '@/lib/dateUtils';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';
import { billsReminderMessage } from '@/lib/whatsappReminders';
import {
  getOpenBills, getOpenPurchaseBills, getPartyUnallocated, bucketByAge, ageInDays, getSaleReturnedMap, getPurchaseReturnedMap,
} from '@/lib/billUtils';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface Row { party: string; no: string; date: string; balance: number; days: number; partyId?: string; dueDate?: string | null; overdue: number; }
interface FeeRow { party: string; no: string; dueDate: string; lateDays: number; balance: number; amount: number; rule: LateFeeRule; }

const BillsOutstanding: React.FC = () => {
  const { language } = useLanguage();
  const { society, customers, suppliers, sales, purchases, vouchers, updateSociety } = useData();
  const { salesReturns, purchaseReturns } = useConsumerData();
  const { user } = useAuth();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [asOf, setAsOf] = useState(today());
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable');
  const [partyFilter, setPartyFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [salesRule, setSalesRule] = useState<LateFeeRule | null>(null);
  const [purchasesRule, setPurchasesRule] = useState<LateFeeRule | null>(null);

  const openRules = () => {
    setSalesRule(society.lateFeeRules?.sales ?? null);
    setPurchasesRule(society.lateFeeRules?.purchases ?? null);
    setRulesOpen(true);
  };
  const saveRules = () => {
    const bad = [salesRule, purchasesRule].some(r => r && r.type !== 'none' && !(r.rate > 0));
    if (bad) {
      toast({ title: hi ? 'दर या रकम भरें' : 'Enter the rate or amount', variant: 'destructive' });
      return;
    }
    setRulesOpen(false);
    // updateSociety shows its own destructive toast and rolls back if the cloud save fails.
    updateSociety({ lateFeeRules: { sales: salesRule, purchases: purchasesRule } }, {
      onSaved: () => toast({ title: hi ? 'विलंब शुल्क के नियम सहेजे गए' : 'Late charge rules saved' }),
    });
  };

  const receivableRows = useMemo<Row[]>(() => {
    const returned = getSaleReturnedMap(salesReturns);
    const rows: Row[] = [];
    for (const c of customers) {
      for (const { sale, balance } of getOpenBills(sales, vouchers, c.id, returned)) {
        rows.push({ party: c.name, no: sale.saleNo, date: sale.date, balance, days: ageInDays(sale.date, asOf), partyId: c.id, dueDate: sale.dueDate, overdue: daysOverdue(sale.dueDate, asOf) });
      }
    }
    return rows.sort((a, b) => b.days - a.days);
  }, [customers, sales, salesReturns, vouchers, asOf]);

  const payableRows = useMemo<Row[]>(() => {
    const returned = getPurchaseReturnedMap(purchaseReturns);
    const rows: Row[] = [];
    for (const s of suppliers) {
      for (const { purchase, balance } of getOpenPurchaseBills(purchases, vouchers, s.id, returned)) {
        rows.push({ party: s.name, no: purchase.purchaseNo, date: purchase.date, balance, days: ageInDays(purchase.date, asOf), dueDate: purchase.dueDate, overdue: daysOverdue(purchase.dueDate, asOf) });
      }
    }
    return rows.sort((a, b) => b.days - a.days);
  }, [suppliers, purchases, purchaseReturns, vouchers, asOf]);

  // Unallocated advance / on-account held across all parties (this tab's side).
  const advanceTotal = useMemo(() => {
    const refType = tab === 'receivable' ? 'bill-receipt' : 'bill-payment';
    const parties = tab === 'receivable' ? customers : suppliers;
    return parties.reduce((s, p) => s + getPartyUnallocated(vouchers, refType, p.id), 0);
  }, [tab, customers, suppliers, vouchers]);

  const rows = tab === 'receivable' ? receivableRows : payableRows;
  // WhatsApp reminder (receivables only): ALL of this customer's open bills in one message, oldest first.
  // Balances are today's (getOpenBills does not cut at the as-of date), so the message is dated today.
  const reminderFor = (partyId: string) => {
    const c = customers.find(x => x.id === partyId);
    const bills = receivableRows.filter(r => r.partyId === partyId).sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ no: r.no, date: fmtDate(r.date), balance: r.balance, dueDate: r.dueDate ? fmtDate(r.dueDate) : undefined }));
    return {
      phone: c?.mobile || c?.phone,
      message: billsReminderMessage({ partyName: c?.legalName || c?.name, societyName: society.nameHi || society.name, asOf: fmtDate(todayStr()), bills }),
    };
  };
  const showShare = tab === 'receivable';

  const matchesParty = (party: string) => !partyFilter || party.toLowerCase().includes(partyFilter.toLowerCase());
  const filtered = useMemo(
    () => rows.filter(r => matchesParty(r.party) && (!overdueOnly || r.overdue > 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesParty only reads partyFilter
    [rows, partyFilter, overdueOnly],
  );
  const overdueTotal = useMemo(() => filtered.reduce((sum, r) => sum + (r.overdue > 0 ? r.balance : 0), 0), [filtered]);
  const overdueCount = useMemo(() => filtered.filter(r => r.overdue > 0).length, [filtered]);
  const noDueDateCount = useMemo(() => filtered.filter(r => !r.dueDate).length, [filtered]);

  // The charge on every bill carrying a rule, cleared ones too: a bill paid late is no longer outstanding,
  // but what its lateness cost is still worked out.
  const feeRows = useMemo<FeeRow[]>(() => {
    const payments = withAdjustedReturns(billPaymentsMap(vouchers), tab === 'receivable'
      ? salesReturns.map(r => ({ ...r, billId: r.originalSaleId }))
      : purchaseReturns.map(r => ({ ...r, billId: r.originalPurchaseId })));
    const basis = asDayCount(society.interestDayCount);
    const bills = tab === 'receivable'
      ? sales.map(b => ({ id: b.id, no: b.saleNo, party: b.customerName, total: b.grandTotal ?? b.netAmount ?? 0, dueDate: b.dueDate, rule: b.lateFeeRule, isDeleted: b.isDeleted, mode: b.paymentMode }))
      : purchases.map(b => ({ id: b.id, no: b.purchaseNo, party: b.supplierName, total: b.grandTotal ?? b.netAmount ?? 0, dueDate: b.dueDate, rule: b.lateFeeRule, isDeleted: b.isDeleted, mode: b.paymentMode }));
    const out: FeeRow[] = [];
    for (const b of bills) {
      if (b.isDeleted || b.mode !== 'credit' || !b.dueDate || !isActiveRule(b.rule)) continue;
      const fee = computeLateFee({ total: b.total, dueDate: b.dueDate, rule: b.rule, payments: payments[b.id] ?? [], asOf, basis });
      if (fee.amount > 0) out.push({ party: b.party, no: b.no, dueDate: b.dueDate, lateDays: fee.lateDays, balance: fee.balance, amount: fee.amount, rule: b.rule });
    }
    return out.sort((a, b) => b.amount - a.amount);
  }, [tab, sales, purchases, salesReturns, purchaseReturns, vouchers, asOf, society.interestDayCount]);
  const shownFeeRows = feeRows.filter(r => matchesParty(r.party));
  const feeTotal = shownFeeRows.reduce((sum, r) => sum + r.amount, 0);
  const sideRule = tab === 'receivable' ? society.lateFeeRules?.sales : society.lateFeeRules?.purchases;
  const buckets = useMemo(() => bucketByAge(filtered.map(r => ({ date: r.date, balance: r.balance })), asOf), [filtered, asOf]);

  const bucketLabel = (days: number) => days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+';
  const bucketCls = (days: number) => days <= 30 ? 'text-success' : days <= 60 ? 'text-amber-700' : days <= 90 ? 'text-orange-600' : 'text-destructive';

  const headers = ['Party', 'Bill No', 'Date', 'Due Date', 'Days Overdue', 'Days', 'Bucket', 'Balance'];
  const csvRows = () => filtered.map(r => [r.party, r.no, fmtDate(r.date), r.dueDate ? fmtDate(r.dueDate) : '', r.overdue, r.days, bucketLabel(r.days), r.balance]);
  const fileBase = `${tab === 'receivable' ? 'receivables' : 'payables'}-ageing-${asOf}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Clock className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{hi ? 'बकाया बिल (Ageing)' : 'Bills Outstanding (Ageing)'}</h1>
            <p className="text-sm text-muted-foreground">{hi ? 'बिल-वार वसूली योग्य व देय राशि, उम्र सहित' : 'Bill-wise receivables & payables with ageing'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {user?.role === 'admin' && (
            <Button variant="outline" size="sm" className="gap-2" onClick={openRules}><Percent className="h-4 w-4" />{hi ? 'विलंब शुल्क के नियम' : 'Late charge rules'}</Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadExcelSingle(headers, csvRows(), fileBase, tab === 'receivable' ? 'Receivables' : 'Payables')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCSV(headers, csvRows(), fileBase)}><Download className="h-4 w-4" />CSV</Button>
        </div>
      </div>

      {/* Tabs + controls */}
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setTab('receivable')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'receivable' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {hi ? 'वसूली योग्य (ग्राहक)' : 'Receivables (Customers)'}
            </button>
            <button onClick={() => setTab('payable')} className={`px-4 py-2 text-sm font-medium transition-colors border-l ${tab === 'payable' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {hi ? 'देय (आपूर्तिकर्ता)' : 'Payables (Suppliers)'}
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{hi ? 'इस तिथि तक' : 'As of date'}</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">{hi ? 'पार्टी खोजें' : 'Search party'}</Label>
            <Input value={partyFilter} onChange={e => setPartyFilter(e.target.value)} className="h-9" placeholder={hi ? 'नाम...' : 'Name...'} />
          </div>
          <label className="flex items-center gap-2 text-sm h-9 cursor-pointer">
            <Checkbox checked={overdueOnly} onCheckedChange={v => setOverdueOnly(v === true)} />
            {hi ? 'सिर्फ़ देय तिथि पार' : 'Overdue only'}
          </label>
        </CardContent>
      </Card>

      {/* Ageing summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '0–30', value: buckets.b0_30, color: 'text-success' },
          { label: '31–60', value: buckets.b31_60, color: 'text-amber-700' },
          { label: '61–90', value: buckets.b61_90, color: 'text-orange-600' },
          { label: '90+', value: buckets.b90plus, color: 'text-destructive' },
          { label: hi ? 'कुल बकाया' : 'Total', value: buckets.total, color: 'text-primary' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label} {c.label !== (hi ? 'कुल बकाया' : 'Total') ? (hi ? 'दिन' : 'days') : ''}</p><p className={`text-lg font-bold ${c.color}`}>{fmt(c.value)}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          {hi ? 'देय तिथि पार: ' : 'Past due date: '}
          <span className="font-semibold text-destructive">{fmt(overdueTotal)}</span>
          {` (${overdueCount} ${hi ? 'बिल' : overdueCount === 1 ? 'bill' : 'bills'})`}
        </span>
        {noDueDateCount > 0 && (
          <span>{hi ? `${noDueDateCount} बिल पर देय तिथि नहीं है` : `${noDueDateCount} ${noDueDateCount === 1 ? 'bill has' : 'bills have'} no due date`}</span>
        )}
      </div>

      {advanceTotal > 0.01 && (
        <div className="text-sm text-muted-foreground">
          {hi ? 'बिना बिल अग्रिम / On-Account (इस पक्ष में): ' : 'Unallocated advance / on-account (this side): '}
          <span className="font-semibold text-foreground">{fmt(advanceTotal)}</span>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{tab === 'receivable' ? (hi ? 'वसूली योग्य बिल' : 'Receivable Bills') : (hi ? 'देय बिल' : 'Payable Bills')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई बकाया बिल नहीं 🎉' : 'No outstanding bills 🎉'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                    <TableHead>{hi ? 'बिल नं' : 'Bill No'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'देय तिथि' : 'Due Date'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कितने दिन पार' : 'Days Overdue'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                    <TableHead className="text-center">{hi ? 'आयु-वर्ग' : 'Bucket'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                    {showShare && <TableHead className="w-10"><span className="sr-only">WhatsApp</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={`${r.no}-${i}`} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{r.party}</TableCell>
                      <TableCell className="font-mono text-xs">{r.no}</TableCell>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell>{r.dueDate ? fmtDate(r.dueDate) : '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${r.overdue > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{r.overdue > 0 ? r.overdue : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                      <TableCell className={`text-center text-xs font-medium ${bucketCls(r.days)}`}>{bucketLabel(r.days)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-700">{fmt(r.balance)}</TableCell>
                      {showShare && (
                        <TableCell className="p-1">
                          {r.partyId && (() => {
                            const share = reminderFor(r.partyId);
                            return <WhatsAppShareButton kind="bills" iconOnly hi={hi} phone={share.phone} message={share.message} />;
                          })()}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={7}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.total)}</TableCell>
                    {showShare && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Late charge: calculation only */}
      {(sideRule || shownFeeRows.length > 0) && (
        <Card className="shadow-card">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base">{tab === 'receivable' ? (hi ? 'विलंब शुल्क की गणना' : 'Late charge calculation') : (hi ? 'विलंब शुल्क का अनुमान' : 'Estimated late charge')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {tab === 'receivable'
                ? (hi ? 'यह सिर्फ़ गणना है। खातों या रिपोर्ट में अभी कुछ नहीं जुड़ता।' : 'Calculation only. Nothing is added to the books or reports.')
                : (hi ? 'यह सिर्फ़ अनुमान है। देनदारी तभी बनेगी जब सप्लायर सच में माँगे। खातों में कुछ नहीं जुड़ता।' : 'An estimate only. It is owed only if the supplier actually claims it. Nothing is added to the books.')}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {shownFeeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{hi ? 'इस तिथि तक कोई शुल्क नहीं बनता। नियम सिर्फ़ उसके बाद बने बिलों पर लगता है।' : 'No charge as of this date. A rule applies only to bills made after it was set.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                      <TableHead>{hi ? 'बिल नं' : 'Bill No'}</TableHead>
                      <TableHead>{hi ? 'देय तिथि' : 'Due Date'}</TableHead>
                      <TableHead>{hi ? 'नियम' : 'Rule'}</TableHead>
                      <TableHead className="text-right">{hi ? 'शुल्क के दिन' : 'Days Charged'}</TableHead>
                      <TableHead className="text-right">{hi ? 'अभी बकाया' : 'Unpaid'}</TableHead>
                      <TableHead className="text-right">{hi ? 'शुल्क' : 'Charge'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownFeeRows.map(r => (
                      <TableRow key={r.no} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{r.party}</TableCell>
                        <TableCell className="font-mono text-xs">{r.no}</TableCell>
                        <TableCell>{fmtDate(r.dueDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{describeLateFeeRule(r.rule, hi)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.lateDays}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.balance)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell colSpan={6}>{hi ? 'कुल' : 'Total'}</TableCell>
                      <TableCell className="text-right">{fmt(feeTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'विलंब शुल्क के नियम' : 'Late charge rules'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold">{hi ? 'बिक्री के उधार बिल' : 'Credit sale bills'}</p>
              <LateFeeRuleFields value={salesRule} onChange={setSalesRule} hi={hi} noneLabel={hi ? 'बंद' : 'Off'} />
            </div>
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold">{hi ? 'खरीद के उधार बिल (अनुमान)' : 'Credit purchase bills (estimate)'}</p>
              <LateFeeRuleFields value={purchasesRule} onChange={setPurchasesRule} hi={hi} noneLabel={hi ? 'बंद' : 'Off'} />
            </div>
            <p className="text-xs text-muted-foreground">
              {hi
                ? 'नियम सिर्फ़ इसके बाद बने उधार बिलों पर लगेगा, पुराने बिल नहीं बदलेंगे। किसी ग्राहक या सप्लायर के लिए अलग नियम उसके फ़ॉर्म में "उधारी की शर्तें" में रखा जा सकता है। अभी सिर्फ़ गणना दिखेगी, खातों में कुछ नहीं जुड़ेगा।'
                : 'A rule applies only to credit bills made after this; old bills do not change. A customer or supplier can have their own rule under Credit Terms in their form. For now this only shows the calculation; nothing is added to the books.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRulesOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveRules}>{hi ? 'सहेजें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillsOutstanding;
