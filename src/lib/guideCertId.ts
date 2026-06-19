/**
 * guideCertId — deterministic, self-verifying certificate numbers for the
 * backend-free guide. The number embeds the issue date and a checksum derived
 * from (holder name + date), so the /guide/verify page can confirm that a given
 * number, name and date all belong together — no server lookup needed.
 *
 * Note: this is a self-validating code (binds name⇄date⇄number), not a
 * server registry; it detects typos/tampering rather than guaranteeing
 * cryptographic non-forgeability.
 */
const NAMESPACE = 'sahakarlekha-guide-v1';

/** FNV-1a 32-bit hash (deterministic, sync). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function normName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Build "SL-YYYYMMDD-XXXXXX" from a holder name and an ISO date (YYYY-MM-DD). */
export function makeCertNumber(name: string, isoDate: string): string {
  const datePart = isoDate.replace(/-/g, '');
  const h = fnv1a(`${normName(name)}|${isoDate}|${NAMESPACE}`);
  const code = (h % 2176782336).toString(36).toUpperCase().padStart(6, '0'); // 36^6
  return `SL-${datePart}-${code}`;
}

export interface CertVerifyResult {
  valid: boolean;
  isoDate?: string;
}

/** Check that a certificate number matches the given holder name. */
export function verifyCertNumber(number: string, name: string): CertVerifyResult {
  const cleaned = number.trim().toUpperCase().replace(/\s+/g, '');
  const m = cleaned.match(/^SL-(\d{8})-([0-9A-Z]{6})$/);
  if (!m || !name.trim()) return { valid: false };
  const dp = m[1];
  const iso = `${dp.slice(0, 4)}-${dp.slice(4, 6)}-${dp.slice(6, 8)}`;
  // basic date sanity
  const mo = Number(dp.slice(4, 6));
  const da = Number(dp.slice(6, 8));
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return { valid: false };
  const expected = makeCertNumber(name, iso);
  return { valid: expected === cleaned, isoDate: iso };
}

/** Friendly date from an ISO date (Hindi or English locale). */
export function formatCertDate(isoDate: string, lang: 'hi' | 'en' = 'hi'): string {
  try {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString(lang === 'en' ? 'en-IN' : 'hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
