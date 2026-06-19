# Chapter 19 — TDS & the Quarterly Return (26Q)

> **After this chapter you will be able to:** when and how much TDS; deducting once; depositing TDS payable; the TDS register and 26Q quarters.

## 19.1 What is TDS
Tax deducted at source on certain payments; the society deducts it and deposits it with the government.

| Payment | Typical rate |
|---|---|
| Contract (194C) | 1%/2% |
| Rent (194I) | 2%/10% |
| Commission (194H) | 5% |
| Purchase of goods (194Q) | 0.1% |

## 19.2 Deduct once (no double deduction)
Amount payable = grandTotal (already net of TDS); the deducted TDS sits separately in 2202. **Don’t deduct twice.**

> ⚠️ Audit fix #9: the auto-repair loop did `netPayable = grandTotal − tds`, deducting twice and unbalancing — now `netPayable = grandTotal`.

## 19.3 Entry (recap)
₹1,00,000 contract, 1% = ₹1,000: Dr Expense 1,00,000 / Cr Contractor 99,000 / Cr TDS Payable 1,000.

## 19.4 Depositing
Dr TDS Payable (2202) / Cr Bank; keep the challan.

## 19.5 TDS register — correct quarter/year
The register derives the financial year and quarter from the payment date (p.date), not the society FY.

> ⚠️ Audit fix #10: earlier it stamped the current FY and a month-only quarter — now from the payment date.

## 19.6 26Q quarters

| Quarter | Period | Due |
|---|---|---|
| Q1 | Apr–Jun | 31 Jul |
| Q2 | Jul–Sep | 31 Oct |
| Q3 | Oct–Dec | 31 Jan |
| Q4 | Jan–Mar | 31 May |

## 19.7 In the app
Reports → TDS Register → quarter-wise deductions; export for 26Q; PAN-wise detail.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| TDS twice | Payable = grandTotal |
| Late deposit | The due date |
| Wrong quarter | From the payment date |

## 🔍 Audit note
"TDS deducted at the correct rate, deposited on time; 26Q reconciled quarter-wise; PAN available."

## 📘 Tax standard
Late deposit carries interest and a late fee; a higher rate if no PAN.

## ✅ Worked example
₹50,000 rent, 10% = ₹5,000: Dr Rent 50,000 / Cr Landlord 45,000 / Cr TDS Payable 5,000; then Dr TDS Payable 5,000 / Cr Bank.

## 📚 Case study
A purchase-TDS deducted twice unbalanced the voucher and blocked the purchase. After deducting once, normal.

## ❓ FAQ
**Q. Below the threshold?** No TDS.
**Q. A wrong deduction?** Fix the voucher; correct it before deposit.

## ✏️ Exercises
1. ₹2,00,000 contract 2% — TDS, payable, entry.
2. Deposit ₹4,000 TDS Payable from bank.
3. A July deduction is in which quarter, due when?
4. Why deduct only once?
5. The effect of having no PAN.
