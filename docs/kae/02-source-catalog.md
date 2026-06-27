# 02 — Source Catalog

> The master catalog of authoritative sources, classified by **reliability tier**. KAE **reuses the
> SMRD source registry** ([SMRD 02](../smrd/02-source-registry.md), `SRC-` ids) — this file is the
> **authority-tier overlay** that adds the operational fields KAE needs per source (Authority Level,
> Update Frequency, Evidence Strength, Validation Required). **It does not re-list every source** (that
> would duplicate SMRD); it defines the tier model + per-source overlay schema + representative rows.

**Mapping to SMRD tiers:** KAE Tier 1–5 (below) map onto SMRD's evidence tiers T1–T6
([SMRD 01 §2](../smrd/01-research-methodology.md)): KAE T1≈SMRD T1–T2, T2≈T2–T3, T3≈T3–T4, T4≈T4, T5≈T5–T6.

**Per-source overlay (added to each `SRC-` id):**
```yaml
source_id: SRC-REG-NABARD          # from SMRD 02 (reuse — never re-mint)
authority_level: Tier2
jurisdiction: CENTRAL              # → 05-jurisdiction-engine
update_frequency: on-circular | daily | quarterly | yearly | static
evidence_strength: strong | authoritative | supporting | corroborating
validation_required: SME | dual | none
access: portal | gazette | institute | internal
official: true|false
```

---

## Tier 1 — Primary law & official issuances (authoritative)
*Highest authority. A Tier-1 source overrides all lower tiers on conflict. Most carry `validation_required: SME` for interpretation, not existence.*

| KAE entity | SMRD source id | Jurisdiction | Update freq | Evidence | Validation |
| --- | --- | --- | --- | --- | --- |
| Government **Acts** (state coop acts, MSCS 2002) | SRC-ST-ACT-{XX}, SRC-GOV-MSCS | STATE/CENTRAL | on-amendment | authoritative | SME (interpretation) |
| Government **Rules** | SRC-ST-RULES-{XX} | STATE | on-amendment | authoritative | SME |
| Official **Notifications** (CBIC/CBDT/state) | SRC-TAX-*, SRC-ST-RCS-{XX} | CENTRAL/STATE | frequent | authoritative | SME |
| Official **Circulars** (RCS/NABARD/RBI) | SRC-ST-RCS-{XX}, SRC-REG-NABARD, SRC-REG-RBI | varies | on-circular | authoritative | SME |
| Official **Manuals** (PACS CAS, state audit manual) | SRC-OPS-PACSCAS, SRC-ST-AUDITMAN-{XX} | CENTRAL/STATE | on-revision | authoritative | SME |
| Accounting/Auditing **Standards** (ICAI AS/Ind AS) | SRC-STD-ICAI-AS, SRC-STD-ICAI-AUD | profession | on-revision | authoritative | SME |
| Tax **Acts/portals** (GST, Income-tax incl. 80P, TRACES) | SRC-TAX-GST-ACT, SRC-TAX-IT-ACT, SRC-TAX-TRACES | CENTRAL | frequent | authoritative | SME |

## Tier 2 — Sector regulators & registrar publications (strong)
| KAE entity | SMRD source id | Jurisdiction | Update freq | Evidence | Validation |
| --- | --- | --- | --- | --- | --- |
| **NABARD** publications/guidance | SRC-REG-NABARD | CENTRAL (agri-credit) | on-circular | strong | SME for norms |
| **NCDC** scheme docs | SRC-REG-NCDC | CENTRAL | on-scheme | strong | none/SME |
| **NCUI** statistics/education | SRC-REG-NCUI | CENTRAL | periodic | strong | none |
| **Registrar (RCS)** publications/FAQs | SRC-ST-RCS-{XX} | STATE | on-circular | strong | SME for forms |
| **NAFSCOB / DICGC** (coop-bank context) | SRC-REG-NAFSCOB, SRC-REG-DICGC | CENTRAL | periodic | strong | SME |
| Official **FAQs** (GST/IT/NABARD portals) | SRC-FAQ-GST, SRC-FAQ-IT, SRC-FAQ-NABARD | CENTRAL | on-update | strong | SME |

## Tier 3 — Professional institutes, academia, universities (supporting)
| KAE entity | SMRD source id | Jurisdiction | Update freq | Evidence | Validation |
| --- | --- | --- | --- | --- | --- |
| **ICAI / ICMAI** technical guides & guidance notes | SRC-STD-ICAI-GN, SRC-PRO-ICAI-PUB, SRC-STD-ICMAI | profession | on-revision | supporting | SME |
| **VAMNICOM / ICM** training material | SRC-EDU-VAMNICOM, SRC-EDU-ICM | central/state | periodic | supporting | none |
| **Universities** / cooperative research | SRC-EDU-UNIV | various | periodic | supporting | none |
| **Research papers** (peer-reviewed) | SRC-EDU-PAPERS | various | as-found | supporting | SME for claims |

## Tier 4 — Books & industry publications (corroborating)
| KAE entity | SMRD source id | Jurisdiction | Update freq | Evidence | Validation |
| --- | --- | --- | --- | --- | --- |
| Standard cooperative accountancy/audit **textbooks** | SRC-PRO-TEXT | academic | static | corroborating | SME; capture exact cite |
| Industry/sector publications | (mint `SRC-IND-*` as found) | various | periodic | corroborating | dual |

> **Rule:** Tier 4 may *corroborate* but is **never the sole basis** for a legal/accounting claim
> (mirrors SMRD). Never fabricate a book title/author/edition — capture the exact bibliographic detail.

## Tier 5 — Internal knowledge (corroborating, T5)
| KAE entity | SMRD source id | Jurisdiction | Update freq | Evidence | Validation |
| --- | --- | --- | --- | --- | --- |
| SahakarLekha **modules** (~95 routes; formulas/logic) | SRC-INT-MODULES | product | on-release | corroborating | none (product truth) |
| **Guide chapters** (47) | SRC-INT-GUIDE | product | on-edit | corroborating | none |
| **Help articles** | SRC-INT-* (help) | product | on-edit | corroborating | none |
| **Cookbook** (~40 recipes) | SRC-INT-COOKBOOK | product | on-edit | corroborating | none |
| **FAQ** | SRC-INT-* (faq) | product | on-edit | corroborating | none |
| Standard **COA** (in-app) | SRC-INT-COA | product | on-release | corroborating | SME vs prescribed |
| **Demo society** data | SRC-INT-DEMO | product | static | corroborating | none |

> Internal sources confirm that **we and the product agree**, and anchor worked examples — but a Tier-5
> match still needs Tier-1/2 for any statutory claim (E3). They are corroboration, not law.

---

## Catalog governance
1. **Reuse SMRD `SRC-` ids** — never mint a duplicate id for an existing source. New sources get an id in SMRD first, then this overlay.
2. **Authority resolves conflicts:** higher tier wins; conflict is logged on the affected KI ([06](06-version-control.md)).
3. **`update_frequency` drives the [update engine](07-update-engine.md)** polling cadence per source.
4. **`validation_required` drives the [QA gate](08-quality-assurance.md)** (which KIs need SME before active).
5. **Never store copied source text in bulk** — pointer + metadata + the specific captured claim only (IP + freshness).
6. **`official: true`** flag distinguishes primary issuers from commentary — required for Tier-1 status.

---

### Cross-references
[Evidence Model](03-evidence-model.md) · [Jurisdiction Engine](05-jurisdiction-engine.md) · [Update Engine](07-update-engine.md) · [Quality Assurance](08-quality-assurance.md) · [SMRD Source Registry](../smrd/02-source-registry.md)
