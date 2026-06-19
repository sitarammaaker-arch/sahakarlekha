# Chapter 9 — Inventory

> **After this chapter you will be able to:** items/groups/opening; stock movements; the one-formula rule; weighted-average value.

## 9.1 What is inventory
How much came in, sold, and is left — wrong stock = wrong Trading Account/Balance Sheet.

## 9.2 Creating an item
Inventory → Add Item → code, name, unit, group, opening, purchase/sale rate, HSN/GST.

## 9.3 Stock groups
Give every item a group — for category-wise reports; these become the categories of the closing-stock report.

## 9.4 Stock movements

| Type | Effect |
|---|---|
| Inward — purchase | + |
| Outward — sale | − |
| Adjustment (+) | + |
| Adjustment (−) | − |

## 9.5 The one-formula rule
**Current stock = opening + (purchases and +adjustments) − (sales and −adjustments)**, minimum 0. Every report uses this same formula.
Example: 0 + 100 − 60 − 5 = **35**.

> 💡 Earlier some reports read a stale stored figure → inconsistency. Now one formula, everywhere.

## 9.6 Adjustment — mind the sign
+10 increases, −5 decreases. Add the "−" when reducing.

> ⚠️ Earlier Math.abs stripped the sign (−5 also increased) — now the sign is preserved.

## 9.7 Stock value (weighted-average cost)
Value = remaining qty × weighted-average cost (from the actual purchase records). 35 × ₹2000 = ₹70,000.

> ⚠️ Earlier a static "purchase rate" field (0) made value 0 — now it’s the weighted-average cost.

## 9.8 Low stock & overselling
Low stock (<5) shows a red mark; the oversell block → stock is never negative.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| Opening in one place | item + account |
| Forgetting the sign on adjustment | Add "−" |
| Value at sale price | At cost |

## 🔍 Audit note
"Closing stock at weighted-average cost; quantity records reconcile with inward-outward."

## 📘 Cooperative standard (AS-2)
Closing stock = cost or NRV, whichever lower; never at sale price.

## ✅ Worked example
Fertiliser — opening 20 @ ₹400; purchase 80 @ ₹450; sale 70; adjustment −2. Qty = 28; weighted-average = (8,000+36,000)/100 = ₹440; value = 28×440 = ₹12,320.

## 📚 Case study
Inventory 85, closing-stock report ₹0. Causes: value from purchase-rate (0); and 90 sold/85 bought. Both fixed.

## ❓ FAQ
**Q. 35 somewhere, 30 elsewhere?** Not any more — one formula.
**Q. Damaged goods?** A negative adjustment, with a reason.

## ✏️ Exercises
1. opening 10, purchase 50, sale 40, adjustment −3 — stock?
2. Purchase 60 @ ₹100 and 40 @ ₹120 — weighted-average rate?
3. 30 left — stock value?
4. The effect of "−5"?
5. Value at cost or at sale price?
