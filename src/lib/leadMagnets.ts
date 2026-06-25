/**
 * leadMagnets — on-demand branded checklist PDFs (lead magnets). English content
 * + jsPDF Helvetica (same proven approach as sampleReport.ts; the app's PDFs lack
 * Devanagari glyphs, so marketing PDFs stay English). One generic builder drives
 * several topic-matched magnets (audit, GST/TDS, inventory).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY: [number, number, number] = [31, 73, 125];
const GREEN: [number, number, number] = [15, 123, 90];

type Section =
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

function buildPDF(m: Magnet): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = 15;
  const R = pageW - 15;

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SahakarLekha', L, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Free cooperative society accounting · sahakarlekha.com', L, 19);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(m.pdfTitle, L, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(m.pdfSubtitle, L, 47);
  doc.setTextColor(0);

  let y = 58;

  const sectionTitle = (txt: string) => {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    doc.setFillColor(...GREEN);
    doc.rect(L, y - 4.5, 2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(txt, L + 5, y);
    doc.setTextColor(0);
    y += 8;
  };

  const checkItem = (txt: string) => {
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.rect(L + 1, y - 3.4, 3.6, 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(txt, R - (L + 8)) as string[];
    doc.text(lines, L + 8, y);
    y += lines.length * 5 + 2.5;
  };

  m.sections.forEach((s) => {
    sectionTitle(s.title);
    if ('items' in s) {
      s.items.forEach(checkItem);
      y += 3;
    } else {
      autoTable(doc, {
        startY: y,
        head: [s.table.head],
        body: s.table.rows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.2, lineColor: [210, 210, 210] },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
        margin: { left: L, right: 15 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(L, pageH - 16, R, pageH - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN);
    doc.text('Generated free with SahakarLekha', L, pageH - 11);
    doc.setTextColor(90);
    doc.text('Start free: sahakarlekha.com/register', R, pageH - 11, { align: 'right' });
    doc.setTextColor(150);
    doc.setFontSize(7.5);
    doc.text(m.disclaimer, pageW / 2, pageH - 6, { align: 'center' });
  }

  doc.save(m.filename);
}

export function generateMagnet(key: MagnetKey): void {
  buildPDF(MAGNETS[key] || MAGNETS['audit-checklist']);
}

/** Pick the most relevant magnet for a blog category. */
export function magnetForCategory(category?: string): MagnetKey {
  if (category === 'इन्वेंटरी') return 'inventory-checklist';
  // (No GST-specific blog category yet — gst-checklist is available via the prop.)
  return 'audit-checklist';
}
