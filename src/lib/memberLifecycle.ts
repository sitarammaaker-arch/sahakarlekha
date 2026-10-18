/**
 * Member lifecycle — the pure status model (ECR-16). Extracted from DataContext so the transition
 * rule is testable in isolation and reusable across the app. PURE — no React, no Supabase.
 */
import type { MemberStatus } from '@/types';

/** The five lifecycle states, in canonical order. */
export const MEMBER_STATUSES: MemberStatus[] = ['active', 'inactive', 'resigned', 'expelled', 'deceased', 'disqualified'];

/**
 * Valid lifecycle transition? No self-transition; 'deceased' is terminal (shares pass to a nominee
 * via a separate flow). Every other move between distinct states is allowed.
 */
export function canTransitionMember(from: MemberStatus, to: MemberStatus): boolean {
  // 'disqualified' is terminal too (r.14(2)): a person who later becomes eligible again applies afresh.
  return from !== to && from !== 'deceased' && from !== 'disqualified' && MEMBER_STATUSES.includes(to);
}

/** Is a member currently active (counts toward quorum, dividends, eligibility)? */
export function isMemberActive(status: MemberStatus): boolean {
  return status === 'active';
}

/**
 * Member-audit M1 (U4, 2026-10-16): the one label per status. Registers, PDFs and the view dialog used to print
 * every non-active member as "Inactive", hiding resigned / expelled / deceased members behind one word.
 */
export const MEMBER_STATUS_LABEL: Record<MemberStatus, { hi: string; en: string }> = {
  active: { hi: 'सक्रिय', en: 'Active' },
  inactive: { hi: 'निष्क्रिय', en: 'Inactive' },
  resigned: { hi: 'त्यागपत्र', en: 'Resigned' },
  expelled: { hi: 'निष्कासित', en: 'Expelled' },
  deceased: { hi: 'मृत', en: 'Deceased' },
  disqualified: { hi: 'अयोग्य (नियम 14)', en: 'Disqualified (r.14)' },
};

export function memberStatusLabel(status: MemberStatus | undefined, hi = false): string {
  const l = MEMBER_STATUS_LABEL[status ?? 'active'] ?? MEMBER_STATUS_LABEL.active;
  return hi ? l.hi : l.en;
}

/**
 * M6: one label per member type. "नाममात्र सदस्य" (nominal) — never "नॉमिनल", which sounds like "नामांकित" (nominee).
 * Associate (Haryana Act s.18): no share in assets / profits, no vote.
 */
export const MEMBER_TYPE_LABEL: Record<'member' | 'nominal' | 'associate', { hi: string; en: string }> = {
  member: { hi: 'सदस्य', en: 'Member' },
  nominal: { hi: 'नाममात्र सदस्य', en: 'Nominal' },
  associate: { hi: 'सहयोगी सदस्य', en: 'Associate' },
};

export function memberTypeLabel(type: string | undefined, hi = false): string {
  const l = MEMBER_TYPE_LABEL[(type as 'member') || 'member'] ?? MEMBER_TYPE_LABEL.member;
  return hi ? l.hi : l.en;
}
