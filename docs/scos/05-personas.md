# 05 — Persona Engine

> Who we write for. Every cluster in [03](03-topic-registry.md) carries a **Target User** code that
> resolves to a persona here. Persona drives tone, depth, language, surface, and CTA.

**Codes:** SEC · ACC · AUD · CHR · MGR · MEM · EMP · BUY (defined below).
All personas are **Hindi-first**; English is fallback. Knowledge level sets reading depth.

---

## P1 · Secretary (सचिव) — `SEC`  ★ primary
- **Daily work:** runs the society day-to-day; member admissions, meetings, filings, coordinates with auditor & RCS.
- **Problems:** wears every hat; not a trained accountant; fears audit objections & missed deadlines.
- **Goals:** clean books, smooth audit, compliant filings, member trust.
- **Pain points:** jargon, changing rules, manual registers, "लोकल में सेव हुआ, cloud में नहीं" data-loss fear.
- **Search behaviour:** Hindi/Hinglish, task + compliance queries ("AGM notice format", "audit ke liye kya chahiye").
- **Knowledge level:** low-medium accounting, high operational.
- **Buying intent:** HIGH — decision influencer/maker for software.
- **Software usage:** society setup, members, vouchers, reports, returns.
- **Best surfaces:** `/help`, `/guide`, compliance blog, checklists. **Magnets:** audit/GST/compliance.

## P2 · Accountant (लेखाकार) — `ACC`  ★ primary
- **Daily work:** vouchers, ledgers, reconciliation, final accounts, GST/TDS, payroll.
- **Problems:** sector-specific treatments (KCC, MSP, dairy), TB/BS not tallying, migration from Tally/registers.
- **Goals:** accurate books, fast close, correct tax, no rework.
- **Pain points:** ambiguous cooperative treatments, error-hunting, repetitive entry.
- **Search behaviour:** specific "how to record X", "Y formula", "Z not matching".
- **Knowledge level:** medium-high accounting.
- **Buying intent:** medium — power user, recommends tool.
- **Software usage:** deep — all transaction & report modules, importer, calculators.
- **Best surfaces:** `/cookbook`, `/guide` deep chapters, calculators, troubleshooting. **Magnets:** templates, COA packs.

## P3 · Auditor (अंकेक्षक) — `AUD`
- **Daily work:** statutory/internal/concurrent audit; objections; classification; certificates.
- **Problems:** incomplete records, weak audit trail, non-standard COA, NPA mis-classification.
- **Goals:** reliable trail, tie-outs, defensible grading.
- **Pain points:** societies unprepared; manual schedules.
- **Search behaviour:** authority-seeking — acts, rules, standards, "audit objection for X".
- **Knowledge level:** high accounting + legal.
- **Buying intent:** low direct, HIGH influence (recommends to many societies).
- **Software usage:** audit register/schedules/certificate, reports, trail.
- **Best surfaces:** `/guide` statutory chapters, authority-cited articles, audit templates. **Magnets:** audit checklist, schedules.

## P4 · Chairman / Board (अध्यक्ष / संचालक) — `CHR`
- **Daily work:** governance, strategy, approvals, AGM, represents society.
- **Problems:** needs the *summary* not the ledger; accountability to members & regulators.
- **Goals:** healthy society, clean audit grade, growth, transparency.
- **Pain points:** can't read raw accounts; relies on staff.
- **Search behaviour:** outcome-level ("how to read balance sheet", "dividend rules", "why go digital").
- **Knowledge level:** low accounting, high governance.
- **Buying intent:** HIGH — budget authority.
- **Software usage:** dashboard, reports, profit distribution, board module.
- **Best surfaces:** `/blog` thought-leadership, "read reports" guides, software landing. **Magnets:** digital ROI, comparison.

## P5 · Manager / CEO (प्रबंधक) — `MGR`
- **Daily work:** operations, recovery, deposits, budgets, MIS, staff.
- **Problems:** NPA, working capital, performance visibility, multi-branch.
- **Goals:** recovery up, costs down, data-driven decisions.
- **Search behaviour:** management/finance ("recovery strategy", "budget vs actual", "KPI").
- **Knowledge level:** medium-high finance/management.
- **Buying intent:** HIGH.
- **Software usage:** dashboard, aging, budget, consolidation, reports.
- **Best surfaces:** management clusters (D20), calculators, case studies. **Magnets:** budget template, ratio sheet.

## P6 · Member (सदस्य) — `MEM`
- **Daily work:** uses society services (loan/deposit/supply); attends AGM.
- **Problems:** understanding rights, dividend, loan terms, transparency.
- **Goals:** fair treatment, clear info, returns.
- **Search behaviour:** rights/benefit queries.
- **Knowledge level:** low.
- **Buying intent:** none (but advocates digital/transparency).
- **Best surfaces:** explainer blog, rights cards, FAQ. **Magnets:** rights leaflet.

## P7 · Employee / Data-entry (कर्मचारी) — `EMP`
- **Daily work:** voucher entry, receipts, day-to-day operation of the app.
- **Problems:** which voucher, correct narration, fixing entry mistakes.
- **Goals:** enter fast & right, no rework.
- **Search behaviour:** "kaise kare" task queries.
- **Knowledge level:** low-medium.
- **Buying intent:** none (daily user — adoption driver).
- **Software usage:** vouchers, cash/bank book, registers.
- **Best surfaces:** `/help`, `/cookbook`, quick-reference cards, videos.

## P8 · Software Buyer / Evaluator — `BUY`
- **Daily work:** evaluating accounting solutions for a society/federation/department.
- **Problems:** generic tools don't fit cooperatives; Hindi support; price; migration.
- **Goals:** right-fit, affordable (free), compliant, supported tool.
- **Search behaviour:** commercial ("best accounting software for PACS", "{state} cooperative software").
- **Knowledge level:** varies.
- **Buying intent:** VERY HIGH.
- **Best surfaces:** `/software/:type`, `/cooperative-software/:state`, comparison/"vs" clusters, pricing. **Magnets:** demo, comparison sheet.

---

## Persona → content matrix (who owns which pillar)

| Pillar (from [02](02-knowledge-architecture.md)) | Primary | Secondary |
| --- | --- | --- |
| Cooperative foundations | MEM, SEC | CHR |
| Accounting | ACC | EMP, AUD |
| Audit | AUD | SEC, ACC |
| Taxation | ACC | AUD, SEC |
| Compliance | SEC | AUD, CHR |
| Management | MGR | CHR |
| Governance | CHR, SEC | MEM |
| Technology / Digital / AI | MGR, BUY | CHR, SEC |
| Templates / Tools / Downloads | ACC | SEC, AUD |
| Case studies / Training | EMP, ACC | SEC |
| Help Center | EMP, SEC | ACC |

> **Writing rule:** open each asset addressing its primary persona's *job-to-be-done* in one line,
> then deliver. Mismatched depth (e.g. ledger-level detail for CHR) is a defect in QA ([11](11-content-engine.md)).

---

### Cross-references
[Topic Registry](03-topic-registry.md) · [Search Intent](04-search-intent.md) · [Lead Engine](08-lead-engine.md) · [Article Blueprint](12-article-blueprint.md)
