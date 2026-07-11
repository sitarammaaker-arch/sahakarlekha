/**
 * Activity → capability map (T-10 / ADR-0003) — which capabilities each declared activity
 * lights up. The resolver (T-11) unions these OVER a society's declared activities and
 * intersects the result with entitlement, so an activity can never grant an unpaid
 * capability (gap MR-4). This is the ONE place an activity maps to behavior; modules still
 * gate only on capabilities (ADR-0002), never on activities.
 *
 * Typed `Record<Activity, Capability[]>`, so the compiler guarantees the map is TOTAL over
 * the catalog and every value is a real Capability — a typo or a missing activity is a build
 * error, not a silent gap. An empty list means "declarable, but its capability does not exist
 * yet" — those arrive as new capabilities in T-13 (deposits → deposit_ledger, PDS → subsidy).
 */
import type { Activity } from './activities';
import type { Capability } from './capabilities';

export const ACTIVITY_CAPABILITY_MAP: Record<Activity, Capability[]> = {
  credit_short_term: ['lending'],
  credit_long_term: ['lending'],
  deposits_savings: [], // → deposit_ledger (T-13)
  deposits_term: [], // → deposit_ledger (T-13)
  milk_procurement: ['dairy_collection'],
  milk_sales: ['inventory_sales', 'gst'],
  agri_input_retail: ['inventory_sales', 'fertilizer_distribution', 'seed_distribution', 'gst'],
  custom_hiring_centre: [], // service; no dedicated capability yet
  foodgrain_procurement: ['procurement_msp'],
  warehousing: ['warehousing'],
  cold_storage: ['warehousing'],
  consumer_retail: ['inventory_sales', 'pos_billing', 'gst'],
  fair_price_shop_pds: ['inventory_sales', 'pos_billing'], // → + subsidy_reconciliation (T-13)
  lpg_cng_petrol_distribution: ['inventory_sales', 'gst'],
  marketing_aggregation: ['procurement_msp', 'inventory_sales'],
  processing: ['inventory_sales', 'procurement_msp'],
  fishery_operations: ['inventory_sales'],
  poultry_livestock: ['inventory_sales'],
  housing_management: ['housing'],
  maintenance_billing: ['housing'],
  labour_works: ['labour', 'pf_esi'],
  transport: ['transport'],
  common_service_centre: [], // emerging; no dedicated capability yet
};
