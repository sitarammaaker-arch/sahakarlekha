/**
 * Member-audit M5 (2026-10-17) — the voters list, the defaulters list and the committee-reservation summary, all
 * "as on" a date. PURE — scripts/test-member-m5.mjs.
 *
 *  • Haryana Act 1984 s.20(d) — a member in default of any sum due to the society cannot vote; s.20 proviso (b) /
 *    s.18 — associate (here: nominal) members have no vote. Rules App. A para 35 — the Manager prepares the voters
 *    list (a "voter" is a share-holder) within a week of the election notice; it is exhibited for objections.
 *  • Act s.25(3)(d) — the annual general meeting reviews the list of defaulters with the amounts.
 *  • Act s.28(1) (2013 amendment) — every committee has at least one Scheduled Caste member and two women; one
 *    Backward Class member when BC members are at least 10% of the membership.
 * Defaulter = the app's one overdue rule (lib/loans/interestAccrual.isOverdueAt, used by the CAS overdue table):
 * a loan marked overdue, or past its due date with a balance; KCC the same with its own outstanding.
 */
import { isOverdueAt } from '@/lib/loans/interestAccrual';
import { loanOutstanding, kccOutstanding } from '@/lib/memberSnapshot';

type M = {
  id: string; memberId: string; name: string; fatherName?: string; address?: string; memberType?: string; status?: string;
  approvalStatus?: string; isDeleted?: boolean; joinDate?: string; admissionDate?: string; statusChangedAt?: string;
  gender?: string; caste?: string; shareCapital?: number;
};
type L = { id: string; loanNo: string; memberId: string; amount: number; repaidAmount: number; interestRate: number; dueDate?: string; status: string; isDeleted?: boolean };
type K = { id: string; memberId: string; status: string; dueDate?: string; outstandingAmount?: number; drawnAmount?: number; repaidAmount?: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const EXIT = new Set(['resigned', 'expelled', 'deceased']);

/** Overdue dues of each member on `asOf` (loans + KCC), memberId → { amount, items }. */
export function overdueByMember(loans: readonly L[], kcc: readonly K[], asOf: string): Map<string, { amount: number; items: string[] }> {
  const out = new Map<string, { amount: number; items: string[] }>();
  const add = (memberId: string, amount: number, item: string) => {
    if (!(amount > 0.005)) return;
    const cur = out.get(memberId) ?? { amount: 0, items: [] };
    cur.amount = r2(cur.amount + amount); cur.items.push(item); out.set(memberId, cur);
  };
  for (const l of loans) {
    if (l.isDeleted || l.status === 'cleared') continue;
    if (isOverdueAt(l, asOf)) add(l.memberId, loanOutstanding(l), `Loan ${l.loanNo}`);
  }
  for (const k of kcc) {
    const due = kccOutstanding(k as Parameters<typeof kccOutstanding>[0]);
    if (k.status === 'overdue' || (!!k.dueDate && k.dueDate < asOf && due > 0.005)) add(k.memberId, due, 'KCC');
  }
  return out;
}

export type ExclusionReason = 'not_approved' | 'nominal' | 'not_yet_member' | 'ceased' | 'defaulter';
export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  not_approved: 'आवेदन स्वीकृत नहीं',
  nominal: 'नाममात्र / सहयोगी सदस्य — मत का अधिकार नहीं (धारा 18/20)',
  not_yet_member: 'उस तिथि तक सदस्य नहीं बने थे',
  ceased: 'सदस्यता समाप्त (त्यागपत्र/निष्कासन/मृत्यु)',
  defaulter: 'बक़ायादार — मत का अधिकार नहीं (धारा 20(d))',
};

export interface VoterRoll<T extends M> {
  asOf: string;
  voters: T[];
  excluded: { member: T; reason: ExclusionReason; overdue?: number }[];
}

/** Who may vote on `asOf`: an approved, non-nominal member who joined by then, had not ceased, and is not in default. */
export function voterRoll<T extends M>(members: readonly T[], loans: readonly L[], kcc: readonly K[], asOf: string): VoterRoll<T> {
  const overdue = overdueByMember(loans, kcc, asOf);
  const voters: T[] = [];
  const excluded: VoterRoll<T>['excluded'] = [];
  const sorted = [...members].filter((m) => !m.isDeleted).sort((a, b) => a.memberId.localeCompare(b.memberId, 'en', { numeric: true }));
  for (const m of sorted) {
    if (m.approvalStatus === 'pending' || m.approvalStatus === 'rejected') { excluded.push({ member: m, reason: 'not_approved' }); continue; }
    const joined = m.admissionDate || m.joinDate;
    if (joined && joined > asOf) { excluded.push({ member: m, reason: 'not_yet_member' }); continue; }
    if (EXIT.has(m.status ?? '') && (!m.statusChangedAt || m.statusChangedAt <= asOf)) { excluded.push({ member: m, reason: 'ceased' }); continue; }
    if (m.memberType === 'nominal' || m.memberType === 'associate') { excluded.push({ member: m, reason: 'nominal' }); continue; }
    const od = overdue.get(m.id);
    if (od) { excluded.push({ member: m, reason: 'defaulter', overdue: od.amount }); continue; }
    voters.push(m);
  }
  return { asOf, voters, excluded };
}

/** s.25(3)(d): members in default on `asOf`, with the amount and what is overdue — largest first. */
export function defaulterList<T extends M>(members: readonly T[], loans: readonly L[], kcc: readonly K[], asOf: string): { member: T; amount: number; items: string[] }[] {
  const overdue = overdueByMember(loans, kcc, asOf);
  return members.filter((m) => !m.isDeleted && overdue.has(m.id))
    .map((m) => ({ member: m, ...overdue.get(m.id)! }))
    .sort((a, b) => b.amount - a.amount);
}

export interface ReservationSummary {
  total: number;
  women: number;
  sc: number;
  bc: number;
  bcPercent: number;
  bcSeatRequired: boolean;   // s.28(1): BC members ≥ 10% of the membership
  genderUnknown: number;
}

/** s.28(1): the category counts the committee reservation depends on (over the given — usually live — members). */
export function reservationSummary(members: readonly M[]): ReservationSummary {
  const total = members.length;
  const women = members.filter((m) => m.gender === 'female').length;
  const sc = members.filter((m) => m.caste === 'Schedule Caste').length;
  const bc = members.filter((m) => m.caste === 'Backward Class').length;
  const bcPercent = total ? r2((bc / total) * 100) : 0;
  return { total, women, sc, bc, bcPercent, bcSeatRequired: bcPercent >= 10, genderUnknown: members.filter((m) => !m.gender).length };
}

/** Whole years of age on `asOf` from a date of birth (undefined when not recorded). */
export function ageOn(dateOfBirth: string | undefined, asOf: string): number | undefined {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return undefined;
  let age = +asOf.slice(0, 4) - +dateOfBirth.slice(0, 4);
  if (asOf.slice(5) < dateOfBirth.slice(5)) age -= 1;
  return age >= 0 ? age : undefined;
}
