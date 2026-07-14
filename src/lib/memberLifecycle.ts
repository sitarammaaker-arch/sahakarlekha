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
