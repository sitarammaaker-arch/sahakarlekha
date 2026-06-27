# 04 — Search Intelligence

> Per-topic **research fields** for demand and question-space. This complements (does not duplicate)
> [SCOS 04 — Search Intent](../scos/04-search-intent.md): SCOS classifies *intent → surface*; SMRD
> records the *raw question inventory and demand signals* that research must gather.
>
> **No fabricated metrics.** Unknown values are left blank or marked **"Research Required"**. We never
> invent search volumes, KD, or CPC.

**Per-topic search-intelligence record (keyed to SCOS cluster id):**
```yaml
topic_id: C124
primary_search_intent: → SCOS 04 (info/transactional/compliance/…)
related_questions: [ ... ]            # gathered, not invented
people_also_ask: [ ... ]              # Research Required (pull from SERP)
longtail_variations: [ ... ]          # expand from query-pattern library (SCOS 04 §4)
beginner_questions: [ ... ]
expert_questions: [ ... ]
seasonality: <month/quarter or "none"> | Research Required
state_specificity: high|medium|low|none
business_value: high|medium|low       # to SahakarLekha (qualitative, defined below)
potential_lead_magnet: → SMRD 08 / SCOS 08
potential_calculator: → SMRD 09 / SCOS 10
potential_download: → SMRD 08
search_volume: Research Required       # never fabricated
keyword_difficulty: Research Required
```

---

## 1. Field-collection rules

| Field | How to populate | Allowed to leave blank? |
| --- | --- | --- |
| related_questions / PAA | from real SERP, Search Console, `/ask` logs, support inbox | yes → "Research Required" |
| longtail_variations | expand mechanically from SCOS 04 §4 patterns (safe — structural) | no (always derivable) |
| beginner/expert questions | from persona interviews, support, forums | yes |
| seasonality | from the statutory calendar (knowable) + GA seasonality (Research Required) | partial |
| state_specificity | from law analysis ([06](06-law-and-compliance.md)/[07](07-state-wise-registry.md)) — **knowable now** | no |
| business_value | qualitative rubric (§3) — **assignable now** | no |
| volume/KD/CPC | external tools only — **never guess** | yes → "Research Required" |

## 2. Seasonality (knowable from the statutory/sector calendar — not fabricated)

These are **structural** (due-date driven), already encoded in the live blog drip:

| Window | Spikes for topics | Cluster ids |
| --- | --- | --- |
| Feb–Mar | year-end close, depreciation, stock, FY-lock | C112, C087, C144, year-end |
| Apr | new FY, opening balances, budget | C033, C178 |
| Jul / Oct / Jan / May | TDS 26Q quarter-ends | C134–C136 |
| Monthly (11th/20th) | GST returns | C127 |
| Sep | AGM season | C163 |
| Oct (before Q2) | compliance calendar | C158 |
| Nov | Cooperative Week / digital | C184 |
| Jun–Jul (Kharif) | KCC / crop loan | C071 |
| Audit season (state-set) | audit prep, objections | C143, C144, C153 |

> Anything beyond these structural windows = **"Research Required"** (needs GA/Search Console).

## 3. Business-value rubric (qualitative — assignable without external data)

`high` = maps to a core module + high buying-intent persona (SEC/ACC/CHR/BUY) + lead-magnet fit.
`medium` = supports a core journey or strong informational authority.
`low` = peripheral/long-tail awareness.

| Signal | + value |
| --- | --- |
| Converts to a live module ([SCOS 02 Module Index](../scos/02-knowledge-architecture.md)) | high |
| Has a natural lead magnet/calculator | + |
| Compliance/deadline (recurring demand) | + |
| State-specific (programmatic scale) | + |
| Pure-awareness, no product link | low |

## 4. Question-source inventory (where research pulls real questions — to be mined, not invented)

| Source | Yields | Status |
| --- | --- | --- |
| Google SERP (PAA, autocomplete, related) | PAA, longtail | Research Required |
| Search Console (once indexed) | real queries, impressions | Research Required |
| `/ask` assistant logs | real user questions | mine when available |
| Support / feedback inbox (live) | pain-point questions | mine (live data) |
| `/faq` + `/cookbook` + `/help` | already-captured FAQs | available now (T5) |
| Cooperative forums / dept helpdesks | field questions | Research Required |
| SME interviews (CA/auditor) | expert questions | on engagement |

## 5. State-specificity flags (knowable now — drives [07](07-state-wise-registry.md))

| Specificity | Topic areas |
| --- | --- |
| **High** | registration, byelaws, audit class/grading, returns to RCS, reserve %, dividend cap, elections, member rights, statutory registers |
| **Medium** | reserve/education funds, PT, stamp, cash limits, audit manuals |
| **Low** | double-entry, vouchers, reconciliation, ratios, inventory mechanics, software/digital |
| **None (central)** | GST, TDS, income-tax/80P, ICAI standards, MSCS Act, NABARD norms |

## 6. Representative record (showing honest placeholders)

```yaml
topic_id: C124  # GST for cooperatives
primary_search_intent: compliance + informational     # SCOS 04
related_questions: ["क्या सहकारी समिति को GST लेना ज़रूरी है?", "society GST registration limit"]
people_also_ask: Research Required        # pull from SERP
longtail_variations: ["PACS GST applicability","consumer society GST rate","dairy GST exemption"]
beginner_questions: ["GST kya hai society ke liye"]
expert_questions: ["member-to-society supply mutuality GST treatment"]   # NEV
seasonality: monthly (return cycle)        # structural
state_specificity: none (central) — but SGST registration state-handled
business_value: high                       # core, recurring, magnet exists
potential_lead_magnet: gst-checklist (LIVE)
potential_calculator: GST calculator (SMRD 09)
search_volume: Research Required
keyword_difficulty: Research Required
```

---

### Cross-references
[Topic Research Registry](03-topic-research-registry.md) · [Template Opportunities](08-template-opportunities.md) · [Tool Opportunities](09-tool-opportunities.md) · [SCOS Search Intent](../scos/04-search-intent.md) · [State-wise Registry](07-state-wise-registry.md)
