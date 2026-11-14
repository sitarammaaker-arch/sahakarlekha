/**
 * Partner portal (migration 168) — /partner/login and /partner/portal.
 *
 *   Login: email → the partner-auth Edge Function emails a 6-digit code (it answers the same for any email, so nobody
 *   learns who is a partner) → partner_login_verify(email, code) returns a 30-day session token kept in localStorage.
 *   Portal: partner_portal(session) — status, referral code + link, societies, commission, payouts, and the partner's
 *   PAN / bank / UPI shown MASKED. Changing them files a request (partner_details_request) that does nothing until the
 *   platform admin approves it, so a stolen session cannot redirect a payout.
 * Not a Supabase Auth login: the society app's session and RLS are untouched.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta, useNoIndex } from '@/lib/useDocumentMeta';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { LogOut, Mail, KeyRound, CheckCircle2, Clock, PauseCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import {
  loadPartnerSession, savePartnerSession, clearPartnerSession, normalizeLoginEmail, isLoginEmail, isLoginCode,
  loginErrorText, type MaskedDetails,
} from '@/lib/referral/partnerSession';
import { payoutErrorText, type PartnerSocietyRow, type CommissionRow } from '@/lib/referral/referralCode';
import {
  CopyRow, referralLink, istDate, PartnerSocieties, PartnerCommissions, PartnerPayouts, type PartnerPayoutsData,
} from '@/pages/PartnerProgram';

const storage = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

// ── /partner/login ─────────────────────────────────────────────────────────────────────────────────────────────
export const PartnerLogin: React.FC = () => {
  useNoIndex();
  useDocumentMeta({ title: 'Partner login — SahakarLekha', description: 'SahakarLekha partner portal login.', canonicalPath: '/partner/login' });
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => { if (loadPartnerSession(storage())) navigate('/partner/portal', { replace: true }); }, [navigate]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(''); setInfo('');
    if (!isLoginEmail(email)) { setError('सही ईमेल लिखें।'); return; }
    setBusy(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke('partner-auth', { body: { action: 'start', email: normalizeLoginEmail(email) } });
      if (fnErr) { setError('कोड भेजा नहीं जा सका — थोड़ी देर बाद फिर कोशिश करें।'); return; }
      setStep('code');
      setInfo('अगर यह ईमेल किसी partner का है, तो उस पर 6 अंकों का कोड भेज दिया गया है (10 मिनट तक चलेगा)। Spam फ़ोल्डर भी देखें।');
    } catch {
      setError('कोड भेजा नहीं जा सका — इंटरनेट जाँचें।');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLoginCode(code)) { setError('ईमेल में आया 6 अंकों का कोड लिखें।'); return; }
    setBusy(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('partner_login_verify', { p_email: normalizeLoginEmail(email), p_code: code.trim() });
      const res = (data ?? {}) as { ok?: boolean; session?: string; error_code?: string; attempts_left?: number };
      if (rpcErr || !res.ok || !res.session) {
        setError(loginErrorText(res.error_code) + (res.attempts_left != null ? ` (${res.attempts_left} कोशिश बाकी)` : ''));
        return;
      }
      if (!savePartnerSession(storage(), res.session)) {
        setError('यह browser login याद नहीं रख पा रहा (private/incognito mode?) — सामान्य window में खोलें।');
        return;
      }
      navigate('/partner/portal', { replace: true });
    } catch {
      setError('Login नहीं हो सका — इंटरनेट जाँचें।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <section className="py-16 bg-background">
        <div className="max-w-md mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Partner portal</h1>
                <p className="text-sm text-muted-foreground mt-1">आवेदन वाले ईमेल से login करें — हर बार ईमेल पर कोड आएगा, कोई password नहीं।</p>
              </div>
              {step === 'email' ? (
                <form onSubmit={sendCode} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="pl-email">ईमेल</Label>
                    <Input id="pl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
                  </div>
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" className="w-full gap-2" disabled={busy}><Mail className="h-4 w-4" /> {busy ? 'भेजा जा रहा है…' : 'कोड भेजें'}</Button>
                </form>
              ) : (
                <form onSubmit={verify} className="space-y-4" noValidate>
                  {info && <p className="text-sm text-muted-foreground" role="status">{info}</p>}
                  <div className="space-y-2">
                    <Label htmlFor="pl-code">6 अंकों का कोड</Label>
                    <Input id="pl-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric" autoComplete="one-time-code" className="font-mono text-xl tracking-[0.4em]" />
                  </div>
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" className="w-full gap-2" disabled={busy}><KeyRound className="h-4 w-4" /> {busy ? 'जाँच हो रही है…' : 'Login करें'}</Button>
                  <div className="flex justify-between text-sm">
                    <button type="button" className="text-primary hover:underline" onClick={() => { setStep('email'); setCode(''); setError(''); setInfo(''); }}>ईमेल बदलें</button>
                    <button type="button" className="text-primary hover:underline disabled:opacity-50" disabled={busy} onClick={() => void sendCode()}>कोड दोबारा भेजें</button>
                  </div>
                </form>
              )}
              <p className="text-xs text-muted-foreground border-t pt-3">
                अभी partner नहीं हैं? <Link to="/partner" className="text-primary hover:underline">आवेदन करें</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

// ── /partner/portal ────────────────────────────────────────────────────────────────────────────────────────────
interface PortalData {
  ok: boolean;
  error_code?: string;
  partner: { name: string; status: 'pending' | 'approved' | 'rejected' | 'suspended'; email: string; code: string | null; phone_masked: string; applied_at: string };
  dashboard: { ok: boolean; societies?: PartnerSocietyRow[] };
  commissions: { ok: boolean; rows?: CommissionRow[] };
  payouts: PartnerPayoutsData & { ok: boolean };
  details: MaskedDetails | null;
  pending_request: { id: number; created_at: string } | null;
  last_decision: { status: 'approved' | 'rejected'; admin_note: string | null; decided_at: string } | null;
}

const STATUS_BADGE: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending: { label: 'जाँच चल रही है', icon: Clock, cls: 'bg-amber-100 text-amber-900' },
  approved: { label: 'मंज़ूर', icon: CheckCircle2, cls: 'bg-green-100 text-green-900' },
  suspended: { label: 'रोका गया', icon: PauseCircle, cls: 'bg-muted text-foreground' },
};

const EMPTY_FORM = { pan: '', pan_name: '', account_name: '', account_no: '', ifsc: '', upi_id: '', gstin: '' };

export const PartnerPortalHome: React.FC = () => {
  useNoIndex();
  useDocumentMeta({ title: 'Partner portal — SahakarLekha', description: 'SahakarLekha partner portal.', canonicalPath: '/partner/portal' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<PortalData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const signOutLocal = useCallback(() => { clearPartnerSession(storage()); navigate('/partner/login', { replace: true }); }, [navigate]);

  const load = useCallback(async () => {
    const session = loadPartnerSession(storage());
    if (!session) { signOutLocal(); return; }
    setLoadError(false);
    try {
      const { data: d, error } = await supabase.rpc('partner_portal', { p_session: session });
      if (error) { setLoadError(true); return; }
      const res = d as PortalData;
      if (!res?.ok) { signOutLocal(); return; }   // expired / revoked
      setData(res);
    } catch {
      setLoadError(true);
    }
  }, [signOutLocal]);

  useEffect(() => { void load(); }, [load]);

  const logout = async () => {
    const session = loadPartnerSession(storage());
    if (session) { try { await supabase.rpc('partner_logout', { p_session: session }); } catch { /* local logout still happens */ } }
    signOutLocal();
  };

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = loadPartnerSession(storage());
    if (!session) { signOutLocal(); return; }
    setSaving(true);
    try {
      const { data: d, error } = await supabase.rpc('partner_details_request', {
        p_session: session, p_pan: form.pan, p_pan_name: form.pan_name, p_account_name: form.account_name,
        p_account_no: form.account_no, p_ifsc: form.ifsc, p_upi_id: form.upi_id, p_gstin: form.gstin,
      });
      const res = (d ?? {}) as { ok?: boolean; error_code?: string };
      if (error || !res.ok) {
        if (res.error_code === 'session_expired') { signOutLocal(); return; }
        const msg = res.error_code === 'nothing_to_save' ? 'कम से कम PAN, बैंक खाता या UPI में से एक भरें।'
          : res.error_code === 'rate_limited' ? 'आज बहुत बार बदलाव माँगा गया — कल फिर कोशिश करें।'
          : payoutErrorText(res.error_code);
        toast({ title: 'जानकारी भेजी नहीं गई', description: msg, variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'जानकारी भेज दी गई ✓', description: 'जाँच के बाद लागू होगी। तब तक पुरानी जानकारी ही चलेगी।' });
      setEditing(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      toast({ title: 'जानकारी भेजी नहीं गई', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <div className="space-y-3">
        <p className="text-destructive" role="alert">Portal लोड नहीं हो सका — इंटरनेट जाँचकर दोबारा कोशिश करें।</p>
        <Button variant="outline" onClick={() => void load()}>दोबारा कोशिश करें</Button>
      </div>
    );
  } else if (!data) {
    body = <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="लोड हो रहा है" />;
  } else {
    const p = data.partner;
    const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.pending;
    const Icon = badge.icon;
    const societies = data.dashboard?.ok ? (data.dashboard.societies ?? []) : 'error';
    const commissions = data.commissions?.ok ? (data.commissions.rows ?? []) : 'error';
    const payouts = data.payouts?.ok ? data.payouts : 'error';
    const det = data.details;
    body = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">नमस्ते, {p.name}</h1>
          <Badge className={`${badge.cls} gap-1`}><Icon className="h-3.5 w-3.5" /> {badge.label}</Badge>
          <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => void logout()}><LogOut className="h-4 w-4" /> Logout</Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-4">{p.email} · मोबाइल {p.phone_masked} · आवेदन {istDate(p.applied_at)}</p>

        {p.status === 'pending' && <p className="text-muted-foreground">आपका आवेदन मिल गया है। मंज़ूरी मिलते ही यहाँ आपका referral code दिखेगा और ईमेल भी आएगा।</p>}
        {p.status === 'suspended' && <p className="text-muted-foreground">आपका code अभी रोका गया है। जानकारी के लिए हमें WhatsApp करें। आपका पिछला हिसाब नीचे है।</p>}

        {p.status === 'approved' && p.code && (
          <div className="space-y-3">
            <div>
              <Label>आपका referral code</Label>
              <p className="mt-1 text-3xl font-mono font-bold tracking-wider text-primary">{p.code}</p>
            </div>
            <div className="space-y-2">
              <Label>आपका referral link (समितियों को भेजें)</Label>
              <CopyRow value={referralLink(p.code)} label="referral link" />
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(`SahakarLekha — सहकारी समितियों के लिए बना हिसाब-किताब software। इस link से जुड़ें: ${referralLink(p.code)} (Referral code: ${p.code})`)}`}
              target="_blank" rel="noopener noreferrer">
              <Button className="gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp पर भेजें</Button>
            </a>
          </div>
        )}

        {p.status === 'approved' && <PartnerSocieties societies={societies} />}
        {(p.status === 'approved' || p.status === 'suspended') && (
          <>
            <PartnerCommissions rows={commissions} />
            <PartnerPayouts data={payouts} />
          </>
        )}

        {(p.status === 'approved' || p.status === 'suspended') && (
          <div className="space-y-3 border-t pt-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> भुगतान की जानकारी</h2>
            {det ? (
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                <div>PAN: <span className="font-mono">{det.pan_masked ?? '—'}</span>{det.pan_name ? ` (${det.pan_name})` : ''}</div>
                <div>बैंक खाता: <span className="font-mono">{det.account_masked ?? '—'}</span>{det.ifsc ? ` · ${det.ifsc}` : ''}</div>
                <div>UPI: <span className="font-mono">{det.upi_masked ?? '—'}</span></div>
                <div>GSTIN: <span className="font-mono">{det.gstin ?? '—'}</span></div>
              </div>
            ) : (
              <p className="text-sm text-amber-800 bg-amber-50 rounded p-2">अभी आपकी भुगतान जानकारी दर्ज नहीं है। PAN न होने पर TDS ऊँची दर से कटता है।</p>
            )}
            {data.pending_request && (
              <p className="text-sm text-blue-900 bg-blue-50 rounded p-2">आपकी भेजी जानकारी ({istDate(data.pending_request.created_at)}) जाँच में है — मंज़ूरी के बाद लागू होगी।</p>
            )}
            {!data.pending_request && data.last_decision?.status === 'rejected' && (
              <p className="text-sm text-red-800 bg-red-50 rounded p-2">पिछली भेजी जानकारी मंज़ूर नहीं हुई{data.last_decision.admin_note ? `: ${data.last_decision.admin_note}` : ''}।</p>
            )}
            {!editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>{det ? 'जानकारी बदलें' : 'जानकारी भरें'}</Button>
            ) : (
              <form onSubmit={submitDetails} className="space-y-3" noValidate>
                <p className="text-xs text-muted-foreground">
                  सुरक्षा के लिए बदलाव तुरंत लागू नहीं होता — हम जाँचकर मंज़ूर करेंगे। PAN card और cancelled cheque / passbook की फ़ोटो WhatsApp पर भेजें।
                  जो खाना नहीं बदलना, उसे ख़ाली छोड़ दें।
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['pan', 'PAN', 'ABCDE1234F'], ['pan_name', 'PAN पर नाम', ''], ['account_name', 'खाताधारक का नाम', ''],
                    ['account_no', 'खाता नंबर', ''], ['ifsc', 'IFSC', 'SBIN0001234'], ['upi_id', 'UPI ID', 'name@okaxis'], ['gstin', 'GSTIN (अगर है)', ''],
                  ] as [keyof typeof EMPTY_FORM, string, string][]).map(([k, label, ph]) => (
                    <div key={k} className="space-y-1">
                      <Label htmlFor={`pd-${k}`}>{label}</Label>
                      <Input id={`pd-${k}`} value={form[k]} placeholder={ph} autoComplete="off"
                        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={['pan', 'account_no', 'ifsc', 'gstin'].includes(k) ? 'font-mono' : ''} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>{saving ? 'भेजा जा रहा है…' : 'जाँच के लिए भेजें'}</Button>
                  <Button type="button" variant="outline" onClick={() => { setEditing(false); setForm(EMPTY_FORM); }}>रद्द</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <PublicLayout>
      <section className="py-12 bg-background">
        <div className="max-w-2xl mx-auto px-4">
          <Card><CardContent className="p-6 sm:p-8">{body}</CardContent></Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PartnerLogin;
