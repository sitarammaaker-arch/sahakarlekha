# 06 — Law & Compliance Research Map

> A **research map** of the legal/compliance landscape — *what to find and where it applies*, not the
> provisions themselves. **No section numbers, rates, deadlines, or formats are asserted here.** Every
> legal item is a research target with an explicit **jurisdiction** and stays `NEV` until E3
> (primary law + SME) per [01](01-research-methodology.md).

**Jurisdiction tags (mandatory on every legal record):**
`CENTRAL` · `STATE:{XX}` · `TYPE:{society-type}` · `SECTORAL` (NABARD/RBI). A legal record without a
jurisdiction tag is **invalid**.

---

## 1. Central cooperative law (CENTRAL)
| Item | Source | Research targets | NEV |
| --- | --- | --- | --- |
| Multi-State Cooperative Societies Act 2002 & Rules | SRC-GOV-MSCS | registration, governance, audit, returns, dissolution for **multi-state** societies/federations | yes |
| Central Registrar (CRCS) | SRC-GOV-CRCS | filings, formats applicable to multi-state | yes |
| Ministry of Cooperation policy/schemes | SRC-GOV-MOC | policy mandates, PACS computerization scope | partial |

> **Scope note:** single-state societies are governed by **state** law, not MSCS. Record applicability
> precisely — mis-scoping is a critical error.

## 2. State cooperative law (STATE:{XX}) — the dominant layer
For **each** state/UT (see [07](07-state-wise-registry.md)) capture:
| Item | Source | Research targets | NEV |
| --- | --- | --- | --- |
| {State} Cooperative Societies Act | SRC-ST-ACT-{XX} | definitions, society classes, member rights, audit, reserves, dividend cap, elections, dissolution | yes |
| {State} Cooperative Societies Rules | SRC-ST-RULES-{XX} | forms, registers, procedures, timelines | yes |
| Amendments / current version | SRC-ST-ACT-{XX} | latest amended text + `as_of` | yes |

> **Never assume two states match.** Each becomes its own set of records.

## 3. Rules & subordinate legislation (STATE:{XX} / CENTRAL)
| Item | Research targets | NEV |
| --- | --- | --- |
| Procedural rules | registration, audit, election, recovery procedures | yes |
| Prescribed forms/registers | statutory register list, return forms, Form-1 etc. | yes |
| Fee/penalty schedules | filing fees, penalties for non-compliance | yes |

## 4. Byelaws (TYPE / STATE:{XX})
| Item | Source | Research targets | NEV |
| --- | --- | --- | --- |
| Model byelaws | SRC-ST-BYELAW-{XX} | standard clauses, objects, profit appropriation, meeting rules | yes |
| Byelaw amendment process | SRC-ST-ACT-{XX} | procedure, approval, filing | yes |
| Society-specific byelaw variation | per society | how byelaws override defaults | yes |

## 5. Circulars & issuances (CENTRAL / SECTORAL / STATE:{XX})
| Item | Source | Research targets | NEV |
| --- | --- | --- | --- |
| RCS circulars | SRC-ST-RCS-{XX} | return formats, deadlines, directives | yes |
| NABARD circulars | SRC-REG-NABARD | credit/PACS norms, NPA, refinance, returns | yes |
| RBI notifications (coop banks) | SRC-REG-RBI | UCB/StCB/DCCB prudential norms | yes |
| CBIC/GST + CBDT notifications | SRC-TAX-* | tax changes affecting societies | yes |

## 6. Taxation compliance (CENTRAL)
| Area | Source | Research targets | NEV |
| --- | --- | --- | --- |
| GST | SRC-TAX-GST-* | registration threshold, ITC, returns, RCM, e-way, member-mutuality, exemptions | yes |
| TDS/TCS | SRC-TAX-TRACES, SRC-TAX-IT-ACT | sections, rates, 26Q/24Q, 16A, 15G/15H | yes |
| Income tax (society) | SRC-TAX-IT-ACT | 80P deduction scope, ITR, tax-audit thresholds | yes |
| Professional tax / stamp | SRC-TAX-PT-{XX}, SRC-TAX-STAMP-{XX} | state slabs/duties | yes (STATE) |

## 7. Sectoral / banking compliance (SECTORAL)
| Area | Source | Research targets | NEV |
| --- | --- | --- | --- |
| Cooperative banks (UCB/StCB/DCCB) | SRC-REG-RBI | dual regulation, prudential/CRAR, audit | yes |
| Credit societies (non-bank) | SRC-ST-ACT-{XX}, SRC-REG-NABARD | deposit/loan limits, concurrent audit | yes |
| Deposit insurance | SRC-REG-DICGC | applicability to coop banks | yes |

## 8. Compliance-requirement map (what must be done, by jurisdiction)
Research the **obligation set** per society (each = a record with jurisdiction + frequency + form + deadline `NEV`):
- **Registration & byelaws:** initial registration, byelaw amendments. `STATE`
- **Governance:** AGM within prescribed period, board meetings, elections. `STATE`
- **Audit:** annual statutory audit, filing of audited accounts, objection compliance. `STATE`
- **Returns:** annual return to RCS, NABARD/federation returns. `STATE/SECTORAL`
- **Registers:** maintain prescribed statutory registers. `STATE`
- **Funds:** statutory reserve %, education/coop fund contributions. `STATE`
- **Tax:** GST returns, TDS returns/payments, ITR, PT. `CENTRAL/STATE`
- **Member:** share/nomination records, Form-1 member list. `STATE`

## 9. Compliance calendar research (→ C158)
- Build a **consolidated due-date calendar** by combining: state RCS deadlines (STATE, variable) +
  central tax cycles (GST monthly, TDS quarterly, ITR annual). All dates `NEV` + `as_of`.
- Output structure (not values) feeds the live seasonal drip ([SCOS 07 §9](../scos/07-seo-engine.md)) and the
  compliance-calendar magnet ([08](08-template-opportunities.md)).

## 10. Legal validation gate (E3 for any legal claim)
1. **Primary law** captured (act/rule/notification) with exact reference + `as_of` + URL.
2. **Jurisdiction** tag present and correct (central vs state vs type vs sectoral).
3. **Current version** confirmed (latest amendment).
4. **SME sign-off** (CA / cooperative auditor / legal) recorded.
5. Conflicting sources resolved by tier ([01 §2](01-research-methodology.md)); conflict noted.

> Until all five pass, the claim is `NEV`: content may describe the **existence and purpose** of an
> obligation generally, but must direct the reader to the official source / their CA for the specific
> provision, rate, or deadline. **No fabricated section numbers, ever.**

---

### Cross-references
[Source Registry](02-source-registry.md) · [State-wise Registry](07-state-wise-registry.md) · [Topic Research Registry](03-topic-research-registry.md) · [Content Readiness](10-content-readiness.md) · [SCOS Authority Engine](../scos/13-authority-engine.md)
