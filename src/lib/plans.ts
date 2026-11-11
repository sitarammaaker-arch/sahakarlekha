/**
 * PLAN_CATALOG — the single source of truth for SahakarLekha subscription plans.
 *
 * Prices are annual (per society, 12 months from payment) and BEFORE GST — create-order adds
 * GST at the billing_seller rate and charges the total. Numeric limits here are the
 * authority for the caps enforced in Phase 2a-3 (users / societies); the plan →
 * capability (feature) mapping is added in 2a-2. `legacy` (grandfathered existing
 * societies) and `trial` (30-day, Starter-equivalent) are INTERNAL — not publicly
 * selectable. This mirrors the `plan` enum in migration 055 (subscriptions.plan).
 *
 * Keep prices in sync with the /pricing page copy; this file is the value source
 * so downstream consumers never hard-code amounts.
 */
export type PlanId = 'starter' | 'plus' | 'pro' | 'enterprise' | 'legacy' | 'trial';

export interface PlanSpec {
  id: PlanId;
  /** annual price in ₹ before GST (per society); null = custom (enterprise, "starting at") */
  price: number | null;
  /** max login users; null = unlimited */
  seatsLimit: number | null;
  /** max societies under one owner/account; null = unlimited */
  maxSocieties: number | null;
  /** true = a publicly selectable plan on /pricing */
  isPublic: boolean;
}

export const PLAN_CATALOG: Record<PlanId, PlanSpec> = {
  // Public plans — annual per society, + GST (founder 2026-11-11; were 1499 / 3999 / 9999 GST-inclusive).
  starter:    { id: 'starter',    price: 2999,  seatsLimit: 1,    maxSocieties: 1,    isPublic: true },
  plus:       { id: 'plus',       price: 6999,  seatsLimit: 6,    maxSocieties: 1,    isPublic: true }, // any 6 active users — the cap is role-blind (e.g. 5 staff + 1 auditor/CA)
  pro:        { id: 'pro',        price: 14999, seatsLimit: null, maxSocieties: null, isPublic: true }, // unlimited users, multi-society
  enterprise: { id: 'enterprise', price: 49000, seatsLimit: null, maxSocieties: null, isPublic: false }, // "starting at"; contact sales
  // Internal plans — never shown as a selectable public option.
  legacy:     { id: 'legacy',     price: 0,     seatsLimit: null, maxSocieties: null, isPublic: false }, // grandfathered existing societies
  trial:      { id: 'trial',      price: 0,     seatsLimit: 1,    maxSocieties: 1,    isPublic: false }, // 30-day, Starter-equivalent
};

/** Number of days a new-signup trial lasts (Phase 2a-4). */
export const TRIAL_DAYS = 30;

/** Grace window after period_end before a subscription flips to read-only (Phase 2a-4). */
export const GRACE_DAYS = 7;

export type SubStatus = 'active' | 'trialing' | 'grace' | 'expired';

const STRICTNESS: Record<SubStatus, number> = { active: 0, trialing: 0, grace: 1, expired: 2 };
const DAY_MS = 86_400_000;

/**
 * The status a subscription really has NOW, derived from period_end — the same rule as
 * refresh_subscription_status() (migration 159), so the notice and the pause never wait for the
 * hourly job:
 *   no period_end                   → the stored status (an indefinite row never expires);
 *   before period_end               → the stored status;
 *   up to GRACE_DAYS after          → 'grace'  (still writable, with a notice);
 *   later                           → 'expired' (new vouchers paused).
 * Never LOOSER than the stored status: if the server already says grace / expired, that stands.
 * The plan does not matter: a grandfathered ('legacy') society is indefinite only while its
 * period_end is null. Founder 2026-11-11 gave the existing legacy societies an end date
 * (31-03-2027, migration 160), after which they follow this same rule.
 */
export function effectiveStatus(
  plan: string | null | undefined,
  status: SubStatus | null | undefined,
  periodEnd: string | null | undefined,
  nowMs: number = Date.now(),
): SubStatus {
  const stored: SubStatus = status ?? 'active';
  void plan; // kept in the signature for callers; the rule depends on period_end alone
  if (!periodEnd) return stored;
  const end = new Date(periodEnd).getTime();
  if (!Number.isFinite(end) || nowMs < end) return stored;
  const derived: SubStatus = nowMs >= end + GRACE_DAYS * DAY_MS ? 'expired' : 'grace';
  return STRICTNESS[derived] >= STRICTNESS[stored] ? derived : stored;
}

/** Whole days until `iso` (rounded up; negative once past); null when there is no date. */
export function daysUntil(iso: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.ceil((t - nowMs) / DAY_MS) : null;
}

/** Days of grace left before new entries pause (0 once expired); null when there is no period_end. */
export function graceDaysLeft(periodEnd: string | null | undefined, nowMs: number = Date.now()): number | null {
  const d = daysUntil(periodEnd, nowMs);
  return d == null ? null : Math.max(0, d + GRACE_DAYS);
}

/** A paid plan this close to its end shows a renewal reminder. */
export const RENEWAL_NOTICE_DAYS = 15;

/** A grandfathered (free) society is told this many days before its free period ends. */
export const LEGACY_NOTICE_DAYS = 30;

/** ₹ display label, e.g. 1499 → "₹1,499"; null → "Custom". */
export const priceLabel = (n: number | null): string =>
  n == null ? 'Custom' : `₹${n.toLocaleString('en-IN')}`;

/** The public plans, in display order. */
export const PUBLIC_PLANS: PlanId[] = ['starter', 'plus', 'pro'];

/**
 * Features that depend on the plan (founder 2026-11-11). Everything not listed here is open on
 * every plan. Trial and legacy societies get every feature (a trial is for trying the product;
 * grandfathered societies keep what they had) — until their period ends, when the separate
 * expiry rule above pauses new entries for everyone.
 *   payroll       — Plus and up (staff salary: /salary, /payroll)
 *   multiBranch   — Pro and up (/branches)
 *   consolidation — Pro and up (/multi-society-consolidation)
 *   memberPortal  — Plus and up (mirrors src/lib/memberPortalHandout.ts portalPlanAllowed and the
 *                   server gate of migration 064; scripts/test-plan-features.mjs keeps them equal)
 * The server enforces payroll too: migration 161 refuses a new payroll employee or payroll run
 * for a plan without it.
 */
export type PlanFeature = 'payroll' | 'multiBranch' | 'consolidation' | 'memberPortal';

export const PLAN_FEATURES: Record<PlanFeature, PlanId[]> = {
  payroll:       ['plus', 'pro', 'enterprise', 'legacy', 'trial'],
  multiBranch:   ['pro', 'enterprise', 'legacy', 'trial'],
  consolidation: ['pro', 'enterprise', 'legacy', 'trial'],
  memberPortal:  ['plus', 'pro', 'enterprise', 'legacy', 'trial'],
};

/** Does this plan include the feature? An unknown / missing plan is treated as legacy (never stricter). */
export function planAllows(plan: string | null | undefined, feature: PlanFeature): boolean {
  return PLAN_FEATURES[feature].includes(((plan ?? 'legacy') as PlanId));
}

/** The cheapest public plan that includes the feature — what the upgrade notice asks for. */
export function minPlanFor(feature: PlanFeature): 'plus' | 'pro' {
  return PLAN_FEATURES[feature].includes('plus') ? 'plus' : 'pro';
}

/** Feature names for notices, Hindi first. */
export const PLAN_FEATURE_LABEL: Record<PlanFeature, { hi: string; en: string }> = {
  payroll:       { hi: 'Payroll (कर्मचारी व वेतन)', en: 'Payroll (staff and salaries)' },
  multiBranch:   { hi: 'Multi-Branch (शाखाएँ)', en: 'Multi-Branch' },
  consolidation: { hi: 'कई समितियों की संयुक्त रिपोर्ट', en: 'Multi-society consolidation' },
  memberPortal:  { hi: 'Member Portal', en: 'Member Portal' },
};
