import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { downloadCSV } from '@/lib/exportUtils';
import { isFundAccount, buildFundStatement } from '@/lib/housing/funds';
import { round2 } from '@/lib/housing/billing';
import { PiggyBank, TrendingUp, MinusCircle, PlusCircle, Download, Trash2, Landmark } from 'lucide-react';

type OpType = 'interest' | 'utilisation' | 'contribution';

export default function FundStatement() {
  const { accounts, vouchers } = useData();
  const { recordFundInterest, recordFundUtilisation, recordFundContribution, fundInvestments, addFundInvestment, redeemFundInvestment, deleteFundInvestment } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = () => new Date().toISOString().split('T')[0];

  const funds = useMemo(() => accounts.filter(isFundAccount), [accounts]);
  // Precompute each fund's corpus once per data change (not once per fund per render).
  const fundBalances = useMemo(() => new Map(funds.map(f => [f.id, buildFundStatement(f, vouchers).closing])), [funds, vouchers]);
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));

  const [fundId, setFundId] = useState('');
  const fund = funds.find(f => f.id === fundId);
  const statement = useMemo(() => (fund ? buildFundStatement(fund, vouchers) : null), [fund, vouchers]);

  const investAccounts = accounts.filter(a => !a.isGroup && a.type === 'asset');
  const fundInvs = fundInvestments.filter(i => !i.isDeleted && i.fundAccountId === fundId);
  const investedActive = fundInvs.filter(i => i.status === 'active').reduce((s, i) => s + (i.amount || 0), 0);

  // Add-investment dialog
  const [invOpen, setInvOpen] = useState(false);
  const [invAcc, setInvAcc] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDate, setInvDate] = useState(today());
  const [invInstrument, setInvInstrument] = useState('FDR');
  const [invInstitution, setInvInstitution] = useState('');
  const [invMaturity, setInvMaturity] = useState('');
  const [invRate, setInvRate] = useState('');
  const [invMode, setInvMode] = useState<'cash' | 'bank'>('bank');
  const [invBankId, setInvBankId] = useState('');

  const openInvest = () => {
    setInvAcc(investAccounts.find(a => a.id === '3201')?.id || investAccounts[0]?.id || '');
    setInvAmount(''); setInvDate(today()); setInvInstrument('FDR'); setInvInstitution(''); setInvMaturity(''); setInvRate('');
    setInvMode('bank'); setInvBankId(bankAccounts[0]?.id || '');
    setInvOpen(true);
  };
  const saveInvest = () => {
    if (!fund) return;
    if (!invAcc) { toast({ title: hi ? 'निवेश खाता चुनें' : 'Pick an investment account', variant: 'destructive' }); return; }
    if (!(Number(invAmount) > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const inv = addFundInvestment({
      fundAccountId: fund.id, investmentAccountId: invAcc, amount: Number(invAmount), date: invDate,
      mode: invMode, bankAccountId: invMode === 'bank' ? (invBankId || undefined) : undefined,
      instrument: invInstrument.trim() || undefined, institution: invInstitution.trim() || undefined,
      maturityDate: invMaturity || undefined, interestRate: invRate ? Number(invRate) : undefined,
    });
    if (inv.id) setInvOpen(false);
  };

  // Redeem dialog — capture maturity value so any interest earned is posted (not silently dropped).
  const [redeemInv, setRedeemInv] = useState<(typeof fundInvestments)[number] | null>(null);
  const [redeemMaturity, setRedeemMaturity] = useState('');
  const [redeemDate, setRedeemDate] = useState(today());
  const [redeemMode, setRedeemMode] = useState<'cash' | 'bank'>('bank');
  const [redeemBankId, setRedeemBankId] = useState('');

  const openRedeem = (inv: (typeof fundInvestments)[number]) => {
    setRedeemInv(inv); setRedeemMaturity(String(inv.amount)); setRedeemDate(today());
    setRedeemMode('bank'); setRedeemBankId(bankAccounts[0]?.id || '');
  };
  const saveRedeem = () => {
    if (!redeemInv) return;
    const mat = Number(redeemMaturity);
    if (!(mat >= redeemInv.amount)) { toast({ title: hi ? 'परिपक्वता राशि मूल से कम नहीं हो सकती' : 'Maturity cannot be less than principal', variant: 'destructive' }); return; }
    redeemFundInvestment({ id: redeemInv.id, date: redeemDate, mode: redeemMode, bankAccountId: redeemMode === 'bank' ? (redeemBankId || undefined) : undefined, maturityAmount: mat });
    setRedeemInv(null);
  };
  const redeemInterest = redeemInv ? round2(Math.max(0, (Number(redeemMaturity) || 0) - redeemInv.amount)) : 0;

  // Operation dialog
  const [opOpen, setOpOpen] = useState(false);
  const [opType, setOpType] = useState<OpType>('interest');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<'cash' | 'bank'>('bank');
  const [bankId, setBankId] = useState('');
  const [note, setNote] = useState('');

  const opMeta: Record<OpType, { hi: string; en: string }> = {
    interest: { hi: 'ब्याज आवंटन', en: 'Allocate Interest' },
    utilisation: { hi: 'निधि उपयोग', en: 'Utilise Fund' },
    contribution: { hi: 'अंशदान जोड़ें', en: 'Add Contribution' },
  };

  const [resNo, setResNo] = useState('');
  const [resDate, setResDate] = useState('');
  const openOp = (t: OpType) => {
    setOpType(t); setAmount(''); setDate(today()); setMode('bank'); setBankId(bankAccounts[0]?.id || ''); setNote('');
    setResNo(''); setResDate('');
    setOpOpen(true);
  };

  const saveOp = () => {
    const amt = Number(amount);
    if (!fund) return;
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    const common = { fundAccountId: fund.id, amount: amt, mode, bankAccountId: mode === 'bank' ? (bankId || undefined) : undefined, date };
    const v = opType === 'interest' ? recordFundInterest({ ...common, remarks: note.trim() || undefined })
      : opType === 'utilisation' ? recordFundUtilisation({ ...common, purpose: note.trim() || undefined, resolutionNo: resNo.trim() || undefined, resolutionDate: resDate || undefined })
      : recordFundContribution({ ...common, remarks: note.trim() || undefined });
    if (v.id) setOpOpen(false);
  };

  const exportCsv = () => {
    if (!fund || !statement) return;
    downloadCSV(
      [hi ? 'तिथि' : 'Date', hi ? 'संदर्भ' : 'Ref', hi ? 'प्रकार' : 'Type', hi ? 'विवरण' : 'Particulars', hi ? 'जमा' : 'Credit', hi ? 'नाम' : 'Debit', hi ? 'शेष' : 'Balance'],
      statement.rows.map(r => [r.date, r.ref, r.kind, r.particulars, r.credit || '', r.debit || '', r.balance]),
      `fund-statement-${fund.id}`,
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <PiggyBank className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'निधि विवरण' : 'Fund Statement'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'संचय निधियाँ — अंशदान, ब्याज, उपयोग और शेष कोष' : 'Reserve funds — contributions, interest, utilisation and corpus'}</p>
        </div>
      </div>

      {/* Fund picker + balances */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'निधियाँ' : 'Funds'} ({funds.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {funds.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'चार्ट में कोई संचय निधि खाता नहीं।' : 'No reserve-fund accounts in the chart.'}</p>}
          {funds.map(f => {
            const bal = fundBalances.get(f.id) || 0;
            return (
              <button key={f.id} onClick={() => setFundId(f.id)}
                className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-sm ${fundId === f.id ? 'border-primary bg-primary/5' : ''}`}>
                <span className="font-medium">{hi ? f.nameHi : f.name} <span className="text-xs text-muted-foreground">({f.id})</span></span>
                <span className="font-semibold">{money(bal)}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {fund && statement && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryChip label={hi ? 'प्रारंभिक' : 'Opening'} value={money(statement.opening)} />
            <SummaryChip label={hi ? 'अंशदान' : 'Contributions'} value={money(statement.contributions)} />
            <SummaryChip label={hi ? 'ब्याज' : 'Interest'} value={money(statement.interest)} />
            <SummaryChip label={hi ? 'उपयोग' : 'Utilisation'} value={money(statement.utilisation)} />
            <SummaryChip label={hi ? 'शेष कोष' : 'Closing corpus'} value={money(statement.closing)} strong />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openOp('interest')} className="gap-1"><TrendingUp className="h-4 w-4" />{hi ? 'ब्याज आवंटन' : 'Allocate Interest'}</Button>
            <Button size="sm" variant="outline" onClick={() => openOp('utilisation')} className="gap-1"><MinusCircle className="h-4 w-4" />{hi ? 'निधि उपयोग' : 'Utilise'}</Button>
            <Button size="sm" variant="outline" onClick={() => openOp('contribution')} className="gap-1"><PlusCircle className="h-4 w-4" />{hi ? 'अंशदान' : 'Contribution'}</Button>
            {statement.rows.length > 0 && <Button size="sm" variant="ghost" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />CSV</Button>}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'निधि खाता विवरण' : 'Fund Ledger'} — {hi ? fund.nameHi : fund.name}</CardTitle></CardHeader>
            <CardContent>
              {statement.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{hi ? 'इस निधि में अभी कोई गति नहीं।' : 'No movements in this fund yet.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                        <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                        <TableHead className="text-right">{hi ? 'जमा' : 'In'}</TableHead>
                        <TableHead className="text-right">{hi ? 'उपयोग' : 'Out'}</TableHead>
                        <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={r.kind === 'utilisation' ? 'destructive' : r.kind === 'interest' ? 'default' : 'secondary'} className="shrink-0">
                                {r.kind === 'interest' ? (hi ? 'ब्याज' : 'Interest') : r.kind === 'utilisation' ? (hi ? 'उपयोग' : 'Utilised') : (hi ? 'अंशदान' : 'Contribution')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{r.ref}</span>
                            </div>
                            <div className="text-sm">{r.particulars}</div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-emerald-600">{r.credit ? money(r.credit) : ''}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-destructive">{r.debit ? money(r.debit) : ''}</TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium">{money(r.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investments (FDR earmarking) */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Landmark className="h-4 w-4" />{hi ? 'निवेश (FDR)' : 'Investments (FDR)'} ({fundInvs.length})</span>
              <Button size="sm" variant="outline" onClick={openInvest} className="gap-1"><PlusCircle className="h-4 w-4" />{hi ? 'निवेश जोड़ें' : 'Add Investment'}</Button>
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>{hi ? 'निवेशित' : 'Invested'}: <b>{money(investedActive)}</b></span>
                <span className="text-muted-foreground">{hi ? 'शेष (नकद/बैंक)' : 'Held as cash/bank'}: {money(round2(statement.closing - investedActive))}</span>
              </div>
              {fundInvs.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'इस निधि का कोई निवेश दर्ज नहीं।' : 'No investments recorded for this fund.'}</p>}
              {fundInvs.map(i => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{i.instrument || 'FDR'}{i.institution ? ` · ${i.institution}` : ''} <Badge variant={i.status === 'redeemed' ? 'secondary' : 'default'}>{i.status === 'redeemed' ? (hi ? 'भुनाया' : 'Redeemed') : (hi ? 'सक्रिय' : 'Active')}</Badge></div>
                    <div className="text-muted-foreground">{money(i.amount)} · {i.date}{i.maturityDate ? ` → ${i.maturityDate}` : ''}{i.interestRate ? ` · ${i.interestRate}%` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {i.status === 'active' && <Button size="sm" variant="outline" onClick={() => openRedeem(i)}>{hi ? 'भुनाएँ' : 'Redeem'}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(hi ? 'निवेश हटाएँ?' : 'Delete investment?')) deleteFundInvestment(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add-investment dialog */}
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'निधि निवेश जोड़ें' : 'Add Fund Investment'}{fund ? ` — ${hi ? fund.nameHi : fund.name}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'निवेश खाता (संपत्ति)' : 'Investment account (asset)'} *</Label>
              <Select value={invAcc} onValueChange={setInvAcc}>
                <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                <SelectContent>{investAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} — {hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'राशि' : 'Amount'} *</Label><Input type="number" min={0} value={invAmount} onChange={e => setInvAmount(e.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'} *</Label><Input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'साधन' : 'Instrument'}</Label><Input value={invInstrument} onChange={e => setInvInstrument(e.target.value)} placeholder="FDR" /></div>
              <div className="space-y-1.5"><Label>{hi ? 'संस्था' : 'Institution'}</Label><Input value={invInstitution} onChange={e => setInvInstitution(e.target.value)} placeholder={hi ? 'बैंक' : 'Bank'} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'परिपक्वता' : 'Maturity'}</Label><Input type="date" value={invMaturity} onChange={e => setInvMaturity(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'ब्याज दर (%)' : 'Rate (%)'}</Label><Input type="number" min={0} value={invRate} onChange={e => setInvRate(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'किससे भुगतान' : 'Paid from'} *</Label>
              <Select value={invMode} onValueChange={v => setInvMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {invMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={invBankId} onValueChange={setInvBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveInvest}>{hi ? 'निवेश दर्ज करें' : 'Record Investment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem dialog */}
      <Dialog open={!!redeemInv} onOpenChange={o => { if (!o) setRedeemInv(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'निवेश भुनाएँ' : 'Redeem Investment'}{redeemInv ? ` — ${redeemInv.instrument || 'FDR'}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{hi ? 'मूल राशि' : 'Principal'}: {money(redeemInv?.amount || 0)}</div>
            <div className="space-y-1.5">
              <Label>{hi ? 'परिपक्वता / प्राप्त राशि' : 'Maturity / amount received'} *</Label>
              <Input type="number" min={redeemInv?.amount || 0} value={redeemMaturity} onChange={e => setRedeemMaturity(e.target.value)} />
              <p className="text-xs text-muted-foreground">{hi ? 'ब्याज' : 'Interest'}: {money(redeemInterest)} {redeemInterest > 0 ? (hi ? '→ सीधे निधि कोष में' : '→ direct to fund corpus') : ''}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={redeemDate} onChange={e => setRedeemDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'किसमें प्राप्त' : 'Received in'} *</Label>
              <Select value={redeemMode} onValueChange={v => setRedeemMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {redeemMode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={redeemBankId} onValueChange={setRedeemBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemInv(null)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveRedeem}>{hi ? 'भुनाएँ' : 'Redeem'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Operation dialog */}
      <Dialog open={opOpen} onOpenChange={setOpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? opMeta[opType].hi : opMeta[opType].en}{fund ? ` — ${hi ? fund.nameHi : fund.name}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{hi ? 'राशि' : 'Amount'} *</Label>
              <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{opType === 'utilisation' ? (hi ? 'किससे भुगतान' : 'Paid from') : (hi ? 'किसमें प्राप्त' : 'Received in')} *</Label>
              <Select value={mode} onValueChange={v => setMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'bank' && (
              <div className="space-y-1.5">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{opType === 'utilisation' ? (hi ? 'प्रयोजन' : 'Purpose') : (hi ? 'टिप्पणी' : 'Remarks')}</Label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            {opType === 'utilisation' && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-2.5">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">{hi ? 'समिति/AGM प्रस्ताव (₹50,000 से ऊपर आवश्यक)' : 'Committee/AGM resolution (required above ₹50,000)'}</Label>
                </div>
                <div className="space-y-1.5"><Label>{hi ? 'प्रस्ताव सं.' : 'Resolution No.'}</Label><Input value={resNo} onChange={e => setResNo(e.target.value)} placeholder={hi ? 'जैसे R-12/2026' : 'e.g. R-12/2026'} /></div>
                <div className="space-y-1.5"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={resDate} onChange={e => setResDate(e.target.value)} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={saveOp}>{hi ? 'दर्ज करें' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryChip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? 'bg-primary/5 border-primary/30' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${strong ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}
