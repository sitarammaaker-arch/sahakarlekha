/**
 * Activities catalog (T-10 / ADR-0003, gap BA-1) — the business lines a society may DECLARE.
 *
 * A society is no longer defined by ONE type: a Multipurpose PACS runs credit + dairy + a
 * fair-price shop at once. That is modelled as a set of ACTIVITIES a society declares, which
 * resolve into capabilities (activityCapabilities.ts) WITHIN entitlement (the resolver — T-11).
 *
 * This is a declarative catalog, modelled the same way capabilities are — extensible by
 * adding an entry here + a mapping in activityCapabilities.ts, never by touching module code
 * (ADR-0002/0003). Per-society declared activities live in the `society_activities` table;
 * this file is the catalog of what CAN be declared.
 */

/** Every business activity in the catalog. Add a member here + a mapping in
 *  activityCapabilities.ts to onboard a new one. */
export type Activity =
  | 'credit_short_term'
  | 'credit_long_term'
  | 'deposits_savings'
  | 'deposits_term'
  | 'milk_procurement'
  | 'milk_sales'
  | 'agri_input_retail'
  | 'custom_hiring_centre'
  | 'foodgrain_procurement'
  | 'warehousing'
  | 'cold_storage'
  | 'consumer_retail'
  | 'fair_price_shop_pds'
  | 'lpg_cng_petrol_distribution'
  | 'marketing_aggregation'
  | 'processing'
  | 'fishery_operations'
  | 'poultry_livestock'
  | 'housing_management'
  | 'maintenance_billing'
  | 'labour_works'
  | 'transport'
  | 'common_service_centre';

export type ActivityGroup = 'credit' | 'agri_allied' | 'processing' | 'marketing' | 'services' | 'emerging';

export interface ActivityDef {
  code: Activity;
  label: string;
  /** Hindi-first label (RULE 7). */
  labelHi: string;
  group: ActivityGroup;
  /** National Cooperative Database category hint, for future statutory data exchange (ADR-0008). */
  ncdCategory?: string;
}

/** The catalog. Order is display order within a group. */
export const ACTIVITY_CATALOG: readonly ActivityDef[] = [
  { code: 'credit_short_term',          label: 'Short-term Credit',        labelHi: 'अल्पकालीन ऋण',       group: 'credit' },
  { code: 'credit_long_term',           label: 'Long-term Credit',         labelHi: 'दीर्घकालीन ऋण',       group: 'credit' },
  { code: 'deposits_savings',           label: 'Savings Deposits',         labelHi: 'बचत जमा',             group: 'credit' },
  { code: 'deposits_term',              label: 'Term Deposits',            labelHi: 'सावधि जमा',           group: 'credit' },
  { code: 'milk_procurement',           label: 'Milk Procurement',         labelHi: 'दूध संग्रहण',          group: 'agri_allied' },
  { code: 'milk_sales',                 label: 'Milk & Dairy Sales',       labelHi: 'दूध/डेयरी बिक्री',    group: 'agri_allied' },
  { code: 'agri_input_retail',          label: 'Agri-Input Retail',        labelHi: 'कृषि-आदान बिक्री',    group: 'agri_allied' },
  { code: 'custom_hiring_centre',       label: 'Custom Hiring Centre',     labelHi: 'कस्टम हायरिंग केंद्र', group: 'services' },
  { code: 'foodgrain_procurement',      label: 'Foodgrain Procurement',    labelHi: 'खाद्यान्न खरीद',       group: 'marketing' },
  { code: 'warehousing',                label: 'Warehousing',              labelHi: 'भंडारण',              group: 'services' },
  { code: 'cold_storage',               label: 'Cold Storage',             labelHi: 'शीत भंडारण',          group: 'services' },
  { code: 'consumer_retail',            label: 'Consumer Retail',          labelHi: 'उपभोक्ता खुदरा',      group: 'marketing' },
  { code: 'fair_price_shop_pds',        label: 'Fair Price Shop / PDS',    labelHi: 'उचित मूल्य दुकान',    group: 'marketing' },
  { code: 'lpg_cng_petrol_distribution',label: 'LPG/CNG/Petrol Distribution', labelHi: 'गैस/ईंधन वितरण',  group: 'services' },
  { code: 'marketing_aggregation',      label: 'Marketing / Aggregation',  labelHi: 'विपणन/समुच्चय',       group: 'marketing' },
  { code: 'processing',                 label: 'Processing',               labelHi: 'प्रसंस्करण',          group: 'processing' },
  { code: 'fishery_operations',         label: 'Fishery Operations',       labelHi: 'मत्स्य पालन',         group: 'agri_allied' },
  { code: 'poultry_livestock',          label: 'Poultry & Livestock',      labelHi: 'कुक्कुट/पशुधन',       group: 'agri_allied' },
  { code: 'housing_management',         label: 'Housing Management',        labelHi: 'आवास प्रबंधन',        group: 'services' },
  { code: 'maintenance_billing',        label: 'Maintenance Billing',      labelHi: 'रखरखाव बिलिंग',       group: 'services' },
  { code: 'labour_works',               label: 'Labour / Works',           labelHi: 'श्रम/कार्य',          group: 'services' },
  { code: 'transport',                  label: 'Transport',                labelHi: 'परिवहन',              group: 'services' },
  { code: 'common_service_centre',      label: 'Common Service Centre',    labelHi: 'सामान्य सेवा केंद्र',  group: 'emerging' },
];

/** The set of valid activity codes, for validation and membership checks. */
export const ACTIVITY_CODES: ReadonlySet<Activity> = new Set(ACTIVITY_CATALOG.map((a) => a.code));

/** A declared-activity row as it lives in `society_activities` (the subset the resolver path reads). */
export interface SocietyActivityRow {
  activity: Activity;
  status?: 'active' | 'paused' | 'retired';
  isDeleted?: boolean;
}

/**
 * PURE (T-11) — the DECLARED, live activities a society currently runs, from its `society_activities`
 * rows: only `status === 'active'`, not soft-deleted, and a known catalog code. Order-independent,
 * de-duplicated. This is the ONLY place the raw rows become the `Activity[]` the resolver consumes,
 * so an unknown/paused/retired/deleted row can never light up a capability.
 */
export function declaredActivities(rows: readonly SocietyActivityRow[] = []): Activity[] {
  const out = new Set<Activity>();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && (r.status ?? 'active') === 'active' && !r.isDeleted && ACTIVITY_CODES.has(r.activity)) out.add(r.activity);
  }
  return [...out];
}
