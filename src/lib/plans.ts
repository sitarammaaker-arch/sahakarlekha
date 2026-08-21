/**
 * PLAN_CATALOG — the single source of truth for SahakarLekha subscription plans.
 *
 * Prices are annual (per society, per financial year). Numeric limits here are the
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
  /** annual price in ₹ (per society / FY); null = custom (enterprise, "starting at") */
  price: number | null;
  /** max login users; null = unlimited */
  seatsLimit: number | null;
  /** max societies under one owner/account; null = unlimited */
  maxSocieties: number | null;
  /** true = a publicly selectable plan on /pricing */
  isPublic: boolean;
}

export const PLAN_CATALOG: Record<PlanId, PlanSpec> = {
  // Public plans — annual per society / FY.
  starter:    { id: 'starter',    price: 1499,  seatsLimit: 1,    maxSocieties: 1,    isPublic: true },
  plus:       { id: 'plus',       price: 3999,  seatsLimit: 6,    maxSocieties: 1,    isPublic: true }, // 5 staff + 1 auditor/CA
  pro:        { id: 'pro',        price: 9999,  seatsLimit: null, maxSocieties: null, isPublic: true }, // unlimited users, multi-society
  enterprise: { id: 'enterprise', price: 49000, seatsLimit: null, maxSocieties: null, isPublic: false }, // "starting at"; contact sales
  // Internal plans — never shown as a selectable public option.
  legacy:     { id: 'legacy',     price: 0,     seatsLimit: null, maxSocieties: null, isPublic: false }, // grandfathered existing societies
  trial:      { id: 'trial',      price: 0,     seatsLimit: 1,    maxSocieties: 1,    isPublic: false }, // 30-day, Starter-equivalent
};

/** Number of days a new-signup trial lasts (Phase 2a-4). */
export const TRIAL_DAYS = 30;

/** Grace window after period_end before a subscription flips to read-only (Phase 2a-4). */
export const GRACE_DAYS = 7;

/** ₹ display label, e.g. 1499 → "₹1,499"; null → "Custom". */
export const priceLabel = (n: number | null): string =>
  n == null ? 'Custom' : `₹${n.toLocaleString('en-IN')}`;

/** The public plans, in display order. */
export const PUBLIC_PLANS: PlanId[] = ['starter', 'plus', 'pro'];
