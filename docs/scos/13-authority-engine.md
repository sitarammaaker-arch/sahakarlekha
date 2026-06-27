# 13 — Authority Engine

> The reference backbone behind E-E-A-T and the `⚠️ NEV` gate. Lists the **source categories** every
> accounting/legal claim must trace to. **We name institutions and acts at the category level; we do
> NOT reproduce specific section numbers, rates, or formats here** — those are collected per-asset,
> verified against the primary source, and validated by a CA/auditor before publishing.
>
> **Rule:** "Never guess. Never fabricate provisions." Every `governed_by` edge in [06](06-knowledge-graph.md)
> points to one of the sources below, with a captured citation (title + section/clause + date + URL).

---

## 1. Cooperative law (primary)

| Source | Scope | Use for | Note |
| --- | --- | --- | --- |
| **Multi-State Cooperative Societies Act, 2002 & Rules** | Multi-state societies/federations | registration, governance, audit, returns | cite exact section `⚠️ NEV` |
| **State Cooperative Societies Acts & Rules** (each state) | State societies (PACS, etc.) | governance, audit class, reserves, elections | **varies by state** — per-state citation `⚠️ NEV` |
| **Model Byelaws** (state/RCS issued) | Society constitution | byelaw clusters, registration | `⚠️ NEV` |
| **Registrar of Cooperative Societies (RCS)** circulars | State administration | returns, formats, deadlines | collect circular ref `⚠️ NEV` |

> Examples of state acts to reference per state page (verify current amended version): Rajasthan,
> Maharashtra, Uttar Pradesh, Gujarat, Madhya Pradesh, Karnataka, etc. **Always cite the current
> amended act/rule for that state — never assume uniformity.**

## 2. Sector regulators & promotional bodies

| Source | Use for |
| --- | --- |
| **Ministry of Cooperation** (cooperation.gov.in) | national policy, PACS computerization, schemes |
| **NABARD** (nabard.org) | PACS/credit norms, refinance, returns, NPA guidance `⚠️ NEV` |
| **RBI** | cooperative **banks** (UCB/StCB/DCCB) regulation `⚠️ NEV` |
| **NCDC** | development finance, schemes |
| **NCUI** | cooperative education, statistics, training |
| **State Cooperative Federations / Apex banks** | reporting formats, dues |

## 3. Accounting & audit standards

| Source | Use for |
| --- | --- |
| **ICAI** — Accounting Standards (AS) / Ind AS, Guidance Notes | depreciation, inventory, revenue, provisions `⚠️ NEV` |
| **ICAI** — technical/guidance material on cooperative audit | audit scope, schedules `⚠️ NEV` |
| **Institute of Cost Accountants (ICMAI)** | costing, processing societies |
| **State Cooperative Audit Manuals / RCS audit manuals** | statutory audit, classification/grading `⚠️ NEV` |

## 4. Taxation

| Source | Use for |
| --- | --- |
| **CGST/SGST/IGST Acts, 2017 + GST portal** (gst.gov.in) | GST applicability, ITC, returns, e-way bill, HSN `⚠️ NEV` |
| **Income-tax Act, 1961** (incometax.gov.in) | society taxation, **80P** deduction, ITR, audit `⚠️ NEV` |
| **TDS/TCS provisions + TRACES** | TDS sections/rates, 26Q/24Q, Form 16A `⚠️ NEV` |
| **State Professional Tax / Stamp Acts** | PT slabs, stamp duty (state-specific) `⚠️ NEV` |

> **Rates and thresholds change every year / Budget.** Treat all tax specifics as **dated, sourced,
> and validated** — present rates as inputs or clearly-dated defaults, never as timeless fact.

## 5. Training & academic institutions

| Source | Use for |
| --- | --- |
| **VAMNICOM, Pune** (Vaikunth Mehta National Institute of Cooperative Management) | curriculum, training, authority |
| **Institutes of Cooperative Management (ICM)** — state | training references |
| **Agricultural / cooperative universities** | research, case studies |
| **NCUI Cooperative Education** | member/staff education content |

## 6. Reference works (collect, don't fabricate)

- Standard **cooperative accountancy / cooperative audit** textbooks and RCS-issued manuals.
- **Do not invent titles, authors, editions, or page numbers.** When a book is cited, capture the
  exact bibliographic detail from the physical/official source. Until captured → `⚠️ NEV`.

## 7. Citation record (captured per asset)

```yaml
claim: "Reserve fund: minimum X% of net profit transferred"
status: NEV            # until validated
source:
  type: state-act
  name: "<State> Cooperative Societies Act/Rules"
  ref: "Section / Rule <n>"      # captured from primary source, not assumed
  as_of: "<date / amendment>"
  url: "<official URL>"
  validated_by: ""               # CA/auditor name
  validated_on: ""
```
Every `⚠️ NEV` item in the registry carries this record before it can pass gate 5 ([11 §3](11-content-engine.md)).

## 8. Authority-building outputs (become a source others cite)

- **Glossary** (Hindi-English) of every term → highly linkable.
- **Standard COA packs**, **templates**, **calculators** with transparent formulas.
- **Statute/return explainers** with accurate, dated citations.
- **Author bios** (CA/auditor credentials) + validation badges.
> Goal: SahakarLekha becomes the **link destination** for cooperative-accounting facts — the strongest
> long-term authority moat.

---

### Cross-references
[Knowledge Graph](06-knowledge-graph.md) · [Content Engine](11-content-engine.md) · [SEO Engine](07-seo-engine.md) · [Project Overview](01-project-overview.md)
