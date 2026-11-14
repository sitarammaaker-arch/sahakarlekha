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
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { INDIAN_STATES } from '@/lib/constants';
import {
  PARTNER_CATEGORIES, societyStage, summarizePartnerSocieties, SOCIETY_STAGE_TEXT, type PartnerSocietyRow,
  commissionStage, summarizeCommissions, formatPaise, COMMISSION_STAGE_TEXT, type CommissionRow,
  tl, basisText,
} from '@/lib/referral/referralCode';
import { Handshake, Link2, ShieldCheck, Copy, MessageCircle, CheckCircle2, Clock, XCircle, PauseCircle, Users } from 'lucide-react';

const APPLY_ERRORS: Record<string, { hi: string; en: string }> = {
  declaration_required: { hi: 'दोनों घोषणाओं पर टिक करना ज़रूरी है।', en: 'Please tick both declarations.' },
  invalid_name: { hi: 'नाम ठीक से लिखें (2 से 80 अक्षर)।', en: 'Please enter your name properly (2 to 80 characters).' },
  invalid_phone: { hi: 'सही 10 अंकों का मोबाइल नंबर लिखें।', en: 'Please enter a valid 10-digit mobile number.' },
  invalid_email: { hi: 'ईमेल सही नहीं लग रहा — ठीक करें।', en: 'This email does not look right — please correct it.' },
  email_required: { hi: 'ईमेल ज़रूरी है — partner portal का login कोड इसी पर आएगा।', en: 'Email is required — your partner portal login code will be sent to it.' },
  duplicate_email: { hi: 'इस ईमेल से पहले ही आवेदन हो चुका है। partner portal पर इसी ईमेल से login करें।', en: 'An application with this email already exists. Log in to the partner portal with this email.' },
  invalid_category: { hi: 'आप क्या करते हैं, यह चुनें।', en: 'Please choose what you do.' },
  duplicate_phone: { hi: 'इस मोबाइल नंबर से पहले ही आवेदन हो चुका है। स्थिति जानने के लिए हमें WhatsApp करें।', en: 'An application with this mobile number already exists. WhatsApp us to know its status.' },
  rate_limited: { hi: 'अभी बहुत ज़्यादा आवेदन आ रहे हैं — कुछ देर बाद फिर कोशिश करें।', en: 'Too many applications right now — please try again in a while.' },
};

/** Small Hindi | English switch for the public partner pages (PublicLayout has none). */
export const PartnerLangToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-1 shrink-0" role="group" aria-label={language === 'hi' ? 'भाषा' : 'Language'}>
      <Button type="button" size="sm" variant={language === 'hi' ? 'secondary' : 'ghost'} aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>
        हिंदी
      </Button>
      <Button type="button" size="sm" variant={language === 'en' ? 'secondary' : 'ghost'} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
        English
      </Button>
    </div>
  );
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
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={async () => {
          const done = await copyText(value);
          toast(done ? { title: L('कॉपी हो गया ✓', 'Copied ✓') } : { title: L('कॉपी नहीं हुआ', 'Could not copy'), description: L('खाने को दबाकर हाथ से कॉपी करें।', 'Tap the box and copy it by hand.'), variant: 'destructive' });
        }}
      >
        <Copy className="h-4 w-4" /> {L('कॉपी', 'Copy')}
      </Button>
    </div>
  );
};

// ── /partner ───────────────────────────────────────────────────────────────────────────────────────────────────
export const PartnerApply: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L('Partner बनें — SahakarLekha referral program', 'Become a Partner — SahakarLekha referral program'),
    description: L(
      'सहकारी समितियों को SahakarLekha से जोड़िए। Partner बनने पर आपको अपना referral code और link मिलेगा, जिससे आपके द्वारा जुड़ी हर समिति का रिकॉर्ड रहेगा।',
      'Bring cooperative societies to SahakarLekha. As a partner you get your own referral code and link, and every society that joins through you is recorded in your name.',
    ),
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
      setError(L('नाम, मोबाइल नंबर, ईमेल और "आप क्या करते हैं" भरना ज़रूरी है।', 'Name, mobile number, email and "What do you do" are required.'));
      return;
    }
    if (!declPublic || !declProxy) {
      setError(L(APPLY_ERRORS.declaration_required.hi, APPLY_ERRORS.declaration_required.en));
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
        const known = APPLY_ERRORS[res.error_code ?? ''];
        setError(known ? L(known.hi, known.en) : L('आवेदन सेव नहीं हो सका — कृपया दोबारा कोशिश करें या WhatsApp करें।', 'Your application could not be saved — please try again or WhatsApp us.'));
        return;
      }
      trackEvent('partner_apply', { category });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast({
        title: L('आवेदन सेव नहीं हुआ', 'Application not saved'),
        description: L('इंटरनेट जाँचकर दोबारा भेजें। आपकी भरी जानकारी इसी पेज पर है।', 'Check your internet and submit again. What you filled in is still on this page.'),
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
                  <h1 className="text-2xl font-bold text-foreground">{L('आवेदन मिल गया', 'Application received')}</h1>
                  <div className="ml-auto"><PartnerLangToggle /></div>
                </div>
                {language === 'hi' ? (
                  <p className="text-muted-foreground">
                    हम आपके आवेदन की जाँच करेंगे। मंज़ूरी मिलते ही <strong>{email.trim()}</strong> पर आपका referral code, referral link और
                    partner portal का पता ईमेल से आ जाएगा।
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    We will review your application. Once approved, your referral code, referral link and the partner portal address will be
                    emailed to <strong>{email.trim()}</strong>.
                  </p>
                )}
                <p className="text-muted-foreground">
                  {L(
                    'अपनी स्थिति कभी भी देखने के लिए partner portal पर इसी ईमेल से login करें — हर बार ईमेल पर एक कोड आएगा, कोई password नहीं।',
                    'To check your status any time, log in to the partner portal with this email — a code is emailed to you each time, no password.',
                  )}
                </p>
                <Link to="/partner/login"><Button className="gap-2">{L('Partner portal पर login करें', 'Log in to the partner portal')}</Button></Link>
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
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{L('SahakarLekha Partner बनें', 'Become a SahakarLekha Partner')}</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {L(
              'आप सहकारी समितियों को जानते हैं? उन्हें SahakarLekha से जोड़िए। आपको अपना referral code और link मिलेगा, और आपके द्वारा जुड़ी हर समिति का रिकॉर्ड आपके नाम से रहेगा।',
              'Do you know cooperative societies? Bring them to SahakarLekha. You get your own referral code and link, and every society that joins through you is recorded in your name.',
            )}
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Handshake, title: L('1. आवेदन करें', '1. Apply'), text: L('नीचे का form भरें। हम जाँचकर मंज़ूरी देंगे।', 'Fill in the form below. We will review it and approve.') },
            { icon: Link2, title: L('2. अपना link बाँटें', '2. Share your link'), text: L('मंज़ूरी पर code और link मिलेगा — इसे समितियों को भेजें।', 'On approval you get a code and a link — send it to societies.') },
            { icon: Users, title: L('3. रिकॉर्ड आपके नाम', '3. Recorded in your name'), text: L('link से जुड़ने वाली हर समिति आपके code से दर्ज होगी।', 'Every society that joins through your link is recorded under your code.') },
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
          {L(
            'Commission की दरें और भुगतान की शर्तें Partner Agreement में लिखी जाएँगी, जो मंज़ूरी के समय दी जाएगी।',
            'Commission rates and payment terms will be set out in the Partner Agreement, which is given at the time of approval.',
          )}
        </p>
      </section>

      <section className="pb-16 bg-background">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3 mb-5">
                <h2 className="text-xl font-bold text-foreground">{L('आवेदन form', 'Application form')}</h2>
                <PartnerLangToggle />
              </div>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="p-name">{L('पूरा नाम', 'Full name')} <span className="text-destructive">*</span></Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-phone">{L('मोबाइल नंबर', 'Mobile number')} <span className="text-destructive">*</span></Label>
                    <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-email">{L('ईमेल', 'Email')} <span className="text-destructive">*</span></Label>
                    <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{L('आप क्या करते हैं?', 'What do you do?')} <span className="text-destructive">*</span></Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label={L('आप क्या करते हैं', 'What do you do')}><SelectValue placeholder={L('चुनें', 'Choose')} /></SelectTrigger>
                    <SelectContent>
                      {PARTNER_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{tl(c, language)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-district">{L('ज़िला', 'District')}</Label>
                    <Input id="p-district" value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={60} />
                  </div>
                  <div className="space-y-2">
                    <Label>{L('राज्य', 'State')}</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger aria-label={L('राज्य', 'State')}><SelectValue placeholder={L('चुनें', 'Choose')} /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => <SelectItem key={s.value} value={s.label}>{language === 'hi' ? `${s.labelHi} (${s.label})` : s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-note">{L('आप समितियों तक कैसे पहुँचेंगे? (वैकल्पिक)', 'How will you reach societies? (optional)')}</Label>
                  <Textarea id="p-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
                    placeholder={L('जैसे: मैं 20 समितियों का हिसाब देखता हूँ / मेरा YouTube चैनल है…', 'e.g. I keep the accounts of 20 societies / I run a YouTube channel…')} />
                </div>
                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> {L('घोषणा', 'Declaration')} <span className="text-destructive">*</span>
                  </p>
                  <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={declPublic} onChange={(e) => setDeclPublic(e.target.checked)} />
                    <span>
                      {L(
                        'मैं सरकारी कर्मचारी नहीं हूँ (जैसे सहकारिता निरीक्षक, सहायक रजिस्ट्रार, विभागीय ऑडिटर), और न ही सरकारी सहायता पाने वाली किसी सहकारी समिति का पदाधिकारी या कर्मचारी हूँ।',
                        'I am not a government employee (such as a cooperative inspector, assistant registrar or departmental auditor), nor an office-bearer or employee of any government-aided cooperative society.',
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={declProxy} onChange={(e) => setDeclProxy(e.target.checked)} />
                    <span>
                      {L(
                        'मैं किसी सरकारी कर्मचारी का प्रतिनिधि या nominee नहीं हूँ, और मुझे मिलने वाला कोई भी लाभ किसी सरकारी कर्मचारी के साथ नहीं बाँटूँगा। घोषणा ग़लत निकलने पर मेरी partnership बंद की जा सकती है।',
                        'I am not a representative or nominee of any government employee, and I will not share any benefit I receive with a government employee. If this declaration turns out to be false, my partnership can be ended.',
                      )}
                    </span>
                  </label>
                </div>

                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? L('भेजा जा रहा है…', 'Sending…') : L('आवेदन भेजें', 'Submit application')}
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
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  if (societies === null) {
    return <p className="text-sm text-muted-foreground">{L('समितियों की सूची लोड हो रही है…', 'Loading the list of societies…')}</p>;
  }
  if (societies === 'error') {
    return <p className="text-sm text-destructive" role="alert">{L('समितियों की सूची लोड नहीं हो सकी — पेज दोबारा खोलें।', 'Could not load the list of societies — please reopen the page.')}</p>;
  }
  const sum = summarizePartnerSocieties(societies);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {L('आपसे जुड़ी समितियाँ', 'Societies linked to you')}</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: sum.total, label: L('कुल', 'Total') },
          { n: sum.trial, label: L('Trial पर', 'On trial') },
          { n: sum.paid, label: L('भुगतान हुआ', 'Paid') },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border p-3">
            <div className="text-2xl font-bold text-foreground">{x.n}</div>
            <div className="text-xs text-muted-foreground">{x.label}</div>
          </div>
        ))}
      </div>
      {societies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L('अभी कोई समिति आपके code से नहीं जुड़ी। अपना link समितियों को भेजें।', 'No society has joined with your code yet. Send your link to societies.')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {societies.map((s, i) => {
            const stage = SOCIETY_STAGE_TEXT[societyStage(s)];
            return (
              <li key={`${s.society_name}-${i}`} className="p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground break-words">{s.society_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.district ? `${s.district} · ` : ''}{L('जुड़ी', 'Joined')}: {istDate(s.joined_at)}
                    {s.first_paid_at ? ` · ${L('पहला भुगतान', 'First payment')}: ${istDate(s.first_paid_at)}` : ''}
                  </div>
                </div>
                <Badge className={stage.cls}>{tl(stage, language)}</Badge>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {L('यहाँ सिर्फ़ समिति का नाम, ज़िला और plan की स्थिति दिखती है — समिति का कोई हिसाब-किताब नहीं।', 'Only the society\'s name, district and plan status are shown here — none of the society\'s accounts.')}
      </p>
    </div>
  );
};

export const PartnerCommissions: React.FC<{ rows: CommissionRow[] | 'error' | null }> = ({ rows }) => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  if (rows === null) return <p className="text-sm text-muted-foreground">{L('Commission का हिसाब लोड हो रहा है…', 'Loading your commission…')}</p>;
  if (rows === 'error') return <p className="text-sm text-destructive" role="alert">{L('Commission का हिसाब लोड नहीं हो सका — पेज दोबारा खोलें।', 'Could not load your commission — please reopen the page.')}</p>;
  const sum = summarizeCommissions(rows);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{L('आपका commission', 'Your commission')}</h2>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border p-3">
          <div className="text-xl font-bold text-green-700">{formatPaise(sum.eligible)}</div>
          <div className="text-xs text-muted-foreground">{L('पक्का (भुगतान योग्य)', 'Confirmed (payable)')}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xl font-bold text-foreground">{formatPaise(sum.hold)}</div>
          <div className="text-xs text-muted-foreground">{L('Refund अवधि में', 'In refund period')}</div>
        </div>
      </div>
      {sum.noRuleCount > 0 && (
        <p className="text-xs text-muted-foreground">{sum.noRuleCount} {L('भुगतान पर commission की दर अभी तय होनी है — तय होते ही यहाँ रकम दिखेगी।', 'payment(s) still await a commission rate — the amount will show here once it is set.')}</p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L('अभी किसी समिति का भुगतान नहीं आया। समिति के भुगतान करते ही commission यहाँ दिखेगा।', 'No society has paid yet. Your commission will show here as soon as a society pays.')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => {
            const st = COMMISSION_STAGE_TEXT[commissionStage(r)];
            return (
              <li key={r.id} className="p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground break-words">{r.society_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {istDate(r.invoice_date)} · {basisText(r.basis, language)}
                    {r.rate_pct != null ? ` · ${Number(r.rate_pct)}% of ${formatPaise(r.taxable_paise)}` : ''}
                    {commissionStage(r) === 'hold' ? ` · ${L('पक्का होगा', 'Confirmed on')}: ${istDate(r.hold_until)}` : ''}
                  </div>
                  {r.status === 'cancelled' && r.cancel_reason && <div className="text-xs text-red-700">{L('कारण', 'Reason')}: {r.cancel_reason}</div>}
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${r.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{formatPaise(r.commission_paise)}</div>
                  <Badge className={st.cls}>{tl(st, language)}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {L(
          'Commission GST के बिना की रकम (taxable value) पर बनता है। भुगतान की refund अवधि बीतने पर वह पक्का होता है; भुगतान और TDS का हिसाब Partner Agreement के अनुसार होगा।',
          'Commission is calculated on the amount before GST (taxable value). It is confirmed once the payment\'s refund period is over; payouts and TDS follow the Partner Agreement.',
        )}
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
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  if (data === null) return <p className="text-sm text-muted-foreground">{L('भुगतान का हिसाब लोड हो रहा है…', 'Loading your payouts…')}</p>;
  if (data === 'error') return <p className="text-sm text-destructive" role="alert">{L('भुगतान का हिसाब लोड नहीं हो सका — पेज दोबारा खोलें।', 'Could not load your payouts — please reopen the page.')}</p>;
  const totalNet = data.payouts.reduce((a, p) => a + Number(p.net_paise), 0);
  const totalTds = data.payouts.reduce((a, p) => a + Number(p.tds_paise), 0);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{L('आपको भुगतान', 'Payouts to you')}</h2>
      {!data.pan_on_file && (
        <p className="text-sm rounded bg-amber-50 text-amber-900 p-2">
          {L(
            'आपका PAN हमारे पास दर्ज नहीं है। PAN न होने पर TDS ऊँची दर से कटता है — अपना PAN और बैंक/UPI की जानकारी हमें WhatsApp पर भेजें।',
            'We do not have your PAN on record. Without a PAN, TDS is deducted at a higher rate — send us your PAN and bank/UPI details on WhatsApp.',
          )}
        </p>
      )}
      {data.clawbacks.length > 0 && (
        <div className="text-sm rounded border border-red-200 p-2 text-red-800">
          {data.clawbacks.map((k, i) => (
            <div key={i}>{L('अगले भुगतान से कटेगा', 'Will be deducted from the next payout')}: {formatPaise(k.amount_paise)} — {k.reason}</div>
          ))}
        </div>
      )}
      {data.payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L('अभी कोई भुगतान नहीं हुआ।', 'No payouts yet.')}</p>
      ) : (
        <>
          <p className="text-sm text-foreground">{L('अब तक भेजा गया', 'Sent so far')}: <strong>{formatPaise(totalNet)}</strong> · {L('कटा TDS', 'TDS deducted')}: {formatPaise(totalTds)}</p>
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
          <p className="text-xs text-muted-foreground">{L('TDS कटा हो तो उसका प्रमाणपत्र (TDS certificate) नियम के अनुसार आपको भेजा जाएगा।', 'Where TDS is deducted, its certificate (TDS certificate) will be sent to you as the rules require.')}</p>
        </>
      )}
    </div>
  );
};

// ── /partner/status ── (old status links, 164–167) ────────────────────────────────────────────────────────────
// Since migration 168 the status link no longer opens anything: partners sign in at /partner/login with their email.
export const PartnerStatus: React.FC = () => {
  useNoIndex();
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({ title: L('Partner स्थिति — SahakarLekha', 'Partner status — SahakarLekha'), description: 'SahakarLekha partner portal.', canonicalPath: '/partner/status' });
  return (
    <PublicLayout>
      <section className="py-16 bg-background">
        <div className="max-w-xl mx-auto px-4">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-foreground">{L('अब partner portal पर login करें', 'Please log in to the partner portal now')}</h1>
                <PartnerLangToggle />
              </div>
              <p className="text-muted-foreground">
                {L(
                  'पुराना स्थिति link अब बंद है। अपनी समितियाँ, commission और भुगतान देखने के लिए partner portal पर अपने ईमेल से login करें — ईमेल पर एक कोड आएगा।',
                  'The old status link no longer works. To see your societies, commission and payouts, log in to the partner portal with your email — a code will be emailed to you.',
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {L('आवेदन में ईमेल नहीं दिया था? हमें WhatsApp पर अपना ईमेल भेजें, हम जोड़ देंगे।', 'Did not give an email in your application? WhatsApp us your email and we will add it.')}
              </p>
              <Link to="/partner/login"><Button>{L('Partner portal पर login करें', 'Log in to the partner portal')}</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PartnerApply;
