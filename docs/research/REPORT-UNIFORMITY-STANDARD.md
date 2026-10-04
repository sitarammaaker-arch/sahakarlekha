# Report Uniformity Standard — DRAFT for approval (2026-10-04)

Scope: every report the portal **generates or downloads** (PDF, Excel, CSV, JSON, browser print).
Status: **research + proposal only. Nothing in this file has been implemented.**

## 1. What the research can and cannot establish
| Question | Finding | Source |
|---|---|---|
| Is there a law that fixes PDF layout (margins, fonts, orientation)? | **No.** Nothing in the repo's statutory docs, and nothing found on the web, prescribes page layout for a society's PDFs. Layout rules below are **product standards + accepted professional practice**, not statute. | repo `docs/research/TASK2.*`, `AUDIT_NCDC_Compliance_Report.md`; web search (below) |
| What *is* prescribed? | NCDC's Common Accounting System prescribes a **fixed set of standard statements** (Trial Balance Annexure I, Trading A/c II, P&L/I&E III, Balance Sheet IV, activity-wise Trading V, Receipts & Payments VII) and double-entry integrity. Presentation (two-sided T-format) follows those annexures. Exact per-state forms remain **EXTERNAL VALIDATION NEEDED** (the repo marks them "[NV per state]"). | `AUDIT_NCDC_Compliance_Report.md:4,25-99`; NCDC [Accounts & Book Keeping – Primary Level Cooperatives](https://www.ncdc.in/documents/other/Accounts-and-Book-Keeping-in-Primary-Level-Cooperatives10920.pdf) |
| General practice for financial reports | Uniform formatting, fonts and section order; title + header, body, signature, issuance date; a complete audit trail behind every figure. | [Suralink – audit report structure](https://www.suralink.com/blog/audit-report-example), [KPMG – presentation handbook](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2024/handbook-financial-statement-presentation.pdf) (US-oriented — used for general practice only) |

So the honest conclusion: **uniformity here is a product-quality and audit-defensibility rule, enforced by us.** Where a rule touches a statutory statement's content (e.g. "Provisional" label, signatory titles) it needs a CA's confirmation.

## 2. What the code does today (verified 2026-10-04 on main + pending PRs)
| Dimension | Today | Evidence |
|---|---|---|
| PDF producers | **31** generators in `src/lib/pdf.ts` + **~19** more `new jsPDF` in pages/libs = ~50 | grep `new jsPDF` |
| Orientation | Mixed with no rule: statements landscape, but Cash Book / Bank Book / Ledger / Passbook portrait; registers landscape; Audit Schedules, GST summary, Form 16A, Election, Federation, NABARD portrait | `pdf.ts` generator list |
| Header (`addHeader`) | 26 in pdf.ts; **4 page-level PDFs have none** (Bank Reconciliation, GST Summary GSTR-1/3B, Form 1, Multi-society consolidation) | grep |
| Page numbers / footer | **Missing on Bank Reconciliation and GST Summary** (no header, no "Page x of y") | grep |
| Filenames | **Three conventions**: `pdfFileName` → `TrialBalance_<Society>_FY_2026-27.pdf`; exports → `trial-balance-2026-27.csv` (no society, no as-on); bespoke → `GSTR3B_<gstin>_<yyyy-mm>.pdf`, `BRS_<bank>_<date>.pdf`, `ConsolidatedFinancialStatement.pdf`, `SahakarLekha-Sample-Report.pdf`, `form24Q_…csv` | grep `doc.save`, `downloadCSV` |
| Excel/CSV provenance | **46 Excel + 65 CSV calls, 0 pass `ExportMeta`** → no society / FY / generated-by / generated-at / filters in the file | grep |
| Print | Only the 9 statements/books got a Print button (#685); registers, GST, TDS, payroll have none | grep `window.print` |
| Dates | Mixed: `DD/MM/YYYY` (`fmtDate`), `04 Oct 2026` (header), hard-coded "As at 31st March 20XX" on the Balance Sheet regardless of the chosen as-on date | `dateUtils.ts`, `pdf.ts` |
| Amounts | `Rs. 1,23,456.00` (PDF), `₹` + `hi-IN` (screens), bare numbers in the new TB, raw `toFixed(2)` strings in some GST/CSV | grep |
| Language | PDF **labels English only**; Hindi *data* via the browser-canvas path (#547); Hindi font never embedded | `pdf.ts` `setupFont` |
| Footer | **"Generated free with SahakarLekha · sahakarlekha.com" on every PDF, including certified statutory statements**; "Confidential — For authorized use of X only" | `addPageNumbers` |
| Report ID | `SL-BS-20261004-AB12` — 4 **random** characters; cannot be verified or reproduced | `generateReportId` |
| Signatories | `Accountant / Secretary-Manager / President` on some, `Statutory Auditor / Secretary / President` on others, none on several | `addSignatureBlock` call sites |
| Status of the data | Nothing tells a reader whether the FY is open/closed or figures are provisional/audited | — |

## 3. Proposed universal rules (R1–R16)
Each rule says **what**, **why**, and **how it is enforced**. `[S]` = touches statutory content → needs CA confirmation.

### A. Identity & traceability (every output)
- **R1 Standard identity block.** Society name, registration no., address, GSTIN/PAN where applicable, **financial year**, **report title**, **period or "as on" date (always derived from the actual filter, never hard-coded)**, prepared-on date+time, prepared-by user. *Why:* an unlabelled file is not evidence. *Enforce:* single `reportHeader()`; CI fails if a generator bypasses it.
- **R2 Verifiable Report ID.** Replace the random suffix with `SL-<TYPE>-<society code>-<yyyymmdd>-<8-char content hash>`; print it on every page footer; record it (type, society, filters, hash, user, time) in the export audit trail. *Why:* two prints of the same data match; an altered print does not. *Enforce:* one `makeReportId()`.
- **R3 Data-status line `[S]`.** "Provisional — FY open" / "FY locked" / "Audited on <date>" under the title, plus "Includes N pending vouchers" if any approval-pending data is excluded. *Why:* auditors must know what they hold.
- **R4 Same figures everywhere.** Screen, PDF, Excel, CSV, print use the *same* data function (no per-format recomputation) — RULE 2 already, extended to exports. *Enforce:* parity tests (extend `test:statement-selection`).

### B. Page layout (PDF + print)
- **R5 Orientation by content, not by author.** Two-sided statements (BS, TB, R&P, I&E, Trading) and anything with >6 numeric columns → **landscape A4**; single-column ledgers/books/notices/certificates → **portrait A4**; vouchers/slips keep their small format. A table in `REPORT_SPECS` declares it; generators cannot override.
- **R6 One table family.** T-format statements are **one zipped table** (header repeats, totals once) — done for BS/TB/R&P; apply to I&E and Trading.
- **R7 Margins/typography.** 15 mm margins; body 7.5–8 pt, head 8 pt bold; numeric columns right-aligned with right-aligned headings; no amount ever wraps; tables never split a row; header row repeats on every page.
- **R8 Footer on every page:** `Page x of y` + Report ID; confidentiality line. Signature block **only on the last page**, never orphaned (moves with the last rows).
- **R9 Brand footer `[decision]`.** Keep "Generated free with SahakarLekha" on free/trial plans; **remove it on paid plans' statutory statements** (certified statements should not carry marketing). Needs your decision.

### C. Numbers, dates, language
- **R10 Amounts.** Indian grouping (`1,23,456.00`), two decimals, `Rs.` in PDF titles/columns (helvetica has no ₹ glyph; ₹ only after a font is embedded), negatives in parentheses on statements and with `-` in Excel/CSV, `Dr`/`Cr` suffix wherever a balance has a side, zero as `-` in statements and `0.00` in registers/exports, **no rounding in exports** (paise exact — T-02), rounding only in display and always to paise.
- **R11 Dates.** Display `DD/MM/YYYY`; export `YYYY-MM-DD` (sortable/machine-safe); "as at"/"for the year ended" text built from the real dates. Time zone IST.
- **R12 Language.** English statutory labels in PDFs **always**; Hindi labels as a second line when the user's language is Hindi *once a Devanagari font is embedded* (today labels are English-only). Hindi *data* keeps the canvas path.

### D. Files & exports
- **R13 One filename scheme.** `<Type>_<SocietyShort>_<FY>_<scope>_<yyyymmdd-hhmm>.<ext>` — e.g. `TrialBalance_Kapil-Nutri_FY2026-27_asat-31Mar2027_20261004-0841.pdf`; ASCII only, no spaces, length-capped, the **same** stem for PDF/XLSX/CSV of the same report; sanitised (no path chars).
- **R14 Excel/CSV provenance.** Every Excel gets the `README` sheet (society, reg no, FY, filters, generated-by/at, Report ID, mode) via `ExportMeta`; every CSV gets a `# ` metadata comment row or a sibling `.meta.json`; formulas neutralised (done), UTF-8 BOM (done), headers = same column names as the PDF.
- **R15 Coverage matrix.** Statements & books: **Print + PDF + Excel + CSV**; registers: **Print + PDF + Excel + CSV**; statutory filings (GSTR, 24Q/26Q): the portal's native file + PDF working copy; vouchers/slips: PDF only. Every report page shows the same four buttons in the same place.

### E. Governance
- **R16 Enforce it, don't hope.** One `createReportDoc(spec)` factory + one `saveReport()`; CI guard test fails on any `new jsPDF` outside the factory, any `doc.save` outside `saveReport`, any `downloadExcel/CSV` without `ExportMeta`, and any report missing from `REPORT_SPECS`. A visual regression harness (the esbuild + PyMuPDF renderer I used for BS/TB/R&P) renders each spec with 0/1/100/1000 rows and checks the rules automatically.

## 4. Rollout (each step independently shippable; one batched PR per step per your Vercel rule)
| Step | What | Risk |
|---|---|---|
| 1 | `REPORT_SPECS` + `createReportDoc` + `saveReport` + `makeReportId` + filename builder + guard test (no behaviour change yet) | low |
| 2 | Move the ~31 `pdf.ts` generators onto it (headers/footers/filenames/orientation per R1,R5,R7,R8,R13) | medium — many files, visual QA per generator |
| 3 | Bring the ~19 page-level PDFs in (adds missing headers/page numbers to BRS and GST) | medium |
| 4 | `ExportMeta` on all 46 Excel + 65 CSV calls; unified filenames; coverage matrix (R14,R15) | low-medium |
| 5 | Print buttons on registers/GST/TDS/payroll (R15) | low |
| 6 | Statutory content items (R3 status line, signatory titles, brand footer) after CA/founder sign-off | needs your decision |
| 7 | Devanagari font embedding for bilingual labels (R12) | medium-high (font licence/size, every generator) |

## 5. Decisions I need from you before implementing
1. **Brand footer on paid plans' statutory statements** — remove? (R9)
2. **Filename scheme** — approve R13 (society short name + FY + scope + timestamp)?
3. **Report ID** — approve content-hash IDs recorded in the audit trail (R2)?
4. **Orientation matrix** — approve landscape for I&E/Trading/registers/GST/TDS and portrait for Cash Book/Bank Book/Ledger (R5)? (A Cash Book with narration columns is wide — I would also accept landscape for books.)
5. **Data-status line** ("Provisional — FY open") — approve wording; CA to confirm (R3)
6. **Hindi labels in PDFs** — in scope now or later (needs font embedding)? (R12)
7. **Amount style** — keep `Rs.` in PDFs (safe) or embed a font and use `₹`? (R10)
8. **Order** — steps 1→4 first (foundation + exports), then 2/3 (visual rework), or visual rework first?

Everything marked `[S]` is a presentation choice for a statutory document and is **EXTERNAL VALIDATION NEEDED** with a CA; I am not asserting any of it is legally required.

---

## 6. Decisions (founder, 2026-10-04) and implementation status
Approved as recommended: 1 remove the brand footer on paid plans' statutory statements · 2 R13 file-name scheme · 3 content-hash Report ID · 4 orientation matrix · 5 status line only after CA confirms its wording · 6 Hindi labels later · 7 keep `Rs.` · 8 foundation + exports first. Later (2026-10-04): "yes to everything that was left — skip anything you judge risky".

| Rule | Status |
|---|---|
| R13 one file-name scheme | **DONE** — `src/lib/exportNaming.ts`; every PDF, Excel and CSV |
| R14 Excel provenance (README sheet, local-time stamp) | **DONE** — `ExportContextBinder` |
| R16 enforcement | **DONE as a ratchet** — `test:report-uniformity-guard`: no new bypass of the shared name/header/footer/Report ID helpers; allowlists can only shrink |
| R2 content-hash Report ID | **DONE** — `SL-<TYPE>-<society tag>-<yyyymmdd>-<10-hex fingerprint>` printed in the footer of every page; same report + same day = same ID, any changed figure = different ID (a fingerprint, not a signature) |
| R2 audit trail | **DONE, non-blocking** — every PDF with a Report ID writes `audit_log` (`entity 'report'`, action `create`: code, title, page count — no figures, no names). It uses the NON-blocking contract on purpose (PDF generation is synchronous; an audit outage must not stop a society printing its statements). **Not done:** a *blocking* custody trail for PDFs that contain member personal data (Form 1, registers) — that would make PDF generation asynchronous and is a separate decision |
| R5 orientation | **DONE (pinned)** — the audit found the generators already match the matrix; `test:pdf-orientation` now fails if one flips or a new `generate*PDF` is not classified. **Deliberate deviation:** the GST Summary report stays portrait (moving it to landscape needs a per-table layout check) |
| R8 footer (Page x of y + Report ID on every page) | **DONE** |
| R8 signatures never alone on an anonymous page | **PARTLY** — a signature block that has to move to its own page now carries the report title ("Trial Balance — certificate & signatures (continued)"). Keeping the last table rows with the signatures was **not** done: it needs a bottom reserve on every page of every table and risks reshaping all reports |
| R9 brand footer on paying plans | **DONE** (by plan name; Enterprise included) |
| R7 margins / typography | **SKIPPED as risky** — the shared header uses 15 mm, plain tables 14 mm (a 1 mm difference); a global margin change could overflow tables with fixed column widths in ~30 generators |
| R1 header content per report | **PARTLY** — every report now shares one identity block; subtitle derivation (e.g. the Balance Sheet's "As at 31st March") already comes from the financial year |
| R3 status line ("Provisional — FY open") | **WAITING on the CA's wording** — not invented |
| R12 Hindi labels | **LATER** — needs a Devanagari font embedded in every generator |

**Deliberate deviations from the draft**
- **CSV carries no in-file metadata** (accountants import CSVs elsewhere); the standard file name carries the identity, Excel carries the README sheet.
- **JSON is untouched** (statutory GSTR / e-Way Bill files must stay byte-exact).
- **Per-document PDFs** (invoice, voucher, salary slip, purchase record) keep document-number names — they are documents, not reports.
