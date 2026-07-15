# SahakarLekha Research Task 3.4 — Business Data Architecture

**Scope:** Business data architecture only. No SQL, no schema, no code, no UI, no new research. Based on prior findings. **Types:** Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = PACS/credit-thrift/MSCS-credit/coop-banks; else All. Parts 1+3 merged into the master table, Parts 2+3 into the transaction table.

## PART 1 & 3 — Business Master Data (21 entities)
*All rows below are **Master** data.*

| Entity | Purpose | Owner | Related modules | Depends on | Generates | Updated by | Importance |
|---|---|---|---|---|---|---|---|
| **Society** | Tenant root; identity & config | Society Admin | All | — | All society data | Society Admin | Core |
| **Member** | Member records & lifecycle | Secretary | Member, Share, Loans, Deposits | Society | Share/loan/deposit/dividend txns | Secretary | Core |
| **Employee** | Staff records | Secretary/HR | Payroll | Society, Department | Salary txns | HR | High |
| **Customer** | Buyers of goods/services | Sales | Sales | Society | Sales txns | Sales | High (Trading) |
| **Supplier** | Input/goods sellers | Procurement | Procurement | Society | Purchase txns | Procurement | High (Trading) |
| **Vendor** | Service/expense providers | Accountant | Procurement, Payments | Society | Payment txns | Accountant | Medium |
| **Bank** | Bank accounts & mandates | Accountant | Cash & Bank | Society | Bank txns | Accountant | Core |
| **Branch** | Society branches/units | Society Admin | All (scoped) | Society | Branch-scoped data | Society Admin | High (MSCS/multi-branch) |
| **Godown** | Storage locations | Store Keeper | Inventory, Godown | Society/Branch | Stock movements | Store Keeper | High (Trading) |
| **Item** | Goods/inputs/produce | Store Keeper | Inventory, Sales, Procurement | Category, Unit | Stock/sales/purchase | Store Keeper | High (Trading) |
| **Asset** | Fixed assets | Accountant | Assets | Society | Depreciation | Accountant | Medium |
| **Tax** | GST/TDS/PT rate masters | Accountant | Accounting, Sales, Procurement, Payroll | — | Tax computation | Accountant | High |
| **Ledger (COA)** | Account heads | Accountant | Accounting, all | Society | All financial postings | Accountant/Admin | Core |
| **Cost Centre** | Activity/branch cost tracking | Accountant | Accounting, Budget | Society/Branch | Cost allocation | Accountant | Medium |
| **Department** | Org units | Secretary | Payroll, HR | Society | Employee grouping | Secretary | Medium |
| **User** | System users | Society/Super Admin | All (access) | Role, Society | Audit trail | Admin | Core |
| **Role** | Permission sets | Super/Society Admin | All | — | Permissions | Admin | Core |
| **Financial Year** | Accounting period | Society Admin/Secretary | Accounting, all | Society | Period scope, closing | Secretary | Core |
| **Unit (UOM)** | Units of measure | Store Keeper | Inventory, Sales, Procurement | — | Quantity basis | Store Keeper | Medium |
| **Category** | Item/account classification | Accountant/Store Keeper | Inventory, Accounting | — | Grouping/routing | Owner | Medium |
| **Document Type** | Document classification | Society Admin | Document Mgmt | — | Doc indexing/retention | Admin | Medium |

## PART 2 & 3 — Transaction Data (19 types)
*All rows below are **Transaction** data; each generates postings via a Voucher.*

| Transaction | Purpose | Owner / updated by | Related modules | Depends on (masters) | Generates | Importance |
|---|---|---|---|---|---|---|
| **Voucher** | Base financial document | Accountant | Accounting | Ledger, FY | Ledger postings | Core |
| **Journal** | Adjustment/non-cash entries | Accountant | Accounting | Ledger | Postings | Core |
| **Receipt** | Money received | Cashier | Cash & Bank | Member/Customer, Bank, Ledger | Ledger, cash update | Core |
| **Payment** | Money paid | Cashier/Accountant | Cash & Bank | Supplier/Vendor/Employee, Bank | Ledger, TDS | Core |
| **Contra** | Cash–bank transfers | Cashier | Cash & Bank | Bank | Postings | High |
| **Purchase** | Goods/inputs bought | Procurement | Procurement | Supplier, Item, Tax | Stock, creditor, GST input | High (Trading) |
| **Sales** | Goods/services sold | Sales | Sales | Customer, Item, Tax | Stock reduction, debtor, GST output | High (Trading) |
| **Procurement (MSP/pool)** | Produce procured | Procurement | Procurement | Member/farmer, Item | Stock, farmer payment, commission | High (Marketing/PACS) |
| **Inventory Movement** | Stock in/out | Store Keeper | Inventory | Item, Godown | Stock balance | High (Trading) |
| **Salary** | Wages/salary paid | Accountant/HR | Payroll | Employee, Tax | Ledger, PF/ESI/TDS | High |
| **Loan** | Loan lifecycle | Loan officer | Loans | Member, Ledger | DCB, interest, NPA | Core (Credit) |
| **Deposit** | Member deposits | Accountant | Deposits | Member | Interest, maturity | Core (Credit) |
| **Dividend** | Dividend distribution | Accountant | Share Capital | Member, Share, FY | Ledger, dividend register | High |
| **Share Transaction** | Issue/transfer/refund | Secretary | Share Capital | Member | Share register, capital | Core |
| **Asset Purchase** | Asset acquisition | Accountant | Assets | Asset, Supplier | Asset register, depreciation base | Medium |
| **Depreciation** | Periodic depreciation | Accountant | Assets | Asset | Ledger, WDV | Medium |
| **Stock Adjustment** | Corrections/write-off | Store Keeper | Inventory | Item, Godown | Stock, loss | Medium |
| **Audit Observation** | Audit findings | Auditor | Audit | Society, FY | Objection register, rectification | High |
| **Compliance Activity** | Filings/remittances | Accountant | Compliance | Tax, FY | Compliance log, returns | High |

## PART 4 — Relationships (only)
- Society → Branch → all data (tenant + branch scope)
- Member → Share Capital / Loan / Deposit / Dividend
- Employee → Department → Payroll → Salary
- Supplier → Purchase → Inventory
- Procurement → Inventory → Sales
- Customer → Sales
- Item → Inventory Movement / Purchase / Sales (via Unit, Category)
- Godown → Inventory Movement
- Asset → Asset Purchase → Depreciation
- **Every transaction → Voucher → Ledger (COA)** (the central posting relationship)
- Loan → DCB → NPA classification
- Deposit → Interest / Maturity
- Tax → Purchase / Sales / Salary (computation)
- Cost Centre → Ledger postings (allocation)
- Financial Year → all transactions (period scope) → Closing & Appropriation
- Audit Observation → Rectification
- Role → User → Audit Trail

## PART 5 — Master Data Governance
| Entity group | Who creates | Who approves | Who can edit | Who can archive | Validation rules |
|---|---|---|---|---|---|
| Society / Branch / Config | Society Admin | Board | Society Admin | Super Admin | Unique reg. no.; area of operation; society type |
| Member | Secretary | Committee | Secretary | **Never delete — mark inactive** | Unique membership no.; KYC; eligibility; **nominee mandatory** |
| Employee | HR/Secretary | Manager | HR | Inactive on exit | Unique ID; PAN; PF/ESI where applicable |
| Customer / Supplier / Vendor | Sales/Procurement | Manager | Owner | **Rename "[deleted]" if referenced**, else inactive | Unique code; GSTIN/PAN format |
| Bank | Accountant | Society Admin | Accountant | Society Admin | Account no.; IFSC; joint-signatory mandate |
| Item / Unit / Category / Godown | Store Keeper | Manager | Store Keeper | Manager (inactive) | Unique code; valid UOM & category; reorder level |
| Asset | Accountant | Committee (capex) | Accountant | On disposal (committee) | Unique tag; cost; depreciation rate |
| Ledger (COA) / Tax / Cost Centre | Accountant | Society Admin | Accountant (restricted once posted) | **Never delete if postings exist** — inactivate | Unique code; group; opening = prior audited closing; valid tax rate |
| User / Role | Admin | Society Admin | Admin | Disable (retain trail) | Unique login; assigned role; tenant/branch scope |
| Financial Year | Society Admin | Board/AGM | Locked once closed | Retain ≥10 years | No overlap; prior FY closed before next opens |
| Document Type | Society Admin | — | Admin | Admin | Retention period defined |

**Cross-cutting data rules:** unique codes per society; **referential integrity — referenced masters are never hard-deleted** (rename/inactivate); opening balances tie to prior-year audited closing; FY periods non-overlapping and lock on closure; member/share/ledger records are effectively permanent; every master change is logged to the audit trail.

*End of Task 3.4 — stopping here. Business data architecture only; no SQL, schema, code, or UI. (~1,010 words.)*
