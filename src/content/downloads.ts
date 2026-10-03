/**
 * /downloads — free blank formats (registry, single source for the page AND the prerender). PURE: no imports.
 *
 * Kept to five REAL resources that the existing PDF engine can produce honestly (src/lib/pdf.ts
 * generateBlankFormatPDF, built on the same addHeader / autoTable / signature helpers as every report), plus one
 * existing printable guide page. Each is a GENERIC working format — not a statutory form. Where a State Act, Rules
 * or the society's bye-laws prescribe a format, that format governs; nothing here claims otherwise, and every
 * entry says its expert (CA / RCS) review is still pending. PDF text stays English (test:pdf-english-only);
 * the page explains each format in Hindi.
 */
export interface BlankPdfSpec {
  /** Download file name (without .pdf). */
  file: string;
  /** English PDF title (jsPDF's base font has no Devanagari). */
  title: string;
  subtitle?: string;
  orientation: 'portrait' | 'landscape';
  /** 'a4' default; 'a5' for a single voucher. */
  pageSize?: 'a4' | 'a5';
  columns: string[];
  /** Blank rows to draw — or, for a form, pre-filled first-column labels with a blank value column. */
  rows: number | string[];
  signatures: string[];
}

export interface DownloadResource {
  slug: string;
  title: string;            // Hindi title on the page
  englishTitle: string;
  format: string;           // e.g. "PDF · A4 landscape"
  use: string;              // who uses it and when (Hindi)
  applicability: string;    // state scope (Hindi)
  year: string;             // year applicability (Hindi)
  reviewed: string;         // ISO date of the last internal content review
  expertReview: string;     // honest status of CA / RCS review
  kind: 'pdf' | 'page';
  pdf?: BlankPdfSpec;
  href?: string;            // for kind 'page'
  related: { href: string; label: string }[];
}

export const DOWNLOADS_REVIEWED = '2026-10-03';
const COMMON_APPLICABILITY = 'सभी राज्य — सामान्य (generic) कार्य-प्रारूप। आपके राज्य के अधिनियम/नियम या समिति की उपविधि में कोई प्रारूप निर्धारित हो, तो वही मान्य होगा।';
const ANY_YEAR = 'किसी भी वित्तीय वर्ष के लिए — वर्ष व तारीखें स्वयं भरें।';
const PENDING = 'विशेषज्ञ (CA / RCS) समीक्षा लंबित — इसे वैधानिक (statutory) प्रारूप न मानें।';
const SIGN = ['Prepared by (Accountant)', 'Checked by (Secretary)', 'Approved by (President)'];

export const DOWNLOADS: DownloadResource[] = [
  {
    slug: 'cash-book-format',
    title: 'रोकड़ बही (Cash Book) — खाली प्रारूप',
    englishTitle: 'Cash Book — blank format',
    format: 'PDF · A4 landscape · 25 पंक्तियाँ',
    use: 'रोज़ की नकद प्राप्ति व भुगतान हाथ से दर्ज करने के लिए; रोज़ शाम शेष (balance) मिलाने के लिए।',
    applicability: COMMON_APPLICABILITY, year: ANY_YEAR, reviewed: DOWNLOADS_REVIEWED, expertReview: PENDING,
    kind: 'pdf',
    pdf: {
      file: 'SahakarLekha_Cash_Book_Format', title: 'CASH BOOK', subtitle: 'Blank format — for manual entry',
      orientation: 'landscape',
      columns: ['Date', 'Voucher No.', 'Particulars', 'L.F.', 'Receipts (Rs)', 'Payments (Rs)', 'Balance (Rs)'],
      rows: 25, signatures: ['Cashier', 'Accountant', 'Secretary'],
    },
    related: [
      { href: '/blog/cash-book-vs-bank-book', label: 'कैश बुक vs बैंक बुक' },
      { href: '/glossary/cash-book', label: 'शब्दकोश: कैश बुक' },
      { href: '/tools/cash-difference-calculator', label: 'कैश अंतर कैलकुलेटर' },
    ],
  },
  {
    slug: 'voucher-format',
    title: 'रसीद / भुगतान वाउचर — खाली प्रारूप',
    englishTitle: 'Receipt / Payment voucher — blank format',
    format: 'PDF · A5 portrait · एक वाउचर',
    use: 'हर प्राप्ति या भुगतान का लिखित प्रमाण — राशि, खाता, विवरण (narration) और हस्ताक्षर के साथ।',
    applicability: COMMON_APPLICABILITY, year: ANY_YEAR, reviewed: DOWNLOADS_REVIEWED, expertReview: PENDING,
    kind: 'pdf',
    pdf: {
      file: 'SahakarLekha_Voucher_Format', title: 'RECEIPT / PAYMENT VOUCHER', subtitle: 'Tick one:  [ ] Receipt   [ ] Payment',
      orientation: 'portrait', pageSize: 'a5',
      columns: ['Particulars', 'Details'],
      rows: ['Voucher No.', 'Date', 'Received from / Paid to', 'Account debited (Dr)', 'Account credited (Cr)',
        'Amount (Rs)', 'Amount in words', 'Mode (Cash / Cheque / UPI) & Ref. No.', 'Narration'],
      signatures: ['Receiver / Payee', 'Accountant', 'Secretary'],
    },
    related: [
      { href: '/blog/voucher-entry-guide', label: 'वाउचर एंट्री गाइड' },
      { href: '/blog/voucher-narration-and-documents', label: 'Narration व सहायक दस्तावेज़' },
      { href: '/glossary/voucher', label: 'शब्दकोश: वाउचर' },
    ],
  },
  {
    slug: 'share-register-format',
    title: 'सदस्य शेयर रजिस्टर — खाली प्रारूप',
    englishTitle: 'Member share register — blank format',
    format: 'PDF · A4 landscape · 20 पंक्तियाँ',
    use: 'हर सदस्य के शेयर, अंकित मूल्य, जमा राशि, शेयर प्रमाणपत्र और नामांकित (nominee) का रिकॉर्ड।',
    applicability: COMMON_APPLICABILITY, year: ANY_YEAR, reviewed: DOWNLOADS_REVIEWED, expertReview: PENDING,
    kind: 'pdf',
    pdf: {
      file: 'SahakarLekha_Share_Register_Format', title: 'MEMBER SHARE REGISTER', subtitle: 'Blank format — for manual entry',
      orientation: 'landscape',
      columns: ['S.No', 'Member No.', 'Name & Address', 'Date of Admission', 'Shares Held', 'Face Value (Rs)', 'Amount Paid (Rs)', 'Share Cert. No.', 'Nominee', 'Remarks'],
      rows: 20, signatures: SIGN,
    },
    related: [
      { href: '/blog/member-and-share-accounting', label: 'सदस्य व शेयर लेखांकन' },
      { href: '/glossary/share-certificate', label: 'शब्दकोश: शेयर प्रमाणपत्र' },
      { href: '/tools/share-capital-calculator', label: 'शेयर कैपिटल कैलकुलेटर' },
    ],
  },
  {
    slug: 'asset-depreciation-register',
    title: 'स्थायी संपत्ति व मूल्यह्रास रजिस्टर — खाली प्रारूप',
    englishTitle: 'Fixed asset & depreciation register — blank format',
    format: 'PDF · A4 landscape · 20 पंक्तियाँ',
    use: 'हर संपत्ति की लागत, विधि (SLM/WDV), दर, साल का मूल्यह्रास और समापन मूल्य — दर समिति की नीति/लागू नियम के अनुसार स्वयं भरें।',
    applicability: COMMON_APPLICABILITY, year: ANY_YEAR, reviewed: DOWNLOADS_REVIEWED, expertReview: PENDING,
    kind: 'pdf',
    pdf: {
      file: 'SahakarLekha_Asset_Depreciation_Register_Format', title: 'FIXED ASSET & DEPRECIATION REGISTER', subtitle: 'Blank format — rates as per your policy / applicable rules',
      orientation: 'landscape',
      columns: ['Asset', 'Date of Purchase', 'Cost (Rs)', 'Method (SLM/WDV)', 'Rate %', 'Opening Value (Rs)', 'Additions (Rs)', 'Depreciation (Rs)', 'Closing Value (Rs)', 'Remarks'],
      rows: 20, signatures: SIGN,
    },
    related: [
      { href: '/blog/depreciation-explained', label: 'डेप्रिसिएशन समझें' },
      { href: '/tools/depreciation-calculator', label: 'डेप्रिसिएशन कैलकुलेटर' },
      { href: '/guide/depreciation', label: 'गाइड: डेप्रिसिएशन' },
    ],
  },
  {
    slug: 'year-end-checklist',
    title: 'साल के अंत की चेकलिस्ट (प्रिंट-योग्य)',
    englishTitle: 'Year-end checklist (printable)',
    format: 'प्रिंट-योग्य वेब पेज (ब्राउज़र से Print / Save as PDF)',
    use: 'वित्तीय वर्ष बंद करने से पहले हर काम पर टिक — वाउचर, बैंक मिलान, स्टॉक गणना से FY लॉक तक।',
    applicability: 'सभी राज्य — सामान्य कार्य-सूची। ऑडिट/रिटर्न की तारीखें आपके राज्य के नियम से लें।', year: ANY_YEAR,
    reviewed: DOWNLOADS_REVIEWED, expertReview: PENDING,
    kind: 'page', href: '/guide/year-end-checklist',
    related: [
      { href: '/guide/year-end-and-fy-lock', label: 'गाइड: साल के अंत प्रक्रिया व FY-लॉक' },
      { href: '/blog/audit-preparation-checklist', label: 'ऑडिट तैयारी चेकलिस्ट' },
    ],
  },
];

export const DOWNLOADS_META = {
  title: 'मुफ्त खाली प्रारूप (Downloads) — कैश बुक, वाउचर, शेयर रजिस्टर | SahakarLekha',
  description: 'सहकारी समिति के लिए मुफ्त खाली कार्य-प्रारूप: कैश बुक, रसीद/भुगतान वाउचर, सदस्य शेयर रजिस्टर, संपत्ति व मूल्यह्रास रजिस्टर और साल के अंत की चेकलिस्ट — बिना ईमेल, सीधा डाउनलोड।',
} as const;
