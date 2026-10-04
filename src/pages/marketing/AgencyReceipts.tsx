import { useState } from 'react';
import { useMarketingData } from '@/contexts/MarketingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getBankAccountIds } from '@/lib/storage';
import { receiptCap, COMMISSION_RECEIPT_REF_TYPE } from '@/lib/procurement/agentFlow';
import { todayStr } from '@/lib/dateUtils';
import { Landmark, Trash2 } from 'lucide-react';

/**
 * Agency Receipt (Marketing M3c) — money received from the procurement agency (FCI / NAFED / the
 * State Federation … — rows of the Agency master):
 *   • MSP reimbursement:   Dr Bank|Cash / Cr MSP Receivable
 *   • Commission received: Dr Bank|Cash / Cr Commission Receivable
 * Each receipt names its agency (refId), and outstanding is shown per agency (traced lot → centre →
 * agency). A receipt larger than what is owed is refused. The voucher is the record; balances are
 * derived from vouchers.
 */
const NO_AGENCY = '__none__';

export default function AgencyReceipts() {
  const { agencies, agencyReceipts, commissionReceipts, mspBalances, commissionBalances, recordAgencyReceipt, deleteAgencyReceipt } = useMarketingData();
  const { accounts } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const bankIds = getBankAccountIds(accounts);
  const bankAccounts = accounts.filter(a => bankIds.includes(a.id));
  const accountName = (id?: string) => { const a = accounts.find(x => x.id === id); return a ? (hi ? a.nameHi : a.name) : id || ''; };
  const agencyLabel = (id?: string) => { const a = agencies.find(x => x.id === id); return a ? `${hi && a.nameHi ? a.nameHi : a.name}${a.code ? ` (${a.code})` : ''}` : ''; };

  const [against, setAgainst] = useState<'msp' | 'commission'>('msp');
  const [agencyId, setAgencyId] = useState(agencies[0]?.id || NO_AGENCY);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('bank');
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || '');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  const selAgency = agencyId === NO_AGENCY ? undefined : agencyId;
  const balances = against === 'commission' ? commissionBalances : mspBalances;
  const cap = receiptCap(balances, selAgency);

  const save = () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast({ title: hi ? 'राशि डालें' : 'Enter amount', variant: 'destructive' }); return; }
    if (agencies.length > 0 && !selAgency) { toast({ title: hi ? 'एजेंसी चुनें' : 'Select the agency', variant: 'destructive' }); return; }
    const v = recordAgencyReceipt({ amount: amt, mode, bankAccountId: mode === 'bank' ? (bankId || undefined) : undefined, date, note: note.trim() || undefined, agencyId: selAgency, against });
    if (v.id) { setAmount(''); setNote(''); }
  };

  const receiptDr = (v: { lines?: { accountId: string; type: string; amount: number }[]; debitAccountId?: string }) => {
    const dr = v.lines?.find(l => l.type === 'Dr');
    return dr ? accountName(dr.accountId) : accountName(v.debitAccountId);
  };
  const allReceipts = [...agencyReceipts, ...commissionReceipts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const agencyRows = agencies.filter(a => (mspBalances.byAgency[a.id] ?? 0) !== 0 || (commissionBalances.byAgency[a.id] ?? 0) !== 0);
  const hasUnallocated = mspBalances.unallocated !== 0 || commissionBalances.unallocated !== 0;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'एजेंसी रसीद' : 'Agency Receipt'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'एजेंसी से MSP प्रतिपूर्ति या कमीशन की प्राप्ति दर्ज करें' : 'Record MSP reimbursement or commission received from the agency'}</p>
        </div>
      </div>

      <Card className="border-primary/30">
        <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'एजेंसी से बकाया' : 'Outstanding from agencies'}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 items-center">
            <span className="text-xs text-muted-foreground">{hi ? 'एजेंसी' : 'Agency'}</span>
            <span className="text-xs text-muted-foreground text-right">{hi ? 'MSP प्राप्य' : 'MSP'}</span>
            <span className="text-xs text-muted-foreground text-right">{hi ? 'कमीशन प्राप्य' : 'Commission'}</span>
            {agencyRows.map(a => (
              <div key={a.id} className="contents">
                <span className="min-w-0 truncate">{agencyLabel(a.id)}</span>
                <span className="text-right tabular-nums">{money(mspBalances.byAgency[a.id] ?? 0)}</span>
                <span className="text-right tabular-nums">{money(commissionBalances.byAgency[a.id] ?? 0)}</span>
              </div>
            ))}
            {hasUnallocated && (
              <div className="contents text-muted-foreground">
                <span>{hi ? 'बिना एजेंसी (पुरानी रसीदें / केंद्र रहित लॉट)' : 'No agency (older receipts / lots without centre)'}</span>
                <span className="text-right tabular-nums">{money(mspBalances.unallocated)}</span>
                <span className="text-right tabular-nums">{money(commissionBalances.unallocated)}</span>
              </div>
            )}
            <div className="contents font-semibold">
              <span>{hi ? 'कुल' : 'Total'}</span>
              <span className={`text-right tabular-nums ${mspBalances.total > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(mspBalances.total)}</span>
              <span className={`text-right tabular-nums ${commissionBalances.total > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(commissionBalances.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई रसीद' : 'New Receipt'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'किस बात की प्राप्ति' : 'Received against'} *</Label>
              <Select value={against} onValueChange={v => setAgainst(v as 'msp' | 'commission')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="msp">{hi ? 'MSP प्रतिपूर्ति' : 'MSP reimbursement'}</SelectItem>
                  <SelectItem value="commission">{hi ? 'कमीशन' : 'Commission'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'एजेंसी' : 'Agency'}{agencies.length > 0 ? ' *' : ''}</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'एजेंसी चुनें' : 'Select agency'} /></SelectTrigger>
                <SelectContent>
                  {agencies.length === 0 && <SelectItem value={NO_AGENCY}>{hi ? '— कोई एजेंसी नहीं —' : '— no agency —'}</SelectItem>}
                  {agencies.map(a => <SelectItem key={a.id} value={a.id}>{agencyLabel(a.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'राशि प्राप्त' : 'Amount received'} *</Label>
              <Input type="number" min={0} max={cap} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
              <p className="text-[11px] text-muted-foreground">{hi ? 'अधिकतम (बकाया)' : 'Max (outstanding)'}: {money(cap)}</p>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तिथि' : 'Date'} *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'माध्यम' : 'Mode'} *</Label>
              <Select value={mode} onValueChange={v => setMode(v as 'cash' | 'bank')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem>
                  <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'bank' && (
              <div className="space-y-2">
                <Label>{hi ? 'बैंक खाता' : 'Bank Account'}</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? a.nameHi : a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{hi ? 'संदर्भ / टिप्पणी' : 'Reference / Note'}</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder={hi ? 'वैकल्पिक (बिल सं. / UTR)' : 'optional (bill no. / UTR)'} />
          </div>
          <Button onClick={save} className="w-full">{hi ? 'रसीद दर्ज करें' : 'Record Receipt'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'दर्ज रसीदें' : 'Recorded Receipts'} ({allReceipts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {allReceipts.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई रसीद नहीं।' : 'No receipts yet.'}</p>}
          {allReceipts.map(v => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {money(v.amount)} <span className="text-muted-foreground font-normal">· {v.voucherNo}</span>
                  <Badge variant="outline" className="text-[10px]">{v.refType === COMMISSION_RECEIPT_REF_TYPE ? (hi ? 'कमीशन' : 'Commission') : 'MSP'}</Badge>
                  {agencyLabel(v.refId) && <Badge variant="secondary" className="text-[10px]">{agencyLabel(v.refId)}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{v.date} · {receiptDr(v)} {v.narration ? `· ${v.narration}` : ''}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteAgencyReceipt(v.id)} aria-label={hi ? 'रसीद हटाएँ' : 'delete'}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
