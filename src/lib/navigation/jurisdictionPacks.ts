/**
 * Jurisdiction statutory capability packs — DATA, not code (ADR-0008 / conformance CA-11).
 *
 * A society is auto-entitled to a state's statutory-compliance capability by its `state`
 * (a `state`-source grant, C6.2). Before, this was a hardcoded `if` in capabilityResolver.ts
 * (CA-11's cited evidence) — so adding a state pack meant a code deploy and no era was
 * reproducible. Now each pack is an EFFECTIVE-DATED ROW here; the resolver never changes.
 *
 *   • Add a state:  push a row (jurisdiction code + the society types it applies to + the caps).
 *   • Time-bound a pack:  set effectiveFrom / effectiveTo (ISO dates) — a historical period
 *     resolves its era's packs, exactly like the UCAS rate rules (ucas.ts).
 *
 * PURE — no I/O. `jurisdiction` is a resolveJurisdiction() code ('hr', not 'Haryana'/'हरियाणा').
 */
import type { SocietyType } from '@/types';
import type { Capability } from './capabilities';

export interface JurisdictionPack {
  /** resolveJurisdiction() code, e.g. 'hr'. */
  jurisdiction: string;
  /** Society types this pack applies to. */
  societyTypes: SocietyType[];
  /** Capabilities auto-entitled while the pack is in effect. */
  capabilities: Capability[];
  /** ISO date the pack takes effect (inclusive). Absent ⇒ always in effect. */
  effectiveFrom?: string;
  /** ISO date the pack stops applying (exclusive). Absent ⇒ never expires. */
  effectiveTo?: string;
  note?: string;
}

export const JURISDICTION_CAPABILITY_PACKS: JurisdictionPack[] = [
  {
    jurisdiction: 'hr',
    societyTypes: ['marketing_processing'],
    capabilities: ['haryana_compliance'],
    note: 'HAFED annual-review proformas (Haryana marketing/processing)',
  },
  // Add other states' packs here (e.g. Punjab → 'punjab_compliance') — DATA only, no code change.
];

/**
 * PURE — the statutory capabilities a (jurisdiction, societyType) is entitled to, as of `asOf`.
 * Effective-dated: only packs in effect on `asOf` apply. `jurisdiction` must already be a
 * resolveJurisdiction() code.
 */
export function resolveJurisdictionPacks(
  jurisdiction: string,
  societyType: SocietyType,
  asOf: string = new Date().toISOString().slice(0, 10),
): Capability[] {
  const caps = new Set<Capability>();
  for (const pack of JURISDICTION_CAPABILITY_PACKS) {
    if (pack.jurisdiction !== jurisdiction) continue;
    if (!pack.societyTypes.includes(societyType)) continue;
    if (pack.effectiveFrom && asOf < pack.effectiveFrom) continue;
    if (pack.effectiveTo && asOf >= pack.effectiveTo) continue;
    for (const c of pack.capabilities) caps.add(c);
  }
  return [...caps];
}
