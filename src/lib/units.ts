/**
 * Units of measure = the GST Unit Quantity Codes (UQC) (2026-10-10).
 *
 * GSTR-1's HSN summary and the e-invoice / e-way bill accept ONLY these codes ("KGS", "QTL", "LTR", …); the app
 * offered 6 free-text keys ("kg", "quintal", …) and sent them to the GST summary as the UQC, which the portal refuses.
 *
 * SOURCE (read 2026-10-10, the founder supplied the link): the GSTN-authorised e-Invoice Registration Portal IRP 6
 * (IRIS Business Services for GSTN), "UQC Codes" master — https://einvoice6.gst.gov.in/masters-code — page footer
 * "Last Update date : 01-07-2024". All 46 codes below are copied from that table (code + its description); the
 * Hindi names are ours. There is no code for feet — anything unlisted maps to OTH.
 * PURE.
 */
export const UQC_SOURCE = {
  url: 'https://einvoice6.gst.gov.in/masters-code',
  read: '2026-10-10',
  note: 'IRP 6 (GSTN-authorised) — UQC Codes master, last updated 01-07-2024',
} as const;

export interface UnitDef { code: string; en: string; hi: string }

/** The 46 GST UQC codes, exactly as the IRP master lists them (description in `en`). */
export const UQC_LIST: readonly UnitDef[] = [
  { code: 'BAG', en: 'Bags', hi: 'बोरी / बैग' },
  { code: 'BAL', en: 'Bale', hi: 'गाँठ' },
  { code: 'BDL', en: 'Bundles', hi: 'बंडल' },
  { code: 'BKL', en: 'Buckles', hi: 'बकल' },
  { code: 'BOU', en: 'Billion of units', hi: 'अरब इकाई' },
  { code: 'BOX', en: 'Box', hi: 'डिब्बा' },
  { code: 'BTL', en: 'Bottles', hi: 'बोतल' },
  { code: 'BUN', en: 'Bunches', hi: 'गुच्छा' },
  { code: 'CAN', en: 'Cans', hi: 'कैन / पीपा' },
  { code: 'CBM', en: 'Cubic meters', hi: 'घन मीटर' },
  { code: 'CCM', en: 'Cubic centimeters', hi: 'घन सेंटीमीटर' },
  { code: 'CMS', en: 'Centimeters', hi: 'सेंटीमीटर' },
  { code: 'CTN', en: 'Cartons', hi: 'कार्टन' },
  { code: 'DOZ', en: 'Dozens', hi: 'दर्जन' },
  { code: 'DRM', en: 'Drums', hi: 'ड्रम' },
  { code: 'GGK', en: 'Great gross', hi: 'ग्रेट ग्रॉस' },
  { code: 'GMS', en: 'Grammes', hi: 'ग्राम' },
  { code: 'GRS', en: 'Gross', hi: 'ग्रॉस (144)' },
  { code: 'GYD', en: 'Gross yards', hi: 'ग्रॉस गज़' },
  { code: 'KGS', en: 'Kilograms', hi: 'किलोग्राम' },
  { code: 'KLR', en: 'Kilolitre', hi: 'किलोलीटर' },
  { code: 'KME', en: 'Kilometre', hi: 'किलोमीटर' },
  { code: 'LTR', en: 'Litres', hi: 'लीटर' },
  { code: 'MLS', en: 'Milli litres', hi: 'मिलीलीटर (MLS)' },
  { code: 'MLT', en: 'Mililitre', hi: 'मिलीलीटर' },
  { code: 'MTR', en: 'Meters', hi: 'मीटर' },
  { code: 'MTS', en: 'Metric ton', hi: 'मीट्रिक टन' },
  { code: 'NOS', en: 'Numbers', hi: 'संख्या (नग)' },
  { code: 'OTH', en: 'Others', hi: 'अन्य' },
  { code: 'PAC', en: 'Packs', hi: 'पैकेट' },
  { code: 'PCS', en: 'Pieces', hi: 'पीस' },
  { code: 'PRS', en: 'Pairs', hi: 'जोड़ी' },
  { code: 'QTL', en: 'Quintal', hi: 'क्विंटल' },
  { code: 'ROL', en: 'Rolls', hi: 'रोल' },
  { code: 'SET', en: 'Sets', hi: 'सेट' },
  { code: 'SQF', en: 'Square feet', hi: 'वर्ग फुट' },
  { code: 'SQM', en: 'Square meters', hi: 'वर्ग मीटर' },
  { code: 'SQY', en: 'Square yards', hi: 'वर्ग गज़' },
  { code: 'TBS', en: 'Tablets', hi: 'टैबलेट' },
  { code: 'TGM', en: 'Ten gross', hi: 'दस ग्रॉस' },
  { code: 'THD', en: 'Thousands', hi: 'हज़ार' },
  { code: 'TON', en: 'Tonnes', hi: 'टन' },
  { code: 'TUB', en: 'Tubes', hi: 'ट्यूब' },
  { code: 'UGS', en: 'US gallons', hi: 'US गैलन' },
  { code: 'UNT', en: 'Units', hi: 'इकाई (यूनिट)' },
  { code: 'YDS', en: 'Yards', hi: 'गज़' },
];

/** The units a cooperative uses most — shown first in the pickers (the rest under "सभी GST units"). */
export const COMMON_UQC: readonly string[] = ['KGS', 'QTL', 'MTS', 'GMS', 'LTR', 'MLT', 'NOS', 'PCS', 'BAG', 'BOX', 'BTL', 'CAN', 'PAC', 'CTN', 'DOZ', 'BDL', 'MTR', 'SQF', 'OTH'];

const BY_CODE = new Map(UQC_LIST.map((u) => [u.code, u]));

/** The old free-text keys / imported spellings → their UQC (the stored value is not rewritten). */
const ALIASES: Record<string, string> = {
  kg: 'KGS', kgs: 'KGS', kilo: 'KGS', kilogram: 'KGS', kilograms: 'KGS', 'किलो': 'KGS',
  quintal: 'QTL', qtl: 'QTL', 'qtl.': 'QTL', 'क्विंटल': 'QTL',
  mt: 'MTS', 'm.t': 'MTS', 'm.t.': 'MTS', 'metric ton': 'MTS', tonne: 'TON', tonnes: 'TON', ton: 'TON',
  g: 'GMS', gm: 'GMS', gram: 'GMS', grams: 'GMS',
  l: 'LTR', liter: 'LTR', litre: 'LTR', liters: 'LTR', litres: 'LTR', ltr: 'LTR', 'लीटर': 'LTR',
  ml: 'MLT', millilitre: 'MLT', milliliter: 'MLT',
  piece: 'PCS', pieces: 'PCS', pc: 'PCS', pcs: 'PCS', nos: 'NOS', no: 'NOS', number: 'NOS', 'नग': 'NOS',
  bag: 'BAG', bags: 'BAG', 'बोरी': 'BAG',
  box: 'BOX', bottle: 'BTL', bottles: 'BTL', can: 'CAN', packet: 'PAC', pack: 'PAC', carton: 'CTN',
  dozen: 'DOZ', bundle: 'BDL', meter: 'MTR', metre: 'MTR', m: 'MTR', set: 'SET', pair: 'PRS', roll: 'ROL',
  other: 'OTH', others: 'OTH', 'अन्य': 'OTH',
};

/** The GST UQC for a stored unit ('KGS', the old 'kg', an import's 'M.T', …). Anything unknown → 'OTH'. */
export function toUqc(unit: string | null | undefined): string {
  const raw = (unit ?? '').trim();
  if (!raw) return 'OTH';
  const up = raw.toUpperCase();
  if (BY_CODE.has(up)) return up;
  return ALIASES[raw.toLowerCase()] ?? 'OTH';
}

/** Whether a stored unit is recognised (a UQC or a known alias) — an unknown one keeps its own text on screen. */
export const isKnownUnit = (unit: string | null | undefined): boolean => {
  const raw = (unit ?? '').trim();
  return !!raw && (BY_CODE.has(raw.toUpperCase()) || raw.toLowerCase() in ALIASES);
};

/** Display name for a stored unit: the UQC's Hindi / English name, or the raw text when it is not recognised. */
export function unitLabel(unit: string | null | undefined, hi: boolean): string {
  if (!isKnownUnit(unit)) return (unit ?? '').trim() || (hi ? 'अन्य' : 'Others');
  const def = BY_CODE.get(toUqc(unit))!;
  return hi ? `${def.hi} (${def.code})` : `${def.en} (${def.code})`;
}

/** Picker groups: the common units first, then every other GST unit. */
export function unitOptions(): { common: UnitDef[]; rest: UnitDef[] } {
  const common = COMMON_UQC.map((c) => BY_CODE.get(c)!).filter(Boolean);
  const rest = UQC_LIST.filter((u) => !COMMON_UQC.includes(u.code));
  return { common, rest };
}
