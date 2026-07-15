/**
 * Export Registry — descriptor types (T-05).
 *
 * THE ONE IDEA (see docs/research/DESIGN-DATA-PORTABILITY-CENTER.md §1):
 * every persisted collection in the app is DECLARED here exactly once. The Export
 * Center, Backup Center, Restore Center, Migration Center and the future export API
 * are all *derived* from these declarations. Pages stop knowing how to export; they
 * ask the Registry.
 *
 * This file holds TYPES + PURE VALIDATION only. No entities, no I/O, no Supabase.
 * Entity declarations live in ./entities/*.ts (T-06…T-11).
 *
 * Roles and capabilities are REUSED from navigation/capabilities.ts — there is no
 * parallel authorization system here. `minRole` is compared through ROLE_RANK rather
 * than by string literal, so ECR-06's 17-role migration only has to edit that one map.
 *
 * Pure helpers (`roleAtLeast`, `findCycle`, `topoOrder`, `validateRegistry`) are
 * unit-tested by scripts/test-export-registry.mjs (mirror pattern, as test-nav.mjs).
 */
import type { Capability, Role } from '@/lib/navigation/capabilities';

// ─── Column descriptor (blueprint §3.2) ──────────────────────────────────────────────

/** How a value is rendered/serialized. Drives CSV quoting, XLSX cell type, PDF alignment. */
export type ColumnType = 'string' | 'number' | 'currency' | 'date' | 'boolean' | 'enum' | 'json';

/**
 * Sensitivity class. Anything other than 'none' is masked in a Redacted export —
 * the mechanism that lets a society share books with a federation or external auditor
 * without leaking member contact/identity data. Generalises `PII_KEYS` in lib/auditLog.ts.
 */
export type PiiClass = 'none' | 'contact' | 'identity' | 'financial';

export interface ColumnDescriptor {
  /** Stable CONTRACT field key — the versioned wire-format name (ADR-0004). Never renamed. */
  key: string;
  /**
   * Storage column this field maps to, when it differs from `key`. Absent ⇒ identity (`key` is
   * also the storage column). This is the T-04 decoupling seam: the contract key stays stable even
   * if the underlying DB column is renamed — the mapping (lib/export/contract.ts) absorbs the diff,
   * so no archive or API consumer breaks. See docs/architecture/EXPORT-CONTRACT-v1.md.
   */
  storageColumn?: string;
  header: string;
  headerHi: string;
  type: ColumnType;
  piiClass: PiiClass;
  /** Shown by default in the Export Center's column picker. */
  defaultVisible: boolean;
  /** May be masked in a Redacted export. Implied true when piiClass !== 'none'. */
  redactable?: boolean;
}

// ─── Entity descriptor (blueprint §3.1) ──────────────────────────────────────────────

/**
 * Data domains. Deliberately NOT `NavDomain` — that type groups the SIDEBAR, this one
 * groups DATA. A single nav group can span several data domains and vice versa; coupling
 * them would make a sidebar reshuffle silently rewrite backup grouping.
 */
export type ExportDomain =
  | 'core' | 'member' | 'inventory' | 'trade' | 'lending' | 'payroll'
  | 'procurement' | 'dairy' | 'housing' | 'marketing' | 'consumer'
  | 'compliance' | 'governance' | 'evidence' | 'system';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

/** 'global' tables (e.g. hsn_master) are shared reference data, excluded from society backups. */
export type EntityScope = 'society' | 'global';

export type EntityNature = 'master' | 'transaction' | 'derived' | 'evidence' | 'system';

/**
 * The four custody classes (blueprint §3.3). This is the most consequential field here.
 *
 *  full    — authoritative rows. Exported verbatim, restored verbatim.
 *  replay  — DERIVED from `full` data by a deterministic engine. Exporting is a checksum;
 *            restoring rows directly is FORBIDDEN (it would create two sources for one
 *            number — the exact RULE 2 failure). Restore regenerates, then asserts equality.
 *  sidecar — immutable evidence (audit_log). Exported for legal custody, NEVER restored;
 *            writing it back would forge history.
 *  exclude — secrets / infra / cross-tenant. Never leaves the database.
 */
export type BackupPolicy = 'full' | 'replay' | 'sidecar' | 'exclude';

export interface EntityDescriptor {
  /** Stable identifier, e.g. 'voucher', 'housing_flat'. Never renamed — backups carry it. */
  key: string;
  /** Supabase table name. Verified against supabase-tables.sql by the drift detector (T-12). */
  table: string;
  domain: ExportDomain;
  label: string;
  labelHi: string;
  /** Absent ⇒ always available. Present ⇒ entity is HIDDEN (not empty) without the capability. */
  capability?: Capability;
  /** Minimum role that may export this entity. Compared via ROLE_RANK, never by literal. */
  minRole: Role;
  columns: ColumnDescriptor[];
  scope: EntityScope;
  nature: EntityNature;
  /** Entity keys that must be restored first. Forms the restore DAG (T-30). */
  dependsOn: string[];
  /** Natural key used to match rows on merge-restore and import (T-31). */
  naturalKey: string[];
  /** Usually 'isDeleted'. Drives RULE 5 filtering and the "include deleted" toggle. */
  softDeleteField?: string;
  formats: ExportFormat[];
  /** Key into the PDF generator map, for entities with a statutory print form. */
  pdfGenerator?: string;
  backupPolicy: BackupPolicy;
}

export type ExportRegistry = readonly EntityDescriptor[];

// ─── Roles: rank, not literals ───────────────────────────────────────────────────────

/**
 * The ONLY place role ordering is encoded. ECR-06 (17-role model) edits this map and
 * nothing else in the export subsystem. Do not compare `minRole` with `===` anywhere.
 */
export const ROLE_RANK: Record<Role, number> & Partial<Record<string, number>> = {
  viewer: 0,
  auditor: 0,   // read-only assurance access — same rank as viewer for export gating
  accountant: 1,
  admin: 2,
  // ECR-06 S3 — export-capable new roles, ranked per PERMISSION_MATRIX's Export column.
  // Roles whose matrix Export is ✗ (cashier, salesOperator, employee, dataEntry) are
  // deliberately UNRANKED → roleAtLeast fail-closes and every export is denied to them.
  internalAuditor: 0,
  externalCA: 0,
  boardMember: 0,
  chairman: 0,
  storeKeeper: 0,        // Export ◐ — viewer-level entities only
  procurementOfficer: 0, // Export ◐ — viewer-level entities only
  manager: 1,            // accountant-level export surface
  secretary: 2,          // admin-level (statutory custodian)
};

/** PURE — does `actual` meet or exceed `required`? Unknown roles are denied, never allowed. */
export function roleAtLeast(actual: Role, required: Role): boolean {
  const a = ROLE_RANK[actual];
  const r = ROLE_RANK[required];
  if (a === undefined || r === undefined) return false;   // fail closed
  return a >= r;
}

// ─── Pure validation ─────────────────────────────────────────────────────────────────

export interface RegistryProblem {
  entity: string;
  problem: string;
}

const BACKUP_POLICIES: BackupPolicy[] = ['full', 'replay', 'sidecar', 'exclude'];

/**
 * PURE — depth-first search for a dependency cycle.
 * Returns the offending path (e.g. ['a','b','a']) or null when the graph is acyclic.
 */
export function findCycle(entities: ExportRegistry): string[] | null {
  const deps = new Map(entities.map(e => [e.key, e.dependsOn]));
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];

  const visit = (key: string): string[] | null => {
    if (state.get(key) === 'done') return null;
    if (state.get(key) === 'visiting') return [...path.slice(path.indexOf(key)), key];

    state.set(key, 'visiting');
    path.push(key);
    for (const dep of deps.get(key) ?? []) {
      if (!deps.has(dep)) continue;            // unresolved dep — reported by validateRegistry
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(key, 'done');
    return null;
  };

  for (const e of entities) {
    const cycle = visit(e.key);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * PURE — dependency-first ordering for restore (dependencies before dependents).
 * Throws on a cycle rather than emitting a plausible-but-wrong order.
 */
export function topoOrder(entities: ExportRegistry): string[] {
  const cycle = findCycle(entities);
  if (cycle) throw new Error(`Export registry has a dependency cycle: ${cycle.join(' → ')}`);

  const deps = new Map(entities.map(e => [e.key, e.dependsOn]));
  const seen = new Set<string>();
  const order: string[] = [];

  const visit = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const dep of deps.get(key) ?? []) if (deps.has(dep)) visit(dep);
    order.push(key);
  };

  for (const e of entities) visit(e.key);
  return order;
}

/**
 * PURE — structural checks over the whole registry. Returns every problem found, so a
 * developer sees all of them at once rather than fixing one per build. Empty array = valid.
 * Wired into the build by the drift detector (T-12).
 */
export function validateRegistry(entities: ExportRegistry): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const push = (entity: string, problem: string) => problems.push({ entity, problem });

  const keys = new Set<string>();
  const tables = new Set<string>();

  for (const e of entities) {
    if (keys.has(e.key)) push(e.key, 'duplicate entity key');
    keys.add(e.key);

    if (tables.has(e.table)) push(e.key, `duplicate table "${e.table}" — declared by another entity`);
    tables.add(e.table);

    if (!BACKUP_POLICIES.includes(e.backupPolicy)) push(e.key, `unknown backupPolicy "${e.backupPolicy}"`);
    if (ROLE_RANK[e.minRole] === undefined) push(e.key, `unknown minRole "${e.minRole}"`);
    if (e.columns.length === 0) push(e.key, 'no columns declared');
    if (e.naturalKey.length === 0) push(e.key, 'no naturalKey declared (needed for merge-restore)');

    const colKeys = new Set<string>();
    for (const c of e.columns) {
      if (colKeys.has(c.key)) push(e.key, `duplicate column "${c.key}"`);
      colKeys.add(c.key);
    }
    for (const nk of e.naturalKey) {
      if (!colKeys.has(nk)) push(e.key, `naturalKey "${nk}" is not a declared column`);
    }
    if (e.softDeleteField && !colKeys.has(e.softDeleteField)) {
      push(e.key, `softDeleteField "${e.softDeleteField}" is not a declared column`);
    }

    // An excluded entity must be unreachable from every export path (blueprint §3.3).
    if (e.backupPolicy === 'exclude' && e.formats.length > 0) {
      push(e.key, 'backupPolicy "exclude" but formats are declared — it would be exportable');
    }
    // Evidence is exported for custody but must never be restored.
    if (e.nature === 'evidence' && e.backupPolicy !== 'sidecar') {
      push(e.key, 'nature "evidence" must carry backupPolicy "sidecar"');
    }
    // Derived rows are replayed, never restored (RULE 2 — one formula, one source).
    if (e.nature === 'derived' && e.backupPolicy !== 'replay') {
      push(e.key, 'nature "derived" must carry backupPolicy "replay"');
    }
    if (e.pdfGenerator && !e.formats.includes('pdf')) {
      push(e.key, 'pdfGenerator declared but "pdf" is not in formats');
    }
  }

  for (const e of entities) {
    for (const dep of e.dependsOn) {
      if (dep === e.key) push(e.key, 'depends on itself');
      else if (!keys.has(dep)) push(e.key, `dependsOn "${dep}" is not a declared entity`);
    }
  }

  const cycle = findCycle(entities);
  if (cycle) push(cycle[0], `dependency cycle: ${cycle.join(' → ')}`);

  return problems;
}
