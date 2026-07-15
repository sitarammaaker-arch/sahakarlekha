# SahakarLekha — Digital Preservation Strategy (25+ Years)

- **Status:** Accepted — preservation SSOT. Governs how cooperative financial records survive a quarter-century and beyond.
- **Date:** 2026-07-11
- **Horizon:** 25+ years (2026 → 2051+). Cooperative equity, member, and dispute records are effectively **permanent**; statutory audit records carry multi-year retention.
- **Sits on:** [ADR-0001 Event Ledger](../adr/0001-event-ledger-system-of-record.md) · [ADR-0004 Export Contract](../adr/0004-export-contract.md) · [ADR-0007 Identity](../adr/0007-identity-and-consent-model.md) · [ADR-0009 Federation & Residency](../adr/0009-federation-graph.md) · [API Constitution](API-CONSTITUTION.md) (Import/Export, portability) · [Canonical Financial Data Model](CANONICAL-FINANCIAL-DATA-MODEL.md) · Project RULE 6 (FY-lock) & RULE 8 (UTF-8) · live data-portability/backup/restore workstream.
- **Scope:** documentation only. No code, no infrastructure config. Defines *what must be preserved, how, and to what guarantee* — not the tooling.

> **The distinction that governs everything.** **Backup** (recover the live system after loss — short/medium horizon), **Archive** (preserve records for decades — long horizon, OAIS), and **Disaster Recovery** (keep operating through a catastrophe — continuity) are **three different disciplines**, routinely and dangerously conflated. This strategy keeps them separate and connects them to one substrate: the immutable event log.

---

## Part A — Preservation principles

- **DP-P1 · Preserve meaning, not just bytes.** A file you can't interpret is not preserved. Every archival object carries its **content + its schema/contract version + the rules to interpret it + provenance + fixity** (the OAIS/ISO-14721 model). Bits without representation information are lost data.
- **DP-P2 · Open, documented, non-proprietary formats.** No preservation object may be locked in a vendor's internal format. Data is preserved as the **versioned domain export contract** (ADR-0004) in open encodings; human-readable statements as **PDF/A** (ISO-19005). Proprietary DB dumps are a *convenience* copy, never the *authoritative* archival copy.
- **DP-P3 · The event log is the preservation master.** History as **immutable, replayable events** (ADR-0001) is the ideal object to preserve: from events + projection logic you can rebuild any state or report, forever. Preserve the events and the rules, and you have preserved everything.
- **DP-P4 · Many copies, many places, many custodians.** The **3-2-1 rule** (≥3 copies, ≥2 media/providers, ≥1 off-site/off-provider) *plus* **LOCKSS** diversity: geographic, **jurisdictional** (residency, ADR-0009), and **organizational** (never all copies with one vendor).
- **DP-P5 · Fixity & tamper-evidence.** Every object carries **cryptographic checksums**, verified on a schedule to catch bit-rot; tamper-evidence ties to the immutable ledger so a corrupted or altered archive is detectable.
- **DP-P6 · Migration over obsolescence.** Formats and standards drift over 25 years; archives are **periodically migrated forward**, keeping the original + full provenance of each migration. Text stays **Unicode/UTF-8** (RULE 8) — non-Unicode Devanagari is a guaranteed 25-year data-loss; dates stay ISO-8601.
- **DP-P7 · Tested, not assumed.** A backup or archive is worthless until a **restore is proven**. Restores and DR are **rehearsed on a schedule**, with persisted evidence. *(This is already the team's discipline: the product UI deliberately says "export," not "backup," until a **persisted rehearsal** proves recoverability.)*
- **DP-P8 · Retention is law-driven and permanent-aware.** Retention periods are **jurisdiction-scoped rule data** (ADR-0008); statutory classes (audit) have minimum retention, while **equity/share/member/dispute records are permanent**. Reconciled with DPDP erasure via identity tombstoning (ADR-0007): erase PII, keep the pseudonymous financial fact.
- **DP-P9 · Vendor-independent by construction.** Assume every current vendor (database, host, edge platform, AI provider) **may not exist in 2051**. No preservation object may require a specific living vendor to be read or restored.
- **DP-P10 · Human-legible last resort.** For the ultimate "all software is gone" scenario, preserve **rendered, human-readable statements** (PDF/A) so a society's books remain readable by a human with no SahakarLekha, no database, no internet.

---

## Part B — What we preserve (the preservation object inventory)

| Object | Form preserved | Why |
|---|---|---|
| **Event log** | Versioned open contract (append-only) | The master; rebuild any state/report (DP-P3) |
| **Canonical entities** (Accounts, Members, Shares, Loans, Vouchers, Entries, Procurement, Inventory, Assets, Payroll) | Versioned domain export contract (ADR-0004) | Vendor-independent data (DP-P2) |
| **Rule sets** (UCAS rates, interest, tax, appropriation — effective-dated) | Versioned rule data | Reproduce historical computations (DP-P1, ADR-0008) |
| **Rendered financial statements** (Balance Sheet, P&L/I&E, Appropriation, audit reports) | **PDF/A** | Human-legible survival (DP-P10) |
| **Schema/contract definitions** | Versioned, self-describing, stored *with* the data | Interpretability (DP-P1) |
| **Provenance & audit trail** | Immutable, preserved alongside | Legal admissibility (DP-P8) |
| **Fixity manifests** (checksums) | Stored with every package | Integrity verification (DP-P5) |
| **Consent artifacts** | Preserved per DPDP | Lawful basis over time (ADR-0007) |

---

## Part C — Backup strategy

Operational protection to recover the **live system** after loss. Distinct from archiving (Part F).

- **BK-1 · Tiered cadence (GFS retention).** Continuous point-in-time (WAL/PITR) → **daily** → **weekly** → **monthly**, on a grandfather-father-son rolling schedule. *(A **weekly server-side scheduled backup runs live in production** today, in the exact `.slbak` versioned format the client uses — the base already exists.)*
- **BK-2 · Dual-form backups.** Each cycle produces **(a)** a **logical export** in the versioned domain contract (`.slbak`, vendor-independent, restorable anywhere — the authoritative copy) and **(b)** a **physical snapshot** (fast same-vendor restore — the convenience copy). DP-P2 makes (a) authoritative.
- **BK-3 · 3-2-1 placement.** ≥3 copies across ≥2 providers with ≥1 **off-provider, off-region** copy (DP-P4), each placement respecting the tenant's **jurisdiction/residency** (ADR-0009).
- **BK-4 · Immutable / WORM backups.** Backups are write-once and tamper-evident (ransomware and insider resistance), with at least one **air-gapped/offline** copy for the highest tier.
- **BK-5 · Encrypted with escrowed keys.** Encryption at rest and in transit; **key custody is itself a preservation risk** — keys are escrowed and rotated so a lost key never means lost data (DP-P9). No secrets in filenames, logs, or URLs (API Constitution).
- **BK-6 · Scoped both ways.** **Per-society** self-service backup/export (portability, live today) *and* **platform-wide** backups (DR, live weekly). PII minimized/pseudonymous in backups (ADR-0007).
- **BK-7 · Monitored & alerted.** Every backup job's success, size, and fixity is verified and alerted on failure — a silently-failing backup is the classic catastrophe.

---

## Part D — Restore strategy

A backup only matters as a **proven restore**.

- **RS-1 · Restore granularity.**
  - **Point-in-time / single record** — replay the event log to a target time (ADR-0001).
  - **Single society** — reimport that tenant's versioned contract, or restore its snapshot.
  - **Full platform** — physical snapshot + event-log replay to the target RPO.
- **RS-2 · Targets (RPO/RTO).** Defined per tier: continuous tier RPO≈minutes; standard RPO ≤ 24h; RTO scaled to scenario (single-record: immediate; single-tenant: hours; full platform: within the DR runbook). Numbers are policy, reviewed as scale grows.
- **RS-3 · Restore is not done until validated.** Post-restore **integrity gates** run automatically: double-entry balances tie (CL-1), trial balance reconciles, fixity matches the manifest (DP-P5), record counts reconcile. A restore that fails a gate is **not accepted** (RULE 1 "no silent divergence" discipline extended to recovery).
- **RS-4 · Rehearsed on a schedule, with persisted evidence (DP-P7).** Restores are drilled regularly against real backups; results are recorded. *(Current state, honestly: client and server restore ship; the **persisted end-to-end rehearsal** is the remaining step — until it runs, the capability is presented as "export," not "backup." This is the principle being lived, not skipped.)*
- **RS-5 · Self-service + assisted.** A society can restore **its own** data (portability); platform-level restore is an operated, runbook-driven procedure with SoD (no single operator restores unilaterally over live data).
- **RS-6 · Non-destructive by default.** Restore-to-a-copy and reconcile before any cut-over; never blind-overwrite live data (mirrors the import dry-run discipline, API Constitution IE-3).

---

## Part E — Data portability

Portability is a **right**, and the everyday proof that preservation works.

- **PT-1 · Export in the open, versioned contract.** A society (and, by consent, a member) can export **their complete data** in the versioned domain contract (ADR-0004) — self-describing, documented, non-proprietary (DP-P2). No lock-in.
- **PT-2 · Round-trip guarantee.** Export → import reproduces **identical** state (the `.slbak` backup/restore *is* this round-trip). Portability and backup share one mechanism, so the portability path is exercised constantly.
- **PT-3 · Standard, tool-agnostic formats.** The contract is readable without SahakarLekha (structured open data + PDF/A statements), importable into a fresh instance or a third-party system via the same contract (API Constitution IE-1/IE-6).
- **PT-4 · Consent- and residency-bound.** Exports move only with consent and within jurisdiction; **no PII in URLs or filenames** (API-P6). Member erasure is honored without breaking the round-trip (tombstoning, ADR-0007).
- **PT-5 · No silent truncation.** An export declares its scope, version, and any filter; a bounded export states what it omitted (API Constitution IE-5) — preservation must never *look* complete while missing records.

---

## Part F — Archive strategy (the 25-year core, OAIS-aligned)

Long-term preservation of records past their active life — closed FYs, exited members, dissolved societies, superseded rule eras.

- **AR-1 · Active → archival tiering.** When a period/entity leaves active use, it is packaged into the archival tier. Active systems stay fast; the archive optimizes for **longevity, not latency**.
- **AR-2 · OAIS information packages.** Records enter as **SIPs**, are preserved as **AIPs**, disseminated as **DIPs**. Every **AIP = content (events + statements) + representation information (schema/contract version + rendering) + provenance + fixity + context** (DP-P1). An AIP is self-sufficient: a future reader needs nothing but the AIP.
- **AR-3 · Format normalization.** Data normalized to the **open versioned contract**; human-readable statements to **PDF/A**; text **UTF-8/Unicode** (Devanagari-safe, RULE 8); dates ISO-8601. No proprietary or ambiguous encodings enter the archive (DP-P2/DP-P6).
- **AR-4 · WORM + LOCKSS.** Archives are write-once, on ≥3 geographically, jurisdictionally, and **organizationally** diverse copies (DP-P4); fixity verified on a schedule (DP-P5); a damaged copy is re-replicated from a good one.
- **AR-5 · Forward migration with provenance.** As formats/standards evolve, archives are **migrated forward**, retaining the original and a provenance record of every migration (DP-P6) — so no archive silently obsolesces.
- **AR-6 · Retention schedule (law-driven, permanent-aware).**

  | Record class | Retention |
  |---|---|
  | Statutory audit records, vouchers, ledgers | ≥ statutory minimum (jurisdiction rule; commonly ~8 yrs), typically retained far longer |
  | **Member, share/equity, membership-lifecycle** | **Permanent** |
  | **Dispute/litigation-linked records** | **Permanent** (until legal hold clears, then per policy) |
  | Loan/deposit account history | Life of relationship + statutory tail |
  | Operational drafts, transient logs | Short, policy-defined |

  Periods are **effective-dated jurisdiction rules** (ADR-0008); erasure of PII on permanent financial records is via tombstoning (ADR-0007), never deletion of the financial fact.
- **AR-7 · Legal admissibility.** Provenance + tamper-evidence + fixity are preserved so an archive stands as **evidence decades later** — the immutable ledger (ADR-0001) is what makes this credible.

---

## Part G — Long-term compatibility

Ensuring a 2026 record is still **readable and interpretable** in 2051.

- **LT-1 · The versioned contract is the compatibility guarantee.** Because the wire/archival contract is **decoupled from storage and vendor** (ADR-0004) and **self-describing** (carries its own schema version), a future reader interprets any package by its declared version — and **historical versions remain readable forever** (API Constitution VER-4).
- **LT-2 · Reproducible history via preserved rules.** Effective-dated rule sets (ADR-0008) are preserved with the data, so a 2027 statement recomputes with **2027's rules** when reopened in 2050 (Canonical CL-4 projections over immutable inputs).
- **LT-3 · Encoding hygiene is preservation-critical.** UTF-8/Unicode for all text (Hindi/Devanagari survival, RULE 8), ISO-8601 dates, exact minor-unit money with explicit currency (ADR-0006). Ambiguous or proprietary encodings are banned from preservation objects.
- **LT-4 · Migration ladder.** A standing process migrates archival formats forward as standards evolve (DP-P6), never letting a format age past readability; each rung keeps originals + provenance.
- **LT-5 · Human-readable floor (DP-P10).** PDF/A renderings mean that even if *every* piece of SahakarLekha software is gone, the statements remain readable by a human — the irreducible compatibility guarantee.

---

## Part H — Disaster recovery

Continuity through catastrophe — a *different* discipline from backup (recovery of operations, not just data).

- **DR-1 · Scenario-tiered.** Planned for: node/zone failure, **region** outage, **provider** outage, **provider death** (→ Vendor Independence, Part I), **ransomware/tamper**, **accidental mass-delete**, and **key loss**. Each has a runbook.
- **DR-2 · Redundant, multi-provider, residency-aware.** Geographic and **cross-provider** redundancy so no single region or vendor is a single point of failure (DP-P4/DP-P9), within jurisdiction constraints (ADR-0009).
- **DR-3 · Recover onto a different substrate.** Because the authoritative backup is the **vendor-independent versioned contract + event log** (DP-P2/DP-P3), recovery is possible onto a *different* database/host — not just the original vendor. This is what separates DR from mere backup here.
- **DR-4 · Ransomware & tamper defense.** Immutable/WORM + air-gapped copies (BK-4) mean a live-system compromise cannot reach the offline archival copy; fixity detects tampering (DP-P5).
- **DR-5 · Defined RTO/RPO + comms plan.** Per-scenario recovery-time/point objectives and a **stakeholder communication plan** (societies, members, regulators) — silence during a disaster is itself a failure.
- **DR-6 · Drilled, not documented-and-forgotten.** DR runbooks are **exercised** on a schedule with persisted evidence (DP-P7); a runbook never tested is a hypothesis.
- **DR-7 · SoD on destructive recovery.** Platform-level restore/failover over live data requires independent authorization — no single operator can trigger a destructive recovery unilaterally.

---

## Part I — Vendor independence

The 25-year certainty: **today's vendors will change.** Preservation must outlive all of them.

- **VI-1 · Assume vendor mortality.** Design so the loss of the database (e.g. Supabase), edge platform (e.g. Cloudflare D1), host, or AI provider is **survivable, not fatal** (DP-P9). No preservation object requires a specific living vendor to be read.
- **VI-2 · Open, standard, restorable-anywhere formats.** Authoritative copies are the open versioned contract + PDF/A + standard checksums — restorable into commodity infrastructure (standard SQL/flat files) with no proprietary dependency (DP-P2).
- **VI-3 · Always an off-vendor copy.** The "1" in 3-2-1 is a **different organization/provider** (DP-P4), so a single vendor's disappearance never takes all copies.
- **VI-4 · Reproducible infrastructure + escrow.** Infrastructure-as-code, a documented **rebuild runbook**, and **source/config escrow** so the platform can be reconstituted independently of any one vendor.
- **VI-5 · Standard integration rails.** The anti-corruption ring (INV-7, API Constitution) means a partner/rail's death is **isolated** to its adapter — it never corrupts or strands core records.
- **VI-6 · Organizational-continuity plan.** The hardest 25-year risk: **SahakarLekha the company** ceasing. A cooperative-sector obligation and plan — **custodial handover** of societies' data (open format) so records survive the vendor *and* the company. Candidate custodians: the society itself (it already holds its portable export), a cooperative **federation/apex**, or a designated **national archive/RCS** deposit. Members must never lose their records because a software company failed.

---

## Part J — Governance, testing & current state

- **Ownership.** A named owner is accountable for preservation, with a periodic review of retention rules, format currency, fixity results, and drill outcomes.
- **Audit cadence.** Scheduled fixity checks (DP-P5), restore rehearsals (RS-4), DR drills (DR-6), and format-obsolescence reviews (LT-4), each with persisted evidence.
- **Honest current state (2026-07):**
  - ✅ Client export / backup / restore **live**; weekly **server-side scheduled backup live in prod** (D1), in the versioned `.slbak` format.
  - ✅ Portability round-trip (export→restore) **exists** and is the shared mechanism (PT-2).
  - ⏳ **Persisted end-to-end restore rehearsal** is the remaining gate — until it runs, the capability is honestly labelled "export," not "backup" (DP-P7 in practice).
  - ⏳ **Archival tier (OAIS/PDF-A), multi-provider off-vendor copies, key escrow, and the organizational-continuity/custodial-handover plan** are **strategy-defined here, not yet built** — the roadmap this document sets.
- **Amendment.** Changes to retention classes or the authoritative-format decision are ratified as ADRs; the permanent-record classes (AR-6) and the open-format/vendor-independence principles (DP-P2/DP-P9) are load-bearing and change only by superseding amendment.

---

## One-paragraph statement

SahakarLekha preserves cooperative records for a quarter-century by treating **backup, archive, and disaster recovery as three distinct disciplines** over one substrate — the **immutable, replayable event log** — and by making the **authoritative preserved copy a vendor-independent, self-describing, open versioned contract** (plus human-readable PDF/A), held in **many copies across many providers, regions, and organizations**, verified by fixity, migrated forward as formats age, and **proven by rehearsed restores rather than assumed**. Retention is law-driven with **equity, member, and dispute records permanent**; PII erasure is reconciled with retention by tombstoning; and because **every current vendor is assumed mortal**, the strategy includes an **organizational-continuity handover** so that even if the database, the cloud, or the company itself disappears, a village society still holds — and can still read — its own books in 2051.
