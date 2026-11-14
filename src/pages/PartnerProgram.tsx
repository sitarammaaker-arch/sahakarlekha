/**
 * Partner program — public pages (slice 1, migration 164).
 *
 *   /partner          what the program is + the application form (partner_apply RPC)
 *   /partner/status   the applicant's private status page, keyed by the secret token in ?t= (partner_status RPC)
 *
 * No money in this slice: approval gives a code and a link; commission accounting comes later. Government officers
 * (inspectors, ARCS, departmental auditors) can never be partners — founder decision 2026-11-14 — so both
 * declarations are required here AND enforced by CHECK constraints in the database.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta, useNoIndex } from '@/lib/useDocumentMeta';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { INDIAN_STATES } from '@/lib/constants';
import {
  PARTNER_CATEGORIES, societyStage, summarizePartnerSocieties, SOCIETY_STAGE_TEXT, type PartnerSocietyRow,
  commissionStage, summarizeCommissions, formatPaise, COMMISSION_STAGE_TEXT, COMMISSION_BASIS_TEXT, type CommissionRow,
} from '@/lib/referral/referralCode';
import { Handshake, Link2, ShieldCheck, Copy, MessageCircle, CheckCircle2, Clock, XCircle, PauseCircle, Users } from 'lucide-react';

const APPLY_ERRORS: Record<string, string> = {
  declaration_required: 'दोनों घोषणाओं पर टिक करना ज़रूरी है।',
  invalid_name: 'नाम ठीक से लिखें (2 से 80 अक्षर)।',
  invalid_phone: 'सही 10 अंकों का मोबाइल नंबर लिखें।',
  invalid_email: 'ईमेल सही नहीं लग रहा — ठीक करें या ख़ाली छोड़ दें।',
  invalid_category: 'आप क्या करते हैं, यह चुनें।',
  duplicate_phone: 'इस मोबाइल नंबर से पहले ही आवेदन हो चुका है। स्थिति जानने के लिए हमें WhatsApp करें।',
  rate_limited: 'अभी बहुत ज़्यादा आवेदन आ रहे हैं — कुछ देर बाद फिर कोशिश करें।',
};

const statusLink = (token: string) => `${window.location.origin}/partner/status?t=${encodeURIComponent(token)}`;
const referralLink = (code: string) => `https://sahakarlekha.com/?ref=${encodeURIComponent(code)}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const CopyRow: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const { toast } = useToast();
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={async () => {
          const done = await copyText(value);
          toast(done ? { title: 'कॉपी हो गया ✓' } : { title: 'कॉपी नहीं हुआ', description: 'खाने को दबाकर हाथ से कॉपी करें।', variant: 'destructive' });
        }}
      >
        <Copy className="h-4 w-4" /> कॉपी
      </Button>
    </div>
  );
};

// ── /partner ───────────────────────────────────────────────────────────────────────────────────────────────────
export const PartnerApply: React.FC = () => {
  useDocumentMeta({
    title: 'Partner बनें — SahakarLekha referral program',
    description: 'सहकारी समितियों को SahakarLekha से जोड़िए। Partner बनने पर आपको अपना referral code और link मिलेगा, जिससे आपके द्वारा जुड़ी हर समिति का रिकॉर्ड रहेगा।',
    canonicalPath: '/partner',
  });
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [note, setNote] = useState('');
  const [declPublic, setDeclPublic] = useState(false);
  const [declProxy, setDeclProxy] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return;
    setError('');
    if (!name.trim() || !phone.trim() || !category) {
      setError('नाम, मोबाइल नंबर और "आप क्या करते हैं" भरना ज़रूरी है।');
      return;
    }
    if (!declPublic || !declProxy) {
      setError(APPLY_ERRORS.declaration_required);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('partner_apply', {
        p_name: name.trim(), p_phone: phone, p_email: email.trim() || null, p_category: category,
        p_district: district.trim() || null, p_state: state || null, p_note: note.trim() || null,
        p_declared_not_public_servant: declPublic, p_declared_not_proxy: declProxy,
      });
      const res = (data ?? {}) as { ok?: boolean; token?: string; error_code?: string };
      if (rpcErr || !res.ok || !res.token) {
        setError(APPLY_ERRORS[res.error_code ?? ''] ?? 'आवेदन सेव नहीं हो सका — कृपया दोबारा कोशिश करें या WhatsApp करें।');
        return;
      }
      trackEvent('partner_apply', { category });
      setToken(res.token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast({
        title: 'आवेदन सेव नहीं हुआ',
        description: 'इंटरनेट जाँचकर दोबारा भेजें। आपकी भरी जानकारी इसी पेज पर है।',
        variant: 'destructive',
        duration: 11000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (token) {
    const link = statusLink(token);
    return (
      <PublicLayout>
        <section className="py-16 bg-background">
          <div className="max-w-xl mx-auto px-4">
            <Card>
              <CardContent className="p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                  <h1 className="text-2xl font-bold text-foreground">आवेदन मिल गया</h1>
                </div>
                <p className="text-muted-foreground">
                  हम आपके आवेदन की जाँच करेंगे। मंज़ूरी मिलते ही आपका referral code और link नीचे वाले पेज पर दिखेगा।
                </p>
                <div className="space-y-2">
                  <Label>आपका स्थिति पेज (इसे सँभालकर रखें)</Label>
                  <CopyRow value={link} label="स्थिति पेज का link" />
                  <p className="text-xs text-muted-foreground">
                    यह link सिर्फ़ आपके लिए है, किसी और को न दें। इसे खोई तो हमें WhatsApp करें।
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a href={`https://wa.me/?text=${encodeURIComponent('मेरा SahakarLekha partner स्थिति पेज: ' + link)}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" /> अपने WhatsApp पर सेव करें</Button>
                  </a>
                  <Link to={`/partner/status?t=${encodeURIComponent(token)}`}>
                    <Button className="gap-2">स्थिति देखें</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Handshake className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">SahakarLekha Partner बनें</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            आप सहकारी समितियों को जानते हैं? उन्हें SahakarLekha से जोड़िए। आपको अपना referral code और link मिलेगा, और आपके
            द्वारा जुड़ी हर समिति का रिकॉर्ड आपके नाम से रहेगा।
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Handshake, title: '1. आवेदन करें', text: 'नीचे का form भरें। हम जाँचकर मंज़ूरी देंगे।' },
            { icon: Link2, title: '2. अपना link बाँटें', text: 'मंज़ूरी पर code और link मिलेगा — इसे समितियों को भेजें।' },
            { icon: Users, title: '3. रिकॉर्ड आपके नाम', text: 'link से जुड़ने वाली हर समिति आपके code से दर्ज होगी।' },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <Icon className="h-6 w-6 text-primary mb-2" />
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="max-w-3xl mx-auto px-4 mt-6 text-sm text-muted-foreground text-center">
          Commission की दरें और भुगतान की शर्तें Partner Agreement में लिखी जाएँगी, जो मंज़ूरी के समय दी जाएगी।
        </p>
      </section>

      <section className="pb-16 bg-background">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-foreground mb-5">आवेदन form</h2>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="p-name">पूरा नाम <span className="text-destructive">*</span></Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-phone">मोबाइल नंबर <span className="text-destructive">*</span></Label>
                    <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-email">ईमेल (वैकल्पिक)</Label>
                    <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>आप क्या करते हैं? <span className="text-destructive">*</span></Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label="आप क्या करते हैं"><SelectValue placeholder="चुनें" /></SelectTrigger>
                    <SelectContent>
                      {PARTNER_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-district">ज़िला</Label>
                    <Input id="p-district" value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={60} />
                  </div>
                  <div className="space-y-2">
                    <Label>राज्य</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger aria-label="राज्य"><SelectValue placeholder="चुनें" /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => <SelectItem key={s.value} value={s.label}>{s.labelHi} ({s.label})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-note">आप समितियों तक कैसे पहुँचेंगे? (वैकल्पिक)</Label>
                  <Textarea id="p-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
                    placeholder="जैसे: मैं 20 समितियों का हिसाब देखता हूँ / मेरा YouTube चैनल है…" />
                </div>
                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> घोषणा <span className="text-destructive">*</span>
                  </p>
                  <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={declPublic} onChange={(e) => setDeclPublic(e.target.checked)} />
                    <span>
                      मैं सरकारी कर्मचारी नहीं हूँ (जैसे सहकारिता निरीक्षक, सहायक रजिस्ट्रार, विभागीय ऑडिटर), और न ही सरकारी सहायता
                      पाने वाली किसी सहकारी समिति का पदाधिकारी या कर्मचारी हूँ।
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={declProxy} onChange={(e) => setDeclProxy(e.target.checked)} />
                    <span>
                      मैं किसी सरकारी कर्मचारी का प्रतिनिधि या nominee नहीं हूँ, और मुझे मिलने वाला कोई भी लाभ किसी सरकारी कर्मचारी के
                      साथ नहीं बाँटूँगा। घोषणा ग़लत निकलने पर मेरी partnership बंद की जा सकती है।
                    </span>
                  </label>
                </div>

                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? 'भेजा जा रहा है…' : 'आवेदन भेजें'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

/** A timestamptz as an Indian calendar date (DD/MM/YYYY), in IST — not the UTC date. */
const istDate = (ts: string) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PartnerSocieties: React.FC<{ societies: PartnerSocietyRow[] | 'error' | null }> = ({ societies }) => {
  if (societies === null) {
    return <p className="text-sm text-muted-foreground">समितियों की सूची लोड हो रही है…</p>;
  }
  if (societies === 'error') {
    return <p className="text-sm text-destructive" role="alert">समितियों की सूची लोड नहीं हो सकी — पेज दोबारा खोलें।</p>;
  }
  const sum = summarizePartnerSocieties(societies);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> आपसे जुड़ी समितियाँ</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: sum.total, label: 'कुल' },
          { n: sum.trial, label: 'Trial पर' },
          { n: sum.paid, label: 'भुगतान हुआ' },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border p-3">
            <div className="text-2xl font-bold text-foreground">{x.n}</div>
            <div className="text-xs text-muted-foreground">{x.label}</div>
          </div>
        ))}
      </div>
      {societies.length === 0 ? (
        <p className="text-sm text-muted-foreground">अभी कोई समिति आपके code से नहीं जुड़ी। अपना link समितियों को भेजें।</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {societies.map((s, i) => {
            const stage = SOCIETY_STAGE_TEXT[societyStage(s)];
            return (
              <li key={`${s.society_name}-${i}`} className="p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground break-words">{s.society_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.district ? `${s.district} · ` : ''}जुड़ी: {istDate(s.joined_at)}
                    {s.first_paid_at ? ` · पहला भुगतान: ${istDate(s.first_paid_at)}` : ''}
                  </div>
                </div>
                <Badge className={stage.cls}>{stage.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        यहाँ सिर्फ़ समिति का नाम, ज़िला और plan की स्थिति दिखती है — समिति का कोई हिसाब-किताब नहीं। 
      </p>
    </div>
  );
};

const PartnerCommissions: React.FC<{ rows: CommissionRow[] | 'error' | null }> = ({ rows }) => {
  if (rows === null) return <p className="text-sm text-muted-foreground">Commission का हिसाब लोड हो रहा है…</p>;
  if (rows === 'error') return <p className="text-sm text-destructive" role="alert">Commission का हिसाब लोड नहीं हो सका — पेज दोबारा खोलें।</p>;
  const sum = summarizeCommissions(rows);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">आपका commission</h2>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border p-3">
          <div className="text-xl font-bold text-green-700">{formatPaise(sum.eligible)}</div>
          <div className="text-xs text-muted-foreground">पक्का (भुगतान योग्य)</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xl font-bold text-foreground">{formatPaise(sum.hold)}</div>
          <div className="text-xs text-muted-foreground">Refund अवधि में</div>
        </div>
      </div>
      {sum.noRuleCount > 0 && (
        <p className="text-xs text-muted-foreground">{sum.noRuleCount} भुगतान पर commission की दर अभी तय होनी है — तय होते ही यहाँ रकम दिखेगी।</p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">अभी किसी समिति का भुगतान नहीं आया। समिति के भुगतान करते ही commission यहाँ दिखेगा।</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => {
            const st = COMMISSION_STAGE_TEXT[commissionStage(r)];
            return (
              <li key={r.id} className="p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground break-words">{r.society_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {istDate(r.invoice_date)} · {COMMISSION_BASIS_TEXT[r.basis]}
                    {r.rate_pct != null ? ` · ${Number(r.rate_pct)}% of ${formatPaise(r.taxable_paise)}` : ''}
                    {commissionStage(r) === 'hold' ? ` · पक्का होगा: ${istDate(r.hold_until)}` : ''}
                  </div>
                  {r.status === 'cancelled' && r.cancel_reason && <div className="text-xs text-red-700">कारण: {r.cancel_reason}</div>}
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${r.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{formatPaise(r.commission_paise)}</div>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Commission GST के बिना की रकम (taxable value) पर बनता है। भुगतान की refund अवधि बीतने पर वह पक्का होता है; भुगतान और TDS
        का हिसाब Partner Agreement के अनुसार होगा।
      </p>
    </div>
  );
};

// ── /partner/status ────────────────────────────────────────────────────────────────────────────────────────────
interface StatusResult {
  ok: boolean;
  error_code?: string;
  name?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  code?: string | null;
  applied_at?: string;
  societies_count?: number;
}

const STATUS_VIEW: Record<string, { label: string; icon: React.ElementType; cls: string; text: string }> = {
  pending: { label: 'जाँच चल रही है', icon: Clock, cls: 'bg-amber-100 text-amber-900', text: 'आपका आवेदन मिल गया है। मंज़ूरी मिलते ही यहाँ code दिखेगा।' },
  approved: { label: 'मंज़ूर', icon: CheckCircle2, cls: 'bg-green-100 text-green-900', text: 'नीचे आपका code और link है। इसे समितियों को भेजें।' },
  rejected: { label: 'मंज़ूर नहीं हुआ', icon: XCircle, cls: 'bg-red-100 text-red-900', text: 'यह आवेदन मंज़ूर नहीं हुआ। जानकारी के लिए हमें WhatsApp करें।' },
  suspended: { label: 'रोका गया', icon: PauseCircle, cls: 'bg-muted text-foreground', text: 'आपका code अभी रोका गया है। जानकारी के लिए हमें WhatsApp करें।' },
};

export const PartnerStatus: React.FC = () => {
  useNoIndex();
  useDocumentMeta({ title: 'Partner स्थिति — SahakarLekha', description: 'SahakarLekha partner आवेदन की स्थिति।', canonicalPath: '/partner/status' });
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const validToken = useMemo(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token), [token]);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [loadError, setLoadError] = useState(false);
  // null = not loaded (or not approved); 'error' = the list could not be read (shown, never faked as empty)
  const [societies, setSocieties] = useState<PartnerSocietyRow[] | 'error' | null>(null);
  const [commissions, setCommissions] = useState<CommissionRow[] | 'error' | null>(null);

  useEffect(() => {
    if (!validToken) return;
    let cancelled = false;
    setResult(null);
    setLoadError(false);
    setSocieties(null);
    setCommissions(null);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('partner_status', { p_token: token });
        if (cancelled) return;
        if (error) { setLoadError(true); return; }
        const st = (data ?? { ok: false }) as StatusResult;
        setResult(st);
        if (st.ok && st.status === 'approved') {
          const dash = await supabase.rpc('partner_dashboard', { p_token: token });
          if (cancelled) return;
          const d = (dash.data ?? {}) as { ok?: boolean; societies?: PartnerSocietyRow[] };
          setSocieties(dash.error || !d.ok ? 'error' : (d.societies ?? []));
        }
        if (st.ok && (st.status === 'approved' || st.status === 'suspended')) {
          const com = await supabase.rpc('partner_commissions', { p_token: token });
          if (cancelled) return;
          const c = (com.data ?? {}) as { ok?: boolean; rows?: CommissionRow[] };
          setCommissions(com.error || !c.ok ? 'error' : (c.rows ?? []));
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token, validToken]);

  let body: React.ReactNode;
  if (!validToken || (result && !result.ok)) {
    body = (
      <>
        <h1 className="text-2xl font-bold text-foreground">यह link सही नहीं है</h1>
        <p className="text-muted-foreground">पूरा link कॉपी किया है, यह जाँचें। link खो गया हो तो हमें WhatsApp करें।</p>
        <Link to="/partner"><Button variant="outline">Partner program पेज</Button></Link>
      </>
    );
  } else if (loadError) {
    body = <p className="text-destructive" role="alert">स्थिति लोड नहीं हो सकी — इंटरनेट जाँचकर पेज दोबारा खोलें।</p>;
  } else if (!result) {
    body = <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="लोड हो रहा है" />;
  } else {
    const view = STATUS_VIEW[result.status ?? 'pending'] ?? STATUS_VIEW.pending;
    const Icon = view.icon;
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">नमस्ते, {result.name}</h1>
          <Badge className={`${view.cls} gap-1`}><Icon className="h-3.5 w-3.5" /> {view.label}</Badge>
        </div>
        <p className="text-muted-foreground">{view.text}</p>
        {result.status === 'approved' && result.code && (
          <div className="space-y-4">
            <div>
              <Label>आपका referral code</Label>
              <p className="mt-1 text-3xl font-mono font-bold tracking-wider text-primary">{result.code}</p>
            </div>
            <div className="space-y-2">
              <Label>आपका link</Label>
              <CopyRow value={referralLink(result.code)} label="referral link" />
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`SahakarLekha — सहकारी समितियों के लिए बना हिसाब-किताब software। इस link से जुड़ें: ${referralLink(result.code)} (Referral code: ${result.code})`)}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Button className="gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp पर भेजें</Button>
            </a>
          </div>
        )}
        {result.status === 'approved' ? (
          <PartnerSocieties societies={societies} />
        ) : null}
        {result.status === 'approved' || result.status === 'suspended' ? (
          <PartnerCommissions rows={commissions} />
        ) : (
          <div className="rounded-lg border p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-foreground">आपके code से जुड़ी समितियाँ: <strong>{result.societies_count ?? 0}</strong></span>
          </div>
        )}
      </>
    );
  }

  return (
    <PublicLayout>
      <section className="py-16 bg-background">
        <div className="max-w-xl mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-5">{body}</CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PartnerApply;
