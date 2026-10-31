/**
 * Login read-load S2 · skip fetching tables that hold no rows for this society.
 *
 * One RPC (`society_empty_tables`, migration 151) answers, for the tables below, which ones the signed-in
 * user would get NOTHING from. Those are not fetched; their state is set to `[]` — exactly what the fetch
 * would have returned — so no screen or report can differ (RULE 2: an empty table and a skipped one are the
 * same value). Everything else loads as before.
 *
 * Fail-safe: any failure (function not deployed yet, network, unexpected shape) → an EMPTY set → every
 * table is fetched, i.e. today's behaviour. The answer is only ever used to skip a fetch, never to drop rows.
 *
 * Only tables whose loader treats `{ data: [], error: null }` as an ordinary empty result belong here.
 * NOT here: the core Promise.all tables (accounts' template fallback, members' PII split, failure banner),
 * member_identity (an empty success switches PII mode) and ledger_events (journalLoadedRef).
 */
import { supabase } from '@/lib/supabase';

/** DataContext side-loads (plain select, error-tolerant). */
export const SIDE_LOAD_TABLES = [
  'society_capabilities', 'society_activities', 'deposit_accounts', 'deposit_transactions', 'compliance_filings',
  'procurement_farmers', 'procurement_lots', 'procurement_events', 'procurement_quality_tests', 'procurement_moisture_records',
  'procurement_jforms', 'procurement_financial_intents', 'procurement_posting_requests', 'procurement_posting_rule_results',
  'procurement_settlements', 'work_orders', 'muster_entries',
] as const;

/** MarketingDataContext tables (applyLoadsTogether). */
export const MARKETING_TABLES = [
  'procurement_crops', 'procurement_varieties', 'procurement_seasons', 'procurement_agencies', 'procurement_centres',
  'procurement_msp_rates', 'procurement_deduction_rules', 'procurement_quality_specs', 'procurement_bardana_types',
  'marketing_transporters', 'procurement_arhtiyas', 'procurement_bardana_movements', 'procurement_dispatches',
  'procurement_agency_bills', 'marketing_dealer_licences', 'marketing_scheme_claims', 'marketing_hired_trips',
] as const;

/** ConsumerDataContext tables (applyLoadsTogether). */
export const CONSUMER_TABLES = [
  'consumer_price_lists', 'sales_returns', 'purchase_returns', 'consumer_patronage_runs', 'consumer_purchase_orders',
] as const;

export const SKIPPABLE_TABLES: readonly string[] = [...SIDE_LOAD_TABLES, ...MARKETING_TABLES, ...CONSUMER_TABLES];

/** Pure: the RPC's answer → the set of tables to skip. Anything unexpected → skip nothing. */
export function toEmptySet(data: unknown, error: unknown): ReadonlySet<string> {
  if (error || !Array.isArray(data)) return new Set();
  const allowed = new Set(SKIPPABLE_TABLES);
  return new Set(data.filter((t): t is string => typeof t === 'string' && allowed.has(t)));
}

/** Ask the database once which skippable tables are empty for this society. Never rejects. */
export function fetchEmptyTables(societyId: string): Promise<ReadonlySet<string>> {
  return Promise.resolve(
    supabase.rpc('society_empty_tables', { p_society_id: societyId, p_tables: [...SKIPPABLE_TABLES] }),
  ).then(({ data, error }) => toEmptySet(data, error), () => new Set<string>());
}

/** Run `fetch` unless `table` is known empty; then resolve the same `{ data: [], error: null }` an empty fetch gives. */
export function unlessEmpty<R>(
  empty: Promise<ReadonlySet<string>>, table: string, fetch: () => PromiseLike<R>,
): Promise<R | { data: never[]; error: null }> {
  return empty.then((set): R | PromiseLike<R> | { data: never[]; error: null } =>
    (set.has(table) ? { data: [] as never[], error: null } : fetch()));
}
