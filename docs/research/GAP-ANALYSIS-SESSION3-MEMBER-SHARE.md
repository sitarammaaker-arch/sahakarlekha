# SahakarLekha Gap Analysis — Session 3 (Member Management & Share Capital)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Member Management + Share Capital** (`DataContext.tsx` member/share functions, `types/index.ts` Member, and pages Members/MemberApplication/ShareRegister/NominationRegister/TransferRegister/ProfitDistribution). Measured against Blueprints 4.4 (Member Management) & 4.5 (Share Capital) and CLAUDE.md RULES. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Member model** (`Member`): id, memberId, name, fatherName, address, phone, `shareCapital: number`, `admissionFee: number`, `memberType` (`member` | `nominal`), joinDate, `status` (`active` | `inactive`), share fields (`shareCertNo/shareCount/shareFaceValue`), single-nominee fields (`nomineeName/Relation/Phone/Age/Occupation/Address/Shares/FatherName`), application fields (`approvalStatus`, age, occupation, **caste** (statutory), tehsil/district/state/pinCode), paymentMode.

**Member lifecycle.** `addMember` — if `approvalStatus === 'pending'`, stores only (no vouchers); on approval (`approveMember`) it **auto-posts** the Share-Capital receipt (Dr Cash / Cr Share Capital) and Admission-Fee receipt (Dr Cash / Cr Admission Fee), member-tagged. `rejectMember` sets status. `updateMember` **resyncs (rewrites) the join voucher** when `shareCapital`/`admissionFee` change. `deleteMember` **hard-deletes** the member row and soft-cancels linked vouchers (RULE 3).

**Share capital.** Held as a **scalar `member.shareCapital`**, mutated by three functions, each posting a dated journal/receipt voucher with **RULE-1 rollback**:
- `purchaseShareCapital` — Dr Cash/Bank, Cr Share Capital; increments the scalar.
- `refundShareCapital` — Dr Share Capital, Cr Cash/Bank (separate dated voucher; original join receipt left intact); decrements the scalar.
- `transferShareCapital` — routes through a **suspense account (9999)**: Dr Share Cap/Cr Suspense (from) + Dr Suspense/Cr Share Cap (to), net-zero on the control; updates both scalars with dual rollback.

**Housing flat transfer** (`TransferRegister`) is a separate concept — captures **fee → 4201 (income), premium → 1202 (sinking fund)**, plus `resolutionNo/resDate` (committee resolution).

**Verdict:** member/share flows are **well-instrumented for data integrity** (RULE-1 rollback throughout; RULE-3 cascade; **post-on-approval** for member capital — better than the generic voucher engine). The gaps are structural: a **scalar share model rather than a share ledger**, a **hard-deletable member**, and large parts of the statutory member/share lifecycle absent.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **Member is hard-deleted** | `deleteMember` calls `supabase.from('members').delete()`. Violates Blueprint 4.4 ("members are **never deleted** — inactive only") and the project soft-delete principle. Member history is lost; only a `console.info('[AUDIT-DELETE]')` remains (not a persistent trail). |
| BR-2 | **Share capital is a scalar, not a ledger** | `member.shareCapital: number` is a running total, not a per-transaction share ledger (allotment/transfer/surrender history). `shareCount/shareCertNo/shareFaceValue` exist but are loosely maintained; no certificate lifecycle. Blueprint 4.5 requires a member-wise share ledger tied to control. |
| BR-3 | **Dual source of truth (control ≠ subsidiary risk)** | Dividend (`ProfitDistribution`) uses `member.shareCapital`; the Balance Sheet uses the Share-Capital account (from vouchers). Both are mutated in parallel; nothing structurally guarantees `Σ member.shareCapital == account 110x balance`. Drift → dividend ≠ capital. |
| BR-4 | **Edit rewrites historical voucher** | `updateMember` resyncs (rewrites in place) the original join receipt when `shareCapital` changes — a back-dating mutation of a historical financial voucher, rather than posting a new allotment/refund. |
| BR-5 | **No transferee-eligibility / approval gate on share transfer** | `transferShareCapital` performs no eligibility check, no committee-approval gate, and no premium/cap. |
| BR-6 | **Nominee not mandatory** | `nomineeName` is optional (`|| undefined`), no `required` in the application form. Blueprint 4.4 and cooperative statute require a nominee. |
| BR-7 | **Member status is binary** | `MemberStatus = 'active' | 'inactive'` only — no resignation/expulsion/death/suspended states, so lifecycle transitions collapse to a flag. |

---

## 3. Missing Features (vs Blueprints 4.4/4.5)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Member-wise share ledger** with per-transaction history + certificate lifecycle (issue/transfer/cancel, serials) | P0 |
| MF-2 | **Soft-delete / inactivate member** (replace hard delete) | P0 |
| MF-3 | **Full member lifecycle**: resignation, **expulsion** (resolution/due-process), **death handling** (nominee/heir transfer), reactivation-with-eligibility | P1 |
| MF-4 | **Mandatory nominee** + multiple nominees with %-sum-100 | P1 |
| MF-5 | **Share forfeiture, surrender-with-lock-in, redemption, bonus shares** | P1 |
| MF-6 | **Transfer premium cap** (e.g. ₹25,000 Maharashtra housing) + fee/premium on the share (not just housing-flat) transfer | P1 |
| MF-7 | **KYC document verification** (ID/address proof, PAN) + document linkage — currently demographic fields only | P1 |
| MF-8 | **Control = subsidiary reconciliation** (Σ member.shareCapital == Share-Capital account) as an invariant/report | P1 |
| MF-9 | **Joint membership / joint share holding** (no `jointHolders`/operation-mode) | P2 |
| MF-10 | **Member categories** beyond `member`/`nominal` (associate; type-specific) | P2 |
| MF-11 | **Duplicate share certificate** (indemnity workflow) + three-way audit tie (ledger = register = Balance Sheet) | P2 |
| MF-12 | **Committee-approval gate** on share transfer/surrender/forfeiture | P2 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | Nominee not mandatory | Cooperative nomination requirement / Blueprint 4.4 |
| CG-2 | Member records hard-deleted (statutory member register must persist) | Member Register (Form I) / retention |
| CG-3 | No transfer-premium ceiling enforcement | State bye-laws (e.g. ₹25,000 cap) |
| CG-4 | No expulsion due-process / death-succession workflow | Cooperative statute member exit rules |
| CG-5 | Share certificate lifecycle & register not rigorously maintained (scalar model) | Share Register (Form J) |
| CG-6 | Dividend eligibility uses scalar `member.shareCapital`; appropriation order (reserve→education→dividend) not engine-enforced (see Session 2) | Appropriation / dividend cap + AGM gate |

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **Member hard-delete leaves no persistent trail** | Only a `console.info('[AUDIT-DELETE]')`; the member row and its history are gone. No append-only record. |
| AG-2 | **In-place voucher rewrite on member edit** (BR-4) | Historical share receipt is mutated without a reversal/allotment trail. |
| AG-3 | **No share-ledger transaction history** | Allotment/purchase/refund/transfer are reconstructable only from vouchers + the current scalar; there is no dedicated per-member share transaction register. |
| AG-4 | **Control-vs-subsidiary drift is undetectable** | No reconciliation report surfaces a mismatch between `Σ member.shareCapital` and the Share-Capital account. |
| AG-5 | **Transfer/refund reasons & approvals not captured** on the share (non-housing) path | Housing `TransferRegister` captures resolutionNo/date; the generic share transfer/refund does not. |

**Positives to preserve (do not regress):** RULE-1 rollback on purchase/refund/transfer (dual-member rollback); **post-on-approval** posting of member share/admission capital; RULE-3 cascade soft-cancel of linked vouchers; refund posts a *separate dated* voucher (join receipt intact); statutory **caste** capture; suspense-routed transfer keeps the control net-zero; housing transfer captures fee/premium/resolution.

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected (Blueprint 4.4/4.5) | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| MS-01 | Member lifecycle | `deleteMember` hard-deletes the row | Soft-delete / inactivate; never delete | Member history & statutory register lost | **P0** | M | Persist model |
| MS-02 | Share model | Scalar `member.shareCapital` | Member-wise share ledger + certificate lifecycle | No transaction history; audit weak | **P0** | XL | Schema, reports |
| MS-03 | Integrity | Dual source (scalar vs account) | Control = Σ subsidiaries invariant + reconciliation | Dividend ≠ capital drift risk | **P0** | L | Share ledger |
| MS-04 | Corrections | Edit rewrites join voucher | New allotment/refund voucher; no in-place rewrite | Back-dating; audit gap | **P1** | M | Voucher engine |
| MS-05 | Nominee | Optional single nominee | Mandatory; multiple with %-sum-100 | Statutory nomination gap | **P1** | M | Member form |
| MS-06 | Lifecycle | active/inactive only | Resignation/expulsion/death/reactivation states | Real exits unmodeled | **P1** | L | Status model |
| MS-07 | Share ops | No forfeiture/surrender/redemption/bonus | Full share operations | Statutory operations unavailable | **P1** | L | Share ledger |
| MS-08 | Transfer | No premium cap; no eligibility/approval gate | Premium ≤ cap; transferee-eligible; committee approval | Compliance & control gap | **P1** | M | Config, RBAC |
| MS-09 | KYC | Demographic fields only | ID/PAN verification + document linkage | Weak KYC | **P1** | M | Documents |
| MS-10 | Audit | Hard-delete → console log only | Append-only member/share audit trail | Non-repudiation gap | **P1** | M | Audit log |
| MS-11 | Joint | No joint membership/holding | Joint holders + operation mode | Housing/credit joint owners unmodeled | **P2** | M | Member model |
| MS-12 | Categories | member/nominal only | + associate / type-specific | Category rules incomplete | **P2** | S | Member model |
| MS-13 | Certificates | Loose fields | Certificate serial lifecycle + duplicate workflow + 3-way tie | Share-register integrity | **P2** | M | Share ledger |

---

## Summary
Member/Share flows are **data-integrity-conscious** (RULE-1 rollback everywhere; post-on-approval capital; RULE-3 cascades) but **structurally thin** against the statutory blueprint. The three P0s are: **(MS-01) stop hard-deleting members**, **(MS-02) replace the scalar share balance with a member-wise share ledger**, and **(MS-03) guarantee control = Σ subsidiaries** so dividend and the Balance Sheet cannot diverge. The lifecycle (expulsion/death/resignation), share operations (forfeiture/surrender/redemption/bonus), mandatory/multiple nominees, transfer-premium cap, and KYC verification are the P1 build-out. Housing flat-transfer (fee/premium/resolution) is a good pattern to generalise to the share path.

*End of Gap Analysis Session 3 — audit only; no code, no changes. STOP.*
