# Report Visual / Print QA

Evidence files are in `REPORT_AUDIT_EVIDENCE/` (D_*.pdf, D_render_*.png). Only Cash Book, Bank Book, Trial Balance and Sale Register were rendered; the other generators are UNVERIFIED visually.


---

## Generated-output QA (actual PDFs rendered — slice D)


## Method
- Script: `C:\Users\yashm\AppData\Local\Temp\claude\D--Website-sahakarlekha\86a11b7f-6473-43e2-a22f-573158229341\scratchpad\gen.entry.ts`, bundled with esbuild (`--alias:@=./src`, jsPDF node build via a small shim) and run under Node 24. It imports the REAL `src/lib/pdf.ts` and `src/lib/exportUtils.ts`; `jsPDF.save` was overridden to write into `REPORT_AUDIT_EVIDENCE/`.
- Inspection: `pdftotext -layout` (found at /mingw64/bin), PyMuPDF page renders (PNG, 70 dpi), openpyxl for XLSX cell types, page counts from jsPDF. No Windows environment problem prevented rendering; `pdftoppm` is absent but PyMuPDF replaced it.
- Fixtures: 150-char society name; Hindi society name and Hindi signatory names; Hindi narrations/party names; 0/1/10/100/1200 rows; amounts 0, -1234.50, 0.005, 1.005, 99,99,99,99,999.99, 1e15, NaN; empty datasets; landscape registers.
- Not covered (generators that need richer fixtures): the other ~25 generators in pdf.ts (Balance Sheet, I&E, R&P, Trading, Day Book, Loan/Asset/Share registers, invoices, vouchers). Only Cash Book, Bank Book, Trial Balance and Sale Register were actually rendered. Defects in the shared helpers apply to all of them; per-report defects in the others are UNVERIFIED.

## Evidence files (REPORT_AUDIT_EVIDENCE/)
- PDFs: `D_cashbook_long_{0,1,10,100,1200}rows__*.pdf` (pages 1,1,1,6,67), `D_trialbalance_long_{0,1,10,100,1200}rows__*.pdf` (1,1,1,5,58), `D_cashbook_hindi_10rows__CashBook___FY_2025-26.pdf`, `D_cashbook_short_10rows__*`, `D_bankbook_empty__*`, `D_salereg_landscape_{0,100}rows__*` (1,5 pages), `D_cashbook_nan__*`.
- Renders: `D_render_cashbook_long10_p1.png`, `D_render_cashbook_hindi_p1.png`, `D_render_tb_long100_last.png`, `D_render_salereg_land100_p1.png`.
- CSV/XLSX: `D_csv_injection_sample.csv`, `D_xlsx_sheetname_and_injection_sample.xlsx`, `D_xlsx_1200rows.xlsx`, `D_gen_errors.txt` (library exceptions captured).

## Real defects observed
| ID | Severity | Defect | Evidence |
|---|---|---|---|
| VQ-01 | HIGH | Devanagari text is garbled (mojibake-like spaced glyphs) everywhere in PDFs: Hindi society name in header, Hindi narrations, Hindi party names, Hindi signatory names, footer. `setupFont` always returns helvetica (pdf.ts:25-27) and `getHindiFont()` has no consumer. | D_render_cashbook_hindi_p1.png; D_render_salereg_land100_p1.png (rows with Hindi customer names); pdftotext of cashbook shows `6M0@ 0>.2>2 K` for Hindi narration |
| VQ-02 | HIGH | A long society name (150 chars) is clipped on BOTH page edges in the header (pdf.ts:234 centre-aligned, no wrap) and the footer confidentiality line is also near/over the margins (pdf.ts:95). Portrait and landscape both affected. | D_render_cashbook_long10_p1.png (title starts "ultural Cooperative... Tehs"); D_render_salereg_land100_p1.png |
| VQ-03 | MEDIUM | Amount columns have a fixed 28 mm width (pdf.ts:338,385,896,948); amounts of 1 crore or more wrap mid-number ("Rs. 1,00,00,00,01,\n234.49"), in Trial Balance totals also ("Rs. 12,00,28,04,93,82,57,240.00 Dr = Rs. 14,814.00 Cr" on one wrapped cell). Digits split across lines are misreadable and break column alignment. | D_render_cashbook_long10_p1.png; D_render_tb_long100_last.png |
| VQ-04 | MEDIUM | `fmt()` has no guard: NaN/undefined amounts print literally `Rs. NaN` in rows and totals (pdf.ts:16-17). Negative amounts print `Rs. -1,234.50` (no Dr/Cr suffix or brackets) in cash/bank books. | D_cashbook_nan PDF text; D_render_cashbook_long10_p1.png |
| VQ-05 | MEDIUM | Empty-dataset handling is inconsistent: Cash Book and Trial Balance show "No Data Available"; Bank Book with 0 rows prints only OB + Total 0.00 + signatures; Sale Register with 0 rows prints a header-only table, a Total row and signature block with no message and no "Customer/Payment" columns visible (table collapsed). | D_bankbook_empty PDF; D_salereg_landscape_0rows PDF |
| VQ-06 | MEDIUM | Trial Balance prints "Balanced" when the difference is under Rs 1 (pdf.ts:475); 1,200-row fixture also showed the red "NOT balanced. Difference: Rs. 12,00,28,04,93,82,42,426.00" line only after the grand-total cell that wraps - fine in logic, but the one-rupee tolerance can hide a real Re 0.99 imbalance. | pdf.ts:475; D_render_tb_long100_last.png |
| VQ-07 | LOW | Filename: Hindi society name collapses to `CashBook___FY_2025-26.pdf` (pdfFileName sanitize keeps only [a-zA-Z0-9], pdf.ts:44) so every Hindi-named society downloads an identical filename; 150-char names truncate to 40 chars ("..._Agricultural__FY_") with a double underscore. | script output `FILENAME hindi/long` |
| VQ-08 | LOW | Footer on every report says "Generated free with SahakarLekha - sahakarlekha.com" with a link (pdf.ts:101), including statutory statements and audit certificate pages. | all PDFs |
| VQ-09 | LOW | Paging is correct: header repeats, thead repeats, page numbers "Page i of N" present on 67-page Cash Book, signature block lands after the table (never orphaned on a blank page in the runs tried), Dr/Cr columns right-aligned in head/body/foot. | D_cashbook_long_1200rows PDF; D_render_tb_long100_last.png |
| VQ-10 | MEDIUM | `XLSX` builder throws for: sheet name with `: \ / ? * [ ]` ("Sheet name cannot contain..."), two sheets whose first 31 chars match ("Worksheet with name ... already exists!"), and any cell over 32,767 chars ("Text length must not exceed 32767 characters"). The whole export aborts. Latent today (current registry labels and page sheet names are valid) but unguarded. | D_gen_errors.txt; script console |
| VQ-11 | HIGH | CSV carries cells beginning `=`, `+`, `-`, `@`, TAB verbatim (formula injection). XLSX stores them as strings (type s verified with openpyxl) so XLSX is safe. | D_csv_injection_sample.csv lines 2-3 |

## Positive checks
- CSV: UTF-8 BOM present (EF BB BF), CRLF, all fields quoted, embedded quotes doubled, Hindi preserved in CSV and XLSX.
- XLSX: numbers stay numeric; README sheet placed last; 1,200-row workbook OK.
- Page-number footer, Report ID and "Prepared on" present on all rendered PDFs.

## Automated test results (npm run ...)
| Script | Result |
|---|---|
| test:export-utils | 29 passed, 0 failed |
| test:export-registry | 637 passed, 0 failed (96 entities) |
| test:export-generator | 63 passed, 0 failed |
| test:export-buttons | 106 passed, 0 failed |
| test:xlsx | 17 passed, 0 failed |
| test:export-preflight | 33 passed, 0 failed |
| test:export-source | 28 passed, 0 failed |
| test:export-jobs | 32 passed, 0 failed |
| test:export-contract | 20 passed, 0 failed |
| test:rls-coverage | 29 passed, 0 failed (STATIC only - live assertions printed as SQL, not executed) |
| test:cross-tenant-isolation | SKIPPED (needs staging credentials) |
| test:role-access | 42 passed, 0 failed |
| test:rbac | 176 passed, 0 failed |

None of these tests cover formula injection, sheet-name sanitising, long names, Devanagari rendering, or FY/branch filtering of exports, which is why all defects above pass the suite.
