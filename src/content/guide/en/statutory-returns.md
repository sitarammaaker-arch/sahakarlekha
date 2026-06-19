# Chapter 23 — Statutory Returns & Federation Report

> **After this chapter you will be able to:** the Federation report; member growth (FY-bounded); NPA classification; borrowed funds; statutory forms.

## 23.1 Why
The cooperative department/federation/NABARD need annual figures — members, capital, loans, NPA, profit.

## 23.2 Federation report
Reports → Federation Report → member count, share capital, deposits, loans, NPA, surplus — in one form.

## 23.3 Member growth (both FY bounds)
"Joined this year" = joinDate between **both** FY-start and FY-end; opening = joinDate < FY-start.

> ⚠️ Audit fix #15: earlier there was no upper bound (future-dated members were counted) — now [fyStart, fyEnd].

## 23.4 NPA — 90 days
A regular loan is NPA when 90+ days overdue; not at 1 day.

> ⚠️ Audit fix #16: earlier NPA was flagged at 1 day overdue — now > 90 days.

## 23.5 Borrowed funds (correct sub-types)
"Borrowed funds" = only the deposit and long_term_loan sub-types; not all liabilities.

> ⚠️ Audit fix #17: earlier it summed all liabilities — now the correct sub-types.

## 23.6 Other forms
Trial balance, Trading, I&E, Balance Sheet, Receipts & Payments, audit certificate — all exportable.

## ⚠️ Common mistakes

| Mistake | Avoid by |
|---|---|
| Counting future-dated members | FY bounds |
| NPA at 1 day | 90+ days |
| All liabilities as borrowed funds | The correct sub-types |

## 🔍 Audit note
"Federation-report figures reconciled with the books; NPA on the 90-day standard; member growth FY-bounded."

## 📘 Cooperative standard
NPA and member classification per RBI/NABARD norms.

## ✅ Worked example
FY 2026-27: 100 members before 1 April (opening); 12 joined during the year → total 112; one loan 95 days overdue = NPA.

## 📚 Case study
With the 1-day NPA rule, all loans showed NPA, distorting the ratio. The 90-day rule gave the true picture.

## ❓ FAQ
**Q. When is the federation report?** Year-end/on demand.
**Q. NPA definition?** 90+ days overdue.

## ✏️ Exercises
1. Opening 80; 15 joined, 2 left during the year — year-end members?
2. Is a 60-day-overdue loan NPA?
3. Which sub-types are in borrowed funds?
4. The two bounds of "joined this year"?
5. Three figures in the federation report.
