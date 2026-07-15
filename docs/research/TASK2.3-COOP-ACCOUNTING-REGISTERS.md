# SahakarLekha Research Task 2.3 — Accounting Books & Registers of Indian Cooperative Societies

**Scope:** Accounting books, registers and records only. No software, no competitors, no features, no accounting theory, no legal history. Each register: Name · Purpose · Mandatory/Optional · Applicable types · Who maintains · Update frequency · Key fields · Related financial statements · Related audit checks · Common errors · Official source · Needs Verification. **[NV]** = Needs Verification.
**Prepared:** 2026-07-08

**Official-source anchors (used throughout):**
- **Maharashtra Co-op Societies Rules 1961, Rule 65 ("Accounts and books to be kept")** prescribes, for every society: (1) minute book of general meetings, (2) minute book of committee meetings, (3) **cash book**, (4) **general ledger & personal ledger**, (5) **stock register**, (6) **property register**, (7) **register of audit objections & their rectification**, plus "such other books as the State Government may specify." → cited as **[Off: MCS Rule 65]**. *Other states have equivalent rules; forms/numbers differ **[NV per state]**.*
- **NABARD Common Accounting System (CAS) for PACS/LAMPS** prescribes cash book (denomination-wise daily closing), general ledger (heads in Annexure VII), day book, sales register, vouchers, on accrual basis with NPA/prudential norms. → cited as **[Off: NABARD CAS]**.
- **Multi-State Co-op Societies Act 2002 & Rules** → **[Off: MSCS Act]**.
- Registers not named in a statute but universally kept are marked **[Practice]** (industry practice) vs **[Off: …]** (statutory). "Mandatory" below means statutory where an official source is cited; otherwise it is bye-law/practice-driven — flagged accordingly.

**Type abbreviations:** **All** = all eight types · **Credit** = PACS, Credit/Thrift, Multi-State credit, coop banks · **Trading** = PACS, Marketing, Consumer, Dairy, Industrial · **MSCS** = Multi-State.

---

## A. Core financial books

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cash Book** | Record all cash & bank receipts/payments | **Mandatory** | All | Cashier/Secretary | Daily | Date, particulars, voucher no., cash Dr/Cr, bank Dr/Cr, balance (denomination-wise closing for PACS) | Receipts & Payments; Balance Sheet | Daily cash verification; balance vs physical cash; posting to ledger | Cash balance not verified; negative cash; delayed writing-up | [Off: MCS Rule 65; NABARD CAS] |
| **Bank Book** | Record bank-column transactions per account (subsidiary to cash book) | Mandatory (part of cash book) / **[Practice]** if separate | All | Cashier/Accountant | Daily | Date, cheque/instrument no., deposits, withdrawals, bank balance | Balance Sheet; Bank Recon Statement | Bank reconciliation; uncleared items | Non-reconciliation; stale cheques not reversed | [Off: MCS Rule 65 (cash book)] |
| **Petty Cash Register** | Control small day-to-day cash expenses (imprest) | **[Practice]** (bye-law-driven) | All | Petty cashier | Daily | Date, voucher, expense head, amount, imprest balance | P&L / I&E | Imprest reconciliation; voucher support | Unvouched petty spends; imprest not replenished/reconciled | [Practice] **[NV]** |
| **General Ledger** | Consolidate all accounts head-wise (control accounts) | **Mandatory** | All | Accountant/Secretary | Continuous (posted from day book) | Account head, Dr/Cr, running balance, GL code | Trial Balance; P&L; Balance Sheet | Ledger-to-TB agreement; control-account tie-out | Posting errors; heads misclassified; TB not tallying | [Off: MCS Rule 65; NABARD CAS Annexure VII] |
| **Personal Ledger** | Party-wise (member/supplier/customer) balances | **Mandatory** | All | Accountant/Secretary | Continuous | Party name, opening, transactions, closing balance | Balance Sheet (debtors/creditors) | Balance confirmations; sub-ledger vs control tie-out | Sub-ledger ≠ control account; unconfirmed balances | [Off: MCS Rule 65] |
| **Journal Register** | Record non-cash/adjustment entries | **Mandatory** (practice-core) | All | Accountant | As needed / monthly | Date, JV no., accounts Dr/Cr, narration | All statements | Adjustment-entry validity; authorization | Unauthorized JVs; no narration/support | [Practice] (implicit in Rule 65 ledgers) **[NV]** |
| **Day Book** | Chronological record of all daily transactions | **Mandatory** (PACS via CAS) | All (esp. PACS) | Accountant/Secretary | Daily | Date, voucher no., particulars, Dr/Cr amounts | Feeds ledger → all statements | Sequence continuity; totals vs cash book | Missing days; totals mismatch | [Off: NABARD CAS] |
| **Voucher Register** | Index of all payment/receipt/journal vouchers | **Mandatory** | All | Accountant | Daily | Voucher no. (serial), date, type, amount, authorization | Audit trail for all F/S | Serial continuity; approval; supporting docs | Missing vouchers; broken serials; unauthorized | [Off: MCS Rule 65 (audit trail)] |
| **Receipt Book** | Serially-numbered receipts for money received | **Mandatory** | All | Cashier/Secretary | On each receipt | Receipt no., date, payer, amount, head, signature | Receipts & Payments | Serial control; unused-book custody; posting | Missing receipt numbers; un-deposited collections | [Practice/Off: bye-laws] **[NV]** |
| **Payment Register** | Record of all payments made | **Mandatory** (practice-core) | All | Accountant/Cashier | Daily | Date, payee, voucher, mode (cash/cheque), amount, head | Receipts & Payments; P&L | Payment authorization; TDS deducted; head correctness | Payments without sanction; TDS missed | [Practice] **[NV]** |

---

## B. Cheque / bank-instrument control

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cheque Issue Register** | Track cheques issued (control & stop-payment) | **[Practice]** | All (esp. Credit/banks) | Cashier/Accountant | On issue | Cheque no., date, payee, amount, bank a/c, cleared date | Bank Recon; Balance Sheet | Cheque-number continuity; uncleared/stale review | Stale cheques not reversed; number gaps | [Practice] **[NV]** |
| **Cheque Receipt Register** | Track cheques received & deposited | **[Practice]** | All | Cashier | On receipt | Date, drawer, cheque no., bank, amount, deposit/clearance date | Bank Recon; Receipts & Payments | Deposit promptness; dishonour follow-up | Undeposited cheques; dishonours untracked | [Practice] **[NV]** |

---

## C. Membership & share capital

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Member Register** | Statutory record of members | **Mandatory** | All | Secretary | On admission/cessation | Name, address, occupation, shares held, admission date, cessation date, nominee | Balance Sheet (share capital) | Membership eligibility; nominee records; reconciliation with share capital | Members not updated; nominee missing; ineligible members | [Off: MCS Rule 32, Form I; MSCS Act] **[NV per state form]** |
| **Share Register** | Record share capital held/allotted per member | **Mandatory** | All (share-capital societies) | Secretary | On issue/change | Member, share cert. no., no. of shares, value, allotment date | Balance Sheet (share capital) | Share-capital tie-out; certificate control | Share ledger ≠ balance sheet; certificates unissued | [Off: MCS Form J; MSCS Act] **[NV per state form]** |
| **Share Transfer Register** | Record transfers of shares/interest between members | **Mandatory where transfers occur** | All (esp. Housing) | Secretary | On transfer | Transferor, transferee, shares, date, transfer fee/premium, approval | Balance Sheet | Transfer approval; premium/ceiling compliance | Transfer premium above ceiling; unapproved transfers | [Off: state Act/bye-laws; Housing bye-laws] **[NV per state]** |
| **Dividend Register** | Record dividend declared/paid per member | **Mandatory where dividend paid** | All paying dividend (esp. Credit, Consumer, Marketing) | Accountant/Secretary | Annually (post-AGM) | Member, shares, dividend rate, amount, payment/unpaid status | P&L appropriation; Balance Sheet | Dividend within statutory cap; AGM sanction; unpaid-dividend tracking | Dividend beyond cap; paid without AGM sanction; unpaid not tracked | [Off: state Act (dividend cap)] **[NV per state cap]** |

---

## D. Credit / lending (applicable to Credit types)

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Loan Register / Ledger** | Record loans disbursed, repayments, interest, overdue | **Mandatory (where lending)** | Credit (PACS, credit/thrift, MSCS credit, banks) | Loan clerk/Secretary | On each disbursement/repayment | Borrower, loan type, sanction, disbursement, interest rate, EMI/schedule, repayments, overdue, NPA status | Balance Sheet (advances); P&L (interest) | Loan eligibility/documentation; NPA classification & provisioning; overdue interest exclusion | Ineligible/benami loans; NPA misclassified; overdue interest booked as income; missing loan bonds | [Off: NABARD CAS; RBI/NABARD norms] |
| **Demand, Collection & Balance (DCB) Register** | Track demand raised, collection, and balance outstanding | **Mandatory (credit societies)** | Credit (esp. PACS) | Secretary/Accountant | Periodic (season/quarter) | Member, demand, collection, balance, overdue period | Recovery/overdue statements; Balance Sheet | Recovery %; overdue ageing; demand-vs-collection tie-out | Demand understated; collection misposted; overdue ageing wrong | [Off: NABARD/DCCB returns] |
| **Advance Register** | Track advances (to members, staff, suppliers) | **[Practice]** | All (esp. Marketing, Labour) | Accountant | On advance/adjustment | Party, purpose, amount, date, adjustment/recovery status | Balance Sheet (current assets) | Advance recovery/adjustment; ageing | Long-outstanding unadjusted advances | [Practice] **[NV]** |
| **Security Deposit Register** | Track deposits taken/given (EMD, tender, tenancy) | **Mandatory where applicable** | Labour, Marketing, Industrial, Housing | Accountant/Secretary | On receipt/refund | Party, purpose, amount, date, refund/forfeiture | Balance Sheet (liabilities/assets) | Deposit reconciliation; refund/forfeiture validity | Deposits not reconciled; refunds pending | [Practice/Off: bye-laws] **[NV]** |

---

## E. Fixed assets & investments

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Fixed Asset / Property Register** | Record fixed assets, location, cost, disposal | **Mandatory** | All holding assets | Accountant/Secretary | On acquisition/disposal; annual review | Asset ID, description, cost, date, location, disposal, WDV | Balance Sheet (fixed assets) | Physical verification; existence & title; disposal approval | Assets not physically verified; ghost assets; disposals unrecorded | [Off: MCS Rule 65 (property register)] |
| **Depreciation Register** | Compute & track depreciation per asset | **Mandatory (with asset register)** | All holding assets | Accountant | Annually | Asset, cost, rate, method, opening WDV, dep., closing WDV | P&L (depreciation); Balance Sheet | Rate/method consistency; computation accuracy | Wrong rates; depreciation not charged; inconsistent method | [Practice/Off: bye-laws + accounting norms] **[NV]** |
| **Investment Register** | Record investments (deposits, securities, federation/DCCB shares) | **Mandatory where investments held** | All with investments (esp. Credit, Housing) | Accountant/Secretary | On investment/maturity; annual reconcile | Type, institution, amount, date, rate, maturity, interest accrued | Balance Sheet (investments); P&L (interest) | Permitted-investment compliance; interest accrual; existence/certificates | Investments outside permitted list; interest not accrued; certificates missing | [Off: state Act; RBI/NABARD permitted-investment norms] **[NV per state/sector]** |

---

## F. Trading, procurement & inventory (applicable to Trading types)

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Stock Register** | Record inventory receipts/issues/balance, item-wise | **Mandatory (trading societies)** | Trading (PACS inputs/PDS, Marketing, Consumer, Dairy feed, Industrial) | Store-keeper/Secretary | On each movement; year-end physical | Item, opening, receipts, issues, balance, rate, value | Trading account; Balance Sheet (stock) | Physical stock verification; valuation (cost/NRV); shortage analysis | Stock shortages/pilferage; valuation errors; dead stock not written off | [Off: MCS Rule 65 (stock register); NABARD CAS] |
| **Inventory Register** | Detailed sub-record of stock (batch/expiry/location) — often same as stock register | **[Practice]** (sub-set of stock register) | Trading (esp. Consumer, Dairy) | Store-keeper | On movement | Item, batch, expiry, bin/location, quantity | Trading account | Expiry/obsolescence; batch traceability | Expired stock unrecorded; batch not tracked | [Practice] **[NV]** |
| **Purchase Register** | Record all purchases (goods/inputs/produce) | **Mandatory (trading)** | Trading | Accountant | On each purchase | Date, supplier, invoice, item, qty, rate, value, GST | Trading account; P&L; GST returns | Purchase-invoice validity; GST input; three-way match | Purchases without invoice; GST input errors; unrecorded purchases | [Off: NABARD CAS; GST rules] |
| **Sales Register** | Record all sales | **Mandatory (trading)** | Trading | Accountant | On each sale | Date, customer, invoice, item, qty, rate, value, GST | Trading account; P&L; GST returns | Sales completeness; GST output; cash-sales control | Cash-sales suppression; GST output errors | [Off: NABARD CAS (sales register); GST rules] |
| **Supplier (Creditor) Register** | Track supplier balances & dues | **[Practice]** (part of personal ledger) | Trading | Accountant | Continuous | Supplier, purchases, payments, balance, terms | Balance Sheet (creditors) | Creditor confirmation; ageing | Unreconciled creditor balances | [Off: MCS Rule 65 (personal ledger)] |
| **Customer (Debtor) Register** | Track customer/member dues | **[Practice]** (part of personal ledger) | Trading | Accountant | Continuous | Customer/member, sales, receipts, balance | Balance Sheet (debtors) | Debtor confirmation; bad-debt provision | Unrecovered dues; no bad-debt provision | [Off: MCS Rule 65 (personal ledger)] |
| **Procurement Register** | Record procurement operations (MSP/agency) | **Mandatory where procurement done** | Marketing (MSP/NAFED agent), PACS | Secretary/Procurement clerk | Per procurement season | Commodity, farmer, qty, quality, rate, amount, agency terms | Pool/agency settlement; Trading account | Agency-account reconciliation; quality/qty verification | Unreconciled agency accounts; qty/quality disputes | [Practice/Off: agency terms] **[NV]** |
| **Godown / Warehouse Register** | Track goods stored in godown (in/out, storage) | **Mandatory where godown operated** | Marketing, PACS, Consumer | Godown-keeper | On each movement | Commodity, receipt, issue, balance, storage location, charges | Stock/Trading account | Physical godown verification; storage-loss norms | Storage shortages/shrinkage; unrecorded movements | [Practice] **[NV]** |
| **Dead Stock Register** | Record non-consumable/durable articles (furniture, equipment) | **Mandatory (common practice/Off)** | All (esp. Consumer, Dairy, Industrial) | Store-keeper/Secretary | On acquisition/disposal; annual verify | Article, quantity, cost, location, condition, disposal | Balance Sheet (assets) | Physical verification; obsolescence; disposal approval | Dead stock not verified; disposals unrecorded | [Off/Practice: bye-laws] **[NV per state]** |

---

## G. Employees, payroll & tax

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Employee Register** | Record of employees/members engaged | **Mandatory where staff/labour engaged** | All with staff; **Labour** (member-workers, muster) | Secretary/HR | On joining/exit | Name, designation, joining date, pay scale, PF/ESI no. | — (feeds payroll) | Establishment sanction; statutory coverage | Ghost employees; coverage lapses | [Off: labour law where applicable] **[NV]** |
| **Salary / Wage Register** | Record salaries/wages/earnings paid | **Mandatory where wages paid** | All with staff; **Labour, Dairy, Industrial** | Accountant/HR | Monthly / per wage-period | Employee, gross, deductions (PF/ESI/TDS), net, payment date | P&L (salaries); statutory returns | Wage computation; deductions & remittance; muster tie-out | Wages ≠ muster; statutory deductions not remitted | [Off: Payment of Wages/Contract Labour rules] **[NV]** |
| **Attendance / Muster Roll** | Record attendance/work-days (basis of wages) | **Mandatory (Labour); practice elsewhere** | **Labour** (statutory); others [Practice] | Supervisor/Secretary | Daily | Name, date, present/absent, hours/units, overtime | Feeds wage register | Attendance-to-wage tie-out; overtime validity | Muster inflated; attendance-wage mismatch | [Off: Contract Labour (R&A) Central Rules] |
| **TDS Register** | Track TDS deducted & deposited | **Mandatory (where TDS applies)** | All (deducting TDS) | Accountant | On deduction; monthly deposit | Deductee, PAN, section, amount, TDS, challan, return period | TDS returns; Balance Sheet (liability) | Deduction correctness; deposit by 7th; return filing | TDS not deducted/late deposit; PAN errors | [Off: Income-tax Act/Rules] |
| **GST Register** | Track output/input GST | **Mandatory (registered societies)** | Trading & taxable-service types | Accountant | On each taxable txn; monthly return | Invoice, GSTIN, taxable value, CGST/SGST/IGST, ITC | GST returns; Balance Sheet (GST liability) | Output-input reconciliation; return filing; ITC eligibility | ITC wrongly claimed; return mismatch; RCM missed | [Off: GST Act/Rules] |

---

## H. Governance & compliance records

| Register | Purpose | M/O | Applicable types | Maintainer | Freq | Key fields | Related F/S | Audit checks | Common errors | Source / NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Minutes Book (General Meeting)** | Record proceedings/resolutions of general body/AGM | **Mandatory** | All | Secretary | Each general meeting | Date, quorum, agenda, resolutions, attendance | Approves accounts/audit/surplus | AGM held in time; accounts & audit adopted; quorum | AGM not held in time; minutes not signed | [Off: MCS Rule 65] |
| **Minutes Book (Committee/Board)** | Record proceedings of managing committee/board | **Mandatory** | All | Secretary | Each committee meeting | Date, members present, decisions, resolutions | Governs financial approvals | Meeting frequency; decision authorization | Meetings not held; decisions unminuted | [Off: MCS Rule 65] |
| **Board Resolution Register** | Index of specific board resolutions (loans, investments, sanctions) | **[Practice]** (subset of committee minutes) | All | Secretary | On resolution | Resolution no., date, subject, decision, authority delegated | Supports transactions in F/S | Resolution support for major transactions | Transactions without resolution | [Off/Practice: within committee minutes] **[NV]** |
| **AGM Register** | Record of AGMs held (dates, business, elections) | **[Practice]** (subset of GM minutes) | All | Secretary | Annually | AGM date, business transacted, elections, accounts adopted | Governs annual approvals | AGM timeliness; statutory business covered | Late/omitted AGM; business incomplete | [Off/Practice: within GM minutes] **[NV]** |
| **Audit Objection & Rectification Register** | Record audit objections and their rectification/compliance | **Mandatory** | All | Secretary | On audit / rectification | Objection, audit para, action taken, rectification date, follow-up report | Links to audit report & Registrar filing | Rectification of prior-year objections; follow-up to Registrar (commonly within 3 months of AGM) | Objections not rectified; no follow-up report filed | [Off: MCS Rule 65 (audit-objection register)] |
| **Legal Case Register** | Track disputes/arbitration/litigation | **[Practice]** | All (esp. Credit, Housing) | Secretary | On case event | Case no., party, forum, subject, amount, status, provision | Balance Sheet (contingent liabilities) | Contingent-liability disclosure; provision adequacy | Cases undisclosed; no contingent-liability note | [Practice] **[NV]** |

---

## Official vs practice — summary

| Statutory (official source cited) | Industry practice / bye-law-driven (no direct statute found) |
|---|---|
| Cash Book; General & Personal Ledger; Stock Register; Property/Fixed-Asset Register; Audit-Objection Register; Minute books (GM + committee) — **[MCS Rule 65]** · Member Register (Form I), Share Register (Form J) — **[MCS Rules]** · Day Book, Sales Register, GL heads, vouchers, NPA/loan norms — **[NABARD CAS]** · TDS/GST/Purchase/Sales — **[tax Acts]** · Muster Roll/Wage — **[Contract Labour Rules]** | Petty Cash; Bank Book (if separate); Journal Register; Receipt Book; Payment Register; Cheque Issue/Receipt registers; Advance; Security Deposit; Depreciation Register; Inventory (batch); Supplier/Customer registers; Procurement; Godown; Dead Stock; Employee Register; Board Resolution/AGM registers; Legal Case register |

**Needs-Verification (state/sector variation):** register **form names/numbers** (Form I/J are Maharashtra) **[NV per state]**; exact prescribed register list under each state's equivalent of Rule 65 **[NV per state]**; dividend-cap and permitted-investment lists **[NV per state/sector]**; NABARD CAS full subsidiary-register set (verify against the official NABARD CAS Manual) **[NV]**; applicability of labour/PF/ESI registers to member-worker cooperatives **[NV]**.

**Sources consulted (indicative, official-first):** Maharashtra Co-op Societies Act 1960 & Rules 1961 — Rule 65, Rule 32, Forms I/J (indiacode.nic.in; sahakarayukta.maharashtra.gov.in; mahapanan.maharashtra.gov.in); NABARD Common Accounting System for PACS/LAMPS (NABARD; State Cooperation dept CAS manuals, e.g. Tripura); Multi-State Co-op Societies Act 2002 (indiacode.nic.in; mscs.dac.gov.in); Income-tax Act & GST Act/Rules; Contract Labour (R&A) Central Rules; State RCS audit manuals (Kerala, Delhi, Assam).

---

*End of Research Task 2.3. Per instruction, stopping here — accounting records only; no software, no competitors, no features.*
