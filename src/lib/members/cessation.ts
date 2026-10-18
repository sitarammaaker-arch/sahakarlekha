/**
 * Member-audit M4 (2026-10-17) — when a member leaves: the real date, the resolution behind it, the two-year
 * liability of a past member and the settlement of a deceased member's shares. PURE — scripts/test-member-m4.mjs.
 *
 *  • Rules 1989 r.22(c) — the register records the date a person ceased to be a member (a back-dated resignation
 *    or death must carry its own date, not the day it was typed in).
 *  • Rules r.19 — expulsion by a resolution of a general meeting (two-thirds of members present and entitled to
 *    vote); Model Bye-laws cl.7(10) — withdrawal accepted by a Board resolution. Missing resolution → WARNING.
 *  • Act 1984 s.24 — a past member, or a deceased member's estate, stays liable for the society's debts as they
 *    stood on the date of leaving / death, for two years from that date.
 *  • Act s.23 — on death the share / interest goes to the nominee (or heir); other moneys are paid unless a court
 *    order arrives within six months. Act s.55 — the society may set the member's dues off against them.
 * The app WARNS on the legal steps (other states differ); dates are validated.
 */
import type { MemberStatus } from '@/types';

/** Late-added member columns (migration 117) — never in the base upsert; written by changeMemberStatus's own update. */
export const MEMBER_STATUS_EXTRA_FIELDS = ['statusResolutionNo', 'statusResolutionDate'] as const;

const isIso = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Statuses that end membership (r.22(c) date of ceasing). */
export const EXIT_STATUSES: MemberStatus[] = ['resigned', 'expelled', 'deceased', 'disqualified'];
export const isExit = (s?: string) => EXIT_STATUSES.includes(s as MemberStatus);

/** Same day, N months later (clamped to the month's end). */
export function addMonths(date: string, n: number): string {
  const y0 = +date.slice(0, 4), m0 = +date.slice(5, 7) - 1 + n, d = +date.slice(8, 10);
  const y = y0 + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12 + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** s.24: the last day a past / deceased member's liability runs (two years from leaving). */
export const liabilityUntil = (ceasedOn?: string) => (isIso(ceasedOn) ? addMonths(ceasedOn, 24) : undefined);

export interface StatusChangeInput {
  to: MemberStatus;
  effectiveDate: string;
  resolutionNo?: string;
  resolutionDate?: string;
}

/** Validate a lifecycle change: a real date (not future, not before the member joined); missing resolution warns. */
export function validateStatusChange(input: StatusChangeInput, ctx: { today: string; joinedOn?: string }): { ok: boolean; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!isIso(input.effectiveDate)) return { ok: false, error: 'स्थिति बदलने की तिथि भरें। (Enter the effective date.)', warnings };
  if (input.effectiveDate > ctx.today) return { ok: false, error: 'तिथि आज के बाद की नहीं हो सकती। (The date cannot be in the future.)', warnings };
  if (isIso(ctx.joinedOn) && input.effectiveDate < ctx.joinedOn) return { ok: false, error: 'तिथि सदस्यता तिथि से पहले की नहीं हो सकती। (Before the member joined.)', warnings };
  if (input.resolutionDate && (!isIso(input.resolutionDate) || input.resolutionDate > ctx.today)) return { ok: false, error: 'प्रस्ताव तिथि सही नहीं है। (Invalid resolution date.)', warnings };
  if (!input.resolutionNo?.trim()) {
    if (input.to === 'expelled') warnings.push('निष्कासन का आम सभा प्रस्ताव नहीं भरा — नियम 19: उपस्थित व मत-योग्य सदस्यों के 2/3 बहुमत का प्रस्ताव ज़रूरी है।');
    if (input.to === 'resigned') warnings.push('त्यागपत्र स्वीकृति का संचालक मंडल प्रस्ताव नहीं भरा — रजिस्टर व ऑडिट के लिए भरना अच्छा रहेगा।');
  }
  return { ok: true, warnings };
}

export interface DeathSettlement {
  shareCapital: number;
  dues: number;
  setOff: number;            // s.55: dues met from the share money
  payableToNominee: number;  // what reaches the nominee / heir
  courtOrderWindowUntil?: string;  // s.23: other moneys after six months unless a court order arrives
}

/** s.23 + s.55: share money to the nominee after the member's dues. */
export function deathSettlement(input: { shareCapital: number; dues: number; dateOfDeath?: string }): DeathSettlement {
  const share = r2(Math.max(0, input.shareCapital || 0));
  const dues = r2(Math.max(0, input.dues || 0));
  const setOff = Math.min(share, dues);
  return {
    shareCapital: share, dues, setOff,
    payableToNominee: r2(share - setOff),
    courtOrderWindowUntil: isIso(input.dateOfDeath) ? addMonths(input.dateOfDeath, 6) : undefined,
  };
}
