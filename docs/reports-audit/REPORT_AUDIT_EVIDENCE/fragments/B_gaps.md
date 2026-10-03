# Slice B gaps — missing reports, fields and formats

Basis: `docs/research/TASK2.3-COOP-ACCOUNTING-REGISTERS.md` register list (all items there are marked [NV per state] for form numbers, so "required" below means "expected by the repo's own research", not independently verified law). Each item says what exists today.

## Missing registers (no page, no route, no export)
| Expected register (TASK2.3 line) | Present? | Notes |
|---|---|---|
| Share Transfer Register for general (non-housing) societies (:48) | NO | Transfers appear only as a tab in Share Register (ShareRegister.tsx:50-90) and in the housing Transfer Register. |
| Dividend Register (:49) | PARTIAL | Dividend payment register CSV only inside ProfitDistribution.tsx:196-210; no PDF, no unpaid-dividend ageing, no cap check. |
| Demand, Collection and Balance (DCB) Register (:58) | NO | Credit/PACS societies have loan register and KCC only. |
| NPA / overdue classification register (:57) | NO | Loan.status is a manual dropdown. |
| Security Deposit Register (:60) | NO | No page or entity. |
| Investment Register (:70) | NO | Accounts of subtype 'investment' only; FundRegister reads them for backing (FundRegister.tsx:42-49). |
| Deposit Register / Passbook / FD receipt / maturity and interest certificate | NO | Deposits page has no print or export except raw Export Center entity (Deposits.tsx:177). |
| Legal Case Register (:111) | NO | housing legalDocuments only. |
| Board Resolution Register and AGM Register (:108-109) | NO | Meeting register holds resolutions as free text. |
| Attendance / attendee list for meetings | NO | `attendees` is a count (MeetingRegister.tsx:48). |
| Dead Stock Register (:86) | NO | Asset Register is the nearest; no physical-verification date. |
| General Advance Register (members/staff/suppliers) (:59) | NO | AdvanceRegister covers labour worker advances only (AdvanceRegister.tsx:9-14). |
| Member-wise statement/passbook for non-housing societies | NO | MemberStatement is housing-gated (moduleCatalog.ts:108). Share ledger only for shares. |
| Member Register: cessation register / register of ex-members | NO | Form 1 default hides ex-members (Form1MemberList.tsx:35-46). |
| Unpaid / unclaimed dividend and unclaimed deposit register | NO | |
| Fund utilisation statement print (Fund Register export) | NO | FundRegister has no export (FundRegister.tsx). |
| Appropriation statement print (ReserveFund) | NO | ReserveFund has no PDF/XLSX. |
| Cash book denomination register, Registrar annual return, Audit report filing tracker | NO (outside slice but tied to Compliance Calendar) | Calendar has no AGM/Registrar/audit-report items (complianceCalendar.ts:60-103). |
| Notes to accounts / accounting policies | NO | AuditSchedules has schedules only. |
| 26Q, advance tax, GSTR-9 reminders | NO in calendar | |

## Missing fields in existing registers
- Form 1: occupation, age, cessation date and reason, nominee address, additional nominees, real status text for resigned/expelled/deceased.
- Share Register: allotment date per allotment, certificate status/issue dates (fields exist, types.ts:195-201, not printed), transfers, share units on transactions.
- Nomination Register: nominee age, address, share %, nomination date, witness (types Member.nominees exist, types.ts:206-210).
- Loan Register: sanction date/authority, guarantors, installment schedule, overdue days, NPA class, interest outstanding, security (Loan.security exists, types.ts:590, not printed).
- KCC: interest subvention, land/khasra number, crop insurance, overdue/NPA.
- Asset Register: method, residual value, disposal date/proceeds, physical verification date, title/survey no.
- Depreciation Schedule: gross block and accumulated depreciation roll-forward, half-year additions, disposals within the year.
- Audit Register: remarks, Registrar follow-up/report date, responsible officer, full text.
- Meeting Register: quorum, attendee names, proposer/seconder, signatures, full minutes in PDF.
- Election: voter roll, returning officer, notice dates, term start.
- Board: term-expiry alert, history, disqualification.

## Missing formats
- PDF: Reserve Fund, Fund Register, Fund Statement, Deposits, Board of Directors, Recoverables, Compliance Calendar, Transfer Register, Member Statement.
- XLSX: Share Register, Loan Register, Asset Register, Audit Register, Board of Directors.
- CSV: Loan Register, Asset Register, Audit Register.
- Print button: every register except Advance Register (Form 1 has print CSS but no button).
- Hindi-readable PDF for any register (see B-28).
- Page-numbered, FY- and registration-no headed print for Advance Register.

## Missing entity-type support
- Registered Society (Societies Registration Act / trust): no legal-form field, no tailored statutory wording or formats (B-25).
- State coverage: 9 of 36 states/UTs have an audit format; only Haryana has jurisdiction alias and capability pack (jurisdiction.ts:15-19, jurisdictionPacks.ts:36).

## Source documents that would unblock "EXTERNAL VALIDATION NEEDED" items
Prescribed form numbers and register formats for each state; State Act sections on reserve/education/dividend caps; audit-schedule formats per state; Registrar due dates (AGM, audit report, annual return); NABARD CAS manual (register set, NPA norms); Income-tax Act 2025 section numbers for TDS (CA questionnaire in docs/CA-VERIFICATION-2026-07.md is unanswered).
