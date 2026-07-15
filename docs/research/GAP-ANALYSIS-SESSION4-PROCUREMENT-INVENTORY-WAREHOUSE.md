# SahakarLekha Gap Analysis — Session 4 (Procurement, Inventory & Warehouse)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Procurement + Inventory + Warehouse** (`lib/stockUtils.ts`; `DataContext.tsx` stock/purchase/procurement functions; pages Inventory/PurchaseManagement/PurchaseRegister/StockValuation/ClosingStockReport/ProcurementLots + marketing/*). Measured against Blueprints (Task 2.5 workflows, 3.2 modules) and CLAUDE.md RULES 1–4. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Inventory (strong).** `lib/stockUtils.ts` is **THE single canonical stock engine** (CLAUDE.md RULE 2): `computeStock` (openingStock + movements, clamped ≥0), `computeStockCostRate` (weighted-average cost from inward movements — never the stale `purchaseRate` field), `computeStockValue`, `computeStockMap`. The file documents the exact bug class it prevents ("sale shows 120 but stock report shows 0"). **Every** surface (Sale availability, Inventory, Stock Valuation, Trading A/c, Balance Sheet) reads through these helpers → one formula. `stockItem.currentStock` is an explicitly-denormalised cache that is **never read authoritatively**. `addStockMovement` recomputes `currentStock` from opening + all movements with RULE-1 rollback; stock write-offs are valued at WA cost; `deleteStockItem` soft-deletes (isActive:false).

**Purchase (strong cascade).** `addPurchase` posts the purchase voucher (per-item routing via `purchaseAccountId`, default 5101 — RULE 4) + GST/TDS tax vouchers + stock movements. `deletePurchase` is a **thorough RULE-3 cascade**: soft-cancels the main + tax vouchers (with `deletedReason`), `deleteEntries` on voucher_entries, reverses stock, and **cascade-deletes stock_movements by `referenceNo`**. The purchase *row itself* is **hard-deleted**.

**Procurement (MSP/marketing).** `addProcurementLot` (farmer/crop/variety/season/centre/quantity/mspRate) → procurement J-Forms with a farmer-payment→jform trace; marketing pages (ProcurementMasters/Registers, AgencyReceipts, Transport, KachiAaratRegister) provide the MSP-procurement register set.

**Warehouse (largely absent).** There is **no warehouse/godown management module**. "Godown" exists only as (a) an asset category (`P6AssetCategory = 'godown'` with `capacityMT`, for rented-godown expense/asset tracking) and (b) a free-text `location` on assets. `StockMovement` has **no godown/location dimension** — stock is society-wide, not godown-wise.

**Verdict:** Inventory and Purchase are **among the best-engineered parts of the codebase** (exemplary RULE-2/RULE-3). Warehouse is effectively unimplemented, and Procurement's control workflow (PO→GRN→match) is thin.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **`valuationMethod` field is ignored** | `StockItem.valuationMethod` (FIFO/Weighted-Avg) is persisted but `computeStockValue` **always** uses weighted-average. A society that selects FIFO gets WA silently → the disclosed valuation basis can differ from the computed one. |
| BR-2 | **No 3-way match (PO → GRN → invoice)** | Generic `PurchaseManagement` is invoice-based; there is **no goods-receipt-note step and no PO/GRN/invoice matching**. (Consumer has a separate `PurchaseOrders` page; the generic path does not.) |
| BR-3 | **Purchase row is hard-deleted** | `deletePurchase` cascades the *dependents* correctly (RULE 3) but then `supabase.from('purchases').delete()` — the parent record is gone (only `[AUDIT-DELETE]` console log), so audits cannot tie a cancelled purchase back to its source. |
| BR-4 | **Reorder level is a hardcoded `< 5`** | Low-stock is `computedStockMap[id] < 5` for **all** items regardless of item/unit; there is no per-item reorder/min-max level. |
| BR-5 | **No physical stock-verification workflow** | Stock-take is a manual UserGuide instruction ("do weekly physical verification, enter differences via Stock Adjustment"); there is no verification cycle, variance capture, or committee-approved write-off gate. |
| BR-6 | **`currentStock` cache maintained incrementally** | Some paths (`deletePurchase`) adjust the cache with `Math.max(0, currentStock − qty)`; the cache can drift from the authoritative formula. Mitigated because reads use `computeStock`, but the DB field remains a latent inconsistency. |
| BR-7 | **No godown/location dimension on stock** | Stock and movements are society-wide; multi-godown societies cannot track godown-wise balances or transfers. |

---

## 3. Missing Features (vs Blueprints)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Warehouse/Godown module** — storage receipts/WHR, stack cards, gate pass, inter-godown transfer, godown-wise stock | P1 |
| MF-2 | **3-way match** (PO → GRN → invoice) in generic procurement | P1 |
| MF-3 | **Physical stock-verification / stock-take cycle** with variance + committee-approved write-off | P1 |
| MF-4 | **Per-item reorder / min-max levels** + alerts (replace hardcoded `<5`) | P1 |
| MF-5 | **Honour `valuationMethod`** (FIFO vs WA) in the valuation engine, or remove the field | P1 |
| MF-6 | **Storage-loss / shrinkage** tracking against norms (godown/marketing) | P2 |
| MF-7 | **Batch/expiry in generic inventory** (exists only in the consumer path) | P2 |
| MF-8 | **Agency/pool reconciliation depth** for marketing procurement (federation settlement tie-out) | P2 |
| MF-9 | **Godown master + capacity utilisation** linked to stock (today godowns are only assets) | P2 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | Valuation basis disclosed (`valuationMethod`) ≠ computed basis (always WA) | Stock valuation disclosure (lower of cost/NRV, consistent method) |
| CG-2 | No storage-loss/shrinkage-vs-norm tracking | Godown/warehouse compliance (marketing/PACS) |
| CG-3 | No formal physical-verification record for audit | Stock-verification audit requirement |
| CG-4 | No WHR/warehouse-receipt handling | WDRA / warehouse-receipt norms (where applicable) |
| CG-5 | Purchase parent hard-deleted | Purchase register / voucher-trail retention |

**Not gaps (compliant):** movement-based stock register (Inventory/StockValuation/ClosingStock) effectively serves the statutory stock register; GST input on purchase is posted (tax vouchers); per-item purchase-account routing supports category-wise Trading A/c (RULE 4).

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **Purchase hard-delete → console log only** | Parent purchase row removed; no persistent audit record ties the cancellation to the original document. |
| AG-2 | **Stock movements hard-deleted on purchase delete** | `stock_movements` are `delete()`d by `referenceNo` (intentional, so stock recomputes correctly) — but movement history for the deleted purchase is gone, with no soft-delete/audit of the removal. |
| AG-3 | **No physical-verification audit trail** | Adjustments can be entered but there is no stock-take record (who counted, when, variance, approval). |
| AG-4 | **`currentStock` DB field can silently diverge** from the authoritative formula (BR-6) | Reports are safe (they use `computeStock`), but a direct DB reader would see a drifted cache. |
| AG-5 | **`purchaseAccountId`/`valuationMethod` ride the fragile step-2 extras patch** | Can fail to persist with only a mild warning while the base item saves (same pattern flagged in Session 2). |

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| PI-01 | Warehouse | No godown module; godown = asset only | Warehouse module (WHR, stack cards, gate pass, inter-godown, godown-wise stock) | Marketing/PACS storage unmanaged | **P1** | XL | Stock model, godown master |
| PI-02 | Procurement | No PO/GRN/3-way match (generic) | PO → GRN → invoice matching | Fictitious/unverified purchases | **P1** | L | Purchase engine |
| PI-03 | Inventory | `valuationMethod` ignored (always WA) | Honour FIFO/WA per item (or remove field) | Valuation-basis mismatch/disclosure | **P1** | M | stockUtils |
| PI-04 | Inventory | Reorder hardcoded `<5` | Per-item reorder/min-max + alerts | Poor replenishment control | **P1** | M | StockItem model |
| PI-05 | Inventory | No stock-take workflow | Physical-verification cycle + variance + approval | Shortage/audit exposure | **P1** | M | Approvals, audit |
| PI-06 | Purchase | Purchase row hard-deleted | Soft-delete parent (cascade already soft) | Audit tie-out lost | **P1** | M | Persist model |
| PI-07 | Inventory | No godown dimension on stock/movements | Godown-wise stock + transfers | Multi-godown unsupported | **P2** | L | PI-01 |
| PI-08 | Inventory | `currentStock` cache can drift | Remove cache or reconcile to formula | Latent DB inconsistency | **P2** | S | stockUtils |
| PI-09 | Compliance | No storage-loss/shrinkage tracking | Loss-vs-norm tracking + write-off | Godown compliance gap | **P2** | M | PI-01 |
| PI-10 | Inventory | Batch/expiry only in consumer path | Generic batch/expiry | Perishables mis-tracked | **P2** | M | Stock model |
| PI-11 | Procurement | Agency/pool reconciliation shallow | Federation settlement tie-out | Unreconciled agency accounts | **P2** | M | Marketing engine |
| PI-12 | Audit | Movement hard-delete + extras-patch fragility | Soft-delete + guaranteed persistence | Audit trail gaps | **P2** | M | Persist model |

---

## Summary
Inventory and Purchase are **exemplars** of the project's data-integrity discipline — the canonical movement-based stock formula (RULE 2) and the thorough purchase-delete cascade (RULE 3) are genuinely well-built and should be preserved verbatim. The real gaps are: **(PI-01) Warehouse/Godown is essentially unimplemented**, **(PI-02) no PO/GRN 3-way match**, **(PI-03) the `valuationMethod` field is silently ignored**, and **(PI-04/05) reorder levels and physical-verification are absent**. Parent-record hard-deletes (PI-06) and the fragile extras-patch (PI-12) mirror findings from earlier sessions. No P0s here — the correctness core is sound; the backlog is functional breadth (warehouse, procurement control, verification) plus the valuation-method honesty fix.

*End of Gap Analysis Session 4 — audit only; no code, no changes. STOP.*
