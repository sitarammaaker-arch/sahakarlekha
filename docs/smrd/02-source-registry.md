# 02 — Source Registry

> A **structured registry of research sources** — categories, identifiers, tiers, and how to access
> them. **We do NOT copy source content here.** Each entry is a pointer + metadata; the actual fact
> capture (with exact ref + date + URL) happens per claim in [03](03-topic-research-registry.md).
>
> Builds on [SCOS 13 — Authority Engine](../scos/13-authority-engine.md); SMRD adds source **IDs**,
> **tiers** ([01 §2](01-research-methodology.md)), access method, and update cadence so records can cite a stable id.

**Source ID scheme:** `SRC-<GROUP>-<SHORT>` (e.g. `SRC-REG-NABARD`). Tier = T1–T6 from [01](01-research-methodology.md).
**Captured fields per source:** id · name · tier · jurisdiction · access · official? · update-cadence · notes.

---

## G1 · Central Government & Policy
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-GOV-MOC | Ministry of Cooperation (cooperation.gov.in) | T2 | Central | web/portal | on policy |
| SRC-GOV-MSCS | Multi-State Cooperative Societies Act 2002 & Rules | T1 | Central (multi-state) | gazette/portal | on amendment |
| SRC-GOV-CRCS | Central Registrar of Cooperative Societies | T2 | Central | portal | on circular |
| SRC-GOV-NCP | National Cooperative Policy / schemes | T2 | Central | portal | on release |
| SRC-GOV-MEITY | PACS computerization scheme docs | T2 | Central | portal | on update |

## G2 · State Cooperative Departments (per state — see [07](07-state-wise-registry.md))
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-ST-ACT-{XX} | {State} Cooperative Societies Act `⚠️ NEV` | T1 | State {XX} | gazette/RCS site | on amendment |
| SRC-ST-RULES-{XX} | {State} Cooperative Societies Rules `⚠️ NEV` | T1 | State {XX} | RCS site | on amendment |
| SRC-ST-RCS-{XX} | {State} Registrar of Cooperative Societies | T2 | State {XX} | RCS site | on circular |
| SRC-ST-BYELAW-{XX} | {State} Model Byelaws | T1/T2 | State {XX} | RCS | periodic |
| SRC-ST-AUDITMAN-{XX} | {State} Cooperative Audit Manual `⚠️ NEV` | T2 | State {XX} | dept | periodic |

> `{XX}` = state code (RJ, UP, MH, GJ, MP, KA, …). Instantiate one set per state as research proceeds.
> **Never assume uniformity across states.**

## G3 · Sector Regulators & Development Bodies
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-REG-NABARD | NABARD (nabard.org) — refinance, PACS/credit norms, returns | T2 | Central/agri-credit | portal/circulars | on circular |
| SRC-REG-RBI | RBI — cooperative banks (UCB/StCB/DCCB) `⚠️ NEV` | T1/T2 | Central (coop banks) | rbi.org.in | on notification |
| SRC-REG-NCDC | National Cooperative Development Corporation | T3 | Central | portal | on scheme |
| SRC-REG-NCUI | National Cooperative Union of India | T3 | Central | portal | periodic |
| SRC-REG-NAFSCOB | NAFSCOB (state coop banks federation) `⚠️ NEV` | T3 | Central | portal | periodic |
| SRC-REG-DICGC | Deposit insurance (coop banks) `⚠️ NEV` | T2 | Central | portal | on update |

## G4 · PACS / Sector Operations Manuals
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-OPS-PACSCAS | PACS Common Accounting System (CAS) manual `⚠️ NEV` | T2 | Central/PACS | scheme docs | on revision |
| SRC-OPS-PACS-COA | PACS standard chart of accounts `⚠️ NEV` | T2 | PACS | scheme docs | on revision |
| SRC-OPS-DAIRY | Dairy federation accounting manuals (e.g. state milk unions) `⚠️ NEV` | T3 | Sector | federation | periodic |
| SRC-OPS-MARKETING | Marketing/procurement (MSP, mandi) operating norms `⚠️ NEV` | T2/T3 | Sector | agency | seasonal |

## G5 · Accounting & Auditing Standards
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-STD-ICAI-AS | ICAI Accounting Standards / Ind AS `⚠️ NEV` | T1 | Central/profession | ICAI | on revision |
| SRC-STD-ICAI-AUD | ICAI auditing standards / guidance (coop audit) `⚠️ NEV` | T1/T4 | Profession | ICAI | on revision |
| SRC-STD-ICAI-GN | ICAI Guidance Notes (depreciation, inventory, revenue) `⚠️ NEV` | T4 | Profession | ICAI | on revision |
| SRC-STD-ICMAI | Institute of Cost Accountants (costing) | T4 | Profession | ICMAI | periodic |

## G6 · Taxation
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-TAX-GST-ACT | CGST/SGST/IGST Acts 2017 `⚠️ NEV` | T1 | Central+State | gazette | on amendment |
| SRC-TAX-GST-PORTAL | GST portal + CBIC notifications/circulars `⚠️ NEV` | T2 | Central | gst.gov.in | frequent |
| SRC-TAX-IT-ACT | Income-tax Act 1961 (incl. 80P) `⚠️ NEV` | T1 | Central | gazette/portal | yearly (Budget) |
| SRC-TAX-IT-PORTAL | Income-tax portal / CBDT `⚠️ NEV` | T2 | Central | incometax.gov.in | frequent |
| SRC-TAX-TRACES | TDS/TCS — TRACES (26Q/24Q/16A) `⚠️ NEV` | T2 | Central | tdscpc.gov.in | on update |
| SRC-TAX-PT-{XX} | State Professional Tax `⚠️ NEV` | T1 | State {XX} | state dept | yearly |
| SRC-TAX-STAMP-{XX} | State Stamp Act `⚠️ NEV` | T1 | State {XX} | state dept | on amendment |

## G7 · Universities, Training & Research
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-EDU-VAMNICOM | VAMNICOM Pune — coop management | T3 | Central | institute | periodic |
| SRC-EDU-ICM | Institutes of Cooperative Management (state) | T3 | State | institute | periodic |
| SRC-EDU-UNIV | Agricultural/cooperative universities | T3/T4 | Various | repositories | periodic |
| SRC-EDU-PAPERS | Peer-reviewed research papers `⚠️ NEV` | T4 | Various | journals | as found |

## G8 · Professional Institutes & Commentary
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-PRO-ICAI-PUB | ICAI publications / technical guides | T4 | Profession | ICAI | periodic |
| SRC-PRO-TEXT | Standard cooperative accountancy/audit textbooks (capture exact cite — never fabricate) | T4 | Academic | library | static |
| SRC-PRO-CA | Engaged CA / cooperative auditor (SME) | T5 | Engagement | direct | on demand |

## G9 · Official FAQs & Help (primary-issuer)
| ID | Source | Tier | Jurisdiction | Access | Cadence |
| --- | --- | --- | --- | --- | --- |
| SRC-FAQ-GST | GST portal official FAQs `⚠️ NEV` | T2 | Central | portal | on update |
| SRC-FAQ-IT | Income-tax official FAQs `⚠️ NEV` | T2 | Central | portal | on update |
| SRC-FAQ-NABARD | NABARD circular FAQs | T2 | Central | portal | on update |

## G10 · Internal corroboration (SahakarLekha's own, T5)
| ID | Source | Tier | Use |
| --- | --- | --- | --- |
| SRC-INT-GUIDE | `/guide` 47 chapters (verified treatments) | T5 | corroborate, link |
| SRC-INT-COOKBOOK | `/cookbook` ~40 transaction recipes (Dr/Cr) | T5 | corroborate entries |
| SRC-INT-MODULES | App module formulas (~95 modules) | T5 | corroborate computation |
| SRC-INT-COA | Standard chart of accounts (in-app) | T5 | corroborate COA |
| SRC-INT-DEMO | Demo society full-year data | T5 | worked-example basis |

> **Internal sources are corroboration, not primary law.** A T5 internal match still needs T1/T2 for
> any statutory claim. But internal sources are excellent to confirm we and the product agree.

---

## Registry governance
1. New source → assign `SRC-` id, tier, jurisdiction, cadence. Never store copied text — only metadata + pointer.
2. `{XX}` state and `{state}` tax sources are **instantiated per state** as [07](07-state-wise-registry.md) progresses.
3. Every `⚠️ NEV` source feeds claims that stay below E3 until SME sign-off ([01 §4](01-research-methodology.md)).
4. De-duplicate: one id per source; reference it everywhere (don't re-list).
5. Review cadence column drives the re-validation schedule ([01 §7](01-research-methodology.md)).

---

### Cross-references
[Research Methodology](01-research-methodology.md) · [Topic Research Registry](03-topic-research-registry.md) · [Law & Compliance](06-law-and-compliance.md) · [State-wise Registry](07-state-wise-registry.md) · [SCOS Authority Engine](../scos/13-authority-engine.md)
