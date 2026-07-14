/**
 * Activity inference + cutover parity (T-12 / ADR-0003; MR-1 — the empty-diff guarantee).
 *
 * PURE. The Activities-layer cutover switches a society from "all entitled caps" (type
 * template) to "only the caps its declared activities light up" (within entitlement). The
 * risk is losing a module (MR-1). This file makes the cutover SAFE:
 *
 *   inferActivities(type)  — the canonical activities a society of each type runs, chosen so
 *                            their combined capabilities COVER the type's operational (non-core)
 *                            template. Compliance caps (is_core: gst/tds/jurisdiction) are
 *                            always-on, so they need no activity.
 *   hasCutoverParity(...)  — verifies, against a society's ACTUAL entitlement (rows included),
 *                            that resolving WITH the inferred activities reproduces resolving
 *                            WITHOUT them. true ⇒ populating society_activities loses no module.
 *                            The cutover is gated on this: no parity, no flip.
 *
 * Inference is by TYPE today; it extends to operational evidence (loans → credit, stock →
 * retail, milk → dairy) without changing the parity contract — hasCutoverParity is the gate
 * regardless of how the activities were inferred.
 */
import type { SocietyType } from '@/types';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import type { Activity } from './activities';
import type { SocietyCapabilityRow } from './capabilities';
import { resolveCapabilities } from './capabilityResolver';

/**
 * The activities inferred for each society type — picked so that, intersected with the type's
 * entitlement and unioned with the always-on core caps, they reproduce the type template
 * exactly (verified by test-activity-inference for every type).
 */
export const TYPE_INFERRED_ACTIVITIES: Record<SocietyType, Activity[]> = {
  marketing_processing: ['marketing_aggregation', 'transport'],
  pacs: ['credit_short_term', 'deposits_savings', 'agri_input_retail', 'foodgrain_procurement'],
  consumer: ['consumer_retail', 'fair_price_shop_pds'],
  dairy: ['milk_procurement', 'milk_sales'],
  housing: ['housing_management', 'maintenance_billing'],
  sugar: ['processing', 'foodgrain_procurement'],
  labour: ['labour_works'],
  producer: ['marketing_aggregation', 'agri_input_retail'],
  multistate: ['credit_short_term', 'deposits_savings', 'marketing_aggregation'],
  multipurpose: ['credit_short_term', 'deposits_savings', 'milk_procurement', 'consumer_retail', 'fair_price_shop_pds', 'foodgrain_procurement'],
  other: ['credit_short_term', 'deposits_savings', 'consumer_retail'],
};

/** PURE — the activities inferred for a society, from its type (the backfill seed for
 *  society_activities). Extend with operational evidence at the cutover. */
export function inferActivities(societyType: SocietyType): Activity[] {
  return TYPE_INFERRED_ACTIVITIES[societyType] ?? [];
}

/**
 * PURE — does resolving WITH `activities` reproduce resolving WITHOUT them (the current,
 * type-template result)? The empty-diff parity check (MR-1): true ⇒ switching this society to
 * activity-gating loses no module. Verified against the society's ACTUAL entitlement, so a
 * license grant that the inferred activities don't cover correctly returns false (block the flip).
 */
export function hasCutoverParity(
  societyType: SocietyType,
  rows: SocietyCapabilityRow[] = [],
  activities: readonly Activity[] = inferActivities(societyType),
  nowMs?: number,
  state?: string,
): boolean {
  const before = resolveCapabilities(societyType, rows, nowMs, state);              // today (empty activities)
  const after = resolveCapabilities(societyType, rows, nowMs, state, activities);   // activity-gated
  return before.size === after.size && [...before].every((c) => after.has(c));
}

// ── Backfill planning (T-12) ──────────────────────────────────────────────────────────────────────
// Turning inferActivities + hasCutoverParity into the concrete society_activities rows to seed. PURE:
// the ops script (scripts/backfill-activities.mjs) does the Supabase I/O; this decides WHAT to write.

/** One society's current facts, as the backfill reads them from Supabase. */
export interface SocietyBackfillInput {
  societyId: string;
  societyType: SocietyType;
  state?: string;
  /** its society_capabilities rows (entitlement is checked against these). */
  rows?: SocietyCapabilityRow[];
  /** activities it ALREADY declares (skip these — idempotent re-runs). */
  existing?: readonly Activity[];
}

/** A society_activities row the backfill would insert (shape matches the table / export descriptor). */
export interface ActivityBackfillRow {
  id: string;
  society_id: string;
  jurisdiction: string;
  activity: Activity;
  status: 'active';
}

/** The decision for one society: what to write, or why nothing is written. */
export interface SocietyBackfillPlan {
  societyId: string;
  societyType: SocietyType;
  inferred: Activity[];
  /** empty-diff parity of the inferred set against this society's real entitlement (MR-1 gate). */
  parity: boolean;
  rowsToInsert: ActivityBackfillRow[];
  /** why rowsToInsert is empty (null ⇒ it isn't). */
  skipped: 'no-parity' | 'already-declared' | null;
}

/** Deterministic society_activities id — matches unique(society_id, activity), so a re-run is idempotent. */
export function backfillRowId(societyId: string, activity: Activity): string {
  return `${societyId}:${activity}`;
}

/**
 * PURE — plan the society_activities backfill for a set of societies. Per society: infer its
 * activities from type, and ONLY if that reproduces its current entitlement exactly (hasCutoverParity
 * — MR-1) emit rows for the not-yet-declared ones. A society whose inferred activities do NOT cover
 * its entitlement (e.g. a license grant no activity maps to) is SKIPPED with `no-parity` for manual
 * review — never silently backfilled into a module loss. Writing these rows is dormant regardless
 * (the resolver ignores society_activities until that tenant's cutover flag is flipped).
 */
export function planActivityBackfill(inputs: SocietyBackfillInput[], nowMs?: number): SocietyBackfillPlan[] {
  return (Array.isArray(inputs) ? inputs : []).map((s) => {
    const inferred = inferActivities(s.societyType);
    const parity = hasCutoverParity(s.societyType, s.rows ?? [], inferred, nowMs, s.state);
    if (!parity) return { societyId: s.societyId, societyType: s.societyType, inferred, parity, rowsToInsert: [], skipped: 'no-parity' };
    const have = new Set<Activity>(s.existing ?? []);
    const jurisdiction = resolveJurisdiction(s.state);
    const rowsToInsert: ActivityBackfillRow[] = inferred
      .filter((a) => !have.has(a))
      .map((activity) => ({ id: backfillRowId(s.societyId, activity), society_id: s.societyId, jurisdiction, activity, status: 'active' as const }));
    return {
      societyId: s.societyId,
      societyType: s.societyType,
      inferred,
      parity,
      rowsToInsert,
      skipped: rowsToInsert.length === 0 ? 'already-declared' : null,
    };
  });
}
