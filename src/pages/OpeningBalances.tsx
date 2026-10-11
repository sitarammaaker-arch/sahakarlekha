import { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, ArrowRight, FileSpreadsheet, Download } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { carryForwardOpenings, earlierYearVoucherCount, openingTotals, openingWarnings } from '@/lib/openingBalances';
import { fyStartFromLabel } from '@/lib/fyPeriod';
import { accountCode } from '@/lib/accountCode';
import { accountDisplayName } from '@/lib/accountName';
import { QuickCreateMaster, allowedQuickKinds } from '@/components/QuickCreateMaster';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Lock, Info } from 'lucide-react';

interface ObEntry { accountId: string; amount: number; type: 'debit' | 'credit' }

const fmt = (n: number) => n.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OpeningBalances() {
  const { accounts, vouchers, society, updateAccount } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  // Initialize from accounts (Supabase-primary — openingBalance stored on account records)
  const [balances, setBalances] = useState<Record<string, ObEntry>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && accounts.length > 0) {
      const init: Record<string, ObEntry> = {};
      accounts.forEach(a => {
        if ((a.openingBalance || 0) > 0) {
          init[a.id] = {
            accountId: a.id,
            amount: a.openingBalance || 0,
            type: (a.openingBalanceType as 'debit' | 'credit') || (a.type === 'asset' ? 'debit' : 'credit'),
          };
        }
      });
      setBalances(init);
      setInitialized(true);
    }
  }, [accounts, initialized]);

  const [filterType, setFilterType] = useState<'all' | 'asset' | 'liability' | 'equity'>('all');
  const [showOnlyNonZero, setShowOnlyNonZero] = useState(false);

  const balanceAccounts = useMemo(() =>
    accounts.filter(a =>
      a.type === 'asset' || a.type === 'liability' || a.type === 'equity'
    // by readable code (#706); accounts without one yet go last, by name
    ).sort((a, b) => {
      const ca = accountCode(a), cb = accountCode(b);
      if (ca && cb) return ca.localeCompare(cb, 'en', { numeric: true });
      if (ca || cb) return ca ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    }),
    [accounts]);

  const filtered = useMemo(() => {
    let list = filterType === 'all' ? balanceAccounts : balanceAccounts.filter(a => a.type === filterType);
    if (showOnlyNonZero) list = list.filter(a => (balances[a.id]?.amount || 0) > 0 || (a.openingBalance || 0) > 0);
    return list;
  }, [balanceAccounts, filterType, showOnlyNonZero, balances]);

  const { debit: totalDebit, credit: totalCredit, difference, balanced: isBalanced } = openingTotals(Object.values(balances));
  const [confirmUnbalanced, setConfirmUnbalanced] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Group (parent) accounts that currently carry a non-zero opening (pending edits included).
  // Reports ignore these, so they are a silent source of a Trial-Balance gap — surface them
  // loudly so the user moves the amount onto a ledger (leaf) account.
  const groupsWithOpening = balanceAccounts.filter(a => a.isGroup && (balances[a.id]?.amount || 0) > 0);
  // Openings on the wrong side (a liability in Dr …) and on income/expense heads (not listed on this page, yet
  // counted in its totals) — shown BEFORE save so a sign mistake from a file is caught (2026-10-11).
  const warn = useMemo(() => openingWarnings(Object.values(balances), accounts), [balances, accounts]);
  const sideHi = (s: 'debit' | 'credit') => (s === 'debit' ? 'Dr' : 'Cr');

  const handleCSV = () => {
    const headers = ['Code', 'Account Name', 'Type', 'Opening Balance', 'Balance Type'];
    const rows = filtered.map(a => [accountCode(a), a.name, a.type, a.openingBalance || 0, a.openingBalanceType || 'debit']);
    downloadCSV(headers, rows, 'opening_balances.csv');
  };
  const handleExcel = () => {
    const headers = ['Code', 'Account Name', 'Type', 'Opening Balance', 'Balance Type'];
    const rows = filtered.map(a => [accountCode(a), a.name, a.type, a.openingBalance || 0, a.openingBalanceType || 'debit']);
    downloadExcelSingle(headers, rows, 'opening_balances.xlsx', 'Opening Balances');
  };

  // Save: update each account's openingBalance in Supabase via DataContext
  const handleSave = useCallback((opts?: { unbalancedConfirmed?: boolean }) => {
    // GUARD: an opening balance on a GROUP (parent) account is silently ignored by the Trial
    // Balance and Balance Sheet — both count LEDGER (leaf) accounts only. Money entered on a
    // group vanishes from every report (a real ₹58L funding was lost this way), leaving the
    // sheet out of balance with no warning. Block it so funding lands on a real ledger account.
    const groupWithOpening = Object.values(balances).find(e => {
      const acc = accounts.find(a => a.id === e.accountId);
      return acc?.isGroup && e.amount > 0;
    });
    if (groupWithOpening) {
      const acc = accounts.find(a => a.id === groupWithOpening.accountId);
      toast({
        title: hi ? 'समूह खाते पर प्रारंभिक शेष नहीं डाल सकते' : 'Cannot set an opening on a group account',
        description: hi
          ? `"${acc?.name}" एक समूह (parent) खाता है — रिपोर्ट (Trial Balance/Balance Sheet) इसकी opening नहीं गिनतीं, इसलिए यह गायब हो जाती है। इसे 0 करें और यह रकम किसी लेजर (leaf) खाते पर डालें।`
          : `"${acc?.name}" is a group (parent) account — reports (Trial Balance/Balance Sheet) do not count its opening, so it silently disappears. Set it to 0 and enter the amount on a ledger (leaf) account instead.`,
        variant: 'destructive', duration: 12000,
      });
      return;
    }
    if (!isBalanced && !opts?.unbalancedConfirmed) { setConfirmUnbalanced(true); return; }
    if (society.fyLocked) {
      toast({ title: hi ? 'वित्त वर्ष लॉक है' : 'FY Locked', description: hi ? 'वित्त वर्ष लेखा-लॉक है — प्रारंभिक शेष नहीं बदले जा सकते।' : 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive', duration: 10000 });
      return;
    }

    // Only rows that really change: entered/edited ones, and cleared ones set back to 0.
    type Change = { id: string; next: { openingBalance: number; openingBalanceType?: 'debit' | 'credit' }; prev: { openingBalance: number; openingBalanceType?: 'debit' | 'credit' } };
    const changes: Change[] = [];
    for (const a of balanceAccounts) {
      const prev = { openingBalance: Number(a.openingBalance) || 0, openingBalanceType: a.openingBalanceType };
      const e = balances[a.id];
      if (e) {
        if (e.amount !== prev.openingBalance || e.type !== prev.openingBalanceType) changes.push({ id: a.id, next: { openingBalance: e.amount, openingBalanceType: e.type }, prev });
      } else if (prev.openingBalance > 0) changes.push({ id: a.id, next: { openingBalance: 0 }, prev });
    }
    if (changes.length === 0) {
      toast({ title: hi ? 'कोई बदलाव नहीं' : 'Nothing changed', description: hi ? 'सहेजने के लिए कोई नया प्रारंभिक शेष नहीं है।' : 'There are no opening-balance changes to save.' });
      return;
    }

    // RULE 1: announce success only after EVERY row is confirmed by the cloud. If any row fails,
    // put the rows that did save back to their previous values too, so the openings never end up
    // half-saved (one side of the Dr/Cr pair on the server, the other not).
    setSaving(true);
    const saved: Change[] = [];
    const failed: string[] = [];
    const settled = new Set<string>();
    const settle = (c: Change, ok: boolean, msg?: string) => {
      if (settled.has(c.id)) return;   // idempotent: a dev double-render may fire the callback twice
      settled.add(c.id);
      if (ok) saved.push(c); else failed.push(`${accounts.find(a => a.id === c.id)?.name || c.id}${msg ? ` (${msg})` : ''}`);
      if (settled.size < changes.length) return;
      setSaving(false);
      if (failed.length === 0) {
        toast({ title: hi ? 'प्रारंभिक शेष सहेजा गया' : 'Opening balances saved', description: hi ? `${changes.length} खाते अपडेट हुए।` : `${changes.length} accounts updated.` });
        return;
      }
      saved.forEach(r => updateAccount(r.id, r.prev));
      setBalances(prev => {
        const next = { ...prev };
        changes.forEach(r => {
          if (r.prev.openingBalance > 0) next[r.id] = { accountId: r.id, amount: r.prev.openingBalance, type: r.prev.openingBalanceType || 'debit' };
          else delete next[r.id];
        });
        return next;
      });
      toast({
        title: hi ? 'प्रारंभिक शेष सेव नहीं हुआ' : 'Opening balances not saved',
        description: hi
          ? `${failed.length} खाते cloud में सेव नहीं हुए: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}। बाक़ी बदलाव भी वापस ले लिए गए ताकि शेष आधे-अधूरे न रहें — refresh करने पर पुराना शेष ही दिखेगा। दोबारा सहेजें।`
          : `${failed.length} accounts failed to save to the cloud: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}. The other changes were reverted too, so openings are not half-saved. Please save again.`,
        variant: 'destructive', duration: 12000,
      });
    };
    for (const c of changes) {
      // false = a guard refused it synchronously (FY lock etc.) and already said why.
      if (!updateAccount(c.id, c.next, { onSaved: () => settle(c, true), onFailed: m => settle(c, false, m) })) settle(c, false);
    }
  }, [balances, balanceAccounts, accounts, updateAccount, hi, toast, isBalanced, society.fyLocked]);

  // One continuous ledger: the 31-Mar closing becomes the 1-Apr opening on its own (Trial Balance
  // folds every earlier-year voucher into the opening). account.openingBalance is the GENESIS
  // opening, so a year-end closing must never be written into it — that counted every earlier
  // voucher twice (scripts/test-opening-carry-forward.mjs). The old "Carry Forward (Auto)" button
  // is gone; the audited fill is offered only for first-time onboarding (no earlier vouchers).
  const fyLocked = !!society.fyLocked;
  const priorVoucherCount = useMemo(
    () => earlierYearVoucherCount(vouchers, fyStartFromLabel(society.financialYear)),
    [vouchers, society.financialYear]);
  const continuousLedger = priorVoucherCount > 0;
  // ECR-09: opening = prior-year AUDITED closing (entered from an external audited balance sheet).
  const auditedOpenings = useMemo(() => carryForwardOpenings(society.previousYearBalances), [society.previousYearBalances]);
  const handleCarryFromAudited = useCallback(() => {
    if (continuousLedger) return;
    const next: Record<string, ObEntry> = {};
    auditedOpenings.forEach(e => { next[e.accountId] = { accountId: e.accountId, amount: e.amount, type: e.type }; });
    setBalances(next);
    toast({
      title: hi ? `${society.previousFinancialYear || 'पिछले वर्ष'} के लेखा-परीक्षित शेष भरे गए` : `${society.previousFinancialYear || 'Prior year'} audited closing carried in`,
      description: hi ? 'अभी सहेजे नहीं गए — जाँचकर "सहेजें" दबाएँ।' : 'Not saved yet — review and press Save.',
    });
  }, [auditedOpenings, continuousLedger, society.previousFinancialYear, hi, toast]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रारंभिक शेष' : 'Opening Balances'}</h1>
          <p className="text-muted-foreground text-sm">
            {hi ? `वित्तीय वर्ष ${society.financialYear} के लिए प्रारंभिक शेष` : `Opening balances for FY ${society.financialYear}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}><Download className="h-4 w-4" /> CSV</Button>
          {/* First-time onboarding: make the party / bank / other ledgers right here, then fill their openings. */}
          {!fyLocked && allowedQuickKinds(user?.role, ['general', 'customer', 'supplier', 'bank']).length > 0 && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>{hi ? '+ नया खाता' : '+ New account'}</Button>
          )}
          {user?.role === 'admin' && !fyLocked && (
            <>
              {auditedOpenings.length > 0 && !continuousLedger && (
                <Button variant="outline" onClick={handleCarryFromAudited} title={hi ? 'लेखा-परीक्षित समापन शेष से' : 'From audited closing'}>
                  <ArrowRight className="h-4 w-4 mr-2" />{hi ? 'लेखा-परीक्षित शेष भरें' : 'From audited closing'}
                </Button>
              )}
              <Button onClick={() => handleSave()} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />{hi ? 'सहेजें' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {fyLocked && (
        <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/30 rounded-lg text-destructive text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          {hi
            ? `वित्तीय वर्ष ${society.financialYear} लेखा-लॉक है — प्रारंभिक शेष अब बदले नहीं जा सकते (लेखा-परीक्षण के बाद locked)।`
            : `FY ${society.financialYear} is audit-locked — opening balances can no longer be changed (locked post-audit).`}
        </div>
      )}

      {continuousLedger && (
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/30 rounded-lg text-sm">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{hi ? 'नए साल का प्रारंभिक शेष अपने-आप आता है' : "The new year's opening comes automatically"}</p>
            <p className="text-xs text-muted-foreground">
              {hi
                ? `खाते लगातार चलते हैं — 31 मार्च का समापन शेष अपने-आप 1 अप्रैल का प्रारंभिक शेष बन जाता है (Trial Balance / Balance Sheet में दिखता है)। इसलिए पिछला शेष यहाँ दोबारा न भरें, वरना पिछले साल की हर एंट्री दो बार गिनी जाएगी। इस पेज के आँकड़े वह शेष हैं जिनसे society ने ऐप में शुरुआत की थी — इन्हें सिर्फ़ उस शुरुआती शेष की गलती सुधारने के लिए बदलें। (पिछले वर्षों के ${priorVoucherCount} वाउचर ऐप में हैं।)`
                : `Books run continuously — the 31-Mar closing automatically becomes the 1-Apr opening (see Trial Balance / Balance Sheet). Do not re-enter it here, or every earlier-year entry is counted twice. The figures on this page are the balances the society started the app with — change them only to correct that starting balance. (${priorVoucherCount} earlier-year vouchers are in the app.)`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल डेबिट' : 'Total Debit'}</p>
          <p className="font-bold text-lg">₹{fmt(totalDebit)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल क्रेडिट' : 'Total Credit'}</p>
          <p className="font-bold text-lg">₹{fmt(totalCredit)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'अंतर' : 'Difference'}</p>
          {/* An all-zero page is "not filled yet", never "balanced" (usability audit P0-3). */}
          {totalDebit === 0 && totalCredit === 0 ? (
            <p className="font-bold text-sm text-amber-700">{hi ? 'अभी ओपनिंग बैलेंस नहीं भरा गया' : 'Opening balances not entered yet'}</p>
          ) : (
            <p className={`font-bold text-lg ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
              {isBalanced ? (hi ? 'संतुलित ✓' : 'Balanced ✓') : `₹${fmt(difference)}`}
            </p>
          )}
        </CardContent></Card>
      </div>

      {groupsWithOpening.length > 0 && (
        <div className="p-3 bg-destructive/5 border border-destructive/30 rounded-lg text-destructive text-sm space-y-1">
          <p className="font-semibold">
            {hi ? '⚠️ समूह खातों पर opening — रिपोर्ट इन्हें नहीं गिनतीं' : '⚠️ Opening on group accounts — reports ignore these'}
          </p>
          <p className="text-xs">
            {hi
              ? 'नीचे लाल "समूह" टैग वाले खातों की opening Trial Balance / Balance Sheet में नहीं जाती (वे केवल लेजर खाते गिनते हैं)। इन्हें 0 करें और यह रकम किसी लेजर (leaf) खाते पर डालें — तभी sheet संतुलित होगी:'
              : 'The opening on the accounts tagged "GROUP" below never reaches the Trial Balance / Balance Sheet (they count ledger accounts only). Set each to 0 and move the amount onto a ledger (leaf) account so the sheet ties:'}
          </p>
          <ul className="text-xs list-disc pl-5">
            {groupsWithOpening.map(a => (
              <li key={a.id}>{hi ? (a.nameHi || a.name) : a.name} — ₹{fmt(balances[a.id]?.amount || 0)}</li>
            ))}
          </ul>
        </div>
      )}

      {(warn.wrongSide.length > 0 || warn.plHeads.length > 0) && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-lg text-amber-800 dark:text-amber-200 text-sm space-y-2">
          {warn.wrongSide.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold">
                {hi
                  ? `⚠️ ${warn.wrongSide.length} खातों की opening उलटी तरफ़ है (कुल ₹${fmt(warn.wrongSide.reduce((t, r) => t + r.amount, 0))})`
                  : `⚠️ ${warn.wrongSide.length} account(s) have the opening on the wrong side (₹${fmt(warn.wrongSide.reduce((t, r) => t + r.amount, 0))})`}
              </p>
              <p className="text-xs">
                {hi
                  ? 'देनदारी / पूँजी की opening सामान्यतः Cr में और संपत्ति की Dr में होती है। ज़्यादातर यह file या entry में Dr/Cr की उलटी गलती होती है — Dr/Cr बदलें, या सही हो तो रहने दें (जैसे लेनदार को दिया अग्रिम):'
                  : 'A liability / capital opening is normally Cr and an asset Dr. Usually this is a Dr/Cr slip in the file or entry — switch it, or keep it if it is genuine (e.g. an advance paid to a creditor):'}
              </p>
              <ul className="text-xs list-disc pl-5">
                {warn.wrongSide.slice(0, 8).map(r => (
                  <li key={r.accountId}>{r.name} — ₹{fmt(r.amount)} {sideHi(r.side)}</li>
                ))}
                {warn.wrongSide.length > 8 && <li>{hi ? `… और ${warn.wrongSide.length - 8}` : `… and ${warn.wrongSide.length - 8} more`}</li>}
              </ul>
            </div>
          )}
          {warn.plHeads.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold">
                {hi ? `ℹ️ ${warn.plHeads.length} आय/व्यय खातों पर opening है — ये इस सूची में नहीं दिखते, पर ऊपर के कुल योग में गिने जाते हैं` : `ℹ️ ${warn.plHeads.length} income/expense account(s) carry an opening — not listed here, but counted in the totals above`}
              </p>
              <p className="text-xs">
                {hi ? 'यह तभी सही है जब समिति बीच साल से ऐप शुरू कर रही हो। नहीं तो इन्हें Ledger Heads में खोलकर 0 करें:' : 'Right only when the society starts mid-year. Otherwise open them in Ledger Heads and set them to 0:'}
              </p>
              <ul className="text-xs list-disc pl-5">
                {warn.plHeads.slice(0, 8).map(r => (
                  <li key={r.accountId}>{r.name} — ₹{fmt(r.amount)} {sideHi(r.side)}</li>
                ))}
                {warn.plHeads.length > 8 && <li>{hi ? `… और ${warn.plHeads.length - 8}` : `… and ${warn.plHeads.length - 8} more`}</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={v => setFilterType(v as 'all' | 'asset' | 'liability' | 'equity')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
            <SelectItem value="asset">{hi ? 'संपत्ति' : 'Assets'}</SelectItem>
            <SelectItem value="liability">{hi ? 'दायित्व' : 'Liabilities'}</SelectItem>
            <SelectItem value="equity">{hi ? 'पूंजी' : 'Equity'}</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showOnlyNonZero} onChange={e => setShowOnlyNonZero(e.target.checked)} />
          {hi ? 'केवल शेष वाले' : 'Only non-zero'}
        </label>
        <span className="text-xs text-muted-foreground">{filtered.length} {hi ? 'खाते' : 'accounts'}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                  <TableHead>{hi ? 'खाता' : 'Account'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</TableHead>
                  <TableHead className="text-center">{hi ? 'डेबिट / क्रेडिट' : 'Dr / Cr'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(acct => {
                  const entry = balances[acct.id];
                  const amt = entry?.amount || '';
                  const type = entry?.type || (acct.type === 'asset' ? 'debit' : 'credit');
                  return (
                    <TableRow key={acct.id}>
                      <TableCell className="font-mono text-xs">{accountCode(acct) || '—'}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {accountDisplayName(acct, hi)}
                        {acct.isGroup && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30 align-middle"
                            title={hi ? 'समूह खाता — रिपोर्ट इसकी opening नहीं गिनतीं' : 'Group account — reports ignore its opening'}>
                            {hi ? 'समूह' : 'GROUP'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          acct.type === 'asset' ? 'bg-blue-100 text-blue-700' :
                          acct.type === 'liability' ? 'bg-red-100 text-red-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {acct.type === 'asset' ? (hi ? 'संपत्ति' : 'Asset') :
                           acct.type === 'liability' ? (hi ? 'दायित्व' : 'Liability') :
                           (hi ? 'पूंजी' : 'Equity')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {acct.isGroup ? (
                          // Tally-parity: a GROUP is only a classification container — it cannot
                          // hold an opening (reports sum its child ledgers), so no entry field is
                          // offered. A legacy/stray group opening can still be cleared to 0.
                          (entry?.amount || 0) > 0 ? (
                            <span className="inline-flex items-center gap-2 justify-end">
                              <span className="font-mono text-sm text-destructive">₹{fmt(entry.amount)}</span>
                              {user?.role === 'admin' && !fyLocked && (
                                <Button variant="outline" size="sm" className="h-6 px-2 text-xs text-destructive border-destructive/40"
                                  title={hi ? 'समूह पर opening नहीं होती (Tally की तरह) — इसे लेजर खाते पर डालें' : "A group can't hold an opening (like Tally) — move it to a ledger account"}
                                  onClick={() => setBalances(p => { const n = { ...p }; delete n[acct.id]; return n; })}>
                                  {hi ? '0 करें' : 'Clear'}
                                </Button>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        ) : user?.role === 'admin' && !fyLocked ? (
                          <Input
                            type="number" min="0" step="0.01" className="w-36 text-right h-7 text-sm"
                            value={amt} placeholder="0.00"
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v === 0) {
                                setBalances(p => { const n = { ...p }; delete n[acct.id]; return n; });
                              } else {
                                setBalances(p => ({ ...p, [acct.id]: { accountId: acct.id, amount: v, type: balances[acct.id]?.type || type } }));
                              }
                            }}
                          />
                        ) : (
                          <span className="font-mono text-sm">₹{fmt(Number(amt) || 0)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {acct.isGroup ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : user?.role === 'admin' && !fyLocked ? (
                          <Select
                            value={type}
                            onValueChange={v => setBalances(p => ({
                              ...p,
                              [acct.id]: { accountId: acct.id, amount: Number(amt) || 0, type: v as 'debit' | 'credit' }
                            }))}>
                            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit">{hi ? 'डेबिट' : 'Dr'}</SelectItem>
                              <SelectItem value="credit">{hi ? 'क्रेडिट' : 'Cr'}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={type === 'debit' ? 'default' : 'secondary'} className="text-xs">
                            {type === 'debit' ? 'Dr' : 'Cr'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="text-sm text-amber-800">
            {hi
              ? 'यहाँ वे शेष भरें जिनसे society ने ऐप में शुरुआत की (पिछली audited balance sheet से)। उसके बाद हर साल का प्रारंभिक शेष अपने-आप आगे आता है — वर्ष के अंत में: FY लॉक → नया वर्ष (rollover) → वर्ष बंद। कुल डेबिट और कुल क्रेडिट बराबर होने चाहिए।'
              : 'Enter the balances the society started the app with (from the last audited balance sheet). After that every year\'s opening carries forward automatically — at year end: FY lock → rollover → year close. Total debit must equal total credit.'}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmUnbalanced} onOpenChange={setConfirmUnbalanced}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'डेबिट और क्रेडिट बराबर नहीं हैं' : 'Debit and credit do not match'}</AlertDialogTitle>
            <AlertDialogDescription>
              {hi
                ? `कुल डेबिट ₹${fmt(totalDebit)} और कुल क्रेडिट ₹${fmt(totalCredit)} में ₹${fmt(difference)} का अंतर है। ऐसे सहेजने पर Trial Balance और Balance Sheet मेल नहीं खाएँगे। क्या आप अधूरा शेष फिर भी सहेजना चाहते हैं (बाद में पूरा करेंगे)?`
                : `Total debit ₹${fmt(totalDebit)} and total credit ₹${fmt(totalCredit)} differ by ₹${fmt(difference)}. Saving like this leaves the Trial Balance and Balance Sheet out of balance. Save the incomplete openings anyway (to finish later)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रुकें, ठीक करता हूँ' : 'Go back and fix'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmUnbalanced(false); handleSave({ unbalancedConfirmed: true }); }}>
              {hi ? 'फिर भी सहेजें' : 'Save anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <QuickCreateMaster open={createOpen} onOpenChange={setCreateOpen} defaultType="asset" onCreated={() => {}} />
    </div>
  );
}
