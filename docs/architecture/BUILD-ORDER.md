# SahakarLekha — Build Order (Risk- & Cost-Optimized Execution Sequence)

- **Status:** Accepted — the exact order in which the [Master Implementation Blueprint](MASTER-IMPLEMENTATION-BLUEPRINT.md) tasks (T-01…T-38) should be built. Creates no new architecture; re-sequences frozen tasks.
- **Date:** 2026-07-11
- **Optimized for (in priority order):** ① lowest **migration** risk · ② lowest **production** risk · ③ lowest **engineering** cost.
- **Scope:** documentation only. No code.

> **This is not the Blueprint's phase map.** The Blueprint ordered tasks by *architectural dependency*. The Build Order re-orders them for *execution safety and cost* — most importantly, it **does not start with the keystone** (the event ledger, T-06, XL/High-breaking). You earn the right to do the riskiest cutover by first making the ground additive, proving recovery, and rehearsing the cutover playbook on a low-stakes change.

---

## 1. The three levers → the ordering rules they imply

| Lever | What it forces in the ordering |
|---|---|
| **① Lowest migration risk** | Additive-only first (new nullable columns / new tables / backfill), never mutate historical financial rows. Small, independently-validated migrations before large ones. Prove **restore works before you migrate**. |
| **② Lowest production risk** | Do **Low-breaking before High-breaking**. **Never run two High-breaking cutovers at once.** Make the *first* High cutover the one with the *smallest blast radius* (navigation, not money) to rehearse the playbook. Feature-flag + per-tenant + empty-diff parity + soak between every High. |
| **③ Lowest engineering cost** | Cheap/high-leverage foundations first. Sequence to **avoid rework** (money + numbering *before* the ledger, so the ledger is born clean). Build low-breaking work in **parallel tracks**. Defer expensive XL (identity, API, federation, archival) until dependencies make them cheaper and the team's cutover discipline is proven. |

---

## 2. Governing execution rules (apply throughout)

- **R1 · Recovery net before migration.** A **proven, persisted restore** exists before any schema/data migration begins. (T-35 first.)
- **R2 · Additive-then-flip.** Every change ships additive (new column/table, dual-write/dual-read), is validated, and only then flips the source of truth behind a flag.
- **R3 · One High at a time.** The six High-breaking cutovers — **T-09** (ledger cut), **T-12** (activities cut), **T-22** (year-end), **T-17** (PII), **T-18** (auth), **T-33** (sync) — are **strictly serialized**. Only one may be "hot" (mid-rollout) at any moment; each reaches full per-tenant rollout + soak before the next begins.
- **R4 · Empty-diff parity gate.** No High cutover flips without a per-tenant empty-diff proof (reports/modules/balances identical pre- and post-flip).
- **R5 · Never mutate history.** Corrections are additive (reversing records); historical financial rows are never rewritten (Canonical CL-2).
- **R6 · Rehearse small before large.** The first High cutover is the *lowest-blast-radius* one (activities/navigation), used to prove the flag+parity+rollback playbook before the ledger.

---

## 3. THE BUILD ORDER (exact sequence)

Numbered 1→N = build order. Stages group tasks; **⚙ Parallel** marks work that can proceed on a side track without adding risk. **⛔ High** marks a serialized High-breaking cutover (R3).

### Stage 1 — Safety net + additive foundations *(lowest risk, lowest cost, stops cheap irreversible harm, unblocks everything)*
1. **T-35 · Persisted restore rehearsal** — *R1: prove you can recover before you touch anything.* Cheap, near-done, flips "export"→"backup". Establishes the rollback safety net for all that follows.
2. **T-04 · Versioned export contract v1** — additive; the recovery/portability/API basis. Low-breaking.
3. **T-01 · Tenant + jurisdiction key** — additive columns + backfill; must precede the ledger so events are born partitioned (avoids re-stamping the event store later). Low-breaking.
4. **T-02 · Exact minor-unit money (compute layer)** — stops S1 float harm; **must precede the ledger** so postings are exact from birth (avoids a second migration). Med-breaking, no historical mutation.
5. **T-03 · Server-authoritative numbering** — stops S1 numbering harm; **must precede the ledger** (the number becomes an event attribute). Med-breaking.
6. **T-05 · Typed financial columns (from JSONB)** — additive columns + backfill; precedes ledger payloads. Med-breaking, dual-read during transition.

*Outcome:* the cheap S1/S2 irreversible-stoppers are done, all additive, all reversible, with a proven restore behind them — at the lowest cost and risk in the whole program.

### Stage 2 — Activities layer *(the low-blast-radius cutover — rehearses the playbook before the ledger)*
7. **T-10 · Activities catalog + join + map** — ⚙ additive tables, buildable in parallel with Stage 1. Low-breaking.
8. **T-11 · Resolve-within-entitlement + cache** — resolver extension; pure. Med-breaking (read path).
9. **T-13 · Missing types/caps (deposits, FPS/subsidy, producer/multistate)** — additive rows. Low-breaking.
10. **T-12 · Activities backfill parity cutover** — ⛔ **High #1**, but **navigation-only** blast radius (worst case: a module hides/shows, instantly flag-reversible; *no financial data at risk*). *R6: this is the deliberate low-stakes rehearsal of the flag+empty-diff+per-tenant playbook.*
11. **T-14 · Retire `societyType` behavior-branches** — removes CA-06; Med-breaking.

*Why before the ledger:* activities is additive and independent of the ledger, its cutover risks only navigation (not money), and it lets the team prove the cutover discipline on a cheap change before the expensive one.

### Stage 3 — Event ledger *(the keystone — highest-stakes cutover, now de-risked)*
12. **T-06 · Append-only event journal (dual-write)** — XL; dual-write behind the projection (R2), no cutover yet.
13. **T-07 · Projection / rebuild engine** — projections reconcile to current reports.
14. **T-08 · Reversing-correction model** — edit = reverse + repost (CL-2).
15. **T-09 · Cut reads to the ledger** — ⛔ **High #2**; per-tenant, empty-diff parity (R4). Retires the RULE 1 failure class. Only starts after T-12 is fully soaked.

*Why now, not first:* it is XL/High and the single widest dependency — doing it after money/numbering are clean (no rework) and after the playbook is proven (T-12) is the lowest-cost, lowest-risk path to the highest-value change.

### Stage 4 — Rules + accounting conformance
16. **T-15 · Rule catalogs + point-in-time resolver** — ⚙ Low-breaking; buildable in parallel from Stage 2 onward.
17. **T-16 · Wire UCAS rules as data** — ⚙ Low-breaking; seed common-Act defaults `[NV per state]`.
18. **T-20 · Statutory appropriation posting** — Med; posts through the ledger.
19. **T-21 · Capability-selected statement set** — Low; projections.
20. **T-23 · Governance-authority linkage** — Low; wires existing board/AGM approval to finalization (grounds AI/API "human authority").
21. **T-22 · Year-end close / opening balances / prior-period** — ⛔ **High #3**; after appropriation, serialized.

### Stage 5 — Identity, PII & consent *(expensive; deferred until the ledger enables tombstoning)*
22. **T-17 · Identity/PII separation + pseudonymous key** — ⛔ **High #4** (XL); depends on ledger (reversing events for tombstoning).
23. **T-19 · DPDP consent lifecycle + tombstoning** — Med; completes erasure-vs-retention.
24. **T-18 · Delegated auth root** — ⛔ **High #5**; dual-auth window, access continuity.

### Stage 6 — API & integrations *(low-breaking build; needs ledger + contract)*
25. **T-24 · Versioned public domain API** — ⚙ XL but Low-breaking (additive surface).
26. **T-25 · Event stream + signed webhooks** — projected from the ledger.
27. **T-26 · Anti-corruption adapter ring** — Low-breaking framework.
28. **T-27 · Government adapters (NCD/GSTN/TDS/PFMS/RCS/DigiLocker/AA)** — XL; filings under human authority; NABARD-CAS parts stay **parked**.
29. **T-28 · Banking adapters (statement ingest, reconciliation, prepare-only payment)** — Low-breaking; never autonomous money movement.

### Stage 7 — AI conformance *(low-breaking; must precede any AI write feature)*
30. **T-29 · AI as scoped principal** — ⚙ Low-breaking.
31. **T-30 · Propose-not-commit + audit attribution + explainability** — Low-breaking; the gate before AI touches money.
32. **T-31 · Tenant-isolated memory + kill switch** — Low-breaking.

### Stage 8 — Offline-first *(Critical decision; one High; needs ledger + numbering)*
33. **T-32 · Offline capture + durable local queue** — Med; scoped to collection/receipt first.
34. **T-33 · Integrity-safe sync + conflict + numbering reservation** — ⛔ **High #6** (XL); fail-closed, no silent divergence.

### Stage 9 — Scale & preservation *(P2; expensive; deferrable)*
35. **T-36 · Off-vendor copies + WORM + escrowed keys** — Low-breaking, additive.
36. **T-34 · Federation graph + consolidation** — XL; read-mostly (consolidation = re-projection).
37. **T-37 · OAIS archival tier + PDF/A + continuity handover** — XL; additive to live data.

### Stage 10 — Residual *(P2)*
38. **T-38 · Multi-language beyond Hindi** — Low-breaking, additive.
- **⛔ T-P1 · NABARD CAS conformance — PARKED** (external spec; do not schedule until captured).

---

## 4. Safe parallel tracks (cost reduction without added risk)

These have **no High cutover** and don't share the hot path, so a second small team can build them alongside the primary sequence — integration/flip still serializes per R3:

- **Track R (rules):** T-15 → T-16 — buildable from Stage 2; integrates in Stage 4.
- **Track A (API scaffolding):** T-24 → T-26 framework — buildable from Stage 3 (needs contract T-04 + ledger T-06 for events); integrates in Stage 6.
- **Track I (AI):** T-29 → T-31 — buildable anytime after T-11; must gate before any AI write.
- **Track P (preservation extras):** T-36 — buildable anytime after T-04.

The **primary serial spine** (which must stay single-threaded for safety) is: **T-35 → foundations → T-12(High) → T-06…T-09(High) → T-22(High) → T-17/T-18(High) → T-33(High)**. Everything else hangs off it.

---

## 5. Stage gates (definition-of-ready to advance)

Advance only when the current stage meets:
- **Migration validated:** backfill complete, zero unexpected nulls, integrity checks (double-entry ties, RULE 2 reconciles) pass.
- **Parity proven:** for any High cutover, per-tenant empty-diff (R4) is green.
- **Soak clean:** the flipped change runs in production for a defined soak window with no regression before the next High begins (R3).
- **Rollback verified:** the flag-off path is tested, not assumed.

---

## 6. If you do nothing else, do these first (the irreducible minimum)

In strict order, the lowest-risk / highest-return opening moves:

1. **T-35** — prove you can restore. *(safety net; near-zero risk)*
2. **T-02 + T-03** — stop float-money and client-numbering harm. *(cheap, additive, ends two S1 bleed-outs)*
3. **T-01** — stamp tenant+jurisdiction. *(cheap now, impossible later)*

These four stop the majority of *ongoing irreversible harm* at the lowest cost and risk in the entire program, and none requires a High-breaking cutover.

---

## 7. Linear sequence (at a glance)

`T-35 → T-04 → T-01 → T-02 → T-03 → T-05 → T-10 → T-11 → T-13 → [T-12 ⛔] → T-14 → T-06 → T-07 → T-08 → [T-09 ⛔] → T-15 → T-16 → T-20 → T-21 → T-23 → [T-22 ⛔] → [T-17 ⛔] → T-19 → [T-18 ⛔] → T-24 → T-25 → T-26 → T-27 → T-28 → T-29 → T-30 → T-31 → T-32 → [T-33 ⛔] → T-36 → T-34 → T-37 → T-38`
*(⛔ = serialized High-breaking cutover; parallel tracks R/A/I/P may run off-spine per §4; T-P1 parked.)*

**The shape of the plan in one sentence:** *prove recovery, make the ground additive and clean, rehearse the cutover on navigation, then flip the ledger, then layer accounting → identity → API → AI → offline → scale — one high-risk cutover at a time, never mutating history, deferring every expensive thing until it's cheap and safe.*
