# 12 — Gap Analysis

> What the knowledge backbone does **not** yet have, prioritized. This is KAE's standing backlog. It
> **inherits and extends** the SMRD gap analysis ([SMRD 00](../smrd/00-master-research-index.md)) and adds
> the *engine-level* gaps (data store, automation, AI plumbing) that SMRD (a research spec) didn't cover.

**Priority key:** 🔴 P0 (blocks everything) · 🟠 P1 (high value) · 🟡 P2 (depth) · ⚪ P3 (later).

---

## 0. The single blocking gap (unchanged from SMRD)
- 🔴 **No SME engaged** (CA / cooperative auditor). Q7 + E3 cannot be reached, so **0 legal/accounting/
  compliance KIs can be `active`.** Level-A (educational/product) KIs *can* proceed without it. **This is
  the highest-leverage action in the entire stack.**

## 1. Missing knowledge (facts/KIs)
| Gap | Domain | Pri |
| --- | --- | --- |
| Tax KIs (GST applicability/ITC/returns; TDS sections/rates; IT 80P) unsourced to primary | D14/D15 | 🔴 |
| Statutory financial-statement **formats** + report→form mapping | D05 | 🔴 |
| Depreciation rates/method authority KIs | D12 | 🔴 |
| Profit appropriation order, reserve %, dividend cap (per state) | D19 | 🔴 |
| NPA classification/provisioning KIs | D07 | 🟠 |
| Audit grading criteria + objection catalogue | D16 | 🟠 |
| Sector treatments (PACS CAS, dairy fat-SNF, MSP/aarat, KCC subvention) | D02 | 🟠 |
| Deposit + interest + TDS (15G/15H) KIs | D08 | 🟠 |
| Payroll statutory (EPF/ESI/PT/24Q) KIs | D13 | 🟠 |
| AI-domain claims (fraud/scoring) lack evidence | D23 | 🟡 |

## 2. Missing laws (legal corpus / sources to instantiate)
| Gap | Where | Pri |
| --- | --- | --- |
| Per-state **Acts/Rules/Audit-manuals** — 0/36 instantiated | [SMRD 07](../smrd/07-state-wise-registry.md) | 🔴 |
| State Act **titles/years unconfirmed** (all leads `⚠️ confirm`) | [02](02-source-catalog.md) | 🔴 |
| **PACS CAS manual + standard COA** captures | SRC-OPS-PACSCAS | 🔴 |
| Current **tax notifications** (CBIC/CBDT) with `as_of` snapshots | SRC-TAX-* | 🟠 |
| **EPFO/ESIC** sources absent from catalog entirely | [02](02-source-catalog.md) | 🟠 |
| NABARD/RBI specific circulars (NPA, prudential) — pointers only | SRC-REG-* | 🟠 |
| Legal entity sub-graph (Act↔Rule↔Circular edges) unbuilt | [09](09-cross-reference-engine.md) | 🟠 |

## 3. Missing accounting references
| Gap | Pri |
| --- | --- |
| ICAI AS / Guidance Note captures (depreciation, inventory/NRV, revenue, provisions) | 🔴 |
| Society-specific statement formats (I&E, appropriation, fund accounts) | 🔴 |
| Rectification-entry treatments (currently E2† internal only) | 🟠 |
| Cost-accounting refs for processing societies (ICMAI) | 🟡 |

## 4. Missing state coverage
| Gap | Pri |
| --- | --- |
| **36/36 jurisdictions at `open`** — none validated | 🔴 |
| No state-specific facts → D24/D28 pages can't pass thin-content guard | 🔴 |
| Jurisdiction precedence (state vs sectoral/RBI for coop banks) unresearched | 🟠 |
| Wave-1 priority states (MH, GJ, RJ, UP, MP, PB, HR, KA, KL, TN, AP, TG) first | 🟠 |

## 5. Missing templates ([SMRD 08](../smrd/08-template-opportunities.md))
| Gap | Pri |
| --- | --- |
| Statutory-format templates (returns checklist, registers pack, Form-1, AGM kit, resolutions, objection reply, compliance calendar) — format unvalidated | 🟠 |
| Society-type COA packs (×12) | 🟠 |
| Even **live magnets** (audit/GST/inventory) lack a format-validation stamp | 🟠 |

## 6. Missing calculators ([SMRD 09](../smrd/09-tool-opportunities.md))
| Gap | Pri |
| --- | --- |
| High-value calc **logic exists in modules** ✅ but rates/methods unvalidated (depreciation, GST, TDS, NPA, dividend, reserve) | 🟠 |
| No public `/tools` surface (route to add) | 🟠 |
| Generators (notice/minutes/resolution), validators (compliance/audit-readiness), statutory export tools — not built | 🟡 |

## 7. Missing software integrations (KAE ↔ product)
| Gap | Pri |
| --- | --- |
| **No KI data store** yet (KAE is spec; needs tables/JSON + ids) | 🔴 |
| **No automated QA pass** (Q1–Q6 validator over the KI store) | 🟠 |
| **No update-engine automation** (source polling, stale sweep, cascade) | 🟠 |
| **AI Knowledge API not implemented** — `/ask`/siteSearch not yet graph/citation-grounded | 🟠 |
| Society-context → jurisdiction resolution not wired into in-app help | 🟠 |
| Cache-invalidation on version change not wired | 🟡 |
| No SME-validation badge component in the publish path | 🟡 |

## 8. Missing documentation / infrastructure
| Gap | Pri |
| --- | --- |
| No `/downloads` hub + download manifest | 🟡 |
| KI ↔ SCOS-asset `cites`/`explained_by` edges not populated on existing 47 guide + ~30 blog + ~40 cookbook assets | 🟠 |
| Freshness/staleness dashboard (KI rollup by domain/state) not built | 🟡 |
| `as_of` historical-query support in reports not wired | 🟡 |

## 9. Measurement gaps (inherited)
- No keyword/volume/KD data (never fabricated — "Research Required").
- `/ask` logs + support inbox + Search Console not yet mined for demand/question signals.

---

## Prioritized action sequence (the build order)
1. 🔴 **Engage an SME** — unblocks all B/C/D evidence (E3) across KAE/SMRD/SCOS.
2. 🔴 **Stand up the KI data store** (tables/JSON + `KI-`/`EV-` ids) — turns the spec into an engine.
3. 🔴 Capture **PACS CAS + standard COA + statutory statement formats** (broad unlock, many KIs).
4. 🔴 Snapshot **current tax** (GST/TDS/IT-80P) KIs with `as_of` — highest exposure.
5. 🟠 Validate **depreciation / appropriation-reserve / NPA** KIs (calc + magnet ready).
6. 🟠 Instantiate **Wave-1 state** legal corpus + jurisdiction KIs.
7. 🟠 Build the **automated QA pass** + **update-engine** polling/stale-sweep.
8. 🟠 Implement the **AI Knowledge API**; ground `/ask` + in-app help (citation + jurisdiction).
9. 🟡 Populate `cites` edges on existing content; build `/tools`, `/downloads`, freshness dashboard.

> Level-A (educational/product) knowledge can be acquired and served **in parallel now** — it does not
> wait on the SME. Everything regulated waits for E3. *Don't over-block education; never under-gate law.*

---

### Cross-references
[Knowledge Architecture](01-knowledge-architecture.md) · [Content Readiness Engine](10-content-readiness-engine.md) · [Master Index](00-master-index.md) · [SMRD Gap Analysis](../smrd/00-master-research-index.md) · [SCOS Roadmap](../scos/14-roadmap.md)
