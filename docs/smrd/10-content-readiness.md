# 10 — Content Readiness

> The **gate** between research and writing. For every topic (SCOS cluster id) this tracks the six
> readiness flags and enforces the **Quality Gates** — no article, tool, or template ships until its
> row passes. This is where SMRD hands off to the [SCOS content engine](../scos/11-content-engine.md).

**Readiness flags (per topic id):**
`research_complete` · `legal_verified` (YES | NEV-cleared | NO) · `accounting_verified` (YES | NEV-cleared | NO) ·
`ready_for_writing` · `needs_sme_review` · `ready_for_ai_generation`.

> `NEV-cleared` = the item *was* NEV and has now reached **E3** (primary source + SME). A topic with no
> statutory/accounting content can have legal/accounting verified = **N/A → treated as YES**.

---

## 1. Quality Gates (a topic is writable only if ALL are true)

| Gate | Requirement | Source |
| --- | --- | --- |
| G1 | `research_complete = YES` | [03](03-topic-research-registry.md) status = validated |
| G2 | `legal_verified = YES or NEV-cleared(E3)` | [06](06-law-and-compliance.md) |
| G3 | `accounting_verified = YES or NEV-cleared(E3)` | [05](05-accounting-research.md) |
| G4 | `source_registry_available = YES` | ≥1 T1/T2 source in [02](02-source-registry.md) |
| G5 | `internal_links_available = YES` | graph edges exist ([SCOS 06](../scos/06-knowledge-graph.md)) |
| G6 | `related_tools_identified = YES` | [09](09-tool-opportunities.md) |
| G7 | `lead_magnet_identified = YES` | [08](08-template-opportunities.md) / [SCOS 08](../scos/08-lead-engine.md) |

`ready_for_writing = G1∧G2∧G3∧G4∧G5∧G6∧G7`.
`ready_for_ai_generation = ready_for_writing ∧ ¬needs_sme_review` (i.e. AI may draft only fully-cleared,
non-borderline topics; anything still NEV or SME-flagged stays human-led).

## 2. Readiness scoreboard — baseline (v1.0, before SME engagement)

> Honest baseline: **no topic is `ready_for_writing` yet**, because G3/G2 require SME sign-off (E3) and
> no SME is engaged at v1.0. Many topics are *close* — research + internal corroboration done, only the
> SME gate pending. Flags below: ✅ done · ⏳ pending · ❌ not started · N/A.

| Domain | research | legal | acct | links | tools | magnet | writable? | blocker |
|---|---|---|---|---|---|---|---|---|
| D01 Foundations | ⏳ | ⏳NEV | N/A | ✅ | ✅ | ⏳ | no | confirm act facts (SME) |
| D02 Society-type acct | ⏳ | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | no | sector treatments (SME+SRC-OPS) |
| D03 Acct foundations | ✅* | N/A | ⏳NEV | ✅ | ✅ | ⏳ | partial | COA prescription + SME |
| D04 Vouchers | ✅* | N/A | ⏳NEV | ✅ | ✅ | ✅ | partial | Dr/Cr SME sign-off |
| D05 Final accounts | ⏳ | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | no | statutory format |
| D06 Members/shares | ⏳ | ⏳NEV | N/A | ✅ | ✅ | ⏳ | no | state law |
| D07 Loans/recovery | ⏳ | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | no | NABARD/NPA norms |
| D08 Deposits | ❌ | ⏳NEV | ⏳NEV | ✅ | ⏳ | ⏳ | no | deposit+TDS norms |
| D09 Inventory | ✅* | N/A | ⏳NEV | ✅ | ✅ | ✅ | partial | valuation AS + SME |
| D10 Sales/purchase | ✅* | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | partial | GST treatment |
| D11 Banking | ✅* | N/A | N/A | ✅ | ✅ | ⏳ | near | cash-limit (state) only |
| D12 Assets/deprec | ⏳ | ⏳NEV | ⏳NEV | ✅ | ✅ | ✅ | no | depreciation rates (SME) |
| D13 Payroll | ❌ | ⏳NEV | ⏳NEV | ✅ | ⏳ | ⏳ | no | EPF/ESI/PT/TDS rates |
| D14 GST | ❌ | ⏳NEV | ⏳NEV | ✅ | ✅ | ✅ | no | all NEV (frequent change) |
| D15 TDS/IT | ❌ | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | no | sections/rates, 80P |
| D16 Audit | ⏳ | ⏳NEV | ⏳NEV | ✅ | ⏳ | ✅ | no | state audit manual + grading |
| D17 Compliance | ⏳ | ⏳NEV | N/A | ✅ | ⏳ | ⏳ | no | per-state returns/deadlines |
| D18 Governance | ⏳ | ⏳NEV | N/A | ✅ | ⏳ | ⏳ | no | state act (AGM/election) |
| D19 Profit/reserves | ⏳ | ⏳NEV | ⏳NEV | ✅ | ✅ | ⏳ | no | appropriation order/% |
| D20 Budget/finmgmt | ✅* | N/A | N/A | ✅ | ✅ | ⏳ | near | benchmark sourcing |
| D21 Digital transf. | ✅* | ⏳ | N/A | ✅ | ✅ | ⏳ | partial | scheme facts |
| D22 Technology/data | ✅* | N/A | N/A | ✅ | ✅ | ⏳ | near | product-grounded |
| D23 AI | ❌ | ⏳NEV | N/A | ✅ | ⏳ | ⏳ | no | evidence for claims |
| D24 State landscape | ❌ | ⏳NEV | N/A | ✅ | ❌ | ⏳ | no | per-state research ([07](07-state-wise-registry.md)) |
| D25 Error/troubleshoot | ✅* | N/A | ⏳NEV | ✅ | ✅ | ⏳ | partial | rectification SME |
| D26 Onboarding/help | ✅* | N/A | N/A | ✅ | ✅ | ⏳ | **near-ready** | product-grounded only |

`*` research_complete here means *internal corroboration done* (T5: guide/cookbook/module) — still
needs the SME stamp for any accounting/legal sub-claim.

## 3. Read-out
- **Closest to writable (product-grounded, low NEV):** D26 onboarding/help, D22 technology, D11 banking
  mechanics, D20 management, parts of D03/D04/D09/D25. These need only **magnet assignment + (light) SME**.
- **Hard-blocked on SME/primary law:** all tax (D14/D15), state-law domains (D06/D17/D18/D24/D19),
  audit grading (D16), depreciation rates (D12), sector treatments (D02).
- **Single biggest unlock:** **engage a CA / cooperative auditor (SME).** That one action clears the
  G2/G3 gates blocking the majority of high-value clusters.

## 4. Readiness state machine (per topic)
```
NOT-STARTED → RESEARCHING → INTERNALLY-CORROBORATED(E2†) → SME-QUEUE
   → CLEARED(E3) → WRITABLE → [AI-DRAFTABLE if ¬needs_sme_review] → (handoff to SCOS 11)
```

## 5. Handoff contract to SCOS
A topic crossing into **WRITABLE** exports to the [SCOS content engine](../scos/11-content-engine.md) a
bundle: `{validated claims + sources (E3), jurisdiction, internal links (graph edges), tool id, magnet
id, recheck_on}`. SCOS then runs its own gates 6–7 (SEO/QA). **SMRD owns truth; SCOS owns rendering.**

---

### Cross-references
[Topic Research Registry](03-topic-research-registry.md) · [Accounting Research](05-accounting-research.md) · [Law & Compliance](06-law-and-compliance.md) · [Master Research Index + Gap Analysis](00-master-research-index.md) · [SCOS Content Engine](../scos/11-content-engine.md)
