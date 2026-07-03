/**
 * Capability-Based Navigation — core types (C1).
 * Capabilities are the single gate: modules REQUIRE capabilities; society types /
 * admins / (future) plans & plugins GRANT them. Adding a capability never touches
 * module code. This file holds only types + the domain→group mapping (no logic).
 */
import type { SocietyType } from '@/types';

export type Role = 'admin' | 'accountant' | 'viewer';

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
  | 'pf_esi';

/** Sidebar groups — 1:1 with today's visual groups, in render order. */
export type NavDomain = 'core' | 'operations' | 'marketing' | 'dairy' | 'labour' | 'housing' | 'reports' | 'registers' | 'administration';

export const DOMAIN_ORDER: NavDomain[] = ['core', 'operations', 'marketing', 'dairy', 'labour', 'housing', 'reports', 'registers', 'administration'];

/** i18n heading key per group (null = no heading, as 'core' renders today). Verified against Sidebar in C2. */
export const DOMAIN_HEADING_KEY: Record<NavDomain, string | null> = {
  core: null,            // no heading (matches current main group)
  operations: 'operations',
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

export type { SocietyType };
