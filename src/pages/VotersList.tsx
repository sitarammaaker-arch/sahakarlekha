/**
 * Voters list / बक़ायादार सूची / आरक्षण सार (member-area audit M5, 2026-10-17) — all "as on" a chosen date.
 *  • Voters: approved, non-nominal members who had joined and not ceased by the date and are not in default
 *    (Haryana Act s.20(d); Rules App. A para 35 — exhibited for objections). Everyone left out is listed with why.
 *  • Defaulters: members with an overdue loan / KCC on the date, with the amount (Act s.25(3)(d), for the AGM).
 *  • Reservation: women / SC / BC counts behind the committee reservation (Act s.28(1): 1 SC, 2 women, 1 BC when
 *    BC members ≥ 10%).
 * Rows come from lib/members/voters — the same rule for the screen, the PDF and the Excel.
 */
import React, { useMemo, useState } from 'react';
import { Vote, Download, FileSpreadsheet, AlertTriangle, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/dateUtils';
import { downloadExcel } from '@/lib/exportUtils';
import { generateVotersListPDF, generateDefaulterListPDF } from '@/lib/pdf';
import { voterRoll, defaulterList, reservationSummary, EXCLUSION_LABEL } from '@/lib/members/voters';
import { isHaryana } from '@/lib/members/admission';

const VotersList: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { can } = useAuth();
  const canExport = can('export');
  const { members, loans, kccLoans, society } = useData();
  const [asOn, setAsOn] = useState(() => new Date().toISOString().split('T')[0]);
  const haryana = isHaryana(society.state);

  const roll = useMemo(() => voterRoll(members, loans, kccLoans, asOn), [members, loans, kccLoans, asOn]);
  const defaulters = useMemo(() => defaulterList(members, loans, kccLoans, asOn), [members, loans, kccLoans, asOn]);
  // Reservation counts over the members on the roll that day (voters + defaulters — defaulters stay members).
  const live = useMemo(() => [...roll.voters, ...roll.excluded.filter(x => x.reason === 'defaulter').map(x => x.member)], [roll]);
  const res = useMemo(() => reservationSummary(live), [live]);
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
  const law = (t: string) => (haryana ? t : '');

  const excelVoters = () => downloadExcel([
    { name: 'Voters', headers: ['S.No', 'Member No.', 'Name', 'Father/Husband', 'Address'], rows: roll.voters.map((m, i) => [i + 1, m.memberId, m.name, m.fatherName || '', m.address || '']) },
    { name: 'Not on the list', headers: ['Member No.', 'Name', 'Reason', 'Overdue'], rows: roll.excluded.map(x => [x.member.memberId, x.member.name, EXCLUSION_LABEL[x.reason], x.overdue ?? '']) },
  ], `voters-list-${asOn}`);
  const excelDefaulters = () => downloadExcel([
    { name: 'Defaulters', headers: ['S.No', 'Member No.', 'Name', 'Father/Husband', 'Overdue', 'Amount'], rows: defaulters.map((d, i) => [i + 1, d.member.memberId, d.member.name, d.member.fatherName || '', d.items.join(', '), d.amount]) },
  ], `defaulters-${asOn}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Vote className="h-7 w-7 text-primary" />{hi ? 'मतदाता सूची' : 'Voters List'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'चुनाव के लिए मतदाता सूची, आम सभा के लिए बक़ायादार सूची और समिति आरक्षण का सार — चुनी गई तिथि पर' : 'Voters list for elections, defaulters list for the general meeting and the committee reservation summary — as on the chosen date'}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vl-date">{hi ? 'किस तिथि की स्थिति' : 'As on'}</Label>
          <Input id="vl-date" type="date" className="w-44" value={asOn} onChange={e => e.target.value && setAsOn(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{hi ? 'मतदाता' : 'Voters'}</p><p className="text-2xl font-bold text-primary">{roll.voters.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{hi ? 'बक़ायादार (मत नहीं)' : 'Defaulters (no vote)'}</p><p className="text-2xl font-bold text-destructive">{defaulters.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{hi ? 'सूची से बाहर (कुल)' : 'Not on the list (total)'}</p><p className="text-2xl font-bold">{roll.excluded.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="voters">
        <TabsList>
          <TabsTrigger value="voters">{hi ? 'मतदाता सूची' : 'Voters'}</TabsTrigger>
          <TabsTrigger value="defaulters">{hi ? 'बक़ायादार सूची' : 'Defaulters'}</TabsTrigger>
          <TabsTrigger value="reservation">{hi ? 'आरक्षण सार' : 'Reservation'}</TabsTrigger>
        </TabsList>

        <TabsContent value="voters">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{hi ? `मतदाता सूची — ${fmtDate(asOn)}` : `Voters — ${fmtDate(asOn)}`}</CardTitle>
              {canExport && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => generateVotersListPDF(roll.voters, society, asOn)} disabled={!roll.voters.length}><Download className="h-4 w-4" />PDF</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={excelVoters}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">{hi
                ? `स्वीकृत, नाममात्र नहीं, उस तिथि तक सदस्य बने और सदस्यता समाप्त न हुई हो, और बक़ायादार न हों${law(' (हरियाणा अधिनियम धारा 20)')}। सूची सूचना-पट पर आपत्तियों के लिए लगाई जाती है${law(' (नियम, परिशिष्ट A — 300 से अधिक सदस्य वाली प्राथमिक समिति: भाग III पैरा 35; 300 तक: भाग IV)')}।`
                : 'Approved, not nominal, a member by the date, not ceased and not in default (Act s.20). The list is exhibited for objections.'}</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-12">#</TableHead><TableHead>{hi ? 'सदस्य नं.' : 'Member No.'}</TableHead><TableHead>{hi ? 'नाम' : 'Name'}</TableHead><TableHead>{hi ? 'पिता/पति' : 'Father/Husband'}</TableHead><TableHead>{hi ? 'पता' : 'Address'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {roll.voters.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{hi ? 'इस तिथि पर कोई मतदाता नहीं।' : 'No voters on this date.'}</TableCell></TableRow>}
                    {roll.voters.map((m, i) => (
                      <TableRow key={m.id}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-mono">{m.memberId}</TableCell><TableCell className="font-medium">{m.name}</TableCell><TableCell>{m.fatherName || '—'}</TableCell><TableCell className="max-w-56 truncate">{m.address || '—'}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {roll.excluded.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">{hi ? `सूची में नहीं — ${roll.excluded.length} (कारण सहित)` : `Not on the list — ${roll.excluded.length} (with reasons)`}</summary>
                  <div className="mt-2 overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>{hi ? 'सदस्य नं.' : 'Member No.'}</TableHead><TableHead>{hi ? 'नाम' : 'Name'}</TableHead><TableHead>{hi ? 'कारण' : 'Reason'}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {roll.excluded.map(x => (
                          <TableRow key={x.member.id}><TableCell className="font-mono">{x.member.memberId}</TableCell><TableCell>{x.member.name}</TableCell><TableCell className="text-xs">{EXCLUSION_LABEL[x.reason]}{x.overdue ? ` — ${fmt(x.overdue)}` : ''}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaulters">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{hi ? `बक़ायादार सूची — ${fmtDate(asOn)}` : `Defaulters — ${fmtDate(asOn)}`}</CardTitle>
              {canExport && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => generateDefaulterListPDF(defaulters, society, asOn)} disabled={!defaulters.length}><Download className="h-4 w-4" />PDF</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={excelDefaulters}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{hi
                ? `जिनका कोई ऋण/KCC "अतिदेय" चिह्नित है, या जिसकी तय तारीख़ निकल चुकी है और राशि बाक़ी है। आम सभा में यह सूची रखी जाती है${law(' (धारा 25(3)(d))')}; बक़ायादार मत नहीं दे सकते${law(' (धारा 20(d))')}।`
                : 'Members with a loan / KCC marked overdue, or past its due date with a balance. Placed before the AGM (s.25(3)(d)); defaulters cannot vote (s.20(d)).'}</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>{hi ? 'सदस्य नं.' : 'Member No.'}</TableHead><TableHead>{hi ? 'नाम' : 'Name'}</TableHead><TableHead>{hi ? 'अतिदेय' : 'Overdue'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {defaulters.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{hi ? 'इस तिथि पर कोई बक़ायादार नहीं।' : 'No defaulters on this date.'}</TableCell></TableRow>}
                    {defaulters.map((d, i) => (
                      <TableRow key={d.member.id}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-mono">{d.member.memberId}</TableCell><TableCell className="font-medium">{d.member.name}</TableCell><TableCell className="text-xs">{d.items.join(', ')}</TableCell><TableCell className="text-right tabular-nums">{fmt(d.amount)}</TableCell></TableRow>
                    ))}
                    {defaulters.length > 0 && <TableRow className="font-semibold"><TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell><TableCell className="text-right tabular-nums">{fmt(defaulters.reduce((s, d) => s + d.amount, 0))}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservation">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />{hi ? 'समिति आरक्षण — सदस्यों का सार' : 'Committee reservation — member summary'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{hi
                ? `हर समिति में कम से कम 1 अनुसूचित जाति व 2 महिला सदस्य; पिछड़ा वर्ग के सदस्य कुल के 10% या अधिक हों तो 1 पिछड़ा वर्ग सदस्य${law(' (हरियाणा अधिनियम धारा 28(1), 2013 संशोधन)')}। गिनती ${fmtDate(asOn)} के सदस्यों (${res.total}) पर।`
                : `At least 1 SC and 2 women on every committee; 1 BC member when BC members are 10% or more (Act s.28(1)). Counted over the ${res.total} members on ${fmtDate(asOn)}.`}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{hi ? 'महिला सदस्य' : 'Women members'}</p><p className="text-xl font-bold">{res.women}</p><Badge variant={res.women >= 2 ? 'secondary' : 'destructive'} className="mt-1 text-[10px]">{res.women >= 2 ? (hi ? '2 महिला सीटें भरी जा सकती हैं' : '2 women seats can be filled') : (hi ? '2 से कम' : 'fewer than 2')}</Badge></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{hi ? 'अनुसूचित जाति' : 'Scheduled Caste'}</p><p className="text-xl font-bold">{res.sc}</p><Badge variant={res.sc >= 1 ? 'secondary' : 'destructive'} className="mt-1 text-[10px]">{res.sc >= 1 ? (hi ? '1 सीट भरी जा सकती है' : '1 seat can be filled') : (hi ? 'कोई SC सदस्य नहीं' : 'no SC member')}</Badge></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{hi ? 'पिछड़ा वर्ग' : 'Backward Class'}</p><p className="text-xl font-bold">{res.bc} <span className="text-sm font-normal text-muted-foreground">({res.bcPercent}%)</span></p><Badge variant="secondary" className="mt-1 text-[10px]">{res.bcSeatRequired ? (hi ? '≥ 10% — 1 BC सीट ज़रूरी' : '≥ 10% — 1 BC seat required') : (hi ? '10% से कम — BC सीट ज़रूरी नहीं' : 'under 10% — no BC seat')}</Badge></div>
              </div>
              {res.genderUnknown > 0 && (
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{hi ? `${res.genderUnknown} सदस्यों का लिंग दर्ज नहीं — महिला सदस्यों की गिनती अधूरी है। सदस्य page पर "संपादित करें" से लिंग भरें।` : `${res.genderUnknown} members have no gender recorded — the women count is incomplete. Add it via Edit on the Members page.`}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VotersList;
