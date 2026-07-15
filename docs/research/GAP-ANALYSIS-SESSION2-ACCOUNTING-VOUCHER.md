# SahakarLekha Gap Analysis — Session 2 (Accounting Engine & Voucher Engine)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Accounting Engine + Voucher Engine** (`src/contexts/DataContext.tsx`, `src/lib/voucherUtils.ts`, `src/lib/storage`). Measured against approved Blueprints 4.2 (Accounting Engine) & 4.3 (Voucher Engine) and CLAUDE.md RULES 1–8. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Shape.** The generic accounting engine is a single large React context — `DataContext.tsx` (~5,124 lines) — holding client-resident state (vouchers, coded chart of accounts, members, loans) synced to Supabase. Vertical engines (dairy/housing/etc.) live in sibling contexts. `voucherUtils.ts` provides line access (`getVoucherLines`, `voucherDrTotal/CrTotal`).

**Voucher model.** Multi-line (`lines[]` of `{accountId, type: Dr|Cr, amount}`) with legacy `debitAccountId/creditAccountId/amount` compatibility fields derived from lines. Types: receipt/payment/journal/contra + compound. Optional overlays: `refType/refId`, `billAllocations`, `editHistory`, `approvalStatus`, `costCentreId`, `groupId`, `isCleared`.

**Persist path (`persistVoucher`).** Implements the RULE-1 two-step pattern: (1) upsert **base columns only** → (2) **verify the row actually exists** (catches RLS/cache no-op) → (3) best-effort patch of **extras** (lines, refs, approval, editHistory, costCentre). On base failure: `onBaseFail` **rolls back local state** + destructive Hinglish toast (15s). Duplicate `voucherNo` (23505) → **renumber (max+1) and retry**.

**Posting.** `addVoucher` enforces a **double-entry balance guard**: sub-rupee residual (<₹1) auto-snapped into the largest deficient-side line; material imbalance (≥₹1) **blocks the save**. Voucher number from `storage.getNextVoucherNo(type, FY, vouchers)` (per-type/FY serial). Posts to the ledger (state) **immediately**.

**Reports/aggregators.** `activeVouchers = vouchers.filter(!isDeleted)` feeds **every** report — `getAccountBalance`, `getTrialBalance`, `getCashBook/BankBook`, `getReceiptsPayments`, `getTradingAccount`, `getProfitLoss`. Trading A/c builds on `getTrialBalance` (shared computation). Trial Balance injects **synthetic accounts for orphan lines** so it always tallies.

**Governance.** `guardFYLocked` is applied on ~all mutations; `addVoucher` has an explicit FY-lock check + a date-outside-FY warning. `cancelVoucher` is **soft-delete** (`isDeleted`, `deletedReason/By/At`). `updateVoucher` mutates in place with an **`editHistory` snapshot**.

**Verdict:** the engine implements CLAUDE.md RULES 1 (rollback), 2 (shared formulas), 4 (per-item routing via account ids), 5 (isDeleted filtering), 6 (FY-lock) **to a high standard**. Gaps are principally vs the *target* blueprint's stricter posting/immutability/appropriation model.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **Approval does not gate posting** | `addVoucher` posts to the ledger immediately; `approvalStatus` is an optional overlay set *after the fact* by `approveVoucher/rejectVoucher`. Blueprint 4.3 requires **post-on-approval / maker-checker**. Reports don't filter by approval, so an unapproved voucher already affects the Trial Balance. |
| BR-2 | **Corrections are in-place edits, not reversals** | `updateVoucher` mutates the posted voucher (with an `editHistory` snapshot). Blueprint 4.3 requires **locked = immutable; change via reversal voucher tied to the original**. There is no reversal-voucher generator (the only "reversal" reference is a merge-guard toast). |
| BR-3 | **Silent sub-rupee amount adjustment** | Residual <₹1 is auto-snapped into the largest line and **not recorded in editHistory** — the user's entered amount is changed without an audit note. Pragmatic, but a silent mutation of a financial figure. |
| BR-4 | **No enforced appropriation order** | Reserve (≥25%) → education fund → dividend is **not engine-enforced**; reserve posting is a manual voucher (Dr 1201/Cr 1208 pattern) detected only in Dashboard compliance checks. Blueprint 4.2 requires an appropriation sequence at year-end. |
| BR-5 | **Opening balance is manually editable** | Accounts carry `openingBalance/openingBalanceType`; the OpeningBalances page is admin-editable. Blueprint 4.2 requires **opening = prior-year audited closing**, carried automatically and locked post-audit. |
| BR-6 | **Voucher numbering not guaranteed gap-free under concurrency** | Number = client-computed `max+1` per prefix; concurrent tills can collide (handled reactively by 23505 renumber-retry on *add* only). A renumber can skip a value; update path has no such retry. |
| BR-7 | **No cost-centre / inter-branch logic** | `costCentreId` is persisted as an overlay but there is **no allocation/validation**; no inter-branch account (no branch dimension — confirmed Session 1). |

---

## 3. Missing Features (vs Blueprints 4.2/4.3)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Approval-before-posting gate** (maker-checker enforced at the engine, not an after-the-fact status) | P0 |
| MF-2 | **Reversal-entry mechanism** (contra reversal tied to the original; replaces in-place edit for posted vouchers) | P1 |
| MF-3 | **Period lock** (monthly/period) — only **FY-lock** exists today | P1 |
| MF-4 | **Automated year-end closing + appropriation** (reserve/education/dividend sequence) | P1 |
| MF-5 | **Opening-balance = audited-closing carry** (auto, locked) instead of manual entry | P1 |
| MF-6 | **Cost-centre allocation** engine (field exists, logic absent) | P2 |
| MF-7 | **Inter-branch accounting** (nets-to-zero control account) | P2 |
| MF-8 | **Fund-accounting engine** (statutory/sinking/repair funds are plain accounts, no backing-investment link) | P2 |
| MF-9 | **Voucher-level GST/TDS validation** layer (handled in specific flows/report pages, not a posting-time validator) | P2 |
| MF-10 | **Concurrency-safe server-side numbering** (sequence/RPC) vs client `max+1` | P2 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | Appropriation order (reserve ≥25% → education → dividend) not enforced | State Act / CLAUDE.md L-appropriation |
| CG-2 | No statutory **period lock**; audit-window immutability limited to whole-FY lock | Audit governance (Blueprint 3.9/4.2) |
| CG-3 | Opening balance not tied to prior-year **audited** closing | Blueprint 4.2 opening-balance rule |
| CG-4 | Posting occurs pre-approval → Trial Balance can reflect unapproved entries | Maker-checker / authorization matrix |
| CG-5 | CAS alignment partial — COA is coded (1201 reserve, 3403 closing stock, 5101 purchase, 4101 sales) but not verified against the full **NABARD CAS** GL/format for PACS | NABARD CAS (Blueprint 2.8/4.2) |
| CG-6 | Correction model (in-place edit) weaker than statutory **reversal-only** expectation for posted entries | Blueprint 4.3 |

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **`editHistory` persistence is best-effort** | It lives in the step-2 **extras** patch, which is allowed to fail with only a mild "saved partially" warning while the base voucher persists. The audit trail of edits is therefore **not guaranteed** even when the entry itself saves. |
| AG-2 | **`approvalStatus` / `costCentreId` share the same fragile extras patch** | A base voucher can post to the GL while its approval status / cost centre silently fails to persist. |
| AG-3 | **No system-wide append-only audit log** | Audit trail = per-voucher `editHistory` + per-record deletion fields (`deletedReason/By/At`). There is **no immutable, WORM/append-only, system-wide audit_log** spanning all entities/actions (Blueprint 3.9). |
| AG-4 | **Silent sub-rupee adjustment unlogged** (see BR-3) | A financial amount is changed with no trail entry. |
| AG-5 | **No before/after diff trail for non-voucher masters** | Account/member/loan edits are not captured in a unified trail. |
| AG-6 | **Reversal vs deletion ambiguity** | Soft-cancel marks `isDeleted` but does not create a linked reversal voucher, so the audit story is "row hidden" rather than "entry reversed by voucher X". |

**Positives to preserve (do not regress):** RULE-1 rollback + row-verify + destructive toast; double-entry balance guard; `activeVouchers` isDeleted filtering everywhere; shared Trial-Balance→Trading computation; orphan-line synthetic accounts; FY-lock coverage; soft-delete with reason/actor; editHistory snapshots (when they persist).

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected (Blueprint 4.2/4.3) | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| AV-01 | Posting | Vouchers post to GL immediately; approval is after-the-fact overlay | Post-on-approval / maker-checker enforced | Unapproved entries hit Trial Balance; control weak | **P0** | L | Approval workflow, RBAC |
| AV-02 | Audit trail | `editHistory` in fragile extras patch (best-effort) | Guaranteed, append-only edit trail | Edit history can be lost while entry saves | **P0** | M | Persist model |
| AV-03 | Audit trail | No system-wide append-only audit log | WORM audit_log across all entities/actions | Non-repudiation gap; audit incomplete | **P0** | L | Schema, all mutations |
| AV-04 | Corrections | In-place edit of posted vouchers | Reversal voucher tied to original; immutable posted | Statutory reversal expectation unmet | **P1** | L | Voucher engine |
| AV-05 | Locking | FY-lock only; no period lock | Monthly/period lock + dual-control unlock | Back-dating within open FY | **P1** | M | FY-lock, RBAC |
| AV-06 | Appropriation | Reserve/education/dividend manual | Engine-enforced appropriation sequence | Compliance/audit objection risk | **P1** | M | Year-end closing |
| AV-07 | Opening balance | Manually editable | Auto = prior audited closing, locked | Wrong openings poison the year | **P1** | M | Year-end, FY-lock |
| AV-08 | Amount integrity | Sub-rupee auto-snap unlogged | Adjustment recorded in trail (or rejected) | Silent change to a financial figure | **P2** | S | Audit trail |
| AV-09 | Overlays | approvalStatus/costCentreId in fragile extras | Base-column or guaranteed persistence | Approval/cost-centre silently lost | **P2** | M | Persist model |
| AV-10 | Numbering | Client `max+1`, reactive 23505 retry (add only) | Server sequence/RPC; gap-free & concurrency-safe | Duplicate/skipped numbers under load | **P2** | M | Backend |
| AV-11 | Cost centre | Field only, no allocation logic | Cost-centre allocation + reporting | Segment reporting unavailable | **P2** | M | Reporting |
| AV-12 | Inter-branch | Absent | Inter-branch control nets to zero | Multi-branch/MSCS unsupported | **P2** | L | Branch dimension |
| AV-13 | Fund accounting | Funds are plain accounts | Fund ledgers + backing-investment link | Sinking/repair fund governance weak | **P2** | M | COA |
| AV-14 | CAS alignment | Coded COA, not verified vs full NABARD CAS | CAS-conformant GL/formats for PACS | PACS refinance/audit conformance | **P2** | M | COA, reports |
| AV-15 | GST/TDS | Handled in flows/reports, not posting-time | Voucher-level GST/TDS validation | Return-mismatch risk | **P3** | M | Tax engine |

---

## Summary
The generic accounting/voucher engine is **materially stronger than the platform-access layer audited in Session 1** — it faithfully implements the data-integrity, double-entry, isDeleted-filtering, formula-consistency and FY-lock rules. The remediation backlog is concentrated in three themes: **(a) posting discipline** (approval-before-post, reversal-not-edit, period lock), **(b) guaranteed auditability** (append-only trail; move editHistory/approval out of the fragile extras patch), and **(c) statutory automation** (appropriation sequence, opening-balance carry, CAS conformance). AV-01/02/03 are the P0 trio.

*End of Gap Analysis Session 2 — audit only; no code, no changes. STOP.*
