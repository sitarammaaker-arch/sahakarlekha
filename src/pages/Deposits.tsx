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
import { PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, History, Search } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
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
  const { members, depositAccounts, addDepositAccount, postDepositTransaction, getDepositTransactions } = useData();
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
  const [form, setForm] = useState({ memberId: '', depositType: 'SB' as DepositType, openDate: today(), interestRate: '', openingAmount: '', mode: 'cash' as 'cash' | 'bank' });
  const submitNew = () => {
    if (!form.memberId) { toast({ title: hi ? 'सदस्य चुनें' : 'Select a member', variant: 'destructive' }); return; }
    const created = addDepositAccount({
      memberId: form.memberId, depositType: form.depositType, openDate: form.openDate,
      interestRate: form.interestRate ? Number(form.interestRate) : undefined,
      openingAmount: form.openingAmount ? Number(form.openingAmount) : 0, mode: form.mode,
    });
    if (created) { setOpenNew(false); setForm({ memberId: '', depositType: 'SB', openDate: today(), interestRate: '', openingAmount: '', mode: 'cash' }); }
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
          <Button className="ml-auto gap-2" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" />{hi ? 'नया खाता' : 'New Account'}</Button>
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
                          </>
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
                <Label className="text-xs">{hi ? 'शुरुआती जमा' : 'Opening amount'}</Label>
                <Input type="number" className="mt-1" value={form.openingAmount} onChange={e => setForm(f => ({ ...f, openingAmount: e.target.value }))} placeholder="0" />
              </div>
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
