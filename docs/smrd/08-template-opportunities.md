# 08 — Template Opportunities

> Research map of **every downloadable template** a topic could yield. This is the *opportunity +
> research-status* layer; the SCOS-side library ([SCOS 09](../scos/09-template-library.md)) holds the
> production catalogue. SMRD records **whether the template's format/content is research-validated**.
>
> **Rule:** any template that encodes a **statutory format** (returns, registers, Form-1, certificates,
> resolutions) is `⚠️ NEV` — its layout must be validated against the prescribing authority before
> release. Generic worksheets (calculators, trackers) are low-NEV.

**Per opportunity:** template · format(s) · source topic id · format-validated? · NEV · status.
**Format codes:** XLS=Excel · PDF · DOC=Word.

---

## 1. Template-type × topic map

| Template type | Maps to topics (SCOS ids) | Format | NEV (statutory format)? |
| --- | --- | --- | --- |
| **Excel worksheet** | COA, opening balances, TB, statements, registers, ratios, EMI, depreciation, NPA/aging, stock, budget, profit-distribution | XLS | low (worksheet) / yes (statutory statement layout) |
| **PDF checklist** | audit prep, GST, inventory, year-end, statutory returns, compliance calendar | PDF | partial (calendar/returns = yes) |
| **Word document** | AGM notice/agenda, minutes, resolutions, byelaw drafts, audit-objection replies, demand notices | DOC | yes (legal wording) |
| **Register** | member, share, loan, KCC, deposit, stock, asset, meeting, nomination, statutory registers | XLS/PDF | yes (prescribed registers) |
| **Voucher format** | receipt/payment/journal/contra/compound | PDF/XLS | low |
| **Resolution** | board/general resolutions (loan, audit, dividend, byelaw) | DOC | yes |
| **Notice** | AGM/SGM notice, demand notice, recovery notice | DOC | yes |
| **Circular** | internal circulars/SOPs | DOC | low |
| **Certificate** | audit certificate, membership/share certificate, TDS 16A | PDF | yes |
| **Letter** | bank, supplier, member, department correspondence | DOC | low |

## 2. Opportunity register (priority templates + research status)

| Template | Format | Topic | Format-validated | NEV | Status |
| --- | --- | --- | --- | --- | --- |
| Standard COA (generic) | XLS | C031 | internal (T5) | yes (vs prescribed) | sourcing |
| Society-type COA packs (×12) | XLS | C031/D27 | no | yes | open |
| Opening balance template | XLS | C033 | internal | no | E2† |
| Statement formats (Trading/P&L/R&P/BS) | XLS | C050–C053 | internal | yes (statutory layout) | open |
| Report→statutory-form map | PDF | C055 | no | yes | open |
| Audit prep checklist (LIVE magnet) | PDF | C144 | internal | no | E2† |
| Audit objection reply | DOC | C148 | no | yes | open |
| Statutory returns checklist | PDF | C154 | no | yes | open |
| Statutory registers pack | XLS | C157 | no | yes | open |
| Compliance calendar (FY) | PDF | C158 | no | yes (dates) | open |
| Year-end closing checklist | PDF | C144/YE | internal | no | E2† |
| AGM kit (notice+agenda+minutes+resolutions) | DOC | C163–C168 | no | yes | open |
| Election kit | DOC/PDF | C166 | no | yes | open |
| Member application / Form-1 | DOC/PDF | C061/C065 | internal | yes | open |
| Share / nomination forms | DOC/PDF | C062/C064 | internal | yes | open |
| Loan register + demand notice | XLS/DOC | C069/C072 | internal | yes (notice) | open |
| KCC register | XLS | C071 | internal | yes | open |
| NPA / aging tracker | XLS | C073/C074 | internal | yes (norms) | open |
| Depreciation schedule | XLS | C112 | internal | yes (rates) | open |
| Stock register + valuation sheet | XLS | C085/C086 | internal | yes (method) | E2† |
| MSP / kachi-aarat registers | XLS | C088/C089 | internal | yes | open |
| GST checklist (LIVE magnet) | PDF | C124 | no | yes | open |
| TDS rate chart | PDF | C134 | no | yes | open |
| Salary register / payslip | XLS/PDF | C117 | internal | yes (statutory deductions) | open |
| Profit distribution + dividend sheet | XLS | C172/C174 | internal | yes (appropriation order) | open |
| Budget template | XLS | C178 | internal | no | E2† |
| Financial ratios sheet | XLS | C056 | internal | no (benchmarks=yes) | E2† |

> `E2†` = a working version exists in-app (T5) but the **statutory format/content still needs primary
> validation** before being offered as a downloadable authority asset.

## 3. Research questions before releasing any `⚠️ NEV` template
1. Is the layout **prescribed** by an act/rule/authority? Capture the official format + `as_of`. (→ [06](06-law-and-compliance.md))
2. Does it vary by **state** or **society type**? Produce variants, not one-size-fits-all. (→ [07](07-state-wise-registry.md)/D27)
3. **SME sign-off** on the format/wording (legal templates especially).
4. Does a **module already generate it**? Link the template to that module ([SCOS 02](../scos/02-knowledge-architecture.md)) — the download is a bridge, the app is the upgrade.
5. Language: jsPDF magnets = English (font constraint); Excel/Word may carry Hindi labels.

## 4. Template → module bridge (conversion research)
For each template, record the **module that auto-produces it** (most already exist). The research note
captures: "manual template → do it in `<module>`" so the download funnels to registration ([SCOS 08](../scos/08-lead-engine.md)).

---

### Cross-references
[Tool Opportunities](09-tool-opportunities.md) · [Law & Compliance](06-law-and-compliance.md) · [Content Readiness](10-content-readiness.md) · [SCOS Template Library](../scos/09-template-library.md) · [SCOS Lead Engine](../scos/08-lead-engine.md)
