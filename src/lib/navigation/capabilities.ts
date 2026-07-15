/**
 * Capability-Based Navigation — core types (C1).
 * Capabilities are the single gate: modules REQUIRE capabilities; society types /
 * admins / (future) plans & plugins GRANT them. Adding a capability never touches
 * module code. This file holds only types + the domain→group mapping (no logic).
 */
import type { SocietyType } from '@/types';

// Nav-gate roles. 'auditor' is read-only assurance access — the module catalog grants it the same
// reports an accountant sees. (The full 17-role roster lives in @/lib/rbac; this is the nav subset.)
export type Role = 'admin' | 'accountant' | 'viewer' | 'auditor';

/** Capabilities a module can require. Extensible — new ones never edit existing modules. */
export type Capability =
  | 'inventory_sales'
  | 'lending'
  | 'dairy_collection'
  | 'procurement_msp'
  | 'warehousing'
  | 'fertilizer_distribution'
  | 'seed_distribution'
  | 'pos_billing'
  | 'transport'
  | 'gst'
  | 'tds'
  | 'housing'
  | 'labour'
  | 'pf_esi'
  | 'deposit_ledger'          // member deposits / savings ledger (T-13 / CAP-1, BA-2)
  | 'subsidy_reconciliation'  // government subsidy claim & reconciliation — FPS / fertilizer (T-13 / CAP-2, BA-3)
  | 'haryana_compliance';  // jurisdiction pack: HAFED annual-review proformas (Haryana marketing only)

/** Sidebar groups — 1:1 with today's visual groups, in render order. */
export type NavDomain = 'core' | 'operations' | 'consumer' | 'marketing' | 'dairy' | 'labour' | 'housing' | 'reports' | 'registers' | 'administration';

export const DOMAIN_ORDER: NavDomain[] = ['core', 'operations', 'consumer', 'marketing', 'dairy', 'labour', 'housing', 'reports', 'registers', 'administration'];

/** i18n heading key per group (null = no heading, as 'core' renders today). Verified against Sidebar in C2. */
export const DOMAIN_HEADING_KEY: Record<NavDomain, string | null> = {
  core: null,            // no heading (matches current main group)
  operations: 'operations',
  consumer: 'navConsumer', // consumer-cooperative store module group (retail counter, member credit, patronage…)
  marketing: 'navMarketing', // cooperative-marketing module group (MSP procurement, trading, warehouse…)
  dairy: 'navDairy',     // dairy-cooperative module group
  labour: 'navLabour',   // labour-cooperative module group
  housing: 'navHousing', // housing-cooperative module group
  reports: 'reports',
  registers: 'registers',
  administration: null,  // no heading (matches current settings group — verified vs Sidebar)
};

/**
 * A grant/revoke row from the `society_capabilities` table (C3).
 *
 * SOURCE TRUST MODEL (C6.2 — documented, not yet enforced in RLS):
 *   • 'admin'  → CLIENT-writable. The only source the app/UI may create, and only as a
 *                `revoke` (admin hiding an already-entitled capability). Admin can never
 *                entitle (see resolver: admin rows are ignored for entitlement).
 *   • 'plan' | 'plugin' | 'state' | 'system' → SERVER-CONTROLLED ONLY. These create
 *                ENTITLEMENT and must be written exclusively by trusted server/service-role
 *                code (billing, marketplace install, jurisdiction rules). The client must
 *                NEVER create these rows.
 *   • 'trial'  → SERVER-CONTROLLED ONLY (time-bound entitlement; carries expiresAt).
 *
 * ENFORCEMENT (C6.3/C6.4): the rules are enforced in the DATABASE, not by convention. RLS lets
 * only a society ADMIN (is_society_admin) write, and only source='admin', mode='revoke';
 * accountant/viewer and every entitlement source (plan/plugin/state/trial/system) are rejected
 * for clients (entitlement = service-role/server only). See the policies in supabase-tables.sql.
 */
export type CapabilitySource = 'admin' | 'plan' | 'plugin' | 'state' | 'trial' | 'system';
export type CapabilityMode = 'grant' | 'revoke';
export interface SocietyCapabilityRow {
  capability: Capability;
  mode: CapabilityMode;       // 'grant' = entitle; 'revoke' = admin-hide within entitlement
  source: CapabilitySource;
  expiresAt?: string | null;  // ISO timestamp; null = permanent (trials use this)
  grantedBy?: string | null;  // audit: who (display only; resolver ignores)
  createdAt?: string | null;  // audit: when (display only; resolver ignores)
}

/**
 * CORE (is_core) capabilities — compliance/universal, ALWAYS active if entitled and NEVER
 * gated by a society's declared activities (T-12). TDS applies to every society's payments;
 * GST to any registered society; jurisdiction packs apply by state. Activity-gating exempts
 * these so a declared activity can never HIDE a compliance obligation — and so the cutover
 * from type-templates to activities loses no compliance module (empty-diff parity, MR-1).
 */
export const CORE_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>(['gst', 'tds', 'haryana_compliance']);

export type { SocietyType };
