# SahakarLekha Product Blueprint 4.3 — Voucher Engine

**Scope:** Voucher-engine blueprint only. No code, SQL, schema, or UI. Based on prior findings. **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial.

**Uniform rules (apply to every topic — stated once):**
- **Approval:** per the society's **authorization matrix** (amount + type + role); **maker-checker** for high-risk vouchers (payments, loans, reversals, unlock).
- **Error handling:** invalid/unbalanced vouchers **rejected with a clear message**; cloud-save failure → **local rollback + destructive alert** (no silent divergence); no partial posting.
- **Audit:** create/verify/approve/reject/reverse/cancel logged (who/what/when/before/after/reason/approval), **append-only**.
- **Dependencies:** COA, Financial Year, Authorization matrix, Audit trail (shared by all).
- **Types:** All unless a type note is given.

## Voucher-engine topic matrix (20)

| Topic | Purpose | Business rules | Flow (in → out) | Validation rules | Risks | Type |
|---|---|---|---|---|---|---|
| **1 Voucher Types** | Classify transactions | Receipt, Payment, Journal, Contra (+ Sales/Purchase, Credit/Debit note) | Transaction → typed voucher | Valid type for context | Wrong type distorts reports | All |
| **2 Voucher Lifecycle** | State progression | Draft→Pending→Verified→Approved→Posted→Locked→Archived; Rejected/Cancelled side-states | Voucher → state changes | Only valid transitions; reason on reject/cancel | Stuck items | All |
| **3 Voucher Numbering** | Unique trail | **Gap-free serial per type/FY/branch** | Type, FY, branch → number | No gaps or duplicates | Renumbering/audit gap | All |
| **4 Posting Rules** | Hit the GL | Txn→voucher→GL; **per-item routing** (default 4101/5101); control-account update; post on approval | Approved voucher → GL postings | Dr = Cr; routing account exists | Misposting | Trading (routing) |
| **5 Validation Rules** | Correctness gate | Balanced; valid active accounts; period open; mandatory fields | Draft voucher → validated voucher | Dr = Cr; account active; FY open | Bad data enters books | All |
| **6 Approval Workflow** | Authorize | Matrix-driven levels; maker-checker for high-risk | Verified voucher → approved voucher | Approver authorized for amount/type | Control bypass | All |
| **7 Voucher Locking** | Immutability | Locked on approval / period / FY close; changes via reversal only | Posted voucher → locked | Lock state respected | Back-dated tampering | All |
| **8 Voucher Reversal** | Correct without deletion | Contra reversal ties to original; **reason mandatory**; cascade to dependents | Original → reversal voucher | Original exists; not already reversed | Double reversal | All |
| **9 Voucher Cancellation** | Void an entry | Pre-approval by creator; post-approval **soft-cancel** by Manager/Secretary + reason; cascade reversal | Voucher → cancelled + reversal | Reason present; dependents handled | Orphan references | All |
| **10 Voucher Amendment** | Edit an entry | Only while **Draft**; post-approval → reversal + fresh voucher; edit history logged | Draft voucher → amended voucher | Draft state, or reversal path used | Silent post-approval edit | All |
| **11 Supporting Documents** | Evidence | Attach bill/sanction/KYC; **mandatory for payments** | Voucher + documents → linked record | Required doc attached | Unvouched entries | All |
| **12 Narration Standards** | Clarity & audit | **Mandatory narration**; standard format (party, purpose, reference) | Voucher → narrated entry | Narration present & meaningful | Opaque, unauditable entries | All |
| **13 Multi-Branch Posting** | Branch-scoped entries | Branch tag on voucher; **inter-branch nets to zero** | Branch voucher → branch + consolidated GL | Branch valid; IB reconciled | Unreconciled inter-branch | Multi-branch/MSCS |
| **14 Multi-Society Posting** | Tenant isolation | Society-scoped; **no cross-tenant posting** | Voucher → tenant-scoped GL | Tenant scope enforced | Cross-society leakage | All (multi-tenant) |
| **15 Financial Year Validation** | Period integrity | Post only in an open FY; FY-lock blocks | Voucher → period-validated posting | FY open & not locked | Back-dating into closed FY | All |
| **16 GST Validation** | Tax correctness | GST on taxable vouchers; HSN/rate/GSTIN; ITC eligibility | Taxable voucher → GST postings/returns | Valid rate; GSTIN format; ITC eligible | Wrong ITC / return mismatch | Trading & taxable |
| **17 TDS Validation** | TDS compliance | Deduct where applicable; PAN/section/rate | Payment voucher → TDS entry/liability | Valid PAN; correct section & rate | Missed/late TDS | All (deductors) |
| **18 Cost Centre Allocation** | Cost attribution | Tag centre; allocate direct/indirect; optional | Voucher + centre → centre-wise postings | Centre valid; allocation basis defined | Unallocated common cost | Multi-activity |
| **19 Audit Trail** | Non-repudiation | Log every lifecycle action; append-only; reason on edit/reverse/cancel | Voucher actions → immutable trail | Trail complete for every action | Trail gap / tamper | All |
| **20 Exception Handling** | Safe failure | Invalid → reject with message; save-fail → rollback + destructive alert; escalate blocked items | Failed action → rejected/rolled-back state | No partial post; state consistent | **Silent data loss** | All |

## Voucher-engine invariants (cross-cutting)
| Invariant | Rule |
|---|---|
| **Balanced or blocked** | No voucher posts unless Dr = Cr |
| **No hard delete** | Corrections via reversal/soft-cancel only; ≥10-year retention |
| **Post only on approval** | Draft/Pending vouchers never hit the GL |
| **Locked = immutable** | Approved/period/FY-locked vouchers change only via reversal (or dual-control unlock) |
| **Reason-gated changes** | Reversal, cancellation, unlock require a mandatory reason, logged |
| **No silent divergence** | Local state always reconciles with cloud; failure rolls back visibly |
| **Tenant & period scoped** | Every voucher is bound to one society, branch, and open FY |

*End of Blueprint 4.3 — voucher-engine blueprint only; no code, SQL, schema, or UI. STOP. (~770 words.)*
