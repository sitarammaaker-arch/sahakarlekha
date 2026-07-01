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
import { useToast } from '@/hooks/use-toast';
import { round2 } from '@/lib/housing/billing';
import { buildAgingRegister, plannedBillInterest } from '@/lib/housing/arrears';
import { buildMemberStatement } from '@/lib/housing/statement';
import { generateDemandNoticePDF } from '@/lib/pdf';
import { Clock, Percent, FileWarning } from 'lucide-react';

const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;

export default function OutstandingRegister() {
  const { society, members, vouchers } = useData();
  const { maintenanceBills, housingFlats, runArrearsInterest } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = () => new Date().toISOString().split('T')[0];

  const [asOn, setAsOn] = useState(today());
  const [rate, setRate] = useState('21');
  const [noticeMemberId, setNoticeMemberId] = useState('');

  const memberLabel = (id?: string) => { const m = members.find(x => x.id === id); return m ? `${m.name} (${m.memberId})` : (hi ? '— खाली —' : '— Vacant —'); };
  const aging = useMemo(() => buildAgingRegister(maintenanceBills, asOn), [maintenanceBills, asOn]);

  const accrue = () => {
    const r = Number(rate);
    if (!(r > 0)) { toast({ title: hi ? 'ब्याज दर डालें' : 'Enter interest rate', variant: 'destructive' }); return; }
    runArrearsInterest({ asOnDate: asOn, annualRatePct: r });
  };

  const printNotice = () => {
    const member = members.find(m => m.id === noticeMemberId);
    if (!member) { toast({ title: hi ? 'सदस्य चुनें' : 'Select a member', variant: 'destructive' }); return; }
    const r = Number(rate) || 0;
    const memberBills = maintenanceBills.filter(b => !b.isDeleted && b.memberId === member.id);
    const openBills = memberBills.filter(b => round2((b.amount || 0) - (b.paidAmount || 0)) > 0.005);
    if (openBills.length === 0) { toast({ title: hi ? 'कोई बकाया नहीं' : 'Nothing outstanding', description: memberLabel(member.id) }); return; }
    const currentDue = buildMemberStatement(memberBills, vouchers).outstanding;
    const pendingInterest = round2(openBills.reduce((s, b) => s + plannedBillInterest(b, vouchers, asOn, r).amount, 0));
    const flats = housingFlats.filter(f => !f.isDeleted && f.memberId === member.id).map(f => `${f.flatNo}${f.blockNo ? `/${f.blockNo}` : ''}`).join(', ');
    generateDemandNoticePDF({
      memberName: member.name, memberId: member.memberId, flats,
      asOnDate: asOn, ratePct: r,
      bills: openBills.map(b => ({ billNo: b.billNo, period: b.period, billDate: b.date, outstanding: round2((b.amount || 0) - (b.paidAmount || 0)) })),
      currentDue, pendingInterest, totalDue: round2(currentDue + pendingInterest),
    }, society);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'बकाया रजिस्टर (Arrears)' : 'Outstanding Register (Arrears)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'बकाया रखरखाव की आयु-वार सूची, विलंब ब्याज और मांग सूचना' : 'Aging of outstanding maintenance, penalty interest and demand notices'}</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>{hi ? 'तिथि तक (As on)' : 'As on'}</Label>
              <Input type="date" value={asOn} onChange={e => setAsOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'ब्याज दर (% वार्षिक)' : 'Interest rate (% p.a.)'}</Label>
              <div className="relative">
                <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} />
              </div>
            </div>
            <Button onClick={accrue} className="gap-1"><Percent className="h-4 w-4" />{hi ? 'ब्याज लगाएँ' : 'Accrue interest'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {hi ? 'ब्याज बकाया मूल पर सरल ब्याज से, प्रति बिल केवल नई अवधि पर लगता है (दोबारा चलाने पर दुबारा नहीं).' : 'Simple interest on outstanding principal; each bill is charged only for the un-charged period (safe to re-run).'}
          </p>
        </CardContent>
      </Card>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BUCKETS.map(b => (
          <div key={b} className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">{hi ? 'दिन' : 'Days'} {b}</div>
            <div className="text-lg font-semibold">{money(aging.buckets[b])}</div>
          </div>
        ))}
        <div className="rounded-xl border p-3 bg-amber-50 border-amber-200">
          <div className="text-xs text-muted-foreground">{hi ? 'कुल बकाया' : 'Total due'}</div>
          <div className="text-lg font-semibold text-amber-700">{money(aging.total)}</div>
        </div>
      </div>

      {/* Aging table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'बकाया बिल' : 'Outstanding Bills'} ({aging.rows.length})</CardTitle></CardHeader>
        <CardContent>
          {aging.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'इस तिथि तक कोई बकाया नहीं — सब वसूल।' : 'Nothing outstanding as of this date — all collected.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'फ्लैट' : 'Flat'}</TableHead>
                    <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                    <TableHead>{hi ? 'अवधि' : 'Period'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                    <TableHead>{hi ? 'आयु' : 'Age'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.rows.map(r => (
                    <TableRow key={r.billId}>
                      <TableCell className="whitespace-nowrap font-medium">{r.flatNo}</TableCell>
                      <TableCell className="text-sm">{memberLabel(r.memberId)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.period}</TableCell>
                      <TableCell className="text-right">{r.days}</TableCell>
                      <TableCell><Badge variant={r.bucket === '90+' ? 'destructive' : r.bucket === '61-90' ? 'default' : 'secondary'}>{r.bucket}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">{money(r.outstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demand notice */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileWarning className="h-4 w-4" />{hi ? 'मांग सूचना (PDF)' : 'Demand Notice (PDF)'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={noticeMemberId} onValueChange={setNoticeMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={printNotice} disabled={!noticeMemberId} className="gap-1"><FileWarning className="h-4 w-4" />{hi ? 'मांग सूचना बनाएँ' : 'Generate Notice'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{hi ? 'सूचना में बकाया बिल, अब तक का ब्याज और तिथि तक अनुमानित विलंब ब्याज शामिल है।' : 'The notice includes outstanding bills, charged interest, and estimated interest up to the as-on date.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
