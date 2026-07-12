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
