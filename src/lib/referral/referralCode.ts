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
export const PARTNER_CATEGORIES: { value: string; label: string }[] = [
  { value: 'creator', label: 'YouTube / सोशल मीडिया creator' },
  { value: 'accountant', label: 'लेखाकार (Accountant)' },
  { value: 'ca', label: 'CA / टैक्स सलाहकार' },
  { value: 'consultant', label: 'Software / IT सलाहकार' },
  { value: 'retired', label: 'सेवानिवृत्त (रिटायर्ड) कर्मचारी' },
  { value: 'other', label: 'अन्य' },
];

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

export function referralErrorText(code: string | undefined | null): string {
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

export const SOCIETY_STAGE_TEXT: Record<SocietyStage, { label: string; cls: string }> = {
  paid: { label: 'भुगतान हुआ', cls: 'bg-green-100 text-green-900' },
  trial: { label: 'Trial पर', cls: 'bg-blue-100 text-blue-900' },
  expired: { label: 'Trial/plan ख़त्म', cls: 'bg-amber-100 text-amber-900' },
  free: { label: 'पुराना मुफ़्त plan', cls: 'bg-muted text-foreground' },
  joined: { label: 'जुड़ी', cls: 'bg-muted text-foreground' },
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
