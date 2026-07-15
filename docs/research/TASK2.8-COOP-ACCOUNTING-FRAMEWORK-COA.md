# SahakarLekha Research Task 2.8 — Accounting Framework & Chart of Accounts (Indian Cooperatives)

**Scope:** Accounting structure/standards only. No software, no competitors, no features, no theory, no implementation advice. **[NV]** = Needs Verification. **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = PACS/credit-thrift/MSCS-credit/coop-banks. **Common references:** NABARD Common Accounting System (CAS) for PACS (accrual, standard GL heads — Annexure VII, prudential/NPA norms); MCS Rules 1961 Rule 65 (books/ledgers); state acts & bye-laws; MSCS Act 2002. State/type adaptations flagged **[NV per state]**.

## Framework matrix (14 topics)

| Topic (Purpose / Types) | Standard structure & major ledger groups | Typical ledger accounts | Accounting rules | Common mistakes & audit considerations | Official ref / NV |
|---|---|---|---|---|---|
| **1 Chart of Accounts** — master list of all accounts · All | Coded hierarchy: Class → Group → Sub-group → Ledger; 5 classes (Assets/Liabilities/Equity/Income/Expenses) | All ledgers under coded heads | Unique code; consistent grouping; map to statements | Duplicate/misclassified heads · Audit: COA-to-statement mapping | NABARD CAS Annex VII **[NV state adapt]** |
| **2 Account Classification** — classify each account · All | Asset / Liability / Equity / Income / Expense (or Real/Personal/Nominal) | — | Consistent classification | Expense booked as asset; income as liability · Audit: classification correctness | — |
| **3 Ledger Groups** — group ledgers under control heads · All | Fixed assets, current assets, loans, investments, deposits, share capital, reserves/funds, income, expenses | Group control accounts | Each ledger under one group | Wrong grouping · Audit: group totals tie to statements | Rule 65 |
| **4 Control Accounts** — summary controlling subsidiaries · All | Control (GL) ↔ subsidiary (personal) ledgers | Members, loans, deposits, sundry debtors/creditors | Control = Σ subsidiaries | Control ≠ sub-ledger · Audit: reconciliation | Rule 65 |
| **5 Voucher Types** — classify transactions · All | Receipt, Payment, Journal, Contra (+ Sales/Purchase, Credit/Debit note) | — | Serial per type; supporting docs | Wrong voucher type · Audit: voucher-to-entry trail | NABARD CAS |
| **6 Accounting Period** — define financial year · All | Cooperative year **1 Apr – 31 Mar** | — | Annual; some societies vary **[NV]** | Cut-off errors · Audit: period cut-off | State Act |
| **7 Opening Balance Rules** — carry closing to opening · All | Prior-year **audited** closing = current opening | All balance-sheet accounts | Only after audit & AGM adoption; reverse prior provisions | Unaudited/wrong opening · Audit: opening vs prior audited B/S | State Act |
| **8 Closing Entries** — close nominal accounts · All | Transfer income/expense → Trading/P&L → appropriation | P&L, appropriation account | Accrual; provisions before close | Accruals omitted · Audit: closing-entry validity | NABARD CAS |
| **9 Year-End Adjustments** — accruals/provisions · All | Adjustment JVs | Outstanding, prepaid, depreciation, interest accrued, NPA/bad-debt provision | Accrual basis (CAS) | Missing accruals/provisions · Audit: adjustment adequacy | NABARD CAS |
| **10 Financial Statement Structure** — statutory statements · All | Receipts & Payments; Trading (trading types); P&L / I&E; Balance Sheet; DCB (credit) | — | Prescribed format (CAS/state) | Heads misclassified · Audit: format compliance | NABARD CAS; state Act |
| **11 Cost Centres** — track by unit/activity · Multi-activity (PACS multi-business, Marketing, federations) | Activity/branch-wise cost centres | Segment income/expense heads | Allocate direct/indirect costs | Unallocated common costs · Audit: allocation basis | **[NV]** |
| **12 Branch Accounting** — multiple branches · Multi-branch (Credit/MSCS/banks/large) | Branch ledgers + HO consolidation; inter-branch account | Inter-branch/HO account | Inter-branch reconciliation; consolidation | Inter-branch unreconciled · Audit: branch reconciliation | MSCS Act |
| **13 Fund Accounting** — earmarked funds separate · All (esp. Housing, PACS) | Separate fund ledgers + backing investment | Statutory reserve, sinking, repair, education, building fund | Utilisation per bye-law; fund backed by investment | Fund diverted / not invested · Audit: utilisation & backing | Housing bye-laws; state Act |
| **14 Cooperative-Specific Practices** — unique treatments · All | Member-wise capital; appropriation order; prudential norms | Share capital, statutory reserve (≥25%), education fund, dividend (within cap), patronage rebate, member interest, DCB/NPA | Appropriation order: reserve → education → dividend; accrual + NPA norms | Reserve not transferred; dividend above cap; overdue interest as income · Audit: appropriation correctness | State Act; NABARD CAS **[NV cap/state]** |

## SPECIAL SECTION — Generic cooperative Chart of Accounts (coded outline)

*Illustrative coding (Class 1–5). Sales/purchase sub-heads split per category per per-item ledger routing.*

**1000 ASSETS**
- 1100 Fixed Assets — land, building, furniture, equipment, vehicles; (–) accumulated depreciation
- 1200 Investments — FDs, govt securities, shares in DCCB/StCB/federation
- 1300 Loans & Advances (Assets under Management) — member loans (ST/MT/LT), staff advances, other advances
- 1400 Inventory / Stock — inputs, trading goods, produce/WIP/finished goods, dead stock
- 1500 Current Assets — cash in hand, bank balances, sundry debtors, prepaid expenses, interest accrued, TDS/GST receivable
- 1600 Suspense (Assets) — suspense account (Dr), deposits given

**2000 LIABILITIES**
- 2100 Member Deposits — savings, FD, RD, pigmy, thrift
- 2200 Borrowings — DCCB/StCB loans, cash credit, term loans
- 2300 Current Liabilities — sundry creditors, outstanding expenses, security deposits/EMD received
- 2400 Statutory Dues Payable — GST payable, TDS payable, PF/ESI/PT payable
- 2500 Provisions — NPA/bad-debt provision, audit fee, gratuity, taxation
- 2600 Suspense (Liabilities) — suspense account (Cr), unclaimed/unpaid dividend

**3000 EQUITY / OWN FUNDS**
- 3100 Share Capital — member share capital (member-wise)
- 3200 Reserves & Funds — statutory reserve, building fund, dividend equalisation, sinking fund, repair fund, cooperative education fund
- 3300 Surplus — P&L appropriation, undistributed profit / accumulated loss

**4000 INCOME**
- 4100 Operating Income — interest on loans, sales (4101 Fertiliser, 4102 Consumer goods, 4103 … by category), commission, storage/service charges, milk/pool income, procurement commission
- 4200 Other Income — interest on investments/deposits, dividend received, misc/other income

**5000 EXPENSES**
- 5100 Direct / Trading (Procurement) — purchases (5101 Fertiliser, 5102 … by category), cost of inputs, producer/farmer payments, procurement & processing cost
- 5200 Payroll — salaries, wages, honoraria, PF/ESI employer contribution, bonus, staff welfare
- 5300 Administrative Expenses — rent, electricity, printing & stationery, postage/telephone, travel, repairs, audit fee, legal
- 5400 Financial Charges — interest on member deposits, interest on borrowings, bank charges/commission
- 5500 Depreciation & Provisions — depreciation, provision for NPA/bad debts, other provisions
- 5600 Taxes & Levies — professional tax, rates & taxes, non-creditable GST, market fee/cess

**Appropriation (below net profit):** statutory reserve (≥25%) → cooperative education fund → other bye-law funds → dividend (within cap) → carry-forward surplus.

## Consolidated Needs-Verification
| Item | Reason |
|---|---|
| Exact standard COA / GL heads | NABARD CAS baseline for PACS; other types & states adapt **[NV per state/type]** |
| Statutory reserve %, dividend cap, education fund % | State-specific **[NV per state]** |
| Financial-statement prescribed formats | Differ by type (PACS CAS vs housing I&E vs trading) **[NV]** |
| Cost-centre / branch-accounting rules | Practice-driven; not uniformly codified **[NV]** |
| Fund-backing (investment) requirement | Bye-law-specific (esp. sinking fund) **[NV per state]** |
| Accounting period variation | Some societies non-Apr–Mar **[NV]** |

**Official references (indicative):** NABARD Common Accounting System (CAS) for PACS/LAMPS (standard GL, accrual, NPA/prudential norms, Annexure VII heads); Maharashtra Co-op Societies Act 1960 & Rules 1961 (Rule 65 books; funds; Forms I/J); Multi-State Co-op Societies Act 2002 (accounts/consolidation); state cooperative acts & model bye-laws (reserves, sinking/repair/education funds, dividend cap, appropriation order).

*End of Research Task 2.8 — stopping here. Accounting standards & structures only. (~1,050 words.)*
