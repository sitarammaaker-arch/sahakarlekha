/**
 * Fund Register (ECR-27) — society-level statutory-fund movement statement + utilisation.
 * For every reserve fund (Reserve, Building, Education, Welfare, …) shows the corpus and a
 * full opening → appropriation/contribution → interest → utilisation → closing statement,
 * and lets an admin SPEND a fund (Dr fund / Cr cash|bank) with a balance guard and, above
 * ₹50,000, a committee/AGM resolution reference. Available to all society types.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PiggyBank, ArrowDownCircle } from 'lucide-react';
import { isFundAccount, buildFundStatement } from '@/lib/funds';
import { fundBackingCoverage } from '@/lib/fundBacking';
import { getBankAccountIds } from '@/lib/storage';

const TODAY = () => new Date().toISOString().split('T')[0];
const KIND_LABEL: Record<string, { hi: string; en: string; cls: string }> = {
  contribution: { hi: 'योगदान/विनियोजन', en: 'Contribution/Appropriation', cls: 'text-green-700' },
  interest: { hi: 'ब्याज', en: 'Interest', cls: 'text-blue-700' },
  utilisation: { hi: 'उपयोग', en: 'Utilisation', cls: 'text-red-700' },
};

const FundRegister: React.FC = () => {
  const { accounts, vouchers, recordFundUtilisation, getAccountBalance } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const isAdmin = user?.role === 'admin';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  const funds = useMemo(() => accounts.filter(isFundAccount), [accounts]);
  const activeVouchers = useMemo(() => vouchers.filter(v => !v.isDeleted), [vouchers]);
  const corpusOf = useMemo(() => new Map(funds.map(f => [f.id, buildFundStatement(f, activeVouchers).closing])), [funds, activeVouchers]);

  // ECR-27: are the statutory funds backed by earmarked investments (FDR / securities)?
  const backing = useMemo(() => {
    const fundsTotal = [...corpusOf.values()].reduce((s, c) => s + c, 0);
    const investmentsTotal = accounts
      .filter(a => a.subtype === 'investment' && !a.isGroup)
      .reduce((s, a) => s + getAccountBalance(a.id), 0);
    return fundBackingCoverage(fundsTotal, investmentsTotal);
  }, [corpusOf, accounts, getAccountBalance]);

  const [fundId, setFundId] = useState('');
  const fund = funds.find(f => f.id === fundId);
  const statement = useMemo(() => (fund ? buildFundStatement(fund, activeVouchers) : null), [fund, activeVouchers]);

  const bankAccounts = useMemo(() => { const ids = new Set(getBankAccountIds(accounts)); return accounts.filter(a => ids.has(a.id)); }, [accounts]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', mode: 'bank' as 'cash' | 'bank', bankAccountId: '', date: TODAY(), purpose: '', resolutionNo: '' });

  const openUtilise = () => {
    if (!fund) return;
    setForm({ amount: '', mode: 'bank', bankAccountId: bankAccounts[0]?.id || '', date: TODAY(), purpose: '', resolutionNo: '' });
    setOpen(true);
  };
  const submit = () => {
    if (!fund) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter an amount', variant: 'destructive' }); return; }
    const v = recordFundUtilisation({ fundAccountId: fund.id, amount, mode: form.mode, bankAccountId: form.bankAccountId || undefined, date: form.date, purpose: form.purpose || undefined, resolutionNo: form.resolutionNo || undefined });
    if (v) setOpen(false); // failures already toast from the context (balance/resolution/FY-lock)
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><PiggyBank className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'निधि रजिस्टर' : 'Fund Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'वैधानिक निधियों का विवरण व उपयोग (Dr निधि / Cr नकद-बैंक)। ₹50,000 से ऊपर प्रस्ताव संख्या आवश्यक।' : 'Statutory fund statements + utilisation (Dr fund / Cr cash-bank). Over ₹50,000 needs a resolution.'}</p>
        </div>
      </div>

      {funds.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <PiggyBank className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {hi ? 'कोई निधि खाता नहीं (Reserves & Surplus समूह में reserve खाते बनाएँ)।' : 'No fund accounts (create reserve accounts under Reserves & Surplus).'}
        </CardContent></Card>
      ) : (
        <>
          {/* Fund corpus overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {funds.map(f => (
              <button key={f.id} onClick={() => setFundId(f.id)}
                className={`text-left rounded-lg border p-3 transition ${fundId === f.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                <div className="text-xs text-muted-foreground truncate">{hi ? (f.nameHi || f.name) : f.name}</div>
                <div className="text-lg font-bold">{fmt(corpusOf.get(f.id) || 0)}</div>
              </button>
            ))}
          </div>

          {/* ECR-27: fund backing by investments (FDR / securities) */}
          <Card className={backing.backed ? 'bg-success/10 border-success/20' : 'bg-amber-500/10 border-amber-500/30'}>
            <CardContent className="py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              {backing.backed
                ? <span className="flex items-center gap-2 font-medium text-green-700"><PiggyBank className="h-4 w-4" />{hi ? 'निधियाँ निवेश से समर्थित' : 'Funds backed by investments'}</span>
                : <span className="flex items-center gap-2 font-medium text-amber-700"><ArrowDownCircle className="h-4 w-4" />{hi ? `निधियाँ पूर्ण रूप से निवेशित नहीं — कमी ${fmt(backing.shortfall)}` : `Funds not fully invested — shortfall ${fmt(backing.shortfall)}`}</span>}
              <span className="text-muted-foreground">{hi ? 'कुल निधि' : 'Total funds'}: <span className="font-medium text-foreground">{fmt(backing.fundsTotal)}</span></span>
              <span className="text-muted-foreground">{hi ? 'निवेश (FDR/प्रतिभूति)' : 'Investments (FDR/securities)'}: <span className="font-medium text-foreground">{fmt(backing.investmentsTotal)}</span></span>
              <span className="text-muted-foreground">{hi ? 'कवरेज' : 'Coverage'}: <span className="font-medium text-foreground">{backing.coveragePct}%</span></span>
            </CardContent>
          </Card>

          {fund && statement && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">{hi ? (fund.nameHi || fund.name) : fund.name} — {hi ? 'विवरण' : 'Statement'}</CardTitle>
                {isAdmin && <Button size="sm" onClick={openUtilise} className="gap-2"><ArrowDownCircle className="h-4 w-4" />{hi ? 'निधि उपयोग करें' : 'Utilise fund'}</Button>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">{hi ? 'प्रारंभिक' : 'Opening'}</div><div className="font-semibold">{fmt(statement.opening)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{hi ? 'योगदान/विनियोजन' : 'Contributions'}</div><div className="font-semibold text-green-700">+{fmt(statement.contributions)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{hi ? 'ब्याज' : 'Interest'}</div><div className="font-semibold text-blue-700">+{fmt(statement.interest)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{hi ? 'उपयोग' : 'Utilisation'}</div><div className="font-semibold text-red-700">−{fmt(statement.utilisation)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{hi ? 'अंतिम शेष' : 'Closing'}</div><div className="font-bold">{fmt(statement.closing)}</div></div>
                </div>
                {statement.rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'संदर्भ' : 'Ref'}</TableHead>
                        <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead><TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                        <TableHead className="text-right">{hi ? 'जमा' : 'Credit'}</TableHead><TableHead className="text-right">{hi ? 'नामे' : 'Debit'}</TableHead>
                        <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {statement.rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{r.date}</TableCell>
                            <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                            <TableCell className="text-sm">{r.particulars}</TableCell>
                            <TableCell className={`text-xs ${KIND_LABEL[r.kind]?.cls}`}>{hi ? KIND_LABEL[r.kind]?.hi : KIND_LABEL[r.kind]?.en}</TableCell>
                            <TableCell className="text-right">{r.credit ? fmt(r.credit) : '—'}</TableCell>
                            <TableCell className="text-right">{r.debit ? fmt(r.debit) : '—'}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(r.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <div className="py-6 text-center text-sm text-muted-foreground">{hi ? 'इस निधि में अभी कोई गतिविधि नहीं।' : 'No movement in this fund yet.'}</div>}
              </CardContent>
            </Card>
          )}

          {!fund && <p className="text-sm text-muted-foreground text-center py-4">{hi ? 'विवरण देखने के लिए ऊपर से एक निधि चुनें।' : 'Select a fund above to see its statement.'}</p>}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'निधि उपयोग' : 'Utilise fund'} — {fund && (hi ? (fund.nameHi || fund.name) : fund.name)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{hi ? 'उपलब्ध शेष' : 'Available'}: <span className="font-semibold text-foreground">{fund && fmt(corpusOf.get(fund.id) || 0)}</span></div>
            <div><Label>{hi ? 'राशि' : 'Amount'} *</Label><Input type="number" min={0} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'माध्यम' : 'Mode'}</Label>
                <Select value={form.mode} onValueChange={v => setForm(p => ({ ...p, mode: v as 'cash' | 'bank' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                    <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            </div>
            {form.mode === 'bank' && bankAccounts.length > 0 && (
              <div><Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
                <Select value={form.bankAccountId} onValueChange={v => setForm(p => ({ ...p, bankAccountId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{hi ? (b.nameHi || b.name) : b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{hi ? 'प्रयोजन' : 'Purpose'}</Label><Input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder={hi ? 'जैसे प्रशिक्षण, भवन मरम्मत' : 'e.g. training, building repair'} /></div>
            <div><Label>{hi ? 'प्रस्ताव संख्या (₹50,000 से ऊपर अनिवार्य)' : 'Resolution No. (required above ₹50,000)'}</Label><Input value={form.resolutionNo} onChange={e => setForm(p => ({ ...p, resolutionNo: e.target.value }))} placeholder={hi ? 'समिति/AGM प्रस्ताव' : 'Committee/AGM resolution'} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={submit}>{hi ? 'उपयोग दर्ज करें' : 'Record utilisation'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FundRegister;
