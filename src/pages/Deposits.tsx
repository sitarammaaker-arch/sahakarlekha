/**
 * Deposits register (Core for Credit/PACS) — SB / FD / RD / Pigmy.
 *
 * Slice 1: open a member deposit account and post deposits / withdrawals. Each cash
 * movement posts a voucher (Dr/Cr the 2107/2108 liability) and updates the balance +
 * sub-ledger. Interest, FD maturity, RD schedules and Pigmy daily collection are later slices.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, History, Search, Percent, Lock, ListChecks } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { sbInterest } from '@/lib/depositInterest';
import { buildRdSchedule, missedCount } from '@/lib/rdSchedule';
import { pigmyAgents, pigmyAccountsForAgent, collectionTotal } from '@/lib/pigmy';
import { useToast } from '@/hooks/use-toast';
import type { DepositType, DepositAccount } from '@/types';

const TYPE_LABELS: Record<DepositType, { hi: string; en: string }> = {
  SB: { hi: 'बचत (SB)', en: 'Savings (SB)' },
  FD: { hi: 'सावधि (FD)', en: 'Fixed (FD)' },
  RD: { hi: 'आवर्ती (RD)', en: 'Recurring (RD)' },
  PIGMY: { hi: 'पिग्मी', en: 'Pigmy' },
};

const today = () => new Date().toISOString().split('T')[0];

const Deposits: React.FC = () => {
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const { members, depositAccounts, addDepositAccount, postDepositTransaction, postDepositInterest, closeDepositAccount, getDepositTransactions } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';
  const canEdit = hasPermission(['admin', 'accountant']);
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

  const approvedMembers = useMemo(() => members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved'), [members]);
  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? id;

  const [search, setSearch] = useState('');
  const filtered = depositAccounts.filter(d =>
    d.accountNo.toLowerCase().includes(search.toLowerCase()) ||
    memberName(d.memberId).toLowerCase().includes(search.toLowerCase()),
  );
  const totalDeposits = depositAccounts.reduce((s, d) => s + d.balance, 0);
  const activeCount = depositAccounts.filter(d => d.status === 'active').length;

  // ── Open account dialog ────────────────────────────────────────────────────
  const [openNew, setOpenNew] = useState(false);
  const emptyForm = { memberId: '', depositType: 'SB' as DepositType, openDate: today(), interestRate: '', openingAmount: '', installmentAmount: '', maturityDate: '', agent: '', mode: 'cash' as 'cash' | 'bank' };
  const [form, setForm] = useState(emptyForm);
  const submitNew = () => {
    if (!form.memberId) { toast({ title: hi ? 'सदस्य चुनें' : 'Select a member', variant: 'destructive' }); return; }
    const created = addDepositAccount({
      memberId: form.memberId, depositType: form.depositType, openDate: form.openDate,
      interestRate: form.interestRate ? Number(form.interestRate) : undefined,
      installmentAmount: form.installmentAmount ? Number(form.installmentAmount) : undefined,
      maturityDate: form.maturityDate || undefined,
      agent: form.agent.trim() || undefined,
      openingAmount: form.openingAmount ? Number(form.openingAmount) : 0, mode: form.mode,
    });
    if (created) { setOpenNew(false); setForm(emptyForm); }
  };

  // ── Pigmy daily collection ─────────────────────────────────────────────────
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectAgent, setCollectAgent] = useState('');
  const [collectDate, setCollectDate] = useState(today());
  const [collectAmts, setCollectAmts] = useState<Record<string, string>>({});
  const agents = pigmyAgents(depositAccounts);
  const agentAccounts = collectAgent ? pigmyAccountsForAgent(depositAccounts, collectAgent) : [];
  const collectSum = collectionTotal(agentAccounts.map(a => collectAmts[a.id]));
  const selectAgent = (ag: string) => {
    setCollectAgent(ag);
    const pre: Record<string, string> = {};
    pigmyAccountsForAgent(depositAccounts, ag).forEach(a => { if (a.installmentAmount) pre[a.id] = String(a.installmentAmount); });
    setCollectAmts(pre);
  };
  const openCollect = () => { setCollectDate(today()); selectAgent(agents[0] || ''); setCollectOpen(true); };
  const postCollection = () => {
    let posted = 0;
    for (const a of agentAccounts) {
      const amt = Number(collectAmts[a.id]) || 0;
      if (amt > 0 && postDepositTransaction(a.id, 'deposit', amt, 'cash', collectDate)) posted++;
    }
    if (posted > 0) toast({ title: hi ? `${posted} संग्रह दर्ज` : `${posted} collections posted`, description: fmt(collectSum) });
    setCollectOpen(false);
  };

  // ── Deposit / Withdraw dialog ──────────────────────────────────────────────
  const [txnAcct, setTxnAcct] = useState<DepositAccount | null>(null);
  const [txnKind, setTxnKind] = useState<'deposit' | 'withdraw'>('deposit');
  const [txnAmt, setTxnAmt] = useState('');
  const [txnMode, setTxnMode] = useState<'cash' | 'bank'>('cash');
  const [txnDate, setTxnDate] = useState(today());
  const openTxn = (a: DepositAccount, kind: 'deposit' | 'withdraw') => { setTxnAcct(a); setTxnKind(kind); setTxnAmt(''); setTxnMode('cash'); setTxnDate(today()); };
  const submitTxn = () => {
    if (!txnAcct) return;
    const amt = Number(txnAmt) || 0;
    if (postDepositTransaction(txnAcct.id, txnKind, amt, txnMode, txnDate)) setTxnAcct(null);
  };
  const txnOverBalance = txnKind === 'withdraw' && txnAcct ? (Number(txnAmt) || 0) > txnAcct.balance : false;

  // ── Interest dialog ────────────────────────────────────────────────────────
  const [intAcct, setIntAcct] = useState<DepositAccount | null>(null);
  const [intDays, setIntDays] = useState('90');
  const [intAmt, setIntAmt] = useState('');
  const [intDate, setIntDate] = useState(today());
  const openInterest = (a: DepositAccount) => {
    setIntAcct(a); setIntDays('90'); setIntDate(today());
    setIntAmt(String(sbInterest(a.balance, a.interestRate || 0, 90)));   // quarterly suggestion
  };
  const recomputeInterest = (days: string) => {
    setIntDays(days);
    if (intAcct) setIntAmt(String(sbInterest(intAcct.balance, intAcct.interestRate || 0, Number(days) || 0)));
  };
  const submitInterest = () => {
    if (!intAcct) return;
    if (postDepositInterest(intAcct.id, Number(intAmt) || 0, intDate)) setIntAcct(null);
  };

  // ── Mature / close dialog ──────────────────────────────────────────────────
  const [closeAcct, setCloseAcct] = useState<DepositAccount | null>(null);
  const [closeMode, setCloseMode] = useState<'cash' | 'bank'>('cash');
  const [closeDate, setCloseDate] = useState(today());
  const openClose = (a: DepositAccount) => { setCloseAcct(a); setCloseMode('cash'); setCloseDate(today()); };
  const submitClose = () => { if (closeAcct && closeDepositAccount(closeAcct.id, closeMode, closeDate)) setCloseAcct(null); };
  const isTerm = (a: DepositAccount) => a.depositType === 'FD' || a.depositType === 'RD';

  // ── RD schedule dialog ─────────────────────────────────────────────────────
  const [scheduleAcct, setScheduleAcct] = useState<DepositAccount | null>(null);
  const schedule = scheduleAcct
    ? buildRdSchedule({
        openDate: scheduleAcct.openDate, installmentAmount: scheduleAcct.installmentAmount || 0,
        maturityDate: scheduleAcct.maturityDate,
        totalPaid: getDepositTransactions(scheduleAcct.id).filter(t => t.txnType === 'open' || t.txnType === 'deposit').reduce((s, t) => s + t.amount, 0),
        asOf: today(),
      })
    : [];
  const scheduleMissed = missedCount(schedule);

  // ── Transaction history dialog ─────────────────────────────────────────────
  const [historyAcct, setHistoryAcct] = useState<DepositAccount | null>(null);
  const history = historyAcct ? getDepositTransactions(historyAcct.id) : [];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-emerald-100 rounded-lg"><PiggyBank className="h-6 w-6 text-emerald-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'जमा (SB/FD/RD/पिग्मी)' : 'Deposits (SB/FD/RD/Pigmy)'}</h1>
          <p className="text-sm text-gray-500">{hi ? 'सदस्य जमा खाते — खोलें, जमा करें, निकासी करें' : 'Member deposit accounts — open, deposit, withdraw'}</p>
        </div>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            {agents.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={openCollect}><PiggyBank className="h-4 w-4" />{hi ? 'दैनिक संग्रह' : 'Daily Collection'}</Button>
            )}
            <Button className="gap-2" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" />{hi ? 'नया खाता' : 'New Account'}</Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'कुल जमा' : 'Total Deposits'}</p><p className="text-xl font-bold">{fmt(totalDeposits)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'सक्रिय खाते' : 'Active Accounts'}</p><p className="text-xl font-bold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'कुल खाते' : 'Total Accounts'}</p><p className="text-xl font-bold">{depositAccounts.length}</p></CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={hi ? 'खाता / सदस्य खोजें...' : 'Search account / member...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">{hi ? 'कोई जमा खाता नहीं।' : 'No deposit accounts yet.'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'खाता सं.' : 'Account No.'}</TableHead>
                  <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'खुला' : 'Opened'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead>{hi ? 'कार्रवाई' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{d.accountNo}</TableCell>
                    <TableCell className="font-medium">{memberName(d.memberId)}</TableCell>
                    <TableCell><Badge variant="outline">{hi ? TYPE_LABELS[d.depositType].hi : TYPE_LABELS[d.depositType].en}</Badge></TableCell>
                    <TableCell className="text-sm">{fmtDate(d.openDate)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(d.balance)}</TableCell>
                    <TableCell><Badge variant={d.status === 'active' ? 'default' : 'secondary'} className={d.status === 'active' ? 'bg-success' : ''}>{d.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && d.status === 'active' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title={hi ? 'जमा' : 'Deposit'} onClick={() => openTxn(d, 'deposit')}><ArrowDownCircle className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title={hi ? 'निकासी' : 'Withdraw'} onClick={() => openTxn(d, 'withdraw')}><ArrowUpCircle className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title={hi ? 'ब्याज जमा करें' : 'Credit interest'} onClick={() => openInterest(d)}><Percent className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" title={isTerm(d) ? (hi ? 'परिपक्व करें' : 'Mature') : (hi ? 'खाता बंद करें' : 'Close account')} onClick={() => openClose(d)}><Lock className="h-4 w-4" /></Button>
                          </>
                        )}
                        {d.depositType === 'RD' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:bg-purple-50" title={hi ? 'किस्त अनुसूची' : 'Installment schedule'} onClick={() => setScheduleAcct(d)}><ListChecks className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title={hi ? 'लेनदेन' : 'Transactions'} onClick={() => setHistoryAcct(d)}><History className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New account dialog */}
      <Dialog open={openNew} onOpenChange={o => { if (!o) setOpenNew(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'नया जमा खाता' : 'New Deposit Account'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={form.memberId} onValueChange={v => setForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>
                  {approvedMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.memberId} · {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{hi ? 'प्रकार' : 'Type'}</Label>
                <Select value={form.depositType} onValueChange={v => setForm(f => ({ ...f, depositType: v as DepositType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABELS) as DepositType[]).map(k => <SelectItem key={k} value={k}>{hi ? TYPE_LABELS[k].hi : TYPE_LABELS[k].en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{hi ? 'खुलने की तिथि' : 'Open date'}</Label>
                <Input type="date" className="mt-1" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{hi ? 'ब्याज दर % (वैकल्पिक)' : 'Interest rate % (optional)'}</Label>
                <Input type="number" className="mt-1" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">{form.depositType === 'RD' ? (hi ? 'पहली किस्त' : 'First installment') : (hi ? 'शुरुआती जमा' : 'Opening amount')}</Label>
                <Input type="number" className="mt-1" value={form.openingAmount} onChange={e => setForm(f => ({ ...f, openingAmount: e.target.value }))} placeholder="0" />
              </div>
              {(form.depositType === 'FD' || form.depositType === 'RD') && (
                <div>
                  <Label className="text-xs">{hi ? 'परिपक्वता तिथि' : 'Maturity date'}</Label>
                  <Input type="date" className="mt-1" value={form.maturityDate} onChange={e => setForm(f => ({ ...f, maturityDate: e.target.value }))} />
                </div>
              )}
              {form.depositType === 'RD' && (
                <div>
                  <Label className="text-xs">{hi ? 'मासिक किस्त' : 'Monthly installment'}</Label>
                  <Input type="number" className="mt-1" value={form.installmentAmount} onChange={e => setForm(f => ({ ...f, installmentAmount: e.target.value }))} placeholder="0" />
                </div>
              )}
              {form.depositType === 'PIGMY' && (
                <div>
                  <Label className="text-xs">{hi ? 'एजेंट (संग्राहक)' : 'Agent (collector)'}</Label>
                  <Input className="mt-1" value={form.agent} onChange={e => setForm(f => ({ ...f, agent: e.target.value }))} placeholder={hi ? 'एजेंट का नाम' : 'Agent name'} />
                </div>
              )}
            </div>
            {Number(form.openingAmount) > 0 && (
              <div>
                <Label className="text-xs">{hi ? 'भुगतान विधि' : 'Payment mode'}</Label>
                <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v as 'cash' | 'bank' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem></SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={submitNew} disabled={!form.memberId}>{hi ? 'खाता खोलें' : 'Open Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit / Withdraw dialog */}
      <Dialog open={!!txnAcct} onOpenChange={o => { if (!o) setTxnAcct(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{txnKind === 'deposit' ? (hi ? 'जमा' : 'Deposit') : (hi ? 'निकासी' : 'Withdraw')} — {txnAcct?.accountNo}</DialogTitle></DialogHeader>
          {txnAcct && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{hi ? 'वर्तमान शेष:' : 'Current balance:'} <strong>{fmt(txnAcct.balance)}</strong></p>
              <div>
                <Label className="text-xs">{hi ? 'राशि' : 'Amount'}</Label>
                <Input type="number" className="mt-1" value={txnAmt} onChange={e => setTxnAmt(e.target.value)} {...(txnKind === 'withdraw' ? { max: txnAcct.balance } : {})} />
                {txnOverBalance && <p className="text-[11px] text-destructive mt-1">{hi ? 'निकासी शेष से ज़्यादा नहीं हो सकती' : 'Withdrawal cannot exceed balance'}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{hi ? 'विधि' : 'Mode'}</Label>
                  <Select value={txnMode} onValueChange={v => setTxnMode(v as 'cash' | 'bank')}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                  <Input type="date" className="mt-1" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnAcct(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button disabled={!(Number(txnAmt) > 0) || txnOverBalance} onClick={submitTxn}>{hi ? 'दर्ज करें' : 'Post'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interest dialog */}
      <Dialog open={!!intAcct} onOpenChange={o => { if (!o) setIntAcct(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'ब्याज जमा' : 'Credit Interest'} — {intAcct?.accountNo}</DialogTitle></DialogHeader>
          {intAcct && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{hi ? 'शेष:' : 'Balance:'} <strong>{fmt(intAcct.balance)}</strong> · {hi ? 'दर' : 'Rate'} {intAcct.interestRate ?? 0}% p.a.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{hi ? 'अवधि (दिन)' : 'Period (days)'}</Label>
                  <Input type="number" className="mt-1" value={intDays} onChange={e => recomputeInterest(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                  <Input type="date" className="mt-1" value={intDate} onChange={e => setIntDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{hi ? 'ब्याज राशि (गणना — बदल सकते हैं)' : 'Interest amount (computed — editable)'}</Label>
                <Input type="number" className="mt-1" value={intAmt} onChange={e => setIntAmt(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'Dr ब्याज व्यय (5604) / Cr जमा — शेष में जुड़ेगा।' : 'Dr Interest expense (5604) / Cr deposit — added to the balance.'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntAcct(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button disabled={!(Number(intAmt) > 0)} onClick={submitInterest}>{hi ? 'जमा करें' : 'Credit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mature / close dialog */}
      <Dialog open={!!closeAcct} onOpenChange={o => { if (!o) setCloseAcct(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{closeAcct && isTerm(closeAcct) ? (hi ? 'जमा परिपक्व करें' : 'Mature Deposit') : (hi ? 'खाता बंद करें' : 'Close Account')} — {closeAcct?.accountNo}</DialogTitle></DialogHeader>
          {closeAcct && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{hi ? 'भुगतान राशि (शेष):' : 'Payout (balance):'} <strong>{fmt(closeAcct.balance)}</strong></p>
              {closeAcct.balance > 0 && (
                <div>
                  <Label className="text-xs">{hi ? 'भुगतान विधि' : 'Payout mode'}</Label>
                  <Select value={closeMode} onValueChange={v => setCloseMode(v as 'cash' | 'bank')}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                <Input type="date" className="mt-1" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">{closeAcct.balance > 0 ? (hi ? 'Dr जमा / Cr नकद-बैंक — पूरा शेष भुगतान होगा, खाता ' : 'Dr deposit / Cr Cash-Bank — full balance paid out, account ') : (hi ? 'खाता ' : 'Account ')}{isTerm(closeAcct) ? (hi ? 'परिपक्व' : 'matured') : (hi ? 'बंद' : 'closed')}.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseAcct(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={submitClose}>{closeAcct && isTerm(closeAcct) ? (hi ? 'परिपक्व करें' : 'Mature') : (hi ? 'बंद करें' : 'Close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pigmy daily collection dialog */}
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'पिग्मी दैनिक संग्रह' : 'Pigmy Daily Collection'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{hi ? 'एजेंट' : 'Agent'}</Label>
                <Select value={collectAgent} onValueChange={selectAgent}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                <Input type="date" className="mt-1" value={collectDate} onChange={e => setCollectDate(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[45vh] overflow-y-auto border rounded-md">
              {agentAccounts.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">{hi ? 'इस एजेंट का कोई पिग्मी खाता नहीं।' : 'No pigmy accounts for this agent.'}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'खाता' : 'Account'}</TableHead>
                    <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                    <TableHead className="text-right w-28">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {agentAccounts.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.accountNo}</TableCell>
                        <TableCell className="text-sm">{memberName(a.memberId)}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="h-8 w-24 ml-auto" value={collectAmts[a.id] ?? ''} onChange={e => setCollectAmts(m => ({ ...m, [a.id]: e.target.value }))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <p className="text-sm text-right">{hi ? 'कुल' : 'Total'}: <strong>{fmt(collectSum)}</strong></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button disabled={!(collectSum > 0)} onClick={postCollection}>{hi ? 'संग्रह दर्ज करें' : 'Post Collection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RD installment schedule dialog */}
      <Dialog open={!!scheduleAcct} onOpenChange={o => { if (!o) setScheduleAcct(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'किस्त अनुसूची' : 'Installment Schedule'} — {scheduleAcct?.accountNo}</DialogTitle></DialogHeader>
          {scheduleMissed > 0 && (
            <p className="text-sm text-destructive font-medium">{scheduleMissed} {hi ? 'किस्त छूटी' : 'installment(s) missed'}</p>
          )}
          <div className="max-h-[60vh] overflow-y-auto">
            {schedule.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{hi ? 'अनुसूची नहीं — परिपक्वता तिथि व मासिक किस्त सेट करें।' : 'No schedule — set maturity date & monthly installment.'}</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{hi ? 'देय तिथि' : 'Due date'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {schedule.map(s => (
                    <TableRow key={s.installmentNo}>
                      <TableCell>{s.installmentNo}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.dueDate)}</TableCell>
                      <TableCell className="text-right">{fmt(s.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={s.status === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : s.status === 'missed' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
                          {s.status === 'paid' ? (hi ? 'भुगतान' : 'Paid') : s.status === 'missed' ? (hi ? 'छूटी' : 'Missed') : (hi ? 'देय' : 'Due')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction history dialog */}
      <Dialog open={!!historyAcct} onOpenChange={o => { if (!o) setHistoryAcct(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{hi ? 'लेनदेन' : 'Transactions'} — {historyAcct?.accountNo}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {history.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{hi ? 'कोई लेनदेन नहीं।' : 'No transactions.'}</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {history.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{fmtDate(t.date)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{t.txnType}</Badge></TableCell>
                      <TableCell className={`text-right ${t.txnType === 'withdraw' ? 'text-amber-600' : 'text-emerald-600'}`}>{t.txnType === 'withdraw' ? '−' : '+'}{fmt(t.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(t.balanceAfter)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deposits;
