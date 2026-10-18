/**
 * Re-audit leftovers (2026-10-18): Excel / CSV headers on the member pages follow the page language (they were
 * English-only). PDFs keep English headers — the PDF font (helvetica, lib/pdf.ts setupFont) has no Devanagari.
 * PURE, no imports — scripts/test-member-leftovers.mjs.
 */
export interface BiLabel { hi: string; en: string }

export const pick = (cols: readonly BiLabel[], hi: boolean): string[] => cols.map(c => (hi ? c.hi : c.en));

/** Members page → Excel (U6). */
export const MEMBER_EXPORT_COLUMNS: readonly BiLabel[] = [
  { hi: 'क्र.सं.', en: 'S.No' },
  { hi: 'सदस्य सं.', en: 'Member No.' },
  { hi: 'नाम', en: 'Name' },
  { hi: 'पिता/पति', en: 'Father/Husband' },
  { hi: 'लिंग', en: 'Gender' },
  { hi: 'जन्म तिथि', en: 'Date of Birth' },
  { hi: 'व्यवसाय', en: 'Occupation' },
  { hi: 'वर्ग', en: 'Category' },
  { hi: 'पता', en: 'Address' },
  { hi: 'फ़ोन', en: 'Phone' },
  { hi: 'प्रकार', en: 'Type' },
  { hi: 'प्रवेश तिथि', en: 'Admission Date' },
  { hi: 'स्थिति', en: 'Status' },
  { hi: 'सदस्यता समाप्त', en: 'Ceased On' },
  { hi: 'शेयर', en: 'Shares' },
  { hi: 'शेयर पूँजी', en: 'Share Capital' },
  { hi: 'नामिती', en: 'Nominee' },
];

/** Nomination Register → CSV / Excel. */
export const NOMINATION_EXPORT_COLUMNS: readonly BiLabel[] = [
  { hi: 'सदस्य आईडी', en: 'Member ID' },
  { hi: 'सदस्य नाम', en: 'Member Name' },
  { hi: 'फ़ोन', en: 'Phone' },
  { hi: 'शेयर पूँजी', en: 'Share Capital' },
  { hi: 'नामिती नाम', en: 'Nominee Name' },
  { hi: 'संबंध', en: 'Relation' },
  { hi: 'नामिती फ़ोन', en: 'Nominee Phone' },
  { hi: 'स्थिति', en: 'Status' },
];

/** Election module → CSV / Excel. */
export const ELECTION_EXPORT_COLUMNS: readonly BiLabel[] = [
  { hi: 'सं.', en: 'No.' },
  { hi: 'चुनाव', en: 'Title' },
  { hi: 'पद', en: 'Post' },
  { hi: 'तिथि', en: 'Date' },
  { hi: 'उम्मीदवार', en: 'Candidates' },
  { hi: 'विजेता', en: 'Winner' },
  { hi: 'स्थिति', en: 'Status' },
];

export const GENDER_LABEL: Record<string, BiLabel> = {
  male: { hi: 'पुरुष', en: 'Male' },
  female: { hi: 'महिला', en: 'Female' },
  other: { hi: 'अन्य', en: 'Other' },
};
