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
import { CORE_CAPABILITIES } from './capabilities';
import { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';
import { resolveJurisdictionPacks } from './jurisdictionPacks';
import type { Activity } from './activities';
import { ACTIVITY_CAPABILITY_MAP } from './activityCapabilities';

const ADMIN_SOURCE: CapabilitySource = 'admin';

function activeRows(rows: SocietyCapabilityRow[], now: number): SocietyCapabilityRow[] {
  return (Array.isArray(rows) ? rows : []).filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
}

/**
 * JURISDICTION grants — capabilities auto-entitled by the society's STATE (a `state`-source grant,
 * per C6.2), computed from society.state so no server row is needed.
 *
 * CA-11 / ADR-0008: the state packs are now EFFECTIVE-DATED DATA (jurisdictionPacks.ts), not a
 * hardcoded branch here — adding a state is a data row, and a historical period reproduces its
 * era's packs. This function just normalizes the state to a jurisdiction code (T-01, ONE place,
 * so 'HR'/'Haryana'/'हरियाणा' all resolve alike) and resolves the packs.
 */
export function jurisdictionCapabilities(societyType: SocietyType, state?: string): Capability[] {
  return resolveJurisdictionPacks(resolveJurisdiction(state), societyType);
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
      : new Set<Capability>([
          // is_core compliance caps (gst/tds/jurisdiction) stay active if entitled — never
          // gated by a declared activity, so the cutover loses no compliance module (T-12/MR-1).
          ...[...entitled].filter((c) => CORE_CAPABILITIES.has(c)),
          // everything else is activity-gated, and only within entitlement (MR-4).
          ...[...activityCapabilities(activities)].filter((c) => entitled.has(c)),
        ]);
  return new Set<Capability>([...base].filter((c) => !adminHidden.has(c)));
}
