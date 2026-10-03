# Slice C findings — Trade, Tax, Payroll & Domain reports (audit 2026-10-03)

Read-only audit. Every cite is a file:line I opened. "EXTERNAL VALIDATION NEEDED" = the statutory source (CGST Rules, GSTN/NSDL/EPFO/ESIC schemas, labour forms) is NOT in the repo; only docs found were docs/CA-VERIFICATION-2026-07.md (an unanswered CA questionnaire, not a statutory source), docs/research/TASK2.6-COOP-TAX-STATUTORY-COMPLIANCE.md (summary table, no schemas) and AUDIT_NCDC_Compliance_Report.md.

## Entity-type support (cooperative vs registered society)
- Code models ONLY cooperative society types: `SocietyType = 'marketing_processing' | 'pacs' | 'consumer' | 'labour' | 'dairy' | 'housing' | 'sugar' | 'producer' | 'multistate' | 'multipurpose' | 'other'` (src/types/index.ts:1004). Grep for "Registered Society" / "Societies Registration" finds nothing about legal form; the word "registered" in code means GST-registered (lib/consumer/posGst.ts:13, lib/navigation/capabilities.ts:84).
- There is no Registered-Society (Societies Registration Act) mode, bye-law set, or report variant. A Registered Society must use `other` and gets cooperative wording on all reports (Auditor certificate wording uses state cooperative Act via stateAuditFormats: pdf.ts:204).
- Capabilities gate reports per society (moduleCatalog.ts:59-185): `gst`, `tds`, `inventory_sales`, `pf_esi`, `labour`, `dairy_collection`, `pos_billing`, `procurement_msp`, `haryana_compliance`, `housing`. Route enforcement is presentation-layer only (CapabilityGuard.tsx header comment). Reports in the `reports` domain carry no `requiredRoles` (moduleCatalog.ts:138-153), so any role that can see the sidebar group can open GST/TDS/stock reports.

---
## A. ACCOUNTING / DATA

### C-01 — HIGH — Stock Valuation FIFO/WA selector is dead; PDF can print "Method: FIFO" over Weighted-Average values
- Evidence: StockValuation.tsx:83 (`method` state), :100 and :106 (value always `computeStockValue`, `method: 'WA'`), :148 (PDF subtitle reads `method`), :118 (comment says table "can use FIFO/WA per item" — it cannot).
- Scenario: Accountant picks FIFO for the auditor, downloads PDF: header says FIFO, numbers are WA. Audit evidence is mislabelled.
- Fix: remove selector or implement FIFO with the canonical qty (lib/stockUtils.ts:104 computeStockValue). Test: switch to FIFO on an item with two purchase rates -> value must differ or control must be disabled.

### C-02 — MEDIUM — Inventory total includes inactive items; every other stock report excludes them (RULE 2)
- Evidence: Inventory.tsx:617-620 sums `stockItems` (all) vs StockValuation.tsx:90 (`isActive`), ClosingStockReport.tsx:82, DataContext.tsx:5427 (`filter(s => s.isActive)`).
- Scenario: deactivate an item with stock: Inventory shows total X, Stock Valuation/Trading A/c show X minus item.
- Fix: one `activeStockValue` helper; test parity across Inventory/StockValuation/ClosingStock/Trading A/c.

### C-03 — MEDIUM — Closing Stock Report cannot reconcile once prior-FY movements exist; sale value mixed with cost
- Evidence: ClosingStockReport.tsx:100-102 (opening = `item.openingStock` × `purchaseRate`), :83 (flows limited to FY), :107-110 (closing = whole history <= FY end), :93 (flow value = `|m.amount|`, which stockUtils.ts:95 says is unreliable on imported movements). Sale column is selling amount, others cost.
- Scenario: FY 2026-27 report for an item bought and sold in 2025-26: Opening + flows != Closing; sale value at selling price breaks value identity printed in the info note (:358).
- Fix: derive FY-opening from history before FY start; value sales at WA cost; test identity for each item.

### C-04 — MEDIUM — Godown stock ignores opening stock and reconciliation
- Evidence: Godowns.tsx:91 `computeGodownStock(stockMovements)`; godownStock.ts:39 signature takes movements only; stockUtils.ts:25-28 NOTE admits per-godown views read raw movements.
- Scenario: godown totals do not sum to Inventory quantity (opening stock not in any godown; drifted/orphan movements counted).
- Fix: assign opening stock to an "Unassigned" godown row and show a reconciliation line vs computeStock. Test: sum(godown) == Inventory qty.

### C-05 — HIGH — Consumer Outstanding Register omits credit-adjusted returns; disagrees with Member Credit screen
- Evidence: registers.ts:74,76 call `memberOutstanding`/`memberAgeing` without the `returns` arg (credit.ts:53-57 default `[]`); ConsumerDataContext.tsx:244,248 pass `activeReturns`. `asOf` (ConsumerRegisters.tsx:35) only affects ageing, not balances.
- Scenario: Member buys Rs 1,000 on credit, returns Rs 400 adjusted to credit: Member Credit shows 600, Consumer Registers (and its CSV) shows 1,000 — demand sent for money not owed.
- Fix: pass returns; filter sales/recoveries by `asOf`. Test as above.

### C-06 — MEDIUM — Counter Z-report overstates sales and mis-buckets unknown tenders
- Evidence: registers.ts:18-37 sums all `sales` (not counter-only, not net of returns); unknown `paymentMode` falls into cash (registers.ts:30).
- Fix: filter to POS sales, net sales returns, show "other". Test: return after sale reduces Z total.

### C-07 — MEDIUM — Procurement registers count rejected lots and use system timestamp as date
- Evidence: registers.ts:31-45 (date = `createdAt`, no status filter), :52-64 commodity summary over all lots; OperationalStatus includes `'rejected'` (procurement/entities.ts:8-10).
- Scenario: rejected lot (not accepted) still adds qty/value to Procurement Register and Commodity Summary.
- Fix: exclude or separate `rejected`; use arrival/weighment date. Test: reject a lot -> totals fall.

### C-08 — MEDIUM — Dairy settlement number derived from count (duplicates possible)
- Evidence: DairyDataContext.tsx:408 `'DS/' + (approved && !deleted count + 1)`.
- Scenario: approve DS/0001, DS/0002; delete DS/0001; next approval = DS/0002 (duplicate on a farmer payment document).
- Fix: use next_document_number RPC (T-03). Test: delete-then-approve yields unique number.

### C-09 — LOW — Work Order Profit overstated; wage formula copy-pasted with float math
- Evidence: WorkOrderProfit.tsx:26 profit = billed − wage only; `days × dailyWage` repeated in WorkOrderProfit.tsx:23, WorkerLedger.tsx:22, WageRegister.tsx:40,109, WageSlip.tsx:33, MusterRoll.tsx:78 with `+(x).toFixed(2)` float rounding, not money.ts (T-02).
- Fix: shared `wageOf` on money.ts; include employer PF/ESI in cost.

### C-10 — MEDIUM — Wage Slip deductions are recomputed with DEFAULT rates, not the posted PF/ESI run
- Evidence: WageSlip.tsx:35 `computePfEsi(period, PF_ESI_DEFAULTS)`; PfEsi.tsx:28,29 lets the user edit rates and posts a run with those.
- Scenario: user posts a run with a changed ceiling; slip shows different EPF/ESI than the voucher (RULE 2).
- Fix: read the posted run's per-worker values.

---
## B. STATUTORY

### C-11 — CRITICAL — GSTR-1 JSON: place of supply is hard-coded 09 (Uttar Pradesh) for every society
- Evidence: GstSummary.tsx:90 `(society as {stateCode?}).stateCode || '09'`, :469 (`pos` of every B2B invoice), :518 (CDNR). `stateCode` is not a field anywhere in src (grep: only GstSummary and unrelated stateAuditFormats.ts:49). lib/gstStates.ts:22-37 already has `stateCodeFromGstin/resolveStateCode` (used by EWayBill.tsx:16,126) but GstSummary does not use it.
- Scenario: Haryana society uploads GSTR-1 JSON; every invoice carries pos 09 -> wrong POS, wrong IGST/CGST characterisation at portal. Schema itself: EXTERNAL VALIDATION NEEDED.
- Fix: pos from buyer GSTIN/state per invoice (supplier state from society.gstin). Test: Haryana->Haryana B2B must emit pos "06".

### C-12 — CRITICAL — GSTR-1 HSN summary is empty (all "N/A") and B2B classification misses customers who have `gstin`
- Evidence: GstSummary.tsx:243 reads `(item as any).hsnCode` from SALE items; `SaleItem` has no hsnCode (types/index.ts:1288-1295) and SaleManagement saves none (hsn is looked up from stockItems only for the PDF: SaleManagement.tsx:356). Returned items do look up stockItems (GstSummary.tsx:111) so the two halves disagree. B2B test uses `cust?.gstNo` only (:100,:203,:457) although Customer has primary `gstin` and `gstNo` as "legacy alias" (types/index.ts:1692-1693); invoice code uses `gstin || gstNo` (SaleManagement.tsx:338).
- Scenario: customer entered with `gstin` only -> invoice goes to B2CS (no ctin), HSN rows all "N/A" (:498 sets hsn_sc '' ) — return fails HSN validation.
- Fix: resolve hsn via stockItems; use `gstin || gstNo`. Test: sale of HSN 3102 item -> HSN row 3102.

### C-13 — HIGH — GSTR-1/3B JSON period is the month of the FROM date even for a whole-FY range; date format and fixed placeholders
- Evidence: GstSummary.tsx:351 and :451 (`fp`/`ret_period` from `fromDate`); default range is the FY (fyBounds, :36-38); `idt: s.date` ISO (:467), `hash: 'hash'` (:530), `version: 'GST3.0.4'` (:529), B2CS `sply_ty: 'INTRA'` for all rates incl. IGST (:486), HSN `val` = taxable value (:502), no HSN rate column. Schema: EXTERNAL VALIDATION NEEDED.
- Scenario: default Export of the FY files April under ret_period 042026 with 12 months of totals.
- Fix: force single-month range for export; dd-mm-yyyy dates; INTER/INTRA by POS.

### C-14 — HIGH — GSTR-1 has no B2CL, nil/exempt/non-GST, document-issued, RCM sections; GSTR-3B 3.1(d) RCM is zero
- Evidence: payload keys only b2b/b2cs/cdnr/hsn (GstSummary.tsx:528-537); 3B `isup_rev` all zero (:356) while GSTR9.tsx:57 computes RCM via lib/rcm.ts; ITC `OTH` = all purchases (:361-365) with no blocked-credit / unregistered-supplier flag.
- Fix: add sections; per-purchase ITC eligibility. Statutory content: EXTERNAL VALIDATION NEEDED.

### C-15 — CRITICAL — Form 26Q export includes salary (s.192) entries and uses a home-grown, unvalidated file layout
- Evidence: TdsRegister.tsx:211 merges `salaryTdsEntries` into `allEntries`; :214 `quarterEntries`; :307-324 export passes `quarterEntries`; TDS on salary belongs to 24Q (form24Q.ts:2-3). tds26q.ts:60-67 pipe-delimited FH/BH/CH/DD records with `'SahakarLekha v1.0'` as utility name, `society.state.toUpperCase()` as "State code" (:76), undeposited entries emitted as a fake challan BSR `0000000` date `00000000` (:123-124), 194I mapped to `'4IB'` only (:22). No NSDL RPU/FVU spec in repo -> EXTERNAL VALIDATION NEEDED; expect FVU rejection.
- Scenario: Q1 with salary TDS: 26Q file contains section-192 deductee rows (wrong form); upload rejected or mis-filed.
- Fix: exclude 192; generate per NSDL spec and validate through FVU; test: salary + purchase entries -> 26Q holds only purchase rows.

### C-16 — HIGH — TDS entries default to section 194Q, PAN source misses supplier PAN, and sections are 1961-Act for FY 2026-27
- Evidence: TdsRegister.tsx:143 (`section: '194Q'` for every purchase TDS, `deducteeType 'firm'` :141), :140 `panFromGstin(supplier?.gstNo)` (not `gstin`, not supplier PAN), :146 `tdsRate: p.tdsPct || 0.1`. PurchaseManagement.tsx:742 TDS% is a typed number (max 30) with no threshold: lib/tax/computeTds.ts exists but nothing imports it (grep). TdsRegister.tsx:329-338 itself says the file carries repealed 1961 numbers for FY 2026-27 (Act 2025 in force 1-4-2026 per docs/CA-VERIFICATION-2026-07.md:7-12), and the CA questionnaire is unanswered in the repo.
- Fix: carry the supplier's real section; PAN from supplier.pan with fallback; use the rules engine; section-mapping per tdsSections.ts once CA-verified.

### C-17 — HIGH — "Form 16A" is a society-generated supplier statement, not the statutory certificate
- Evidence: TdsForm16A.tsx:99-165 prints summary/per-supplier PDF titled "TDS Form 16A" citing "Section 203 of Income Tax Act, 1961" (:111). No certificate number, quarter, section, deductee PAN, challan BSR/date, TRACES signature. Deductor PAN/TAN are blank inputs (:44-45) even though society.tan/entityPan exist (pdf.ts addHeader prints them). FY list stops at 2025-26 (:204) — FY 2026-27 (current) cannot be chosen. Source only purchase TDS (:52-66), so Register (salary/manual entries) and 16A disagree (RULE 2). Form 16A authenticity = TRACES: EXTERNAL VALIDATION NEEDED.
- Fix: rename "TDS statement" or integrate TRACES; add FY 2026-27; same dataset as Register.

### C-18 — HIGH — Sale invoice supports one GST rate per invoice and misprints Bill-of-Supply when tax was charged
- Evidence: invoice-level `cgstPct/sgstPct/igstPct` (types/index.ts:1308; invoiceTotals.ts); PDF table has HSN but no per-line rate/tax (pdf.ts:2700-2712); `isTaxInvoice = GSTIN && taxAmount > 0` (pdf.ts:2540); if the society has no GSTIN and the invoice carries tax, tax rows are hidden but Grand Total includes tax and the footer says "no tax is chargeable" (pdf.ts:2912). "Original for Recipient" hard-coded (:2557); seller state printed as raw code e.g. "hr" (:2572). Rule 46 content: EXTERNAL VALIDATION NEEDED.
- Fix: per-line tax rate and rate-wise tax table; block tax without GSTIN.

### C-19 — MEDIUM — GSTR-9 is a headline worksheet, not the GSTR-9 table structure; returns not branch-scoped
- Evidence: gstr9.ts:77-80 maps Table 7 to "ITC reversed (debit notes)"; GSTR9.tsx:39-40 filters sales/purchases by branch but passes unfiltered `salesReturns/purchaseReturns` (:49-50); `r2` float rounding (gstr9.ts:13); ITC availed = all purchases (:101); disclaimer in gstExport.ts:36 and GSTR9.tsx footer admit simplification. Schema/applicability: EXTERNAL VALIDATION NEEDED.
- Scenario: Branch B selected: GSTR-9 outward nets branch-B sales against ALL-branch credit notes.
- Fix: apply `matchesActiveBranch` to returns; rename the page "GST annual consolidation".

### C-20 — MEDIUM — E-Way Bill JSON: fabricated HSN, non-NIC date format, inward bill uses our number, silent save failure
- Evidence: EWayBill.tsx:131 HSN fallback `'9999'`; :157 `docDate: s.date` ISO; :145 pincode fallback `'000000'`; :156 inward docNo = `purchaseNo` (our number, not supplier bill no); :203 save failure only `console.error` (RULE 1: user never told the record was not stored). Field names in itemList (`name,hsn,qty,unit,taxable,gstRate`, :127-135) differ from the NIC bulk-upload names as I recall them — UNVERIFIED, schema not in repo.
- Fix: block when HSN missing; supplier bill no for inward; toast on save failure.

### C-21 — MEDIUM — PF ECR / ESI files: NCP days always 0; rates hard-coded; statutory formats unverified
- Evidence: PfEsi.tsx:87 emits `, 0, 0` for NCP days/refund although `daysOf()` (:78-80) exists; ESI file omits reason code/last working day (:97-103, UNVERIFIED vs ESIC template); PF ceiling/ESI threshold constants (payrollStatutory.ts:15-16) and editable rates not persisted (PfEsi.tsx:28). EPFO/ESIC specs: EXTERNAL VALIDATION NEEDED. Labour-code transition status: EXTERNAL VALIDATION NEEDED.
- Fix: derive NCP from muster; rules table with citation.

### C-22 — MEDIUM — Salary slip hides statutory breakup; 24Q worksheet limited to legacy payroll and basic+allowances
- Evidence: pdf.ts:1674 single "Deductions" line though SalaryRecord stores pf/esi/pt/tds (types/index.ts:1768-1773); form24Q.ts:46 gross = basic+allowances; build24Q reads `salaryRecords` only (SalaryManagement.tsx:288) while the new Payroll engine (Payroll.tsx) never feeds TdsRegister/24Q (TdsRegister.tsx:169-171 reads `salaryRecords` only).
- Fix: print breakup; merge new payroll TDS into register.

### C-23 — INFORMATIONAL — Income-tax slab data for FY 2026-27 is marked verified; section mapping is not
- Evidence: rules/incomeTax.ts:131-141 (`verified: true`, CA confirmation 2026-07-16), :46-66 FY2024-25 `verified:false`; rules/tdsSections.ts:25,121 (every 2025 mapping `verified:false`). No statutory text is in the repo; "verified" there is ownership by the founder/CA, per the file's own note (incomeTax.ts:129). EXTERNAL VALIDATION NEEDED remains.

### C-24 — MEDIUM — HAFED Proforma 8 (Kachi Aarat) PDF generator is orphaned
- Evidence: generateP8PDF exported at lib/annualReview/p8Pdf.ts:15; no importer in src (grep); KachiAaratRegister.tsx offers only the generic export (:172). Source for the proforma: none public (AUDIT_NCDC_Compliance_Report.md:64) -> EXTERNAL VALIDATION NEEDED.

---
## C. SECURITY / PRIVACY
### C-25 — LOW — Hindi font is fetched from a third-party CDN at every app start but never used by any PDF
- Evidence: App.tsx:220 `preloadHindiFont()`; fontLoader.ts:4-5 fetches from cdn.jsdelivr.net; pdf.ts:26 `setupFont` always returns 'helvetica'; grep shows `getHindiFont` unused outside fontLoader. Needless third-party request (privacy/perf) with no benefit.

### C-26 — LOW — PDF footers/brand lines on legal documents
- Evidence: addPageNumbers prints "Generated free with SahakarLekha . sahakarlekha.com" link on every report (pdf.ts:101); invoices print "Generated by SahakarLekha.com" (pdf.ts:2945). Not a leak, but marketing text on statutory documents (invoice, register) the society signs.

### C-27 — INFORMATIONAL — Statutory report access is nav-gated only
- Evidence: moduleCatalog.ts:143-153 GST/TDS/stock reports have capability gates but no `requiredRoles`; CapabilityGuard.tsx header: "presentation-layer enforcement". Server-side RLS is the real control (outside this slice).

---
## D. PRINT / PDF
### C-28 — HIGH — All jsPDF documents are English-only; Devanagari party/item/employee names garble
- Evidence: pdf.ts:26 (`setupFont` returns helvetica; comment at :24 "All PDFs use English only"), slip.ts:3-4 states helvetica lacks Hindi glyphs. Affects invoices (pdf.ts:2532), purchase record, registers, closing stock, salary slip, maintenance bill, 16A. Hindi-first users (RULE 7) with Hindi master names get blank/garbled cells in statutory prints. Only HTML-print documents (Payroll payslip, milk slip, WHR) render Hindi.
- Fix: embed a Devanagari TTF (fontLoader exists) or route to HTML print.

### C-29 — LOW — Maintenance receipt prints "Rs. Rs."
- Evidence: pdf.ts:1169,1173 `Rs. ${fmt(...)}` while `fmt` already returns "Rs. ..." (pdf.ts:14-15).

### C-30 — MEDIUM — Closing Stock PDF certifies "physical verification" for a book-derived statement
- Evidence: pdf.ts:2105 note; no physical count exists (AUDIT_NCDC_Compliance_Report.md:161 "No physical-count vs book reconciliation UI").
- Fix: reword to "as per books" or add physical-count capture.

### C-31 — LOW — Print via CSS visibility hack; no print on main registers
- Evidence: WageRegister.tsx/WageSlip.tsx use `body * {visibility:hidden}` print CSS (hidden nodes still occupy layout, may leave blank leading pages — UNVERIFIED in browser). Sale/Purchase Register, Inventory, GST Summary, Stock Valuation, TDS Register have no print button (grep window.print: only CalculatorShell, AdvanceRegister, BarcodeLabels, Godowns, GuideCertificate, Payroll, WageRegister, WageSlip). PDF is the only print path.

---
## E. EXPORT
### C-32 — HIGH (systemic) — Double file extensions on many exports
- Evidence: `downloadCSV` appends ".csv" (exportUtils.ts:162) and `downloadExcel` appends ".xlsx" (:170) but callers pass names with extensions: Inventory.tsx:824,829; Customers.tsx:139,148; Suppliers.tsx:140,149; HsnMaster.tsx:136,142; SaleManagement.tsx:402,407; PurchaseManagement.tsx:423,428; SalaryManagement.tsx:292 (Form 24Q), :557,:563; GSTR9.tsx:79; ConsumerRegisters.tsx:45,50; Dividend.tsx:48; ExpiryDamage.tsx:85; Patronage.tsx:67 (+ other slices: Vouchers.tsx:526,535, LedgerHeads, OpeningBalances, UserManagement...). Result `inventory.csv.csv`, `GSTR9_..._to_....csv.csv`; Excel may refuse to associate. Fix in exportUtils: strip a trailing known extension. Test: downloadCSV(h,r,'a.csv') -> 'a.csv'.

### C-33 — MEDIUM — Exports that ignore on-screen filters
- Salary history (SalaryManagement.tsx:553-564 exports all records irrespective of month/employee/paid filters at :295-296,325); Form 16A CSV/XLSX ignore supplier filter (TdsForm16A.tsx:86-100); EntityExportButton exports the whole table by design (EntityExportButton.tsx:19-23) — Muster Roll, Dept Bills, Work Orders, Kachi Aarat, dairy pages export every row, not the month/work-order on screen; Dairy settlement register ignores from/to (DairyRegisters.tsx:25 vs :45).

### C-34 — MEDIUM — Register exports omit returns and statutory columns; CSV numbers as strings
- Sale/Purchase Register: returns shown on screen only (SaleRegister.tsx:71-80; exports :83-91); no GSTIN/POS/HSN/supplier bill no/TCS. GST Summary CSV/Stock Valuation use `.toFixed(2)` strings (GstSummary.tsx:328-332; StockValuation.tsx:72-83), so Excel treats them as text. GST Summary CSV exports Output slabs only, ITC omitted (GstSummary.tsx:337).

### C-35 — LOW — Sale/Purchase list exports are thin
- SaleManagement.tsx:399-407 exports 7 columns (no tax, GSTIN, grand total); Customers export omits address/PAN/outstanding (Customers.tsx:131-139).

---
## F. UX
### C-36 — LOW — On-screen claims overstate readiness
- SaleRegister.tsx:358 says the register "can be used for GSTR-1 filing"; GSTR-1 JSON labelled "NIC" (GstSummary.tsx:982); both lack required fields (C-11..C-14). GSTR9/gstExport carry honest disclaimers (gstExport.ts:36); GstSummary does not.

### C-37 — LOW — Delete handlers in TDS Register log Supabase failure to console only (RULE 1)
- TdsRegister.tsx:296-304: local state updated then `console.warn` on cloud failure; no rollback or toast.

---
## G. MISSING REPORTS
See C_gaps.md.
