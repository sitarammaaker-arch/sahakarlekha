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
import { fmtDate } from '@/lib/dateUtils';
import { Languages, KeyRound, LogOut, Printer, Loader2 } from 'lucide-react';
import { memberSignIn, memberSignOut, hasMemberSession, fetchMemberSnapshot } from '@/lib/memberPortalClient';
import { buildPortalView, deniedMessage, type PortalSnapshot, type PortalDenied } from '@/lib/memberPortalView';
import { buildVerticalViews, type PortalVerticalPayload } from '@/lib/memberPortalVerticals';
import { MemberAccountView } from '@/components/member-portal/MemberAccountView';

type Phase = 'checking' | 'login' | 'loading' | 'ready' | 'denied';

export const PORTAL_LANG_KEY = 'sl-member-portal-lang';
function readPortalLang(): 'hi' | 'en' | null {
  try { const v = window.sessionStorage.getItem(PORTAL_LANG_KEY); return v === 'hi' || v === 'en' ? v : null; } catch { return null; }
}
function writePortalLang(v: 'hi' | 'en') {
  try { window.sessionStorage.setItem(PORTAL_LANG_KEY, v); } catch { /* storage blocked — the choice lasts for this page only */ }
}
// Masked-text PIN (-webkit-text-security) is supported in Chrome/Edge/Safari/Firefox 124+; detect once.
const PIN_MASK_SUPPORTED = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc');

type LoginErrorKey = 'fill' | 'rate' | 'network' | 'invalid' | 'reload';
function loginErrorText(k: LoginErrorKey, hi: boolean): string {
  switch (k) {
    case 'fill': return hi ? 'सदस्य संख्या और 6 अंकों का PIN भरें।' : 'Enter your member number and 6-digit PIN.';
    case 'rate': return hi ? 'बहुत बार कोशिश हुई। कुछ मिनट बाद फिर करें।' : 'Too many attempts. Please try again in a few minutes.';
    case 'network': return hi ? 'सर्वर से संपर्क नहीं हो सका। इंटरनेट जाँचें।' : 'Could not reach the server. Check your internet.';
    case 'reload': return hi ? 'जानकारी नहीं मिल सकी। कृपया फिर से login करें।' : 'Could not load your details. Please log in again.';
    default: return hi ? 'सदस्य संख्या या PIN गलत है।' : 'Member number or PIN is incorrect.';
  }
}


export default function MemberPortal() {
  const { societyId = '' } = useParams();
  const { language } = useLanguage();
  // Portal-only language (sessionStorage, like the session). Deliberately NOT setLanguage(): on a shared
  // office computer a member choosing English must not flip the staff app's language too.
  const [lang, setLang] = useState<'hi' | 'en'>(() => readPortalLang() ?? (language === 'en' ? 'en' : 'hi'));
  const hi = lang !== 'en';
  const toggleLang = () => { const next = hi ? 'en' : 'hi'; setLang(next); writePortalLang(next); };
  const langToggle = (
    <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={toggleLang} aria-label={hi ? 'Switch to English' : 'हिंदी में देखें'}>
      <Languages className="h-4 w-4" />{hi ? 'English' : 'हिंदी'}
    </Button>
  );
  useDocumentMeta({ title: hi ? 'सदस्य portal — सहकार लेखा' : 'Member portal — SahakarLekha', robots: 'noindex, nofollow' });

  const [phase, setPhase] = useState<Phase>('checking');
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [denied, setDenied] = useState('');
  const [memberNo, setMemberNo] = useState('');
  const [pin, setPin] = useState('');
  // Codes, not text: rendered in the CURRENT language, so the toggle also translates a shown error.
  const [errorKey, setErrorKey] = useState<LoginErrorKey | ''>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    const res = await fetchMemberSnapshot();
    if (res.ok === true) { setSnapshot(res as PortalSnapshot); setPhase('ready'); return; }
    const reason = (res as PortalDenied).reason;
    if (reason === 'network') {
      // A lapsed session also lands here — send the member back to the form rather than a dead end.
      await memberSignOut();
      setErrorKey('reload');
      setPhase('login');
      return;
    }
    setDenied(reason);
    await memberSignOut();
    setPhase('denied');
  }, []);

  useEffect(() => {
    let live = true;
    void hasMemberSession().then((has) => { if (live) { if (has) void load(); else setPhase('login'); } });
    return () => { live = false; };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey('');
    if (!memberNo.trim() || !/^\d{6}$/.test(pin)) {
      setErrorKey('fill');
      return;
    }
    setBusy(true);
    const res = await memberSignIn(societyId, memberNo, pin);
    setBusy(false);
    setPin('');
    if (res.ok === false) {
      setErrorKey(res.reason === 'rate_limited' ? 'rate' : res.reason === 'network' ? 'network' : 'invalid');
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
  // S4b: dairy / housing / consumer — only the verticals this member has data in.
  const verticals = useMemo(
    () => (snapshot ? buildVerticalViews(snapshot.member.id, snapshot as PortalSnapshot & PortalVerticalPayload, new Date().toISOString().slice(0, 10)) : null),
    [snapshot],
  );
  const societyName = snapshot?.society ? ((hi ? snapshot.society.nameHi : snapshot.society.name) || snapshot.society.name || '') : '';

  if (phase === 'checking' || phase === 'loading') {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (phase === 'login' || phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-muted/30">
        <Card className="w-full max-w-sm relative">
          <div className="absolute right-2 top-2">{langToggle}</div>
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><KeyRound className="h-6 w-6 text-primary" /></div>
            <CardTitle className="text-xl">{hi ? 'सदस्य portal' : 'Member portal'}</CardTitle>
            <p className="text-sm text-muted-foreground">{hi ? 'अपना शेयर, ऋण और जमा का हिसाब देखें' : 'View your shares, loans and deposits'}</p>
          </CardHeader>
          <CardContent>
            {phase === 'denied' && <p className="mb-4 text-sm rounded-md bg-destructive/10 text-destructive p-3">{deniedMessage(denied, hi)}</p>}
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp-no">{hi ? 'सदस्य संख्या' : 'Member number'}</Label>
                <Input id="mp-no" name="member-no" value={memberNo} onChange={(e) => setMemberNo(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={hi ? 'जैसे M-001' : 'e.g. M-001'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-pin">PIN</Label>
                {/* A masked TEXT field with autocomplete="one-time-code": browsers do not offer to save it, so a
                    shared phone never remembers the PIN. Where the mask is unsupported, fall back to type=password
                    so the PIN is never shown in clear. */}
                <Input id="mp-pin" name="member-pin" type={PIN_MASK_SUPPORTED ? 'text' : 'password'} inputMode="numeric" pattern="\d{6}" maxLength={6}
                  autoComplete="one-time-code" autoCorrect="off" spellCheck={false}
                  style={PIN_MASK_SUPPORTED ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : undefined}
                  value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="tracking-widest text-lg" />
              </div>
              {errorKey && <p className="text-sm text-destructive" role="alert">{loginErrorText(errorKey, hi)}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{hi ? 'देखें' : 'Log in'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {hi ? 'PIN भूल गए? समिति कार्यालय से नया PIN लें।' : 'Forgot your PIN? Ask the society office for a new one.'}
              </p>
              <p className="text-xs text-center text-muted-foreground">
                {hi ? 'PIN को browser में save न करें — खासकर साझा फ़ोन पर।' : 'Do not save the PIN in the browser — especially on a shared phone.'}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = snapshot!.member;
  const v = view!;
  const vv = verticals!;


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
        <div className="flex flex-wrap gap-2 print:hidden">
          {langToggle}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-4 w-4" />{hi ? 'Print / PDF' : 'Print / PDF'}</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={logout}><LogOut className="h-4 w-4" />{hi ? 'बाहर निकलें' : 'Log out'}</Button>
        </div>
      </div>

      <MemberAccountView member={m} view={v} verticals={vv} hi={hi} />

      <p className="text-xs text-center text-muted-foreground">
        {hi ? 'यह जानकारी समिति के खातों से ली गई है। कोई अंतर दिखे तो समिति कार्यालय से संपर्क करें। — सहकार लेखा' : 'Taken from the society’s books. Contact the society office if anything looks wrong. — SahakarLekha'}
      </p>
    </div>
  );
}
