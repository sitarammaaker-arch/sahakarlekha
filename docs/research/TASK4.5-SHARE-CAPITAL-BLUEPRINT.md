# SahakarLekha Product Blueprint 4.5 — Share Capital Management Module

**Scope:** Business blueprint & functional spec only. No code, SQL, schema, or UI. Based on prior findings. Share capital is **universal to all eight cooperative types** — "Types = All" unless noted.

**Uniform rules (apply to every topic — stated once):**
- **Approval:** per society **authorization matrix** — allotment/transfer/surrender/forfeiture/duplicate need **committee** approval; bonus/redemption need general-body.
- **Documents:** application/transfer/surrender forms, certificate, indemnity (duplicate), resolution (forfeiture/bonus) as relevant.
- **Dependencies:** Member module, Chart of Accounts (Share Capital control), Authorization matrix, Audit trail.
- **Audit:** every share action logged (who/what/when/before/after/reason), append-only; **share records never hard-deleted**.
- **Exceptions:** ineligible/over-cap actions rejected with reason; escalate to committee.

## Topic matrix (20)

| Topic | Purpose | Business rules (in→out) | Trigger | Accounting impact | Validation |
|---|---|---|---|---|---|
| **1 Share Classes** | Define share classes | Equity/ordinary (some A/B) per bye-laws | Config | — | Valid class |
| **2 Share Types** | Types within class | Ordinary (preference rare); fixed face value | Config | — | Face value set |
| **3 Certificate Management** | Govern certificates | Issue on allotment; serial; custody | Allotment/transfer | — | Unique serial |
| **4 Share Allotment** | Issue shares to member | Min shares on admission; fully paid; face value | Admission/purchase | **Dr Cash/Bank Cr Share Capital** | Member active; amount received |
| **5 Additional Purchase** | Member buys more shares | Within max-holding cap; fully paid | Purchase request | **Dr Cash/Bank Cr Share Capital** | Within cap; paid |
| **6 Share Transfer** | Transfer to eligible party | Transferee eligible; fee/premium ≤ cap; family/nominee exempt | Transfer request | No capital change (reallocation); **Cr transfer fee** | Transferee eligible; premium ≤ cap *(esp. Housing)* |
| **7 Share Surrender** | Member gives up shares | On resignation/reduction; refund after lock-in | Surrender | **Dr Share Capital Cr Payable/Bank** | No dues; lock-in met |
| **8 Share Forfeiture** | Forfeit for default/expulsion | Per bye-laws; resolution; due process | Expulsion/non-payment | **Dr Share Capital Cr Forfeiture reserve** | Due process; resolution |
| **9 Share Redemption** | Redeem redeemable shares | Per bye-laws; limited in coops | Maturity/request | **Dr Share Capital Cr Bank** | Redeemable class; funds available *(where allowed [NV])* |
| **10 Joint Share Holding** | Shares held jointly | Primary + joint holders; operation mode | Joint allotment | As allotment | Primary designated *(Housing/credit)* |
| **11 Nominee Handling** | Succession of shares | Nominee mandatory; transfer on death | Admission/death | On death → transfer (no capital change) | Nominee present |
| **12 Dividend Eligibility** | Determine dividend rights | Active members, paid shares; pro-rata to holding & period; within cap | Dividend declaration | **Dr P&L appropriation Cr Dividend payable** | Active; shares paid; AGM approval |
| **13 Bonus Share Handling** | Issue bonus from reserves | From free reserves; general-body approval; rare | Bonus resolution | **Dr Reserves Cr Share Capital** | Reserves adequate; approval *(where allowed [NV])* |
| **14 Share Ledger** | Member-wise share record | Per-member holdings; subsidiary to control | Any share txn | Subsidiary to Share Capital control | Ledger = control |
| **15 Share Register** | Statutory register (Form J) | All allotments/transfers recorded | Any share txn | — | Complete; matches ledger |
| **16 Share Capital Accounting** | Reflect capital in books | Capital = Σ paid member shares; control account | Any share txn | **Share Capital control = Σ member shares** | Control = subsidiary = Balance Sheet |
| **17 Certificate Printing** | Produce certificates | On allotment/transfer; serial; template | Allotment/transfer | — | Unique serial; member details correct |
| **18 Duplicate Certificate** | Reissue on loss | Indemnity/affidavit; approval; original cancelled | Loss report | — | Indemnity; approval |
| **19 Share Capital Audit** | Verify capital integrity | Reconcile ledger vs register vs Balance Sheet; unissued certs | Audit | — | **Three-way tie: ledger = register = BS** |
| **20 Share History** | Member share timeline | All share events retained | Any event | — | Complete chronology |

## Registers
| Mandatory | Optional |
|---|---|
| Share Register (Form J); Share Ledger (member-wise); Share Transfer Register | Forfeiture register; Duplicate-certificate register; Bonus-issue register |

## Reports
| Category | Reports |
|---|---|
| **Mandatory** | Shareholding statement; Share Capital summary |
| **Statutory** | Share Register (Form J); Share Capital in Balance Sheet; Dividend register |
| **Management** | Capital-growth trend; member-wise concentration; transfer activity; dividend-distribution analysis |

## Share-capital invariants (cross-cutting)
- **Control = subsidiary = Balance Sheet** — share-capital control account always equals the sum of member-wise share ledgers and the balance-sheet figure.
- **Fully-paid only** — coop shares are issued fully paid; no partly-paid tracking.
- **Cap enforced** — per-member maximum shareholding enforced on allotment/purchase/transfer.
- **Transfer premium ≤ statutory cap** (e.g. ₹25,000 Maharashtra housing).
- **No deletion** — corrections via reversal; certificates cancelled, not deleted.

*End of Blueprint 4.5 — Share Capital business blueprint only; no code, SQL, schema, or UI. STOP. (~720 words.)*
