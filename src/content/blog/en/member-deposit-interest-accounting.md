# How to keep accounts of members' deposits and interest in a cooperative society?

As an example, suppose a member comes with a passbook and asks, "How much interest has my FD earned? It matured today." The secretary looks at the passbook: the balance written is ₹53,500. But in the "member deposits" account in the books, the balance shows differently, because last year's interest was never booked. In the same week the auditor asks, "How much deposit has the society taken in total, and is it within the set limit?" And another member has died, and the deposit has to be returned to the nominee.

Members' deposits are the most trusted money the society holds, and just as sensitive. When deposits grow, the society has more capital to work with; but it is **not the society's earning, it is a liability**, on which interest has to be paid and which has to be returned. This article is the full map of this: types of deposit, the entry for each transaction, calculating interest, the law on interest rates and deposit limits, withdrawal and maturity, and audit preparation.

> 📘 **In short:** A member's deposit is a **liability** of the society, not share capital or income. On taking a deposit **Dr cash/bank, Cr deposit liability**; on withdrawal the reverse. The **interest paid on deposits is the society's expense**: **Dr interest expense, Cr deposit liability**. Interest must be **booked** by year-end, otherwise profit looks higher. What I found in the Haryana Act and Rules: the limit on deposits and borrowing (**Section 63**), the depositor becoming a member (**Section 19-A**), the charge on deposits for dues (**Section 55**), and a limit on the interest rate on deposits (**Rule 38(3)**, from a third-party copy). The exact rate of interest is set by each society's own scheme and the general body's decision.

The basic difference between the three forms of money coming from a member (share capital, deposit, admission fee) is in [Member and share register](/blog/member-and-share-accounting). This article expands on the "separate guide to deposit accounting" mentioned there.

> ⚠️ **A clarification:** the deposit limits and rules in this article are based on the text of the **Haryana Cooperative Societies Act, 1984 and Rules, 1989**. Societies that take deposits like a bank (such as cooperative banks) may have separate Reserve Bank/NABARD instructions, whose source I did not open. Confirm any additional instructions that apply to your society with your ARCS/DCCB.

## In this article

1. What a deposit is: difference from share capital
2. Four types of deposit: SB, FD, RD, Pigmy
3. Entry for each transaction
4. Calculating interest: with examples
5. Who sets the interest rate
6. Limit on taking deposits
7. Depositor and membership
8. Withdrawal, maturity and closing the account
9. Deposits and loans: the charge for dues
10. Year-end: the accrued interest entry
11. Tax and audit preparation
12. Calendar, common mistakes, FAQ

## What a deposit is: difference from share capital

| Item | Nature | What happens |
| --- | --- | --- |
| **Share capital** | Capital (member's stake) | Part of the society's own capital; refund as per the rules and bye-laws |
| **Member deposit** | **Liability** | The society is bound **to return it and pay interest** to the member |
| **Admission fee** | Income | Not refunded |

One member can have all three in their name, but **the three accounts must stay separate**, otherwise neither the share balance, nor the deposit, nor the income will show correctly. And one thing checked first in audit: never treat a deposit as share capital, because a dividend limit applies to capital and interest has to be paid on deposits.

## Four types of deposit: SB, FD, RD, Pigmy

| Type | What it is | How interest is earned |
| --- | --- | --- |
| **SB (savings deposit)** | Member deposits and withdraws whenever they want | **On the balance, by number of days** |
| **FD (fixed deposit)** | A lump sum, for a fixed period | **Principal × rate × period**, paid at maturity |
| **RD (recurring deposit)** | A fixed instalment every month, for a fixed period | **Each instalment earns** interest for its remaining period |
| **Pigmy deposit** | Small daily deposits, through a collector (agent) | On the balance of daily deposits, as per the society's scheme |

**The conditions of any scheme,** such as minimum amount, period, penalty on premature withdrawal, interest rate and method of payment, are set by the society's bye-laws and the decision of the general body/committee. I did not find a fixed format of any scheme in the Haryana Act or Rules.

## Entry for each transaction

A deposit is the society's liability, so the logic of the entry is simple:

| Event | Dr | Cr | Amount *(imaginary)* |
| --- | --- | --- | --- |
| Account opened / deposit taken (cash or bank) | Cash/bank | Member deposit (liability) | ₹50,000 |
| Member withdrew | Member deposit (liability) | Cash/bank | ₹5,000 |
| Interest credited to the account | **Interest expense (on deposits)** | Member deposit (liability) | ₹3,500 |
| Maturity/account closed, full balance paid | Member deposit (liability) | Cash/bank | Full balance |

Three points are special in this:

- **Taking a deposit is not "income":** money came, but it is not the society's, it is the member's. So the Cr goes not to income but **to a liability**.
- **Interest is an "expense":** the interest the society pays is its cost, and the matching Cr in the member's account increases the deposit.
- **FD is usually under a separate liability head:** many charts have separate accounts for **SB/member deposits** and **fixed deposits (FD)**, so that both show separately in the Balance Sheet. (Which account number, depends on your chart of accounts.)

## Calculating interest: with examples

**Main formula:** *principal × rate (annual) × time.* Below are simple formulas for all three types. *(Rates and amounts are imaginary, only to explain; the real rate will be your society's scheme rate.)*

**SB: on the balance, by number of days:**
> Interest = balance × annual rate × (days ÷ 365)

Example: balance ₹10,000, rate 4%, 90 days:
10,000 × 4% × 90 ÷ 365 = **₹98.63**.

**FD: principal, rate and period in months:**
> Interest = principal × annual rate × (months ÷ 12);  maturity value = principal + interest

Example: ₹50,000, rate 7%, 12 months:
50,000 × 7% × 12 ÷ 12 = **₹3,500**; maturity value **₹53,500**.

**RD: monthly instalment, each instalment earns interest for its remaining period:**
> Total interest = instalment × (rate ÷ 100 ÷ 12) × n(n+1) ÷ 2   (n = months of instalments)

Example: ₹1,000 monthly, rate 6%, 12 months:
1,000 × (6 ÷ 100 ÷ 12) × (12 × 13 ÷ 2) = 1,000 × 0.005 × 78 = **₹390**; maturity value = 12,000 + 390 = **₹12,390**.

**The limits of these formulas, which you should know honestly:**

- These are **simple interest** formulas. Many societies give **compound** (quarterly/annual) interest on FDs; the method written in the scheme should apply, and the member should have been told in advance.
- **Basis of the year:** 365 days are taken above. Some societies take 360 days or 30 days per month. In one society the same basis should stay every year.
- **Rounding:** in money calculations, round to the paisa once at the end; rounding at every step adds up a difference.
- **Up to which date interest is calculated:** interest up to year-end should be in that year's books, even if it is credited to the member's account later (see "Year-end" below).

## Who sets the interest rate

How much interest to pay on deposits is decided by each society looking at its own position, but some limits are in the Rules. As per the text of the Haryana Cooperative Societies Rules, 1989 that I read *(this is from a third-party copy, and that page itself said the original publication was not available, so matching with the official text is necessary)*:

| Point | Source | What it says |
| --- | --- | --- |
| Limits on deposits and borrowing | Rule 38(1) | Deposits/loans from members or non-members up to **the limit set by the general body**, with the Registrar's approval; the Registrar can reduce the limit; **for PACS/service societies the Registrar's approval is not required** |
| **Limit on the interest rate** | Rule 38(3) | The society cannot take deposits/loans **at a rate more than 3 percent higher** than the rate the **central cooperative bank** of its area gives on similar deposits/loans; the Registrar can give exemption by general or special order |
| Liquid resources | Rule 39 | A society taking deposits and giving cash credit shall keep **liquid resources** as per the standard set by the Registrar |

**In practice this means:** first find out the rate of the same kind of deposit at your area's central cooperative bank; your rate should not go more than 3 percent above it (unless there is an exemption order of the Registrar). Keep the general body's set limit and the resolution on rates in the file. And follow the standard of **liquid resources** (money that stays ready to pay at once if depositors ask) after asking the Registrar.

## Limit on taking deposits

This is the most often missed limit. Under **Section 63(1)** of the Haryana Cooperative Societies Act, 1984, a society can take deposits, loans and grants up to the limit set in the bye-laws; and the proviso says that **the total amount of deposits and loans taken in any financial year shall not exceed "ten times the sum of the subscribed share capital and accumulated reserves";** and in calculating this sum **the accumulated loss is deducted.**

An imaginary calculation:

| Item | Amount |
| --- | --- |
| Subscribed share capital | ₹20,00,000 |
| (+) Accumulated reserves | ₹5,00,000 |
| (−) Accumulated loss | ₹1,00,000 |
| **Base** | **₹24,00,000** |
| **Ten times (upper limit)** | **₹2,40,00,000** |

That is, for this society the total of deposits and loans taken in that financial year should not go above ₹2.4 crore.

**Two cautions:**

- **The text speaks of the amount "taken in any financial year".** How to count this (total new deposits received over the year, or the total balance on that day), I could not settle from the text. So ask your Registrar/ARCS, fix one method and keep a note of it.
- **The bye-law limit** (first line of Section 63(1)) and the general body's set limit (Rule 38(1)) can be stricter than this. Whichever of the three is lowest is your limit.

(If you find any difference in the limit, rate and resources rules, first take a written clarification from the Registrar; I have not matched these with any official circular.)

## Depositor and membership

Under **Section 19-A** of the Haryana Act, in *any unit of the cooperative credit structure* (except cooperative banks), **a person wishing to make a deposit has to become a member of that society,** and on becoming a member gets **full voting rights**. This directly affects the register:

- **The depositor's name should be in the member register**; do not take deposits from non-members.
- **The member code of the deposit account should be linked to the member register,** so that a member's shares, deposits and loans show at a glance.
- Their role in **voting and elections**: the depositor is also a full voter, so their record should be equally clean.

(Details of the member register: [Member and share register](/blog/member-and-share-accounting), [Secretary's work](/blog/secretary-work-meetings-records-accounts-audit).)

## Withdrawal, maturity and closing the account

**Withdrawal (SB):**

- [ ] Withdrawal should not be **more than the balance**. This is the most basic control.
- [ ] Member's signature/thumb impression on the withdrawal slip, entry in the passbook, and the name of the person who checked.
- [ ] Additional approval for **big withdrawals**, amount limit by the society's resolution.
- [ ] Precautions for **cash withdrawals**. ([Cash handling and verification](/blog/cash-handling-and-verification).)

**FD/RD maturity and premature withdrawal:**

- [ ] Make a **register of maturity dates** and check every month which FD/RD will mature next month, so that liquid money is ready for payment.
- [ ] The rule for **premature withdrawal** (what penalty, which rate) should be written in the bye-laws/scheme, and the member should know it in advance. I did not find any fixed format for this in the Act/Rules.
- [ ] **Matured deposit the member has not collected:** it **remains a liability**, not income. What further interest applies to it depends on the scheme and bye-laws.
- [ ] **FD receipts/certificates** serially numbered, and taken back and cancelled at maturity.

**Death of a member:** the deposit is settled to the **nominee or legal heir**. The nominee record should be entered in advance. (Under Section 40 the member register has evidentiary value for the nominee; see [Secretary's work](/blog/secretary-work-meetings-records-accounts-audit).) **Set-off** of the deceased member's dues can also apply (next section).

## Deposits and loans: the charge for dues

A deposit is not just a liability, many times it is also **security for a loan**. Two provisions of the Act are useful:

| Point | Source | What it says |
| --- | --- | --- |
| **Charge on deposits for dues and set-off** | Section 55 | The society has a **charge** on the **deposits** (and shares, dividend, bonus) of a member, past member or deceased member for their dues, and can **set off** the dues from them |
| **Loan against the security of deposits** | Section 64(1) | The society can give loans to members, employees (under the Registrar's scheme) or **to depositors against the security of their deposits** |

In practice:

- **When giving a loan against a deposit**, mark a "lien" on the deposit, so that the same deposit is not used twice: once as security for the loan, and again in a withdrawal.
- **If dues are to be recovered**, adjust from the member's deposit (Section 55): entry **Dr member deposit (liability), Cr member loan (receivable)**. Give the member written notice and details. (Loan accounts: [Loan and interest accounting](/blog/loan-and-interest-accounting).)
- **A deceased member's dues** can be adjusted from their deposit first; the nominee gets the balance.

## Year-end: the accrued interest entry

This is where most mistakes happen. Suppose the FD interest will be paid at maturity, next year, but ten months of this financial year have passed. That ten months' interest is **this year's expense**, even if it is not yet credited to the member's account. At year-end that entry should be made separately:

| Step | Dr | Cr |
| --- | --- | --- |
| Interest up to year-end (not yet due) | Interest expense (on deposits) | Interest payable / member deposit |

**Why this is so important:** in the explanation to Section 87 of the Haryana Act, **while working out net profit, "interest payable on deposits and loans" is deducted from gross profit.** If this interest is not booked at all, profit looks higher, and from that higher profit reserves are set aside and **dividend is distributed**, which becomes a burden on the society. (Dividend: [Member dividend guide](/blog/cooperative-society-member-dividend-guide); order of profit: [Profit distribution](/blog/profit-distribution-and-reserves).)

**One more limit on dividend, linked to depositors:** the sense of the text of Rule 72(3) is that as long as **a claim of any depositor or lender is outstanding, dividend cannot be paid.** (This is from a third-party copy, and the text of that sub-rule is somewhat incomplete, so I have written it as its sense; see [Member dividend guide](/blog/cooperative-society-member-dividend-guide).) That is, **if a matured deposit has not been paid, the question of paying it arises before the dividend proposal.**

## Tax and audit preparation

**Tax:** whether **tax deduction (TDS)** applies on the interest the society pays to members, and up to what limit, is a matter of checking the income tax provisions. I did not open the Income Tax Act text for this, so I am not giving any section or limit. **Confirm this with your CA**, and for a general understanding of TDS see [TDS and 26Q](/blog/tds-and-26q-for-societies).

**Audit preparation:** under Section 95(3) the auditor has free access to books, papers, vouchers and property. For deposits the auditor will generally look at these, so keep them ready in advance:

| Point | Source | What it says |
| --- | --- | --- |
| Upper limit on deposits and borrowing | Section 63(1) | Ten times share capital + accumulated reserves − accumulated loss |
| Depositor being a member | Section 19-A | In a unit of the cooperative credit structure |
| Charge on deposits and set-off | Section 55 | For dues |
| Limit on the interest rate on deposits | Rule 38(3) *(third-party copy)* | Not more than 3% above the central cooperative bank's rate |
| Types of deposit, scheme, rate, penalty for premature withdrawal | — | **I did not find it in the Act/Rules**; bye-laws and the decision of the general body/committee |

- [ ] **Deposit register:** every account, type, member code, opening date, rate, balance, maturity date.
- [ ] **Matching passbook copies with the books:** the total of all account balances should match the deposit liability account in the books. (Monthly matching: [Monthly reconciliation](/blog/monthly-reconciliation-checklist-cashbook-bank-trial-balance).)
- [ ] **Interest calculation sheet,** with rate and basis (365/360, simple/compound), and the resolution fixing the rate.
- [ ] **Year-end accrued interest entry** and its calculation.
- [ ] **Deposit limit calculation** (ten times under Section 63) and the general body's resolution on the limit.
- [ ] **Maturity register** and list of unpaid matured deposits.
- [ ] **FD receipts,** issued and cancelled, serially.
- [ ] **Balance confirmation from members**: written confirmation from selected members, which gives a lot of assurance in audit.
- [ ] **Approval of deposit withdrawals** and record of big withdrawals. (Full preparation: [Audit preparation checklist](/blog/audit-preparation-checklist).)

> ⚠️ **For PACS and readers on a prescribed portal:** if your PACS keeps deposit accounts as per a prescribed ERP/portal (such as e-PACS) or DCCB instructions, then the deposit accounts, interest rates and reports should follow that. The checklist in this article does not replace it; it is for understanding it and for your own records. (Background: [e-PACS and day-end](/blog/e-pacs-haryana-erp-day-end-audit-explained).)

## Calendar

| When | Task |
| --- | --- |
| **Daily** | Deposit/withdrawal entry, passbook, voucher the same day; pigmy collector's daily total |
| **Every month** | Matching deposit register against books; list of FD/RD maturing next month; missed RD instalments |
| **Quarterly** | Calculating and crediting interest (as per scheme); check of liquid resources |
| **Year-end** | Accrued interest entry; calculation of deposit limit (Section 63); balance confirmation from members; audit files |

## Common mistakes

1. **Recording deposits in share capital or income.** It is a liability.
2. **Booking interest under some other head instead of "expense",** or forgetting to book it at all.
3. **Not booking year-end accrued interest.** Profit looks higher, and dividend is distributed from it.
4. **Not calculating the deposit limit (Section 63).**
5. **Taking deposits from non-members.** Section 19-A.
6. **Keeping the interest rate much higher than the central cooperative bank's rate,** without the Registrar's exemption order (Rule 38(3), subject to matching).
7. **Not keeping a register of maturity dates.** Money is not available at the time of payment.
8. **Withdrawal more than the balance or without approval.**
9. **Not putting a lien on a deposit against which a loan is given.** The same deposit gets withdrawn.
10. **Passbook and book balances differing.** Both the member's trust and the audit suffer.

## Deposit accounts in SahakarLekha

SahakarLekha's **Deposits** page (SB, FD, RD and Pigmy) keeps member-wise deposit accounts, and its accounting rules are the same as above: a deposit is a **liability**, interest is an **expense**.

| Task / problem | In SahakarLekha |
| --- | --- |
| Opening a member's deposit account (SB/FD/RD/Pigmy) | Deposits: New Account, member, type, rate, opening deposit |
| Deposit and withdrawal | Deposits: Deposit / Withdraw (no withdrawal above balance), voucher automatic |
| Calculating and crediting interest | Deposits: Credit Interest (Dr interest expense / Cr deposit), the calculated amount can be changed |
| FD/RD maturity, closing account | Deposits: Mature/Close: full balance paid (Dr deposit / Cr cash-bank) |
| RD instalment schedule, missed instalments | Deposits: Installment Schedule and an "installment(s) missed" mark |
| Daily pigmy deposits | Deposits: Daily Collection by choosing the agent (collector) |
| Ledger | PDF and Excel |
| If a passbook entry does not save | The portal rolls it back and warns, it does not leave it quietly |
| Financial year lock | No deposit/withdrawal once locked |
| Setting the interest rate, deposit limit, scheme conditions | Your society's/general body's decision |
| Calculating the Section 63 limit, checking the Rule 38(3) rate limit | Your job: SahakarLekha does **not yet check these automatically** |
| Approval of deposits/withdrawals | **Your job:** the portal's optional Maker–Checker hold does not apply to deposit/withdrawal vouchers (these vouchers are outside that hold), so take approval for big withdrawals on a paper slip |
| TDS on deposit interest, further interest on uncollected matured deposits | Your and your CA's decision; the portal does not apply it |

**Note:** the Deposits page does not open for all society types; it depends on the **deposit ledger capability**, which in the portal is for PACS, multipurpose, multi-state and "other" type societies; for types like dairy, consumer, housing this page does not open. If you don't see this page in your society, check the society type setting.

That is, the portal carries the burden of entries for every deposit transaction, interest calculation, passbook and maturity, so that the secretary's and accountant's time goes into the interest rate, checking limits, approving withdrawals and members' questions: not into adding up. (Full introduction for PACS with deposits and loans: [PACS software](/software/pacs).)

## Three things to remember

- 🏦 A member's deposit is the society's liability: on taking a deposit Dr cash/bank, Cr deposit liability; interest is the society's expense (Dr interest expense, Cr deposit liability). Share capital, deposits and admission fee in three separate accounts, and interest up to year-end booked in that same year.
- ⚖️ The Act has the deposit limit (Section 63: ten times share capital + accumulated reserves − loss), the depositor being a member (Section 19-A), the charge on deposits for dues (Section 55) and loans against the security of deposits (Section 64(1)); the limit on the interest rate is in Rule 38(3) (third-party copy, subject to matching). Scheme and rate conditions are set by the bye-laws and the general body/committee.
- 🖥️ The portal handles the accounts, interest and passbook of SB/FD/RD/Pigmy, but does not automatically check the deposit limit, rate limit and withdrawal approval, and does not deduct tax on deposit interest; these are your responsibility.

## Frequently asked questions

**How to keep accounts of members' deposits?** — Keep a separate deposit account for each member (SB/FD/RD/Pigmy by type); on deposit Dr cash/bank, Cr deposit liability; on withdrawal the reverse; on interest Dr interest expense, Cr deposit liability; and match the total of all account balances with the deposit account in the books.
**Is a deposit income or a liability?** — A liability. Deposit money belongs to the member, which the society will return and on which it will pay interest. Only the interest margin the society earns on loans comes into income.
**How to work out interest on deposits?** — SB: balance × rate × days ÷ 365; FD: principal × rate × months ÷ 12; RD: instalment × (rate ÷ 100 ÷ 12) × n(n+1) ÷ 2. These are simple interest formulas; if compound or a 360-day basis is written in the scheme, that applies.
**Who sets the interest on deposits?** — The society's scheme and the decision of the general body/committee. As per Rule 38(3) the rate should not be more than 3 percent higher than the central cooperative bank's rate for the same kind of deposit (the Registrar can give exemption); this text is from a third-party copy, official matching is pending.
**How much deposit can a society take?** — As per Section 63(1), up to the limit set in the bye-laws, and total deposits and loans taken in any financial year not more than ten times share capital and accumulated reserves (minus accumulated loss). As per Rule 38(1) the general body also sets a limit.
**Can deposits be taken from non-members?** — As per Section 19-A of the Haryana Act, in a unit of the cooperative credit structure (except cooperative banks) the depositor has to become a member and gets full voting rights.
**Why is the year-end entry for deposit interest necessary?** — As per the explanation to Section 87, interest payable on deposits and loans is deducted while working out net profit. If interest is not booked, profit looks higher, and reserves and dividend are taken out of it.
**If a member has dues, can they be recovered from their deposit?** — As per Section 55 the society has a charge on the member's deposit for dues and can set off the dues from it. Give the member written notice and details.
**What if a matured deposit is not collected?** — It remains the society's liability, not income. Whether further interest applies depends on the scheme and bye-laws. I did not find a fixed rule on this in the law.
**Will TDS be deducted on deposit interest?** — I did not open the income tax text, so I am not giving the limit or section. Confirm this with your CA.

## Finally

A deposit is money a member keeps with the society on trust without conditions, and the society's accounts are the most solid proof of that trust. In a society that has the right passbook for every member, the right interest, a date-wise maturity register and a calculation of the deposit limit, no question like "why is my interest less" arises, nor any panic about deposits in the audit. And the society whose secretary booked the accrued interest entry on time at year-end knows, before distributing dividend, how much the real profit is.

> ✅ **Start your eligible cooperative society's account on SahakarLekha**: [Register](/register) and keep deposit accounts (SB/FD/RD/Pigmy), interest calculation, passbook and maturity in one set of books. To begin, read [How to add a member](/help/add-member). (If a prescribed portal or a higher body's instruction applies to your society, check that first.)

Read next: [Member and share register](/blog/member-and-share-accounting) · [Loan and interest accounting](/blog/loan-and-interest-accounting) · [Member dividend guide](/blog/cooperative-society-member-dividend-guide) · [Profit distribution](/blog/profit-distribution-and-reserves) · [Monthly reconciliation](/blog/monthly-reconciliation-checklist-cashbook-bank-trial-balance) · [Audit preparation](/blog/audit-preparation-checklist)

> 📌 This article is for general information. In any particular case, the applicable Act, Rules, notification, bye-laws, instructions of the higher body or of the competent authority should be given priority. PACS should follow their prescribed portal and the instructions of their higher body.

## Sources

- [The Haryana Co-operative Societies Act, 1984 (Haryana Act 22 of 1984, amended up to Oct 2007), PDF on the Ministry of Cooperation, Government of India](https://cooperation.gov.in/sites/default/files/inline-files/HARYANA-CO-OPERATIVE-SOCIETIES-ACT.pdf): Sections 19-A, 40, 55, 63, 64(1), 87 (explanation), 95(3). Text downloaded and read directly, 16 October 2026.
- [The Haryana Co-operative Societies Rules, 1989: Rules 38, 39, 72 (text republished on Indian Kanoon)](https://indiankanoon.org/doc/66802510/): limit on deposits and borrowing (Rule 38(1)), limit on interest rate (Rule 38(3)), liquid resources (Rule 39), dividend versus depositors' claims (Rule 72(3)). Seen on 16 October 2026; this is a third-party copy, whose page itself said the original publication was not available. **Matching with the official India Code PDF is pending, especially for the "3 percent" limit of Rule 38(3).**
- [Haryana Cooperation Department: State Acts and Rules](https://coop.haryana.gov.in/actsrules/state-acts-and-rules): to identify the official source page of the Act/Rules.

> 📘 **Method note:** The examples, amounts and interest rates are imaginary, not of any real society or scheme. Statutory provisions are from the text in the list above; where no direct provision was found in the text (format of deposit schemes, penalty for premature withdrawal, further interest on matured deposits, method of counting the amount "taken in a financial year" under Section 63, tax on deposit interest), the article says so clearly. The deposit entries, interest formulas and the year-end accrued entry are **general accounting practice**, not legal directions. No income tax limit or section is in this article, because its source was not opened. The Act text is amended up to 2007; give priority to any later notification. SahakarLekha's feature descriptions (Deposits page, interest formulas, the interest journal entry, full balance at maturity; the Deposits page shows only in societies where the deposit facility is on) are as per the version of 16 October 2026; the article will be updated if the feature changes.
