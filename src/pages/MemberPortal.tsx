/**
 * Member Portal S3 — /member/:societyId. A member logs in with member number + PIN and sees their own
 * share capital, loans, deposits and KCC — read-only.
 *
 * Isolation: uses memberPortalClient (own storageKey, sessionStorage), never the staff client, and is
 * routed outside ProtectedRoute / CapabilityGuard. Data comes only from member_portal_snapshot() (064),
 * whose identity is auth.uid(); figures are computed by buildPortalView with the staff formulas (RULE 2).
 * The PIN lives only in the input's state until submit.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/dateUtils';
import { KeyRound, LogOut, Printer, Loader2, Landmark, HandCoins, PiggyBank, Wheat } from 'lucide-react';
import { memberSignIn, memberSignOut, hasMemberSession, fetchMemberSnapshot } from '@/lib/memberPortalClient';
import { buildPortalView, deniedMessage, type PortalSnapshot, type PortalDenied } from '@/lib/memberPortalView';

type Phase = 'checking' | 'login' | 'loading' | 'ready' | 'denied';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DEPOSIT_TYPE_HI: Record<string, string> = { SB: 'बचत (SB)', FD: 'सावधि (FD)', RD: 'आवर्ती (RD)', PIGMY: 'पिग्मी' };

export default function MemberPortal() {
  const { societyId = '' } = useParams();
  const { language } = useLanguage();
  const hi = language !== 'en';
  useDocumentMeta({ title: hi ? 'सदस्य portal — सहकार लेखा' : 'Member portal — SahakarLekha', robots: 'noindex, nofollow' });

  const [phase, setPhase] = useState<Phase>('checking');
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [denied, setDenied] = useState('');
  const [memberNo, setMemberNo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    const res = await fetchMemberSnapshot();
    if (res.ok === true) { setSnapshot(res as PortalSnapshot); setPhase('ready'); return; }
    const reason = (res as PortalDenied).reason;
    if (reason === 'network') {
      // A lapsed session also lands here — send the member back to the form rather than a dead end.
      await memberSignOut();
      setError(hi ? 'जानकारी नहीं मिल सकी। कृपया फिर से login करें।' : 'Could not load your details. Please log in again.');
      setPhase('login');
      return;
    }
    setDenied(deniedMessage(reason, hi));
    await memberSignOut();
    setPhase('denied');
  }, [hi]);

  useEffect(() => {
    let live = true;
    void hasMemberSession().then((has) => { if (live) { if (has) void load(); else setPhase('login'); } });
    return () => { live = false; };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!memberNo.trim() || !/^\d{6}$/.test(pin)) {
      setError(hi ? 'सदस्य संख्या और 6 अंकों का PIN भरें।' : 'Enter your member number and 6-digit PIN.');
      return;
    }
    setBusy(true);
    const res = await memberSignIn(societyId, memberNo, pin);
    setBusy(false);
    setPin('');
    if (res.ok === false) {
      setError(res.reason === 'rate_limited'
        ? (hi ? 'बहुत बार कोशिश हुई। कुछ मिनट बाद फिर करें।' : 'Too many attempts. Please try again in a few minutes.')
        : res.reason === 'network'
          ? (hi ? 'सर्वर से संपर्क नहीं हो सका। इंटरनेट जाँचें।' : 'Could not reach the server. Check your internet.')
          : (hi ? 'सदस्य संख्या या PIN गलत है।' : 'Member number or PIN is incorrect.'));
      return;
    }
    await load();
  };

  const logout = async () => {
    await memberSignOut();
    setSnapshot(null);
    setMemberNo('');
    setPhase('login');
  };

  const view = useMemo(() => (snapshot ? buildPortalView(snapshot) : null), [snapshot]);
  const societyName = snapshot?.society ? ((hi ? snapshot.society.nameHi : snapshot.society.name) || snapshot.society.name || '') : '';

  if (phase === 'checking' || phase === 'loading') {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (phase === 'login' || phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-muted/30">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><KeyRound className="h-6 w-6 text-primary" /></div>
            <CardTitle className="text-xl">{hi ? 'सदस्य portal' : 'Member portal'}</CardTitle>
            <p className="text-sm text-muted-foreground">{hi ? 'अपना शेयर, ऋण और जमा का हिसाब देखें' : 'View your shares, loans and deposits'}</p>
          </CardHeader>
          <CardContent>
            {phase === 'denied' && <p className="mb-4 text-sm rounded-md bg-destructive/10 text-destructive p-3">{denied}</p>}
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp-no">{hi ? 'सदस्य संख्या' : 'Member number'}</Label>
                <Input id="mp-no" value={memberNo} onChange={(e) => setMemberNo(e.target.value)} autoComplete="username" autoCapitalize="characters" placeholder={hi ? 'जैसे M-001' : 'e.g. M-001'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-pin">PIN</Label>
                <Input id="mp-pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="current-password"
                  value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="tracking-widest text-lg" />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{hi ? 'देखें' : 'Log in'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {hi ? 'PIN भूल गए? समिति कार्यालय से नया PIN लें।' : 'Forgot your PIN? Ask the society office for a new one.'}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = snapshot!.member;
  const v = view!;
  const summary = [
    { icon: Landmark, label: hi ? 'शेयर पूँजी' : 'Share capital', value: v.shareBalance },
    { icon: HandCoins, label: hi ? 'ऋण बकाया' : 'Loan outstanding', value: v.loanOutstandingTotal },
    { icon: PiggyBank, label: hi ? 'कुल जमा' : 'Total deposits', value: v.depositTotal },
    { icon: Wheat, label: hi ? 'KCC बकाया' : 'KCC outstanding', value: v.kccOutstandingTotal },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {societyName && <p className="text-sm text-muted-foreground">{societyName}</p>}
          <h1 className="text-2xl font-bold">{m.name}</h1>
          <p className="text-sm text-muted-foreground">
            {hi ? 'सदस्य संख्या' : 'Member no.'} <span className="font-mono font-semibold text-foreground">{m.memberId}</span>
            {m.joinDate && <> · {hi ? 'सदस्यता' : 'Member since'} {fmtDate(m.joinDate)}</>}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-4 w-4" />{hi ? 'Print / PDF' : 'Print / PDF'}</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={logout}><LogOut className="h-4 w-4" />{hi ? 'बाहर निकलें' : 'Log out'}</Button>
        </div>
      </div>

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
        <CardHeader><CardTitle className="text-base">{hi ? 'शेयर खाता' : 'Share capital ledger'}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{hi ? 'ऋण' : 'Loans'}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{hi ? 'जमा खाते' : 'Deposit accounts'}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{hi ? 'किसान क्रेडिट कार्ड (KCC)' : 'Kisan Credit Card (KCC)'}</CardTitle></CardHeader>
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
          {m.kycStatus && <p><span className="text-muted-foreground">KYC:</span> {m.kycStatus}</p>}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        {hi ? 'यह जानकारी समिति के खातों से ली गई है। कोई अंतर दिखे तो समिति कार्यालय से संपर्क करें। — सहकार लेखा' : 'Taken from the society’s books. Contact the society office if anything looks wrong. — SahakarLekha'}
      </p>
    </div>
  );
}
