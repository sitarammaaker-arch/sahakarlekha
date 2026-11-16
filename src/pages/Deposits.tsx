/**
 * Deposits register (Core for Credit/PACS) — SB / FD / RD / Pigmy.
 *
 * Slice 1: open a member deposit account and post deposits / withdrawals. Each cash
 * movement posts a voucher (Dr/Cr the 2107/2108 liability) and updates the balance +
 * sub-ledger. Interest, FD maturity, RD schedules and Pigmy daily collection are later slices.
 *
 * Compulsory (thrift) deposit — type CD: one account per member with a monthly contribution, its own liability
 * head, a monthly collection sheet for all members at once, arrears, and no withdrawal until the account is closed.
 * Offered only where the chart has the compulsory-deposit head (a Thrift & Credit chart ships it).
 *
 * Monthly recovery list (same societies): compulsory deposit + loan instalment + loan interest each member owes for
 * a month, as one sheet for the employer who deducts it from salary. The list itself is a demand and posts nothing
 * (lib/recoveryList.ts). Its "record recovery" step books the money actually received for everyone at once, through
 * the same two routines the single-member screens use: postDepositTransaction and the shared loan repayment.
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
import { PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, History, Search, Percent, Lock, ListChecks, Download, FileSpreadsheet, CalendarCheck, ClipboardList } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { sbInterest } from '@/lib/depositInterest';
import { asDayCount } from '@/lib/interestDayCount';
import { buildRdSchedule, missedCount } from '@/lib/rdSchedule';
import { pigmyAgents, pigmyAccountsForAgent, collectionTotal } from '@/lib/pigmy';
import { compulsoryAccounts, collectionSheet, compulsoryArrears, monthOf } from '@/lib/compulsoryDeposit';
import { resolveDepositLiabilityAccount, allowsWithdrawal } from '@/lib/depositEngine';
import { recoveryRows, recoveryItems, recoveryListTable, recoveryTotals, recoveryPostPlan, recoveryEntryProblems, defaultRecoveryEntries, monthLabel, type RecoveryEntry } from '@/lib/recoveryList';
import { useLoanRepayment } from '@/hooks/useLoanRepayment';
import { loanInterestDue } from '@/lib/loans/interestAccrual';
import { useLoanAccruals } from '@/hooks/useLoanAccruals';
import { useToast } from '@/hooks/use-toast';
import type { DepositType, DepositAccount } from '@/types';
import EntityExportButton from '@/components/export/EntityExportButton';
import EmptyState from '@/components/EmptyState';
import { LedgerDialog } from '@/components/registers/LedgerDialog';
import { depositLedger } from '@/lib/registers/subsidiaryLedgers';
import { depositLedgerTable } from '@/lib/registers/ledgerTables';
import { ledgerExcel, ledgerPdf } from '@/lib/registers/ledgerExport';
import { useOpenOnNew } from '@/hooks/useOpenOnNew';
import { canHoldShares } from '@/lib/members/shareRules';

const TYPE_LABELS: Record<DepositType, { hi: string; en: string }> = {
  SB: { hi: 'बचत (SB)', en: 'Savings (SB)' },
  FD: { hi: 'सावधि (FD)', en: 'Fixed (FD)' },
  RD: { hi: 'आवर्ती (RD)', en: 'Recurring (RD)' },
  PIGMY: { hi: 'पिग्मी', en: 'Pigmy' },
  CD: { hi: 'अनिवार्य जमा (CD)', en: 'Compulsory (CD)' },
};

const today = () => new Date().toISOString().split('T')[0];

const Deposits: React.FC = () => {
  const { language } = useLanguage();
  const { can } = useAuth();
  const { members, accounts, loans, depositAccounts, depositTransactions, addDepositAccount, postDepositTransaction, postDepositInterest, closeDepositAccount, getDepositTransactions, vouchers, society } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';
  // ECR-06 17-role: RBAC permission gate, not a hardcoded legacy list. `update` (not `create`)
  // keeps the auditor family — whose `create` is audit-objection-scoped — read-only here;
  // byte-identical for the 4 legacy roles, opens edit to operational roles (delete fail-closes
  // at the data layer).
  const canEdit = can('update');
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
  // The compulsory deposit is offered only where the chart has its liability head — elsewhere it could not post.
  const hasCdHead = useMemo(() => !!resolveDepositLiabilityAccount('CD', accounts), [accounts]);
  const typeOptions = (Object.keys(TYPE_LABELS) as DepositType[]).filter(k => k !== 'CD' || hasCdHead);
  const cdAccounts = compulsoryAccounts(depositAccounts);
  const cdTotal = cdAccounts.reduce((s, d) => s + d.balance, 0);
  const cdArrearsOf = (d: DepositAccount) => compulsoryArrears(d, depositTransactions, today());

  // ── Open account dialog ────────────────────────────────────────────────────
  const [openNew, setOpenNew] = useState(false);
  useOpenOnNew(() => setOpenNew(true), canEdit);   // ＋ नई entry → जमा खाता (same gate as the button)
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

  // ── Compulsory deposit — monthly collection for every member at once ───────
  const [cdOpen, setCdOpen] = useState(false);
  const [cdDate, setCdDate] = useState(today());
  const [cdMode, setCdMode] = useState<'cash' | 'bank'>('cash');
  const [cdAmts, setCdAmts] = useState<Record<string, string>>({});
  const cdRows = collectionSheet(depositAccounts, depositTransactions, cdDate);
  const cdSum = collectionTotal(cdRows.map(r => cdAmts[r.account.id]));
  // Pre-fill what each member still owes for the month of `date`; a member who has paid gets a blank.
  const fillCd = (date: string) => {
    const pre: Record<string, string> = {};
    collectionSheet(depositAccounts, depositTransactions, date).forEach(r => { if (r.suggested > 0) pre[r.account.id] = String(r.suggested); });
    setCdAmts(pre);
  };
  const openCd = () => { const d = today(); setCdDate(d); setCdMode('cash'); fillCd(d); setCdOpen(true); };
  const changeCdDate = (d: string) => { setCdDate(d); if (monthOf(d) !== monthOf(cdDate)) fillCd(d); };
  const postCd = () => {
    let posted = 0, total = 0;
    for (const r of cdRows) {
      const amt = Number(cdAmts[r.account.id]) || 0;
      if (amt > 0 && postDepositTransaction(r.account.id, 'deposit', amt, cdMode, cdDate)) { posted++; total += amt; }
    }
    // Say only what really posted — a blocked voucher (locked period) must not read as a success.
    if (posted > 0) toast({ title: hi ? `${posted} सदस्यों की अनिवार्य जमा दर्ज` : `Compulsory deposit posted for ${posted} member(s)`, description: fmt(total) });
    if (posted > 0) setCdOpen(false);
  };

  // ── Monthly recovery list (a demand sheet — posts nothing) ─────────────────
  const { accruals } = useLoanAccruals();
  const [rlOpen, setRlOpen] = useState(false);
  const [rlMonth, setRlMonth] = useState(monthOf(today()));
  const rlRows = useMemo(() => (rlOpen && /^\d{4}-\d{2}$/.test(rlMonth)
    ? recoveryRows({ month: rlMonth, depositAccounts, depositTransactions, loans, interestDueOf: id => loanInterestDue(id, accruals, vouchers).receivable })
    : []), [rlOpen, rlMonth, depositAccounts, depositTransactions, loans, accruals, vouchers]);
  const rlTable = recoveryListTable(rlRows, /^\d{4}-\d{2}$/.test(rlMonth) ? rlMonth : monthOf(today()),
    id => { const m = members.find(x => x.id === id); return { memberNo: m?.memberId ?? '', name: m?.name ?? id }; });
  const rlTotals = recoveryTotals(rlRows);
  // Record the recovery: book what was actually received, for every member on the list, in one step.
  const recordRepayment = useLoanRepayment(id => loanInterestDue(id, accruals, vouchers));
  const rlItems = useMemo(() => (rlOpen && /^\d{4}-\d{2}$/.test(rlMonth)
    ? recoveryItems({ month: rlMonth, depositAccounts, depositTransactions, loans, interestDueOf: id => loanInterestDue(id, accruals, vouchers).receivable })
    : []), [rlOpen, rlMonth, depositAccounts, depositTransactions, loans, accruals, vouchers]);
  const [rlPosting, setRlPosting] = useState(false);
  const [rlEntries, setRlEntries] = useState<Record<string, RecoveryEntry>>({});
  const [rlDate, setRlDate] = useState(today());
  const [rlMode, setRlMode] = useState<'cash' | 'bank'>('bank');
  const startRlPosting = () => { setRlEntries(defaultRecoveryEntries(rlItems)); setRlDate(today()); setRlMode('bank'); setRlPosting(true); };
  const setRlEntry = (key: string, field: keyof RecoveryEntry, value: string) => setRlEntries(m => ({ ...m, [key]: { ...m[key], [field]: value } }));
  const rlPlan = recoveryPostPlan(rlItems, rlEntries);
  const postRecovery = () => {
    // Stop before posting anything if a figure cannot go through — never leave half a batch posted over a typo.
    const over = recoveryEntryProblems(rlItems, rlEntries, id => { const l = loans.find(x => x.id === id); return l ? l.amount - l.repaidAmount : 0; });
    if (over.length > 0) {
      toast({ title: hi ? 'मूलधन बकाया से ज़्यादा है' : 'Principal exceeds the outstanding', description: hi ? `ऋण ${over.join(', ')}: मूलधन की रकम बकाया से ज़्यादा भरी है। उसे घटाएँ, या अतिरिक्त रकम ब्याज में लिखें। कुछ भी दर्ज नहीं हुआ।` : `Loan ${over.join(', ')}: the principal entered is more than the outstanding. Reduce it, or enter the extra as interest. Nothing was posted.`, variant: 'destructive', duration: 12000 });
      return;
    }
    let done = 0, amount = 0;
    const failedLabels: string[] = [];
    const labelOf = (key: string) => rlItems.find(i => i.key === key)?.label ?? key;
    for (const a of rlPlan.actions) {
      if (a.kind === 'cd') {
        if (postDepositTransaction(a.depositAccountId, 'deposit', a.amount, rlMode, rlDate)) { done++; amount += a.amount; } else failedLabels.push(labelOf(a.key));
      } else {
        const loan = loans.find(l => l.id === a.loanId);
        if (loan && recordRepayment(loan, a.total, a.interest, rlMode, rlDate, { silent: true })) { done++; amount += a.total; } else failedLabels.push(labelOf(a.key));
      }
    }
    const failed = failedLabels.length;
    // Say only what really posted, and name what did not (only one message shows at a time, so name them here).
    if (done > 0) toast({ title: hi ? `✅ ${done} एंट्री दर्ज` : `✅ ${done} entr${done === 1 ? 'y' : 'ies'} posted`, description: fmt(Math.round(amount * 100) / 100) });
    if (failed > 0) toast({ title: hi ? `${failed} एंट्री दर्ज नहीं हुई` : `${failed} entr${failed === 1 ? 'y was' : 'ies were'} NOT posted`, description: hi ? `${failedLabels.join(', ')} — इनकी एंट्री नहीं बनी (आम कारण: वित्तीय वर्ष या अवधि लॉक, या तिथि खुले वर्ष से बाहर)। ये रकमें सूची में अब भी देय दिखेंगी; कारण ठीक करके दोबारा दर्ज करें।` : `${failedLabels.join(', ')} — no entry was made for these (usual cause: the financial year or period is locked, or the date is outside the open year). They still show as due in the list; fix the cause and post again.`, variant: 'destructive', duration: 15000 });
    if (done > 0) setRlPosting(false);
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
    setIntAmt(String(sbInterest(a.balance, a.interestRate || 0, 90, asDayCount(society.interestDayCount), today())));   // quarterly suggestion
  };
  const recomputeInterest = (days: string) => {
    setIntDays(days);
    if (intAcct) setIntAmt(String(sbInterest(intAcct.balance, intAcct.interestRate || 0, Number(days) || 0, asDayCount(society.interestDayCount), intDate)));
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
  // Deposit Ledger: the same deposit_transactions the old history list showed, as a ledger with
  // Cr / Dr / balance and PDF / Excel of exactly those rows.
  const voucherNoOf = (id?: string) => (id ? vouchers.find(v => v.id === id)?.voucherNo ?? '' : '');
  const ledgerTableOf = (d: DepositAccount) => depositLedgerTable(depositLedger(getDepositTransactions(d.id), voucherNoOf),
    { accountNo: d.accountNo, memberName: memberName(d.memberId), type: TYPE_LABELS[d.depositType].en });
  const historyTable = historyAcct ? ledgerTableOf(historyAcct) : null;
  const allLedgers = () => [...depositAccounts].sort((a, b) => a.accountNo.localeCompare(b.accountNo)).map(ledgerTableOf);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-emerald-100 rounded-lg"><PiggyBank className="h-6 w-6 text-emerald-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'जमा (SB/FD/RD/पिग्मी)' : 'Deposits (SB/FD/RD/Pigmy)'}</h1>
          <p className="text-sm text-gray-500">{hi ? 'सदस्य जमा खाते — खोलें, जमा करें, निकासी करें' : 'Member deposit accounts — open, deposit, withdraw'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {/*
            T-18: this register had no export at all (audit gap EXP-10). One line, and the
            Export Registry decides the rest — whether this user may export it, which
            columns, and whether the audit row was written before any bytes left.
            Deliberately OUTSIDE `canEdit`: a viewer may export what a viewer may see.
          */}
          <EntityExportButton entityKey="deposit_account" />
          {/* Read-only sheet, so like the exports it sits outside `canEdit`. Shown where the compulsory deposit exists. */}
          {hasCdHead && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setRlMonth(monthOf(today())); setRlPosting(false); setRlOpen(true); }}><ClipboardList className="h-4 w-4" />{hi ? 'मासिक वसूली सूची' : 'Monthly Recovery List'}</Button>
          )}
          {depositAccounts.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => ledgerPdf(society, allLedgers(), 'DPL', 'Deposit_Ledger')}><Download className="h-4 w-4" />{hi ? 'खाता-बही PDF' : 'Ledger PDF'}</Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => ledgerExcel(allLedgers(), 'Deposit_Ledger', 'Deposit Ledger')}><FileSpreadsheet className="h-4 w-4" />{hi ? 'खाता-बही Excel' : 'Ledger Excel'}</Button>
            </>
          )}
          {canEdit && (
            <>
              {agents.length > 0 && (
                <Button variant="outline" className="gap-2" onClick={openCollect}><PiggyBank className="h-4 w-4" />{hi ? 'दैनिक संग्रह' : 'Daily Collection'}</Button>
              )}
              {cdAccounts.length > 0 && (
                <Button variant="outline" className="gap-2" onClick={openCd}><CalendarCheck className="h-4 w-4" />{hi ? 'मासिक अनिवार्य जमा' : 'Monthly Compulsory Deposit'}</Button>
              )}
              <Button className="gap-2" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" />{hi ? 'नया खाता' : 'New Account'}</Button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'कुल जमा' : 'Total Deposits'}</p><p className="text-xl font-bold">{fmt(totalDeposits)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'सक्रिय खाते' : 'Active Accounts'}</p><p className="text-xl font-bold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'कुल खाते' : 'Total Accounts'}</p><p className="text-xl font-bold">{depositAccounts.length}</p></CardContent></Card>
        {cdAccounts.length > 0 && (
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? `अनिवार्य जमा (${cdAccounts.length} सदस्य)` : `Compulsory deposit (${cdAccounts.length} members)`}</p><p className="text-xl font-bold">{fmt(cdTotal)}</p></CardContent></Card>
        )}
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
            depositAccounts.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title={hi ? 'अभी कोई जमा खाता नहीं' : 'No deposit accounts yet'}
                description={hi ? 'सदस्यों के SB/FD/RD/पिग्मी खाते यहाँ दिखेंगे। पहला खाता खोलकर शुरू करें।' : "Members' SB/FD/RD/Pigmy accounts appear here. Open the first one to begin."}
                actionLabel={canEdit ? (hi ? 'नया खाता खोलें' : 'Open first account') : undefined}
                onAction={canEdit ? () => setOpenNew(true) : undefined}
              />
            ) : (
              <p className="p-8 text-center text-gray-500 text-sm">{hi ? 'खोज से कोई खाता नहीं मिला।' : 'No accounts match your search.'}</p>
            )
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
                    <TableCell>
                      <Badge variant="outline">{hi ? TYPE_LABELS[d.depositType].hi : TYPE_LABELS[d.depositType].en}</Badge>
                      {d.depositType === 'CD' && d.status === 'active' && cdArrearsOf(d).arrears > 0 && (
                        <Badge variant="outline" className="ml-1 bg-red-100 text-red-800 border-red-300">{hi ? 'बकाया' : 'Arrears'} {fmt(cdArrearsOf(d).arrears)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(d.openDate)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(d.balance)}</TableCell>
                    <TableCell><Badge variant={d.status === 'active' ? 'default' : 'secondary'} className={d.status === 'active' ? 'bg-success' : ''}>{d.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && d.status === 'active' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title={hi ? 'जमा' : 'Deposit'} onClick={() => openTxn(d, 'deposit')}><ArrowDownCircle className="h-4 w-4" /></Button>
                            {allowsWithdrawal(d.depositType, society.compulsoryDepositWithdrawal === true) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title={hi ? 'निकासी' : 'Withdraw'} onClick={() => openTxn(d, 'withdraw')}><ArrowUpCircle className="h-4 w-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title={hi ? 'ब्याज जमा करें' : 'Credit interest'} onClick={() => openInterest(d)}><Percent className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" title={isTerm(d) ? (hi ? 'परिपक्व करें' : 'Mature') : d.depositType === 'CD' ? (hi ? 'खाता बंद करें — पूरी जमा वापस' : 'Close account — pay the whole deposit back') : (hi ? 'खाता बंद करें' : 'Close account')} onClick={() => openClose(d)}><Lock className="h-4 w-4" /></Button>
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
                  {approvedMembers.filter(canHoldShares).map(m => <SelectItem key={m.id} value={m.id}>{m.memberId} · {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{hi ? 'प्रकार' : 'Type'}</Label>
                <Select value={form.depositType} onValueChange={v => setForm(f => ({ ...f, depositType: v as DepositType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{typeOptions.map(k => <SelectItem key={k} value={k}>{hi ? TYPE_LABELS[k].hi : TYPE_LABELS[k].en}</SelectItem>)}</SelectContent>
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
              {(form.depositType === 'RD' || form.depositType === 'CD') && (
                <div>
                  <Label className="text-xs">{form.depositType === 'CD' ? (hi ? 'मासिक अंशदान' : 'Monthly contribution') : (hi ? 'मासिक किस्त' : 'Monthly installment')}</Label>
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
            {form.depositType === 'CD' && (
              <p className="text-[11px] text-muted-foreground">{society.compulsoryDepositWithdrawal === true
                ? (hi ? 'हर सदस्य का एक ही अनिवार्य जमा खाता होता है। इस समिति में बीच में निकासी चालू है (समिति सेटअप)। मासिक अंशदान उपविधि के अनुसार भरें।' : 'A member has one compulsory deposit account. Withdrawals are on for this society (Society Setup). Enter the monthly contribution your bye-laws set.')
                : (hi ? 'हर सदस्य का एक ही अनिवार्य जमा खाता होता है। बीच में निकासी नहीं होती — खाता बंद करने पर पूरी राशि लौटती है। मासिक अंशदान उपविधि के अनुसार भरें।' : 'A member has one compulsory deposit account. There are no withdrawals — the whole balance is paid back when the account is closed. Enter the monthly contribution your bye-laws set.')}</p>
            )}
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

      {/* Compulsory deposit — monthly collection dialog */}
      <Dialog open={cdOpen} onOpenChange={setCdOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{hi ? 'मासिक अनिवार्य जमा संग्रह' : 'Monthly Compulsory Deposit Collection'}</DialogTitle></DialogHeader>
          {/* min-w-0: a grid child otherwise grows to the table's width and the dialog scrolls sideways on a phone. */}
          <div className="space-y-3 min-w-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                <Input type="date" className="mt-1" value={cdDate} onChange={e => changeCdDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{hi ? 'विधि' : 'Mode'}</Label>
                <Select value={cdMode} onValueChange={v => setCdMode(v as 'cash' | 'bank')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="max-h-[45vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="px-2">{hi ? 'सदस्य' : 'Member'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'इस माह जमा' : 'Paid this month'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'कुल बकाया' : 'Total arrears'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'अब जमा' : 'Collect now'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cdRows.map(r => (
                    <TableRow key={r.account.id}>
                      <TableCell className="px-2 text-sm">
                        <div className="font-medium">{memberName(r.account.memberId)}</div>
                        <div className="text-[11px] text-muted-foreground"><span className="font-mono">{r.account.accountNo}</span> · {hi ? 'मासिक' : 'monthly'} {r.monthly > 0 ? fmt(r.monthly) : '—'}</div>
                      </TableCell>
                      <TableCell className="px-2 text-right text-sm">{r.paidThisMonth > 0 ? fmt(r.paidThisMonth) : '—'}</TableCell>
                      <TableCell className={`px-2 text-right text-sm ${r.arrears > 0 ? 'text-destructive font-medium' : ''}`}>{r.arrears > 0 ? fmt(r.arrears) : '—'}</TableCell>
                      <TableCell className="px-2 text-right">
                        <Input type="number" className="h-8 w-20 ml-auto" value={cdAmts[r.account.id] ?? ''} onChange={e => setCdAmts(m => ({ ...m, [r.account.id]: e.target.value }))} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground">{hi ? 'जिस सदस्य ने इस माह का अंशदान दे दिया है उसका खाना खाली रहता है। हर सदस्य का अलग वाउचर बनता है: Dr नकद/बैंक, Cr अनिवार्य जमा।' : 'A member who has already paid this month is left blank. One voucher is made per member: Dr Cash/Bank, Cr compulsory deposit.'}</p>
            <p className="text-sm text-right">{hi ? 'कुल' : 'Total'}: <strong>{fmt(cdSum)}</strong></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCdOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button disabled={!(cdSum > 0)} onClick={postCd}>{hi ? 'संग्रह दर्ज करें' : 'Post Collection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly recovery list dialog */}
      <Dialog open={rlOpen} onOpenChange={setRlOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>{hi ? 'मासिक वसूली सूची' : 'Monthly Recovery List'} — {monthLabel(/^\d{4}-\d{2}$/.test(rlMonth) ? rlMonth : monthOf(today()), hi)}</DialogTitle></DialogHeader>
          {rlPosting ? (
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-muted-foreground">{hi ? 'जो रकम सच में मिली है वही भरें। जिस खाने में कुछ नहीं मिला उसे खाली या 0 कर दें — उसकी कोई एंट्री नहीं बनेगी।' : 'Enter what was actually received. Leave a box blank or 0 where nothing came in — no entry is made for it.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{hi ? 'प्राप्ति की तिथि' : 'Date received'}</Label>
                <Input type="date" className="mt-1" value={rlDate} onChange={e => setRlDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{hi ? 'विधि' : 'Mode'}</Label>
                <Select value={rlMode} onValueChange={v => setRlMode(v as 'cash' | 'bank')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="max-h-[45vh] overflow-auto border rounded-md">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="px-2">{hi ? 'सदस्य' : 'Member'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'अनिवार्य जमा' : 'Compulsory deposit'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'ऋण मूलधन' : 'Loan principal'}</TableHead>
                  <TableHead className="px-2 text-right">{hi ? 'ऋण ब्याज' : 'Loan interest'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rlItems.map(it => (
                    <TableRow key={it.key}>
                      <TableCell className="px-2 text-sm">
                        <div className="font-medium">{memberName(it.memberId)}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{it.label}</div>
                      </TableCell>
                      <TableCell className="px-2 text-right">
                        {it.kind === 'cd' && <Input type="number" min="0" className="h-8 w-24 ml-auto" value={rlEntries[it.key]?.deposit ?? ''} onChange={e => setRlEntry(it.key, 'deposit', e.target.value)} />}
                      </TableCell>
                      <TableCell className="px-2 text-right">
                        {it.kind === 'loan' && <Input type="number" min="0" className="h-8 w-24 ml-auto" value={rlEntries[it.key]?.principal ?? ''} onChange={e => setRlEntry(it.key, 'principal', e.target.value)} />}
                      </TableCell>
                      <TableCell className="px-2 text-right">
                        {it.kind === 'loan' && <Input type="number" min="0" className="h-8 w-24 ml-auto" value={rlEntries[it.key]?.interest ?? ''} onChange={e => setRlEntry(it.key, 'interest', e.target.value)} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground">{hi ? 'हर अनिवार्य जमा की एक रसीद (Dr नकद/बैंक, Cr अनिवार्य जमा) और हर ऋण की एक रसीद (Dr नकद/बैंक, Cr ऋण व ब्याज) बनती है — वही एंट्री जो "मासिक अनिवार्य जमा" और "ऋण रजिस्टर" से बनती है।' : 'One receipt per compulsory deposit (Dr Cash/Bank, Cr compulsory deposit) and one per loan (Dr Cash/Bank, Cr loan and interest) — the same entries the monthly collection and the Loan Register make.'}</p>
            <p className="text-sm text-right">{rlPlan.actions.length} {hi ? 'एंट्री' : 'entries'} · {hi ? 'कुल' : 'Total'}: <strong>{fmt(rlPlan.total)}</strong></p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRlPosting(false)}>{hi ? 'वापस सूची पर' : 'Back to the list'}</Button>
              <Button disabled={rlPlan.actions.length === 0 || !rlDate} onClick={postRecovery}>{hi ? 'वसूली दर्ज करें' : 'Post recovery'}</Button>
            </DialogFooter>
          </div>
          ) : (
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">{hi ? 'माह' : 'Month'}</Label>
                <Input type="month" className="mt-1 w-44" value={rlMonth} onChange={e => setRlMonth(e.target.value)} />
              </div>
              {rlRows.length > 0 && (
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => ledgerPdf(society, [rlTable], 'RCL', `Recovery_List_${rlMonth}`)}><Download className="h-4 w-4" />PDF</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => ledgerExcel([rlTable], `Recovery_List_${rlMonth}`, 'Recovery List')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
                  {canEdit && <Button size="sm" className="gap-1" onClick={startRlPosting}><ArrowDownCircle className="h-4 w-4" />{hi ? 'वसूली दर्ज करें' : 'Record recovery'}</Button>}
                </div>
              )}
            </div>
            <div className="max-h-[50vh] overflow-auto border rounded-md">
              {rlRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{hi ? 'इस माह किसी सदस्य पर कुछ देय नहीं है।' : 'No member owes anything for this month.'}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    {rlTable.columns.map((c, i) => <TableHead key={i} className={`px-2 ${c.num ? 'text-right' : ''}`}>{hi ? c.hi : c.en}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    {rlTable.rowsEn.map((r, i) => (
                      <TableRow key={i}>
                        {r.map((v, j) => <TableCell key={j} className={`px-2 text-sm ${rlTable.columns[j].num ? 'text-right' : ''} ${j === r.length - 1 ? 'font-semibold' : ''}`}>{typeof v === 'number' && rlTable.columns[j].num ? (v > 0 ? fmt(v) : '—') : v}</TableCell>)}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="px-2" colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                      <TableCell className="px-2 text-right">{fmt(rlTotals.compulsoryDeposit)}</TableCell>
                      <TableCell className="px-2 text-right">{fmt(rlTotals.loanPrincipal)}</TableCell>
                      <TableCell className="px-2 text-right">{fmt(rlTotals.loanInterest)}</TableCell>
                      <TableCell className="px-2 text-right">{fmt(rlTotals.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
            <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
              {rlTable.notes.map((n, i) => <li key={i}>{hi ? n.hi : n.en}</li>)}
            </ul>
          </div>
          )}
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

      {/* Deposit Ledger (was: transaction history) */}
      <LedgerDialog table={historyTable} hi={hi} onClose={() => setHistoryAcct(null)}
        onPdf={() => historyTable && ledgerPdf(society, [historyTable], 'DPL', `Deposit_Ledger_${historyAcct?.accountNo ?? ''}`)}
        onExcel={() => historyTable && ledgerExcel([historyTable], `Deposit_Ledger_${historyAcct?.accountNo ?? ''}`, 'Deposit Ledger')} />
    </div>
  );
};

export default Deposits;
