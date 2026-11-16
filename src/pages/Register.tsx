import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from '@/components/LocalLink';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle, CheckCircle, Eye, EyeOff, Languages, Gift } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fullChartForType } from '@/lib/storage';
import type { SocietyType } from '@/types';
import { loadReferral, isReferralCodeShape, normalizeReferralCode, referralErrorText, REF_STORAGE_KEY } from '@/lib/referral/referralCode';

import { SOCIETY_TYPES, INDIAN_STATES } from '@/lib/constants';
import { presetsForState, presetChoice, resolveTypeChoice, typeChoiceOf, isSocietyVariant, type SocietyVariant } from '@/lib/societyPresets';
import { useAuth } from '@/contexts/AuthContext';
import { needsAppData } from '@/lib/appDataPaths';
import { NEXT_PARAM, safeNext, withNext, resolveEntryType, resolveEntryState } from '@/lib/auth/entryContext';
import { PLAN_CATALOG, TRIAL_DAYS, priceLabel } from '@/lib/plans';
const STATES = INDIAN_STATES;

/**
 * Step-1 answers kept for this browser tab only (sessionStorage), so a refresh, the Back button or a look
 * at the pricing page does not wipe a half-filled form (audit 2026-11-16, J-12). Society details only —
 * the admin's email and password are NEVER stored. Cleared the moment the society is registered.
 */
const DRAFT_KEY = 'sl.register.draft';
type RegisterDraft = Partial<Record<'societyName' | 'societyNameHi' | 'registrationNo' | 'district' | 'state' | 'phone' | 'gstin' | 'address' | 'societyType' | 'societyVariant' | 'financialYear', string>>;
function loadDraft(): RegisterDraft {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: RegisterDraft = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.length <= 300) (out as Record<string, string>)[k] = v;
    return out;
  } catch { return {}; }
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language, setLanguage } = useLanguage();
  // What the visitor carried here in the link (all validated — lib/auth/entryContext):
  //   ?next=  the app screen they wanted (Help / Cookbook buttons, or the login page passing it on)
  //   ?type= / ?state=  the society type / state page they were reading
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get(NEXT_PARAM), needsAppData);
  const [draft] = useState(loadDraft);
  const entryType = resolveEntryType(searchParams.get('type'), SOCIETY_TYPES.map(t => t.value));
  const entryState = resolveEntryState(searchParams.get('state'), INDIAN_STATES);
  // RULE 7: Hindi first; English when the visitor switches language.
  const L = (hiText: string, enText: string) => (language === 'hi' ? hiText : enText);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Society fields
  const [societyName, setSocietyName] = useState(draft.societyName ?? '');
  const [societyNameHi, setSocietyNameHi] = useState(draft.societyNameHi ?? '');
  const [registrationNo, setRegistrationNo] = useState(draft.registrationNo ?? '');
  const [district, setDistrict] = useState(draft.district ?? '');
  const [state, setState] = useState(entryState || resolveEntryState(draft.state, INDIAN_STATES));
  const [phone, setPhone] = useState(draft.phone ?? '');
  const [gstin, setGstin] = useState(draft.gstin ?? '');
  const [address, setAddress] = useState(draft.address ?? '');
  // Auto-detect current FY based on today's date (Apr-Mar cycle)
  const currentFY = (() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(-2)}`;
  })();
  const [financialYear, setFinancialYear] = useState(currentFY);

  // Generate FY options: 5 years back + current + 1 future
  const fyOptions = (() => {
    const now = new Date();
    const curYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const options: string[] = [];
    for (let y = curYear - 5; y <= curYear + 1; y++) {
      options.push(`${y}-${String(y + 1).slice(-2)}`);
    }
    return options;
  })();
  // No pre-selection: the type picks the chart of accounts and the modules, so the user must choose it (usability audit P1-10).
  // A type named in the link (?type=, from a /software/<type> page) is pre-selected; the visitor can still change it.
  const draftType = resolveEntryType(draft.societyType, SOCIETY_TYPES.map(t => t.value));
  const [societyType, setSocietyType] = useState<SocietyType | ''>((entryType || draftType) as SocietyType | '');
  // A state preset (e.g. Haryana CM-PACS): saved as its legal type + this name; see lib/societyPresets.
  const [societyVariant, setSocietyVariant] = useState<SocietyVariant | null>(
    !entryType && isSocietyVariant(draft.societyVariant) ? draft.societyVariant : null);
  const chooseType = (choice: string) => {
    const r = resolveTypeChoice(choice);
    setSocietyType(r.societyType);
    setSocietyVariant(r.societyVariant);
    if (r.state) setState(r.state);
  };
  // A preset belongs to one state: moving to another state drops it (the user picks the type again).
  const chooseState = (next: string) => {
    setState(next);
    if (societyVariant && !presetsForState(next).some(p => p.variant === societyVariant)) {
      setSocietyType('');
      setSocietyVariant(null);
    }
  };

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Keep the step-1 answers for this tab (see DRAFT_KEY). Never the admin's email or password.
  useEffect(() => {
    try {
      const d: RegisterDraft = { societyName, societyNameHi, registrationNo, district, state, phone, gstin, address, societyType, societyVariant: societyVariant ?? '', financialYear };
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* storage blocked — the form still works */ }
  }, [societyName, societyNameHi, registrationNo, district, state, phone, gstin, address, societyType, societyVariant, financialYear]);

  // Partner program (migration 164): a code remembered from a ?ref= link pre-fills this field.
  const [linkReferral] = useState(() => {
    try { return loadReferral(window.localStorage, Date.now()); } catch { return null; }
  });
  const [referralCode, setReferralCode] = useState(linkReferral?.code ?? '');
  const [referralResult, setReferralResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!societyName || !registrationNo || !district || !state || !societyType) {
      setError(L('कृपया सभी ज़रूरी (*) जानकारी भरें', 'Please fill all required fields'));
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail || !adminPassword) {
      setError(L('कृपया सभी ज़रूरी (*) जानकारी भरें', 'Please fill all required fields'));
      return;
    }
    if (adminPassword !== confirmPassword) {
      setError(L('दोनों पासवर्ड एक जैसे नहीं हैं', 'Passwords do not match'));
      return;
    }
    if (adminPassword.length < 6) {
      setError(L('पासवर्ड कम से कम 6 अक्षर का होना चाहिए', 'Password must be at least 6 characters'));
      return;
    }
    const refCode = normalizeReferralCode(referralCode);
    if (refCode && !isReferralCodeShape(refCode)) {
      setError(L('Referral code ग़लत लिखा है — यह SL-ABC234 जैसा होता है। न हो तो खाना ख़ाली छोड़ दें।', 'Referral code looks wrong — it looks like SL-ABC234. Leave it empty if you have none.'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Atomic bootstrap via the register_society SECURITY DEFINER RPC (P1-SEC-1a):
      // one call creates the society, the confirmed admin (auth login + society_users),
      // society_settings, and the seed accounts — all-or-nothing, so a partial failure
      // never leaves an orphan society/admin. The id is generated client-side (as before)
      // so no RETURNING/select-back is needed. The payloads are the SAME objects the old
      // flow inserted, so behaviour is identical.
      const newSocietyId = crypto.randomUUID();
      const templateAccounts = fullChartForType(societyType);
      const { data, error: rpcError } = await supabase.rpc('register_society', {
        p_society_id: newSocietyId,
        p_email: adminEmail,
        p_password: adminPassword,
        p_name: adminName,
        p_society: {
          id: newSocietyId,
          name: societyName,
          name_hi: societyNameHi || null,
          registration_no: registrationNo,
          address: address || null,
          district,
          state,
          phone: phone || null,
          financial_year: financialYear,
        },
        p_settings: {
          id: newSocietyId,
          society_id: newSocietyId,
          name: societyName,
          nameHi: societyNameHi || societyName,
          registrationNo: registrationNo,
          financialYear: financialYear,
          financialYearStart: financialYear.split('-')[0] + '-04-01',
          address: address || '',
          district: district,
          state: state,
          phone: phone || '',
          email: adminEmail,
          pinCode: '',
          societyType: societyType,
          ...(societyVariant ? { societyVariant } : {}),
          gstin: gstin || undefined,
        },
        p_accounts: templateAccounts.map(a => ({ ...a, society_id: newSocietyId })),
      });

      const result = (data ?? {}) as { ok?: boolean; error_code?: string; error_message?: string };
      if (rpcError || !result.ok) {
        const code = result.error_code;
        if (code === 'duplicate_registration') {
          setError(L('यह पंजीकरण संख्या पहले से दर्ज है — कृपया दूसरी पंजीकरण संख्या डालें।', 'Registration number already exists. Please use a different registration number.'));
        } else if (code === 'duplicate_email') {
          setError(L('यह ईमेल पहले से पंजीकृत है — कृपया दूसरा ईमेल डालें।', 'This email is already registered. Please use a different email.'));
        } else if (code === 'society_exists') {
          setError(L('यह समिति पहले से पंजीकृत है।', 'This society is already registered.'));
        } else {
          setError(result.error_message || rpcError?.message || L('पंजीकरण पूरा नहीं हो सका — कृपया दोबारा कोशिश करें।', 'Could not complete registration. Please try again.'));
        }
        setLoading(false);
        return;
      }

      // The society exists now — the half-filled form is no longer needed.
      try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }

      // The society exists now. Link the partner who referred it — a failure here never undoes the registration,
      // but it is shown on the success screen (not hidden) so the society can tell us and an admin can attach it.
      let referralFailed = false;
      if (refCode) {
        try {
          const source = linkReferral && linkReferral.code === refCode ? 'link' : 'code';
          const { data: refData, error: refErr } = await supabase.rpc('attach_referral_at_signup', {
            p_society_id: newSocietyId, p_code: refCode, p_source: source,
          });
          const ref = (refData ?? {}) as { ok?: boolean; error_code?: string };
          if (!refErr && ref.ok) {
            setReferralResult({ ok: true, text: L(`Referral code ${refCode} दर्ज हो गया।`, `Referral code ${refCode} recorded.`) });
            try { window.localStorage.removeItem(REF_STORAGE_KEY); } catch { /* ignore */ }
          } else {
            referralFailed = true;
            setReferralResult({ ok: false, text: `${referralErrorText(ref.error_code)} ${L('समिति का पंजीकरण पूरा है — code जुड़वाने के लिए हमें WhatsApp या संपर्क पेज पर बताएँ।', 'Your society is registered — contact us to have the code attached.')}` });
          }
        } catch {
          referralFailed = true;
          setReferralResult({ ok: false, text: L('Referral code दर्ज नहीं हो सका (इंटरनेट)। समिति का पंजीकरण पूरा है — code जुड़वाने के लिए हमसे संपर्क करें।', 'Could not record the referral code (network). Your society is registered — contact us to have it attached.') });
        }
      }

      // GOS-20: the #1 conversion event of the whole funnel (no PII in params).
      trackEvent('sign_up', { method: 'email' });

      // Audit 2026-11-16 (J-4): the new admin used to be sent to the login page to type the same email
      // and password again. Sign them in with what they just entered and open the app (the screen they
      // came for, or the dashboard). If that sign-in does not go through — or a referral code could not
      // be attached, which the success card must show — fall back to the card and its login button.
      if (!referralFailed) {
        try {
          const signedIn = await login(adminEmail, adminPassword);
          if (signedIn.status === 'ok') {
            navigate(next ?? '/dashboard', { replace: true });
            return;
          }
        } catch { /* fall through to the success card */ }
      }
      setSuccess(true);
    } catch {
      setError(L('पंजीकरण नहीं हुआ — इंटरनेट कनेक्शन जाँचकर दोबारा कोशिश करें।', 'Registration failed. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardContent className="pt-10 pb-10">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {L('पंजीकरण सफल!', 'Registration Successful!')}
            </h2>
            <p className="text-muted-foreground mb-1">
              <strong>{societyName}</strong>{L(' का पंजीकरण सफलतापूर्वक हो गया।', ' has been registered successfully.')}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {L('इस ईमेल से लॉगिन करें:', 'Login with:')} <strong className="text-primary">{adminEmail}</strong>
            </p>
            {referralResult && (
              <p className={`text-sm mb-6 -mt-4 ${referralResult.ok ? 'text-green-700' : 'text-amber-700'}`} role="status">
                {referralResult.text}
              </p>
            )}
            <Button className="w-full" size="lg" onClick={() => navigate(withNext('/login', next, needsAppData))}>
              {L('लॉगिन पर जाएँ →', 'Go to Login →')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/20" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-8">
            <Building2 className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-4">
            {L('नई समिति पंजीकरण', 'New Society Registration')}
          </h1>
          {language === 'hi' && (
            <p className="text-xl text-center text-primary-foreground/80 mb-2">
              New Society Registration
            </p>
          )}
          <p className="text-center text-primary-foreground/60 max-w-md">
            {L('अपनी सहकारी समिति का पंजीकरण करें और लेखा प्रणाली का उपयोग शुरू करें', 'Register your cooperative society and start using the accounting system')}
          </p>

          {/* Step indicators */}
          <div className="mt-12 flex items-center gap-4">
            <div className={`flex items-center gap-2 transition-all ${step === 1 ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 1 ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>1</div>
              <span className="text-sm">{L('समिति की जानकारी', 'Society Info')}</span>
            </div>
            <div className="h-px w-8 bg-white/30" />
            <div className={`flex items-center gap-2 transition-all ${step === 2 ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 2 ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>2</div>
              <span className="text-sm">{L('एडमिन खाता', 'Admin Account')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="relative flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-background overflow-y-auto">
        {/* Language Toggle (same as Login) */}
        <div className="absolute top-4 right-4">
          <Button variant="outline" size="sm" onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')} className="gap-2">
            <Languages className="h-4 w-4" />
            {language === 'hi' ? 'English' : 'हिंदी'}
          </Button>
        </div>
        {/* Mobile logo */}
        <div className="lg:hidden mb-6 text-center">
          <Link to="/" className="block" aria-label={L('सहकार लेखा — मुख्य पेज', 'SahakarLekha — home page')}>
            <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3">
              <Building2 className="h-7 w-7" />
            </div>
          </Link>
          <h1 className="text-xl font-bold">{L('नई समिति पंजीकरण', 'New Society Registration')}</h1>
        </div>

        {/* What registering means, before the first field (audit 2026-11-16, J-5). Every figure comes from
            lib/plans — the same constants the pricing page uses. */}
        <div className="w-full max-w-md mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {L(`${TRIAL_DAYS} दिन का मुफ़्त trial — रजिस्टर करते समय कोई भुगतान नहीं।`,
              `${TRIAL_DAYS}-day free trial — nothing to pay when you register.`)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {L(`Trial में 1 user। आगे जारी रखना हो तो plan ${priceLabel(PLAN_CATALOG.starter.price)}/साल + GST से। `,
              `The trial has 1 user. To continue afterwards, plans start at ${priceLabel(PLAN_CATALOG.starter.price)}/year + GST. `)}
            <Link to="/pricing" target="_blank" rel="noopener" className="text-primary font-medium hover:underline"
              onClick={() => trackEvent('cta_click', { location: 'register', target: 'pricing' })}>
              {L('सभी plan देखें', 'See all plans')}
            </Link>
          </p>
        </div>

        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              {step === 1 ? L('🏢 समिति की जानकारी', '🏢 Society Information') : L('👤 एडमिन खाता', '👤 Admin Account')}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? L('चरण 1 / 2 — अपनी सहकारी समिति का विवरण भरें', 'Step 1 of 2 — Enter your cooperative society details')
                : L('चरण 2 / 2 — एडमिन (प्रशासक) खाता बनाएँ', 'Step 2 of 2 — Create the administrator account')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 1 ? (
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label>{L('समिति का नाम (English में)', 'Society Name (English)')} <span className="text-destructive">*</span></Label>
                  <Input
                    value={societyName}
                    onChange={e => setSocietyName(e.target.value)}
                    placeholder="Gram Seva Cooperative Marketing Society"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('समिति का नाम (हिंदी में)', 'Society Name (Hindi)')}</Label>
                  <Input
                    value={societyNameHi}
                    onChange={e => setSocietyNameHi(e.target.value)}
                    placeholder="ग्राम सेवा सहकारी विपणन समिति"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('पंजीकरण संख्या', 'Registration Number')} <span className="text-destructive">*</span></Label>
                  <Input
                    value={registrationNo}
                    onChange={e => setRegistrationNo(e.target.value)}
                    placeholder="COOP/2024/12345"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{L('ज़िला', 'District')} <span className="text-destructive">*</span></Label>
                    <Input
                      value={district}
                      onChange={e => setDistrict(e.target.value)}
                      placeholder={L('ज़िले का नाम', 'District name')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{L('राज्य', 'State')} <span className="text-destructive">*</span></Label>
                    <Select value={state} onValueChange={chooseState}>
                      <SelectTrigger>
                        <SelectValue placeholder={L('राज्य चुनें', 'Select state')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{L('फ़ोन', 'Phone')}</Label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0755-1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('GSTIN (वैकल्पिक)', 'GSTIN (Optional)')}</Label>
                  <Input
                    value={gstin}
                    onChange={e => setGstin(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('पता', 'Address')}</Label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={L('पूरा पता', 'Full address')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('समिति का प्रकार', 'Society Type')} <span className="text-destructive">*</span></Label>
                  <Select value={typeChoiceOf(societyType, societyVariant)} onValueChange={chooseType}>
                    <SelectTrigger>
                      <SelectValue placeholder={L('समिति का प्रकार चुनें', 'Select society type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIETY_TYPES.filter(t => t.value !== 'other').map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span>{t.label}</span>
                          {language === 'hi' && <span className="ml-1 text-xs text-muted-foreground">— {t.labelHi}</span>}
                        </SelectItem>
                      ))}
                      {presetsForState(state).map(p => (
                        <SelectItem key={p.variant} value={presetChoice(p.variant)}>
                          <span>{L(p.labelHi, p.label)}</span>
                        </SelectItem>
                      ))}
                      <SelectItem value="other">
                        <span>Other</span>
                        {language === 'hi' && <span className="ml-1 text-xs text-muted-foreground">— अन्य</span>}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{L('वित्तीय वर्ष', 'Financial Year')}</Label>
                  <Select value={financialYear} onValueChange={setFinancialYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fyOptions.map(fy => (
                        <SelectItem key={fy} value={fy}>
                          {fy}{fy === currentFY ? L(' (चालू)', ' (Current)') : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  {L('आगे: एडमिन खाता →', 'Next: Admin Account →')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{L('एडमिन का पूरा नाम', 'Admin Full Name')} <span className="text-destructive">*</span></Label>
                  <Input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder={L('आपका पूरा नाम', 'Your full name')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('ईमेल', 'Email')} <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@yoursociety.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{L('पासवर्ड', 'Password')} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder={L('कम से कम 6 अक्षर', 'Minimum 6 characters')}
                      className="pr-10"
                      required
                      aria-describedby="register-password-hint"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p id="register-password-hint" className="-mt-2 text-xs text-muted-foreground">
                  {L('कम से कम 6 अक्षर। इसी ईमेल और पासवर्ड से आप लॉगिन करेंगे — ईमेल ध्यान से लिखें।',
                    'At least 6 characters. You will log in with this email and password — type the email carefully.')}
                </p>

                <div className="space-y-2">
                  <Label>{L('पासवर्ड दोबारा', 'Confirm Password')} <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={L('पासवर्ड दोबारा लिखें', 'Repeat password')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referral-code" className="flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-primary" />
                    {L('Referral code (वैकल्पिक)', 'Referral code (optional)')}
                  </Label>
                  <Input
                    id="referral-code"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="SL-ABC234"
                    autoComplete="off"
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    {linkReferral && normalizeReferralCode(referralCode) === linkReferral.code
                      ? L('यह code आपके खोले गए link से आया है।', 'This code came from the link you opened.')
                      : L('किसी ने SahakarLekha के बारे में बताया हो तो उनका code लिखें।', 'If someone told you about SahakarLekha, enter their code.')}
                  </p>
                  {normalizeReferralCode(referralCode) && (
                    <p className="text-xs text-muted-foreground">
                      {L('Code देने पर उस partner को आपकी समिति का नाम, ज़िला और plan की स्थिति दिखेगी — आपका हिसाब-किताब कभी नहीं।',
                        'With a code, that partner sees your society\'s name, district and plan status — never your accounts.')}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setStep(1); setError(''); }}
                  >
                    {L('← पीछे', '← Back')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {L('पंजीकरण हो रहा है…', 'Registering...')}
                      </span>
                    ) : (
                      L('समिति पंजीकृत करें', 'Register Society')
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Consent by action, with the documents one tap away (they open in a new tab so the form stays). */}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {L('रजिस्टर करके आप हमारी ', 'By registering you agree to our ')}
              <Link to="/terms" target="_blank" rel="noopener" className="underline hover:text-primary">{L('शर्तों', 'Terms')}</Link>
              {L(' और ', ' and ')}
              <Link to="/privacy" target="_blank" rel="noopener" className="underline hover:text-primary">{L('गोपनीयता नीति', 'Privacy Policy')}</Link>
              {L(' से सहमत होते हैं।', '.')}
            </p>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {L('पहले से पंजीकृत हैं?', 'Already registered?')}{' '}
              <Link to={withNext('/login', next, needsAppData)} className="text-primary font-medium hover:underline">
                {L('यहाँ लॉगिन करें', 'Login here')}
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} {L('सहकार लेखा (SahakarLekha)', 'SahakarLekha')} | {L('सभी अधिकार सुरक्षित', 'All rights reserved')}
        </p>
      </div>
    </div>
  );
};

export default Register;
