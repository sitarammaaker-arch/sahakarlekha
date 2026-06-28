/**
 * Capability resolver (C1) — the ONE place a society's capability set is computed:
 *   capabilities = typeTemplate ∪ adminGrants − adminRevokes
 * Future plan/plugin sources union in here without touching any consumer.
 * Defensive: bad/missing input falls back to the type template (never throws).
 */
import type { SocietyType } from '@/types';
import type { Capability, CapabilityOverrides } from './capabilities';
import { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';

export function resolveCapabilities(
  societyType: SocietyType,
  overrides?: CapabilityOverrides | null,
): Set<Capability> {
  const base: Capability[] = SOCIETY_TYPE_CAPABILITIES[societyType] ?? [];
  const grant = Array.isArray(overrides?.grant) ? overrides!.grant : [];
  const revoke = new Set<Capability>(Array.isArray(overrides?.revoke) ? overrides!.revoke : []);
  return new Set<Capability>([...base, ...grant].filter((c) => !revoke.has(c)));
}
