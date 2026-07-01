import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/exportUtils';
import { buildMemberStatement } from '@/lib/housing/statement';
import { BookMarked, Download } from 'lucide-react';

export default function MemberStatement() {
  const { members, vouchers } = useData();
  const { maintenanceBills, housingFlats } = useHousingData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [memberId, setMemberId] = useState('');
  const member = members.find(m => m.id === memberId);

  const memberBills = useMemo(
    () => maintenanceBills.filter(b => !b.isDeleted && b.memberId === memberId),
    [maintenanceBills, memberId],
  );
  const statement = useMemo(() => buildMemberStatement(memberBills, vouchers), [memberBills, vouchers]);
  const billById = (id?: string) => memberBills.find(b => b.id === id);
  const memberFlats = housingFlats.filter(f => !f.isDeleted && f.memberId === memberId);

  const exportCsv = () => {
    if (!member) return;
    downloadCSV(
      [hi ? 'तिथि' : 'Date', hi ? 'प्रकार' : 'Type', hi ? 'संदर्भ' : 'Ref', hi ? 'विवरण' : 'Particulars', hi ? 'नाम (मांग)' : 'Debit', hi ? 'जमा (वसूली)' : 'Credit', hi ? 'शेष' : 'Balance'],
      statement.rows.map(r => [r.date, r.kind === 'demand' ? (hi ? 'मांग' : 'Demand') : r.kind === 'interest' ? (hi ? 'ब्याज' : 'Interest') : (hi ? 'वसूली' : 'Receipt'), r.ref, r.particulars, r.debit || '', r.credit || '', r.balance]),
      `member-statement-${member.memberId}`,
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookMarked className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सदस्य विवरण (रखरखाव)' : 'Member Statement (Maintenance)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'सदस्य की मांगें, वसूली और चालू बकाया — एक जगह' : 'A member’s demands, receipts and running outstanding — in one place'}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>{hi ? 'सदस्य चुनें' : 'Select member'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {member && statement.rows.length > 0 && (
              <div className="flex sm:justify-end">
                <Button variant="outline" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />{hi ? 'CSV निर्यात' : 'Export CSV'}</Button>
              </div>
            )}
          </div>
          {members.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई सदस्य नहीं — पहले सदस्य जोड़ें।' : 'No members yet — add members first.'}</p>}
        </CardContent>
      </Card>

      {member && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryChip label={hi ? 'कुल मांग' : 'Demanded'} value={money(statement.totalDemanded)} />
            <SummaryChip label={hi ? 'ब्याज' : 'Interest'} value={money(statement.totalInterest)} />
            <SummaryChip label={hi ? 'कुल वसूली' : 'Received'} value={money(statement.totalReceived)} />
            <SummaryChip label={hi ? 'बकाया' : 'Outstanding'} value={money(statement.outstanding)} amber={statement.outstanding > 0} />
            <SummaryChip label={hi ? 'शेयर पूंजी' : 'Share capital'} value={money(member.shareCapital || 0)} />
          </div>

          {memberFlats.length > 0 && (
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
              <span>{hi ? 'फ्लैट' : 'Flats'}:</span>
              {memberFlats.map(f => <Badge key={f.id} variant="secondary">{f.flatNo}{f.blockNo ? ` · ${f.blockNo}` : ''}</Badge>)}
            </div>
          )}

          {/* Ledger */}
          <Card>
            <CardHeader><CardTitle className="text-base">{hi ? 'खाता विवरण' : 'Statement of Account'} ({statement.rows.length})</CardTitle></CardHeader>
            <CardContent>
              {statement.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{hi ? 'इस सदस्य के लिए कोई रखरखाव बिल/वसूली नहीं।' : 'No maintenance bills or receipts for this member.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                        <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                        <TableHead className="text-right">{hi ? 'मांग' : 'Demand'}</TableHead>
                        <TableHead className="text-right">{hi ? 'वसूली' : 'Receipt'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.rows.map((r, i) => {
                        const bill = r.kind === 'demand' ? billById(r.billId) : undefined;
                        return (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={r.kind === 'demand' ? 'outline' : r.kind === 'interest' ? 'destructive' : 'default'} className="shrink-0">{r.kind === 'demand' ? (hi ? 'मांग' : 'Demand') : r.kind === 'interest' ? (hi ? 'ब्याज' : 'Interest') : (hi ? 'वसूली' : 'Receipt')}</Badge>
                                <span className="text-xs text-muted-foreground">{r.ref}</span>
                              </div>
                              <div className="text-sm">{r.particulars}</div>
                              {bill?.lines && bill.lines.length > 1 && (
                                <div className="text-xs text-muted-foreground/80">{bill.lines.map(l => `${l.name} ${money(l.amount)}`).join(' · ')}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">{r.debit ? money(r.debit) : ''}</TableCell>
                            <TableCell className="text-right whitespace-nowrap text-emerald-600">{r.credit ? money(r.credit) : ''}</TableCell>
                            <TableCell className="text-right whitespace-nowrap font-medium">{money(r.balance)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryChip({ label, value, amber }: { label: string; value: string; amber?: boolean }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${amber ? 'text-amber-600' : ''}`}>{value}</div>
    </div>
  );
}
