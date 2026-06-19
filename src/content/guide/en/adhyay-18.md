# Chapter 18 — GST Management

> **After this chapter you will be able to:** output/input GST; CGST-SGST-IGST; the HSN summary; correct tax on discounted bills; GSTR reconciliation.

## 18.1 The basis
Output GST on sales (payable), input GST on purchases (ITC). Net payable = output − input.

## 18.2 CGST/SGST/IGST

| Transaction | Tax |
|---|---|
| Intra-state | CGST + SGST (half each) |
| Inter-state | IGST (full) |

## 18.3 Entry (recap)
Sale: CGST/SGST Payable (Cr). Purchase: ITC (Dr, 3310).

## 18.4 HSN summary — correct tax on discounts
HSN-wise taxable value and GST. On a **discounted bill** the taxable value = net (after discount); scale = netAmount/gross.

> ⚠️ Audit fix: earlier the HSN summary overstated tax on the pre-discount value — now on the net.

## 18.5 Zero-tax / Nil
A 0% or exempt sale appears in HSN but must not be double-counted in the slab total (audit fix: skip taxAmount = 0).

## 18.6 In the app
Reports → GST Summary → output/input/net payable, the HSN table; export for GSTR-1/3B.

## 18.7 GSTR reconciliation
Reconcile the app summary with portal GSTR-1 (sales) and 3B (summary). ITC from GSTR-2B.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| IGST on intra-state | CGST+SGST |
| Tax on the pre-discount value | On the net |
| Forgetting ITC | Record in 3310 |

## 🔍 Audit note
"Output-input GST separated; HSN summary on net value; GST payable deposited on time."

## 📘 Tax standard
GST liability is not the society’s — payable to the government as a collector.

## ✅ Worked example
₹10,000 sale, ₹1,000 discount → taxable ₹9,000; 18% = ₹1,620 (CGST 810 + SGST 810); receivable = 9,000+1,620 = ₹10,620.

## 📚 Case study
HSN tax on discounted bills was high → GSTR didn’t match. After the net-value calculation, it reconciled.

## ❓ FAQ
**Q. ITC refunded in cash?** No — adjusted against output.
**Q. Not registered for GST?** The table is zero; a plain bill.

## ✏️ Exercises
1. ₹20,000 intra-state 18% — CGST/SGST?
2. ₹15,000 inter-state 12% — IGST?
3. ₹2,000 discount on ₹10,000, 18% — taxable and GST?
4. In which account is ITC?
5. The formula for net GST payable.
