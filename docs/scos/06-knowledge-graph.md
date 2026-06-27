# 06 — Knowledge Graph

> The SSOT for relationships. Pages are renderings of **nodes**; links are renderings of **edges**.
> This graph powers internal linking, breadcrumbs, "related", prerequisites, the `/ask` retrieval,
> and the schema in [07-seo-engine.md](07-seo-engine.md).

---

## 1. Node model

Every knowledge object is a node with this schema (stored as cluster/asset front-matter):

```yaml
id: C112                      # registry id
title: "डेप्रिसिएशन (घिसाई)"
type: concept|document|register|report|society-type|regulator|tax|tool|template|task|recipe
pillar: Accounting            # from 02
personas: [ACC, AUD]          # from 05
surface_canonical: /guide/depreciation     # who owns the canonical
surfaces: [guide, blog, calculator, module]
module: /depreciation-schedule              # action endpoint
intents: [info, problem, compliance, calculator]   # from 04
validation: NEV               # or: validated-by, validated-on
edges:
  prerequisite_of: [C053, C051]      # depreciation feeds Balance Sheet, P&L
  requires: [C111]                   # needs Fixed Asset Register
  computed_from: [C111]
  reported_on: [C053, C051]
  governed_by: [ICAI-AS, IncomeTaxAct]   # → 13-authority-engine
  performed_in: /depreciation-schedule
  related: [C114, C113, C116]
```

## 2. Edge types (the relationship vocabulary)

| Edge | Meaning | Drives |
| --- | --- | --- |
| `prerequisite_of` | A must be understood/done before B | learning path, "before you read this" |
| `requires` / `computed_from` | B is calculated from A | "where this number comes from" links |
| `reported_on` | A appears in report B | report→source drill-down |
| `governed_by` | A is ruled by act/standard X | authority citations, `⚠️ NEV` |
| `performed_in` | A is executed in module M | content→product CTA |
| `part_of` | A is a child of pillar/cluster B | breadcrumbs, hierarchy |
| `related` | sibling/adjacent topic | "related articles" |
| `compares_with` | A vs B | comparison clusters |
| `applies_to` | concept A applies to society-type T | type matrix (D27) |
| `due_on` | compliance A has deadline D | seasonal drip, calendar |

## 3. Core graph — the accounting spine (worked example)

```
Society Setup (C220) ─part_of→ Masters
   └─prerequisite_of→ Chart of Accounts (C031)
        └─prerequisite_of→ Opening Balances (C033)
             └─prerequisite_of→ Voucher Entry (C037)
                  ├─performed_in→ /vouchers
                  └─computed_into→ Day Book/Ledger (C027/C032)
                       └─computed_into→ Trial Balance (C049)
                            ├─prerequisite_of→ Trading A/c (C050)
                            ├─prerequisite_of→ Profit & Loss / I&E (C051)
                            ├─prerequisite_of→ Receipts & Payments (C052)
                            └─prerequisite_of→ Balance Sheet (C053)
                                 ├─requires← Depreciation (C112)
                                 ├─requires← Closing Stock (C087)
                                 ├─requires← Reserves (C173)
                                 └─prerequisite_of→ Profit Distribution (C172)
                                      └─prerequisite_of→ AGM (C163) ─then→ Statutory Returns (C154)
                                           └─prerequisite_of→ Year-End & FY-Lock (C-YE)
                                                └─produces→ Opening Balances next FY (loop to C033)
```

> This single chain is the **money path**: every node links up (prerequisite) and down (dependent),
> and sideways to its **module** and its **authority**. The cycle closes (year-end → next year's
> opening), which is the strongest internal-link structure on the site.

## 4. Cross-cutting subgraphs

**Members & capital:** Member (C061) → Share Capital (C062) → Dividend (C174) → Profit Distribution (C172) → AGM (C163).

**Loans & recovery:** Loan (C069) → Interest (C070) → KCC (C071) → Aging (C074) → NPA (C073) → Recovery (C072) → reported_on → NABARD return (C155).

**Inventory → trading:** Inventory (C085) → Valuation (C086) → Closing Stock (C087) → Trading A/c (C050).

**Tax:** Sales/Purchase (C095/C096) → GST (C124) → ITC (C126) → GSTR (C127); Payments → TDS (C134) → 26Q (C135) → Form 16A (C136).

**Audit:** *everything* `reported_on`/`governed_by` → Audit (C143) → Objections (C153) → Rectification (C148) → Certificate/Grade (C145/C150).

**Governance:** AGM (C163) → Minutes (C165) → Resolutions (C168) → Elections (C166) → Board (C167).

## 5. Society-type overlay (D27 matrix)

Each society type node `applies_to` the spine, **overriding** specific nodes:

| Type | Overrides / adds |
| --- | --- |
| PACS | KCC (C071), crop-loan recovery, NABARD return |
| Dairy | milk procurement, fat/SNF payment ledger |
| Consumer | retail stock, GST-heavy |
| Marketing | MSP (C088), kachi aarat (C089) |
| Credit | deposits (D08), NPA (C073), concurrent audit (C147) |
| Housing | maintenance, sinking fund, member dues |

> The overlay is how the **type × topic matrix** stays DRY: the generic node is canonical; the type
> node only carries its *delta*. Prevents 12× duplicate "what is depreciation" pages.

## 6. Internal-linking rules derived from the graph

1. **Up-links (mandatory):** every asset links to its `part_of` pillar and its direct `prerequisite_of` parents.
2. **Down-links:** link to 2–4 strongest `prerequisite_of` / `computed_into` children.
3. **Module link (mandatory):** every how-to/concept links to its `performed_in` module → conversion.
4. **Authority link (mandatory if `⚠️ NEV`):** cite `governed_by` source ([13](13-authority-engine.md)).
5. **Sideways:** 3–6 `related`; comparison clusters link both `compares_with` nodes.
6. **No orphans:** an asset with <2 inbound edges is flagged in QA. Every node reachable from a pillar in ≤3 hops.
7. **Anchor text:** descriptive Hindi-first (the target's `title`), never "click here".

## 7. Implementation notes (reuse existing infra)

- The site already has `siteSearch.ts`, guide/help/cookbook/blog **index registries** — extend each
  asset's metadata with the `edges` block above; a build step can emit "related"/breadcrumb data and
  validate "no orphan / ≤3 hop" rules during `prerender-guide.mjs`.
- `/ask` (AskAssistant) should retrieve over node text + edges (graph-aware RAG) for precise answers.
- Schema.org `about`/`mentions`/`isPartOf` map directly from `part_of`/`related`/pillar.

---

### Cross-references
[Knowledge Architecture](02-knowledge-architecture.md) · [Topic Registry](03-topic-registry.md) · [SEO Engine](07-seo-engine.md) · [Authority Engine](13-authority-engine.md) · [Content Engine](11-content-engine.md)
