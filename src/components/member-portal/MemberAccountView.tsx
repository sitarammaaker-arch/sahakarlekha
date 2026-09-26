/**
 * The member's account, as ONE component shared by the member portal (/member/:societyId) and the
 * staff Member-360 page (/members/:id): summary cards, share ledger, loans, deposits, KCC, the
 * dairy / housing / consumer sections and the profile. Both callers pass views built by the same
 * builders (buildPortalView + buildVerticalViews), so staff and member always see the same thing.
 */
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeader, type SectionLinks } from '@/components/member-portal/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/dateUtils';
import { Landmark, HandCoins, PiggyBank, Wheat, Milk, Home, ShoppingBasket, Coins } from 'lucide-react';
import type { PortalSnapshot, PortalView } from '@/lib/memberPortalView';
import type { VerticalViews } from '@/lib/memberPortalVerticals';
import { PortalVerticals } from '@/components/member-portal/PortalVerticals';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const KYC_HI: Record<string, string> = { verified: 'सत्यापित', pending: 'लंबित', rejected: 'अस्वीकृत' };
const DEPOSIT_TYPE_HI: Record<string, string> = { SB: 'बचत (SB)', FD: 'सावधि (FD)', RD: 'आवर्ती (RD)', PIGMY: 'पिग्मी' };

interface Props {
  member: PortalSnapshot['member'];
  view: PortalView;
  verticals: VerticalViews;
  hi: boolean;
  /** Staff Member-360 only: per-section links to the source page. */
  links?: SectionLinks;
}

export function MemberAccountView({ member: m, view: v, verticals: vv, hi, links }: Props) {
  // Print/PDF must include the collapsed sections (milk entries, credit ledger, deposit rows): open
  // every <details> for the print, then restore. Lives here so the portal AND Member-360 both get it.
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const before = () => document.querySelectorAll('details').forEach((d) => { if (!d.open) { d.open = true; opened.push(d); } });
    const after = () => { opened.splice(0).forEach((d) => { d.open = false; }); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  // Share capital always; every other card only when the member has that kind of account.
  const summary = [
    { icon: Landmark, label: hi ? 'शेयर पूँजी' : 'Share capital', value: v.shareBalance, show: true },
    { icon: HandCoins, label: hi ? 'ऋण बकाया' : 'Loan outstanding', value: v.loanOutstandingTotal, show: v.loans.length > 0 },
    { icon: PiggyBank, label: hi ? 'कुल जमा' : 'Total deposits', value: v.depositTotal, show: v.deposits.length > 0 },
    { icon: Wheat, label: hi ? 'KCC बकाया' : 'KCC outstanding', value: v.kccOutstandingTotal, show: v.kccLoans.length > 0 },
    { icon: Milk, label: hi ? 'दूध भुगतान बाकी' : 'Milk payment due', value: vv.dairy?.passbook.totalOutstanding ?? 0, show: !!vv.dairy },
    { icon: Home, label: hi ? 'रखरखाव बकाया' : 'Maintenance due', value: vv.housing?.statement.outstanding ?? 0, show: !!vv.housing },
    { icon: ShoppingBasket, label: hi ? 'दुकान उधार' : 'Store credit due', value: vv.consumer?.outstanding ?? 0, show: !!vv.consumer },
    { icon: Coins, label: hi ? 'लाभांश बाकी' : 'Dividend due', value: vv.dividend?.dueTotal ?? 0, show: (vv.dividend?.dueTotal ?? 0) > 0 },
  ].filter((c) => c.show);

  return (
    <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <s.icon className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{money(s.value)}</p>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <SectionHeader title={hi ? 'शेयर खाता' : 'Share capital ledger'} link={links?.share} />
          <CardContent className="overflow-x-auto">
            {v.shareLedger.length === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'कोई प्रविष्टि नहीं।' : 'No entries.'}</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                  <TableHead className="text-right">{hi ? 'जमा' : 'Credit'}</TableHead><TableHead className="text-right">{hi ? 'निकासी' : 'Debit'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{v.shareLedger.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell><TableCell>{r.particulars}</TableCell>
                    <TableCell className="text-right">{r.credit ? money(r.credit) : '—'}</TableCell>
                    <TableCell className="text-right">{r.debit ? money(r.debit) : '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{money(r.balance)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {v.loans.length > 0 && (
          <Card>
            <SectionHeader title={hi ? 'ऋण' : 'Loans'} link={links?.loans} />
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'ऋण संख्या' : 'Loan no.'}</TableHead><TableHead>{hi ? 'उद्देश्य' : 'Purpose'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead><TableHead className="text-right">{hi ? 'चुकाया' : 'Repaid'}</TableHead>
                  <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead><TableHead>{hi ? 'देय तिथि' : 'Due'}</TableHead><TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{v.loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.loanNo}</TableCell><TableCell>{l.purpose || '—'}</TableCell>
                    <TableCell className="text-right">{money(l.amount)}</TableCell><TableCell className="text-right">{money(l.repaidAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(l.outstanding)}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.dueDate ? fmtDate(l.dueDate) : '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={l.status === 'overdue' ? 'border-destructive text-destructive' : ''}>
                      {hi ? ({ active: 'चालू', cleared: 'चुकता', overdue: 'अतिदेय' } as Record<string, string>)[l.status] ?? l.status : l.status}
                    </Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {v.deposits.length > 0 && (
          <Card>
            <SectionHeader title={hi ? 'जमा खाते' : 'Deposit accounts'} link={links?.deposits} />
            <CardContent className="space-y-4">
              {v.deposits.map((d) => (
                <details key={d.id} className="rounded-lg border p-3">
                  <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer">
                    <span><span className="font-mono">{d.accountNo}</span> · {hi ? (DEPOSIT_TYPE_HI[d.depositType] ?? d.depositType) : d.depositType}
                      {d.status !== 'active' && <Badge variant="outline" className="ml-2">{d.status}</Badge>}</span>
                    <span className="font-semibold">{money(d.balance)}</span>
                  </summary>
                  <div className="mt-3 text-xs text-muted-foreground space-x-3">
                    <span>{hi ? 'खुला' : 'Opened'}: {fmtDate(d.openDate)}</span>
                    {d.maturityDate && <span>{hi ? 'परिपक्वता' : 'Matures'}: {fmtDate(d.maturityDate)}</span>}
                    {d.interestRate != null && <span>{hi ? 'ब्याज' : 'Interest'}: {d.interestRate}%</span>}
                  </div>
                  {d.transactions.length > 0 && (
                    <div className="overflow-x-auto mt-2">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                          <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead><TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>{d.transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                            <TableCell>{hi ? ({ open: 'खाता खुला', deposit: 'जमा', withdraw: 'निकासी', interest: 'ब्याज', closure: 'खाता बंद' } as Record<string, string>)[t.txnType] ?? t.txnType : t.txnType}</TableCell>
                            <TableCell className="text-right">{money(Number(t.amount) || 0)}</TableCell>
                            <TableCell className="text-right">{money(Number(t.balanceAfter) || 0)}</TableCell>
                          </TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  )}
                </details>
              ))}
            </CardContent>
          </Card>
        )}

        {v.kccLoans.length > 0 && (
          <Card>
            <SectionHeader title={hi ? 'किसान क्रेडिट कार्ड (KCC)' : 'Kisan Credit Card (KCC)'} link={links?.kcc} />
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{hi ? 'ऋण संख्या' : 'Loan no.'}</TableHead><TableHead>{hi ? 'फ़सल' : 'Crop'}</TableHead>
                  <TableHead className="text-right">{hi ? 'स्वीकृत' : 'Sanctioned'}</TableHead><TableHead className="text-right">{hi ? 'निकाला' : 'Drawn'}</TableHead>
                  <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead><TableHead>{hi ? 'देय तिथि' : 'Due'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{v.kccLoans.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono">{k.loanNo}</TableCell><TableCell>{[k.cropName, k.cropSeason].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="text-right">{money(Number(k.sanctionedAmount) || 0)}</TableCell><TableCell className="text-right">{money(k.drawnAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(k.outstanding)}</TableCell>
                    <TableCell className="whitespace-nowrap">{k.dueDate ? fmtDate(k.dueDate) : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <PortalVerticals views={vv} hi={hi} links={links} />

        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'परिचय' : 'Profile'}</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {m.fatherName && <p><span className="text-muted-foreground">{hi ? 'पिता/पति:' : 'Father/Husband:'}</span> {m.fatherName}</p>}
            {m.address && <p><span className="text-muted-foreground">{hi ? 'पता:' : 'Address:'}</span> {m.address}</p>}
            {m.shareCertNo && <p><span className="text-muted-foreground">{hi ? 'शेयर प्रमाणपत्र:' : 'Share certificate:'}</span> {m.shareCertNo}</p>}
            {(m.nominees?.length ? m.nominees.map((n) => n.name).filter(Boolean).join(', ') : m.nomineeName) && (
              <p><span className="text-muted-foreground">{hi ? 'नामांकित (nominee):' : 'Nominee:'}</span> {m.nominees?.length ? m.nominees.map((n) => n.name).filter(Boolean).join(', ') : m.nomineeName}</p>
            )}
            {m.aadhaarMasked && <p><span className="text-muted-foreground">Aadhaar:</span> <span className="font-mono">{m.aadhaarMasked}</span></p>}
            {m.panMasked && <p><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{m.panMasked}</span></p>}
            {m.kycStatus && <p><span className="text-muted-foreground">KYC:</span> {hi ? (KYC_HI[m.kycStatus] ?? m.kycStatus) : m.kycStatus}</p>}
          </CardContent>
        </Card>
    </>
  );
}
