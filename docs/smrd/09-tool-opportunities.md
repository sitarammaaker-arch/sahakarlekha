# 09 — Tool Opportunities

> Research map of **every software tool** a topic could yield — beyond calculators: generators,
> wizards, checkers, validators, automations, import/export. The SCOS-side production list is
> [SCOS 10 — Calculators](../scos/10-calculators.md); SMRD records whether the **underlying logic/formula
> is research-validated** and which already exist as module logic (reuse, don't rebuild).
>
> **Rule:** any tool that outputs a **statutory/tax number** (GST, TDS, depreciation rate, NPA class,
> reserve %, dividend cap) is `⚠️ NEV` — its formula/rates must be validated and rates kept as dated
> inputs, never hard-coded as fact ([01](01-research-methodology.md)/[05](05-accounting-research.md)).

**Tool types:** Calculator · Generator · Wizard · Checker · Validation Tool · Automation · Import · Export.
**Per opportunity:** tool · type · topic id · logic source · exists in-app? · NEV · status.

---

## 1. Tool-type catalogue

| Type | What it does | Example opportunities | NEV |
| --- | --- | --- | --- |
| **Calculator** | compute a value | interest/EMI, depreciation, GST, TDS, NPA, dividend, ratios, FD/RD, stock valuation | high (statutory) |
| **Generator** | produce a document/format | AGM notice, minutes, resolution, demand notice, voucher, certificate, COA pack | yes (legal wording) |
| **Wizard** | guided multi-step setup | society setup, opening-balance entry, year-end close, GST-registration prep | partial |
| **Checker** | flag issues | Dr=Cr checker, BRS difference finder, TB-mismatch diagnoser, GSTIN/HSN format check | low–med |
| **Validation Tool** | conformance check | compliance-readiness, audit-readiness, register-completeness, return-readiness | yes |
| **Automation** | run a process | recurring entries, interest posting, depreciation run, reminder/notice dispatch | med |
| **Import Tool** | bring data in | universal importer, Tally/Excel migration, member/loan bulk import | low |
| **Export Tool** | push data out | statutory return export, schedule export, report→form export, e-filing pack | yes (format) |

## 2. Opportunity register (priority tools + research status)

| Tool | Type | Topic | Logic source | In-app? | NEV | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Interest / EMI calculator | Calc | C070/C077 | `/loan-interest` | yes ✅ | yes (method) | E2† |
| Depreciation (SLM/WDV) | Calc | C112 | `/depreciation-schedule` | yes ✅ | yes (rates) | open |
| GST calculator | Calc | C124 | `/gst-summary` | yes ✅ | yes (rates) | open |
| TDS calculator | Calc | C134 | `/tds-register` | yes ✅ | yes (sections) | open |
| NPA classifier | Calc/Checker | C073 | `/aging-analysis` | yes ✅ | yes (norms) | open |
| Dividend / appropriation | Calc | C172/C174 | `/profit-distribution` | yes ✅ | yes (order/cap) | open |
| Reserve fund (%) | Calc | C173 | `/reserve-fund` | yes ✅ | yes (statutory %) | open |
| Financial ratios | Calc | C056 | reports | partial | benchmarks=yes | E2† |
| Stock valuation (FIFO/Wt-avg) | Calc | C086 | `/stock-valuation` | yes ✅ | yes (method/AS) | E2† |
| Closing stock | Calc | C087 | `/closing-stock-report` | yes ✅ | no | E2† |
| FD/RD maturity | Calc | C080/C081 | — | partial | yes | open |
| KCC drawing power | Calc/Wizard | C071 | `/kcc-loan` | yes ✅ | yes (scale-of-finance) | open |
| AGM notice/minutes generator | Generator | C163–C165 | `/meeting-register` | partial | yes | open |
| Resolution generator | Generator | C168 | — | no | yes | open |
| Demand/recovery notice | Generator | C072 | `/recoverables` | partial | yes | open |
| COA pack generator (by type) | Generator | C031/D27 | `/ledger-heads` | partial | yes | open |
| Society setup wizard | Wizard | C220 | `/society-setup` | yes ✅ | partial | E2† |
| Opening-balance wizard | Wizard | C033 | `/opening-balances` | yes ✅ | no | E2† |
| Year-end close wizard | Wizard | YE/C144 | year-end + FY-lock | yes ✅ | partial | E2† |
| Dr=Cr / TB-mismatch checker | Checker | C049/C214 | `/trial-balance` | yes ✅ | no | E2† |
| BRS difference finder | Checker | C107 | `/bank-reconciliation` | yes ✅ | no | E2† |
| GSTIN / HSN format checker | Checker | C090/C124 | `/hsn-master` | partial | low | open |
| Audit-readiness validator | Validation | C144 | audit modules | partial | yes | open |
| Compliance-readiness validator | Validation | C154/C158 | — | no | yes | open |
| Register-completeness validator | Validation | C157 | registers | partial | yes | open |
| Interest posting / depreciation run | Automation | C070/C112 | modules | yes ✅ | yes | open |
| Reminder / notice dispatch | Automation | C072/C158 | — | no | partial | open |
| Universal importer (Tally/Excel) | Import | C191/C195 | `/universal-importer` | yes ✅ | no | E2† |
| Member/loan bulk import | Import | C061/C069 | `/universal-importer` | yes ✅ | no | E2† |
| Statutory return / form export | Export | C055/C154 | reports + NABARD/federation | partial | yes (format) | open |
| Report→form export pack | Export | C055 | reports | partial | yes | open |

> `E2†` = working logic already runs in the named module (T5) → **wrap as a public tool** ([SCOS 10 §Governance](../scos/10-calculators.md));
> only the *statutory rate/format* part needs validation (E3).

## 3. Research questions before shipping any `⚠️ NEV` tool
1. What is the **authoritative formula/rate/threshold**, and its `as_of`? (→ [05](05-accounting-research.md)/[06](06-law-and-compliance.md))
2. Does it vary by **state / society type / year**? Make those **inputs**, not constants.
3. Does the **in-app module already compute it**? Reuse that logic; expose a no-login version that links to the module.
4. **SME sign-off** on formula/rates before any number is presented as authoritative.
5. Show the **formula transparently** + a "rates change — verify" disclaimer where dated.

## 4. Reuse signal (important)
Most high-value calculators (interest, depreciation, GST, TDS, NPA, dividend, reserve, stock, ratios)
**already exist as module logic** ✅. The research task is *validation of rates/methods*, not building
math from scratch. This is the cheapest, highest-authority tool backlog.

---

### Cross-references
[Template Opportunities](08-template-opportunities.md) · [Accounting Research](05-accounting-research.md) · [Content Readiness](10-content-readiness.md) · [SCOS Calculators](../scos/10-calculators.md) · [SCOS Module Index](../scos/02-knowledge-architecture.md)
