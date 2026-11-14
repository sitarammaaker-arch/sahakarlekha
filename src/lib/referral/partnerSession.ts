/**
 * Partner portal session (migration 168). The session is NOT a Supabase Auth login: partner_login_verify returns a
 * random 64-hex token that the browser keeps here and passes to partner_portal / partner_details_request /
 * partner_logout. It lasts 30 days on the server; logging out revokes it there and clears it here.
 * Storage wrappers take the Storage as an argument and never throw (private windows / blocked storage = signed out).
 */

export const PARTNER_SESSION_KEY = 'sl_partner_session';
const SESSION_RE = /^[0-9a-f]{64}$/;

export function isSessionToken(raw: string | null | undefined): raw is string {
  return typeof raw === 'string' && SESSION_RE.test(raw);
}

export function loadPartnerSession(storage: Pick<Storage, 'getItem'> | null | undefined): string | null {
  try {
    const v = storage?.getItem(PARTNER_SESSION_KEY) ?? null;
    return isSessionToken(v) ? v : null;
  } catch {
    return null;
  }
}

export function savePartnerSession(storage: Pick<Storage, 'setItem'> | null | undefined, token: string): boolean {
  if (!isSessionToken(token)) return false;
  try {
    storage?.setItem(PARTNER_SESSION_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearPartnerSession(storage: Pick<Storage, 'removeItem'> | null | undefined): void {
  try { storage?.removeItem(PARTNER_SESSION_KEY); } catch { /* ignore */ }
}

export const normalizeLoginEmail = (raw: string): string => raw.trim().toLowerCase();
export const isLoginEmail = (raw: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeLoginEmail(raw));
export const isLoginCode = (raw: string): boolean => /^[0-9]{6}$/.test(raw.trim());

export const LOGIN_ERROR_TEXT: Record<string, string> = {
  invalid_code: 'कोड सही नहीं है — ईमेल में आया 6 अंकों का कोड दोबारा देखें।',
  code_expired: 'कोड का समय निकल गया या वह इस्तेमाल हो चुका — नया कोड मँगाएँ।',
  too_many_attempts: 'बहुत बार गलत कोड डाला गया — नया कोड मँगाएँ।',
  session_expired: 'आपका login समाप्त हो गया — दोबारा login करें।',
};

export const loginErrorText = (code: string | undefined | null): string =>
  (code && LOGIN_ERROR_TEXT[code]) || 'Login नहीं हो सका — दोबारा कोशिश करें।';

/** Masked details the portal shows — never the full PAN / account (the server masks; this only formats). */
export interface MaskedDetails {
  pan_masked: string | null;
  pan_name: string | null;
  account_masked: string | null;
  ifsc: string | null;
  upi_masked: string | null;
  gstin: string | null;
  updated_at: string | null;
}
