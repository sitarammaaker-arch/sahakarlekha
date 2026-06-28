/**
 * Capability resolver (C3) — the ONE place a society's capability set is computed
 * from the relational `society_capabilities` rows:
 *   entitled  = typeTemplate ∪ {active grant rows}
 *   visible   = entitled − {active admin revoke rows}
 * "Active" excludes expired rows (trials). Future plan/plugin/state sources are just
 * rows with a different `source` — composed here without touching any consumer.
 * Defensive: bad/missing input falls back to the type template (never throws).
 */
import type { SocietyType } from '@/types';
import type { Capability, SocietyCapabilityRow } from './capabilities';
import { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';

export function resolveCapabilities(
  societyType: SocietyType,
  rows: SocietyCapabilityRow[] = [],
  nowMs?: number,
): Set<Capability> {
  const now = nowMs ?? Date.now();
  const template: Capability[] = SOCIETY_TYPE_CAPABILITIES[societyType] ?? [];
  const active = (Array.isArray(rows) ? rows : []).filter(
    (r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now,
  );
  const grants = active.filter((r) => r.mode === 'grant').map((r) => r.capability);
  // Admin can hide an entitled capability; non-admin sources cannot be admin-revoked here.
  const revokes = new Set<Capability>(
    active.filter((r) => r.mode === 'revoke' && r.source === 'admin').map((r) => r.capability),
  );
  return new Set<Capability>([...template, ...grants].filter((c) => !revokes.has(c)));
}
