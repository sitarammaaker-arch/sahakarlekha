# Organizational-Continuity & Custodial-Handover Plan (T-37 / DP Strategy VI-6)

- **Status:** Accepted procedure — realizes Digital Preservation Strategy **VI-6** and Part I.
- **Traceability:** DP-P2 (open format), DP-P7 (proven, not assumed), DP-P9 (vendor-independence),
  DP-P10 (human-legible floor), AR-2 (self-sufficient AIP), ADR-0004 (export contract),
  ADR-0007 (identity/erasure), ADR-0009 (residency). Code seam: [aip.ts](../../src/lib/archive/aip.ts),
  [placement.ts](../../src/lib/backup/placement.ts), the portable export (T-04).

> The hardest 25-year risk is not a lost disk — it is **SahakarLekha the company ceasing to exist.**
> A village society must never lose its books because a software vendor failed. This document is the
> standing procedure that makes that guarantee real.

---

## 1. Principle

Members' records outlive the vendor **and** the company. The authoritative preserved copy is a
**vendor-independent, self-describing, open versioned contract** (ADR-0004) plus **human-readable
PDF/A** (DP-P10) — readable with *no* SahakarLekha software, database, cloud, or internet. Because
that copy already exists (every society holds its portable export, T-04) and every closed period is
packaged as a **self-sufficient AIP** (AR-2), handover is a *transfer of custody of existing open
objects*, never a data reconstruction.

## 2. Candidate custodians (in preference order)

1. **The society itself** — it already holds its complete portable export (PT-1) and its PDF/A
   statements. This is the always-on floor: no handover event is needed for the society to keep reading
   its own books.
2. **A cooperative federation / apex body** (district DCCB, state apex) — the natural sector custodian,
   consolidation parent in the federation graph (T-34), and already residency-aligned.
3. **A designated national archive / Registrar of Cooperative Societies (RCS) deposit** — statutory
   long-term custody for permanent-record classes (AR-6: equity, member, dispute records are permanent).

Each custodian receives data **only within the tenant's jurisdiction** (residency, ADR-0009), and
**PII only under the consent/tombstoning regime** (ADR-0007) — erased identities stay erased; the
pseudonymous financial history is retained.

## 3. Handover triggers

- Company wind-down / insolvency / acquisition-without-continuity commitment.
- A society's explicit exit ("take my data elsewhere" — DPDP/portability right, IE-6).
- A regulator-directed deposit for a permanent-record class.

## 4. Procedure

1. **Freeze & package.** For each affected society, package every closed FY and the current state into
   OAIS AIPs (`buildAIP`), each **self-sufficient** (`isSelfSufficient`) and **hygiene-clean**
   (`assertPreservationHygiene`: UTF-8/Devanagari-safe, ISO-8601, exact minor-unit money).
2. **Verify fixity.** Confirm every AIP's checksums (`verifyFixity`, DP-P5) and that at least one copy
   satisfies **3-2-1 + WORM** (`evaluate321`, `sealObject`).
3. **Transfer custody.** Hand the AIPs + portable exports + PDF/A statements to the receiving custodian
   over an authorized, residency-respecting channel. Keys move under **escrowed M-of-N custody**
   (`keyEscrow`, BK-5) — no single party can unlock, and a lost key never means lost data.
4. **Prove the restore.** The receiving custodian performs a **rehearsed restore** with post-restore
   integrity gates (RS-3) and records **persisted evidence** (DP-P7) — custody is not accepted until a
   restore is proven, not assumed.
5. **Record the handover.** Log the transfer (custodian, scope, jurisdiction, fixity manifest, evidence
   reference) on the immutable trail (AR-7) for legal admissibility.

## 5. Verification & cadence

- The handover procedure is **rehearsed** on the same cadence as restore drills (RS-4), against real
  AIPs, with persisted evidence — a handover that has never been rehearsed is not a plan, it is a hope.
- Format-obsolescence review (LT-4) migrates archived AIPs forward (`migrateForward`) so a custodian
  years later still receives readable objects, original + migration provenance retained.

## 6. What this guarantees

Even if the database, the cloud provider, and SahakarLekha the company all disappear, a village society
— or its federation, or the national archive — still **holds and can still read** its own cooperative
books in 2051, in an open format, verifiable and legally admissible.
