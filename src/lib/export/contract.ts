/**
 * Export Contract v1 — the storage↔contract mapping layer (T-04 / ADR-0004, IRR-6).
 *
 * ADR-0004 mandates that the `.slbak` / export WIRE SHAPE is a stable, versioned CONTRACT — not the
 * raw internal table shape a `select('*')` returns. This module is that seam: pure, bidirectional row
 * mappers derived from the Export Registry. The contract field names are the registry
 * `ColumnDescriptor.key`s (stable, never renamed); each reads from / writes to a storage column
 * (`storageColumn ?? key`), so the DB layout can evolve without breaking a single archive or future
 * API consumer.
 *
 * Two guarantees this module gives the contract:
 *   1. DECOUPLING — the wire shape is the DELIBERATE, registry-declared column set (and their stable
 *      keys), never whatever columns happen to sit in the table today.
 *   2. LOSSLESS round-trip — `fromContractRow(entity, toContractRow(entity, row))` reproduces `row`
 *      restricted to the entity's declared columns (under their storage keys). Undeclared storage
 *      columns are intentionally NOT part of the portable contract.
 *
 * PURE — no I/O, no Supabase, no React. Wiring the writer/restore path through this is a LATER slice;
 * this slice builds and proves the mapping in isolation so the T-35-certified recovery path is
 * untouched. See docs/architecture/EXPORT-CONTRACT-v1.md.
 */
import type { EntityDescriptor, ColumnDescriptor } from './registry.types';

/**
 * Contract MAJOR version — the domain export contract's own version, independent of
 * BACKUP_FORMAT_VERSION (the archive-container version in lib/backup/manifest.ts). Bumped only when
 * the contract shape changes in a way a reader must negotiate; renaming a storage column does NOT
 * bump it (that's exactly what `storageColumn` absorbs).
 */
export const EXPORT_CONTRACT_VERSION = '1';

/** The storage column a contract field reads from / writes to — identity unless overridden. */
export function storageKey(col: ColumnDescriptor): string {
  return col.storageColumn ?? col.key;
}

/** The ordered contract field keys for an entity — the wire shape (≠ table shape by construction). */
export function contractShape(entity: EntityDescriptor): readonly string[] {
  return entity.columns.map(c => c.key);
}

/**
 * Storage row → contract row. Only the entity's DECLARED columns cross the boundary — the contract
 * IS the selection — and each lands under its stable contract `key`. A declared column absent from
 * the storage row is omitted (not emitted as undefined), so the mapping is order- and presence-exact.
 */
export function toContractRow(entity: EntityDescriptor, storageRow: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of entity.columns) {
    const sk = storageKey(col);
    if (Object.prototype.hasOwnProperty.call(storageRow, sk)) out[col.key] = storageRow[sk];
  }
  return out;
}

/**
 * Contract row → storage row. The exact inverse of toContractRow: each declared contract `key` is
 * written back under its storage column name, so a restored row upserts into the live table shape.
 */
export function fromContractRow(entity: EntityDescriptor, contractRow: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of entity.columns) {
    if (Object.prototype.hasOwnProperty.call(contractRow, col.key)) out[storageKey(col)] = contractRow[col.key];
  }
  return out;
}

// ─── Backup (fidelity) mapping ────────────────────────────────────────────────────────
//
// The CURATED mapping above (toContractRow) is for the human EXPORT surface (CSV/XLSX/API), where
// only the registry-declared columns should appear. A BACKUP is different: it must be LOSSLESS, so
// it carries EVERY storage column — declared or not — or a restore would silently drop data (e.g.
// voucher.editHistory, billAllocations: real columns the export picker never lists). The backup
// mapping therefore preserves all columns and only RE-KEYS the declared columns whose storage name
// differs from their contract key (a `storageColumn` override). With no overrides it is the identity
// — so the `.slbak` stays byte-identical to a pre-contract archive (R4 empty-diff parity).

/** Declared columns whose storage name differs from their contract key — the only keys re-mapped. */
function keyOverrides(entity: EntityDescriptor): ColumnDescriptor[] {
  return entity.columns.filter(c => c.storageColumn && c.storageColumn !== c.key);
}

/**
 * Storage row → backup row. Lossless: every column is kept; a declared column with a `storageColumn`
 * override is moved from its storage name to its stable contract `key`. Identity (returns the row
 * unchanged) when there are no overrides — the current state, so archives are byte-identical.
 */
export function toBackupRow(entity: EntityDescriptor, storageRow: Record<string, unknown>): Record<string, unknown> {
  const overrides = keyOverrides(entity);
  if (overrides.length === 0) return storageRow;
  const out: Record<string, unknown> = { ...storageRow };
  for (const col of overrides) {
    const sc = col.storageColumn as string;
    if (Object.prototype.hasOwnProperty.call(out, sc)) { out[col.key] = out[sc]; delete out[sc]; }
  }
  return out;
}

/** Backup row → storage row. Exact inverse of toBackupRow; lossless; identity when no overrides. */
export function fromBackupRow(entity: EntityDescriptor, backupRow: Record<string, unknown>): Record<string, unknown> {
  const overrides = keyOverrides(entity);
  if (overrides.length === 0) return backupRow;
  const out: Record<string, unknown> = { ...backupRow };
  for (const col of overrides) {
    const sc = col.storageColumn as string;
    if (Object.prototype.hasOwnProperty.call(out, col.key)) { out[sc] = out[col.key]; delete out[col.key]; }
  }
  return out;
}
