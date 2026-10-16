/**
 * Member lifecycle — the pure status model (ECR-16). Extracted from DataContext so the transition
 * rule is testable in isolation and reusable across the app. PURE — no React, no Supabase.
 */
import type { MemberStatus } from '@/types';

/** The five lifecycle states, in canonical order. */
export const MEMBER_STATUSES: MemberStatus[] = ['active', 'inactive', 'resigned', 'expelled', 'deceased'];

/**
 * Valid lifecycle transition? No self-transition; 'deceased' is terminal (shares pass to a nominee
 * via a separate flow). Every other move between distinct states is allowed.
 */
export function canTransitionMember(from: MemberStatus, to: MemberStatus): boolean {
  return from !== to && from !== 'deceased' && MEMBER_STATUSES.includes(to);
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
};

export function memberStatusLabel(status: MemberStatus | undefined, hi = false): string {
  const l = MEMBER_STATUS_LABEL[status ?? 'active'] ?? MEMBER_STATUS_LABEL.active;
  return hi ? l.hi : l.en;
}
