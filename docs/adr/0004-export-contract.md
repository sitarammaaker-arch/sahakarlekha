# ADR-0004 — Data-Portability Export Contract

- **Status:** Accepted — in force (contract layer built + wired into the live `.slbak` writer/restore; T-04 slices 1–2). Key-divergence from storage is exercised by tests and applied as the schema evolves (T-05); the seam is live, so applying it never touches the recovery path again.
- **Date:** 2026-07-11
- **Traceability:** IRR-6 (Class C), INV-7 · [Irreversible Decisions IRR-6](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md) · [[data-portability-restore-workstream]]

## Decision

Data leaving SahakarLekha (`.slbak` export, government/NCD submissions, third-party integration payloads) MUST serialize a **stable, versioned domain contract** that is **distinct from the internal storage shape**. The internal camelCase/JSONB table layout is an implementation detail and MUST NOT be the wire format. Every export is **version-stamped** (v1, v2, …) so the format can evolve without breaking prior archives.

## Context

Today the DB schema mirrors the TypeScript client 1:1 (quoted camelCase columns, financially-material data in JSONB), and the live `.slbak` backup format encodes that internal shape. The moment an external consumer (government ingest, another vendor, an auditor's tool) parses that format, the app's *incidental* internal shape becomes a **public contract frozen forever** (Class C irreversibility). As the national OS, SahakarLekha's exports will be widely ingested.

## Alternatives Considered

1. **Export the internal shape as-is (status quo).** Simplest; freezes internal quirks as a public standard.
2. **Export internal shape but promise "best effort" compatibility.** Informal; still traps you when consumers depend on it.
3. **Versioned domain export schema decoupled from storage (chosen).**

## Why this decision was selected

- Only Alternative 3 lets the internal schema keep evolving (columns, JSONB→typed migrations per ADR-0006/others) **without** breaking every archive and integration already in the wild.
- It converts an accidental contract into a **deliberate, governed** one — freezing a *good* contract before a consumer freezes a *bad* one.
- Aligns with INV-7 (ERP as a DPI node behind an anti-corruption/adapter ring) and with the existing portability discipline — this formalizes the contract, it does not add a new capability.

## Trade-offs

- **Mapping layer cost:** a serializer/deserializer between storage and contract must be built and maintained.
- **Version proliferation:** supporting old export versions is an ongoing obligation.
- **Discipline required:** developers must resist "just add the new column to the export" and instead evolve the contract deliberately.

## Long-term consequences

- Internal storage can be refactored (even off Supabase) without external breakage — the contract insulates consumers.
- Enables clean NCD/statutory data exchange keyed on **external codes** (see ADR-0002/rules) rather than internal enums (IRR-9).
- Backward compatibility with every historical `.slbak` archive is guaranteed by version negotiation.

## When it may be revisited

- If the government mandates a specific national interchange format — SahakarLekha adopts it as a contract *version*, adapters absorb the change (INV-7).
- On any major contract version bump (v2), which is itself a new ADR documenting the migration and deprecation window.

## Realization (T-04)

The trade-off named above — "a serializer/deserializer between storage and contract must be built" — is now built and live:

- **Contract layer** — `src/lib/export/contract.ts`: the wire shape is the Export Registry's declared columns under stable `key`s; `ColumnDescriptor.storageColumn` is the decoupling seam (contract key ≠ DB column). Documented in [EXPORT-CONTRACT-v1.md](../architecture/EXPORT-CONTRACT-v1.md).
- **Wired** — the `.slbak` writer (`lib/backup/writer.ts`) serializes through `toBackupRow`; restore (`lib/restore/archive.ts`) reads through `fromBackupRow`. Both are LOSSLESS (never drop an undeclared column) and are the identity until a `storageColumn` override exists — so the archive stayed byte-identical and the T-35-certified recovery path was re-proven unchanged end-to-end (R4 empty-diff parity).
- **Version negotiation** — `classifyFormatVersion` (`lib/backup/manifest.ts`) accepts same-major/any-minor, refuses newer-major and no-/0.x-version archives. No "v0" archive ever existed (format born at 1.0).

Remaining is incremental: apply `storageColumn` where the schema and contract genuinely diverge (e.g. a T-05 JSONB→typed split), entity by entity — the seam absorbs it without further recovery-path risk.
