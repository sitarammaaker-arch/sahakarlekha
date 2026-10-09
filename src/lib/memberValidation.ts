/**
 * Member-form rules shared by the Members "new member" form and the Member Application form (2026-10-09) —
 * the application used to check only the name, so a pending applicant skipped the phone and nominee rules
 * the Members form enforces. PURE.
 */
import { MOBILE_RE } from './partyValidation';

/** Phone is optional (founder 2026-10-09); if given it must be a real 10-digit mobile, not one digit ×10. */
export function memberPhoneError(phone: string | undefined, hi = true): string | null {
  const v = (phone || '').trim();
  if (!v) return null;
  if (!MOBILE_RE.test(v)) return hi ? 'मोबाइल नंबर 10 अंक का हो (6-9 से शुरू), या खाली छोड़ें' : 'Mobile must be 10 digits (starting 6-9), or leave it blank';
  if (/^(\d)\1{9}$/.test(v)) return hi ? 'यह नकली नंबर लगता है — सही नंबर भरें या खाली छोड़ें' : 'This looks like a dummy number — enter the real one or leave it blank';
  return null;
}

/** ECR-16: nomination is mandatory — at least one nominee (the primary block OR the multi-nominee list). */
export function memberNomineeError(primaryName: string | undefined, listNames: (string | undefined)[] = [], hi = true): string | null {
  const any = !!(primaryName || '').trim() || listNames.some((n) => !!(n || '').trim());
  return any ? null : (hi ? 'कम से कम एक नामांकित (nominee) का नाम भरें' : 'Enter at least one nominee');
}
