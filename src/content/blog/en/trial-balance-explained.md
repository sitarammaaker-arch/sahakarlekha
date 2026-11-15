# Trial Balance: why Dr = Cr must match

Before making the final accounts, every accountant looks at one thing — **whether the Trial Balance is matching or not**. The **Trial Balance** is the first "health check" of the books: if its two columns are equal, the arithmetic of double entry has run correctly. This article explains what a Trial Balance is, why its two columns are equal, what a sample looks like, what to do if it does not match, and — most important — which mistakes it cannot catch. All with examples and sources.

## What is a Trial Balance

A Trial Balance is a list of the closing balance of every account, with two columns — **Debit (naam)** and **Credit (jama)**. Each account's balance comes on its correct side, and the totals of both columns must be equal. It is a summary of all the ledgers on a given date.

> 💡 Both columns matching shows that double entry ran correctly — every Dr has an equal Cr.

## Why the two columns are equal

Because in every transaction debit (Dr) and credit (Cr) are equal, both sides stay equal even when all accounts are added up. This is the visible proof of the **accounting equation** (assets = liabilities + capital). (See: [The accounting equation](/blog/accounting-equation-explained) and [Debit-credit and double entry](/blog/debit-credit-and-double-entry).)

| Column | What goes in it (usually) |
| --- | --- |
| Debit (Dr) | Balances of assets, expenses |
| Credit (Cr) | Balances of liabilities, capital, income |
| **Total** | **Both equal** |

## Understand with an example — a sample Trial Balance

Suppose a society has some accounts like this:

| Account | Debit (Dr) ₹ | Credit (Cr) ₹ |
| --- | --- | --- |
| Cash | 40,000 | — |
| Bank | 1,10,000 | — |
| Member loans (receivable) | 3,00,000 | — |
| Share capital | — | 2,00,000 |
| Member deposits | — | 2,20,000 |
| Interest income | — | 60,000 |
| Salary (expense) | 30,000 | — |
| **Total** | **4,80,000** | **4,80,000** |

Both totals are equal at ₹4,80,000 → the arithmetic is correct. Now the final accounts (Profit & Loss/Income & Expenditure, Balance Sheet) are made from this.

**Now suppose a mistake happened:** instead of salary ₹30,000, by mistake nothing was written in Cr and only ₹3,000 in Dr (one digit dropped) — then the Dr total will fall short by ₹27,000 and **the two columns will not match**. The difference is ₹27,000 — this is where the search starts (see below).

## Why the Trial Balance is necessary — benefits

- **Arithmetic check:** Dr=Cr matching shows that the addition and subtraction of posting ran correctly.
- **Foundation of final accounts:** Profit & Loss and the Balance Sheet are made directly from the TB — no reliable report without a matched TB.
- **Catches mistakes early:** Matching every month catches a small mistake before it grows big.
- **Easier audit:** A clean, matched TB speeds up the auditor's work and reduces objections.
- **Position at a glance:** The balances of all accounts in one place — review and decisions by the managing committee become easy.

## Two ways to make it

- **Balances method:** Only the closing balance of each account is written — the most common, and the useful one for final accounts.
- **Totals method:** The total Dr and Cr of each account are written. Used less.

In practice (and in software like SahakarLekha) the balances method is the default.

## Steps to make it

1. At the end of the financial year (or on any date), **close the ledger** of every account.
2. Work out the **closing balance** of every account.
3. Assets/expenses → Dr column; liabilities/capital/income → Cr column.
4. Add both columns — the totals should be equal.

> 💡 In software this is made in one click; when doing it by hand, follow this same order.

## Trial Balance vs Balance Sheet

The two are often mixed up, but they are different:

- The **Trial Balance** is an **internal checklist** — the balances of all accounts (assets, liabilities, capital, income, expenses) in one place, to make sure that Dr=Cr. It is not "presented" to anyone.
- The **Balance Sheet** is a **financial statement** that shows only assets, liabilities and capital (income and expenses go to Profit & Loss), and is placed before members/the auditor.

In simple words — **the Balance Sheet and Profit & Loss are made** from the Trial Balance, not the other way round. (See: [Ledger and posting](/blog/ledger-and-posting-explained).)

## When to make a Trial Balance

- **At year-end** — mandatory, because the final accounts and audit are made from it.
- **Every month/quarter** — a good habit; mistakes are caught early and year-end stays easy.
- **After some big event** — for example, matching it once after a lot of entries or corrections.

> 💡 If you keep matching the TB month by month, there is no stress of "why isn't it matching" at year-end.

## Matching = not "zero errors" — errors the TB does not catch

This is the most important point: **the Trial Balance matching is no guarantee that the accounts are fully correct.** There are some mistakes in which Dr=Cr still stays equal, so the TB does not catch them:

- **Error of omission:** A transaction was not recorded at all — both sides missing, so the totals are still equal.
- **Error of commission:** The amount is correct but in the **wrong account (of the same type)** — for example, in Shyamlal's account instead of Ramprasad's. The totals are equal, but the account is wrong.
- **Error of principle:** Classification against the rules — for example, treating a capital expense (asset) as a revenue expense. The totals are equal, but the profit is wrong.
- **Compensating errors:** Two mistakes cancel each other out — for example, ₹100 extra Dr in one place and ₹100 extra Cr in another. The totals are equal, both mistakes hidden.

**Example:** If a sale of ₹5,000 was not recorded in the books at all (omission), the Trial Balance will still match — but income will show ₹5,000 less. That is why the TB is "the first check, not the last". (See: [10 common accounting mistakes](/blog/common-accounting-mistakes).) (Source: [Errors the TB does not catch — Class 11 Accountancy notes](https://www.ourselfstudy.com/revision-notes/cbse-class-11-accountancy-chapter-6-Part1.php))

## Errors the TB catches

These make the two columns unequal, so the TB catches them:

- **One-sided entry:** Only Dr or only Cr recorded.
- **Wrong amount on one side** or **recorded twice on the same side**.
- **Transposition error:** Digits swapped, such as writing ₹27 instead of ₹72.

> 💡 A useful trick: if the Dr–Cr **difference is exactly divisible by 9**, it is often a **transposition (swapped digits)** mistake (₹72−₹27 = ₹45; 45÷9 = 5). And if the difference is **exactly double** some amount, perhaps some balance has gone to the **wrong side**.

## How to find it if it does not match

Look in order:

1. **Work out the difference** — is it divisible by 9 (transposition) or double some amount (wrong side)?
2. Check the **recent entries** and big/unusual figures.
3. Open the **ledger of the suspect account** and reconcile.
4. If it still does not match, temporarily open a **suspense account** (below).

**Remember the ₹27,000 difference above?** First check — is it the amount of any one account (perhaps a balance missed/wrong)? Is it divisible by 9 (transposition)? ₹27,000 ÷ 9 = 3,000 — so transposition is possible; and it is right around the salary amount. As soon as you open the ledger, the mistake (3,000 instead of 30,000) is caught. This orderly search is the real strength of the TB.

In SahakarLekha the Trial Balance comes in one click, so this check is easy.

## Suspense Account

When the difference is not found at once, that difference is temporarily put into a **suspense account** and work moves ahead. Later, as the mistakes are found, they are fixed with correction entries, and the suspense account should keep reducing until it becomes **zero**.

> ⚠️ When making the final accounts, no balance should remain in the suspense account — otherwise a mistake is buried somewhere.

## Trial Balance in a cooperative society

In cooperative societies, the final accounts and audit rest on this Trial Balance. The RCS audit format of many states also has a **two-section** presentation — check the exact format as per your state/RCS instructions. The principle stays the same: first match the TB, then make the reports. (See: [Ledger and posting](/blog/ledger-and-posting-explained).)

## How to correct a mistake (rectification)

The way to correct depends on the type of mistake:

- **Two-sided mistake** (like a full entry in the wrong account) — here the TB was equal anyway, so a **correction journal entry** moves it to the correct account; no need for suspense.
- **One-sided mistake** (like an amount missed on one side) — this had spoiled the TB; it is corrected **through the suspense account**, which brings suspense down to zero.

**Example:** A salary of ₹2,000 went into the "Rent" account by mistake (both are expenses) — the TB was equal, but the classification was wrong. Correction: Rent Cr ₹2,000, Salary Dr ₹2,000 — fixed with one journal entry. (For depth, consult a CA/accountant.)

> ⚠️ Always correct with a **journal entry** — quietly changing/deleting an old entry breaks the audit trail.

## Three things to remember

- ⚖️ Both columns of the Trial Balance must be equal.
- 🛠️ If it does not match, fix it before the final accounts (difference divisible by 9? transposition).
- 🔍 Matching is the first check, not the last — errors of omission, principle and compensating errors can still hide, so stay alert.

## Frequently asked questions

**What is a Trial Balance?** — A Dr/Cr list of the balances of all accounts on a given date, whose two totals must be equal.
**Why are the two columns equal?** — Because every entry has Dr=Cr, so the grand totals are also equal.
**If it matches, is everything correct?** — No; Dr=Cr is confirmed, but errors of omission, principle and compensating errors are still possible.
**The difference is divisible by 9 — what does it mean?** — Often a mistake of swapped digits (transposition), like 27 instead of 72.
**What is a suspense account?** — An account to hold the TB difference temporarily; it is made zero as soon as the mistake is found.
**Which errors does the TB catch?** — One-sided entries, a wrong amount on one side, or transposition — these make the columns unequal.
**Are the Trial Balance and Balance Sheet the same?** — No; the TB is an internal checklist (all accounts), the Balance Sheet a statement (only assets/liabilities/capital) — the Balance Sheet is made from the TB.
**How often should it be made?** — Mandatory at year-end; better to match it every month/quarter too.
**How to correct a mistake?** — With a journal correction entry; a one-sided mistake through suspense, a two-sided one directly. Do not quietly change an old entry.
**The difference is double some amount — what does it mean?** — Perhaps some balance has gone to the wrong side (Cr instead of Dr or the reverse); look for accounts with that amount/2.
**What if a balance is left in suspense?** — It means some mistake is still buried; find it and make suspense zero before making the final accounts.
**Does the TB match automatically in software?** — Yes; in double-entry software every voucher is posted with Dr=Cr, so the TB matches automatically — the room for mistakes drops a lot.

**Related terms:** [Debit-credit columns](/glossary/debit-credit-columns) · [Debit](/glossary/debit) · [Credit](/glossary/credit) · [Double entry](/glossary/double-entry) · [Accounting equation](/glossary/accounting-equation)

## In the end

The Trial Balance is the first assurance of the books — but not the last. Make the final accounts only when it matches; and remember that matching is no guarantee of "zero errors". Keep matching it every month, catch mistakes early with tricks like a difference divisible by 9/double, always correct with a journal entry, keep the suspense account at zero — and then trust the reports and audit fully. This discipline is what makes a society's accounts clean and reliable.

> ✅ Trial Balance and final accounts in one click — [Register on SahakarLekha](/register).

## Sources

- [Trial Balance and rectification of errors — CBSE Class 11 Accountancy notes](https://www.ourselfstudy.com/revision-notes/cbse-class-11-accountancy-chapter-6-Part1.php)

> 📘 Source: active Knowledge Items (KI-000186/049/026/027/028) + the above — Evidence Level A (educational). For an in-depth check of Trial Balance matching, consult your accountant/CA.
