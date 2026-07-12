/**
 * OAIS archival packages (T-37 / Digital Preservation AR-2, AR-3, AR-5; DP-P1, DP-P5, LT-3; RULE 8).
 *
 * PURE. When a period or entity leaves active use it is packaged into the archival tier as an OAIS
 * Archival Information Package (AIP). The whole point of preservation is that the AIP is
 * SELF-SUFFICIENT — a reader in 2051 needs NOTHING but the AIP to interpret the books: the content,
 * the rules to read it, its provenance, and its fixity (DP-P1). This module is the SSOT for that
 * package and its lifecycle:
 *
 *   buildAIP / isSelfSufficient — assemble and check the OAIS-required components (AR-2).
 *   assertPreservationHygiene   — encoding hygiene is preservation-critical: UTF-8/Unicode text
 *                                 (Devanagari survives, RULE 8), ISO-8601 dates (AR-3/LT-3).
 *   verifyFixity                — fixity per content part; a mismatch means altered/bit-rotted (DP-P5).
 *   migrateForward              — as formats age, migrate forward while RETAINING the original +
 *                                 provenance of every migration (AR-5/LT-4); no silent obsolescence.
 *
 * The actual PDF/A renderer and the WORM archival store are the wire layer; the package algebra is
 * here. No I/O; deterministic (times/anchors injected).
 */
import { digestsEqual } from '../backup/integrity';

/** OAIS package stages (AR-2): Submission → Archival → Dissemination. */
export type PackageStage = 'SIP' | 'AIP' | 'DIP';

/** Representation information — what a future reader needs to INTERPRET the content (DP-P1). */
export interface RepresentationInfo {
  /** The versioned domain contract the content is encoded in (ADR-0004). */
  contractVersion: string;
  /** Rendering of human-legible statements — PDF/A (DP-P10). */
  rendering: string;
  /** Text encoding — MUST be UTF-8 (Devanagari-safe, RULE 8). */
  encoding: string;
  /** Date format — MUST be ISO-8601. */
  dateFormat: string;
}

export interface MigrationRecord {
  fromVersion: string;
  toVersion: string;
  at: string;
  tool: string;
  /** Fixity of the PRE-migration content, so the original is provably retained (AR-5). */
  originalDigest: string;
}

export interface Provenance {
  origin: string;
  /** Anchor tying the content to the immutable ledger — legal admissibility (AR-7/ADR-0001). */
  ledgerAnchor: string;
  createdAt: string;
  /** Forward-migration history (AR-5) — each rung keeps the original's fixity. */
  migrations: MigrationRecord[];
}

export interface ArchivalPackage {
  id: string;
  stage: PackageStage;
  scope: string; // e.g. 'FY2025-26' | 'entity:SOC-1'
  /** Content parts — the event log (the master, DP-P3) + rendered statements (DP-P10). */
  content: { events: string; statements: string };
  representation: RepresentationInfo;
  provenance: Provenance;
  /** Fixity manifest: a checksum per content part (DP-P5). */
  fixity: Record<string, string>;
}

export interface BuildAIPInput {
  id: string;
  scope: string;
  content: { events: string; statements: string };
  representation: RepresentationInfo;
  origin: string;
  ledgerAnchor: string;
  createdAt: string;
  fixity: Record<string, string>;
}

/** PURE — assemble an AIP from a submission. Stage is 'AIP' with an empty migration history. */
export function buildAIP(input: BuildAIPInput): ArchivalPackage {
  return {
    id: input.id,
    stage: 'AIP',
    scope: input.scope,
    content: input.content,
    representation: input.representation,
    provenance: {
      origin: input.origin,
      ledgerAnchor: input.ledgerAnchor,
      createdAt: input.createdAt,
      migrations: [],
    },
    fixity: { ...input.fixity },
  };
}

export interface SufficiencyVerdict {
  ok: boolean;
  missing: string[];
}

/**
 * PURE — is this AIP self-sufficient (AR-2/DP-P1)? Every OAIS component must be present: both content
 * parts, full representation info, provenance with a ledger anchor, and a fixity digest for EACH
 * content part. A reader needs nothing but the AIP.
 */
export function isSelfSufficient(aip: ArchivalPackage): SufficiencyVerdict {
  const missing: string[] = [];
  const has = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (!has(aip.content?.events)) missing.push('content.events');
  if (!has(aip.content?.statements)) missing.push('content.statements');
  if (!has(aip.representation?.contractVersion)) missing.push('representation.contractVersion');
  if (!has(aip.representation?.rendering)) missing.push('representation.rendering');
  if (!has(aip.representation?.encoding)) missing.push('representation.encoding');
  if (!has(aip.representation?.dateFormat)) missing.push('representation.dateFormat');
  if (!has(aip.provenance?.origin)) missing.push('provenance.origin');
  if (!has(aip.provenance?.ledgerAnchor)) missing.push('provenance.ledgerAnchor');
  for (const part of Object.keys(aip.content ?? {})) {
    if (!has(aip.fixity?.[part])) missing.push(`fixity.${part}`);
  }
  return { ok: missing.length === 0, missing };
}

export interface HygieneVerdict {
  ok: boolean;
  problems: string[];
}

/**
 * PURE — preservation encoding hygiene (AR-3/LT-3/RULE 8). Text MUST be UTF-8 and dates ISO-8601;
 * a proprietary or ambiguous encoding (a guaranteed 25-year Devanagari data-loss) is refused.
 */
export function assertPreservationHygiene(rep: RepresentationInfo): HygieneVerdict {
  const problems: string[] = [];
  if (rep.encoding.toUpperCase() !== 'UTF-8') problems.push(`text encoding must be UTF-8 (Devanagari-safe), not "${rep.encoding}"`);
  if (rep.dateFormat.toUpperCase() !== 'ISO-8601') problems.push(`dates must be ISO-8601, not "${rep.dateFormat}"`);
  return { ok: problems.length === 0, problems };
}

/**
 * PURE — verify an AIP's fixity (DP-P5): each content part's freshly-recomputed digest must match
 * the manifest. A missing or mismatched digest fails — tampering or bit-rot is detectable.
 */
export function verifyFixity(aip: ArchivalPackage, currentDigests: Readonly<Record<string, string>>): boolean {
  const entries = Object.entries(aip.fixity);
  if (entries.length === 0) return false;
  return entries.every(([part, digest]) => {
    const current = currentDigests[part];
    return typeof current === 'string' && digestsEqual(digest, current);
  });
}

/** Extract a leading major version integer from a version string ('v2'→2, '2.1'→2), or null. */
function majorOf(version: string): number | null {
  const m = /(\d+)/.exec(version);
  return m ? parseInt(m[1], 10) : null;
}

export type MigrateResult =
  | { ok: true; aip: ArchivalPackage }
  | { ok: false; reason: string };

/**
 * PURE — forward-migrate an AIP to a newer contract version (AR-5/LT-4). Produces a NEW AIP at the
 * higher version whose provenance appends a migration record capturing the ORIGINAL's fixity — the
 * original is provably retained and no archive silently obsolesces. Refuses a non-forward (equal or
 * lower) migration.
 */
export function migrateForward(
  aip: ArchivalPackage,
  toVersion: string,
  tool: string,
  at: string,
  newContent: { events: string; statements: string },
  newFixity: Record<string, string>,
): MigrateResult {
  const from = aip.representation.contractVersion;
  if (toVersion === from) return { ok: false, reason: 'migration target equals the current version — not a forward migration' };
  const fMaj = majorOf(from);
  const tMaj = majorOf(toVersion);
  if (fMaj != null && tMaj != null && tMaj <= fMaj) {
    return { ok: false, reason: `migration must go forward: "${toVersion}" is not newer than "${from}"` };
  }
  const record: MigrationRecord = {
    fromVersion: from,
    toVersion,
    at,
    tool,
    originalDigest: aip.fixity.events ?? '',
  };
  return {
    ok: true,
    aip: {
      ...aip,
      content: newContent,
      representation: { ...aip.representation, contractVersion: toVersion },
      fixity: { ...newFixity },
      provenance: { ...aip.provenance, migrations: [...aip.provenance.migrations, record] },
    },
  };
}
