# SahakarLekha as the National Cooperative OS — Which of Today's Decisions Become Irreversible Mistakes

**Companions:** [DOMAIN-ARCHITECTURE-2040-VISION.md](DOMAIN-ARCHITECTURE-2040-VISION.md) · [DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md](DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md) · [DOMAIN-DATABASE-DESIGN-2026-07.md](DOMAIN-DATABASE-DESIGN-2026-07.md) · [DOMAIN-GAP-ANALYSIS-2026-07.md](DOMAIN-GAP-ANALYSIS-2026-07.md)
**Date:** 2026-07-11
**Status:** Analysis only. No code. No schema changes. Grounded in the code on `feat/data-portability-phase-0-1`.

---

## 0. The only lens that matters: **code is reversible, data and contracts are not**

You can rewrite every line of SahakarLekha in 2035. You **cannot** rewrite the ~5 billion rows written between now and then, and you cannot recall the data formats and IDs that millions of societies, auditors, and government systems have already come to depend on.

So "irreversible mistake" has a precise meaning here. It is **not** tech debt (refactorable) or a wrong library (swappable). It is a decision that gets **written into historical data or into an external contract**, such that fixing it forward leaves the *past* permanently broken. There are exactly four ways that happens:

| Class | The trap | Why it's irreversible |
|---|---|---|
| **A — Unrecorded truth** | You didn't capture something at write time | You can start capturing it tomorrow, but the *past* is gone forever — no migration recovers data never written |
| **B — Immovable data** | Data written without the key needed to place/partition/erase it | At billions of rows across jurisdictions, you cannot physically or legally re-home history |
| **C — Frozen contract** | An ID scheme, export format, or vocabulary others now consume | External consumers (auditors, govt filings, archived exports) freeze it — you break them all or live with it |
| **D — Granted exposure** | Trust or PII surface handed out at scale | You can restrict it going forward, but the historical blast radius is permanent |

Everything below is classified by which trap it falls into. **The window to fix each is open only until enough historical data or external dependence accumulates.** At national-OS scale, that window is *short*.

---

## 1. The irreversible mistakes latent in today's code

Ranked by severity × how soon the window closes.

### IRR-1 · No authoritative event log — state is the source of truth (Class A) — **CRITICAL**
**Today:** entities live in React state; Supabase is an optimistic mirror; a failed write must be manually rolled back or the user loses work (**RULE 1**). There is no append-only record of *what happened* — only the current mutable state and a JSONB `editHistory` afterthought.
**Why irreversible:** every financial fact written under this model has **no reconstructable provenance**. If in 2032 a court, an auditor, or a regulator asks "show the exact sequence of events that produced this member's balance in 2027," the answer for all pre-event-log data is *permanently unavailable*. You can adopt event-sourcing tomorrow — but you can never retrofit history you never recorded.
**Point of no return:** every day of production writes more unrecoverable history. Already past for existing data; compounding.
**Reversible move now:** stand up an append-only posting journal as the system-of-record *behind* the current projection (dual-write), so from cut-over date forward the history is real. Your `voucher_entries` + `isDeleted` + `editHistory` are already ~60% of this. **This is the single highest-leverage decision in the whole product** — it also retires the entire RULE 1 failure class.

### IRR-2 · Client-side, local-state document numbering (Class A + C) — **CRITICAL**
**Today:** voucher numbers are generated on the client from in-memory state — `storage.getNextVoucherNo(type, fy, vouchersRef.current)` ([DataContext.tsx:1336](../../src/contexts/DataContext.tsx)), with **collision-retry** logic already present ([DataContext.tsx:1211-1213](../../src/contexts/DataContext.tsx)). The retry is evidence you *already* hit duplicate numbers.
**Why irreversible:** cooperative statutory audit requires **gapless, non-duplicated** sequential numbering. Numbers computed from local state across many concurrent writers/devices *will* gap and collide. Those numbers are printed on receipts, cited in audit reports, and filed with the registrar — they become an **external contract (Class C)** the moment they leave the building. You cannot renumber history without invalidating every document already issued against the old number.
**Point of no return:** the first audit cycle that accepts these numbers as the official record.
**Reversible move now:** move sequence issuance to a **server-authoritative, per-(society, book, FY) monotonic counter** — the number is assigned at durable append (pairs with IRR-1), never derived from client state.

### IRR-3 · PII entangled inside the financial ledger (Class B + D) — **HIGH**
**Today:** member and counterparty PII (name, contact, IDs) sit inline in operational/financial tables.
**Why irreversible:** the DPDP Act 2023 grants **right-to-erasure**, while cooperative law demands **~8-year retention** of financial records. If PII is inlined in immutable financial rows, you can satisfy *neither* cleanly — erase and you corrupt the audit trail; retain and you violate consent. At billions of rows and after exports already shipped to government, you cannot retroactively disentangle identity from ledger.
**Point of no return:** when data volume + the first erasure request make bulk separation infeasible.
**Reversible move now:** separate **identity/consent** into its own bounded context joined by a stable pseudonymous key; the ledger stores the key, not the person. Erasure = tombstone the identity, keep the (now-pseudonymous) financial event.

### IRR-4 · No tenancy/jurisdiction partition key on financial rows (Class B) — **HIGH**
**Today:** `society_id text default 'SOC001'` on ~20 tables; `society_settings` is an `id='main'` singleton. Tenancy is a *default*, not a *partition dimension*.
**Why irreversible (with a caveat):** the **good news** — primary keys are `crypto.randomUUID()` ([DataContext.tsx](../../src/contexts/DataContext.tsx)), so global uniqueness is safe and tenant *merge* will never collide (a genuinely correct, forward-compatible choice — credit where due). The **bad news** — without a first-class tenant + **jurisdiction/residency** key stamped on every row *at write time*, you cannot later shard by scale or enforce **data-residency law** (which may mandate that a state's members' data physically reside in-region). Re-placing billions of already-written rows across regions is the classic ERP death.
**Point of no return:** when data volume makes re-partitioning a multi-year migration, or when a residency mandate lands on non-partitioned history.
**Reversible move now:** stamp `(tenant_id, jurisdiction)` on every financial row now, even while single-region — cheap today, impossible to backfill meaningfully later.

### IRR-5 · Custom credential store as the national identity root (Class D) — **HIGH**
**Today:** `society_users.password text not null` ([supabase-tables.sql:66](../../supabase-tables.sql)) — a self-managed credential store; platform-admin is JWT-less (per project notes).
**Why irreversible:** becoming *the* national OS makes this the identity root for millions of accounts. A self-rolled auth/credential posture at that scale is a permanent liability surface — and once millions of credentials + downstream sessions/integrations depend on it, migrating the identity root is one of the hardest reversals in software. Any historical compromise is, by definition, unrecallable (Class D).
**Point of no return:** when the account base and integrations make the identity provider un-swappable.
**Reversible move now:** delegate identity to a proper provider / DPI-aligned identity (consented Aadhaar/DigiLocker where lawful) behind an auth adapter, so the credential root is not SahakarLekha's own table.

### IRR-6 · The `.slbak` export / camelCase-JSONB schema as the de-facto portability contract (Class C) — **MEDIUM-HIGH**
**Today:** the DB schema mirrors the TypeScript client 1:1 (quoted `"voucherNo"`, financially-material data in JSONB like `lines`, `billAllocations`), and the `.slbak` backup format encodes that internal shape. Data-portability is an active, prod-live workstream.
**Why irreversible:** the instant `.slbak` (or an export the government ingests) becomes a portability standard, **the app's incidental internal shape becomes a public contract you must honor forever.** Every future client, migration, and integration inherits today's camelCase/JSONB quirks in perpetuity — Class C freezing.
**Point of no return:** first external system (govt, another vendor, an auditor's tool) that parses the format.
**Reversible move now:** define a **stable, versioned domain export schema** distinct from the internal storage shape; `.slbak` serializes the *contract*, not the table layout. Version it from v1 so v2 is possible.

### IRR-7 · Financially-material data in unconstrained JSONB (Class A) — **MEDIUM**
**Today:** voucher `lines`, tax breakups, `billAllocations` live in JSONB (`default '[]'`), outside column constraints. RULE 2's "phantom ₹1,12,500 Trading A/c" bug is a live example of formula/shape drift this enables.
**Why irreversible:** you cannot retroactively apply a `NOT NULL` / `CHECK` / referential constraint to billions of historical JSONB blobs that were written dirty. Whatever integrity you *didn't* enforce at write time is unenforceable on the past.
**Point of no return:** volume at which a corrective sweep over historical JSONB is infeasible.
**Reversible move now:** keep JSONB for genuinely free-form config, but **promote financially-material, reported, or aggregated fields to typed, constrained columns** (aligns with the DB-design principle: JSONB only at the edges).

### IRR-8 · Money computed in JS floating point, then persisted (Class A) — **MEDIUM**
**Today:** storage is PG `numeric` (exact — good), but arithmetic runs in JS floats across ~53 sites in DataContext alone (`toFixed`/`parseFloat`/`Number(...)`), and computed results (tax, allocations, rounding) are **persisted** into postings.
**Why irreversible:** amounts *derived* from source figures can be recomputed — but rounding already **written into historical postings** is frozen. Across billions of transactions, persisted float-rounding drift is a permanent, un-auditable discrepancy.
**Point of no return:** accumulation; every persisted rounded posting adds to it.
**Reversible move now:** adopt a **fixed minor-unit integer (paise) discipline** in the computation layer, or a decimal library; persist exact values with an explicit rounding policy recorded alongside.

### IRR-9 · `societyType` enum vocabulary embedded in exports/filings (Class C) — **MEDIUM**
**Today:** `SocietyType` is a hardcoded TS union ([types/index.ts:984](../../src/types/index.ts)). The capabilities layer already decouples *behavior* from it — but if the raw enum string is written into exports, statutory filings, or the NCD exchange, the **vocabulary** freezes.
**Why irreversible:** you can rename the enum in code, but every filing/export that carried the old string is immutable (Class C).
**Point of no return:** first statutory/NCD submission that carries the raw code.
**Reversible move now:** map to **stable external codes** (e.g. National Cooperative Database category codes) at the boundary; never let the internal enum string be the wire value.

---

## 2. Decisions already made *right* (do not "fix" these)

Credibility requires naming what's correct — several current choices are exactly the irreversible-friendly ones:

| Decision | Why it ages well |
|---|---|
| **`crypto.randomUUID()` primary keys** | Globally unique → tenant merge/federation never collides. The correct call for a future network of societies. |
| **Event-shaped `voucher_entries` + `editHistory` + `isDeleted` soft-cancel** | Already ~60% of an event log — IRR-1 is a promotion, not a rewrite. |
| **Capabilities-as-data + pure resolver + entitlement/RLS** | Behavior already decoupled from type; policy churn lands as data. |
| **PG `numeric` money storage** | Exact at rest; the gap (IRR-8) is only in the JS compute layer. |
| **ISO-8601 timestamp strings** | Text-typed (unconstrained) but unambiguous — a data-quality tidy-up, not an irreversible loss. |
| **Live data-portability / backup / restore discipline** | The right instinct; IRR-6 is about *formalizing the contract*, not adding the capability. |

**Net:** the foundation is better than average. The irreversible risks are concentrated in **how history is recorded (A)** and **how it's contracted outward (C)** — not in the entity model, which is sound.

---

## 3. The closing-window priority list

Ordered by "cost of waiting," because that is what irreversibility is:

1. **IRR-1 (event log)** — every day widens the un-reconstructable gap. Start the append-only journal first; it also underwrites IRR-2, IRR-3, IRR-7.
2. **IRR-2 (server-authoritative numbering)** — statutory conformance of the *official record*; collisions are already happening.
3. **IRR-4 (tenant+jurisdiction key) & IRR-3 (PII separation)** — cheap to stamp/separate now, multi-year migrations later; both are legally-forced eventually.
4. **IRR-6 (versioned export contract) & IRR-9 (external code mapping)** — freeze a *good* contract before an external consumer freezes a bad one.
5. **IRR-5 (identity root)** — architecturally urgent but has a longer fuse than the data-layer items; decide the direction now, migrate before the account base explodes.
6. **IRR-7 (typed financial columns) & IRR-8 (money precision)** — enforce integrity at write time before the historical corpus makes it unenforceable.

---

## 4. Conclusion — one paragraph

If SahakarLekha becomes the national cooperative OS, the irreversible mistakes are **not** in its domain model (the UUID keys, capabilities layer, and event-shaped vouchers are genuinely future-proof) — they are in **how it records history and how it exposes that history outward**. The four that will actually be impossible to undo: **treating mutable state as the source of truth instead of an append-only event log (IRR-1); generating official document numbers from client-side local state (IRR-2); entangling erasable PII with retention-bound financial records (IRR-3); and letting the app's incidental internal shape harden into the national portability contract (IRR-6)**. Each is cheap to correct *today* and effectively impossible once billions of rows and thousands of external consumers depend on the wrong choice. The governing principle: **you will rewrite the code many times before 2040, but you write the history and the contracts exactly once — so spend today's design budget there.**
