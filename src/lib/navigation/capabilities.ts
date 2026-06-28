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
  | 'trading'
  | 'lending'
  | 'dairy_collection'
  | 'procurement_msp'
  | 'warehousing'
  | 'fertilizer_distribution'
  | 'seed_distribution'
  | 'pos_billing'
  | 'transport'
  | 'gst'
  | 'tds';

/** Sidebar groups — 1:1 with today's visual groups, in render order. */
export type NavDomain = 'core' | 'operations' | 'reports' | 'registers' | 'administration';

export const DOMAIN_ORDER: NavDomain[] = ['core', 'operations', 'reports', 'registers', 'administration'];

/** i18n heading key per group (null = no heading, as 'core' renders today). Verified against Sidebar in C2. */
export const DOMAIN_HEADING_KEY: Record<NavDomain, string | null> = {
  core: null,            // no heading (matches current main group)
  operations: 'operations',
  reports: 'reports',
  registers: 'registers',
  administration: null,  // no heading (matches current settings group — verified vs Sidebar)
};

/** A grant/revoke row from the `society_capabilities` table (C3). */
export type CapabilitySource = 'admin' | 'plan' | 'plugin' | 'state' | 'trial' | 'system';
export type CapabilityMode = 'grant' | 'revoke';
export interface SocietyCapabilityRow {
  capability: Capability;
  mode: CapabilityMode;       // 'grant' = entitle; 'revoke' = admin-hide within entitlement
  source: CapabilitySource;
  expiresAt?: string | null;  // ISO timestamp; null = permanent (trials use this)
}

export type { SocietyType };
