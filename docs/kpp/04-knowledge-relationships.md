# 04 — Knowledge Relationships

> The dependency/relationship graph **between Knowledge Items**. This is what turns a flat list into a
> navigable knowledge base — driving learning paths, prerequisites, "see also", internal links, and the
> [AI API](../kae/11-ai-knowledge-api.md) "related" retrieval. **Graph only — no explanations.**
>
> Edge types reuse the [KAE cross-reference engine](../kae/09-cross-reference-engine.md):
> `prerequisite_of` · `requires` · `derived_from` · `related` · `implemented_by` (→module). Per-KI edges
> are stored in the [registry](05-wave-1-registry.md); this file documents the **canonical chains**.

---

## 1. The accounting spine (the core money-path chain)

```
Cooperative Society → Member → Share Capital
        │
Accounting → Double-entry → Debit/Credit → Golden Rules
        ↓
Account → Chart of Accounts → Ledger Account → Opening Balance
        ↓
Transaction → Voucher → (Receipt | Payment | Journal | Contra | Compound)
        ↓
Day Book → Posting → Ledger
        ↓
Cash Book ─┐                      Bank Book ─┐
           ├─→ feed →             ├─→ feed →
        ↓                                    ↓
        └──────────→ Trial Balance (Dr = Cr) ←──────────┘
                          ↓
        ┌─────────────┬───────────────┬────────────────┐
   Trading A/c   Profit & Loss /   Receipts &      Balance Sheet
        │         Income & Exp.     Payments             ↑
        └── Gross Profit →  Net Result → Appropriation ──┤
                          ↓                               │
                Reserve Fund + Dividend ──────────────────┘
                          ↓
                  Profit Distribution → AGM → Statutory Returns
                          ↓
                  Year-End Close → FY-Lock → next year Opening Balance (loop)
```

> This mirrors the [SCOS knowledge graph spine](../scos/06-knowledge-graph.md) and [KAE §3](../kae/09-cross-reference-engine.md)
> — but here the **nodes are KIs**, so the chain is the prerequisite ordering for the learning path and
> the dependency ordering for cascade.

## 2. The user's example chain (made explicit)

```
Cash Book  ─requires→  Cash Account  ─posts_to→  Ledger  ←records_from─  Journal/Voucher
   Voucher ─summarised_in→ Day Book ─posts_to→ Ledger ─aggregates_to→ Trial Balance
   Trial Balance ─prerequisite_of→ Balance Sheet
```
Prerequisite reading order: `Voucher → Day Book → Ledger → Trial Balance → Balance Sheet`, with
`Cash Book`/`Bank Book` as ledger-level books feeding the Trial Balance.

## 3. Sub-graphs (per group)

**Members & capital:**
`Membership → Member Register → Share → Share Capital → Share Register → Dividend → Profit Distribution`.

**Cash & bank:**
`Cash → Cash Book ; Bank → Bank Book → Bank Statement → Bank Reconciliation (→ BRS Difference)`.
Both `implemented_by` `/cash-book`, `/bank-book`, `/bank-reconciliation`.

**Reserves & profit:**
`Net Profit → Appropriation → {Reserve Fund (statutory %), Education Fund, Dividend, Patronage Bonus} → Carry Forward`.

**Trial balance & statements:**
`Ledger Balances → Trial Balance → {Trading A/c → Gross Profit} → {P&L/I&E → Net Result} → Balance Sheet`;
`Receipts & Payments` derived from cash/bank books.

**Audit:**
`Final Accounts → Audit → {Vouching, Verification} → Objection → Rectification → Audit Certificate → Grade`.
Audit `requires` virtually every other spine KI as input (high in-degree node).

## 4. Cross-cutting relationship types in this dataset

| Edge | Example (concept-level) | Powers |
| --- | --- | --- |
| `prerequisite_of` | Double-entry → Voucher | learning path, "before this" |
| `requires` / `derived_from` | Trial Balance derived_from Ledger | cascade, "where the number comes from" |
| `related` | Cash Book ↔ Bank Book | "see also" |
| `implemented_by` | Bank Reconciliation → `/bank-reconciliation` | app CTA, SaaS doc |
| `formatted_as` | Balance Sheet → BS template | download generation |
| `computed_by` | Depreciation → depreciation calculator | tool landing |
| `governed_by` | Reserve % → state act KI | jurisdiction + NEV |

## 5. Glossary linkage

Every glossary KI (G14) `related` to the concept KI it defines (e.g. glossary "रोकड़ बही" `related`
"Cash Book"). Glossary terms are leaf nodes — high inbound, low outbound — and seed the in-content
term-linking later.

## 6. Graph integrity (enforced at the gate, [07](07-quality-gates.md) / [KAE 08 Q4](../kae/08-quality-assurance.md))
1. No **orphans** — every KI connects to ≥1 other KI.
2. No **cycles** in `prerequisite_of`/`requires`/`derived_from` (acyclic).
3. Every relationship target **resolves** to a real `KI-` id (no dangling).
4. `implemented_by` targets a real module route.
5. Reachability — every KI is reachable from a Wave-1 root concept in ≤3 hops.

## 7. Root concepts (graph entry points)
`Cooperative Society` · `Accounting` · `Voucher` · `Ledger` · `Trial Balance` · `Balance Sheet` ·
`Member` · `Audit`. These are the highest-level KIs from which the whole Wave-1 graph is reachable —
and the natural pillar anchors when SCOS later renders them.

---

### Cross-references
[Wave-1 Registry](05-wave-1-registry.md) · [Population Rules](03-population-rules.md) · [KI Schema](01-knowledge-item-schema.md) · [KAE Cross-Reference Engine](../kae/09-cross-reference-engine.md) · [SCOS Knowledge Graph](../scos/06-knowledge-graph.md)
