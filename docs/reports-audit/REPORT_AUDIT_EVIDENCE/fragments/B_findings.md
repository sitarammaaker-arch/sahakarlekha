# Slice B findings — Registers, Subsidiary and Statutory reports

Audit date 2026-10-03. Read-only. Every citation is a file:line that was opened. "UNVERIFIED" means the repo does not hold the evidence needed. A report existing is never treated as "statutory compliant": the only statutory sources found in the repo are `docs/research/TASK2.3-COOP-ACCOUNTING-REGISTERS.md` (itself marked [NV per state] throughout), `AUDIT_NCDC_Compliance_Report.md` (an automated audit, not a statute) and `docs/CA-VERIFICATION-2026-07.md` (an unanswered TDS/salary questionnaire, not a source for any register). `src/lib/rules/ucas.ts:11` states its own values are "[NV per state]".

## Entity types
Only Cooperative Societies are modelled. `SocietyType` (src/types/index.ts:1004) lists activity types (pacs, dairy, housing, ...), there is no legal-form field, and no "Registered Society" (Societies Registration Act / trust) concept anywhere (grep of src for "registered society" finds only GST wording). Statutory wording on Form 1, the application form and the auditor certificate is fixed to "Cooperative Societies Act" (src/pages/Form1MemberList.tsx:93, src/lib/pdf.ts:2386, src/lib/pdf.ts:204). Jurisdiction resolves only 'hr' by alias (src/lib/jurisdiction.ts:15-19). Audit formats exist for 9 states (src/lib/stateAuditFormats.ts:519-529); every other state silently gets the "Multi-State Cooperative Societies Act, 2002" label (stateAuditFormats.ts:506-515, 532-535).

Access control: routes are role-gated by the module catalog through CapabilityGuard (src/components/CapabilityGuard.tsx:21-43), e.g. loanInterest/auditSchedules/reserveFund/profitDistribution = admin|accountant, boardOfDirectors = admin (moduleCatalog.ts:162,171-174,178). Soft-deleted members/loans/assets/objections are filtered at load (DataContext.tsx:955,999-1001); vouchers are not, so each page must filter `isDeleted` itself (most do).

---
## Accounting / Data

### B-01 CRITICAL — KCC loan postings resolve to the wrong ledger account
Evidence: src/pages/KccLoan.tsx:98-100 and :163 use `accounts.find(a => a.id === '3313' || name includes 'kcc' || name includes 'crop loan')`. In every default chart (src/lib/storage.ts:212, 396, 696) account 2305 "KCC / Crop Loan (DCCB)" is a LIABILITY and appears before 3313 "Member Loan Interest Rec." (storage.ts:251), so `find` returns 2305. Disbursement is `Dr loanAccount / Cr 3301` (KccLoan.tsx:104-115); repayment credits the same account (:163-168).
Failure scenario: Society disburses KCC ₹50,000 to a member. The debit lands on the DCCB borrowing account (reducing a liability) instead of a member-loan asset. Balance Sheet understates both borrowings and loans; KCC register and GL disagree. If a society deletes 2305, the debit lands on the interest-receivable account instead.
Also in the same flow: the voucher error is swallowed (`catch { /* ignore voucher errors */ }`, :116) and the `kcc_loans` row is saved anyway (:142-146); if `loanAccount && cashAccount` is falsy the voucher is silently skipped (:102); there is no `society.fyLocked` check on disbursement (only repayment has it, :153); writes go straight to supabase (`kccLoanInsert`) bypassing DataContext audit/period-lock.
Fix: configure an explicit asset head for KCC loans (3303 "Short-term Loans (KCC)" exists in one template, storage.ts:418) or a society setting; abort the save and roll back the register row if the voucher is not created; route through a DataContext function with RULE 1/RULE 6 guards.
Test: default chart, disburse ₹50,000; assert debit account type is asset and balance of 2305 unchanged; repeat with period lock enabled and assert no register row is created.

### B-02 CRITICAL — Loan interest accrual: wrong day count, wrong base, overdue loans excluded, double-counted income
Evidence: src/pages/LoanInterest.tsx:
- `daysBetween` returns end minus start, not inclusive (:60-63), so a calendar month loses a day and an annual 1-Apr to 31-Mar run gets 364 days. 
- Interest uses today's outstanding (`loan.amount - loan.repaidAmount`, :145) for a past period and does not clamp to the disbursement or closure date (:143-158). Repayments inside the period are ignored.
- Only `status === 'active'` loans accrue (:112); "overdue" is a manual status (LoanRegister.tsx:92), so loans past due stop earning interest.
- The posted journal is one consolidated voucher with no `memberId` (:166-178), so interest receivable (3313) has no per-member trail.
- The duplicate guard is `v.narration.includes(fromDate)` (:123): a monthly run and then an annual run overlap and both post.
- No `society.fyLocked` check on the page (handlePost :166); success toast is shown regardless of what `addVoucher` returned (:180-185).
- Accrual is Dr 3313 / Cr 4408 (LoanInterest.tsx:36-37) but LoanRegister.recordRepayment credits interest received straight to 4408 (LoanRegister.tsx:132-135); nothing credits 3313 (grep "3313" finds only KccLoan, LoanInterest, storage, stateAuditFormats). Interest income is therefore booked twice and 3313 grows forever.
Failure scenario: loan ₹1,00,000 at 12%, 1-30 April: correct 30 days = ₹986.30; the page computes 29 days = ₹953.42. Member pays the interest in cash: income is credited once at accrual and again at receipt.
Fix: compute per loan on the day-balance between max(from, disbursement) and min(to, closure) inclusive; include overdue loans; post member-tagged lines; on repayment credit 3313 up to accrued interest; reject overlap by stored period key; add fyLocked and period-lock handling.
Test: 1-30 April loan above must produce 986.30; accrue then repay interest then assert 3313 = 0 and 4408 counted once; run monthly then annual and assert the second is refused.

### B-03 HIGH — False success: pages treat the blocked-voucher dummy as a posted voucher
Evidence: `addVoucher` never throws; on role denial, FY lock, expired plan or period lock it returns an object with `id: ''` (DataContext.tsx:1727-1757). Callers:
- LoanRegister.recordRepayment wraps it in try/catch and then always runs `updateLoan(repaidAmount...)` and shows "Repayment recorded & posted" (LoanRegister.tsx:136-145). Register says repaid, ledger has no receipt (RULE 1 divergence).
- KccLoan.handleRepayment does the same (KccLoan.tsx:152-190).
- ProfitDistribution.settleDividend counts `n++` per member regardless and toasts "Dividend paid to N members" (ProfitDistribution.tsx:163-172); handlePost and ReserveFund.handlePost toast "journal entries posted" without checking ids (ProfitDistribution.tsx:213-250, ReserveFund.tsx:125-145); LoanInterest.handlePost likewise.
This is the false-success-toast pattern already recorded for updateVoucher (#345).
Fix: check `v?.id` after every `addVoucher`; on empty id stop and do not mutate the register or toast success; make addVoucher return null or throw.
Test: set periodLockDate after the repayment date, record a repayment; assert loan.repaidAmount unchanged and no success toast.

### B-04 HIGH — Asset Register PDF uses a different book-value formula from the screen (RULE 2)
Evidence: src/lib/pdf.ts:1238-1246 `calcBookValue`: simple SLM by elapsed years to the last 31 March relative to today's date, ignoring `depreciationMethod` (WDV), `residualValue`, `depreciationPostedFY`, `disposalDate`. The screen uses `calcAccumDep` per method and society FY (AssetRegister.tsx:181-203). The PDF header hard-codes "Depreciation Method: SLM" (pdf.ts:1236). PDF totals include disposed assets (`assets` is passed unfiltered, AssetRegister.tsx:399), and the screen total does too (:233-235).
Failure scenario: WDV asset shows ₹X on screen and ₹Y in the printed register; Depreciation Schedule shows a third figure.
Fix: PDF must call the same lib/depreciation functions with society.financialYear; separate disposed assets; print the method per row.
Test: WDV 15% asset, bought 2023-24, FY 2025-26; PDF Book Value must equal screen Book Value and Depreciation Schedule closing.

### B-05 HIGH — Depreciation Schedule roll-forward does not tie after any disposal
Evidence: src/pages/DepreciationSchedule.tsx:102-104 deductions = cost of ALL assets with status 'disposed' (any year); opening WDV counts every asset purchased before FY start including ones disposed earlier (:128-131); depreciation is computed for `activeAssets` only (:122-125) so an asset disposed in the year gets no part-year depreciation; accumulated depreciation of disposals is never removed.
Failure scenario: asset disposed in FY1; FY2 schedule deducts its cost again (opening already included it) so closing WDV is wrong and cannot tie to the ledger.
Fix: deductions only where `disposalDate` falls in the FY and remove their accumulated depreciation; include part-year charge; add gross-block/accumulated columns.
Test: dispose an asset in FY1 then open the FY2 schedule; deductions must be 0.

### B-06 HIGH — Aging Analysis buckets and totals are wrong
Evidence: src/pages/AgingAnalysis.tsx:97-113 nets every voucher line into the bucket of its own date, so a receipt today is a negative amount in "0-30" while the old invoice stays in ">180"; no FIFO or bill-wise allocation. Sub-account `openingBalance` is never read (grep finds none), so totals differ from Trial Balance. `today` is a module-level constant (:44-45), stale after midnight in a long session. No as-on date control.
Failure scenario: customer invoice 100 at 120 days, paid 100 today: report shows 91-180 = 100 and 0-30 = -100 (total 0), hiding that the invoice was cleared and mis-stating overdue.
Fix: allocate credits to oldest debits (or use bill-wise settlement), include opening balance in the oldest bucket, add as-on date.
Test: scenario above must show all buckets zero; customer with opening balance 500 must show 500.

### B-07 MEDIUM — Bills Outstanding "as of" date only changes the age, not the balance
Evidence: src/pages/BillsOutstanding.tsx:39-41 calls `getOpenBills(sales, vouchers, c.id)`; billUtils.getOpenBills (src/lib/billUtils.ts:73-84) takes no as-of date and `getBillSettledMap(vouchers)` uses all vouchers.
Failure scenario: audit cut-off report as of 31 March still shows a bill as settled by a receipt posted in April.
Fix: pass asOf and ignore settlements after it. Test: receipt dated after asOf must not reduce the balance.

### B-08 MEDIUM — Budget vs Actual "actual" ignores debit/credit direction
Evidence: src/pages/BudgetModule.tsx:67-76 sums `l.amount` for each line regardless of `l.type`. Purchase returns (Cr 5101), expense refunds and sales returns add to the actual instead of subtracting.
Fix: use signed by side per account type. Test: post a purchase return; expense actual must fall.

### B-09 MEDIUM — Member share ledger drops the opening share-capital row once any share voucher exists
Evidence: src/contexts/DataContext.tsx:4824-4842: "If a proper voucher exists, start at 0 (voucher covers it)". A migrated member with scalar `shareCapital` 1000 and a later voucher of 500 shows 500 on the ledger/passbook (Members.tsx:991-1014) while the scalar says 1500. `getMemberShareReconciliation` exists (DataContext.tsx:4873) but the passbook PDF does not show it.
Fix: show an opening row for the uncovered difference or print the reconciliation. Test: member shareCapital 1000 with no vouchers, add one 500 voucher; ledger must end at 1500.

### B-10 MEDIUM — Two parallel share registers for housing
Evidence: housing stores shares/face value on the flat (types HousingFlat.shareCount/shareFaceValue, src/types/index.ts:238-244; src/pages/ShareNominationRegister.tsx:41-52; lib/pdf.ts:1072-1113) while the member-level Share Register uses `Member.shareCount/shareCapital` and the ledger control 1102. Nothing reconciles them; the flat register total (shares × face) is not tied to the ledger.
Fix: single source or a visible reconciliation row. Test: change flat shares to 10 with member capital 5000; totals should be flagged.

### B-11 MEDIUM — Locally computed document numbers repeat after deletion
Evidence: meeting number = same-type count in current calendar year + 1 (src/pages/MeetingRegister.tsx:56-62); election number = `elections.length + 1` (src/pages/ElectionModule.tsx:92); election id `elec_${Date.now()}` (:100). Voucher/loan numbers use the server sequence (DataContext.tsx:4893-4898), these pages do not (T-03 not applied).
Test: create 3 meetings, delete #2, add one: duplicate number.

### B-12 HIGH — Minute book entries are hard-deleted and bypass the audit trail
Evidence: `meetingDelete` → `supabase.from(table).delete()` (src/lib/supabaseService.ts:44-49, 84); MeetingRegister.tsx:182-189. KccLoan, Meeting, Election, Budget write directly through supabaseService from the page (no emitAudit, no FY/period lock, no maker-checker, no branch stamp). TASK2.3:104-109 treats the minute book as a statutory record.
Fix: soft-delete with audit event; move to DataContext functions with guards. Test: delete a meeting; row must remain with isDeleted and an audit log entry.

### B-13 LOW — 'SOC001' fallback society id in page-level writes
Evidence: `user?.societyId || 'SOC001'` at KccLoan.tsx:50, MeetingRegister.tsx:98, ElectionModule.tsx:70, BudgetModule.tsx:37 (and DataContext.tsx:353,877). Routes require authentication, so this is reachable only if societyId is missing; RLS is UNVERIFIED for these tables from this slice.
Fix: fail closed when societyId is absent. Test: user without societyId must not write.

### B-14 MEDIUM — Registers are not branch-aware
Evidence: only Members.tsx uses `matchesActiveBranch` (Members.tsx:348); none of the other slice pages reference branch (grep counts 0). ShareRegister, Form1, LoanRegister, Deposits, AssetRegister use the full `members/loans/assets` arrays. Server-side branch RLS exists per project notes (ECR-17) — UNVERIFIED from this slice whether it covers every table used here.
Fix: apply the same branch scope as the ledger reports, or state that registers are society-wide. Test: restricted-branch user opens Share Register; only own-branch members.

---
## Statutory

### B-15 CRITICAL — Profit Distribution has two parallel appropriation paths; the legacy one is ungated
Evidence: src/pages/ProfitDistribution.tsx:210 comment "Appropriations (reserve/education) are OPTIONAL — never block dividend/bonus"; `canPost` ignores the statutory reserve (:211); no use of `ucasDividendCapPct` anywhere outside ucas.ts/appropriation.ts (grep); vouchers are dated `today` (:225-235); duplicates detected by narration text (`narration.includes(fy)`, :68-70). The new StatutoryAppropriationPanel (:367) calls `addStatutoryAppropriation`, which requires a feature flag, permission, period lock, an AGM authority attestation and a refusal on cap breach (DataContext.tsx:5668-5700) with education 5% and dividend cap 15% (lib/rules/ucas.ts:30-35). The legacy path uses education 1% (lib/appropriation.ts:45, ReserveFund.tsx:35, stateAuditFormats.ts:176). `AUDIT_NCDC_Compliance_Report.md:187` lists a "Section 65 gate blocks dividend" as a strength; that gate does not exist in the page code.
Failure scenario: an accountant posts a 30% dividend with no reserve and no AGM resolution; the same surplus can later be appropriated again through the statutory panel.
Also: dividend is on the current `shareCapital` (:116) not time-weighted; the settlement split is recomputed from current capital with per-member rounding that need not sum to the posted dividend (:151-157); `dividend_cap_pct` 15, `reserve` 25, `education` 5 are national defaults explicitly "[NV per state]" (ucas.ts:11,32-35): EXTERNAL VALIDATION NEEDED.
Fix: when `society.statutoryAppropriation` is on, disable the legacy post buttons; always require reserve before dividend; freeze member amounts at posting; date at AGM/FY-end; verify percentages against each State Act.
Test: net surplus ₹1,00,000; post dividend 20% with zero reserve; expect refusal. Post via legacy then statutory; expect refusal of second.

### B-16 HIGH — Reserve Fund page treats the statutory reserve as optional and dates postings "today"
Evidence: src/pages/ReserveFund.tsx:123,129 date = today; banner text "entirely optional" (:150-160); one journal per fund (non-atomic, :125-145); only a warning if `reservePct < 25` (:192). Appropriation of FY 2025-26 posted in April 2026 falls into the next FY books.
Fix: FY-end date or user-chosen AGM date within the FY; block distribution until reserve posted. Test: post in a later FY; voucher date must be within the appropriated FY.

### B-17 HIGH — Form 1 Register of Members omits cessation data and mislabels ex-members
Evidence: src/pages/Form1MemberList.tsx:35-46: status filter only `all|active|inactive`; `MemberStatus` has five values (src/types/index.ts:22) so resigned/expelled/deceased members appear as "Inactive" (:74, :127) and are hidden by the default 'active' filter; `statusChangedAt/statusReason` (types :194-195) are not exported; no occupation, age, nominee address, or additional nominees. Source: TASK2.3:46 cites Form I of the Maharashtra rules [NV per state]; the "Form 1" caption (Form1MemberList.tsx:91) has no source for other states.
Fix: show true status plus cessation date/reason; default to all-statuses register; add the missing columns; confirm the prescribed form per state. Test: create one member in each status; export "All"; every status and date must appear.

### B-18 HIGH — Share Register PDF is passed all members, screen uses approved members
Evidence: ShareRegister.tsx:35 (approved only) vs :132 `generateShareRegisterPDF(members, society)`; PDF prints "Certified that the above is a true and correct Register of Members and Share Capital" (lib/pdf.ts:1014-1019). Pending and rejected applicants and ceased members are printed, and total capital differs from the screen total. Status shown as Active/Inactive only (pdf.ts:973).
Fix: pass the filtered set and print true status. Test: pending member with capital 1000: PDF total must equal screen total.

### B-19 HIGH — Nomination Register shows only the legacy single nominee and ignores filters on export
Evidence: NominationRegister.tsx:46 (active members only), exports use `activeMembers` regardless of search/with/without (:93, :120); save writes only `nomineeName/Relation/Phone` (:81-85) although Members.tsx:449-505 stores `nominees[]` (share %); no register or PDF reads `nominees[]` (grep of pages for "nominees" finds only Members.tsx). Inactive/deceased members' nominations (the moment they matter) are excluded.
Fix: render/edit `nominees[]`; export the filtered view; include deceased/inactive members. Test: member with two nominees 60/40 appears with both.

### B-20 HIGH — Audit Schedules: statutory content unsourced, state fallback wrong, fund percentages inconsistent
Evidence: Act names, section ranges and form numbers ("Sec 63-68", "Form-S", "Form 6-A", "Form-14", "Sec 65(2)") appear only as code comments/notes (stateAuditFormats.ts:213-216,228-236,372-440); no document in the repo cites them: EXTERNAL VALIDATION NEEDED. Nine states are configured but eight of them reuse the Haryana schedules (stateAuditFormats.ts:374-498 `schedules: HARYANA_SCHEDULES`); the 36-entry state list (constants.ts:17-62) means most states get the generic Multi-State Act label. The page defaults `getStateAuditFormat(society.state)` (AuditSchedules.tsx:190) while the PDF auditor certificate defaults to `'hr'` (pdf.ts:200): the same society can be certified under two Acts. Computed rows use fixed 1%/3% for education/co-op development (stateAuditFormats.ts:176-177) while the PDF cover prints `format.educationFundPct` (Kerala 5, Gujarat 2; pdf.ts:2236-2240). The PDF ignores `specialRenderer` (depreciation, trading), so Schedule IV and X print as plain lists unlike the screen (pdf.ts:2199-2310 vs AuditSchedules.tsx:260). Account IDs are hard-coded, so custom or merged heads fall outside the schedules; previous-year values are summed without the credit-side sign flip used for the current year (stateAuditFormats.ts:98-123 vs 138-170).
Fix: obtain each state's prescribed schedules and cite them; derive computed funds from the format; one default; warn for unmapped states. Test: society with state Tamil Nadu: PDF must warn that no state format is configured.

### B-21 HIGH — Audit Rectification Register blocked by FY audit-lock and truncated in print
Evidence: `addAuditObjection/updateAuditObjection/deleteAuditObjection` call `guardFYLocked()` (DataContext.tsx:2601,2631,2647). Audit objections arise after the year is closed/locked, which is when the lock is on; the `auditNote` permission (rbac.ts:55-57) is not used to bypass it. PDF cuts objection text at 60 characters and action taken at 40 (lib/pdf.ts:1304-1309), and omits `remarks`; `doc.setTextColor` set in `didDrawCell` is never reset (pdf.ts:1324-1336). Statutory source: TASK2.3:110.
Fix: permit auditNote writes under FY lock; wrap full text. Test: lock FY, add objection as auditor: allowed; long text prints in full.

### B-22 HIGH — Loan Register lacks overdue/NPA derivation and key columns; no deposit register output
Evidence: Loan.status is a manual dropdown ('active'|'cleared'|'overdue', LoanRegister.tsx:88-92; types :576-578 (LoanStatus)); PDF omits security, guarantors, interest outstanding, NPA class (pdf.ts:1185-1232); PDF unknown member prints the raw id (:1189). TASK2.3:57-58 expects NPA and DCB; none exists. Deposits page has no register/passbook/FD receipt output and interest posting computes no TDS (DataContext.tsx:3227-3270) although a 194A threshold rule exists (lib/rules/tax.ts:268-274).
Fix: derive overdue days and NPA stage from dueDate/repayments; add DCB view; apply 194A at deposit interest posting. Test: loan with dueDate 200 days ago and no repayment is shown overdue/NPA.

### B-23 HIGH — Compliance Calendar dates are unsourced and incomplete
Evidence: src/lib/complianceCalendar.ts:60-103 hard-codes EPF/ESI 15th, TDS 7th (30 April for March), GSTR-1 11th, GSTR-3B 20th, 24Q quarterly, ITR 31 Oct, "Cooperative statutory audit" 30 Sep. No source in the repo (CA-VERIFICATION-2026-07.md is a blank questionnaire). GST assumed monthly (no QRMP), no weekend/holiday shift, 24Q shown whenever a TAN exists, no 26Q, advance tax, GSTR-9, Form 16/16A, AGM, Registrar annual return. EXTERNAL VALIDATION NEEDED.
Fix: move dates into the dated rule catalog (lib/rules) with source and effective-from. Test: QRMP society must see quarterly GST dates.

### B-24 MEDIUM — Unsourced numeric defaults printed or used in statutory output
Depreciation rate master "commonly-used ... defaults" (depreciationRateMaster.ts:1-9; Computer 40% is an Income-tax WDV rate used as SLM); housing arrears interest 21% default (OutstandingRegister.tsx:31); UCAS national defaults (ucas.ts:11). All EXTERNAL VALIDATION NEEDED.

### B-25 MEDIUM — Registered Societies are not supported
See Entity types. No legal-form field; Income and Expenditure/Receipts and Payments for non-cooperative societies and trust variants are absent. Statutory wording is cooperative-only. Fix: add a legalForm setting and swap labels, or document scope. Test: society type 'other' prints a cooperative Act on the certificate.

### B-26 MEDIUM — Election and Board records are weak statutory evidence
Election status is computed only when the election is created and never refreshed (ElectionModule.tsx:100-104); votes are typed in; no voter roll or returning officer. Board members live as JSON in society settings and can be hard-removed (BoardOfDirectors.tsx:112-118); an expired term does not stop a person printing as signatory (addSignatureBlock/getSignatoryNames, pdf.ts:110-176). Source: EXTERNAL VALIDATION NEEDED.

### B-27 INFORMATIONAL — HAFED Annual Review proforma generators are dead code
src/lib/annualReview/p1Pdf.ts..p9Pdf.ts have no importer; the report page was deleted (git 4c259a9 "remove: HAFED Annual Review Report (Proforma 1-9) page", leftovers removal 4830ce1). Claim "matches Haryana HAFED format exactly" (p1Pdf.ts:2) is unverified.

---
## Print / PDF

### B-28 HIGH — Devanagari is unreadable in every PDF
Evidence: `setupFont` always returns 'helvetica' (src/lib/pdf.ts:24-27); `preloadHindiFont` fetches NotoSansDevanagari from a CDN at app start (App.tsx:220, fontLoader.ts:1-39) but nothing ever calls `addFont`/`getHindiFont` (grep). Member names, addresses, narrations and board names in Hindi print garbled in Form 1, Share Register, Passbook, Loan Register, Nomination Register, meeting resolutions. The CDN download is wasted on every page load. sampleReport.ts:5 documents the limitation.
Fix: embed a Devanagari TTF via `doc.addFont` and use it when text contains Devanagari. Test: member "रामकुमार" in Form 1 PDF must be legible.

### B-29 MEDIUM — Text truncated in statutory registers
Audit register (60/40 chars, pdf.ts:1304-1309) and meeting resolutions (60 chars, MeetingRegister.tsx:224); minutes are not printed at all in the PDF (only on screen). Fix: wrap full text, add continuation. Test: 300-character resolution prints in full.

### B-30 MEDIUM — Almost no Print button; Form 1 print layout is orphaned
Only AdvanceRegister (window.print, AdvanceRegister.tsx:8-45) and GuideCertificate have print. Form1MemberList has `print:` CSS and a hidden print header (Form1MemberList.tsx:186-205) but no button. The shared PDF footer adds "Generated free with SahakarLekha · sahakarlekha.com" to statutory register printouts (pdf.ts:101).

### B-31 LOW — Header/date inconsistencies
Form 1 builds a custom header with no Report ID (Form1MemberList.tsx:90-110); Asset Register "As on" is today's date, not FY end (pdf.ts:1236); signatures: Form 1 labels "Registrar / Auditor" as a signatory (:148, :310); AdvanceRegister prints only society name (no reg no/FY).

---
## Export

### B-32 MEDIUM — Exports ignore on-screen filters
NominationRegister (all three formats use activeMembers, :93,:120), LoanRegister PDF (all loans, :268), ShareRegister PDF (all members, :132), AssetRegister PDF (:399), AuditRegister PDF (:219). Fix: export the filtered list or label the export "all records". Test: filter to 'overdue'; PDF must contain only overdue.

### B-33 MEDIUM — CSV formula injection
`buildCsv` quotes fields but does not neutralise leading = + - @ (src/lib/exportUtils.ts:50-60 area, `buildCsv` ~lines 61-66). Member names, nominees, narrations are user data exported by every CSV above. Fix: prefix such cells with an apostrophe or tab. Test: member name "=HYPERLINK(...)" exports inert.

### B-34 LOW — Export filenames and README
CSV/XLSX filenames have no society or FY (e.g. 'form1-member-list', 'nomination-register', 'loan-interest'); `downloadExcelSingle` is called without meta so no README sheet (Form1MemberList.tsx:88-89). Exported CSV for LoanInterest drops loan no and member id that the PDF carries (LoanInterest.tsx:187-191). Audit Schedules CSV/Excel put CY before PY while screen and PDF show PY first (AuditSchedules.tsx:226-232 vs :40-52).

---
## Security
B-33 (CSV injection), B-13 ('SOC001' fallback), B-12 (page-level writes without audit) above. B-35 LOW: Guide certificate numbers are FNV-1a over name+date with a public namespace (guideCertId.ts:10-40), so anyone can mint a "valid" certificate; the file itself says it detects typos not forgery (INFORMATIONAL).

## UX
B-36 LOW: Compliance Calendar sits under Reports (moduleCatalog.ts:133); Member Statement, Outstanding Register, Fund Statement, Complaints, Transfer Register exist only under the housing capability so a PACS has no member-wise statement. Advance Register page text calls itself a statutory register (AdvanceRegister.tsx:31 area) without a source; election status never refreshes (B-26).

## Missing reports
See B_gaps.md.
