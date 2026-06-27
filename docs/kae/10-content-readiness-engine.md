# 10 — Content Readiness Engine

> Defines **readiness levels A–D** by content risk, and which levels need expert review before
> publication. Goal: **rigorously gate legal/compliance knowledge, while NOT over-blocking educational
> content.** This sharpens SMRD's readiness gates ([SMRD 10](../smrd/10-content-readiness.md)) into a
> risk-tiered model the KI store enforces.

---

## 1. Readiness levels (by risk, not by topic popularity)

| Level | Class | What it is | Min evidence | Expert review | Examples |
| --- | --- | --- | --- | --- | --- |
| **A** | General educational | concepts, definitions, history, product how-tos, motivation | E1+ (sourced; T5 ok) | **Not required** | "what is a cooperative", "how to add a member", "why go digital", double-entry basics |
| **B** | Accounting guidance | treatments, Dr/Cr, valuation, computations | **E3** (primary + SME) | **Required (accounting SME)** | depreciation method, stock valuation, voucher entries, reconciliation treatment |
| **C** | Compliance | returns, deadlines, filings, registers, audit process | **E3** | **Required (compliance/CA SME)** | GST/TDS returns, statutory returns, audit prep, register requirements |
| **D** | Legal | statutory provisions, sections, rights, penalties, % caps | **E3/E4** | **Required (legal/CA + jurisdiction)** | reserve %, dividend cap, election law, member rights, 80P scope |

## 2. The non-over-blocking principle (explicit)

- **Level A is NOT gated on SME.** Educational/definitional/product content ships with ordinary sourcing
  (including Tier-5 internal corroboration). We do **not** hold "what is a PACS" hostage to a legal review.
- **The gate scales with risk:** the closer a statement gets to *telling a society what the law/rate is*,
  the higher the bar. B/C/D require E3 (primary + SME); A does not.
- A single article often **mixes levels**: its educational frame is A (publishable), but any embedded
  rate/section/deadline is **carved out as a B/C/D KI** that must independently reach E3 — otherwise the
  article presents that specific as "verify with your CA/RCS" rather than as fact.

## 3. Level assignment rules

```
IF claim states a statutory provision/section/right/penalty/%   → D
ELIF claim states a compliance obligation/return/deadline/format → C
ELIF claim states an accounting treatment/Dr-Cr/valuation        → B
ELSE (concept, definition, product behaviour, motivation)        → A
```
Borderline → **round up** (more cautious level). Level is stored on the KI and on the rendered asset
(an asset's effective level = the **highest** level among the KIs it cites).

## 4. Publication gate per level

| Level | Gate to publish |
| --- | --- |
| A | QA Q1–Q6 pass ([08](08-quality-assurance.md)); no SME needed |
| B | A-gates + **accounting SME (Q7)** + evidence E3 |
| C | B-gates + **compliance SME** + jurisdiction validated |
| D | C-gates + **legal/CA SME** + **exact jurisdiction** (state-correct) + E3/E4 |

`ready_for_writing` (SMRD term) = the asset's max-level gate is satisfied for **all** its cited KIs.
`ready_for_ai_generation` = `ready_for_writing` ∧ all cited KIs are non-NEV ∧ level ≤ B *(AI may draft A/B
freely; C/D require human authorship + SME in the loop — see [11](11-ai-knowledge-api.md)).*

## 5. Mixed-content handling (how an article stays publishable)

> An asset is **not** blocked just because it *could* mention a regulated specific. It is blocked only
> from **asserting** an unverified specific. Pattern:

- Publish the **A-level explanation** now.
- For each embedded B/C/D specific: if its KI is E3 → state it (with citation); if NEV → render the
  general concept + "confirm the current rate/section/deadline with your CA / the official portal."
- This is the runtime form of *never fabricate / never infer*.

## 6. Readiness rollup (to SMRD/SCOS)

KAE computes, per SCOS cluster:
- the set of KIs it needs, their levels, and their evidence states;
- the cluster's **writable status** = all required KIs meet their level gate.
This rollup **is** the SMRD readiness scoreboard ([SMRD 10](../smrd/10-content-readiness.md)) — KAE is its
live source. When an SME clears a D-level KI, the dependent clusters auto-advance.

## 7. Level → reviewer mapping

| Level | Reviewer role | Also clears |
| --- | --- | --- |
| A | Editor (no SME) | — |
| B | Accounting SME (CA/accountant) | SMRD/SCOS accounting gate |
| C | Compliance SME (CA/auditor) | SMRD/SCOS compliance gate |
| D | Legal/CA SME + jurisdiction check | SMRD/SCOS legal gate |

One SME validation at the KI level **clears all three layers** (KAE→SMRD→SCOS) — no re-review per layer.

---

### Cross-references
[Evidence Model](03-evidence-model.md) · [Quality Assurance](08-quality-assurance.md) · [AI Knowledge API](11-ai-knowledge-api.md) · [Gap Analysis](12-gap-analysis.md) · [SMRD Content Readiness](../smrd/10-content-readiness.md) · [SCOS Content Engine](../scos/11-content-engine.md)
