# 04 — Search Intent Engine

> Maps every cluster in [03-topic-registry.md](03-topic-registry.md) to the intents users actually
> search with, and routes each intent to the **right surface** (guide / blog / help / cookbook / faq /
> ask / software / calculator / template). Intent → surface → schema → CTA is the conversion spine.

---

## 1. Intent taxonomy (the 12 lenses)

For every cluster we classify against these lenses. A cluster usually spans **several**; each lens
that fires becomes a distinct asset/section, not a duplicate page.

| Lens | User is trying to… | Primary surface | Schema | CTA |
| --- | --- | --- | --- | --- |
| **Informational** | understand a concept | `/guide`, `/blog` | Article | related + register |
| **Transactional** | get/do a thing now | `/software`, app module | SoftwareApplication | register / open module |
| **Commercial** | compare before buying | `/software/:type`, "vs" pages | Product/Review | demo / pricing |
| **Navigational** | reach a known page/brand | home, `/search` | — | — |
| **Problem-solving** | fix a specific error | `/help`, troubleshooting | HowTo | open module |
| **Compliance** | meet a deadline/return | `/guide` (statutory), `/blog` seasonal | FAQ/HowTo | checklist magnet |
| **Learning** | study/upskill | `/guide` + quizzes | Course | certificate |
| **Software** | "X software for cooperative" | `/software/:type`, `:state` | SoftwareApplication | register |
| **Template** | download a format | [09](09-template-library.md) landing | — | email-gated download |
| **Checklist** | a do-this list | magnet + article | FAQ | email-gated PDF |
| **Calculator** | compute a number | [10](10-calculators.md) tool | — | save/register |
| **Download** | grab a resource | `/downloads` hub | — | email capture |

## 2. Intent → Surface routing rules

```
Concept / "क्या है / kya hota hai"        → Guide (canonical) + Blog (supporting)
"कैसे करें in app / how to X"            → Help task page (HowTo schema)
"कौन सा voucher / which entry for Y"     → Cookbook recipe
"... due date / last date / return"      → Blog (seasonal, drip) + Compliance guide
"... calculate / formula"                → Calculator tool + explainer
"... format / template / download"       → Template landing (email-gated)
"... software / app / system"            → /software/:type or /cooperative-software/:state
"... vs ... / comparison"                → Comparison cluster (commercial)
"... problem / not matching / error"     → Troubleshooting / Help
Quick one-liner                          → FAQ + /ask
```

## 3. Per-cluster intent mapping (representative — pattern repeats for all 386)

| Cluster | Info | Trans | Comm | Prob | Compl | Learn | SW | Tmpl | Chk | Calc | Dl | Lead magnet |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| C112 Depreciation | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | depr-schedule template |
| C124 GST for coops | ✓ | | | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | **gst-checklist** (live) |
| C143 Coop audit | ✓ | | | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ | **audit-checklist** (live) |
| C085 Inventory | ✓ | ✓ | | ✓ | | ✓ | ✓ | ✓ | ✓ | | ✓ | **inventory-checklist** (live) |
| C069 Loan accounting | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | loan register template |
| C163 AGM | ✓ | | | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ | AGM kit |
| C033 Opening balances | ✓ | ✓ | | ✓ | | ✓ | ✓ | ✓ | | | ✓ | OB template |
| C004 Society types | ✓ | | ✓ | | | ✓ | ✓ | | | | | comparison sheet |
| C190 Choosing software | ✓ | | ✓ | | | | ✓ | | | | | demo request |
| C206 State acts | ✓ | | ✓ | | ✓ | | ✓ | | | | | — |

> **Process:** for each registry cluster, fill this 12-column row → it tells the writer *which assets to
> make*, which surface owns the canonical, which schema to emit, and which magnet to attach. Stored
> as cluster front-matter (see [11-content-engine.md](11-content-engine.md) §Cluster spec).

## 4. Query-pattern library (Hindi-first, the long tail)

Seed patterns that expand across every cluster noun `{X}` (concept) and `{T}` (society type):

- `{X} क्या है` / `{X} kya hota hai` / `what is {X}`
- `{X} कैसे करें` / `how to {X}` / `{X} entry kaise kare`
- `{X} का फॉर्मूला` / `{X} formula` / `{X} calculate kaise kare`
- `{X} format / template / PDF / Excel download`
- `{X} due date / last date {year}`
- `सहकारी समिति में {X}` / `{T} society {X}`
- `{X} में गलती / problem / not matching`
- `{T} के लिए software / accounting`
- `{X} vs {Y}`

Each pattern × cluster = a target query → article section / FAQ / help task. This is the engine
behind topical authority (see [07-seo-engine.md](07-seo-engine.md)).

## 5. SERP-feature targeting

| Feature | How we win it |
| --- | --- |
| Featured snippet | crisp definition + Dr/Cr table near top of canonical |
| People-Also-Ask | FAQ schema on every cluster |
| HowTo rich result | step lists on help tasks |
| Sitelinks | clean URL + breadcrumb hierarchy ([07](07-seo-engine.md)) |
| Image pack | labeled diagrams/tables, alt text Hindi+English |
| Video | screencasts (D26 C230) |

---

### Cross-references
[Topic Registry](03-topic-registry.md) · [Personas](05-personas.md) · [SEO Engine](07-seo-engine.md) · [Lead Engine](08-lead-engine.md) · [Content Engine](11-content-engine.md)
