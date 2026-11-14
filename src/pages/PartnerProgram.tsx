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
  invalid_email: 'ईमेल सही नहीं लग रहा — ठीक करें।',
  email_required: 'ईमेल ज़रूरी है — partner portal का login कोड इसी पर आएगा।',
  duplicate_email: 'इस ईमेल से पहले ही आवेदन हो चुका है। partner portal पर इसी ईमेल से login करें।',
  invalid_category: 'आप क्या करते हैं, यह चुनें।',
  duplicate_phone: 'इस मोबाइल नंबर से पहले ही आवेदन हो चुका है। स्थिति जानने के लिए हमें WhatsApp करें।',
  rate_limited: 'अभी बहुत ज़्यादा आवेदन आ रहे हैं — कुछ देर बाद फिर कोशिश करें।',
};

export const referralLink = (code: string) => `https://sahakarlekha.com/?ref=${encodeURIComponent(code)}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const CopyRow: React.FC<{ value: string; label: string }> = ({ value, label }) => {
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
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return;
    setError('');
    if (!name.trim() || !phone.trim() || !email.trim() || !category) {
      setError('नाम, मोबाइल नंबर, ईमेल और "आप क्या करते हैं" भरना ज़रूरी है।');
      return;
    }
    if (!declPublic || !declProxy) {
      setError(APPLY_ERRORS.declaration_required);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('partner_apply', {
        p_name: name.trim(), p_phone: phone, p_email: email.trim(), p_category: category,
        p_district: district.trim() || null, p_state: state || null, p_note: note.trim() || null,
        p_declared_not_public_servant: declPublic, p_declared_not_proxy: declProxy,
      });
      const res = (data ?? {}) as { ok?: boolean; token?: string; error_code?: string };
      if (rpcErr || !res.ok) {
        setError(APPLY_ERRORS[res.error_code ?? ''] ?? 'आवेदन सेव नहीं हो सका — कृपया दोबारा कोशिश करें या WhatsApp करें।');
        return;
      }
      trackEvent('partner_apply', { category });
      setDone(true);
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

  if (done) {
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
                  हम आपके आवेदन की जाँच करेंगे। मंज़ूरी मिलते ही <strong>{email.trim()}</strong> पर आपका referral code, referral link और
                  partner portal का पता ईमेल से आ जाएगा।
                </p>
                <p className="text-muted-foreground">
                  अपनी स्थिति कभी भी देखने के लिए partner portal पर इसी ईमेल से login करें — हर बार ईमेल पर एक कोड आएगा, कोई password नहीं।
                </p>
                <Link to="/partner/login"><Button className="gap-2">Partner portal पर login करें</Button></Link>
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
                    <Label htmlFor="p-email">ईमेल <span className="text-destructive">*</span></Label>
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
export const istDate = (ts: string) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const PartnerSocieties: React.FC<{ societies: PartnerSocietyRow[] | 'error' | null }> = ({ societies }) => {
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

export const PartnerCommissions: React.FC<{ rows: CommissionRow[] | 'error' | null }> = ({ rows }) => {
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

export interface PartnerPayoutsData {
  pan_on_file: boolean;
  payouts: { id: number; payout_date: string; fy: string; credit_paise: number; clawback_paise: number; base_paise: number;
    tds_rate_pct: number | string; tds_paise: number; net_paise: number; method: string; utr: string }[];
  clawbacks: { amount_paise: number; reason: string; created_at: string }[];
}

export const PartnerPayouts: React.FC<{ data: PartnerPayoutsData | 'error' | null }> = ({ data }) => {
  if (data === null) return <p className="text-sm text-muted-foreground">भुगतान का हिसाब लोड हो रहा है…</p>;
  if (data === 'error') return <p className="text-sm text-destructive" role="alert">भुगतान का हिसाब लोड नहीं हो सका — पेज दोबारा खोलें।</p>;
  const totalNet = data.payouts.reduce((a, p) => a + Number(p.net_paise), 0);
  const totalTds = data.payouts.reduce((a, p) => a + Number(p.tds_paise), 0);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">आपको भुगतान</h2>
      {!data.pan_on_file && (
        <p className="text-sm rounded bg-amber-50 text-amber-900 p-2">
          आपका PAN हमारे पास दर्ज नहीं है। PAN न होने पर TDS ऊँची दर से कटता है — अपना PAN और बैंक/UPI की जानकारी हमें WhatsApp पर भेजें।
        </p>
      )}
      {data.clawbacks.length > 0 && (
        <div className="text-sm rounded border border-red-200 p-2 text-red-800">
          {data.clawbacks.map((k, i) => (
            <div key={i}>अगले भुगतान से कटेगा: {formatPaise(k.amount_paise)} — {k.reason}</div>
          ))}
        </div>
      )}
      {data.payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">अभी कोई भुगतान नहीं हुआ।</p>
      ) : (
        <>
          <p className="text-sm text-foreground">अब तक भेजा गया: <strong>{formatPaise(totalNet)}</strong> · कटा TDS: {formatPaise(totalTds)}</p>
          <ul className="divide-y rounded-lg border">
            {data.payouts.map((p) => (
              <li key={p.id} className="p-3 flex flex-wrap items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{istDate(p.payout_date)}</div>
                  <div className="text-xs text-muted-foreground">
                    Commission {formatPaise(p.credit_paise)}
                    {Number(p.clawback_paise) > 0 ? ` − clawback ${formatPaise(p.clawback_paise)}` : ''}
                    {` − TDS ${Number(p.tds_rate_pct)}% ${formatPaise(p.tds_paise)}`}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">UTR: {p.utr}</div>
                </div>
                <div className="font-semibold text-foreground">{formatPaise(p.net_paise)}</div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">TDS कटा हो तो उसका प्रमाणपत्र (TDS certificate) नियम के अनुसार आपको भेजा जाएगा।</p>
        </>
      )}
    </div>
  );
};

// ── /partner/status ── (old status links, 164–167) ────────────────────────────────────────────────────────────
// Since migration 168 the status link no longer opens anything: partners sign in at /partner/login with their email.
export const PartnerStatus: React.FC = () => {
  useNoIndex();
  useDocumentMeta({ title: 'Partner स्थिति — SahakarLekha', description: 'SahakarLekha partner portal.', canonicalPath: '/partner/status' });
  return (
    <PublicLayout>
      <section className="py-16 bg-background">
        <div className="max-w-xl mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-4">
              <h1 className="text-2xl font-bold text-foreground">अब partner portal पर login करें</h1>
              <p className="text-muted-foreground">
                पुराना स्थिति link अब बंद है। अपनी समितियाँ, commission और भुगतान देखने के लिए partner portal पर अपने ईमेल से login करें —
                ईमेल पर एक कोड आएगा।
              </p>
              <p className="text-sm text-muted-foreground">
                आवेदन में ईमेल नहीं दिया था? हमें WhatsApp पर अपना ईमेल भेजें, हम जोड़ देंगे।
              </p>
              <Link to="/partner/login"><Button>Partner portal पर login करें</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PartnerApply;
