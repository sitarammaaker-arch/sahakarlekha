# How to account for a member's loan instalment in a cooperative society? An example of principal, interest and arrears

For example, suppose it is the 10th of the month and a member comes to the counter with ₹5,500. He says, "Please take my instalment." The secretary asks, "Wasn't last month's instalment also pending?" The member says, "I'll pay that after the next harvest." The accountant faces three questions. Of this ₹5,500, how much is principal and how much is interest? How much is the earlier missed instalment now in arrears? And how will all this go into the books so that at month-end the member-wise loan balance, interest income and arrears all come out right?

Giving a loan is easy; accounting for each instalment is daily work. This is where things go wrong: the whole amount is posted to "loan repayment", interest does not show anywhere, and the arrears live only in someone's head. This article takes one imaginary loan all the way through and shows the parts inside an instalment, its entry, how to count the arrears of a missed instalment, what gets deducted first on a part payment, what the law says and does not say about it, and how all this works in the portal.

> 📘 **In short:** In every instalment, **principal** (reduces the loan asset) and **interest** (the society's income or receivable) are recorded separately. Arrears means **what did not come in out of the instalment due**, and it is counted separately as principal arrears and interest arrears. On a part payment, the question "should interest be deducted first or principal" is not answered by the Act read for this article; decide it from the bye-laws and the sanction terms. In the portal each loan has **only one due date**, not an instalment schedule or a demand list: this is stated clearly further on.

## What happens inside an instalment

Instalment = **part of principal + interest**. Principal is the part of the loan the member must return; interest is the price of using that money. In accounts the two go different ways:

| Part | Which account it affects | Why |
| --- | --- | --- |
| Principal | Member loan (asset) **goes down** | Money has come back, no income was earned |
| Interest | Interest income (or interest receivable) | It is the society's earning |
| Penal interest (if in the terms) | Separate income account | So it shows apart from normal interest |

There are two common ways to split an instalment. Which one applies depends on the terms of the loan sanction and the scheme; it was not found in any source of this article:

- **Equal principal:** the principal is the same in every instalment, the interest keeps falling (it is charged on the remaining principal), so the total instalment falls a little every month.
- **Equal instalment (EMI):** the total instalment is the same every month; at first the interest part is large and the principal part small, later the reverse.

Many crop loans have no instalments at all: the whole principal and interest is paid in one lump sum after the harvest. That structure is in [KCC and crop loan accounting](/blog/kcc-crop-loan-accounting). This article is about loans where repayment in instalments is fixed.

> 💡 **What was found in the Act:** in the explanation to Section 64(3), a **long-term loan** is one repayable over "not less than five years". A definition of medium-term was not found in the text of that section. So for the number of instalments and the classification of the period, see the sanction letter and the bye-laws; do not guess.

## Our imaginary loan

All figures below are **imaginary**; not from any real society, member or scheme. For simplicity, interest is taken at 1% a month (that is, 12% a year) and counted on the remaining principal:

> **Loan number L-31, member "Ramlal" (imaginary).** Amount ₹60,000; period 12 months; **equal principal ₹5,000 per month**; interest 1% a month, on the remaining principal.

Table of the first three instalments (remaining principal at the start of the month):

| Month | Remaining principal | Interest (1%) | Principal | Total instalment |
| --- | --- | --- | --- | --- |
| 1 | ₹60,000 | ₹600 | ₹5,000 | ₹5,600 |
| 2 | ₹55,000 | ₹550 | ₹5,000 | ₹5,550 |
| 3 | ₹50,000 | ₹500 | ₹5,000 | ₹5,500 |
| ... | | | | |
| 12 | ₹5,000 | ₹50 | ₹5,000 | ₹5,050 |

Adding all twelve months, the total interest comes to **₹3,900** (1% of ₹3,90,000, the sum of the twelve remaining-principal balances). If the same ₹60,000 were given at the same rate in **equal instalments (EMI)**, the monthly instalment would be about ₹5,330.93 and total interest about ₹3,971: the principal stays the same, the interest a little more, because the principal goes down later. To see the EMI table of your own loan, enter the amount, rate and period in the [loan EMI calculator](/tools/loan-emi-calculator).

> ⚠️ In a real society interest is often counted **by days** (days ÷ 365), not at 1% a month. The portal's interest page also counts by days. Here it is 1% a month only so that the arithmetic can be checked by eye.

## The entry for one instalment: principal and interest separately

The member paid the first instalment of ₹5,600 in cash on time. As per normal accounting practice:

| Account | Dr | Cr |
| --- | --- | --- |
| Cash (or Bank) | ₹5,600 | |
| Member loan (principal repayment) | | ₹5,000 |
| Interest income | | ₹600 |

After this the loan balance is ₹55,000. Write three things clearly on the receipt: the total amount, how much of it is principal and how much interest, and the balance after repayment. For the language of the voucher and the papers to attach, see [how to fill a payment voucher](/blog/payment-voucher-sample-documents-entry) and the [voucher entry guide](/blog/voucher-entry-guide).

**When to take interest into income: two methods.** First, **on receipt** (cash basis): like the entry above, interest becomes income as soon as it is received. Second, **when it falls due** (accrual): on each monthly or quarterly calculation, first *Dr Interest Receivable / Cr Interest Income*, and when the member pays, *Dr Cash / Cr Interest Receivable*. Whichever of the two you adopt, keep the same every year, otherwise year-on-year income cannot be compared. This is accounting practice; no section was opened for it.

## How to count arrears: a missed instalment

Now the real difficulty. Suppose Ramlal paid the month 1 instalment, **did not pay month 2's**, and came with ₹5,500 on the month 3 date.

First of all, keep the two layers of arrears separate:

1. **Due:** how much should have been paid so far as per the schedule.
2. **Arrears:** what remains after subtracting what was paid out of the due.

By the month 3 date, as per the schedule, **principal** of ₹15,000 (3 × ₹5,000) is due. Since the month 2 principal of ₹5,000 was never paid, the remaining principal on the member is ₹55,000, and **interest** in both month 2 and month 3 will run on ₹55,000 itself: ₹550 + ₹550 = **₹1,100** (because the principal of the missed instalment did not go down that month). This is a small point that is often missed in hand calculation: **arrears staying unpaid does not reduce the base for interest**.

Now the member paid ₹5,500. What should be deducted out of this?

| Method | To principal | To interest | Remaining principal | Interest arrears | Principal arrears* |
| --- | --- | --- | --- | --- | --- |
| **Interest first** | ₹4,400 | ₹1,100 | ₹50,600 | ₹0 | ₹5,600 |
| **Principal first** | ₹5,500 | ₹0 | ₹49,500 | ₹1,100 | ₹4,500 |

\* Principal paid so far out of the ₹15,000 principal due: in the first method ₹5,000 + ₹4,400 = ₹9,400, so arrears ₹5,600; in the second ₹5,000 + ₹5,500 = ₹10,500, so arrears ₹4,500.

In both, the member paid the same ₹5,500, but the picture in the books is different. In the first method interest arrears are zero but the loan balance stays higher; in the second the loan balance looks lower but ₹1,100 of interest stays in arrears. So **deciding which head a part payment goes to is a question of policy, not of accounting**, and changing this policy midway raises questions in audit.

### What the law says on this

In the text of the Haryana Cooperative Societies Act, 1984 that we read (amended up to 2007), **no direct rule was found on applying a part payment first to interest or first to principal**. In the third-party copy of the Rules, 1989 we read, this order was not found either. So the settled view on this is: **ask from the sanction rules, the bye-laws and the directions of your bank/central cooperative bank**, and record whatever is decided in one line in the managing committee meeting. Then apply the same to every member.

## Three legal limits and points on interest

What was found in the text of the Act directly linked to recovering loan instalments is this:

- **Section 65: limit on interest.** On a short-term loan (one given for a period of **up to fifteen months**), the society cannot recover from a member **interest more than the principal amount** of the loan; this limit applies notwithstanding anything in the Act, Rules, bye-laws or any agreement. On our ₹60,000 loan, total interest cannot be more than ₹60,000: in a normal running loan this limit is hardly ever touched, but if interest keeps piling up on a loan in arrears for years, this is the limit that comes in.
- **Explanation to Section 87: interest accrued on arrears and profit.** While working out net profit, "all interest accrued and accruing on amounts which are overdue" is deducted from gross profit; and if accrued interest of the previous year is **actually recovered** in the current year, the society can add it to the current year's net profit. In plain language: the interest on an overdue loan does show in the books once posted, but it becomes part of the profit to be distributed only when it is received from the member. Its effect on profit distribution is explained in the [dividend guide](/blog/cooperative-society-member-dividend-guide).
- **Clause (d) of the proviso to Section 20: the defaulter's vote.** A member who is in default of any amount due to the society has no right to vote. That is why the list of defaulters must be accurate before an election or general meeting. (The text of Section 20 has other clauses of this same proviso too; only this one point is taken here.)

> ⚠️ I am **not** writing here any limit from the Rules on penal interest, the normal interest rate or the instalment period: no direct limit on the loan rate was found in the text we read. Take the rate and penal interest only from the sanction terms and the bye-laws.

## Next step if there is no recovery: Sections 72 to 74

The Act has a special route of recovery, but not for everyone: it applies to the **instalment** of a loan given against the security of a **mortgage or charge** under Section 53.

- Section 72: if such an instalment or any part of it remains unpaid for **more than three months** after falling due, the society, along with other remedies, can apply to the Registrar for **attachment and sale of produce (distraint)**. Distraint cannot be made **six months** after the date it fell due.
- Sections 73-74: at or before the time of distraint, the person making it gives the debtor a **written demand**; if payment is not made within **fifteen days** of service of the demand, he can auction the distrained property, and the sale is subject to **confirmation by the Registrar**.

In the copy of the Rules we read, formats of these applications and demands were also seen (such as the application format for Section 72). This is a third-party copy, so **match the rule numbers and formats with the official text**. The effort before this, that is the list of defaulters, the notice dates and the clear arrears of each instalment, is the same accounting being built in this article; the method of a recovery drive is in [loan recovery: the most important work before year-end](/blog/loan-recovery-before-year-end).

## Member-wise ledger: the real record of arrears

The record of instalment recovery should be found in three places:

1. **Receipt/passbook:** in the member's hand, date, amount, principal, interest, balance.
2. **Member's loan account (loan ledger):** date-wise rows for each loan: disbursement, interest charged, repayment received, principal balance.
3. **General ledger (GL):** the total balance of the "member loan" account, which must equal the sum of the balances of all member accounts.

At month-end this matching is the most important: the sum of member-wise balances versus the control account in the books. Any difference that shows is somewhere one member's instalment posted wrongly, a double entry or a missed receipt. The full method of this matching is in the [monthly reconciliation checklist](/blog/monthly-reconciliation-checklist-cashbook-bank-trial-balance).

## How this works in the SahakarLekha portal

This part covers only what was checked in the portal's code (as per the version of 16 October 2026). The loan page shows only in societies where the lending feature is turned on.

**What the portal does:**

- In the **Loan Register**, each loan's amount, interest rate, disbursement date, due date, security and status are recorded. Each row has a **repayment** button: you fill the **total amount** and the **interest** in it (optional), the portal works out **principal = total − interest**, you choose cash or bank, and enter the date.
- **One receipt voucher** is made automatically: Cash/Bank Dr; principal Cr to the loan account (3304 in the default chart); interest Cr to the **interest receivable** (3313) already posted on this loan, and any interest that was not posted earlier goes straight to interest income. If making the receipt fails, **no change is made to the loan** and a warning shows.
- If you fill principal **more** than the outstanding, the portal stops you: the extra amount must be written as interest.
- The **"Fill accrued interest"** button fills in the interest posted so far on that loan but not yet received. Out of the posted interest, the **overdue** part is deducted first.
- The **Loan Interest** page (for the administrator and accountant roles) counts interest by days for a monthly, quarterly or yearly period and makes a single journal: interest on running loans *Dr Interest Receivable / Cr Interest Income*, and interest on **overdue** loans *Dr Interest Receivable / Cr Overdue Interest Reserve* (a liability). This follows the explanation to Section 87: interest on an overdue loan does not go into income while it is in arrears, and on recovery it moves from the reserve to income.
- **The Section 65 limit** applies for Haryana societies: on a short-term (up to fifteen months) loan, interest must not be charged beyond the principal, so the calculation stops there and the page shows a mark for this.
- Each loan's **ledger** (disbursement, interest, repayment, principal balance) can be seen and taken out in PDF and Excel, and if the total of the rows does not match the recorded amount repaid, the page signals a **mismatch**.
- If the receipt of any repayment is **cancelled**, the interest deducted by it opens up again automatically.
- After the due date passes, the loan is counted as **overdue**, and you can also set the status to "overdue" by hand.

**What the portal does not do (know this clearly):**

- **No instalment schedule or demand list is made.** In the portal each loan has **only one due date**. A comment in the code also says this: in the app each loan has one due date, not a demand list of instalments that have fallen due. This means that for a loan with 12 monthly instalments, **the portal does not automatically work out instalment-wise arrears** like "month 2 instalment in arrears".
- **The order of a part payment is not decided automatically.** How much is interest, you write yourself while filling the repayment. You must apply the order in the sanction letter (interest first or principal) yourself.
- **Penal interest is not charged automatically.** No such calculation was found in the code.
- The portal does not work out **NPA classification or the provisioning rate**: this article too gives no rate, because its source was not opened.

**So what is the practical route for an instalment loan?** (1) Record the repayment of every instalment through this same button, filling the interest part as per your fixed policy; (2) keep an instalment-wise demand list (DCB) in a separate register or spreadsheet: instalment due, paid, arrears; (3) when any instalment falls into arrears, set the loan's status to "overdue" by hand, so that its interest goes to the overdue reserve; (4) at month-end, match the total balance of the Loan Register with the "member loan" account in the books.

> 📌 **For PACS:** if your PACS has to work on the state's designated portal, the official record will stay there; SahakarLekha does not replace it. On this portal you can keep your books and member-wise loan records. To understand the requirements of the designated portal, see the [e-PACS guide](/blog/e-pacs-haryana-erp-day-end-audit-explained).

## Common mistakes

- **Posting the whole instalment to "loan repayment".** Interest is not recorded anywhere; the loan balance shows less and income shows less.
- **Reducing the interest base along with the missed instalment.** If the principal was not paid, interest runs on the old balance.
- **Changing the order of part payment from member to member.** Fix one policy and apply the same to every member.
- **Not keeping arrears in any register.** "The member will remember" does not make a fact for distraint or audit.
- **Showing overdue interest as income and distributing the profit.** The explanation to Section 87 says the opposite.
- **Charging interest non-stop on long arrears.** See the principal limit on short-term loans.
- **Putting off the monthly matching.** Catching the difference between the member-wise total and the books at year-end is very costly.

## Three things to remember
- 🧾 On every instalment receipt write all four: total amount, principal, interest and the balance after repayment.
- 📉 Which head a part payment is deducted against is decided by policy: decide it once in writing, then keep the same for every member.
- 🔍 In the portal a loan has one due date; keep the instalment-wise demand list separately and match it with the books every month.

## Frequently asked questions

**Why record principal and interest separately in an instalment?** — Principal reduces the loan asset and interest is the society's income. Mixing the two makes both the loan balance and income look wrong.

**What is the difference between equal principal and EMI?** — In equal principal the principal stays the same in every instalment and the interest keeps falling; in EMI the total instalment stays the same. Which one applies is decided by the sanction terms.

**How does interest run on an instalment in arrears?** — Until the principal is paid, interest keeps running on that same balance. In our example, interest in both month 2 and 3 came to ₹550-₹550 on ₹55,000.

**Should a part payment go first to interest or to principal?** — No direct rule on this was found in the text of the Act we read. Decide it from the sanction terms, the bye-laws and your bank's directions, and record it in the meeting.

**Is there any limit on interest on a short-term loan?** — Yes: under Section 65 of the Act, interest more than the principal amount cannot be recovered on a loan of up to fifteen months.

**Should interest on an overdue loan be counted in income?** — Under the explanation to Section 87, interest on overdue amounts is deducted while working out profit and can be added in the current year when recovered. The portal keeps it in the Overdue Interest Reserve.

**Is there a legal route of recovery when an instalment is missed?** — If the instalment of a loan against mortgage/charge remains unpaid for more than three months, an application can be made to the Registrar under Section 72 for distraint of produce; distraint cannot be made after six months. Match the rule numbers with the official text.

**Can a defaulting member vote?** — Under clause (d) of the proviso to Section 20, a member in default of an amount due to the society has no right to vote.

**Does the portal make an instalment schedule?** — No. In the portal each loan has one due date. Keep a separate demand list for instalment-wise arrears.

**Does the portal work out penal interest or NPA classification?** — No. Take the rate and day limits from the applicable directions; this article gives no rate because its source was not opened.

## In the end

Accounting for instalments is really a discipline of three things: principal and interest separate on every receipt, one fixed order for part payments, and a separate register of arrears that matches the books every month. Once all three are in place, the question at the counter in front of the secretary, "how much principal and how much interest in this instalment?", is settled in half a minute.

If you are a society's secretary, accountant or manager and want to see loan repayments, posted interest and overdue status from one place, the Loan Register has all of these (except the instalment-wise demand list, which must be kept separately as explained above).

> ✅ Start your eligible cooperative society's account on SahakarLekha: [Register on SahakarLekha](/register), or see [software for PACS](/software/pacs).

Related: [Loan and interest accounting](/blog/loan-and-interest-accounting) · [KCC and crop loan accounting](/blog/kcc-crop-loan-accounting) · [Loan recovery: before year-end](/blog/loan-recovery-before-year-end) · [Member deposits and interest](/blog/member-deposit-interest-accounting)

**Related terms:** [Instalment](/glossary/instalment) · [Member loan](/glossary/member-loan) · [Loan recovery](/glossary/loan-recovery) · [NPA](/glossary/npa) · [Interest income](/glossary/interest-income)

## Sources

- [The Haryana Co-operative Societies Act, 1984 (Haryana Act 22 of 1984, amended up to Oct 2007), PDF on the Ministry of Cooperation, Government of India site](https://cooperation.gov.in/sites/default/files/inline-files/HARYANA-CO-OPERATIVE-SOCIETIES-ACT.pdf): Section 20 (clause d of the proviso), reference to 53, explanation to 64(3), 65, 72, 73, 74 and explanation (i)-(ii) to 87. Text downloaded and read directly, 21 October 2026.
- [The Haryana Co-operative Societies Rules, 1989 (republished text on Indian Kanoon)](https://indiankanoon.org/doc/66802510/): opened only to check whether there is any direct rule on the order of part payment of an instalment or on penal interest (none found), and that formats of the distraint application/demand are in the Rules. This is a third-party copy; **matching with the official India Code PDF is still pending.**
- [Haryana Cooperation Department: State Acts and Rules](https://coop.haryana.gov.in/actsrules/state-acts-and-rules): to identify the official source page of the Act/Rules.

> 📘 **Method note:** The loan, member, amounts, interest rate (1% a month) and scenario are **imaginary**, not from any real society or scheme. Statutory provisions are from the texts listed above; where no direct provision was found in the text (order of part payment, rate of penal interest, limit on interest rate, definition of medium-term, NPA days and provisioning rate), the article says so clearly. The principal-interest entry, the choice of accrual/cash and the monthly matching are **general accounting practice**, not legal directions. No income-tax limit or section is in this article, because its source was not opened. The Act is the text amended up to 2007; give priority to any later notification. SahakarLekha's feature details (Loan Register repayment, structure of the receipt voucher, loan interest calculation, overdue reserve, Section 65 limit, loan ledger; one due date per loan) are as per the version of 21 October 2026; the article will be updated if the feature changes.
