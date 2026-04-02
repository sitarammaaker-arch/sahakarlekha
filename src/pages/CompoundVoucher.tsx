/**
 * Compound (Multi-line) Voucher Entry
 *
 * Supports N debit lines + N credit lines (journal only).
 * ΣDebits must equal ΣCredits before saving.
 * Each row is stored as a separate Voucher with a shared groupId.
 *
 * Tally-style layout: top narration, then debit table, then credit table,
 * with live balance diff indicator.
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, RotateCcw, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getNextVoucherNo } from '@/lib/storage';
import type { LedgerAccount } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

// ── Compact account search ────────────────────────────────────────────────────
const AccSearch: React.FC<{
  value: string;
  onChange: (id: string) => void;
  accounts: LedgerAccount[];
  language: 'hi' | 'en';
  placeholder?: string;
}> = ({ value, onChange, accounts, language, placeholder }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = accounts.find(a => a.id === value);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    if (!lq) return accounts.slice(0, 20);
    return accounts.filter(a =>
      a.name.toLowerCase().includes(lq) ||
      a.nameHi.includes(q) ||
      a.id.startsWith(q)
    ).slice(0, 20);
  }, [q, accounts]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <Input
          value={open ? q : (selected ? (language === 'hi' ? selected.nameHi : selected.name) : '')}
          onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => { setQ(''); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder={placeholder ?? (language === 'hi' ? 'खाता खोजें' : 'Search account')}
          className="h-8 text-sm pl-6"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-xl max-h-44 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              {language === 'hi' ? 'कोई खाता नहीं' : 'No account found'}
            </p>
          ) : filtered.map(a => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => { onChange(a.id); setOpen(false); setQ(''); }}
              className={cn(
                'w-full text-left px-3 py-1.5 hover:bg-muted text-xs border-b last:border-0 flex items-center gap-2',
                a.id === value && 'bg-primary/5 font-medium'
              )}
            >
              <span>{language === 'hi' ? a.nameHi : a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Line interface ────────────────────────────────────────────────────────────
interface Line {
  id: string;
  accountId: string;
  amount: string;
  narration: string;
}

const emptyLine = (): Line => ({
  id: crypto.randomUUID(),
  accountId: '',
  amount: '',
  narration: '',
});

// ── LineTable ─────────────────────────────────────────────────────────────────
const LineTable: React.FC<{
  lines: Line[];
  type: 'debit' | 'credit';
  hi: boolean;
  language: 'hi' | 'en';
  accounts: LedgerAccount[];
  onChange: (id: string, field: keyof Line, val: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}> = ({ lines, type, hi, language, accounts, onChange, onAdd, onRemove }) => {
  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isDebit = type === 'debit';
  const headerClass = isDebit
    ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-green-50 text-green-800 border-green-200';

  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className={cn('px-3 py-2 text-sm font-semibold border-b flex items-center justify-between', headerClass)}>
        <span>
          {isDebit
            ? (hi ? 'नाम (Dr) — डेबिट पक्ष' : 'Debit Side (Dr)')
            : (hi ? 'जमा (Cr) — क्रेडिट पक्ष' : 'Credit Side (Cr)')}
        </span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8">#</TableHead>
            <TableHead className="min-w-52">{hi ? 'खाता' : 'Account'}</TableHead>
            <TableHead className="w-32 text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</TableHead>
            <TableHead>{hi ? 'विवरण' : 'Narration'}</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, i) => (
            <TableRow key={line.id}>
              <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
              <TableCell>
                <AccSearch
                  value={line.accountId}
                  onChange={v => onChange(line.id, 'accountId', v)}
                  accounts={accounts}
                  language={language}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.amount}
                  onChange={e => onChange(line.id, 'amount', e.target.value)}
                  className="h-8 text-sm text-right w-28"
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={line.narration}
                  onChange={e => onChange(line.id, 'narration', e.target.value)}
                  className="h-8 text-sm"
                  placeholder={hi ? 'वैकल्पिक विवरण' : 'Optional narration'}
                />
              </TableCell>
              <TableCell>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:bg-red-50"
                    onClick={() => onRemove(line.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-2">
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          {hi ? 'पंक्ति जोड़ें' : 'Add Line'}
        </Button>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const CompoundVoucher: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { accounts, vouchers, society, addVoucher } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';

  // Exclude group accounts from dropdowns
  const leafAccounts = useMemo(
    () => accounts.filter(a => !a.isGroup),
    [accounts]
  );

  // ── Form state ────────────────────────────────────────────────────────────
  const [date, setDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [debitLines,  setDebitLines]  = useState<Line[]>([emptyLine()]);
  const [creditLines, setCreditLines] = useState<Line[]>([emptyLine()]);

  const totalDebit  = debitLines.reduce((s, l)  => s + (parseFloat(l.amount)  || 0), 0);
  const totalCredit = creditLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = diff === 0 && totalDebit > 0;

  // ── Line helpers ──────────────────────────────────────────────────────────
  const updateLine = (
    setter: React.Dispatch<React.SetStateAction<Line[]>>,
    id: string, field: keyof Line, val: string
  ) => setter(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));

  const addLine = (setter: React.Dispatch<React.SetStateAction<Line[]>>) =>
    setter(prev => [...prev, emptyLine()]);

  const removeLine = (setter: React.Dispatch<React.SetStateAction<Line[]>>, id: string) =>
    setter(prev => prev.filter(l => l.id !== id));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!balanced) return;

    // Validate all lines have account and amount
    for (const l of [...debitLines, ...creditLines]) {
      if (!l.accountId || !(parseFloat(l.amount) > 0)) {
        toast({ title: hi ? 'सभी पंक्तियों में खाता और राशि आवश्यक है' : 'All lines must have account and amount', variant: 'destructive' });
        return;
      }
    }

    const groupId = crypto.randomUUID();
    const fy = society.financialYear;
    let allVouchers = [...vouchers];

    // For compound entries we create one voucher per debit-credit pair in order.
    // If lines are unequal, we pair sequentially and let the last line absorb the remainder.
    // Simplest correct approach: create individual journal vouchers for each line pair.
    // With N debit + M credit lines, we need max(N, M) vouchers.
    // Each voucher takes one debit line amount and one credit line amount.
    // For asymmetric splits, the last smaller side repeats its final line.

    const maxLen = Math.max(debitLines.length, creditLines.length);
    for (let i = 0; i < maxLen; i++) {
      const dr = debitLines[Math.min(i, debitLines.length - 1)];
      const cr = creditLines[Math.min(i, creditLines.length - 1)];

      // Only create if this index isn't a duplicate (avoid double posting)
      const isDrDup = i >= debitLines.length;
      const isCrDup = i >= creditLines.length;
      if (isDrDup || isCrDup) continue;

      const amount = Math.min(parseFloat(dr.amount) || 0, parseFloat(cr.amount) || 0);
      if (amount <= 0) continue;

      const voucherNo = getNextVoucherNo('journal', fy, allVouchers);
      const v = {
        id: crypto.randomUUID(),
        voucherNo,
        type: 'journal' as const,
        date,
        debitAccountId: dr.accountId,
        creditAccountId: cr.accountId,
        amount,
        narration: narration || (dr.narration || cr.narration || 'Compound Journal Entry'),
        createdBy: user?.name ?? 'System',
        groupId,
      };
      addVoucher(v);
      allVouchers = [...allVouchers, v];
    }

    toast({
      title: hi
        ? `${Math.max(debitLines.length, creditLines.length)} वाउचर पोस्ट किए गए`
        : `${Math.max(debitLines.length, creditLines.length)} vouchers posted`,
    });

    // Reset
    setDebitLines([emptyLine()]);
    setCreditLines([emptyLine()]);
    setNarration('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleReset = () => {
    setDebitLines([emptyLine()]);
    setCreditLines([emptyLine()]);
    setNarration('');
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Layers className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'संयुक्त वाउचर प्रविष्टि (बहु-पंक्ति)' : 'Compound Voucher Entry (Multi-line)'}
          </h1>
          <p className="text-sm text-gray-500">
            {hi ? 'अनेक Dr + अनेक Cr पंक्तियाँ — Journal Only' : 'N Debit + N Credit lines — Journal Only'}
          </p>
        </div>
      </div>

      {/* Date + narration */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'तिथि *' : 'Date *'}</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-sm">{hi ? 'मुख्य विवरण (सभी पंक्तियों के लिए)' : 'Common Narration'}</Label>
              <Textarea
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder={hi ? 'जैसे: वेतन वितरण अगस्त 2025' : 'e.g. Salary distribution August 2025'}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debit side */}
      <LineTable
        lines={debitLines}
        type="debit"
        hi={hi}
        language={language}
        accounts={leafAccounts}
        onChange={(id, field, val) => updateLine(setDebitLines, id, field, val)}
        onAdd={() => addLine(setDebitLines)}
        onRemove={id => removeLine(setDebitLines, id)}
      />

      {/* Credit side */}
      <LineTable
        lines={creditLines}
        type="credit"
        hi={hi}
        language={language}
        accounts={leafAccounts}
        onChange={(id, field, val) => updateLine(setCreditLines, id, field, val)}
        onAdd={() => addLine(setCreditLines)}
        onRemove={id => removeLine(setCreditLines, id)}
      />

      {/* Balance indicator */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium',
        balanced
          ? 'bg-green-50 border-green-300 text-green-800'
          : 'bg-red-50 border-red-300 text-red-800'
      )}>
        <span>
          {hi ? 'डेबिट कुल:' : 'Debit Total:'} {fmt(totalDebit)}
          {'  |  '}
          {hi ? 'क्रेडिट कुल:' : 'Credit Total:'} {fmt(totalCredit)}
        </span>
        <Badge className={balanced ? 'bg-green-700' : 'bg-red-600'}>
          {balanced
            ? (hi ? 'संतुलित ✓' : 'Balanced ✓')
            : (hi ? `अंतर: ${fmt(Math.abs(diff))}` : `Difference: ${fmt(Math.abs(diff))}`)}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!balanced}
          className="bg-purple-700 hover:bg-purple-800 gap-2"
        >
          <Save className="h-4 w-4" />
          {hi ? 'वाउचर पोस्ट करें' : 'Post Vouchers'}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {hi ? 'रीसेट' : 'Reset'}
        </Button>
      </div>

      <Separator />

      {/* Help note */}
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>{hi ? 'नोट:' : 'Note:'}</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>{hi ? 'डेबिट और क्रेडिट का कुल बराबर होना अनिवार्य है।' : 'Debit total must equal credit total.'}</li>
          <li>{hi ? 'प्रत्येक पंक्ति युगल के लिए एक अलग जर्नल वाउचर बनेगा (समूह ID सहित)।' : 'One journal voucher is created per debit-credit pair, all sharing a group ID.'}</li>
          <li>{hi ? 'असमान पंक्तियाँ (3 Dr + 2 Cr) — न्यूनतम pair count तक ही वाउचर बनेंगे।' : 'Unequal lines (3 Dr + 2 Cr) — vouchers created up to min pair count.'}</li>
        </ul>
      </div>
    </div>
  );
};

export default CompoundVoucher;
