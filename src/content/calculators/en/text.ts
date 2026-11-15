import type { CalcConfigEn } from './types';

export const CALC_EN_TEXT: Record<string, CalcConfigEn> = {
  'depreciation-calculator': {
    metaTitle: 'Depreciation Calculator — SLM & WDV | SahakarLekha',
    metaDescription:
      'Work out depreciation by Straight Line (SLM) or Written Down Value (WDV) — you enter the rate and get the schedule instantly. A free calculator for cooperative societies.',
    intro: "How to record an asset's falling value every year — by SLM or WDV, at your rate.",
    inputs: {
      method: { label: 'Method', options: { slm: 'Straight Line (SLM)', wdv: 'Written Down Value (WDV)' } },
      cost: { label: 'Cost of the asset' },
      rate: { label: 'Depreciation rate', sub: 'You enter it (no legal rate assumed)' },
      years: { label: 'How many years', suffix: 'yrs' },
      salvage: { label: 'Salvage value (SLM)', sub: 'Optional' },
    },
    formula:
      'SLM (Straight Line): `Annual depreciation = Cost × Rate%`\n\nWDV (Written Down Value): `Annual depreciation = Opening book value × Rate%`',
    explanation:
      "Depreciation records the falling value of an asset as an expense every year. Under **SLM** the same amount is written off every year; under **WDV** more in the early years and less later. You enter the rate — no legal rate is fixed here.",
    example:
      "Cost ₹1,00,000, rate 10%, 5 years — under SLM ₹10,000 every year; under WDV ₹10,000 in the first year, ₹9,000 in the second year (10% of ₹90,000), and so on, falling each year.\n\n**Second example (WDV, 3 years):** Cost ₹2,00,000, rate 15% (example) — first year ₹30,000 (book value ₹1,70,000), second year ₹25,500 (₹1,44,500), third year ₹21,675 (₹1,22,825). Total depreciation over three years ₹77,175 — the rate was applied to the falling book value each year, so the amount came down every year.",
    mistakes:
      "- ❌ Mixing up SLM and WDV — the two work differently.\n- ❌ Assuming a legal rate — take the correct rate from your CA/rules; here you enter it yourself.\n- ❌ Forgetting the salvage value (under SLM the book value does not go below it).",
    faqs: [
      {
        q: 'What is the difference between SLM and WDV?',
        a: 'Under SLM the same depreciation is charged on the original cost every year; under WDV it is charged on the falling book value each year — so more is written off in the early years.',
      },
      {
        q: 'Is there a fixed depreciation rate?',
        a: 'This calculator does not fix any legal rate — you enter the correct rate yourself, as per your rules/CA.',
      },
      {
        q: 'What is salvage value?',
        a: "The asset's estimated final value; under SLM the book value does not go below it.",
      },
      {
        q: 'Does an asset bought mid-year get a full year of depreciation?',
        a: "It depends on the society's accounting policy — full year, half year or in proportion to days. Whichever policy you choose, keep the same one every year and confirm it with the auditor.",
      },
      {
        q: 'What is the entry for depreciation?',
        a: 'Dr Depreciation (expense) / Cr Accumulated Depreciation or the asset account directly — as per the accounting policy. For details see the "Depreciation" entry in the Cookbook.',
      },
    ],
    relatedArticles: ['How to charge depreciation'],
    relatedHelp: [],
    relatedGuide: ['Guide: Depreciation'],
    relatedModules: ['Depreciation Schedule', 'Asset Register'],
  },

  'simple-interest-calculator': {
    metaTitle: 'Simple Interest Calculator | SahakarLekha',
    metaDescription:
      'Enter principal, rate and time — get simple interest and the total amount instantly, with the formula and examples. A free calculator for cooperative societies.',
    intro: 'Principal × Rate × Time — simple interest and the total amount in one click.',
    inputs: {
      principal: { label: 'Principal' },
      rate: { label: 'Annual rate' },
      years: { label: 'Time', suffix: 'yrs' },
    },
    formula: '`Simple Interest (SI) = (Principal × Rate × Time) ÷ 100`\n\n`Total amount = Principal + Interest`',
    explanation:
      'Simple interest is charged each year only on the **principal** — no interest on interest. It is useful for estimating short-term loans or deposits.',
    example:
      'Principal ₹50,000, rate 8%, time 2 years — Interest = (50000 × 8 × 2) ÷ 100 = ₹8,000; Total amount = ₹58,000.\n\n**Second example (in months):** Member loan ₹25,000, rate 12% (example), time 9 months = 0.75 years — Interest = (25000 × 12 × 0.75) ÷ 100 = ₹2,250; Total amount ₹27,250.',
    mistakes:
      '- ❌ Entering time in months (enter it in years — 6 months = 0.5).\n- ❌ Treating simple and compound interest as the same.',
    faqs: [
      {
        q: 'Difference between simple and compound interest?',
        a: "Simple interest is charged only on the principal; in compound interest each period's interest is added to the principal, so next time interest is earned on the interest too.",
      },
      {
        q: 'How do I enter time given in months?',
        a: 'Enter time in years — 6 months = 0.5 years.',
      },
      {
        q: 'What is the simple interest formula?',
        a: 'Interest = (Principal × Rate × Time) ÷ 100; Total amount = Principal + Interest.',
      },
      {
        q: 'How do I work out interest by days?',
        a: "Enter time = days ÷ 365 (in years) — e.g. 90 days ≈ 0.2466 years. Check whether the society's loan policy assumes 360 or 365 days.",
      },
      {
        q: 'Entry when interest is received?',
        a: 'Dr Cash/Bank / Cr Interest Income on Loans. Repayment of the principal is separate — Cr Member Loan.',
      },
    ],
    relatedArticles: ['Loan and interest accounting'],
    relatedHelp: ['How to make a Loan Entry'],
    relatedGuide: ['Guide: Special Registers (Loan Register)'],
    relatedModules: ['Loan Register', 'Loan Interest'],
  },

  'compound-interest-calculator': {
    metaTitle: 'Compound Interest Calculator | SahakarLekha',
    metaDescription:
      'Work out interest compounded annually, half-yearly, quarterly or monthly — with the formula, calculation and a year-by-year growth table.',
    intro: 'Interest on interest — annual/half-yearly/quarterly/monthly compounding and a growth table.',
    inputs: {
      principal: { label: 'Principal' },
      rate: { label: 'Annual rate' },
      years: { label: 'Time', suffix: 'yrs' },
      freq: { label: 'Compounding', options: { '1': 'Annual', '2': 'Half-yearly', '4': 'Quarterly', '12': 'Monthly' } },
    },
    formula:
      '`Total amount A = Principal × (1 + (Rate÷n)/100)^(n × Years)`\n\nwhere `n` = number of times interest is compounded in a year (annual=1, half-yearly=2, quarterly=4, monthly=12). `Interest = A − Principal`.',
    explanation:
      "In compound interest each period's interest is added to the principal, so in the next period **interest is earned on the interest too**. The more often it compounds, the larger the amount.",
    example:
      'Principal ₹50,000, rate 8%, 3 years, annual — A = 50000 × (1.08)³ ≈ ₹62,986; Interest ≈ ₹12,986.\n\n**Second example (quarterly vs annual):** ₹1,00,000, rate 8%, 2 years — with quarterly compounding (n = 4) the amount is ≈ ₹1,17,166 (interest ≈ ₹17,166); with annual compounding ₹1,16,640 (interest ₹16,640). Quarterly compounding gives about ₹526 more.',
    mistakes: '- ❌ Applying the simple interest formula.\n- ❌ Choosing the wrong number of compoundings (n).',
    faqs: [
      {
        q: 'What is the number of compoundings (n)?',
        a: 'How many times a year interest is added — annual=1, half-yearly=2, quarterly=4, monthly=12.',
      },
      {
        q: 'What happens with more frequent compounding?',
        a: 'The more often it compounds, the slightly larger the final amount.',
      },
      {
        q: 'Is this right for deposits/FDs?',
        a: 'This is an educational calculation; check the actual rate and terms with your bank/rules.',
      },
      {
        q: 'How is interest worked out in CI?',
        a: 'Interest = Final amount − Principal, where Final amount = P × (1 + r/n)^(n × t).',
      },
      {
        q: 'How do I record FD interest at year end?',
        a: 'Record interest earned but not yet received as "accrued income" — Dr Accrued Interest / Cr Interest Income.',
      },
    ],
    relatedArticles: ['Loan and interest accounting'],
    relatedHelp: ['How to make a Loan Entry'],
    relatedGuide: ['Guide: Special Registers (Loan Register)'],
    relatedModules: ['Loan Register'],
  },

  'share-capital-calculator': {
    metaTitle: 'Share Capital Calculator | SahakarLekha',
    metaDescription:
      'Enter face value, number of shares and paid-up % — see issued, subscribed and paid-up capital. Educational calculation only.',
    intro: 'Face value × shares = issued capital; paid-up capital from the paid-up % — educational.',
    inputs: {
      faceValue: { label: 'Face value (per share)' },
      numShares: { label: 'Number of shares (issued)' },
      paidPct: { label: 'Paid-up %' },
      authShares: { label: 'Authorised shares (optional)' },
    },
    formula:
      '`Issued capital = Face value × Number of shares`\n\n`Paid-up capital = Issued capital × Paid-up% ÷ 100`\n\n`Authorised capital = Face value × Authorised shares` (if filled in)',
    explanation:
      'Share capital comes in three forms — **authorised** (the permitted limit), **issued** (shares issued) and **paid-up** (actually paid). Order: authorised ≥ issued ≥ paid-up. The real figure on the balance sheet is **paid-up capital**.',
    example:
      'Face value ₹100, 6,000 shares, 90% paid-up — issued = ₹6,00,000; paid-up = ₹5,40,000.\n\n**Second example (partly paid):** 250 members × 10 shares × ₹100 = issued ₹2,50,000. Of these, 20 members paid only half (₹500 still due from each) — arrears ₹10,000, so paid-up capital is ₹2,40,000. Only ₹2,40,000 will show on the balance sheet.',
    mistakes:
      '- ❌ Treating authorised capital as "money available" — the real figure is paid-up capital.\n- ❌ Showing issued capital above the authorised limit.',
    faqs: [
      {
        q: 'Order of authorised, issued and paid-up?',
        a: 'Authorised ≥ issued ≥ paid-up. The real figure on the balance sheet is paid-up capital.',
      },
      {
        q: "How is a member's share capital worked out?",
        a: 'Face value × number of shares held.',
      },
      {
        q: 'Is this a legal calculation?',
        a: 'No, it is educational — for specific provisions see your rules/bye-laws.',
      },
      {
        q: 'Difference between paid-up and calls in arrears?',
        a: 'Paid-up is what members have actually paid; an amount called but not paid is in arrears — it is not counted in paid-up capital.',
      },
      {
        q: 'Where does share capital show in SahakarLekha?',
        a: 'When you fill in the share amount while adding a member, the entry is made automatically; the total shows in the Share Register and the balance sheet.',
      },
    ],
    relatedArticles: ['Types of share capital', 'Member and share register'],
    relatedHelp: [],
    relatedGuide: ['Guide: Members and membership management'],
    relatedModules: ['Share Register'],
  },

  'gst-calculator': {
    metaTitle: 'GST Calculator — Exclusive & Inclusive | SahakarLekha',
    metaDescription:
      'Enter an amount and GST rate — work out the base, GST (CGST+SGST) and total. You enter the rate; none is fixed. Educational only.',
    intro: 'Amount + rate → base, GST (CGST/SGST) and total. You enter the rate.',
    inputs: {
      mode: { label: 'Type of amount', options: { exclusive: 'Without GST (Exclusive)', inclusive: 'With GST (Inclusive)' } },
      amount: { label: 'Amount' },
      rate: { label: 'GST rate', sub: 'You enter it (no rate fixed)' },
    },
    formula:
      'Without GST: `GST = Amount × Rate% ÷ 100`, `Total = Amount + GST`\n\nWith GST: `Base = Amount × 100 ÷ (100 + Rate%)`, `GST = Amount − Base`\n\n`CGST = SGST = GST ÷ 2` (within the state)',
    explanation:
      'GST is a tax charged on an amount. **Exclusive** means the amount is without tax (tax is to be added); **Inclusive** means the tax is already included in the amount (it is to be separated). Within a state, GST is usually split into CGST and SGST.',
    example:
      'Amount ₹10,000, rate 18% (exclusive) — GST = ₹1,800 (CGST ₹900 + SGST ₹900); Total = ₹11,800.\n\n**Second example (Inclusive):** Bill total ₹5,250 at rate 5% (example), tax included — value without tax = 5250 × 100 ÷ 105 = ₹5,000; GST ₹250 (within the state CGST ₹125 + SGST ₹125).',
    mistakes:
      '- ❌ Reversing Exclusive and Inclusive.\n- ❌ Assuming some "standard" rate — enter the correct rate as per the item/rules. **Expert verification required.**',
    faqs: [
      {
        q: 'Difference between Exclusive and Inclusive?',
        a: 'In Exclusive the amount is without tax (tax is to be added); in Inclusive the tax is already included in the amount (it is to be separated).',
      },
      {
        q: 'How are CGST and SGST split?',
        a: 'In transactions within a state, GST is usually split half into CGST and half into SGST.',
      },
      {
        q: 'Which is the correct GST rate?',
        a: 'This calculator does not suggest any rate; enter the correct rate as per the item/rules and confirm with your CA.',
      },
      {
        q: 'What about sales to another state?',
        a: 'On sales outside the state, IGST usually applies instead of CGST/SGST. Confirm your position with your CA.',
      },
      {
        q: 'How is input GST (ITC) set off?',
        a: "Month's GST payable − input GST = amount to deposit; if input is higher, the balance carries forward. The conditions for ITC are set by GST law.",
      },
    ],
    relatedArticles: ['GST for cooperative societies'],
    relatedHelp: ['How to view the GST summary and payment'],
    relatedGuide: ['Guide: GST management'],
    relatedModules: ['GST Summary', 'HSN Master'],
  },

  'tds-calculator': {
    metaTitle: 'TDS Calculator — enter amount & rate | SahakarLekha',
    metaDescription:
      'Enter the payment amount and TDS rate — work out the deduction (TDS) and the net payment. You enter the rate; no legal rate is suggested.',
    intro: 'Amount + rate → TDS deduction and net payment. You enter the rate.',
    inputs: {
      amount: { label: 'Payment amount' },
      rate: { label: 'TDS rate', sub: 'You enter it (no rate suggested)' },
    },
    formula: '`TDS = Payment amount × Rate% ÷ 100`\n\n`Net payment = Payment amount − TDS`',
    explanation:
      'Under TDS (tax deducted at source), a part is deducted at the time of payment and deposited with the government, and the payee gets the rest. **The rate and whether it applies** depend on the type of payment — this calculator does not suggest any rate; you enter the rate.',
    example:
      'Amount ₹50,000, rate 10% (only a calculation example — whether TDS applies depends on the type of payment and the threshold) — TDS = ₹5,000; Net payment = ₹45,000.\n\n**Second example (rent, with source):** Godown rent ₹60,000 per month. As per Section 393(2) of the Income-tax Act 2025, TDS on rent of land/building is 10% when the rent is more than ₹50,000 per month — TDS = ₹6,000; Net payment ₹54,000. If the rent is exactly ₹50,000 per month, no TDS arises. (The text of Section 393 was read on incometaxindia.gov.in on 2026-10-03; confirm your position with your CA.)',
    mistakes:
      '- ❌ Assuming TDS on every payment — whether it applies depends on the rules. **Expert verification required.**\n- ❌ Entering the wrong rate — confirm the correct rate/section with your CA.',
    faqs: [
      {
        q: 'On what is TDS deducted?',
        a: 'It depends on the type of payment, and whether it applies depends on the rules — this calculator does not suggest any rate.',
      },
      {
        q: 'What is the TDS formula?',
        a: 'TDS = Payment amount × Rate% ÷ 100; Net payment = Amount − TDS.',
      },
      {
        q: 'Where do I get the correct rate?',
        a: 'Confirm the correct rate and section with your CA or the official rules.',
      },
      {
        q: 'Once the threshold is crossed, on how much is TDS deducted?',
        a: 'As per Section 393(1)(a) of the Income-tax Act 2025, once the threshold is crossed TDS is usually on the whole amount, not just the part above it (some rows, such as the one for purchase of goods, are exceptions).',
      },
      {
        q: 'What to do after deducting TDS?',
        a: 'The TDS deducted sits in the TDS Payable account; deposit it with the government by challan (Dr TDS Payable / Cr Bank) and file the quarterly statement. See the TDS chapter of the guide.',
      },
    ],
    relatedArticles: ['TDS and 26Q guide'],
    relatedHelp: ['How to view the TDS register'],
    relatedGuide: ['Guide: TDS and 26Q'],
    relatedModules: ['TDS Register', 'Form 16A'],
  },

  'loan-emi-calculator': {
    metaTitle: 'Loan EMI Calculator — instalment, interest & amortization | SahakarLekha',
    metaDescription:
      'Enter principal, interest rate and tenure — get the monthly EMI, total interest, total payment and a year-wise amortization table.',
    intro: 'Monthly instalment (EMI), total interest and year-wise amortization — in one click.',
    inputs: {
      principal: { label: 'Loan amount (principal)' },
      rate: { label: 'Annual interest rate' },
      months: { label: 'Tenure', suffix: 'months' },
    },
    formula:
      '`EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1)`\n\nwhere `P` = principal, `r` = monthly rate (annual rate ÷ 12 ÷ 100), `n` = number of months.',
    explanation:
      'EMI is an equal monthly instalment containing both principal and interest. In the early instalments the interest share is larger, later the principal share. The amortization table shows how much principal was reduced each year.',
    example:
      'Principal ₹3,00,000, rate 9%, 36 months — EMI ≈ ₹9,540; total interest ≈ ₹43,430.\n\n**Second example (1-year loan):** Principal ₹1,00,000, rate 12% (1% monthly), 12 months — EMI ≈ ₹8,885; total payment ≈ ₹1,06,619, total interest ≈ ₹6,619.',
    mistakes:
      '- ❌ Taking the annual rate directly as monthly (divide the rate ÷ 12).\n- ❌ Entering the tenure in years (enter it in months).',
    faqs: [
      {
        q: 'What does an EMI include?',
        a: 'The equal monthly instalment contains both principal and interest — the interest share is larger in the early instalments.',
      },
      {
        q: 'How do I convert the annual rate to monthly?',
        a: 'Annual rate ÷ 12 ÷ 100 = monthly rate.',
      },
      {
        q: 'What does the amortization table show?',
        a: 'How much principal was repaid each year, how much went in interest and how much remains.',
      },
      {
        q: 'How do I split the EMI entry?',
        a: 'The interest part of each instalment goes to the interest account and the principal part to the loan account — take both parts from the amortization table.',
      },
      {
        q: 'What happens on early repayment?',
        a: 'No further interest arises on the remaining principal. Check the terms and any charges in the loan agreement/policy.',
      },
    ],
    relatedArticles: ['Loan and interest accounting', 'KCC and crop loans'],
    relatedHelp: ['How to make a Loan Entry'],
    relatedGuide: ['Guide: Special Registers (Loan Register)'],
    relatedModules: ['Loan Register', 'Loan Interest'],
  },

  'cash-difference-calculator': {
    metaTitle: 'Cash Difference Calculator | SahakarLekha',
    metaDescription:
      'Enter the cash book balance and the physical cash — instantly see the difference, shortage (short) or excess. Cash verification made easy.',
    intro: 'Book balance vs actual cash — catch a shortage or excess instantly.',
    inputs: {
      book: { label: 'Cash book balance' },
      physical: { label: 'Physical cash (counted)' },
    },
    formula:
      '`Difference = Physical cash − Cash book balance`\n\nPositive = Excess; negative = Short; zero = matched.',
    explanation:
      'In cash verification the actual cash is counted and matched with the cash book balance. The two should be equal. A difference means an entry was missed or wrong somewhere, or there is leakage — do not put it off.',
    example:
      'Book balance ₹12,000, physical cash ₹11,800 — a difference of ₹200 **short**.\n\n**Second example (excess):** Cash book balance ₹25,400, counted ₹25,650 — ₹250 **excess**. First check whether a receipt was left unrecorded; if no reason is found, record it as per the society\'s policy and tell the auditor.',
    mistakes:
      '- ❌ Ignoring the difference — always check it immediately.\n- ❌ A negative cash balance (this is impossible — a sign of an error).',
    faqs: [
      {
        q: 'Difference between short and excess?',
        a: 'Physical cash less than the cash book = short; more = excess.',
      },
      {
        q: 'What to do if there is a difference?',
        a: 'Check immediately — it signals a missed/wrong entry or leakage; do not put it off.',
      },
      {
        q: 'Can the cash balance be negative?',
        a: 'No; negative cash is always a sign of some error.',
      },
      {
        q: 'When should cash be counted?',
        a: 'Daily at the end of the day, and at month/year end in the presence of two people. Keep a record of the count (denomination-wise).',
      },
      {
        q: 'Entry to make good a shortage?',
        a: "If the reason is known, post the missed entry; if not, as per the society's policy/resolution — recovery from the person responsible, or a loss — and tell the auditor.",
      },
    ],
    relatedArticles: ['Cash handling and verification', 'Cash book vs bank book'],
    relatedHelp: ['How to view the Cash Book'],
    relatedGuide: ['Guide: Day Book and Ledger'],
    relatedModules: ['Cash Book'],
  },

  'percentage-calculator': {
    metaTitle: 'Percentage Calculator — increase, decrease, difference | SahakarLekha',
    metaDescription:
      'Work out a percentage increase, decrease or the % difference between two values — instantly, with the formula and examples. Free calculator.',
    intro: 'Increase, decrease, or the percentage difference between two values — instantly.',
    inputs: {
      mode: { label: 'Type', options: { increase: '% increase', decrease: '% decrease', difference: '% difference (A→B)' } },
      a: { label: 'Value A' },
      b: { label: 'Value B / percentage', sub: 'Enter % for increase/decrease; the second value for difference' },
    },
    formula:
      '% increase: `New = A + (A × B ÷ 100)`\n\n% decrease: `New = A − (A × B ÷ 100)`\n\n% difference: `((B − A) ÷ |A|) × 100`',
    explanation:
      'Percentages come up in everyday accounts — recovery %, increase/decrease in expenses, or comparing figures of two years. Here are three common types.',
    example:
      '10% increase on 1,000 → 1,100 (amount added 100). % difference from 800 to 1,000 → +25%.\n\n**Second example:** Fertilizer sales of ₹3,00,000 out of total sales of ₹12,00,000 — share = (300000 ÷ 1200000) × 100 = 25%. A 15% cut in an expense of ₹80,000 → ₹68,000.',
    mistakes:
      '- ❌ Treating "% increase" and "% difference" as the same.\n- ❌ Swapping the base (A) and the comparison value (B).',
    faqs: [
      {
        q: 'Difference between % increase and % difference?',
        a: '% increase raises a value; % difference shows the change between two values.',
      },
      {
        q: 'How do I work out the percentage of a part?',
        a: '(Part ÷ Total) × 100.',
      },
      {
        q: 'What are the percentage formulas?',
        a: 'Increase: A+(A×B÷100); decrease: A−(A×B÷100); difference: ((B−A)÷|A|)×100.',
      },
      {
        q: "How do I work out the % growth over last year?",
        a: "((This year − Last year) ÷ Last year) × 100. If last year is zero, the % difference cannot be worked out.",
      },
      {
        q: 'What does a negative % difference mean?',
        a: 'The new value is lower than the old one — i.e. a decrease.',
      },
    ],
    relatedArticles: ['How to read financial reports'],
    relatedHelp: [],
    relatedGuide: ['Guide: Financial indicators and ratios'],
    relatedModules: ['Reports'],
  },

  'working-capital-calculator': {
    metaTitle: 'Working Capital Calculator | SahakarLekha',
    metaDescription:
      'Enter current assets and current liabilities — get working capital and the current ratio instantly. Educational.',
    intro: 'Current assets − current liabilities = working capital; plus the current ratio.',
    inputs: {
      ca: { label: 'Current assets' },
      cl: { label: 'Current liabilities' },
    },
    formula:
      '`Working capital = Current assets − Current liabilities`\n\n`Current ratio = Current assets ÷ Current liabilities`',
    explanation:
      'Working capital tells you how much "free" capital the society has to meet its short-term needs. The **current ratio** (ideally above 1) shows how large current assets are compared with current liabilities.',
    example:
      'Current assets ₹5,00,000, current liabilities ₹3,00,000 — working capital ₹2,00,000; current ratio 1.67 : 1.\n\n**Second example (negative):** Current assets ₹2,40,000, current liabilities ₹3,00,000 — working capital −₹60,000; current ratio 0.8 : 1. That is, current assets fall short of what is needed to pay current liabilities.',
    mistakes:
      '- ❌ Counting long-term assets/liabilities as current.\n- ❌ Ignoring negative working capital.',
    faqs: [
      {
        q: 'What does working capital tell you?',
        a: 'How much "free" capital there is to meet short-term needs — current assets − current liabilities.',
      },
      {
        q: 'What current ratio is considered good?',
        a: 'Generally above 1 is considered better (educational guidance).',
      },
      {
        q: 'What does negative working capital mean?',
        a: 'Current liabilities exceed assets — a signal to watch cash.',
      },
      {
        q: 'What comes under current assets?',
        a: 'Cash, bank, debtors, stock, short-term deposits and advances — whatever can turn into cash within a year.',
      },
      {
        q: 'What comes under current liabilities?',
        a: 'Creditors, outstanding expenses, TDS/GST payable, short-term loans and any liability to be paid within the year.',
      },
    ],
    relatedArticles: ['How to read financial reports', 'Mid-year review'],
    relatedHelp: [],
    relatedGuide: ['Guide: Financial indicators and ratios', 'Guide: Balance Sheet'],
    relatedModules: ['Reports', 'Balance Sheet'],
  },
};
