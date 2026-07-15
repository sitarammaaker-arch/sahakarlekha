# SahakarLekha Module Blueprint — Cash & Bank

**Scope:** Enterprise functional blueprint only. No code, SQL, schema, or UI. Based on prior findings. Cash & Bank is **universal to all eight cooperative types** — "Priority = Core" reflects that.

**Uniform context (stated once):** **Dependencies** for all sections = Accounting Core (COA, voucher engine, GL), Bank master, Authorization matrix, Audit trail, Notification engine. **Approval** = per society authorization matrix (amount-based); two signatories for bank; maker-checker for electronic payments. **Audit** = every transaction logged append-only (who/what/when/before/after/reason). **Exceptions** = invalid entries rejected; on cloud-save failure → local rollback + destructive alert (no silent divergence).

## Section matrix (20)

| Section | Purpose | Inputs → Outputs | Business rules | Validation | Pri |
|---|---|---|---|---|---|
| **1 Module Scope** | Manage all cash & bank operations | Money movements → cash/bank ledgers, reconciliation | Covers receipts, payments, contra, cheques, reconciliation, petty cash for all societies | Within accounting core | Core |
| **2 Business Processes** | Define workflows | Transaction triggers → posted vouchers | Cash receipt, cash payment, bank receipt, bank payment, contra, reconciliation, petty cash | Each follows voucher lifecycle | Core |
| **3 Lifecycle** | Transaction states | Entry → posted/reconciled | Draft→Verified→Approved→Posted→Reconciled→Locked | Valid transition; reason on reject | Core |
| **4 Master Data** | Reference data | Config → bank/cash masters | Bank accounts (a/c no, IFSC, signatory mandate); cash books; petty-cash imprest | Unique account; valid IFSC; mandate set | Core |
| **5 Transactions** | Financial events | Receipt/payment/contra → vouchers + ledger | Types Receipt, Payment, Contra; cheque issue/receipt tracking | Balanced; valid account | Core |
| **6 Business Rules** | Operating rules | — | **Cash-holding limit; daily cash verification; joint bank signatories; maker-checker e-payments; stale-cheque review** | Limit & signatory enforced | Core |
| **7 Validation Rules** | Correctness gates | Draft entry → validated entry | Dr = Cr; **no negative cash**; valid account; FY open; TDS on applicable payments | Pre-post checks pass | Core |
| **8 Approval Rules** | Authorization | Verified entry → approved entry | Per matrix by amount; two signatories (bank); maker-checker (NEFT/RTGS/UPI) | Approver authorized | Core |
| **9 Required Documents** | Evidence | Transaction + docs → linked record | Receipt counterfoil; bill/sanction (payment); deposit slip; cheque details | Doc attached where required | High |
| **10 Accounting Impact** | Ledger effect | Voucher → GL postings | Receipt: Dr Cash/Bank Cr party/income; Payment: Dr expense/party Cr Cash/Bank (Cr TDS); Contra: Cash↔Bank | Balanced | Core |
| **11 Dependencies** | Linkages | — | Accounting core, Bank master, matrix, audit trail, notifications | Deps available | Core |
| **12 Exceptions** | Error handling | Failed action → rejected/rolled-back | **Negative cash blocked**; save-fail → rollback + destructive alert; dishonoured-cheque reversal; unreconciled flagged | No partial post | Core |
| **13 Audit Considerations** | Auditability | Actions → immutable trail | Daily cash-verification note; signed BRS; surprise-count support; full trail | Trail complete | Core |
| **14 Applicable Society Types** | Scope | — | All eight types | — | Core |
| **15 Reports** | Outputs | Ledger → statements | Cash book; Bank book; **BRS**; cheque register; petty-cash statement; day-wise cash position | Tie to ledger | High |
| **16 Dashboards** | Monitoring | Ledger → live view | Daily cash/bank position; pending reconciliation; stale cheques; negative-cash indicator | Real-time | Medium |
| **17 Notifications** | Alerts | Events → notifications | Negative cash; large payment; cheque dishonour; reconciliation-due; unusual transaction | Role-routed | Medium |
| **18 Integrations** | External links | Bank/gateway → reconciliation/payments | Bank statement import & reconciliation; UPI/payment gateway; NEFT/RTGS | Versioned adapter; no data loss | High (V1: bank) |
| **19 Risks** | Risk view | — | Negative cash; **duplicate payment**; unauthorized-payment fraud; stale cheques; non-reconciliation | Mitigations: maker-checker, dual-sign, alerts | Core |
| **20 Future Enhancements** [Optional] | Roadmap | — | Auto bank-feed reconciliation; UPI collections; cash-flow forecasting; AI duplicate/anomaly detection | — | Future |

## Module invariants (cross-cutting)
- **No negative cash** — a cash payment cannot exceed cash-in-hand; blocked at validation.
- **Daily cash verification** — physical cash reconciled to cash book each day; discrepancy logged.
- **Monthly signed BRS** — bank book reconciled to statement; stale/uncleared items reviewed.
- **Joint control on bank** — two authorized signatories; maker-checker on electronic payments.
- **No hard delete** — corrections via reversal/soft-cancel; every entry retained ≥10 years.
- **No silent divergence** — local state always reconciles with cloud; failure rolls back visibly.
- **Dishonour handling** — bounced cheques reversed and followed up, not silently dropped.

*End of Cash & Bank Module Blueprint — functional blueprint only; no code, SQL, schema, or UI. STOP. (~620 words.)*
