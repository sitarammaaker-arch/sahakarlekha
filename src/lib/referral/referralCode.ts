/**
 * Referral codes (partner program, slice 1). PURE except the two tiny storage wrappers at the bottom, which take
 * the Storage as an argument and never throw.
 *
 * A partner's link is `https://sahakarlekha.com/?ref=SL-7KQ2MD`. Whoever opens it gets the code remembered for
 * REF_TTL_DAYS; the Register page pre-fills it and, after register_society succeeds, calls
 * attach_referral_at_signup (migration 164). FIRST TOUCH wins: a second partner's link does not overwrite a code
 * that is still fresh, so one partner cannot hijack another's introduction.
 *
 * The alphabet mirrors public._partner_new_code(): no 0/O/1/I/L, so a code survives being read out on the phone.
 * Keep the two in step.
 */

export const REF_STORAGE_KEY = 'sl_ref';
export const REF_TTL_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^SL-[${REFERRAL_CODE_ALPHABET}]{6}$`);

export interface StoredReferral {
  code: string;
  /** epoch ms when the link was first opened */
  at: number;
}

/** Upper-case, drop spaces; "sl 7kq2md" → "SL7KQ2MD" is NOT fixed up (no guessing), only spacing and case. */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, '').toUpperCase();
}

export function isReferralCodeShape(raw: string | null | undefined): boolean {
  return CODE_RE.test(normalizeReferralCode(raw));
}

/** The code in a location.search string, normalised, or null when absent / not code-shaped. */
export function referralFromSearch(search: string): string | null {
  let value: string | null = null;
  try {
    value = new URLSearchParams(search).get('ref');
  } catch {
    return null;
  }
  const code = normalizeReferralCode(value);
  return isReferralCodeShape(code) ? code : null;
}

export function isFresh(stored: StoredReferral | null, now: number): boolean {
  return !!stored && now - stored.at >= 0 && now - stored.at < REF_TTL_DAYS * DAY_MS;
}

/** What should be stored after seeing `incoming` (first touch wins while the stored code is fresh). */
export function nextStoredReferral(existing: StoredReferral | null, incoming: string | null, now: number): StoredReferral | null {
  if (isFresh(existing, now)) return existing;
  if (incoming) return { code: incoming, at: now };
  return null;
}

export function parseStoredReferral(raw: string | null): StoredReferral | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof v?.code === 'string' && typeof v.at === 'number' && isReferralCodeShape(v.code)) {
      return { code: normalizeReferralCode(v.code), at: v.at };
    }
  } catch { /* corrupt value → treat as absent */ }
  return null;
}

/** Must match the CHECK on public.partners.category (migration 164). */
export const PARTNER_CATEGORIES: { value: string; label: string; labelEn: string }[] = [
  { value: 'creator', label: 'YouTube / सोशल मीडिया creator', labelEn: 'YouTube / social media creator' },
  { value: 'accountant', label: 'लेखाकार (Accountant)', labelEn: 'Accountant' },
  { value: 'ca', label: 'CA / टैक्स सलाहकार', labelEn: 'CA / tax consultant' },
  { value: 'consultant', label: 'Software / IT सलाहकार', labelEn: 'Software / IT consultant' },
  { value: 'retired', label: 'सेवानिवृत्त (रिटायर्ड) कर्मचारी', labelEn: 'Retired employee' },
  { value: 'other', label: 'अन्य', labelEn: 'Other' },
];

/** The app's two languages (LanguageContext). Hindi is the default everywhere below. */
export type Lang = 'hi' | 'en';

export function categoryLabel(value: string, lang: Lang = 'hi'): string {
  const c = PARTNER_CATEGORIES.find((x) => x.value === value);
  return c ? (lang === 'en' ? c.labelEn : c.label) : value;
}

/** Messages for attach_referral_at_signup / admin_referral_set error codes (Hindi first). */
export const REFERRAL_ERROR_TEXT: Record<string, string> = {
  invalid_code: 'यह referral code मान्य नहीं है (या partner अभी मंज़ूर नहीं है)।',
  too_late: 'समिति बने काफ़ी समय हो गया — code अब सिर्फ़ admin जोड़ सकते हैं।',
  already_attributed: 'इस समिति पर पहले से एक referral code दर्ज है।',
  self_referral: 'partner अपनी ही समिति पर अपना code नहीं लगा सकते।',
  not_found: 'समिति नहीं मिली।',
  society_not_found: 'समिति नहीं मिली।',
  reason_required: 'कारण लिखना ज़रूरी है (कम से कम 5 अक्षर)।',
  locked_after_payment: 'इस समिति का भुगतान हो चुका है — अब partner बदला नहीं जा सकता।',
  nothing_to_remove: 'इस समिति पर कोई partner दर्ज नहीं है।',
  unchanged: 'यही partner पहले से दर्ज है।',
};

export const REFERRAL_ERROR_TEXT_EN: Record<string, string> = {
  invalid_code: 'This referral code is not valid (or the partner is not approved yet).',
  too_late: 'The society was created a while ago — only the admin can add a code now.',
  already_attributed: 'This society already has a referral code.',
  self_referral: 'A partner cannot use their own code on their own society.',
  not_found: 'Society not found.',
  society_not_found: 'Society not found.',
  reason_required: 'A reason is required (at least 5 characters).',
  locked_after_payment: 'This society has paid — its partner can no longer be changed.',
  nothing_to_remove: 'This society has no partner.',
  unchanged: 'This partner is already set.',
};

export function referralErrorText(code: string | undefined | null, lang: Lang = 'hi'): string {
  if (lang === 'en') return (code && REFERRAL_ERROR_TEXT_EN[code]) || 'The referral code could not be recorded.';
  return (code && REFERRAL_ERROR_TEXT[code]) || 'Referral code दर्ज नहीं हो सका।';
}

// ── partner dashboard (migration 165: partner_dashboard) ──────────────────────────────────────────────────────

export interface PartnerSocietyRow {
  society_name: string;
  district: string | null;
  joined_at: string;
  plan: string | null;
  subscription_status: string | null;
  period_end: string | null;
  first_paid_at: string | null;
}

export type SocietyStage = 'paid' | 'trial' | 'expired' | 'free' | 'joined';

/**
 * Where a referred society stands, from the partner's point of view. A society that has EVER paid counts as paid
 * (that is what slice 3's commission will key on), even if its plan later lapsed.
 */
export function societyStage(r: Pick<PartnerSocietyRow, 'plan' | 'subscription_status' | 'first_paid_at'>): SocietyStage {
  if (r.first_paid_at) return 'paid';
  if (r.subscription_status === 'expired' || r.subscription_status === 'grace') return 'expired';
  if (r.plan === 'trial' || r.subscription_status === 'trialing') return 'trial';
  if (r.plan === 'legacy') return 'free';
  return 'joined';
}

export const SOCIETY_STAGE_TEXT: Record<SocietyStage, { label: string; labelEn: string; cls: string }> = {
  paid: { label: 'भुगतान हुआ', labelEn: 'Paid', cls: 'bg-green-100 text-green-900' },
  trial: { label: 'Trial पर', labelEn: 'On trial', cls: 'bg-blue-100 text-blue-900' },
  expired: { label: 'Trial/plan ख़त्म', labelEn: 'Trial/plan ended', cls: 'bg-amber-100 text-amber-900' },
  free: { label: 'पुराना मुफ़्त plan', labelEn: 'Old free plan', cls: 'bg-muted text-foreground' },
  joined: { label: 'जुड़ी', labelEn: 'Joined', cls: 'bg-muted text-foreground' },
};

export function summarizePartnerSocieties(rows: readonly Pick<PartnerSocietyRow, 'plan' | 'subscription_status' | 'first_paid_at'>[]) {
  const out = { total: rows.length, paid: 0, trial: 0, expired: 0, other: 0 };
  for (const r of rows) {
    const s = societyStage(r);
    if (s === 'paid') out.paid++;
    else if (s === 'trial') out.trial++;
    else if (s === 'expired') out.expired++;
    else out.other++;
  }
  return out;
}

// ── commissions (migration 166) ───────────────────────────────────────────────────────────────────────────────

export interface CommissionRow {
  id: number;
  society_name: string | null;
  invoice_date: string;
  kind: string;
  basis: 'first_year' | 'renewal' | 'none';
  taxable_paise: number;
  rate_pct: number | string | null;
  commission_paise: number;
  status: 'no_rule' | 'pending' | 'cancelled' | 'paid';
  hold_until: string;
  eligible: boolean;
  cancel_reason: string | null;
}

/** Paise → "₹1,234.50" (Indian grouping). Integer paise in, never floats in the sum. */
export function formatPaise(paise: number | string | null | undefined): string {
  const p = Math.round(Number(paise ?? 0));
  const neg = p < 0;
  const abs = Math.abs(p);
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${neg ? '−' : ''}₹${rupees.toLocaleString('en-IN')}.${rest}`;
}

export type CommissionStage = 'eligible' | 'hold' | 'no_rule' | 'cancelled' | 'none' | 'paid';

export function commissionStage(r: Pick<CommissionRow, 'status' | 'eligible' | 'basis'>): CommissionStage {
  if (r.status === 'cancelled') return 'cancelled';
  if (r.status === 'paid') return 'paid';
  if (r.status === 'no_rule') return 'no_rule';
  if (r.basis === 'none') return 'none';
  return r.eligible ? 'eligible' : 'hold';
}

export const COMMISSION_STAGE_TEXT: Record<CommissionStage, { label: string; labelEn: string; cls: string }> = {
  eligible: { label: 'पक्का (भुगतान योग्य)', labelEn: 'Confirmed (payable)', cls: 'bg-green-100 text-green-900' },
  hold: { label: 'Refund अवधि चल रही', labelEn: 'In refund window', cls: 'bg-amber-100 text-amber-900' },
  no_rule: { label: 'दर तय होनी बाकी', labelEn: 'Rate not set yet', cls: 'bg-muted text-foreground' },
  cancelled: { label: 'रद्द', labelEn: 'Cancelled', cls: 'bg-red-100 text-red-900' },
  none: { label: 'Commission अवधि पूरी', labelEn: 'Commission period over', cls: 'bg-muted text-foreground' },
  paid: { label: 'भुगतान हो गया', labelEn: 'Paid out', cls: 'bg-blue-100 text-blue-900' },
};

export const COMMISSION_BASIS_TEXT: Record<CommissionRow['basis'], string> = {
  first_year: 'पहला साल',
  renewal: 'Renewal',
  none: 'अवधि के बाद',
};

export const COMMISSION_BASIS_TEXT_EN: Record<CommissionRow['basis'], string> = {
  first_year: 'First year',
  renewal: 'Renewal',
  none: 'After the period',
};

/** label of a { label, labelEn } entry in the chosen language */
export const tl = (x: { label: string; labelEn: string }, lang: Lang = 'hi'): string => (lang === 'en' ? x.labelEn : x.label);
export const basisText = (b: CommissionRow['basis'], lang: Lang = 'hi'): string => (lang === 'en' ? COMMISSION_BASIS_TEXT_EN[b] : COMMISSION_BASIS_TEXT[b]);

/** Totals in integer paise. Cancelled and no-rule rows never count as money owed. */
export function summarizeCommissions(rows: readonly Pick<CommissionRow, 'status' | 'eligible' | 'basis' | 'commission_paise'>[]) {
  const out = { eligible: 0, hold: 0, noRuleCount: 0, cancelled: 0, paid: 0 };
  for (const r of rows) {
    const s = commissionStage(r);
    const p = Math.round(Number(r.commission_paise) || 0);
    if (s === 'eligible') out.eligible += p;
    else if (s === 'hold') out.hold += p;
    else if (s === 'no_rule') out.noRuleCount += 1;
    else if (s === 'cancelled') out.cancelled += p;
    else if (s === 'paid') out.paid += p;
  }
  return out;
}

// ── payouts (migration 167) ───────────────────────────────────────────────────────────────────────────────────

/** Indian financial year label of a YYYY-MM-DD date — mirrors public._partner_fy(). */
export function financialYearOf(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Rupees typed by a person ("20,000" / "20000.50") → integer paise, or null when it is not a number. */
export function rupeesToPaise(raw: string): number | null {
  const t = raw.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [r, p = ''] = t.split('.');
  return Number(r) * 100 + Number((p + '00').slice(0, 2));
}

export const PAYOUT_ERROR_TEXT: Record<string, string> = {
  date_required: 'भुगतान की तारीख़ भरें।',
  future_date: 'आगे की तारीख़ का भुगतान दर्ज नहीं होता।',
  no_tds_rule: 'इस तारीख़ पर कोई TDS नियम नहीं है — पहले TDS नियम जोड़ें (TDS लागू न हो तो 0% का नियम कारण सहित)।',
  nothing_payable: 'भुगतान योग्य रकम नहीं है (या clawback बराबर/ज़्यादा है)।',
  commission_not_payable: 'चुने गए commission में से कोई भुगतान योग्य नहीं है — सूची दोबारा देखें।',
  stale_preview: 'रकम बदल गई है — preview दोबारा बनाकर जाँचें।',
  utr_required: 'UTR / reference नंबर लिखें (कम से कम 6 अक्षर)।',
  invalid_method: 'भुगतान का तरीका चुनें।',
  invalid_pan: 'PAN सही नहीं है (जैसे ABCDE1234F)।',
  invalid_account: 'खाता नंबर सिर्फ़ अंकों में, 6–20 अंक।',
  invalid_ifsc: 'IFSC सही नहीं है (जैसे SBIN0001234)।',
  invalid_upi: 'UPI ID सही नहीं है (जैसे name@okaxis)।',
  invalid_gstin: 'GSTIN सही नहीं है।',
  account_needs_ifsc: 'खाता नंबर और IFSC दोनों साथ भरें।',
  source_required: 'धारा और स्रोत दोनों लिखें — बिना स्रोत के TDS नियम नहीं बनता।',
  duplicate_date: 'इस तारीख़ का नियम पहले से है।',
  out_of_range: 'दर 0–30%, PAN बिना दर 0–40%, सीमा 0 या ज़्यादा।',
};

export const PAYOUT_ERROR_TEXT_EN: Record<string, string> = {
  date_required: 'Enter the payment date.',
  future_date: 'A payment cannot be recorded for a future date.',
  no_tds_rule: 'No TDS rule is in force on this date — add one first (a 0% rule with its reason if TDS does not apply).',
  nothing_payable: 'Nothing is payable (or the clawback is equal or larger).',
  commission_not_payable: 'None of the chosen commissions is payable — check the list again.',
  stale_preview: 'The amount changed — make the preview again and check it.',
  utr_required: 'Enter the UTR / reference number (at least 6 characters).',
  invalid_method: 'Choose the payment method.',
  invalid_pan: 'PAN is not valid (e.g. ABCDE1234F).',
  invalid_account: 'Account number: digits only, 6–20 digits.',
  invalid_ifsc: 'IFSC is not valid (e.g. SBIN0001234).',
  invalid_upi: 'UPI ID is not valid (e.g. name@okaxis).',
  invalid_gstin: 'GSTIN is not valid.',
  account_needs_ifsc: 'Fill account number and IFSC together.',
  source_required: 'Enter both the section and the source — a TDS rule needs a source.',
  duplicate_date: 'A rule for this date already exists.',
  out_of_range: 'Rate 0–30%, rate without PAN 0–40%, threshold 0 or more.',
};

export function payoutErrorText(code: string | undefined | null, lang: Lang = 'hi'): string {
  if (lang === 'en') return (code && PAYOUT_ERROR_TEXT_EN[code]) || 'The payment was not recorded — try again.';
  return (code && PAYOUT_ERROR_TEXT[code]) || 'भुगतान दर्ज नहीं हुआ — दोबारा कोशिश करें।';
}

// ── partner portal hand-out (migration 168) ───────────────────────────────────────────────────────────────────

export const PARTNER_PORTAL_URL = 'https://sahakarlekha.com/partner/login';

/** The message the admin sends on WhatsApp after approval (mirrors welcomeWhatsAppText in _shared/partner-email.mjs). */
export function partnerWelcomeWhatsAppText(name: string, code: string): string {
  return `नमस्ते ${name}, आपका सहकार लेखा partner आवेदन मंज़ूर हो गया है।\n` +
    `Referral code: ${code}\nReferral link: https://sahakarlekha.com/?ref=${code}\n` +
    `Partner portal (आपके ईमेल से login): ${PARTNER_PORTAL_URL}`;
}

/** wa.me link straight to the partner's own number (stored as 10 digits). */
export function partnerWelcomeWhatsAppUrl(phone: string, name: string, code: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const to = /^[6-9][0-9]{9}$/.test(digits) ? `91${digits}` : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(partnerWelcomeWhatsAppText(name, code))}`;
}

// ── storage wrappers (never throw: private windows / blocked storage just mean "no code") ─────────────────────

export function loadReferral(storage: Pick<Storage, 'getItem'> | null | undefined, now: number): StoredReferral | null {
  try {
    const stored = parseStoredReferral(storage?.getItem(REF_STORAGE_KEY) ?? null);
    return isFresh(stored, now) ? stored : null;
  } catch {
    return null;
  }
}

/** Remember the ?ref= code from this URL if there is one and no fresh code is already held. */
export function captureReferral(search: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined, now: number): StoredReferral | null {
  const incoming = referralFromSearch(search);
  if (!incoming) return null;
  try {
    const existing = parseStoredReferral(storage?.getItem(REF_STORAGE_KEY) ?? null);
    const next = nextStoredReferral(existing, incoming, now);
    if (next && next !== existing) storage?.setItem(REF_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}
