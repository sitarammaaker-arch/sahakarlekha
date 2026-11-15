import type { CookbookEntryEn } from './types';

export const COOKBOOK_EN_PART2: Record<string, CookbookEntryEn> = {
  'epf-esi-deposit': {
    metaTitle: 'EPF/ESI Deposit Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for depositing EPF/ESI deducted from salary with the department — Dr EPF/ESI Payable, Cr Bank.',
    title: 'EPF/ESI Deposit',
    scenario: 'The EPF/ESI deducted from salary has now been deposited with the department.',
    lines: [{ account: 'EPF/ESI Payable (deductions payable)' }, { account: 'Bank' }],
    narration: 'EPF/ESI deposit — month ___',
    notes: [
      "If you also add the employer's contribution, that much extra is debited as expense/Payable.",
    ],
    deepLinkLabel: 'Make a payment voucher in the app',
    example: {
      text: "EPF of ₹1,800 deducted from salary and the society's share of ₹1,800 (example) deposited with the department.",
      rows: ['EPF Payable (employee share)', "EPF — society's share (expense)", 'Bank'],
    },
    useWhen: 'Depositing EPF/ESI with the department.',
    avoidWhen: "The employee's share is not an expense — it is a liability deducted from salary. Take the rates from the department's notification.",
    correction: "The whole deposit went to expense: debit the employee's share to EPF Payable. Write the challan/receipt number of the deposit in the narration. Match each month's deposit with that month's salary — the EPF Payable account balance should be zero after the deposit; if a balance remains, check which month was missed.",
    inApp: 'On the voucher page choose "Expert" mode → in the "Payment" tab fill Dr EPF/ESI Payable (employee\'s share), Dr EPF/ESI expense (society\'s share) and Cr Bank, and write the challan number in the remarks. Check the month\'s reconciliation on the "Statutory Reconciliation (PF/ESI)" page.',
  },

  'gst-payment': {
    metaTitle: 'GST Payment to Government Entry — Dr/Cr | SahakarLekha',
    metaDescription: "The month's net GST payment — Dr Output GST, Cr Input GST and Cr Bank (the remaining amount payable).",
    title: 'GST Payment',
    scenario: "The month's GST payable (Output minus Input) was paid to the government.",
    lines: [
      { account: 'Output GST (GST payable)', note: 'Liability reduced' },
      { account: 'Input GST (GST credit)', note: 'Input credit reduced' },
      { account: 'Bank', note: 'Remaining net amount' },
    ],
    narration: 'GST payment — month ___',
    notes: [
      "Payable = Output GST minus Input GST. The app's GST Summary shows this net figure automatically.",
    ],
    deepLinkLabel: 'View GST Summary in the app',
    example: {
      text: "The month's GST payable ₹9,000, input GST ₹6,500 — net ₹2,500 paid.",
      rows: ['GST Payable (Output)', 'Input GST', 'Bank'],
    },
    useWhen: 'Payment along with the GST return.',
    avoidWhen: 'If input GST is more than the payable — then there is no payment; the balance carries to the next month.',
    correction: "The full payable was shown as paid from bank and the ITC was left out: edit the voucher; match the app's GST Summary with the portal. Write the challan (CPIN/CIN) number in the narration. Keep CGST, SGST and IGST in separate accounts — GST law sets the rules for using the ITC of one against another, so record the payment only after matching with the portal's summary.",
    inApp: 'On the "GST Summary" page choose "This Month" and see "Net GST Payable". After filing the return on the portal, in the voucher page\'s "Expert" mode fill Dr GST Payable, Cr Input GST, Cr Bank and write the challan (CPIN/CIN) number in the remarks.',
  },

  'sales-return': {
    metaTitle: 'Sales Return Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for goods returned by a customer — Dr Sales Return, Cr Customer/Cash. Stock goes back up.',
    title: 'Sales Return',
    scenario: 'A customer returned goods that were sold.',
    lines: [{ account: 'Sales Return', note: 'Sales reduced' }, { account: 'Customer — Sundry Debtor / Cash' }],
    narration: 'Sales return — customer ___, original bill no. ___',
    notes: [
      'The returned goods go back into stock. If it was a GST bill, the same amount of Output GST is also reversed.',
    ],
    deepLinkLabel: 'View sales in the app',
    example: {
      text: 'Ram Traders returned goods worth ₹2,000 (against a credit sale).',
      rows: ['Sales Return', 'Ram Traders (debtor)'],
    },
    useWhen: 'When a customer returns goods — record it from the Credit Note (Sales Return) page.',
    avoidWhen: 'Only the price was reduced and no goods came back — that is a discount.',
    correction: 'The return was recorded by reducing sales: remove it and record it from the Credit Note page, so that the stock comes back too. Do not cancel the return voucher on its own — delete it from the return page.',
    inApp: 'Open the "Credit Note (Sales Return)" page from the menu, choose the original bill, fill the returned item and quantity, choose the refund method (Cash refund / Bank refund / Adjust against credit) and save — the voucher and the stock return happen automatically. Do not delete the original bill.',
  },

  'purchase-return': {
    metaTitle: 'Purchase Return Entry — Dr/Cr | SahakarLekha',
    metaDescription: "Journal for returning goods to a supplier — Dr Supplier/Cash, Cr that item's purchase account and Input GST.",
    title: 'Purchase Return',
    scenario: 'Goods that were purchased have been returned to the supplier.',
    lines: [
      { account: 'Supplier — Sundry Creditor / Cash' },
      { account: "Item's purchase account (e.g. Purchases 5101)", note: 'Purchases reduced — each item in its own purchase account' },
      { account: 'Input GST (ITC)', note: 'In the same proportion, if GST was taken on the original bill' },
    ],
    narration: 'Purchase return — supplier ___, original bill no. ___',
    notes: [
      'In SahakarLekha a purchase return is made from the Debit Note (Purchase Return) page; no separate "Purchase Return" account is created — each item is credited to its own purchase account, so that net purchases show in the right category.',
      'The returned goods are reduced from stock automatically. If TDS was deducted on the original bill, make its adjustment after asking your CA.',
    ],
    deepLinkLabel: 'View purchases in the app',
    example: {
      text: 'Damaged fertilizer worth ₹1,500 bought on credit from Shyam Suppliers was returned (without GST).',
      rows: ['Shyam Suppliers (creditor)', "Fertilizer purchases (item's purchase account)"],
    },
    useWhen: 'Goods returned to a supplier — from the Debit Note (Purchase Return) page.',
    avoidWhen: 'The supplier only reduced the price — that is discount received.',
    correction: "Instead of cancelling the return voucher from the voucher screen, delete it from the Debit Note page — only then is the reverse stock entry made. Get the supplier's acknowledgement on the return bill. When a GST purchase is returned, Input GST also reduces in the same proportion — the Debit Note page does this automatically, so do not post a separate GST entry by hand.",
    inApp: 'Open the "Debit Note (Purchase Return)" page from the menu, choose the original purchase bill, fill the returned item and quantity, choose the method (cash/bank or "Adjust against payable") and save — the voucher and the stock reduction happen automatically. Do not delete the original purchase.',
  },

  'discount-allowed': {
    metaTitle: 'Discount Allowed Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for giving a customer a cash discount — Dr Discount Allowed (expense), Cr Customer.',
    title: 'Discount Allowed',
    scenario: 'A cash discount was given to a customer for early payment.',
    lines: [{ account: 'Discount Allowed (expense)' }, { account: 'Customer — Sundry Debtor' }],
    narration: 'Cash discount — customer ___',
    notes: [
      'A trade discount is reduced on the bill itself, with no separate entry — this entry is only for a cash discount.',
    ],
    example: {
      text: 'Ram Traders paid ₹10,000 early, a discount of ₹200 was given — ₹9,800 received.',
      rows: ['Bank', 'Discount Allowed (expense)', 'Ram Traders (debtor)'],
    },
    useWhen: 'Cash discount for early payment.',
    avoidWhen: 'Price reduced on the bill itself (trade discount) — that reduces the sale amount, not a separate discount account.',
    correction: "Not entering the discount left ₹200 outstanding in the debtor: edit the voucher by adding the discount line. Keep it fixed through the society's policy/resolution who has the authority to give discounts, and write the reason in the narration. Frequent large discounts become an audit question, so keep a separate discount account — do not reduce it from sales.",
    inApp: 'When a recovery is recorded through "Receive from Customer" the discount is not deducted separately, so on the voucher page choose "Expert" mode → in the "Receipt" tab fill three lines: Dr Bank (amount received), Dr Discount Allowed, Cr Customer (full amount), and write the reason in the remarks.',
  },

  'cash-discount-received': {
    metaTitle: 'Cash Discount Received Entry — on a Purchase Bill | SahakarLekha',
    metaDescription: 'Journal for a cash discount after GST on a purchase bill — Cr Discount Received (4499), less payable to supplier; GST/ITC unchanged.',
    title: 'Cash Discount Received',
    scenario: 'The supplier gave a cash discount on the purchase bill (after GST) — the amount payable went down.',
    lines: [
      { account: "Item's purchase account (e.g. Purchases 5101)", note: 'Taxable value (after trade discount)' },
      { account: 'Input GST (3310)', note: 'In full — not reduced by the cash discount' },
      { account: 'Supplier — Sundry Creditor / Cash', note: 'Amount payable after the discount' },
      { account: 'Discount Received (4499)', note: 'Income' },
    ],
    narration: 'Purchase — bill ___, with cash discount',
    notes: [
      'A trade discount is reduced on the bill itself before GST and has no separate account; a cash discount is reduced after GST and goes to "Discount Received" (other income).',
      'A cash discount does not change the taxable value, GST, ITC or TDS. If you want the discount to be reduced before GST, enter it under "Trade Discount" — which of the two is right depends on the terms of the bill; if you are not sure, ask your CA.',
    ],
    deepLinkLabel: 'Record a purchase in the app',
    example: {
      text: 'Fertilizer ₹10,000, trade discount ₹500 → taxable ₹9,500; GST 18% (example rate) ₹1,710; the supplier gave a cash discount of ₹105.40 on the bill → bill ₹11,104.60, round off +₹0.40 → payable ₹11,105.',
      rows: ['Fertilizer purchases', 'Input GST (3310)', 'Round Off (5499)', 'Supplier', 'Discount Received (4499)'],
    },
    useWhen: 'When the supplier gives a cash discount on the bill itself, after GST (e.g. for immediate payment).',
    avoidWhen: 'If the discount was given before GST (the price itself is lower on the bill) — then enter it under "Trade Discount". A discount received later at the time of payment — then a separate line in the payment voucher.',
    correction: 'Cash discount entered as trade discount (or the other way round): edit the purchase bill and put it in the right field — the app rebuilds the GST, ITC and "Discount Received" entries automatically. When goods are returned, the app reduces the cash discount back in the same proportion.',
    inApp: 'On the "Purchases" page → "New Purchase", fill the items and GST, then enter the discount amount in "Cash Discount (₹) — after GST" (a discount before GST goes in "Trade Discount"). "Round off" fills automatically. As soon as you press "Save Purchase", the "Discount Received" (4499) entry is made — do not make a separate voucher.',
  },

  'round-off': {
    metaTitle: 'Round Off Entry — Sales and Purchase Bills | SahakarLekha',
    metaDescription: 'Journal for rounding a bill to the whole rupee — Round Off (5499) Dr or Cr; taxable value and GST do not change.',
    title: 'Round Off',
    scenario: 'The bill amount came out in paise (e.g. ₹1,295.70) and was rounded to the whole rupee (₹1,296).',
    lines: [
      { account: 'Customer / Cash', note: 'Full rounded amount' },
      { account: "Sales (item's account) + GST Payable", note: 'Actual amount, to the paisa' },
      { account: 'Round Off (5499)', note: 'In sales, Cr if rounded up, Dr if rounded down' },
    ],
    narration: 'Sale — bill ___, with round off',
    notes: [
      'In purchases the direction is reversed: if rounded up (we have to pay more), Round Off is Dr; if rounded down, Cr.',
      'Round off is only up to ±₹0.99 — it is rounding, not a discount or adjustment. Its balance is sometimes Dr, sometimes Cr; this is normal.',
    ],
    deepLinkLabel: 'Record a sale in the app',
    example: {
      text: 'Cash sale: items ₹1,234 + GST 5% (example rate) ₹61.70 = ₹1,295.70; round off +₹0.30 → ₹1,296 taken from the customer.',
      rows: ['Cash', 'Sales (4101)', 'GST Payable (2201)', 'Round Off (5499)'],
    },
    useWhen: 'When the bill comes out in paise and the transaction is in whole rupees.',
    avoidWhen: 'If the difference is ₹1 or more — that is not round off but a discount or some other adjustment; enter it in the right field (trade discount / cash discount).',
    correction: 'Wrong round off: edit the bill and change the "Round off" field or turn the switch off — the entry is rebuilt automatically. Editing an old bill does not apply round off automatically.',
    inApp: 'In the "Sales" or "Purchases" form, "Round off (to the rupee)" above the total is on by default and fills the amount itself; if needed, change it within ±₹0.99 or turn the switch off. On saving, a Round Off (5499) line is added to the voucher.',
  },

  'member-deposit': {
    metaTitle: 'Member Deposit/Savings Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for taking savings/fixed deposits from a member — Dr Cash, Cr Member Deposit (liability). This is not share capital.',
    title: 'Member Deposit/Savings',
    scenario: 'A member placed a savings or recurring/fixed deposit (RD/FD) with the society.',
    lines: [{ account: 'Cash / Bank' }, { account: 'Member Deposit (liability)', note: 'Deposit to be repaid' }],
    narration: 'Member deposit — member ___, deposit type ___',
    notes: [
      'This is separate from share capital — the deposit is repaid, and the society pays interest on it (expense).',
    ],
    example: {
      text: 'A member placed a savings deposit of ₹5,000.',
      rows: ['Cash', 'Member Deposit (liability)'],
    },
    useWhen: 'When a member deposits money.',
    avoidWhen: 'Buying shares — "Share Capital". If interest is payable on the deposit, a separate interest expense.',
    correction: "The deposit was put into income: edit the voucher and credit Member Deposit — this has to be repaid, it is not earnings. Enter the same amount in the member's deposit passbook or receipt too. Repaying the deposit is the reverse entry — Dr Member Deposit / Cr Cash; if interest is to be paid on the deposit, it is an expense and is added to the member's deposit.",
    inApp: 'On the voucher page choose "Expert" mode → in the "Receipt" tab fill Dr Cash/Bank / Cr Member Deposit account, and choose the member in "Link to Member (Optional)", so the amount shows in their ledger. If the society runs a deposit scheme, record it from the "Deposits" page.',
  },

  'dividend-paid': {
    metaTitle: 'Dividend Payment Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for paying declared dividend to members — Dr Dividend Distribution (1211), Cr Cash/Bank.',
    title: 'Dividend Paid',
    scenario: 'The dividend declared in the general meeting has now been paid to members.',
    lines: [
      { account: 'Dividend Distribution (1211)', note: 'Liability created earlier in the appropriation' },
      { account: 'Cash / Bank' },
    ],
    narration: 'Dividend payment — year ___',
    notes: [
      'Dividend is first declared in the profit appropriation (Cr Dividend Distribution 1211), then paid here member by member.',
    ],
    example: {
      text: 'Out of the declared dividend, ₹40 was paid to a member in cash.',
      rows: ['Dividend Distribution (1211)', 'Cash'],
    },
    useWhen: 'Payment of a declared dividend.',
    avoidWhen: 'No payment without a declaration — first the appropriation (Cr 1211).',
    correction: "The payment was put into expense: edit the voucher and debit 1211. Record each member's payment separately, so that a member-wise dividend register is built. For a member who does not come to collect the dividend, the amount stays outstanding in 1211 — do not take it to income; check the bye-laws/rules for what to do with unclaimed dividend.",
    inApp: 'In "Surplus Appropriation" → step 4, under "Pay Dividend to Members" choose the "Payment mode" (Cash/Bank) and "Date" and press "Pay Dividend" — a separate voucher is made for each member. See who got paid and who is pending in the "Dividend Payment Register".',
  },

  'patronage-bonus': {
    metaTitle: 'Patronage Bonus Entry — Dr/Cr | SahakarLekha',
    metaDescription: "Journal for a bonus in proportion to a member's business with the society — Dr Net Surplus (1208), Cr Bonus Payable.",
    title: 'Patronage Bonus',
    scenario: 'A bonus out of profit to members in proportion to their business (purchases/sales) with the society.',
    lines: [{ account: 'Net Surplus (1208)' }, { account: 'Patronage Rebate Payable' }],
    narration: 'Patronage bonus — year ___',
    notes: [
      "Dividend is paid on share capital; patronage bonus is in proportion to the member's transactions — the two are different.",
      'This is a distribution of profit, not an expense — hence Dr Net Surplus (1208). Staff bonus is different: that is an expense (5207).',
    ],
    example: {
      text: "A total patronage rebate of ₹12,000 was fixed in proportion to members' business.",
      rows: ['Net Surplus (1208)', 'Patronage Rebate Payable'],
    },
    useWhen: 'When the bye-laws allow it and the general meeting decides it.',
    avoidWhen: 'Staff bonus — that is an expense (5207), not a distribution.',
    correction: 'It was put into expense: move it to the appropriation — otherwise profit will look lower.',
    inApp: 'After the bye-law permission and the general meeting resolution, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr Net Surplus (1208) / Cr Patronage Rebate Payable, and write the resolution number in the remarks. Payment later by Dr Patronage Rebate Payable / Cr Cash-Bank.',
  },

  'outstanding-expense': {
    metaTitle: 'Outstanding Expense Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for an expense unpaid at year end — Dr Expense, Cr Outstanding Expense (liability).',
    title: 'Outstanding Expense',
    scenario: "The expense belongs to this year but was not paid by year end (e.g. the last month's electricity bill).",
    lines: [
      { account: 'Related expense (e.g. electricity)', note: "This year's expense" },
      { account: 'Outstanding Expense (liability)' },
    ],
    narration: 'Outstanding expense — ___, year ___',
    notes: [
      'This is accrual — the expense should come in the year it was incurred, even if payment is next year. On payment next year: Dr Outstanding Expense, Cr Cash/Bank.',
    ],
    example: {
      text: "March's electricity bill of ₹2,800 will come in April.",
      rows: ['Electricity expense', 'Outstanding Expense (liability)'],
    },
    useWhen: "At year end, for this year's unpaid expenses.",
    avoidWhen: 'Do not post the expense again on payment next year — then Dr Outstanding Expense / Cr Cash.',
    correction: 'The expense was posted again on payment next year: edit that voucher and debit Outstanding Expense.',
    inApp: 'Dated 31 March, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr expense account / Cr Outstanding Expense (liability) and write the bill details in the remarks. When paying next year choose Dr Outstanding Expense, not the expense account.',
  },

  'prepaid-expense': {
    metaTitle: 'Prepaid Expense Entry — Dr/Cr | SahakarLekha',
    metaDescription: "Next year's expense paid now — Dr Prepaid Expense (asset), Cr Cash/Bank.",
    title: 'Prepaid Expense',
    scenario: "Payment made now, but the expense belongs to next year (e.g. a full year's insurance paid in advance).",
    lines: [{ account: 'Prepaid Expense (asset)' }, { account: 'Cash / Bank' }],
    narration: 'Prepaid expense — ___, period ___',
    notes: [
      "Only the portion that belongs to this year is treated as expense; the rest stays as an asset (prepaid).",
    ],
    example: {
      text: "A full year's insurance of ₹12,000 was paid on 1 October; up to 31 March only 6 months (₹6,000) belong to this year.",
      rows: ['Prepaid Expense', 'Insurance expense'],
    },
    useWhen: "At year end, to separate next year's portion.",
    avoidWhen: 'A small amount may be left out as a matter of policy — ask your auditor.',
    correction: 'Do not forget to take this portion to expense next year: Dr Insurance expense / Cr Prepaid Expense. Count the months from the period written on the insurance policy or rent agreement. On 1 April of the next year post the entry that takes this amount to expense, otherwise the Prepaid Expense balance will appear to grow every year.',
    inApp: 'Dated 31 March, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr Prepaid Expense / Cr expense account. On 1 April next year post the reverse journal (Dr expense / Cr Prepaid Expense), so that the expense shows in the right year.',
  },

  'accrued-income': {
    metaTitle: 'Accrued Income Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for income earned but not yet received — Dr Accrued Income (asset), Cr Income.',
    title: 'Accrued Income',
    scenario: 'The income was earned this year but not received by year end (e.g. interest due on an FD).',
    lines: [
      { account: 'Accrued Income (asset)' },
      { account: 'Related income (e.g. interest income)', note: "This year's income" },
    ],
    narration: 'Accrued income — ___, year ___',
    notes: [
      'Accrual — income goes in the year in which it was earned. On receipt: Dr Cash/Bank, Cr Accrued Income.',
    ],
    example: {
      text: 'Interest of ₹3,500 earned on an FD up to March, to be received in May.',
      rows: ['Accrued interest (asset)', 'Interest income'],
    },
    useWhen: "At year end, for this year's earned income.",
    avoidWhen: 'Do not post the income again on receipt — then Dr Bank / Cr Accrued interest.',
    correction: 'The income was recorded again on receipt: edit that voucher and credit Accrued interest. Get an interest certificate from the bank or calculate it at the FD rate, and write the period in the narration. If the bank deducted TDS on the interest, show it in a separate TDS Receivable account.',
    inApp: 'Dated 31 March, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr Accrued Income (asset) / Cr income account, and write the period in the remarks. When the money is received, choose Cr Accrued Income in the "Receipt" tab, not the income account again.',
  },

  'audit-fee': {
    metaTitle: 'Audit Fee Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Audit fee provision/payment — Dr Audit Fee (expense), Cr Audit Fee Payable / Cash.',
    title: 'Audit Fee',
    scenario: 'At year end the audit fee has to be provided for/paid.',
    lines: [{ account: 'Audit Fee (expense)' }, { account: 'Audit Fee Payable / Cash / Bank' }],
    narration: 'Audit fee — year ___',
    notes: [
      'TDS may also apply to the audit fee (professional fee) — then TDS Payable is a separate Cr.',
    ],
    example: {
      text: 'Audit fee for the year 2026-27 fixed at ₹6,000, payment later.',
      rows: ['Audit Fee (expense)', 'Audit Fee Payable'],
    },
    useWhen: "At year end, the fee for this year's audit.",
    avoidWhen: "No expense again on payment — Dr Audit Fee Payable / Cr Bank. Get the fee rate from the department/auditor.",
    correction: "The expense was booked twice: edit the payment voucher and debit Audit Fee Payable. Keep the audit fee bill or order on file. If the auditor's fee crosses the TDS limit, look at TDS too (Guide chapter 19). The fee should show each year in the expenses of the year whose audit was done.",
    inApp: 'At year end, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr Audit Fee (expense) / Cr Audit Fee Payable. At the time of payment, in the "Payment" tab Dr Audit Fee Payable / Cr Bank — then the expense will not be booked again.',
  },

  'reserve-fund-investment': {
    metaTitle: 'Reserve Fund Investment Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Investing the statutory reserve fund — Dr Reserve Fund Investment (asset), Cr Bank.',
    title: 'Reserve Fund Investment',
    scenario: 'A part of the reserve fund has to be invested as required by law.',
    lines: [{ account: 'Reserve Fund Investment (asset)' }, { account: 'Bank' }],
    narration: 'Reserve fund investment — year ___',
    notes: [
      'In many states it is compulsory to invest a fixed part of the reserve fund — confirm the rate and mode from your state Act/RCS.',
    ],
    example: {
      text: '₹50,000 of the reserve fund invested in a bank FD.',
      rows: ['Reserve Fund Investment (asset)', 'Bank'],
    },
    useWhen: 'Investing the reserve fund as per the rules.',
    avoidWhen: 'Investment does not reduce the reserve fund (1201) — it stays as it is; only the money moves from bank into the investment. Check the state rules for where the investment should be made.',
    correction: 'The reserve fund account itself was debited: edit the voucher and debit the investment account. Keep the investment receipt/FD certificate. Whether interest earned on the investment goes to income or is added to the reserve fund is set by the state rules/bye-laws; if you are not sure, ask your auditor and follow one method every year.',
    inApp: 'On the voucher page choose "Expert" mode → in the "Payment" tab fill Dr Reserve Fund Investment (asset) / Cr Bank and write the FD/investment receipt number in the remarks. The reserve fund (1201) account is not touched here — it only grows through the appropriation.',
  },

  'loan-write-off': {
    metaTitle: 'NPA/Bad Loan Write-off Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Provision/write-off for an unrecoverable loan — Dr Bad Debt/Provision (expense), Cr Loans & Advances.',
    title: 'Bad Loan / NPA Provision',
    scenario: 'A loan is unrecoverable (NPA) and a provision/write-off has to be made on it.',
    lines: [{ account: 'Bad Debt / Provision (expense)' }, { account: 'Loans & Advances / Provision (3304)' }],
    narration: 'Bad loan provision — loan no. ___',
    notes: [
      'Approval of the board and the auditor is necessary before writing off — do not do it arbitrarily. Confirm from the state rules.',
    ],
    example: {
      text: 'Provision on an unrecoverable loan of ₹8,000 (example; percentage from the rules/auditor).',
      rows: ['Provision for bad debts (expense)', 'Provision against loans'],
    },
    useWhen: 'Provision or write-off on an NPA as per the auditor/rules.',
    avoidWhen: 'If it is recovered later — then "Bad Debts Recovered".',
    correction: 'The loan account was closed directly though the policy was to make a provision: do it through the provision account, so that the loan record remains.',
    inApp: 'After the decision of the auditor/managing committee, on the voucher page choose "Expert" mode → in the "Journal" tab fill Dr Provision for bad debts (expense) / Cr Provision against loans, and write the resolution number in the remarks. Let the loan record remain in the loan register.',
  },

  'asset-sale': {
    metaTitle: 'Asset Sale Entry — with Profit/Loss Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for selling an old asset — Dr Bank, Cr Asset (book value), difference = profit (Cr) or loss (Dr).',
    title: 'Asset Sale',
    scenario: 'The society sold an old asset (vehicle/furniture).',
    lines: [
      { account: 'Bank / Cash', note: 'Amount received' },
      { account: 'Related asset — Asset', note: 'Book value = cost minus accumulated depreciation' },
      { account: 'Profit on Sale (income) — or Dr if there is a loss', note: 'Amount received minus book value' },
    ],
    narration: 'Asset sale — ___',
    notes: [
      'Book value = original cost minus accumulated depreciation to date. If amount received > book value, profit (Cr); if less, loss (Dr).',
    ],
    example: {
      text: 'An old vehicle (book value ₹40,000) was sold for ₹45,000 — ₹5,000 profit.',
      rows: ['Bank', 'Vehicle (asset)', 'Profit on Sale of Assets'],
    },
    useWhen: 'A fixed asset was sold.',
    avoidWhen: 'Do not put the sale in ordinary sales (4101) — it is not a sale of goods.',
    correction: "The whole amount went to income: edit the voucher — reduce the asset's book value, and only the difference is profit/loss.",
    inApp: 'Record the disposal of that asset in the "Asset Register" — when you fill the sale amount and date, the app removes the book value and takes the profit to "Profit on Sale of Assets" (4410) or the loss to (5406). In a PACS the profit goes not to income but to "Capital Reserve" (1298). Do not do this from the "Sales" page.',
  },

  'farmer-payment-msp': {
    metaTitle: 'MSP Payment to Farmer (with Loan Deduction) — Dr/Cr | SahakarLekha',
    metaDescription: 'Paying a farmer for MSP procurement, with old loan deducted — Dr Purchase, Cr Cash and Cr Loan Recovery.',
    title: 'MSP Payment to Farmer (with Loan Deduction)',
    scenario: "The MSP procurement lot for the agency has already been posted to the books (Dr MSP Receivable 3308 / Cr MSP Payable to Farmers 2105); now the farmer is paid, with his old loan deducted.",
    lines: [
      { account: 'MSP Payable to Farmers (2105)' },
      { account: 'Cash / Bank', note: 'Paid in hand to the farmer (net)' },
      { account: 'Loans & Advances (3304)', note: 'Farmer\'s old loan deducted ("Other Recovery" in the settlement)' },
    ],
    narration: 'MSP payment — farmer ___, with loan deduction',
    notes: [
      "In procurement for an agency, the grain is not the society's purchase (5101) — posting the lot makes Dr MSP Receivable (3308) / Cr MSP Payable to Farmers (2105), and when money comes from the agency, Dr Bank / Cr 3308.",
      'Gunny bags (bardana) and driage (sukhat) are not created automatically in the app — record them by hand in the accounts your auditor tells you. State/agency rules may change — confirm with the RCS/auditor.',
    ],
    example: {
      text: "The farmer's lot of ₹60,000 was posted (Dr 3308 / Cr 2105 ₹60,000). At payment, his old loan of ₹10,000 was deducted and ₹50,000 paid from bank.",
      rows: ['MSP Payable to Farmers (2105)', 'Bank', 'Loans & Advances (3304)'],
    },
    useWhen: 'Paying the farmer for a lot already posted, with deductions.',
    avoidWhen: 'If the agency paid the farmer directly — then Cr MSP Receivable (3308) instead of Cr Bank. If the lot has not been posted yet, first "Post to Ledger".',
    correction: "The loan deduction was missed: add the loan deduction through \"Other Recovery\" in the settlement — otherwise the member's loan balance will stay wrong and a balance will remain in 2105.",
    inApp: 'After posting the procurement lot with "Post to Ledger", fill the deductions in "Approve Settlement" ("Other Recovery" for a loan), then make the cash/bank payment through "Pay Farmer". If the agency paid directly, choose that option.',
  },

  'mandi-fee-hrdf': {
    metaTitle: 'Mandi Fee and HRDF Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Mandi fee and HRDF on MSP procurement — Dr Mandi Fee/HRDF (recoverable or expense), Cr Cash/Payable.',
    title: 'Mandi Fee and HRDF',
    scenario: 'Mandi fee and HRDF on MSP procurement have to be paid/kept as recoverable.',
    lines: [{ account: 'Mandi Fee / HRDF (recoverable or expense)' }, { account: 'Cash / Bank / Payable' }],
    narration: 'Mandi fee and HRDF — season ___',
    notes: [
      'In procurement for an agency these are often recoverable from the agency (not an expense). Check your state/agency rules.',
      'The app\'s chart of accounts has an "HRDF Payable" (2205) account for HRDF; decide with your auditor which deduction in the farmer settlement goes to which account.',
    ],
    example: {
      text: 'Mandi fee of ₹1,200 paid on procurement, to be recovered from the agency (rate from the Mandi Board).',
      rows: ['Mandi Fee — recoverable', 'Bank'],
    },
    useWhen: 'Payment of mandi fee/HRDF.',
    avoidWhen: "A fee that will be recovered is not the society's expense — keep it as recoverable.",
    correction: 'A recoverable fee went to expense: edit the voucher; on recovery, Dr Bank / Cr Recoverable.',
    inApp: 'If it is deducted in the farmer\'s settlement, choose its deduction account (e.g. HRDF Payable 2205) in "Approve Settlement"; if the society pays it itself, choose the recoverable account in the "Payment" tab of the voucher page\'s "Expert" mode. Decide the account with your auditor.',
  },

  'milk-procurement': {
    metaTitle: 'Dairy Society — Milk Purchase from Member Entry | SahakarLekha',
    metaDescription: 'Journal for buying milk from a member in a dairy cooperative — Dr Milk Purchase, Cr Member/Cash.',
    title: 'Milk Purchase (Dairy Society)',
    scenario: 'The dairy cooperative society took milk from a member (rate based on fat/SNF).',
    lines: [{ account: 'Milk Purchase' }, { account: 'Member Payable / Cash' }],
    narration: 'Milk purchase — member ___, ___ litres',
    notes: [
      'The rate is fixed on fat and SNF; payment is usually in a 10-day cycle. Milk sales to the federation are a separate income entry.',
    ],
    example: {
      text: 'Milk for 10 days from a member ₹18,500 (from the fat/SNF rate chart) — payment in the next cycle.',
      rows: ['Milk Purchase', 'Member Payable'],
    },
    useWhen: 'Payment/payable for milk collection.',
    avoidWhen: 'If the rate chart has changed, do not apply the new rate to old collections.',
    correction: 'Wrong rate applied: correct it from the milk collection/farmer payment page, so that both the payable and the voucher change. Keep a member-wise record of every collection shift (morning/evening); when the payment cycle is complete, payment is made by Dr Member Payable / Cr Bank. If the member\'s loan or cattle feed is deducted, keep a separate line in the payment.',
    inApp: 'On the "Milk Collection" page record each shift\'s (morning/evening) milk member-wise with fat/SNF; when the cycle is complete, approve it in "Farmer Settlement" — the app makes the milk purchase and member payable (with deductions) entries itself. The rate chart is on the "Rate Chart" page.',
  },

  'subsidy-received': {
    metaTitle: 'Grant/Subsidy Received Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for a grant (subsidy) received from government/NABARD — Dr Cash/Bank, Cr Govt Subsidy (income). With an example for cooperatives.',
    title: 'Subsidy Received',
    scenario: 'The society received a grant/subsidy from the government, NABARD or a department.',
    lines: [{ account: 'Cash / Bank' }, { account: 'Govt Subsidy (4303)' }],
    narration: 'Grant received — scheme/department ___, order no. ___',
    notes: [
      'If the grant is for an asset (capital subsidy), as per accounting policy it may have to be reduced from the asset or kept as a capital grant — check the conditions.',
      'If a conditional grant has to be returned later, that will be a separate entry.',
    ],
    deepLinkLabel: 'Record a receipt in the app',
    example: {
      text: 'A grant of ₹25,000 from the department came into the bank.',
      rows: ['Bank', 'Govt Subsidy (4303)'],
    },
    useWhen: 'A grant received as income.',
    avoidWhen: 'If the grant is for an asset — its treatment may differ as per accounting policy; ask your auditor.',
    correction: 'The grant was treated as a loan (or the other way round): check the conditions in the sanction letter and edit the voucher.',
    inApp: 'On the voucher page choose "Expert" mode → in the "Receipt" tab fill Dr Bank / Cr Govt Subsidy (4303) and write the sanction letter number and date in the remarks. If the grant is for an asset, first decide the account with your auditor.',
  },

  'bad-debt-recovery': {
    metaTitle: 'Bad Debts Recovered Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for recovering an amount written off earlier — Dr Cash/Bank, Cr Bad Debts Recovered (income). With a cooperative example.',
    title: 'Bad Debt Recovery',
    scenario: 'An amount written off earlier as bad has now been recovered.',
    lines: [{ account: 'Cash / Bank' }, { account: 'Bad Debts Recovered (4409)' }],
    narration: 'Bad debt recovery — old outstanding amount received from ___',
    notes: [
      'This is income — recording it in a separate income account is cleaner than reversing the old write-off.',
      'For the write-off entry (the reverse of this), see: loan write-off.',
    ],
    deepLinkLabel: 'Record a recovery in the app',
    example: {
      text: '₹3,000 written off earlier has now been recovered.',
      rows: ['Cash', 'Bad Debts Recovered (4409)'],
    },
    useWhen: 'Recovery of a written-off amount.',
    avoidWhen: 'If the loan was not written off — then ordinary "Loan Recovery".',
    correction: 'The recovery went to the loan account though it was already closed: edit the voucher and choose the income account.',
    inApp: 'On the voucher page choose "Expert" mode → in the "Receipt" tab fill Dr Cash/Bank / Cr Bad Debts Recovered (4409), write the reference to the old loan and the write-off resolution in the remarks, and choose the member in "Link to Member (Optional)".',
  },

  'donation-csr-paid': {
    metaTitle: 'Donation / CSR Paid Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for a donation or CSR expense by the society — Dr Donation/CSR expense, Cr Cash/Bank. With an example for cooperatives.',
    title: 'Donation / CSR Paid',
    scenario: 'The society gave a donation to an institution/cause or spent under CSR.',
    lines: [{ account: 'Donation / CSR expense (5405)' }, { account: 'Cash / Bank' }],
    narration: 'Donation/CSR — recipient ___, resolution no. ___',
    notes: [
      'A large donation/CSR is usually made with the approval of the managing committee — keep the reference to the minutes in the narration.',
    ],
    deepLinkLabel: 'Record a payment in the app',
    example: {
      text: 'A donation of ₹5,000 was given to the village school (with bye-law/general meeting permission).',
      rows: ['Donation / CSR expense (5405)', 'Bank'],
    },
    useWhen: 'A donation within the permitted limits.',
    avoidWhen: 'The limit/permission for donations is set by state rules and bye-laws — do not give without permission.',
    correction: 'The donation was put into some other expense: edit the voucher and choose the right account.',
    inApp: 'After permission from the managing committee/general meeting, on the voucher page choose "Expert" mode → in the "Payment" tab fill Dr Donation / CSR expense (5405) / Cr Bank, write the resolution number and the recipient institution\'s name in the remarks, and keep the receipt safely.',
  },

  'donation-received': {
    metaTitle: 'Donation Received Entry — Dr/Cr | SahakarLekha',
    metaDescription: 'Journal for a donation received by the society — Dr Cash/Bank, Cr Misc Income (or a donation income account). With a cooperative example.',
    title: 'Donation Received',
    scenario: 'The society received a donation from a person/institution.',
    lines: [
      { account: 'Cash / Bank' },
      { account: 'Misc Income (4405)', note: 'If you like, create a separate income account named "Donation Received"' },
    ],
    narration: 'Donation received — donor ___',
    notes: [
      'A conditional/purpose-bound donation (e.g. for a particular fund) is better kept in that special fund, not in general income.',
    ],
    deepLinkLabel: 'Record a receipt in the app',
    example: {
      text: '₹10,000 from a donor came into the bank.',
      rows: ['Bank', 'Misc Income (4405)'],
    },
    useWhen: 'A donation received without conditions.',
    avoidWhen: 'A conditional donation for a particular purpose — keep it in a separate fund; ask your auditor.',
    correction: 'The donation was put into member deposit: edit the voucher and choose the income account.',
    inApp: 'On the voucher page choose "Expert" mode → in the "Receipt" tab fill Dr Bank / Cr Misc Income (4405) and write the donor\'s name in the remarks; give the donor a receipt. If it is a conditional donation, decide a separate fund account with your auditor and credit it there.',
  },
};
