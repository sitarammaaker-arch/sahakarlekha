# Inventory and stock management: for marketing and consumer societies

Consumer stores, marketing societies and multipurpose societies buy and sell goods — fertilizer, seed, ration, consumer goods. For them, correct stock accounts are what decide the real profit and loss. A wrong stock value makes the whole Balance Sheet misleading. This article makes stock management simple.

## Stock: a valuable asset

Unsold goods are the society's **asset**. Whatever goods remain at the year-end (closing stock), that much asset shows in the Balance Sheet and the gross profit of the Trading Account rises by that much. So both the quantity and the value of stock must be correct.

This is why, for a society that sells goods, stock is not just "goods in the godown" — it is directly part of the profit and loss and the Balance Sheet. One wrong count or wrong rate changes the whole year's result, so discipline from the start is necessary here.

## Stock quantity: the one-formula rule

Always work out the current stock of any item in only one way:

> 📘 **Current stock = opening stock + all purchases/inward − all sales/outward**

Every purchase increases stock, every sale reduces it. In a digital system there should also be an **overselling block** at the time of sale — that is, you cannot sell more than the stock you have. If overselling is blocked, stock will never go negative, and the count will always keep matching the actual.

> ⚠️ If stock shows differently in different reports, the reason is almost always that the `currentStock` field was used in one place and the "opening + inward − outward" formula in another — the two got mixed. Apply one formula everywhere.

This also means never "fix" stock by hand. If the count seems wrong, make an **adjustment entry** (with the reason), do not just change the number — otherwise a gap opens between stock and the accounts and the matching breaks.

## Stock value: weighted average

Along with quantity, value is also needed. The most common and stable method is **weighted average cost (Weighted Average)**:

| Purchase | Quantity | Rate | Value |
| --- | --- | --- | --- |
| First | 100 | ₹20 | ₹2,000 |
| Second | 100 | ₹24 | ₹2,400 |
| **Average** | **200** | **₹22** | **₹4,400** |

Now the value of each unit will be taken as ₹22. Closing stock = remaining quantity × average rate. It does not depend on the order, so it stays reliable.

> 🔍 The most common reason for "why is closing stock showing ₹0?" — the item's rate/purchase was never recorded, so the value came out zero. Check the purchase value first.

**The average stays the same after a sale too:** In the example above, 200 units were at an average of ₹22. Now if 50 units are sold, the value of the remaining 150 units = 150 × ₹22 = ₹3,300. Until a new purchase comes, the average stays ₹22; on a new purchase the average changes again by combining with the new rate. This "stability" is the biggest strength of weighted average.

## How purchases, sales and stock are linked

Stock does not change on its own — it is linked to every purchase and sale voucher:

- As soon as a **purchase** is recorded, stock should rise and the related purchase account should be Dr.
- As soon as a **sale** is recorded, stock should fall and sales income should be Cr.
- Each item category should go to its correct account (such as fertilizer sales, consumer goods sales, seed sales separately) — so that the Trading Account shows category-wise profit, not one heap.

**Example (purchase):** Fertilizer worth ₹40,000 bought in cash → **Purchases Dr ₹40,000, Cash Cr ₹40,000**, and fertilizer stock rose by that quantity.

**Example (sale):** Fertilizer worth ₹3,000 sold in cash → **Cash Dr ₹3,000, Fertilizer Sales Cr ₹3,000**, and fertilizer stock fell by that quantity.

So if the purchase/sale voucher is recorded correctly, stock stays correct on its own — this is the strength of a digital system. (Voucher basics: [Voucher entry guide](/blog/voucher-entry-guide).)

## Why category-wise accounts are necessary

Suppose a society sells fertilizer, seed and consumer goods — all three. If the sales of all three go to one "Sales" account, you will never know which category is making a profit and which a loss. Keeping separate accounts lets the Trading Account show the gross profit of all three separately — and management can take the right decisions (such as cutting the order for a loss-making category).

## Closing stock → gross profit — an example

Closing stock directly affects profit. See:

| Item | ₹ |
| --- | --- |
| Opening stock | 20,000 |
| (+) Purchases | 80,000 |
| (−) Closing stock | 15,000 |
| **Cost of goods sold** | **85,000** |
| Sales | 1,00,000 |
| **Gross profit** | **15,000** |

Now if closing stock is counted as ₹18,000 by mistake, the cost of goods sold will be ₹82,000 and gross profit ₹18,000 — that is, a false profit of ₹3,000. If dividend is distributed on this false profit, the society's real capital shrinks. This is why a **single, correct calculation** of closing stock is so important. (More mistakes: [10 common mistakes](/blog/common-accounting-mistakes).)

## Closing stock: count it only once

At the year-end, closing stock should be counted **in only one place** — otherwise it gets double-counted and the profit looks inflated. In the Trading Account closing stock is deducted, and in the Balance Sheet it is added as an asset — both must come from the same calculation.

> 💡 For more depth on stock valuation see: [Stock valuation chapter](/guide/stock-valuation) and [Stock chapter](/guide/inventory-management).

## Methods of stock valuation — a comparison

There are some accepted methods of working out value; understand which one to use when:

| Method | How it works | When useful |
| --- | --- | --- |
| **Weighted average** | Average rate of all purchases | Rates change often, stability needed (most common) |
| **FIFO** | Goods that came first are sold first | Perishable goods (ration, seed) |
| **LIFO** | Later goods are sold first | Generally not recommended in India |

> 🔍 For most cooperative societies weighted average is the simplest and most stable, because it does not depend on the order of purchases. Once you choose a method, do not change it year after year — consistency is what makes comparison meaningful. Changing the method again and again makes one year's profit not comparable with another's, and it also becomes a question in audit.

## Physical stock count (physical verification)

The system's stock and the actual goods in the godown — the two must be matched from time to time:

1. Do a physical count of the whole stock at least once a year (at the year-end).
2. Match the count with the system's stock.
3. If there is a difference, first find the reason (theft, breakage, spoilage, not recorded).
4. Correct the actual shortage/excess with an **adjustment entry**, writing the reason — do not quietly change the number.

> ⚠️ A big gap between physical and book stock is a warning — do not ignore it; it is often a sign of a missed entry, unrecorded spoilage or loss, and sometimes of wrongdoing too.

## Stock register — item-wise record

Keep a separate stock register (inward, outward, balance) for each item. With it you can tell on any day how much of which item there is, and which item is selling slowly. Slow goods can be identified and their order cut — this is good stock management. In a digital system this register is made automatically, linked to every purchase and sale voucher — so there is no need to fill a register separately by hand.

## Minimum stock and re-order

For popular items fix a **minimum level (reorder level)** — when stock comes down to that level, place a new order. This way goods neither run out (sales stop) nor pile up more than needed (money gets stuck). Balance is the key to profit. For seasonal items (such as fertilizer and seed at sowing time) raise or lower the reorder level with the season.

## Loss, breakage and spoilage

Goods sometimes break, spoil or expire. Recording this too is necessary — otherwise the stock in the system will show more than the actual. Record such a shortage as a **stock adjustment (outward)**, so that both quantity and value stay correct and the real profit and loss shows.

## How fast the stock is selling

Good stock management is not just counting — it also means seeing how fast goods are selling. An item that lies in the godown for months keeps the society's money stuck and also carries the risk of spoilage. So:

- **Fast-selling goods** — keep enough stock, fix a reorder level.
- **Slow goods** — cut the order, and if needed clear them with a discount.
- **Dead stock** — goods that are not selling at all; identify them and decide.

If "stock" looks big in the Balance Sheet but sales are slow, it is a warning that money is tied up in goods. For cash flow, stock must keep moving.

## A year's stock cycle — in brief

Stock moves like this through the year: **opening stock** (last year's closing) → rises with **purchases** and falls with **sales** through the year → **loss/adjustment** now and then → confirmed by a **physical count** at the year-end → that same **closing stock** goes to the Trading Account and Balance Sheet, and becomes next year's opening. This cycle repeats every year, so one year's mistake affects the next year too — accuracy is necessary.

## Three things to remember

- 📦 Record every purchase and sale on the same day, so stock is always correct.
- 🧮 Never leave an item's rate/purchase value blank; keep one valuation method year after year.
- 🗓️ Count physical stock at least once a year and match it with the system, and if there is a difference correct it with an adjustment entry.

## Frequently asked questions

**How to work out current stock?** — Opening stock + all inward − all outward; apply this one formula everywhere.
**Why is closing stock showing ₹0?** — Mostly the item's purchase rate was never recorded, so the value came out zero — check the rate first.
**Which valuation method to choose?** — For most societies weighted average is simple and stable; FIFO for perishable goods.
**Where does closing stock appear?** — It is deducted in the Trading Account and added as an asset in the Balance Sheet — both from the same calculation.
**What if physical and book stock do not match?** — Find the reason (theft/spoilage/missed entry) and correct it with an adjustment entry, do not change it quietly.
**What to do with broken/spoiled goods?** — Record them as a stock adjustment (outward), so that stock and profit stay correct.
**Why a separate account for each item?** — So that the Trading Account shows category-wise profit (fertilizer, consumer goods separately), not one heap.
**Can we correct stock by hand?** — No; make an adjustment entry with the reason, otherwise the matching of stock and accounts breaks.
**How to identify slow/dead goods?** — Look at the item-wise stock register and sales; decide on what has not sold for months.
**How often a physical count?** — At least once a year (at the year-end); a big society can do it more often if it wants.

## Conclusion

The secret of stock management is — quantity by one formula, value by one method (usually weighted average), and a single calculation of closing stock. Along with that, a physical count once a year and honest entries for loss/spoilage — this gives the correct profit and the correct Balance Sheet. And remember: a wrong stock value makes not just stock but the whole profit and Balance Sheet misleading, so accuracy matters most here.

> ✅ Handle purchases, sales and stock together — [Register on SahakarLekha](/register), or see [Marketing society software](/software/marketing).

A small start is enough — just record every purchase and sale on the same day, never leave the rate blank, and count and match once a year. With just this much, your stock, profit and Balance Sheet — all three — will stay reliable.

Learn more: [How to read reports](/blog/how-to-read-financial-reports) · [10 common mistakes](/blog/common-accounting-mistakes) · [Basics of cooperative accounting](/blog/cooperative-accounting-basics).

**Related terms:** [Inventory](/glossary/inventory) · [Closing stock](/glossary/closing-stock) · [Weighted average](/glossary/weighted-average) · [FIFO](/glossary/fifo) · [Gross profit](/glossary/gross-profit)

> 📘 This article was built from active Knowledge Items — Evidence Level A (educational).
