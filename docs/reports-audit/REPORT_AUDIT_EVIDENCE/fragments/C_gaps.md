# Slice C gaps — reports/fields/formats expected but missing (2026-10-03)

Expectation basis: what each supported module (per moduleCatalog.ts capability list) would normally need; statutory necessity is EXTERNAL VALIDATION NEEDED unless a repo source is cited.

## Trade / stock
- Physical stock verification / stock-count sheet and book-vs-physical reconciliation (AUDIT_NCDC_Compliance_Report.md:161 confirms none). Closing Stock PDF currently certifies physical verification (pdf.ts:2105).
- Stock ledger / item-wise movement register (Bin-card) printable with opening, receipts, issues, balance; reorder-level report (Inventory low-stock uses fixed `< 5`, Inventory.tsx:621).
- Stock valuation as-on-date and lower-of-cost-or-NRV (AUDIT_NCDC_Compliance_Report.md:124,146); FIFO actually implemented.
- Godown-wise stock statement tied to Inventory totals (C-04); expiry/aging stock report for non-consumer societies.
- Customer / Supplier statement of account (ledger with opening, bills, receipts, closing), party ageing from the Customers/Suppliers pages, and PDF export (Customers.tsx / Suppliers.tsx have list exports only).
- Credit Note / Debit Note PDF for sales/purchase returns (SalesReturn/PurchaseReturn only CSV; grep: no pdf import).
- Rate-wise (multi-rate) tax invoice; Original/Duplicate/Triplicate copies; delivery challan; proforma/quotation; reverse-charge self-invoice and payment voucher.
- Purchase Register: supplier GSTIN, supplier bill no/date, ITC-eligibility, RCM, TCS columns; GSTR-2B reconciliation.
- Print buttons (window.print) on Sale/Purchase Registers, Inventory, Stock Valuation, GST Summary, TDS Register.

## GST
- GSTR-1: B2CL, exports, nil/exempt/non-GST (Table 8), advances (11), document-issued (13), place-of-supply by buyer, HSN rate column; one-month export guard.
- GSTR-3B: 3.1(b), 3.1(d) RCM, 3.2, blocked ITC, Rule 42/43 reversals, interest/late fee, 6.1 tax-paid ledger.
- GSTR-9: real table layout (4-17), 9C reconciliation not applicable; 2A/2B reconciliation.
- GSTR-2B/2A reconciliation report; ITC ledger (electronic credit ledger) and cash ledger statements.
- E-invoice (IRN/QR) readiness check; e-way bill extend/cancel/Part-B update tracking.
- HSN Master linkage to stock items and to GSTR-1 HSN (HsnMaster uses its own table; GstSummary reads stockItems).

## TDS / payroll
- Form 26Q file per NSDL RPU/FVU spec and FVU validation step; 27Q/27EQ (if applicable); TDS challan 281 reconciliation; Form 24Q Annexure I/II; Form 16 (Part A/B) for salary; Form 16A from TRACES integration or clear "statement only" labelling; FY 2026-27 selector.
- Section mapping to Income-tax Act 2025 once CA answers docs/CA-VERIFICATION-2026-07.md (all 15 questions open in the repo).
- Unified payroll TDS feed: new Payroll engine (Payroll.tsx) is not an input to TdsRegister/24Q (TdsRegister.tsx:169-171).
- Payslip variants: Hindi payslip PDF (HTML path exists in Payroll.tsx but legacy SalaryManagement slip is English-only PDF), annual salary statement, PF/ESI challan statement (ECR challan summary), Form 5/10/12A-style EPF returns (EXTERNAL), ESIC Form 5 half-yearly (EXTERNAL), Professional Tax return/challan (lib/professionalTax.ts exists, no report).
- Gratuity/bonus/leave encashment statements; bonus register (Payment of Bonus) — not present (EXTERNAL VALIDATION NEEDED for applicability).

## Labour / contract societies
- Wage Register in prescribed form (father/husband name, OT, deductions, signature/thumb), Muster Roll printable format, Register of Workmen, Register of Advances/Fines/Deductions, Employment card, Form XVII-type statutory registers — form numbers are EXTERNAL VALIDATION NEEDED (no source in repo, labour-code transition unknown).
- Printable Department Bill / Running Account Bill / Tax invoice for works contract with GST and TDS-receivable; work-order-wise cost sheet including statutory contributions.
- Worker Ledger and Work Order Profit exports/prints (none).

## Dairy / consumer / marketing / housing
- Dairy: farmer settlement slip/payment advice PDF, daily/shift collection register print, member passbook print/export, fat/SNF average register, dispatch-vs-collection variance, bonus/distribution statement printable.
- Dairy milk slip: slip number and cumulative qty, farmer signature line.
- Consumer: Z-report net of returns, member outstanding as-of correct, GST-wise sales (counter), credit-note print, patronage/dividend statutory statement (formulas not audited here).
- Marketing/procurement: HAFED Proforma 8 PDF (generator orphaned), procurement register PDF, farmer payment advice, commodity-wise stock-in-hand, J-form print (outside this slice).
- Housing: bill with due date/previous arrears/interest; member statement and demand notice are in other pages (OutstandingRegister.tsx, MemberStatement.tsx) but not linked from Maintenance Billing; sinking/repair fund statement; GST on maintenance.

## Cross-cutting
- Registered Society (Societies Registration Act) variant of reports/wording/auditor certificate — not modelled (src/types/index.ts:1004).
- Hindi (Devanagari) PDF output for invoices/registers (C-28).
- XLSX README/provenance sheet (society, FY, filters, generated by) — available in exportUtils (`meta`, exportUtils.ts:70-110) but none of the slice's XLSX callers pass `meta`.
- Single shared `wageOf`/`gstTotals` money.ts helpers instead of per-page float math.
