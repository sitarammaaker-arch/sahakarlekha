/**
 * Capability resolver (C5) — TWO distinct concepts, each a pure, order-independent
 * set operation. Separating them prevents an admin from enabling unlicensed features.
 *
 *   Step 1  ENTITLEMENT — what a society MAY use. Granted ONLY by non-admin sources
 *           (template, trial, plugin, plan, state, system). The admin CANNOT create
 *           entitlement.   entitled = (template ∪ non-admin grants) − non-admin revokes
 *
 *   Step 2  VISIBILITY — what actually shows in the nav. The admin may only HIDE an
 *           already-entitled capability, never reveal an unentitled one.
 *           visible = entitled − admin-hidden
 *
 * Final navigation visibility = Entitlement AND NOT admin-hidden.
 * Expired rows (expiresAt ≤ now) are filtered out first. Pure functions of
 * (societyType, rows, now) → fully deterministic.
 */
import type { SocietyType } from '@/types';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import type { Capability, CapabilitySource, SocietyCapabilityRow } from './capabilities';
import { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';
import type { Activity } from './activities';
import { ACTIVITY_CAPABILITY_MAP } from './activityCapabilities';

const ADMIN_SOURCE: CapabilitySource = 'admin';

function activeRows(rows: SocietyCapabilityRow[], now: number): SocietyCapabilityRow[] {
  return (Array.isArray(rows) ? rows : []).filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
}

/**
 * JURISDICTION grants — capabilities auto-entitled by the society's STATE (a `state`-source grant,
 * per C6.2), computed here from society.state so no server row is needed. State-specific statutory
 * packs live behind these so the national core never carries one state's format.
 *   • Haryana (`hr`) marketing/processing → 'haryana_compliance' (HAFED annual-review proformas).
 * Add other states' packs here (e.g. Punjab → 'punjab_compliance') — the core stays untouched.
 */
export function jurisdictionCapabilities(societyType: SocietyType, state?: string): Capability[] {
  // Jurisdiction normalization lives in ONE place — resolveJurisdiction (T-01) — so 'HR',
  // 'Haryana' and 'हरियाणा' all resolve to the same code here and on every financial row.
  if (societyType === 'marketing_processing' && resolveJurisdiction(state) === 'hr') return ['haryana_compliance'];
  return [];
}

/**
 * Step 1 — capabilities the society is ENTITLED to. Admin rows are ignored here, so an
 * admin can never entitle an unlicensed capability. (Exported for the C6 admin UI, which
 * must know which capabilities are togglable.)
 */
export function resolveEntitlements(
  societyType: SocietyType,
  rows: SocietyCapabilityRow[] = [],
  nowMs?: number,
  state?: string,
): Set<Capability> {
  const active = activeRows(rows, nowMs ?? Date.now());
  const template: Capability[] = SOCIETY_TYPE_CAPABILITIES[societyType] ?? [];
  const jurisdiction = jurisdictionCapabilities(societyType, state);
  const grants = active.filter((r) => r.source !== ADMIN_SOURCE && r.mode === 'grant').map((r) => r.capability);
  const revokes = new Set<Capability>(
    active.filter((r) => r.source !== ADMIN_SOURCE && r.mode === 'revoke').map((r) => r.capability),
  );
  return new Set<Capability>([...template, ...jurisdiction, ...grants].filter((c) => !revokes.has(c)));
}

/**
 * PURE — the capabilities a set of declared ACTIVITIES lights up (T-11 / ADR-0003). The union
 * over ACTIVITY_CAPABILITY_MAP. This is NOT bounded by entitlement here; resolveCapabilities
 * intersects it with entitlement so an activity can never grant an unpaid capability (MR-4).
 */
export function activityCapabilities(activities: readonly Activity[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const a of activities) for (const c of ACTIVITY_CAPABILITY_MAP[a] ?? []) out.add(c);
  return out;
}

/**
 * Step 2 — final navigation VISIBILITY = active-set − admin-hidden. This is the
 * consumer-facing function (useNavigation / navigationService). An admin `revoke` hides
 * an entitled capability; an admin `grant` cannot reveal an unentitled one (it is a no-op
 * for an already-entitled capability).
 *
 * ACTIVITIES (T-11) gate WHICH entitled capabilities are active, strictly WITHIN entitlement:
 *   • no declared activities  → all entitled caps are active (today's behaviour — the
 *     Activities layer is additive and non-breaking until a society opts in);
 *   • declared activities     → only the capabilities those activities light up, AND only if
 *     the society is already entitled to them. A declared activity can NEVER surface an unpaid
 *     capability (MR-4) — the monetization boundary is intact. The shift to activities being
 *     the PRIMARY source (retiring the type template) is T-14; the parity cutover is T-12.
 */
export function resolveCapabilities(
  societyType: SocietyType,
  rows: SocietyCapabilityRow[] = [],
  nowMs?: number,
  state?: string,
  activities: readonly Activity[] = [],
): Set<Capability> {
  const now = nowMs ?? Date.now();
  const entitled = resolveEntitlements(societyType, rows, now, state);
  const adminHidden = new Set<Capability>(
    activeRows(rows, now)
      .filter((r) => r.source === ADMIN_SOURCE && r.mode === 'revoke')
      .map((r) => r.capability),
  );
  const base =
    activities.length === 0
      ? entitled
      : new Set<Capability>([...activityCapabilities(activities)].filter((c) => entitled.has(c)));
  return new Set<Capability>([...base].filter((c) => !adminHidden.has(c)));
}
