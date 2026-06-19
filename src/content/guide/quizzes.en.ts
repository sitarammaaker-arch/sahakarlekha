/**
 * English versions of the part-wise quizzes. Same structure and answer indices
 * as quizzes.ts; localizedQuiz() picks the language.
 */
import { GUIDE_QUIZZES, type PartQuiz } from './quizzes';
import type { GuideLang } from './i18n';

export const GUIDE_QUIZZES_EN: Record<string, PartQuiz> = {
  'bhag-1': {
    partId: 'bhag-1',
    title: 'Part 1 — Foundations of Accounting',
    questions: [
      {
        q: 'In the double-entry system, what must be equal in every transaction?',
        options: ['Income and expense', 'Debit (Dr) and Credit (Cr)', 'Cash and bank', 'Asset and income'],
        answer: 1,
        explain: 'Every transaction has two sides — a Dr in one account and a Cr in another, equal in amount.',
      },
      {
        q: 'When an asset increases, on which side is it recorded?',
        options: ['Credit (Cr)', 'Debit (Dr)', 'Both sides', 'Neither'],
        answer: 1,
        explain: 'Assets and expenses increase on Dr; liabilities, capital and income increase on Cr.',
      },
      {
        q: 'Share capital is which type of account?',
        options: ['Income', 'Expense', 'Capital/Fund', 'Asset'],
        answer: 2,
        explain: 'Share capital is the member’s contribution — it is capital, not earnings (income).',
      },
      {
        q: 'Which is the correct accounting equation?',
        options: ['Assets = Liabilities + Capital', 'Assets = Income − Expense', 'Capital = Income + Expense', 'Liabilities = Assets + Capital'],
        answer: 0,
        explain: 'Assets = Liabilities + Capital — the basis of the Balance Sheet tallying.',
      },
    ],
  },
  'bhag-2': {
    partId: 'bhag-2',
    title: 'Part 2 — Getting Started with SahakarLekha',
    questions: [
      {
        q: 'Admission fee is which type?',
        options: ['Capital', 'Income', 'Liability', 'Asset'],
        answer: 1,
        explain: 'Share capital = capital, but the admission fee = income.',
      },
      {
        q: 'When entering opening balances, what is mandatory?',
        options: ['Total Dr = total Cr', 'Only assets', 'Only cash', 'Anything in any order'],
        answer: 0,
        explain: 'The total of all opening balances must have total Dr = total Cr — else the Balance Sheet won’t tally.',
      },
      {
        q: 'Code series 4000 is which category?',
        options: ['Asset', 'Liability', 'Income', 'Expense'],
        answer: 2,
        explain: '1000=capital, 2000=liability, 3000=asset, 4000=income, 5000=expense.',
      },
      {
        q: 'The actual entry goes where?',
        options: ['In a group', 'In a sub-ledger', 'In both', 'Anywhere'],
        answer: 1,
        explain: 'A group is just a heading; the entry always goes in a sub-ledger.',
      },
    ],
  },
  'bhag-3': {
    partId: 'bhag-3',
    title: 'Part 3 — Daily Operations',
    questions: [
      {
        q: 'Which voucher is used to deposit cash in the bank?',
        options: ['Receipt', 'Payment', 'Contra', 'Journal'],
        answer: 2,
        explain: 'A cash ↔ bank transfer is a contra. Making it a receipt/payment double-counts Receipts & Payments.',
      },
      {
        q: 'When you try to sell more than the available stock, the app:',
        options: ['Makes stock negative', 'Blocks the sale', 'Saves with a warning', 'Does nothing'],
        answer: 1,
        explain: 'The oversell block: a sale above available (or of 0 stock) is blocked — purchase first.',
      },
      {
        q: 'GST input credit (ITC) on a purchase is which type of account?',
        options: ['Expense', 'Income', 'Asset', 'Liability'],
        answer: 2,
        explain: 'ITC is an asset (3310) — don’t add it to the purchase cost; it’s adjusted against output GST.',
      },
      {
        q: 'In a salary entry, how much is the expense?',
        options: ['Only the net salary', 'The full gross salary', 'Only the deductions', 'Nothing'],
        answer: 1,
        explain: 'The full gross is the expense; the employee gets the net, deductions become liabilities.',
      },
    ],
  },
  'bhag-4': {
    partId: 'bhag-4',
    title: 'Part 4 — Books & Trial Balance',
    questions: [
      {
        q: 'In a trial balance, what must be equal?',
        options: ['Income = expense', 'Total Dr = total Cr', 'Asset = income', 'Cash = bank'],
        answer: 1,
        explain: 'The trial balance’s total Dr = total Cr → proof of arithmetical accuracy.',
      },
      {
        q: 'The Day Book shows?',
        options: ['Account-wise balances', 'A time-ordered list of all vouchers', 'Only cash', 'Only reports'],
        answer: 1,
        explain: 'The Day Book is a date-ordered list of every voucher — the society’s "diary".',
      },
      {
        q: 'A supplier ledger’s credit (Cr) balance means?',
        options: ['We are owed', 'We owe (payable)', 'Zero', 'Profit'],
        answer: 1,
        explain: 'A liability/creditor Cr balance = that much is still to be paid by the society.',
      },
    ],
  },
  'bhag-5': {
    partId: 'bhag-5',
    title: 'Part 5 — Final Accounts',
    questions: [
      {
        q: 'Where is gross profit found?',
        options: ['Income & Expenditure', 'Trading Account', 'Balance Sheet', 'Receipts & Payments'],
        answer: 1,
        explain: 'Trading Account = sales − cost of goods sold → gross profit, which then goes to I&E.',
      },
      {
        q: 'Closing stock is taken at?',
        options: ['Sale price', 'Cost (or NRV, whichever lower)', 'Face value', 'Any price'],
        answer: 1,
        explain: 'AS-2: closing stock = cost or net realisable value, whichever lower — never at sale price.',
      },
      {
        q: 'On what basis is the Receipts & Payments account prepared?',
        options: ['Accrual', 'Cash', 'Estimate', 'Mixed'],
        answer: 1,
        explain: 'Receipts & Payments is on the cash basis (capital + revenue); I&E is on the accrual basis (revenue only).',
      },
      {
        q: 'In the Balance Sheet, the two sides equal?',
        options: ['Income and expense', 'Assets and (liabilities + capital)', 'Cash and bank', 'Profit and loss'],
        answer: 1,
        explain: 'Assets = Liabilities + Capital — both sides equal.',
      },
    ],
  },
  'bhag-6': {
    partId: 'bhag-6',
    title: 'Part 6 — Tax Compliance',
    questions: [
      {
        q: 'An intra-state sale attracts which GST?',
        options: ['IGST only', 'CGST + SGST', 'CGST only', 'None'],
        answer: 1,
        explain: 'Intra-state = CGST + SGST (half each); inter-state = IGST.',
      },
      {
        q: 'How many times should TDS be deducted?',
        options: ['Twice', 'Once', 'Three times', 'Not at all'],
        answer: 1,
        explain: 'Payable = grandTotal (already net of TDS); the deducted TDS sits separately in 2202 — don’t deduct twice.',
      },
      {
        q: 'The TDS register’s quarter is determined by?',
        options: ['The society’s financial year', 'The payment date', 'The current month', 'Nothing'],
        answer: 1,
        explain: 'The quarter and financial year are derived from the payment date (p.date).',
      },
    ],
  },
  'bhag-7': {
    partId: 'bhag-7',
    title: 'Part 7 — Specialised Accounting',
    questions: [
      {
        q: 'In the WDV method, depreciation applies on?',
        options: ['Original cost', 'Book value (WDV)', 'Sale value', 'Zero'],
        answer: 1,
        explain: 'WDV (written-down value) applies a % on the book value each year; SLM is a fixed % on original cost.',
      },
      {
        q: 'What minimum % of the net surplus must go to the statutory reserve?',
        options: ['10%', '15%', '25%', '50%'],
        answer: 2,
        explain: 'Cooperative rule: at least 25% of net profit to the statutory reserve (1201).',
      },
      {
        q: 'Dividend and patronage rebate fall under?',
        options: ['Expense', 'Appropriation', 'Income', 'Asset'],
        answer: 1,
        explain: 'They are a sharing of the surplus (appropriation) — not expenses.',
      },
      {
        q: 'A regular loan becomes NPA after how many days overdue?',
        options: ['1 day', '30 days', '90+ days', '365 days'],
        answer: 2,
        explain: 'NPA at 90+ days overdue; not at 1 day.',
      },
    ],
  },
  'bhag-8': {
    partId: 'bhag-8',
    title: 'Part 8 — Year-End & Security',
    questions: [
      {
        q: 'After FY-Lock, what happens to a data mutation?',
        options: ['Continues normally', 'Is blocked', 'Happens automatically', 'Slows down'],
        answer: 1,
        explain: 'After FY-Lock every mutation is blocked (RULE 6) — make everything final first.',
      },
      {
        q: 'In the audit certificate, what must NOT be added to paid-up share capital?',
        options: ['Individual share capital', 'Reserves', 'Government share capital', 'Nothing'],
        answer: 1,
        explain: 'Paid-up share capital = only the share_capital sub-type; reserves are not added.',
      },
      {
        q: 'The main basis of data security?',
        options: ['Password only', 'Cloud + row-level security (RLS)', 'Backup only', 'Nothing'],
        answer: 1,
        explain: 'Society-scoped RLS shows each society only its own data; plus regular backups.',
      },
    ],
  },
  'bhag-9': {
    partId: 'bhag-9',
    title: 'Part 9 — Reference & Practice',
    questions: [
      {
        q: 'The correct treatment of a wrong voucher?',
        options: ['Delete it', 'Cancel it (with a reason)', 'Leave it', 'Hide it'],
        answer: 1,
        explain: 'Don’t delete — cancel; a cancelled voucher stays in the list but is out of every report.',
      },
      {
        q: 'The canonical calculation of closing-stock value?',
        options: ['Qty × sale price', 'Qty × weighted-average cost', 'Qty only', 'Cost only'],
        answer: 1,
        explain: 'Stock value = canonical qty × weighted-average cost — one formula, in every report.',
      },
      {
        q: 'In the case study (Rania Society), the year-end Balance Sheet ties at?',
        options: ['₹5,62,500', '₹6,79,000', '₹2,02,500', '₹4,500'],
        answer: 1,
        explain: 'The whole year ties — both sides of the Balance Sheet at ₹6,79,000.',
      },
    ],
  },
};

/** Returns the quiz for a part in the chosen language (falls back to Hindi). */
export function localizedQuiz(partId: string, lang: GuideLang): PartQuiz | undefined {
  if (lang === 'en' && GUIDE_QUIZZES_EN[partId]) return GUIDE_QUIZZES_EN[partId];
  return GUIDE_QUIZZES[partId];
}
