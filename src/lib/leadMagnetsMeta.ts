/**
 * leadMagnetsMeta — the lead-magnet catalogue (titles, UI copy, PDF sections) WITHOUT the PDF engine.
 * J1: kept apart from leadMagnets.ts so pages that only show the offer (landing, blog) don't pull
 * jspdf + jspdf-autotable (~250 KB gzip); the PDF builder loads on click.
 */

export type Section =
  | { title: string; items: string[] }
  | { title: string; table: { head: string[]; rows: string[][] } };

export interface Magnet {
  key: string;
  filename: string;     // saved PDF file name
  pdfTitle: string;     // big title inside the PDF
  pdfSubtitle: string;  // subtitle inside the PDF
  uiTitle: string;      // EmailCapture heading (Hindi)
  uiBlurb: string;      // EmailCapture description (Hindi)
  disclaimer: string;   // footer line
  sections: Section[];
}

export type MagnetKey = 'audit-checklist' | 'gst-checklist' | 'inventory-checklist';

export const MAGNETS: Record<MagnetKey, Magnet> = {
  'audit-checklist': {
    key: 'audit-checklist',
    filename: 'SahakarLekha-Audit-Checklist.pdf',
    pdfTitle: 'Audit Preparation Checklist',
    pdfSubtitle: 'For cooperative societies — PACS, Marketing, Consumer & Multipurpose',
    uiTitle: 'मुफ्त: ऑडिट-तैयारी चेकलिस्ट 📋',
    uiBlurb: 'ऑडिट से पहले क्या तैयार रखें, आम आपत्तियाँ व उनका बचाव — 1-पेज प्रिंट-योग्य PDF।',
    disclaimer: 'General guidance only; rules vary by state Act / bye-laws — confirm with your Registrar / auditor.',
    sections: [
      {
        title: 'A. Documents to keep ready',
        items: [
          'Updated Trial Balance (Debit = Credit, matched)',
          'Final accounts: Trading A/c, Income & Expenditure, Balance Sheet, Receipts & Payments',
          'Bank Reconciliation Statement for every account, up to date',
          'All vouchers in order, with bills / receipts attached',
          'Member, Share, Loan, Stock and Salary registers',
          'GST and TDS returns with challans (proof of payment)',
          'Minutes of General Body / Board meetings',
          "Previous year's audit report + compliance of its objections",
        ],
      },
      {
        title: 'B. Most common audit objections — and how to avoid them',
        table: {
          head: ['Objection', 'Cause', 'How to avoid'],
          rows: [
            ['Trial Balance did not match', 'Wrong opening balance / missed entry', 'Reconcile every month'],
            ['Voucher–entry mismatch', 'Rush, missing bill', 'Attach the bill to each voucher'],
            ['Bank balance not matching', 'No reconciliation done', 'Do a monthly BRS'],
            ['Closing ≠ next opening', 'Year transition error', 'Close & FY-lock the year'],
            ['Stock counted twice', 'Closing stock double-entered', 'Use a single calculation'],
          ],
        },
      },
      {
        title: 'C. 3 habits that keep every audit easy',
        items: [
          'Monthly bank reconciliation + a quick Trial Balance check',
          'Attach a bill / receipt to every large voucher immediately',
          'FY-lock at year-end so the figures stay stable during audit',
        ],
      },
    ],
  },

  'gst-checklist': {
    key: 'gst-checklist',
    filename: 'SahakarLekha-GST-TDS-Checklist.pdf',
    pdfTitle: 'GST & TDS Month-End Checklist',
    pdfSubtitle: 'For cooperative societies — stay compliant, avoid penalties',
    uiTitle: 'मुफ्त: GST व TDS माह-अंत चेकलिस्ट 🧾',
    uiBlurb: 'हर महीने क्या फ़ाइल करें, कौन-से दस्तावेज़ रखें व आम गलतियाँ — सहकारी समिति के लिए।',
    disclaimer: 'Rates and due dates change — always verify on the GST / Income-Tax portal or with your CA.',
    sections: [
      {
        title: 'A. Every month',
        items: [
          'Reconcile your sales register with GSTR-1 (outward supplies)',
          'Match purchase register / Input Tax Credit with GSTR-2B',
          'Pay GST liability and file GSTR-3B before the due date',
          'Deduct TDS at the correct rate; deposit by the 7th of next month',
          'Keep TDS challans and prepare the 26Q working',
        ],
      },
      {
        title: 'B. Documents to keep',
        items: [
          'Tax invoices (sales & purchase) and HSN / SAC summary',
          'Input Tax Credit ledger and e-way bills (where applicable)',
          'TDS challans + quarterly return (26Q) working papers',
        ],
      },
      {
        title: 'C. Common GST / TDS mistakes — and the fix',
        table: {
          head: ['Mistake', 'How to avoid'],
          rows: [
            ['ITC claimed without GSTR-2B match', 'Reconcile ITC every month'],
            ['TDS deducted twice or missed', 'Deduct once, at payment / credit'],
            ['Wrong tax on discounted bills', 'Charge tax on the taxable value'],
            ['Late filing / payment', 'Set calendar reminders before due dates'],
          ],
        },
      },
    ],
  },

  'inventory-checklist': {
    key: 'inventory-checklist',
    filename: 'SahakarLekha-Inventory-Checklist.pdf',
    pdfTitle: 'Inventory & Stock Checklist',
    pdfSubtitle: 'For marketing & consumer cooperative societies',
    uiTitle: 'मुफ्त: इन्वेंटरी व स्टॉक चेकलिस्ट 📦',
    uiBlurb: 'स्टॉक सेटअप, मासिक मिलान व वैल्यूएशन — मार्केटिंग/उपभोक्ता समितियों के लिए।',
    disclaimer: 'General guidance only; adapt to your society’s items and bye-laws.',
    sections: [
      {
        title: 'A. Set up right',
        items: [
          'One item master with opening stock and rate for each product',
          'Group items by category (e.g. fertilizer, consumer goods)',
          'Map each item to the correct sales / purchase ledger',
        ],
      },
      {
        title: 'B. Every month',
        items: [
          'Record purchases and sales the same day (stock auto-updates)',
          'Prevent overselling — do not sell more than the available stock',
          'Physically count stock and match it with the system',
        ],
      },
      {
        title: 'C. Valuation (year-end)',
        items: [
          'Use weighted-average cost (quantity × average rate)',
          'Closing stock = one single calculation (never double-counted)',
        ],
      },
      {
        title: 'D. Common stock mistakes — and the fix',
        table: {
          head: ['Mistake', 'How to avoid'],
          rows: [
            ['Mixing a stock field with opening+movements', 'Use one formula everywhere'],
            ['Closing stock counted twice', 'Single calc in Trading + Balance Sheet'],
            ['Item rate left blank', 'Always enter the purchase rate'],
            ['No physical count', 'Reconcile at least once a year'],
          ],
        },
      },
    ],
  },
};

/** Pick the most relevant magnet for a blog category. */
export function magnetForCategory(category?: string): MagnetKey {
  if (category === 'इन्वेंटरी') return 'inventory-checklist';
  if (category === 'कर अनुपालन') return 'gst-checklist';
  return 'audit-checklist';
}
