# SahakarLekha — Canonical Financial Data Model (Accounting Constitution)

- **Status:** Accepted — SSOT for the financial data model. Constitutional: entities and their immutable fields change only by a superseding, ratified revision.
- **Date:** 2026-07-11
- **Binding on:** every save path, report, export, and migration. Where code and this document disagree, this document is the intended target and code is the deviation to be corrected.
- **Governed by:** [ADR-0001 Event Ledger](../adr/0001-event-ledger-system-of-record.md) · [ADR-0002 Capabilities](../adr/0002-capability-driven-architecture.md) · [ADR-0005 Numbering](../adr/0005-voucher-numbering-authority.md) · [ADR-0006 Money](../adr/0006-money-precision.md) · [ADR-0007 Identity](../adr/0007-identity-and-consent-model.md) · [ADR-0009 Federation](../adr/0009-federation-graph.md) · Project RULES 1–8.

> **Scope note.** This defines the *canonical* model — the permanent domain contract. It is **not** the current physical schema. Today's Supabase tables are one (partial, evolving) projection of this model; the migration path is governed by the ADRs. No code or schema is changed by this document.

---

## Part I — Constitutional principles (the accounting laws)

These bind every entity below. An entity definition may add constraints but may never relax these.

- **CL-1 Double-entry integrity.** Every financial effect is expressed as balanced debits and credits. For any voucher, Σ(debit minor-units) = Σ(credit minor-units). No partial or single-sided posting is ever persisted.
- **CL-2 Immutability of the posted record.** A posted transactional record is **append-only and never mutated or hard-deleted**. Corrections are **new reversing records** that reference the original (ADR-0001). "Edit" of a posted voucher = reverse + re-post, both retained.
- **CL-3 Money is exact.** All amounts are **integer minor units (paise)** with an explicit `currencyCode`; never floats. Every rounding step records the policy applied (ADR-0006). Amounts are stored per-entry with a **Dr/Cr indicator**, never as signed magnitudes.
- **CL-4 Derived truth is a projection.** Balances, ledgers, DCB, closing stock, trial balance, and all aggregates are **computed projections** of immutable records — never independently writable master fields. A stored "current" figure (e.g. `currentStock`) is a cache of a projection, reconcilable to the formula at all times (RULE 2).
- **CL-5 Tenant + jurisdiction scoping.** Every record carries `(tenantId, jurisdiction)`, stamped at creation and immutable, so data can be consolidated up and residency-scoped down the federation graph (ADR-0009).
- **CL-6 Identity is referenced, never embedded.** Financial entities reference a **pseudonymous key**; personal data (PII) lives only in the separate Identity/Consent context (ADR-0007). No PII field appears in any entity below.
- **CL-7 Every record is attributable.** Each record and each mutation names its **principal** (human user, AI agent, import, or integration) on the single trust plane (ADR-0010), with capability/authority used.
- **CL-8 Period integrity.** No posting into a period that is FY-locked or period-locked (RULE 6). The lock state at post time is itself recorded.
- **CL-9 Cascade completeness.** Reversing or cancelling a parent record reverses all dependents (linked vouchers, entries, stock movements, sub-ledger effects) as further records — never orphaned, never silently left behind (RULE 3, RULE 5).

---

## Part II — Cross-cutting canonical structures (defined once, referenced by every entity)

### The Record Header (present on every entity)
| Field | Semantics | Immutable |
|---|---|---|
| `recordId` | Globally-unique identity (UUID). Never reused. | 🔒 |
| `tenantId` | Owning society/organization in the federation graph. | 🔒 |
| `jurisdiction` | Governing state/central scope for residency & rules. | 🔒 |
| `schemaVersion` | Version of *this* entity's canonical shape the record was written under. | 🔒 |
| `recordKind` | `master` \| `transactional` \| `agreement`. Governs mutability (see below). | 🔒 |
| `createdAt` | System (event) time of creation — when recorded. | 🔒 |
| `createdBy` | Principal (ADR-0010) + capability used. | 🔒 |
| `source` | `human` \| `agent` \| `import` \| `integration`. | 🔒 |
| `revision` | Monotonic counter for *master* records; each change increments. | — |
| `status` | Lifecycle (`active`/`posted`/`reversed`/`cancelled`/`superseded`), per entity's state model. | — |

**Mutability by `recordKind`:**
- **transactional** (Voucher, Voucher Entry, Stock Movement, Procurement Receipt, Loan Transaction, Share Transaction, Payroll Run line, Depreciation Charge): **immutable after post** (CL-2). Only `status` may transition to `reversed`/`cancelled`, and only by emitting a new reversing record that references this one.
- **master** (Account, Inventory Item, Asset, Employee-ref, Member): mutable via **versioned revisions**; prior versions retained; certain fields immutable per entity.
- **agreement** (Loan agreement, Share class definition): terms are immutable once effective; amendments are new versioned agreements linked to the prior.

### The Audit Envelope (emitted on every create/mutation/reversal)
`who` (principal + capability) · `what` (event payload; for masters, before→after diff) · `when` (event time **and** effective/value date) · `why` (reason/narration; mandatory for reversals & master edits) · `authority` (approval reference(s), SoD attestation, lock state at the time). The envelope is append-only and is the substance of the event log (ADR-0001).

### Money value
`{ amountMinor: integer, currencyCode: string, drCr?: 'Dr'|'Cr' }`. Default `currencyCode = INR`. `drCr` is required on postings (CL-3).

### External-code mapping
Any field that leaves the system (statutory return, NCD exchange, export) is mapped to a **stable external vocabulary** at the boundary (ADR-0004/0008); internal enums are never the wire value.

---

## Part III — The eleven canonical entities

Each carries the Record Header (Part II). Only entity-specific additions are listed.

---

### 1. Account
**Purpose.** The chart-of-accounts head — a classified ledger head against which entries post. The stable identity of financial classification.

**Canonical fields.** `accountCode` (stable within tenant), `name`, `nameHi`, `type` (Asset/Liability/Income/Expense/Equity), `subtype`, `parentAccountCode` (hierarchy), `capabilityOrigin` (which capability seeded it — ADR-0002/RULE 4), `isDefaultRouting` (per-item routing default, e.g. sales/purchase heads, RULE 4), `openingBalance` (as a Money value, tied to an opening event, not a free field), `activeFrom`, `activeTo`.

**Immutable fields.** `recordId`, `accountCode` **once any entry references it** (rename allowed; re-key forbidden), `type` once posted-to (reclassification = new account + migration record, never in-place, to preserve historical reports). Header immutables.

**Relationships.** Referenced by **Voucher Entry** (the posting target); self-referential via `parentAccountCode`; seeded by **capability** COA templates; sub-ledger accounts linked to Member/Supplier/Customer (a control account + party sub-ledger).

**Audit requirements.** Every create/rename/reclassify emits an envelope with before→after. A referenced account may be **deactivated but never deleted**; a party account whose party is removed is renamed (`"<name> [deleted]"`), never dropped (RULE 3).

**Versioning.** Master; `revision` increments per change; prior versions retained. `schemaVersion` gates shape changes.

**Future compatibility.** New account types/subtypes and classification standards arrive as **rule data** (ADR-0008), not enum edits. `capabilityOrigin` lets new capabilities extend the COA additively without touching existing heads.

---

### 2. Voucher
**Purpose.** The transactional header representing one accounting event (receipt, payment, journal, contra, sales, purchase, and capability-specific derivations). The atom of the ledger.

**Canonical fields.** `voucherNo` (server-issued, gapless per (tenant, book, FY) — ADR-0005), `voucherType`, `voucherDate` (effective/value date), `narration`, `entries[]` (the balanced Dr/Cr lines — entity 3), `refType`+`refId` (link to originating business doc: sale, purchase, procurement receipt, loan txn, payroll run), `origin` (manual / auto-derived / import), `approvalStatus` + approval trail, `reversalOf` / `reversedBy` (CL-2 linkage), `periodLockStateAtPost`, `fyContext`.

**Immutable fields.** After post: **all financial content** — `voucherNo`, `voucherType`, `voucherDate`, `entries[]`, amounts, account targets, `refType`/`refId`. Only `status` (→ reversed/cancelled) and the reversal linkage may be set, and only by emitting a reversing voucher. Header immutables.

**Relationships.** Owns 1..* **Voucher Entry** (composition). References **Account** (via entries), business parents (Sale/Purchase/Procurement/Loan/Payroll) via `refType`/`refId`, and **Member** via entries/sub-ledger. Projected into **Ledger** and all reports.

**Audit requirements.** Full envelope at post; reversal requires `why` and an authorized principal; SoD (ADR-0010) prevents self-approval where policy requires. Nothing about a posted voucher is ever silently changed (RULE 1 becomes structurally impossible under ADR-0001).

**Versioning.** Transactional/immutable. Corrections = reversing + new voucher. `schemaVersion` records the contract used.

**Future compatibility.** New voucher types are **rule/capability data**, not schema. `entries[]` structure is stable; capability-specific metadata rides in a versioned, typed extension block — never loose JSONB for financially-material fields (ADR-0006/IRR-7).

---

### 3. Voucher Entry
**Purpose.** A single debit or credit line — the indivisible unit of double-entry. Sums across a voucher must balance (CL-1).

**Canonical fields.** `entryId`, `voucherId` (parent), `accountCode` (target head), `drCr`, `amountMinor`+`currencyCode`, `partyRef` (pseudonymous member/supplier/customer sub-ledger key), `costCentreId`, `workOrderId`, `lineNarration`, `salesAccountId`/`purchaseAccountId` routing tag (RULE 4), `sequenceNo` (order within voucher).

**Immutable fields.** Everything after post: `entryId`, `voucherId`, `accountCode`, `drCr`, amount, `partyRef`, routing tags. Entries are never edited in place (CL-2).

**Relationships.** Belongs to exactly one **Voucher**; targets one **Account**; optionally references **Member**/party sub-ledger, **Cost Centre**, **Work Order**. Aggregated by **Ledger** and Trial Balance.

**Audit requirements.** Immutable; balance invariant (CL-1) validated at post and re-validatable at any time. Deletion only via parent reversal.

**Versioning.** Transactional/immutable.

**Future compatibility.** New analytical dimensions (fund, scheme, grant, project) are added as **optional typed tags** on the entry, additive and back-compatible — historical entries simply lack the newer tag.

---

### 4. Ledger
**Purpose.** The account-wise running record of entries — the classic "khata." **Constitutionally a projection**, not a stored master (CL-4).

**Canonical fields (of the projection).** `accountCode`, `period`, `openingBalance`, ordered `entries[]` (from Voucher Entry), `runningBalance`, `closingBalance`, `drCrNature`. All computed from immutable Voucher Entries + the account's opening event.

**Immutable fields.** None stored authoritatively — the ledger is **derived and rebuildable**. Its *inputs* (entries, opening events) are immutable; the projection itself may be recomputed at will and must always reconcile to the inputs.

**Relationships.** A pure function of **Account** + its **Voucher Entries** within a period and tenant scope. Feeds Trial Balance, P&L, Balance Sheet, DCB, and statutory reports.

**Audit requirements.** Reproducibility is the audit control: any historical ledger view must be re-derivable from immutable inputs as-of any date (this is why ADR-0001 is the keystone). No "ledger adjustment" exists except as a posted voucher.

**Versioning.** The *projection logic* is versioned (report-formula version); the data is never versioned because it is not stored as truth.

**Future compatibility.** New ledger presentations/formats (statutory or analytical) are new projections over the same immutable inputs — zero data migration. This is the mechanism by which any future report format is supported for historical data.

---

### 5. Member
**Purpose.** The membership record of a society — the financial/governance facts of a member (not the person). Anchors shares, loans, patronage, and voting eligibility.

**Canonical fields.** `memberNo` (society-issued), `identityRef` (**pseudonymous key** into the Identity/Consent context — CL-6), `membershipType` (regular/nominal/associate), `joinDate`, `exitDate`, `membershipStatus`, `shareHoldingRef` (→ Share ledger), `nomineeRef` (pseudonymous), `patronageAccumulators` (projected), `sub-ledgerAccountCode`.

**Immutable fields.** `recordId`, `memberNo` once issued, `joinDate`, `identityRef` binding. Membership *state* transitions (active→dormant→exited) are recorded events, not overwrites.

**Relationships.** 1..* **Share** holdings; 0..* **Loan**; referenced by **Voucher Entry** sub-ledger (`partyRef`); 0..* **Procurement** receipts (as producer/patron); linked to **Identity** only via `identityRef`.

**Audit requirements.** Admission, share allotment, exit, and nominee changes are envelope-audited events. Exit does **not** delete the member — status transition preserves financial history (CL-9). PII erasure is honored in the Identity context via tombstoning without touching this record (ADR-0007).

**Versioning.** Master; versioned revisions. Membership lifecycle is an event stream, enabling accurate as-of-date membership rolls.

**Future compatibility.** Member-centric portability (cross-society identity via Account Aggregator, INV-5) is anticipated by the `identityRef` seam — the member becomes a first-class identity, not a row trapped inside one society.

---

### 6. Share
**Purpose.** The share-capital ledger — allotment, holding, transfer, and surrender of shares. The equity backbone of a cooperative and the basis of member economic rights.

**Canonical fields.** *Share class* (agreement): `shareClassCode`, `faceValueMinor`, `rights`. *Share transaction* (transactional): `transactionType` (allotment/transfer/surrender/forfeiture), `memberRef`, `counterpartyMemberRef` (for transfers), `quantity`, `amountMinor`, `certificateNo`, `linkedVoucherId`, `effectiveDate`. *Holding* is a **projection** (CL-4) of transactions.

**Immutable fields.** Every share **transaction** after post (type, member, quantity, amount, certificate, linked voucher). Share **class** face value/rights immutable once effective (amendment = new class version).

**Relationships.** Belongs to **Member**; each transaction linked to a **Voucher** (share capital A/c); rolls up to society equity in the Balance Sheet.

**Audit requirements.** Every share movement is an audited, voucher-linked event; certificate register is reconstructable; forfeiture/transfer require authority and narration. Holding always reconciles to Σ transactions.

**Versioning.** Transactions immutable; share-class definitions versioned (agreement kind).

**Future compatibility.** New instruments (patronage-linked shares, redeemable/preferential capital under evolving cooperative law) are new **share classes** (data), not schema changes.

---

### 7. Loan
**Purpose.** Credit extended to members — the agreement plus its transaction lifecycle (disbursement, interest accrual, repayment, restructuring, closure). Basis of DCB, NPA, and interest income.

**Canonical fields.** *Loan agreement* (agreement kind): `loanAccountNo`, `memberRef`, `product`/`scheme` (KCC, ST, LT…), `principalMinor`, `interestRuleRef` (→ rules engine, ADR-0008), `tenure`, `sanctionDate`, `securityRef`, `guarantorRefs` (pseudonymous). *Loan transaction* (transactional): `txnType` (disburse/accrue/repay/waive/restructure), `amountMinor`, `principalComponent`/`interestComponent`, `effectiveDate`, `linkedVoucherId`, `balanceAfter` (projected snapshot). DCB/NPA status are **projections**.

**Immutable fields.** Agreement terms once effective (`principalMinor`, `sanctionDate`, `interestRuleRef` binding) — restructuring creates a **linked successor agreement**. Every loan **transaction** after post.

**Relationships.** Belongs to **Member**; each transaction linked to a **Voucher**; interest driven by **Rules Engine**; classification feeds statutory (NABARD/DCB) reports.

**Audit requirements.** Disbursement and waiver require authority/SoD; interest accrual records the rule version used (reproducibility); NPA classification is a derived, re-computable status, never a hand-set field.

**Versioning.** Agreement versioned; transactions immutable. Interest/classification **rules are effective-dated data** so historical accruals reproduce exactly.

**Future compatibility.** New loan products, interest regimes, and OCEN/credit-rail integrations attach as **rule data + adapters** (ADR-0008, INV-7) without altering the loan record shape.

---

### 8. Procurement
**Purpose.** Receipt of goods/produce from members or suppliers under a business activity (milk collection, MSP foodgrain, marketing aggregation, input purchase) — the event that simultaneously drives payable, inventory, and quality-based pricing.

**Canonical fields.** `procurementNo` (server-issued), `activityRef` (which activity/capability — ADR-0003), `partyRef` (producer/supplier, pseudonymous), `commodityItemRef` (→ Inventory Item), `quantity`+`uom`, `qualityMetrics` (typed, e.g. fat/SNF, moisture — capability-specific), `rateRuleRef` (pricing rule applied — ADR-0008), `grossAmountMinor`, `deductions[]`, `netPayableMinor`, `linkedVoucherId`, `linkedStockMovementId`, `receiptDate`.

**Immutable fields.** After post: quantity, quality metrics as-measured, rate rule + rate applied, amounts, party, linked voucher/stock movement. Corrections = reversing receipt (CL-2/CL-9).

**Relationships.** References **Member/Supplier**, **Inventory Item** (creates a **Stock Movement**), **Voucher** (payable + expense/routing per RULE 4), **Rules Engine** (pricing), **Activity/Capability**. Basis for producer payment registers.

**Audit requirements.** As-measured quality and applied rate are frozen for dispute defense; payment linkage is traceable end-to-end (Procurement→Voucher→Entry) — no denormalized shortcut FK (per [[farmer-payment-traceability]]). Reversal cascades to stock and payable (CL-9).

**Versioning.** Transactional/immutable. Pricing and quality-grade rules are effective-dated data.

**Future compatibility.** New procurement activities (any of the Multipurpose-PACS 25+) reuse this shape by supplying a new `activityRef` + `rateRuleRef` + quality schema — no new entity.

---

### 9. Inventory
**Purpose.** Stock of goods held — the item master plus the immutable movement history from which stock and valuation are derived.

**Canonical fields.** *Inventory Item* (master): `itemCode`, `name`/`nameHi`, `category`, `uom`, `hsnRef`, `valuationMethod`, `salesAccountId`/`purchaseAccountId` (routing, RULE 4), `openingStock` (tied to an opening event), `reorderLevel`. *Stock Movement* (transactional): `movementType` (purchase/sale/procurement/adjustment/transfer), `itemRef`, `quantitySigned`, `rateMinor`, `referenceNo` (links to sale/purchase/procurement), `linkedVoucherId`, `godownRef`, `movementDate`. **`currentStock` is a projection** computed by the canonical formula (RULE 2), stored only as a reconcilable cache (CL-4).

**Immutable fields.** Every **Stock Movement** after post (type, item, quantity, rate, reference, linked voucher). Item master `itemCode` immutable once movements exist.

**Relationships.** **Stock Movement** ↔ **Voucher** and ↔ business doc (Sale/Purchase/Procurement) via `referenceNo`; item routing → **Account** (RULE 4); valuation feeds Trading A/c and Balance Sheet.

**Audit requirements.** Closing stock, valuation, and Trading A/c must all use the **one canonical formula** (RULE 2) — the phantom-balance class of bug is a constitutional violation. Adjustments are posted movements with authority, never silent edits to `currentStock`.

**Versioning.** Movements immutable; item master versioned. Valuation-method changes are effective-dated and never retroactively rewrite posted movements.

**Future compatibility.** Warehouse receipts (WDRA), cold-storage, batch/expiry, and multi-godown transfers extend via **new movement types + typed metadata**, additive to the same movement stream.

---

### 10. Assets
**Purpose.** The fixed-asset register — capitalized assets and their depreciation, revaluation, and disposal lifecycle. Basis of the Balance Sheet asset side and depreciation expense.

**Canonical fields.** *Asset* (master): `assetCode`, `name`, `category`, `acquisitionDate`, `costMinor`, `fundingSource`, `location`/`custodianRef`, `depreciationRuleRef` (→ rules engine), `usefulLife`, `status` (in-use/impaired/disposed). *Asset transaction* (transactional): `txnType` (acquire/depreciate/revalue/impair/dispose), `amountMinor`, `effectiveDate`, `linkedVoucherId`. **Written-down value is a projection** of cost minus posted depreciation.

**Immutable fields.** Acquisition cost/date once posted; every asset **transaction** after post. Category reclassification is a linked, audited event, not an overwrite.

**Relationships.** Depreciation/disposal each linked to a **Voucher**; depreciation driven by **Rules Engine**; feeds Depreciation Schedule and Balance Sheet.

**Audit requirements.** Depreciation records the rule version applied (reproducibility); disposal requires authority and records gain/loss via voucher; physical-verification annotations are audited events.

**Versioning.** Asset master versioned; transactions immutable; depreciation rules effective-dated.

**Future compatibility.** Component accounting, lease/right-of-use assets, and green-asset schemes (NCP emerging sectors) attach as new `depreciationRuleRef` + transaction types — no shape change.

---

### 11. Payroll
**Purpose.** Compensation of employees — the payroll run and its per-employee earnings, statutory deductions, and net pay. Basis of salary expense, PF/ESI/TDS liabilities, and wage registers.

**Canonical fields.** *Employee* (master): `employeeCode`, `identityRef` (**pseudonymous** — CL-6), `designation`, `payStructureRef`, `statutoryIds` (held in Identity context, referenced not embedded), `activeFrom`/`activeTo`. *Payroll run* (transactional header): `runNo`, `period`, `status`. *Salary record* (transactional line): `employeeRef`, `earnings[]` (basic/HRA/DA/TA/allowances, each a Money value), `deductions[]` (PF/ESI/TDS/other, each rule-driven), `grossMinor`, `netMinor`, `linkedVoucherId`.

**Immutable fields.** Every posted **salary record** and **payroll run** (earnings, deductions, gross, net, linked voucher). Employee `employeeCode` immutable once payroll exists.

**Relationships.** **Salary record** → **Employee**, → **Voucher** (salary expense + statutory liability lines), → **Rules Engine** (PF/ESI/TDS computation). Feeds wage registers, Form-16A/TDS, and statutory filings.

**Audit requirements.** Deduction computations record the statutory rule version used; a posted run is immutable — corrections are supplementary/reversal runs; approval/SoD required for disbursement. Statutory IDs are never stored here (ADR-0007).

**Versioning.** Employee master versioned; runs/records immutable; PF/ESI/TDS/wage rules effective-dated.

**Future compatibility.** New allowance/deduction heads and statutory regimes are **rule data**; gig/contract/piece-rate cooperative labour models attach as new `payStructureRef` types without altering the salary-record shape.

---

## Part IV — Canonical relationship map

```
                         ┌──────────────┐
                         │   Account    │◄──────────── seeded by Capability (COA templates)
                         └──────┬───────┘
                                │ target
                         ┌──────┴───────┐   composition   ┌──────────────┐
        refType/refId ──►│   Voucher    │────────────────►│ Voucher Entry│──► partyRef (pseudonymous)
        ▲   ▲   ▲   ▲    └──────┬───────┘  Σdebit=Σcredit └──────┬───────┘
        │   │   │   │           │ projected                       │ aggregated
        │   │   │   │           ▼                                  ▼
        │   │   │   │      (reports)                          ┌────────┐
        │   │   │   │                                         │ Ledger │ (PROJECTION, not stored)
        │   │   │   │                                         └────────┘
   ┌────┘   │   │   └─────────────┐
┌──┴───┐ ┌──┴──┐ ┌──┴───┐  ┌──────┴─────┐  ┌────────┐  ┌────────┐
│Share │ │Loan │ │Payroll│  │Procurement │  │Inventory│  │ Assets │
└──┬───┘ └──┬──┘ └──┬────┘  └─────┬──────┘  └────┬────┘  └────────┘
   │ member │ member│ employee    │ party        │ item
   ▼        ▼       ▼(pseudonymous)▼              ▼
┌──────────────┐            ┌──────────────────────────┐
│    Member    │───────────►│ Identity / Consent (PII) │  (separate context, ADR-0007)
└──────────────┘ identityRef └──────────────────────────┘

Every box also carries: Record Header (recordId, tenantId, jurisdiction, schemaVersion, …)
Rules Engine (ADR-0008) drives: Loan interest · Procurement pricing · Depreciation · PF/ESI/TDS
```

**Reading the map:** Voucher + Voucher Entry are the universal spine; every business entity (Share, Loan, Procurement, Inventory, Assets, Payroll) posts *through* a Voucher (`refType`/`refId` + `linkedVoucherId`) and reaches accounts only via Entries. Ledger and all reports are projections. Member bridges to PII only through a pseudonymous `identityRef`.

---

## Part V — Future-compatibility doctrine (how this constitution survives change)

1. **Add as data, not schema.** New account types, voucher types, activities, loan/share/asset products, payroll heads, and quality/pricing grades arrive as **rule/catalog data** (ADR-0002/0003/0008). Entity shapes stay stable.
2. **Extend with typed, versioned blocks — never loose JSONB for money-material fields.** New analytical dimensions are optional typed tags; historical records simply lack them (IRR-7 respected).
3. **New reports are new projections.** Any future statutory or analytical format is a projection over immutable inputs — no historical migration (CL-4).
4. **`schemaVersion` per entity** gates every shape evolution; readers negotiate version; exports serialize the **versioned contract**, not the storage shape (ADR-0004).
5. **Immutability is the compatibility guarantee.** Because posted records never change, any future consumer — a 2040 auditor, a new report engine, a government integration — can trust and re-derive history. The model is forward-compatible *because* the past is frozen.
6. **Amendment procedure.** This constitution changes only by a superseding ratified revision that (a) preserves all immutable-field guarantees for existing records, (b) is additive to entity shapes, and (c) is recorded as an ADR. No in-place redefinition of an immutable field is ever permitted.

---

## Part VI — Conformance checklist (for any save path, report, or migration)

- [ ] Balanced double entry (CL-1); amounts in exact minor units with Dr/Cr (CL-3).
- [ ] Posted records are append-only; corrections are reversing records (CL-2).
- [ ] Aggregates computed by the canonical projection/formula — no independently-written "current" truth (CL-4; RULE 2).
- [ ] `(tenantId, jurisdiction)` stamped and immutable (CL-5).
- [ ] Only pseudonymous `identityRef` — no PII in financial entities (CL-6).
- [ ] Principal + capability + authority recorded; SoD respected (CL-7; ADR-0010).
- [ ] Period/FY lock checked and lock-state recorded (CL-8; RULE 6).
- [ ] Reversal/cancel cascades to all dependents (CL-9; RULE 3/RULE 5).
- [ ] Server-issued gapless document numbers (ADR-0005).
- [ ] Immutable fields (per entity) never mutated; changes go through versioning/reversal.
- [ ] Financially-material fields typed (not loose JSONB); exports use the versioned contract.
```
