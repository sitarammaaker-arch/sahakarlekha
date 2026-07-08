/**
 * Member KYC validation (ECR-16).
 *
 * Aadhaar and PAN are optional, but if provided must be well-formed. Pure & deterministic
 * → unit-tested by scripts/test-kyc.mjs. Values are PII: display masked, and the audit
 * log redacts the 'aadhaar' / 'pan' keys.
 */

const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export interface KycValidation {
  ok: boolean;
  error?: string;
}

/** Validate optional Aadhaar (12 digits) and PAN (ABCDE1234F). Empty is allowed. */
export function validateKyc(aadhaar?: string, pan?: string): KycValidation {
  const a = (aadhaar || '').replace(/\s/g, '');
  if (a && !AADHAAR_RE.test(a)) return { ok: false, error: 'आधार 12 अंकों का होना चाहिए / Aadhaar must be 12 digits' };
  const p = (pan || '').toUpperCase().trim();
  if (p && !PAN_RE.test(p)) return { ok: false, error: 'PAN गलत है (उदा. ABCDE1234F) / Invalid PAN (e.g. ABCDE1234F)' };
  return { ok: true };
}

/** Mask an Aadhaar/PAN for display — shows only the last 4 characters. */
export function maskId(value?: string): string {
  const v = (value || '').trim();
  if (v.length <= 4) return v;
  return `${'X'.repeat(v.length - 4)}${v.slice(-4)}`;
}
