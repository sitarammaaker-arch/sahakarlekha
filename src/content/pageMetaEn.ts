/**
 * English <title>/description of the public pages that have an English twin at /en/… (batch E1) — ONE source for
 * the React pages (useDocumentMeta, English branch) and the static prerender (scripts/prerender-guide.mjs), the
 * English counterpart of HUB_META in ./hubMeta. Pure (no imports) so the prerender can load it.
 *
 * Per-item pages (guide chapters, help tasks, cookbook entries, calculators) take their English meta from their own
 * overlays (guide/entriesEn, help/en, cookbook/en, calculators/en), not from here.
 */
export interface PageMetaEn {
  title: string;
  description: string;
}

export const PAGE_META_EN = {
  // Home: LandingPage sets no meta of its own; the prerendered /en page carries this.
  home: {
    title: 'SahakarLekha — Cooperative Society Accounting Software India',
    description: 'Purpose-built for Indian cooperative societies — accounting, GST/TDS, member records and audit-ready reports. From ₹2,999/year + GST; Plus & Pro as you grow. Hindi + English.',
  },
  guide: {
    title: 'SahakarLekha Guide — Complete Cooperative Accounting Course',
    description: 'A complete accounting course for cooperative societies — sales, purchases, stock, GST/TDS, final accounts, audit & year-end. 10 parts, 35 chapters, quizzes & a certificate — free.',
  },
  help: {
    title: 'Help Center — How to do it | SahakarLekha',
    description: 'Everyday cooperative society accounting tasks — how to add a member, enter opening balances, make a voucher — simple step-by-step guides with direct links into the app.',
  },
  cookbook: {
    title: 'Entry Cookbook (Accounting Entries) — which entry, and how | SahakarLekha',
    description: 'Common journal entries for a cooperative society — cash/credit sales and purchases, share capital, loans and interest, salary, depreciation, closing stock, HAFED commission — each with a Dr/Cr example.',
  },
  blog: {
    title: 'SahakarLekha Blog — cooperative society accounting, audit & management',
    description: 'Simple articles on digital accounting, voucher entry, audit, compliance and management for cooperative societies — for PACS, marketing, consumer and multipurpose societies.',
  },
  glossary: {
    title: 'Cooperative Accounting Glossary — every term in plain words | SahakarLekha',
    description: 'From cash book to balance sheet — a plain Hindi and English glossary of the key terms in cooperative society accounting, each linked to the related guide, help and software.',
  },
  tools: {
    title: 'Cooperative Accounting Calculators — Free | SahakarLekha',
    description: 'Interest, EMI, depreciation, GST, TDS, share capital, cash difference, percentage and working capital — free, easy calculators for cooperative societies, with formulas and explanations.',
  },
  faq: {
    title: 'Frequently Asked Questions (FAQ) — SahakarLekha',
    description: 'Is it really free? Will auditors accept the reports? Is my data safe? How do I move from Tally? — answers to all common SahakarLekha questions, in Hindi and English.',
  },
  pricing: {
    title: 'SahakarLekha Pricing — Starter, Plus & Pro Plans',
    description: 'SahakarLekha cooperative accounting from ₹2,999/year + GST — 30-day free trial. All reports on every plan; Plus for staff, Payroll and the Member Portal; Pro for branches, unlimited users and data migration.',
  },
  about: {
    title: 'About Us — SahakarLekha | Cooperative Society Accounting Software',
    description: 'SahakarLekha is an accounting platform built for India\'s cooperative societies — our mission, vision and compliance (RCS, TDS, GST, NABARD). Learn about our mission to digitise cooperative society accounting across India.',
  },
  contact: {
    title: 'Contact Us — SahakarLekha cooperative accounting software support',
    description: 'Contact the SahakarLekha team for support, a demo, or to onboard your cooperative society.',
  },
  privacy: {
    title: 'Privacy Policy — SahakarLekha',
    description: 'What data SahakarLekha holds and how it protects your cooperative society data — society-level isolation and encryption.',
  },
  terms: {
    title: 'Terms & Conditions — SahakarLekha',
    description: 'Terms and conditions for using the SahakarLekha cooperative accounting platform.',
  },
  quickStart: {
    title: 'How to use SahakarLekha? — Complete User Guide | SahakarLekha',
    description: 'A simple STEP-BY-STEP guide for cooperative society clerks, accountants, managers and auditors — run the SahakarLekha software without any training.',
  },
  certificate: {
    title: 'Completion Certificate — SahakarLekha Guide',
    description: 'Earn a uniquely-numbered, verifiable completion certificate for the SahakarLekha complete accounting course.',
  },
  verify: {
    title: 'Certificate Verification — SahakarLekha Guide',
    description: 'Verify a SahakarLekha guide completion certificate by its number and holder name.',
  },
} as const satisfies Record<string, PageMetaEn>;
