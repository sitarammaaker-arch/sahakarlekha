# SahakarLekha Product Blueprint 4.2 — General Ledger & Accounting Engine

**Scope:** Accounting-engine blueprint only. No SQL, code, schema, or UI. Based on prior findings. **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = credit types.

**Uniform rules (apply to every topic below — stated once):**
- **Approval:** posting occurs on approval per the society's **authorization matrix** (amount + type + role); **maker-checker** for high-risk (payments, loans, unlock, FY-close).
- **Error handling:** unbalanced or invalid entries are **rejected with a clear message**; on cloud-save failure the local state is **rolled back with a destructive alert** (no silent divergence); FY-locked periods block all mutation.
- **Audit:** every create/update/delete/approve/reverse is logged (who/what/when/before/after/reason/approval), **append-only**.
- **Types:** All unless a type note is given.

## Accounting-engine topic matrix (20)

| Topic | Purpose | Business rules | Inputs → Outputs | Validation rules | Type note |
|---|---|---|---|---|---|
| **1 General Ledger** | Consolidate all postings head-wise | Double-entry; real-time posting; control accounts | Voucher entries → ledger balances, TB | Dr = Cr; valid account; period open | — |
| **2 Ledger Groups** | Group ledgers under control heads | Every ledger in exactly one group; group rolls to a statement line | COA config → grouped balances | Group assigned; valid class | — |
| **3 Chart of Accounts** | Master account list | 5-class coded hierarchy; **CAS heads for PACS**; per-category sales/purchase routing | Template + society extension → account master | Unique code; group set; opening = prior audited closing | CAS: PACS |
| **4 Voucher Engine** | Capture all financial events | Types Receipt/Payment/Journal/Contra (+ trading notes); balanced; posts to GL on approval; **soft-cancel + reversal** | Transaction data → postings, voucher record | Dr = Cr; period open; FY not locked | — |
| **5 Voucher Numbering** | Unique serial trail | **Gap-free serial per type / FY / branch** | Type, FY, branch → voucher no. | No gaps or duplicates | — |
| **6 Financial Year** | Period boundary | Apr–Mar default, configurable; one active FY + prior-year adjustment window; lock on close | Society config → period scope | No overlap; prior FY closed before next opens | — |
| **7 Opening Balances** | Continuity | = prior-year **audited** closing; reverse prior provisions; no manual override post-audit | Prior audited B/S → opening ledger | Opening TB balanced; matches prior closing | — |
| **8 Journal Processing** | Non-cash / adjustment entries | Balanced JV; **narration + support mandatory**; approval before post | Adjustment data → postings | Dr = Cr; narration present; period open | — |
| **9 Posting Rules** | How transactions hit GL | Each transaction → voucher → GL; **per-item routing** (sales/purchase by account, default 4101/5101); control-account update | Voucher → GL postings | Routing account exists; balanced | Trading (routing) |
| **10 Trial Balance Logic** | Verify books balance | Sum all ledger Dr/Cr; must tally; **single computation layer** | GL balances → TB | Total Dr = Total Cr | — |
| **11 Balance Sheet Logic** | Position statement | Assets = Liabilities + Own Funds; from grouped GL; per-type format | TB / groups → Balance Sheet | A = L + E; ties to TB | — |
| **12 Income & Expenditure Logic** | Surplus/deficit (or P&L) | Nominal accounts → I&E / P&L; appropriation below net result | Income/expense ledgers → I&E / P&L | Matches TB nominal totals | Trading: + Trading a/c |
| **13 Receipt & Payment Logic** | Cash-basis statement | Actual cash/bank in–out; opening + receipts − payments = closing | Cash/bank postings → R&P | Closing = cash + bank balance | — |
| **14 Cash Flow Logic** | Liquidity view | Classify operating / investing / financing | Cash/bank movements → cash-flow statement | Net = closing − opening cash | esp. large/federations |
| **15 Cost Centres** | Activity/branch cost tracking | Allocate direct/indirect per centre; optional | Postings + centre tag → centre-wise P&L | Allocation basis defined | Multi-activity |
| **16 Fund Accounting** | Earmarked funds separate | Separate fund ledgers; utilisation per bye-law; **fund backed by investment** | Appropriation, fund txns → fund statements | Fund balance ≥ 0; backing investment linked | esp. Housing/PACS |
| **17 Inter-Branch Accounting** | Multi-branch consolidation | Inter-branch account **nets to zero**; branch ledgers + HO consolidation | Branch postings → consolidated statements | Inter-branch nets zero; reconciled | Multi-branch/MSCS |
| **18 Year-End Closing** | Close & appropriate | Accruals/depreciation/provisions/NPA → closing entries → **appropriation (reserve ≥25% → education → funds → dividend)** → FY lock post-AGM | Adjusted TB → final accounts, next-year opening | All accruals passed; appropriation order correct; TB balanced | — |
| **19 Reversal Entries** | Correct/cancel without deletion | Reverse original by contra entry; **never hard-delete**; cascade to dependents | Original voucher → reversal voucher | Reversal ties to original; **reason mandatory** | — |
| **20 Adjustment Entries** | Accruals/prepaid/depreciation/provision | Period-end JVs; accrual basis (CAS); approved | Adjustment data → postings | Balanced; period open; supporting docs | — |

## Engine-level invariants (cross-cutting)
| Invariant | Rule |
|---|---|
| **Balanced books** | No voucher posts unless Dr = Cr; TB must always tally |
| **Single source of truth** | One canonical computation feeds TB, Balance Sheet, I&E/P&L, R&P — **no report-vs-source drift** |
| **Control = subsidiary** | Every control account always equals the sum of its member-wise subsidiaries |
| **No deletion of financial records** | Corrections via reversal only; soft-cancel + cascade; ≥10-year retention |
| **Period integrity** | Postings only in an open period; FY-locked data immutable except via dual-control unlock |
| **Opening = audited closing** | Year rollover carries only board/AGM-adopted audited balances |
| **Appropriation order enforced** | Reserve (≥25%) → education fund → other funds → dividend (within cap) → carry-forward |

*End of Blueprint 4.2 — accounting-engine blueprint only; no SQL, code, schema, or UI. STOP. (~880 words.)*
