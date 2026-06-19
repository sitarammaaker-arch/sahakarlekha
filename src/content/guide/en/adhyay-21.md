# Chapter 21 — Stock Valuation

> **After this chapter you will be able to:** FIFO/weighted-average; canonical qty × cost; order-insensitive value; diagnosing a "₹0" value.

## 21.1 Why it matters
The closing-stock value directly changes the gross profit and the Balance Sheet — wrong value = wrong profit.

## 21.2 Methods

| Method | Idea |
|---|---|
| FIFO | First in, first out |
| Weighted-average | Average cost |

## 21.3 The canonical rule
Stock value = **canonical qty × weighted-average cost** — one and the same, in every report. The value does not change if the order changes.

> ⚠️ The audit saga: Stock Valuation earlier showed 85 bags from an order-sensitive weighted-average while the true net qty was different. Now: canonical computeStock.

## 21.4 Diagnosing "₹0"
If the value is 0, check: (1) qty 0? (purchases = sales → net 0); (2) cost rate 0? (fill the rate in the purchase record). Get the ground truth from SQL/Day Book.

> 💡 Lesson: don’t guess from a screenshot — read the net qty and rate from SQL/Day Book.

## 21.5 In the app
Reports → Stock Valuation → item-wise qty, average cost, value; the total = closing stock.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| Order-sensitive value | Canonical |
| At sale price | At cost |
| Forgetting rate 0 | Fill the purchase rate |

## 🔍 Audit note
"Stock valued on a consistent method; quantity from inward-outward; value reconciled with the Trading Account."

## 📘 Standard (AS-2)
Cost or NRV, whichever lower; method consistent.

## ✅ Worked example
Purchase 90 @ ₹2,200; sale 90 → net 0 → value ₹0 (correct!). If sale 85 → net 5 → 5 × 2,200 = ₹11,000.

## 📚 Case study
"Closing 0 but 85 bags — where?" — Valuation was order-sensitive; the real net was −5/0. The canonical fix + data correction (purchase 90) made everything match.

## ❓ FAQ
**Q. FIFO or average?** Pick one, stick to it; the app uses the canonical average cost.
**Q. Value 0 but qty too?** Often yes — check it.

## ✏️ Exercises
1. Purchase 100 @ ₹50; sale 70 — qty and value?
2. Purchase 60 @ ₹40 and 40 @ ₹60; sale 50 — average rate, qty, value?
3. Two reasons a value is 0?
4. The canonical rule in one line.
5. How do you get the ground truth?
