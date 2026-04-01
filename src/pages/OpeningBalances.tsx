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
import { getVoucherLines } from '@/lib/voucherUtils';

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
    ).sort((a, b) => (a.code || '').localeCompare(b.code || '')),
    [accounts]);

  const filtered = useMemo(() => {
    let list = filterType === 'all' ? balanceAccounts : balanceAccounts.filter(a => a.type === filterType);
    if (showOnlyNonZero) list = list.filter(a => (balances[a.id]?.amount || 0) > 0 || (a.openingBalance || 0) > 0);
    return list;
  }, [balanceAccounts, filterType, showOnlyNonZero, balances]);

  const totalDebit = Object.values(balances).filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
  const totalCredit = Object.values(balances).filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const handleCSV = () => {
    const headers = ['Account Name', 'Type', 'Opening Balance', 'Balance Type'];
    const rows = filtered.map(a => [a.name, a.type, a.openingBalance || 0, a.openingBalanceType || 'debit']);
    downloadCSV(headers, rows, 'opening_balances.csv');
  };
  const handleExcel = () => {
    const headers = ['Account Name', 'Type', 'Opening Balance', 'Balance Type'];
    const rows = filtered.map(a => [a.name, a.type, a.openingBalance || 0, a.openingBalanceType || 'debit']);
    downloadExcelSingle(headers, rows, 'opening_balances.xlsx', 'Opening Balances');
  };

  // Save: update each account's openingBalance in Supabase via DataContext
  const handleSave = useCallback(() => {
    // Update accounts that have balances set
    Object.values(balances).forEach(entry => {
      updateAccount(entry.accountId, { openingBalance: entry.amount, openingBalanceType: entry.type });
    });
    // Zero out accounts that were cleared
    balanceAccounts.forEach(a => {
      if ((a.openingBalance || 0) > 0 && !balances[a.id]) {
        updateAccount(a.id, { openingBalance: 0 });
      }
    });
    toast({ title: hi ? 'प्रारंभिक शेष सहेजा गया' : 'Opening balances saved' });
  }, [balances, balanceAccounts, updateAccount, hi, toast]);

  // Carry forward: compute closing balance from vouchers and set as opening
  const handleCarryForward = useCallback(() => {
    const fyParts = society.financialYear.split('-');
    const endYear = parseInt(fyParts[0]) + 1;
    const fyEnd = `${endYear}-03-31`;

    const newBalances: Record<string, ObEntry> = {};
    for (const acct of balanceAccounts) {
      let bal = (acct.openingBalanceType === 'debit' ? 1 : -1) * (acct.openingBalance || 0);
      const existing = balances[acct.id];
      if (existing) {
        bal += existing.type === 'debit' ? existing.amount : -existing.amount;
      }
      vouchers
        .filter(v => !v.isDeleted && v.date <= fyEnd &&
          getVoucherLines(v).some(l => l.accountId === acct.id))
        .forEach(v => {
          getVoucherLines(v).forEach(l => {
            if (l.accountId === acct.id) {
              if (l.type === 'Dr') bal += l.amount;
              else bal -= l.amount;
            }
          });
        });
      if (Math.abs(bal) > 0.01) {
        newBalances[acct.id] = { accountId: acct.id, amount: Math.abs(bal), type: bal >= 0 ? 'debit' : 'credit' };
      }
    }
    setBalances(newBalances);
    toast({ title: hi ? 'पिछले वर्ष का शेष अगले वर्ष में लाया गया' : 'Previous year closing balances carried forward' });
  }, [balanceAccounts, vouchers, society, balances, hi, toast]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'प्रारंभिक शेष / Carry Forward' : 'Opening Balances / Carry Forward'}</h1>
          <p className="text-muted-foreground text-sm">
            {hi ? `वित्तीय वर्ष ${society.financialYear} के लिए प्रारंभिक शेष` : `Opening balances for FY ${society.financialYear}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}><Download className="h-4 w-4" /> CSV</Button>
          {user?.role === 'admin' && (
            <>
              <Button variant="outline" onClick={handleCarryForward}>
                <ArrowRight className="h-4 w-4 mr-2" />{hi ? 'Carry Forward' : 'Carry Forward (Auto)'}
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />{hi ? 'सहेजें' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
          <p className={`font-bold text-lg ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
            {isBalanced ? (hi ? 'संतुलित ✓' : 'Balanced ✓') : `₹${fmt(Math.abs(totalDebit - totalCredit))}`}
          </p>
        </CardContent></Card>
      </div>

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
                      <TableCell className="font-mono text-xs">{acct.code}</TableCell>
                      <TableCell className="font-medium text-sm">{acct.name}</TableCell>
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
                        {user?.role === 'admin' ? (
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
                        {user?.role === 'admin' ? (
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
              ? '"Carry Forward (Auto)" बटन वर्तमान वित्तीय वर्ष के अंत तक सभी खातों का शेष निकालकर अगले वर्ष के प्रारंभिक शेष के रूप में भर देता है।'
              : '"Carry Forward (Auto)" computes closing balance of all accounts as of FY end and pre-fills them as opening balances for the next year.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
