# Topic link map: depreciation · loan interest · vouchers · audit · GST/TDS

> 2026-10-03. Built from the content registries on `main`: `src/content/blog/index.ts`, `scripts/guide-manifest.json`,
> `docs/kpp/wave-1-active` (glossary), `src/content/calculators/index.ts`, `src/content/help`, `src/content/cookbook`.
> **Rule:** one page owns each search intent. Other pages on the same topic serve a *different* intent and link to the
> owner instead of repeating it. No new content is created by this map. Gaps are listed, not filled.

**Intent key:**
- **K** = what is it (definition)
- **E** = explain / understand (the main explanatory page)
- **H** = how to do it in SahakarLekha (task)
- **C** = calculate
- **J** = journal entry (Dr/Cr)
- **L** = learn in sequence (course chapter)
- **R** = checklist / reference

## 1. Depreciation (मूल्यह्रास)
| Page | Intent | Role |
|---|---|---|
| **/blog/depreciation-explained** | **E** | **Main explanatory page**: what depreciation is, SLM vs WDV, why it matters for a society |
| /glossary/depreciation | K | one-paragraph definition → links to the blog |
| /guide/depreciation | L | course chapter: recording it in the app, schedule, year end |
| /tools/depreciation-calculator | C | compute SLM/WDV at the user's own rate (no statutory rate asserted) |
| /cookbook/depreciation | J | the Dr Depreciation / Cr Asset (or Fund) entry |

**Gaps:** no help task ("depreciation schedule कैसे बनाएँ"). The `/depreciation-schedule` module is private, so the calculator links it as a product module only.

## 2. Loan & interest (ऋण व ब्याज)
| Page | Intent | Role |
|---|---|---|
| **/blog/loan-and-interest-accounting** | **E** | **Main explanatory page**: member loans, interest accrual and receipt, recovery |
| /blog/kcc-crop-loan-accounting | E (narrow) | KCC / crop-loan specific; links up to the main page, does not repeat it |
| /tools/simple-interest-calculator · /tools/compound-interest-calculator · /tools/loan-emi-calculator | C | one calculation each |
| /cookbook/loan-disbursed · loan-interest-received · loan-recovery · loan-write-off · bad-debt-recovery | J | one entry each |
| /help/loan-entry | H | doing it in the app |

**Gaps:**
- There is no glossary term for loan, interest or EMI, and no guide chapter on loans. Writing a KI needs a source (statutory-values rule). Until then the calculators link the closest active terms (`deposit`, `credit-society`).
- `/blog/loan-recovery-before-year-end` is scheduled for 2026-12-15. It owns the *year-end recovery* intent; keep it from re-explaining interest.

## 3. Vouchers (वाउचर)
| Page | Intent | Role |
|---|---|---|
| **/blog/what-is-voucher-types-uses-accounting-entry** (publishes 2026-10-06) | **E** | **Main explanatory page** for "वाउचर क्या है / प्रकार". Until it goes live, /guide/voucher-types serves E. |
| /glossary/voucher (+ receipt-voucher, payment-voucher, narration, voucher-approval) | K | definitions only |
| /guide/voucher-types | L | course chapter (the sequence: types → entry → approval) |
| /guide/voucher-entry-quick-reference · /glossary/voucher-quick-reference | R | one-page cheat sheet |
| /blog/voucher-entry-guide | H/E (procedural) | **how to enter** vouchers correctly: the procedural intent, not "what is" |
| /blog/voucher-narration-and-documents | E (narrow) | narration + supporting documents |
| /help/first-voucher · /glossary/first-voucher-task | H | first voucher in the app |

**Risk (cannibalisation):** the scheduled what-is-voucher post and /guide/voucher-types target the same "क्या है / प्रकार" query.
- **Keep the guide chapter as course content.** Link it to the blog for the definition-and-types explanation, and link the blog to the guide for "next: entering it".
- Do not add a third "types of vouchers" page.

## 4. Audit (ऑडिट)
| Page | Intent | Role |
|---|---|---|
| **/blog/how-cooperative-society-audit-works** | **E** | **Main explanatory page**: who audits, process, timeline |
| /blog/audit-preparation-checklist | R | the checklist (what to keep ready) |
| /guide/audit-preparation | L | course chapter (preparing books in the app) |
| /blog/cooperative-audit-classification | E (narrow) | audit grading / classification only |
| /blog/cm-pacs-accounting-tax-audit-guide | E (narrow) | CM-PACS (Haryana-only) specific |
| /blog/e-pacs-haryana-erp-day-end-audit-explained | E (narrow) | e-PACS day-end audit |
| /help/audit-report | H | app report |
| /cookbook/audit-fee | J | the audit-fee entry |

**Gaps:**
- There is no glossary term "audit" (the most-linked missing term in L8).
- Scheduled posts (secretary-work…audit, 10-05; consumer-store…audit-prep, 10-08) must link to the main page rather than re-explain the audit process.

## 5. GST / TDS
| Page | Intent | Role |
|---|---|---|
| **/blog/gst-for-cooperatives** | **E** | **Main explanatory page: GST** |
| **/blog/tds-and-26q-for-societies** | **E** | **Main explanatory page: TDS / 26Q** |
| /glossary/gst · /glossary/tds | K | definitions (concept only, no rates) |
| /guide/gst-management · /guide/tds-and-26q | L | course chapters (app workflow) |
| /tools/gst-calculator · /tools/tds-calculator | C | the user enters the rate. Statutory TDS values live only in the sourced catalog (`src/lib/rules/tax.ts`). |
| /help/gst-return · /help/tds-deduct | H | app tasks |
| /cookbook/gst-payment · /cookbook/tds-deposit | J | entries |
| /blog/quarterly-compliance-calendar (scheduled 10-13) | R | due-date calendar. Any date it states needs a source. |

## Linking rules applied in this change
- **Every calculator now links to:**
  - its course chapter (new `relatedGuide`)
  - its main explanatory article
  - active glossary terms
  - help tasks
  - the product module
- These are not done here: blog ↔ guide edges (`src/content/relatedContent.ts`) and the scheduled posts' links are content edits for their authors. This map is the reference for them.
