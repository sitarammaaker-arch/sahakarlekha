# D_findings - export infrastructure, generated-file QA, security (slice D)

Slice: src/lib/pdf.ts shared helpers, exportUtils.ts, src/lib/export/*, ExportCenter, EntityExportButton, print CSS. Security findings are detailed in D_security.md (D-S01..D-S11); generated-file evidence in D_visual_qa.md (VQ-01..VQ-11). Entity types: the export/PDF layer does not distinguish Cooperative vs Registered Society; header prints society.registrationNo only (pdf.ts:239). Registered Society support through this layer is UNVERIFIED.

## Export / Print / PDF

### D-01 HIGH - Devanagari renders as garbage in every PDF
Evidence: pdf.ts:24-27 (helvetica only, comment "All PDFs use English only"); fontLoader.ts getHindiFont has no consumer; render D_render_cashbook_hindi_p1.png. Scenario: Hindi society name, Hindi signatory names (society.signatories), narrations and party names print as spaced junk glyphs on statutory PDFs; contradicts RULE 7 Hindi-first. Fix: embed Noto Sans Devanagari via addFileToVFS and switch font when text contains U+0900-097F; use nameHi in the header. Test: generate with Hindi fixtures, pdftotext must return the original Devanagari.

### D-02 HIGH - Long society name clipped at both page edges
Evidence: pdf.ts:232-234, 95; D_render_cashbook_long10_p1.png. Scenario: real PACS names exceed 100 chars. Fix: splitTextToSize to page width and shift startY. Test: 150-char name, assert all text within 15 mm margins.

### D-03 MEDIUM - Fixed 28 mm amount columns wrap digits mid-number
Evidence: pdf.ts:338,385,896,948 and TB footer (pdf.ts ~455); D_render_cashbook_long10_p1.png. Fix: minCellWidth/smaller font for amount columns, or wrap=false with font shrink. Test: amount 12,34,56,789.00 must stay on one line.

### D-04 MEDIUM - fmt() prints "Rs. NaN"; negatives lack Dr/Cr
Evidence: pdf.ts:16-17; D_cashbook_nan PDF. Fix: coerce through money.ts, show 0.00 and log, use Dr/Cr or brackets. Test: fmt(NaN) never contains NaN.

### D-05 MEDIUM - Empty-dataset handling inconsistent
Evidence: addNoDataMessage used by few generators (pdf.ts:54, usage 3 incl. definition); Sale Register/Bank Book 0 rows render header-only table with totals and signatures (D_salereg_landscape_0rows PDF). Fix: guard every generator. Test: each generator with [] shows message.

### D-06 MEDIUM - Trial Balance tolerance of Re 1 and float arithmetic in pdf.ts
Evidence: pdf.ts:475 `< 1`; money.ts is not imported in pdf.ts (grep 0), totals are float reduces (pdf.ts:313-315). Violates T-02 paise-integer intent (CLAUDE.md RULE 2 spirit). Fix: compare in paise with 0 tolerance; sum via money.ts. Test: TB with 0.99 difference reports NOT balanced.

### D-07 MEDIUM - Auditor certificate pre-prints opinion and hardcodes "31st March"
Evidence: pdf.ts:199-205. Fix: draft-for-auditor wording or blank, date from FY end/asOn. EXTERNAL VALIDATION NEEDED for the prescribed wording.

### D-08 MEDIUM - Several PDFs bypass the shared header/footer
Evidence: grep of `from 'jspdf'` outside pdf.ts: BankReconciliation.tsx:236-281 (no reg no, FY, page numbers), BudgetModule.tsx, GstSummary.tsx:383,550 (GSTR-3B/GSTR-1 PDFs, no addHeader/page numbers), leadMagnets.ts, annualReview p1-p9 (page numbers but no addHeader). Fix: route through addHeader/addPageNumbers.

### D-09 MEDIUM - Print CSS does not hide app chrome; most reports have no print path
Evidence: index.css:264-290 only .no-print/.print-only; no `print` rule in src/components/layout/*; window.print appears in 9 files only (AdvanceRegister.tsx:36, WageRegister.tsx:74, WageSlip.tsx:74, CalculatorShell.tsx:193...). Per-page hacks (`body * {visibility:hidden}`) exist in 3 pages. Fix: global @media print hiding sidebar/header, @page A4, thead repeat.

### D-10 LOW - Footer advertises "Generated free with SahakarLekha" on all statutory PDFs
Evidence: pdf.ts:101. Pricing is paid-only (memory: pricing-tiers-locked), so wording is also inaccurate. Fix: make it a setting / remove from statutory documents.

### D-11 LOW - Filename collisions
Evidence: pdf.ts:44; Hindi names -> `CashBook___FY_2025-26.pdf`. Fix: shared safeFileName with transliteration and registration number suffix.

## Export

### D-12 HIGH - Export Center files are not FY/branch scoped but are labelled with the current FY
Evidence: ExportCenter.tsx:151,160-166; EntityExportButton.tsx:86; source.ts:131-149. Detailed in D-S04.

### D-13 HIGH - CSV formula injection (D-S01); D-14 HIGH - full-mode PII to viewer (D-S02)
See D_security.md.

### D-15 MEDIUM - XLSX builder throws on invalid/duplicate sheet names and oversize cells
Evidence: exportUtils.ts:112 (`name.slice(0,31)` only), D_gen_errors.txt. Fix: sanitise/dedupe/clip.

### D-16 MEDIUM - CSV/JSON exports carry no provenance
Evidence: ExportMeta README only for XLSX (exportUtils.ts:99-107, generator.ts:225-231); downloadCSV has no meta. A CSV on an auditor's desk cannot be tied to a society/FY/time. Fix: provenance header row or companion README.

### D-17 MEDIUM - Export audit coverage gap (D-S05)

## Accounting/Data
### D-18 INFORMATIONAL - Export soft-delete handling is correct
filterRows excludes isDeleted unless full/includeDeleted (generator.ts:147-153); `full` implies inclusion (documented). Report PDFs depend on callers for RULE 5 (pdf.ts has no isDeleted filtering except housing at line 1076) - UNVERIFIED per report in other slices.

## Statutory
### D-19 INFORMATIONAL - No statutory format is asserted by the export infra
Statutory conformance of individual PDFs is out of slice; nothing in src/lib/export claims it (registry `statutory` mode requires explicit columns, generator.ts:119-135). EXTERNAL VALIDATION NEEDED for any claim.

## UX
### D-20 LOW - Hindi font preload wastes a third-party request every load (D-S07).

## Missing reports
See D_gaps.md.

## Counts
HIGH 5 (D-01, D-02, D-12/D-S04 treated MEDIUM in security file, D-13, D-14), MEDIUM 11, LOW 4, INFO 2 in this file; plus D-S01..S11 (2 HIGH, 5 MEDIUM, 3 LOW, 1 INFO) and VQ-01..11 in the other fragments (overlapping).
