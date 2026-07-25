/**
 * Compound (Multi-line) Voucher Entry
 *
 * Supports N debit lines + M credit lines (journal only).
 * ΣDebits must equal ΣCredits before saving.
 * Posts ONE multi-line journal voucher carrying every line (reports read it via
 * getVoucherLines — RULE 2). NOTE: the earlier implementation exploded the entry
 * into min(dr,cr) pairs, which silently DROPPED any amount where a debit line
 * didn't equal its paired credit line even though the entry showed "Balanced ✓".
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
import { Plus, Trash2, Save, RotateCcw, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AccountPicker } from '@/components/AccountPicker';
import type { VoucherLine } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

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
  onChange: (id: string, field: keyof Line, val: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}> = ({ lines, type, hi, onChange, onAdd, onRemove }) => {
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
                <AccountPicker
                  value={line.accountId}
                  onChange={v => onChange(line.id, 'accountId', v)}
                  triggerClassName="h-8 text-sm"
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
                    className="h-9 w-9 text-red-500 hover:bg-red-50"
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
  const { accounts, addVoucher } = useData();
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

    // Post ONE multi-line journal voucher carrying every debit and credit line.
    // The full amounts post exactly as entered (ΣDr = ΣCr, already validated), so no
    // line is dropped. debit/creditAccountId keep the first line of each side for
    // legacy single-line consumers; `lines` is the source of truth for reports.
    const vLines: VoucherLine[] = [
      ...debitLines.map((l) => ({ id: l.id, accountId: l.accountId, type: 'Dr' as const, amount: parseFloat(l.amount), narration: l.narration || undefined })),
      ...creditLines.map((l) => ({ id: l.id, accountId: l.accountId, type: 'Cr' as const, amount: parseFloat(l.amount), narration: l.narration || undefined })),
    ];
    const v = addVoucher({
      type: 'journal',
      date,
      lines: vLines,
      debitAccountId: debitLines[0].accountId,
      creditAccountId: creditLines[0].accountId,
      amount: totalDebit,
      narration: narration || 'Compound Journal Entry',
      createdBy: user?.name ?? 'System',
      origin: 'manual',
    });
    if (!v?.id) return; // addVoucher shows the reason on failure (FY lock / rollback)

    toast({ title: hi ? `वाउचर पोस्ट किया गया · ${v.voucherNo}` : `Voucher posted · ${v.voucherNo}` });

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
            {hi ? 'संयुक्त वाउचर एंट्री (बहु-पंक्ति)' : 'Compound Voucher Entry (Multi-line)'}
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
        onChange={(id, field, val) => updateLine(setDebitLines, id, field, val)}
        onAdd={() => addLine(setDebitLines)}
        onRemove={id => removeLine(setDebitLines, id)}
      />

      {/* Credit side */}
      <LineTable
        lines={creditLines}
        type="credit"
        hi={hi}
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
          <li>{hi ? 'पूरी प्रविष्टि एक ही बहु-पंक्ति जर्नल वाउचर के रूप में दर्ज होती है — कोई राशि नहीं छूटती।' : 'The whole entry is posted as one multi-line journal voucher — no amount is dropped.'}</li>
          <li>{hi ? 'असमान पंक्तियाँ (जैसे 3 Dr + 2 Cr) भी ठीक हैं, बशर्ते कुल Dr = कुल Cr हो।' : 'Unequal line counts (e.g. 3 Dr + 2 Cr) are fine, as long as ΣDr = ΣCr.'}</li>
        </ul>
      </div>
    </div>
  );
};

export default CompoundVoucher;
