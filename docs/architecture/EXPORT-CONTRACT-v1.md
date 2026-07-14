# SahakarLekha — Export Contract v1

- **Status:** In force — wired into the live `.slbak` writer & restore (T-04 slices 1–2, ADR-0004 Accepted).
- **Task:** T-04 · **Ratifies:** [ADR-0004](../adr/0004-export-contract.md) · **Guards:** IRR-6 (lock-in / portability).
- **Scope of this document:** the *contract layer* — how the on-the-wire export shape is defined, versioned, and decoupled from the database. It does **not** describe the archive container (encryption, manifest, chunking); that is [`lib/backup/manifest.ts`](../../src/lib/backup/manifest.ts).

---

## 1. Why a contract at all

The `.slbak` archive and every export/import is a **promise to the cooperative**: "you can always get your books out, and back in, in a shape that does not depend on our internal database." If the wire format were just `select('*')` — the raw table columns — then renaming a column, splitting a JSONB blob into typed columns (T-05), or any schema refactor would silently change the export shape and could break a two-year-old archive or a downstream API consumer. ADR-0004 forbids that: **the internal table layout MUST NOT be the wire format.**

The **Export Contract** is the stable, versioned shape that sits *above* storage. The database may evolve underneath it; the contract does not move.

## 2. The contract IS the registry — with a decoupling seam

The single source of truth is the **Export Registry** (`src/lib/export/registry.types.ts` + `entities/*.ts`). Every persisted collection is declared once, with an ordered list of `ColumnDescriptor`s. The contract is derived from those declarations:

- **`ColumnDescriptor.key`** — the **contract field name**. *Stable, never renamed* (an archive written today must still parse in five years). These keys, in declaration order, are the wire shape.
- **`ColumnDescriptor.storageColumn`** *(optional)* — the DB column the field reads from / writes to. **Absent ⇒ identity** (`key` is also the storage column). When present, the contract key and the storage column **differ** — this is the decoupling seam: rename the DB column, set its `storageColumn`, and every archive and API consumer keeps working because the contract key never changed.

Undeclared storage columns are **not** part of the contract. The contract is a *deliberate selection*, not "whatever the table happens to hold today."

## 3. The mapping layer

`src/lib/export/contract.ts` — pure, bidirectional, no I/O:

| Function | Direction | Guarantee |
|---|---|---|
| `toContractRow(entity, storageRow)` | storage → wire | Emits only declared columns, each under its stable `key`. Absent columns are omitted (presence-exact), never `undefined`. |
| `fromContractRow(entity, contractRow)` | wire → storage | Exact inverse: each `key` written back under `storageColumn ?? key`. |
| `contractShape(entity)` | — | The ordered contract keys (the wire shape). |
| `storageKey(col)` | — | `col.storageColumn ?? col.key`. |

**Lossless round-trip (proven, `scripts/test-export-contract.mjs`):**
`fromContractRow(entity, toContractRow(entity, row))` reproduces `row` restricted to the entity's declared columns, under their storage keys — for identity mappings, decoupled mappings, falsy/null/nested values, and Devanagari.

## 4. Versioning

Two independent versions, deliberately separate:

- **`EXPORT_CONTRACT_VERSION`** (`contract.ts`) — the domain contract's major. Bumped **only** when the contract shape changes in a way a reader must negotiate. Renaming a storage column does **not** bump it — that is exactly what `storageColumn` absorbs.
- **`BACKUP_FORMAT_VERSION`** (`manifest.ts`, currently `1.0`) — the archive *container* version (layout, integrity envelope). Negotiated by `classifyFormatVersion` (same-major/any-minor accept; newer-major refuse with "update the app"; older/malformed refuse).

## 5. v0 reconciliation

The blueprint's migration note ("existing `.slbak` archives readable as v0; new exports are v1") describes a case that **does not exist**: the manifest-based `.slbak` format was *born* carrying `formatVersion = "1.0"` (no major `< 1` was ever written — see `manifest.ts`). `classifyFormatVersion` therefore refuses a no-version / `0.x` archive as malformed/too-old, and that is correct: there are no real v0 archives to read. This document records that reconciliation so the note and the code agree; no v0 reader is needed.

## 6. Status of the work

**Done (slices 1–2):**

- The mapping layer (`contract.ts`) is built and **wired into the live path** — `writer.ts` serializes through `toBackupRow`, `restore/archive.ts` reads through `fromBackupRow`. The backup mappers are LOSSLESS (they keep every column, declared or not — a curated `toContractRow` would drop internal columns like `voucher.editHistory` and lose them on restore) and are the identity until a `storageColumn` override exists, so the archive stayed **byte-identical** and the T-35-certified recovery path was re-proven unchanged end-to-end (R4 empty-diff parity). Server bundles (`_shared/backup-core.mjs`, `rehearsal-core.mjs`) carry the same mapping.
- [ADR-0004](../adr/0004-export-contract.md) is **Accepted — in force**; the v0 note is reconciled (§5).

**Remaining (incremental, no further recovery-path risk):**

1. **Apply `storageColumn` where storage and contract genuinely diverge** (e.g. after a T-05 JSONB→typed split), entity by entity — the seam already absorbs it.
