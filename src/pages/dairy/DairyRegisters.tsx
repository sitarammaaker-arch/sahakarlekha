import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/exportUtils';
import { buildCollectionRegister, buildSettlementRegister, buildRecoverySummary, buildMemberPassbook } from '@/lib/dairy/registers';
import { FileSpreadsheet, Download } from 'lucide-react';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
const monthStart = () => { const d = new Date().toISOString().slice(0, 10); return d.slice(0, 8) + '01'; };
const today = () => new Date().toISOString().slice(0, 10);

export default function DairyRegisters() {
  const { members } = useData();
  const { milkEntries, settlements } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [passMember, setPassMember] = useState('');

  const collection = useMemo(() => buildCollectionRegister(milkEntries, from, to), [milkEntries, from, to]);
  const settlementReg = useMemo(() => buildSettlementRegister(settlements), [settlements]);
  const recovery = useMemo(() => buildRecoverySummary(settlements), [settlements]);
  const passbook = useMemo(() => passMember ? buildMemberPassbook(milkEntries, settlements, passMember) : null, [milkEntries, settlements, passMember]);
  const memberName = (id: string) => members.find(m => m.id === id)?.name || id;

  const shiftHi = (s: string) => s === 'morning' ? 'सुबह' : s === 'evening' ? 'शाम' : s;

  const exportCollection = () => downloadCSV(
    [hi ? 'तिथि' : 'Date', hi ? 'पाली' : 'Shift', hi ? 'सदस्य' : 'Member', hi ? 'लीटर' : 'Litres', 'fat', 'SNF', hi ? 'दर' : 'Rate', hi ? 'राशि' : 'Amount'],
    collection.rows.map(e => [e.date, hi ? shiftHi(e.shift) : e.shift, e.memberName, e.qty, e.fat, e.snf, e.rate, e.amount]),
    `milk-collection-${from}-to-${to}.csv`,
  );
  const exportSettlement = () => downloadCSV(
    [hi ? 'संख्या' : 'No', hi ? 'सदस्य' : 'Member', hi ? 'से' : 'From', hi ? 'तक' : 'To', hi ? 'सकल' : 'Gross', hi ? 'कटौती' : 'Deductions', hi ? 'नेट' : 'Net', hi ? 'भुगतान' : 'Paid', hi ? 'बकाया' : 'Outstanding', hi ? 'स्थिति' : 'Status'],
    settlementReg.rows.map(r => [r.settlementNo || '', r.memberName, r.from, r.to, r.gross, r.deductions, r.netPayable, r.amountPaid, r.outstanding, r.status]),
    'dairy-settlements.csv',
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><FileSpreadsheet className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'दुग्ध रजिस्टर व रिपोर्ट' : 'Dairy Registers & Reports'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'संकलन · सेटलमेंट · वसूली · सदस्य पासबुक' : 'Collection · Settlement · Recovery · Member passbook'}</p>
        </div>
      </div>

      <Tabs defaultValue="collection">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="collection">{hi ? 'संकलन रजिस्टर' : 'Collection'}</TabsTrigger>
          <TabsTrigger value="settlement">{hi ? 'सेटलमेंट रजिस्टर' : 'Settlement'}</TabsTrigger>
          <TabsTrigger value="recovery">{hi ? 'वसूली' : 'Recovery'}</TabsTrigger>
          <TabsTrigger value="passbook">{hi ? 'सदस्य पासबुक' : 'Passbook'}</TabsTrigger>
        </TabsList>

        {/* Collection register */}
        <TabsContent value="collection">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'दुग्ध संकलन रजिस्टर' : 'Milk Collection Register'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div className="space-y-1"><Label>{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label>{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
                <div className="sm:col-span-2 flex sm:justify-end items-end"><Button variant="outline" onClick={exportCollection} disabled={collection.rows.length === 0} className="gap-1"><Download className="h-4 w-4" />CSV</Button></div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{collection.count} {hi ? 'एंट्री' : 'entries'}</Badge>
                <Badge variant="secondary">{collection.totalQty.toFixed(1)} {hi ? 'लीटर' : 'L'}</Badge>
                <Badge variant="secondary">{hi ? 'औसत fat' : 'avg fat'} {collection.avgFat}</Badge>
                <Badge variant="secondary">{hi ? 'औसत SNF' : 'avg SNF'} {collection.avgSnf}</Badge>
                <Badge>{inr(collection.totalAmount)}</Badge>
              </div>
              {collection.rows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'इस अवधि में कोई संकलन नहीं।' : 'No collection in this period.'}</p> : (
                <div className="overflow-x-auto max-h-[60vh]"><Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'पाली' : 'Shift'}</TableHead><TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                    <TableHead className="text-right">{hi ? 'लीटर' : 'L'}</TableHead><TableHead className="text-right">fat</TableHead><TableHead className="text-right">SNF</TableHead>
                    <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{collection.rows.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{e.date}</TableCell><TableCell>{hi ? shiftHi(e.shift) : e.shift}</TableCell><TableCell>{e.memberName}</TableCell>
                      <TableCell className="text-right">{e.qty.toFixed(1)}</TableCell><TableCell className="text-right">{e.fat || '—'}</TableCell><TableCell className="text-right">{e.snf || '—'}</TableCell>
                      <TableCell className="text-right">{e.rate.toFixed(2)}</TableCell><TableCell className="text-right font-medium">{inr(e.amount)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlement register */}
        <TabsContent value="settlement">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'सेटलमेंट रजिस्टर' : 'Settlement Register'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{hi ? 'सकल' : 'Gross'} {inr(settlementReg.totalGross)}</Badge>
                  <Badge variant="secondary">{hi ? 'कटौती' : 'Ded'} {inr(settlementReg.totalDeductions)}</Badge>
                  <Badge variant="secondary">{hi ? 'नेट' : 'Net'} {inr(settlementReg.totalNet)}</Badge>
                  <Badge variant="secondary">{hi ? 'भुगतान' : 'Paid'} {inr(settlementReg.totalPaid)}</Badge>
                  <Badge className="bg-amber-600">{hi ? 'बकाया' : 'Outstanding'} {inr(settlementReg.totalOutstanding)}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={exportSettlement} disabled={settlementReg.rows.length === 0} className="gap-1"><Download className="h-4 w-4" />CSV</Button>
              </div>
              {settlementReg.rows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'कोई सेटलमेंट नहीं।' : 'No settlements.'}</p> : (
                <div className="overflow-x-auto max-h-[60vh]"><Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'संख्या' : 'No'}</TableHead><TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead><TableHead>{hi ? 'चक्र' : 'Cycle'}</TableHead>
                    <TableHead className="text-right">{hi ? 'सकल' : 'Gross'}</TableHead><TableHead className="text-right">{hi ? 'कटौती' : 'Ded'}</TableHead><TableHead className="text-right">{hi ? 'नेट' : 'Net'}</TableHead>
                    <TableHead className="text-right">{hi ? 'भुगतान' : 'Paid'}</TableHead><TableHead className="text-right">{hi ? 'बकाया' : 'Out'}</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{settlementReg.rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.settlementNo || '—'}</TableCell><TableCell>{r.memberName}</TableCell><TableCell className="text-xs">{r.from}→{r.to}</TableCell>
                      <TableCell className="text-right">{inr(r.gross)}</TableCell><TableCell className="text-right">{inr(r.deductions)}</TableCell><TableCell className="text-right">{inr(r.netPayable)}</TableCell>
                      <TableCell className="text-right">{inr(r.amountPaid)}</TableCell><TableCell className="text-right font-medium text-amber-700">{inr(r.outstanding)}</TableCell>
                      <TableCell><Badge variant={r.status === 'draft' ? 'secondary' : 'default'} className="text-[10px]">{r.status === 'draft' ? (hi ? 'ड्राफ्ट' : 'draft') : (hi ? 'स्वीकृत' : 'appr')}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recovery summary */}
        <TabsContent value="recovery">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'वसूली सारांश (प्रकार-वार)' : 'Recovery Summary (by type)'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {recovery.rows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'कोई वसूली नहीं।' : 'No recoveries.'}</p> : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow><TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead><TableHead className="text-right">{hi ? 'गिनती' : 'Count'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {recovery.rows.map(r => <TableRow key={r.type}><TableCell>{r.type}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right font-medium">{inr(r.amount)}</TableCell></TableRow>)}
                    <TableRow className="font-semibold border-t-2"><TableCell>{hi ? 'कुल' : 'Total'}</TableCell><TableCell></TableCell><TableCell className="text-right">{inr(recovery.total)}</TableCell></TableRow>
                  </TableBody>
                </Table></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Member passbook */}
        <TabsContent value="passbook">
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'सदस्य दुग्ध पासबुक' : 'Member Milk Passbook'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-xs">
                <Select value={passMember} onValueChange={setPassMember}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                  <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!passbook ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'सदस्य चुनें।' : 'Select a member.'}</p> : (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{passbook.totalQty.toFixed(1)} {hi ? 'लीटर' : 'L'}</Badge>
                    <Badge variant="secondary">{hi ? 'सकल' : 'Gross'} {inr(passbook.totalGross)}</Badge>
                    <Badge variant="secondary">{hi ? 'नेट' : 'Net'} {inr(passbook.totalNet)}</Badge>
                    <Badge variant="secondary">{hi ? 'भुगतान' : 'Paid'} {inr(passbook.totalPaid)}</Badge>
                    <Badge className="bg-amber-600">{hi ? 'बकाया' : 'Outstanding'} {inr(passbook.totalOutstanding)}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-1">{hi ? 'संकलन' : 'Collections'} ({passbook.collections.length})</p>
                      <div className="overflow-x-auto max-h-[40vh] border rounded"><Table>
                        <TableHeader><TableRow><TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead className="text-right">{hi ? 'लीटर' : 'L'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amt'}</TableHead></TableRow></TableHeader>
                        <TableBody>{passbook.collections.map(e => <TableRow key={e.id}><TableCell className="text-xs">{e.date} {hi ? shiftHi(e.shift) : e.shift}</TableCell><TableCell className="text-right">{e.qty.toFixed(1)}</TableCell><TableCell className="text-right">{inr(e.amount)}</TableCell></TableRow>)}</TableBody>
                      </Table></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">{hi ? 'सेटलमेंट' : 'Settlements'} ({passbook.settlements.length})</p>
                      <div className="overflow-x-auto max-h-[40vh] border rounded"><Table>
                        <TableHeader><TableRow><TableHead>{hi ? 'संख्या' : 'No'}</TableHead><TableHead className="text-right">{hi ? 'नेट' : 'Net'}</TableHead><TableHead className="text-right">{hi ? 'भुगतान' : 'Paid'}</TableHead></TableRow></TableHeader>
                        <TableBody>{passbook.settlements.map(s => <TableRow key={s.id}><TableCell className="text-xs">{s.settlementNo || (s.from + '→' + s.to)}</TableCell><TableCell className="text-right">{inr(s.netPayable)}</TableCell><TableCell className="text-right">{inr(s.amountPaid)}</TableCell></TableRow>)}</TableBody>
                      </Table></div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
