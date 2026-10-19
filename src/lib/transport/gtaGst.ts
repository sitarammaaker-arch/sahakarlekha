/**
 * GST on a Goods Transport Agency (GTA) trip — the society as the GTA (it transports goods by road and issues a
 * consignment note). PURE. Every rate and condition below is read from the notification TEXT (gazette PDFs on
 * cbic-gst.gov.in), not from a summary — see GTA_GST_SOURCES. Nothing here decides an exemption: a trip the
 * society believes is exempt stays on mode 'none'.
 *
 * Modes (one per trip, chosen by the user):
 *   none  — no GST on this invoice (current behaviour; e.g. the society is not registered / an exempt supply).
 *   rcm   — reverse charge: the RECIPIENT pays (13/2017-CT(R) Sl.1). The society charges no GST; the invoice says
 *           so. Recipient's tax is 5% (11/2017 Sl.9(iii)(a): CGST 2.5% + SGST 2.5%, or IGST 5%) — shown, not posted.
 *   fcm5  — forward charge at 5% without ITC (Sl.9(iii)(b), 2.5% CGST): society pays; needs the Annexure V option.
 *   fcm18 — forward charge at 18% with ITC (Sl.9(iii)(b), CGST 9% from 22.09.2025 — earlier 6% = 12%).
 */

export type GtaGstMode = 'none' | 'rcm' | 'fcm5' | 'fcm18';

export const GTA_GST_SOURCES = [
  { ref: 'Notification 11/2017-Central Tax (Rate), Sl. 9(iii), as substituted by 03/2022-CT(R) dated 13.07.2022 (w.e.f. 18.07.2022)', url: 'https://cbic-gst.gov.in/pdf/central-tax-rate/03_2022-ctr-eng.pdf', says: '(a) GTA not opting to pay GST itself: CGST 2.5%, no ITC; (b) GTA opting (Annexure V): CGST 2.5% without ITC, or 6% with ITC' },
  { ref: 'Notification 15/2025-Central Tax (Rate) dated 17.09.2025 (w.e.f. 22.09.2025)', url: 'https://accounts.iith.ac.in/pdf/GST/15-2025-CTR-eng1758171762.pdf' /* gazette copy (CBIC file name); the text was read from it */, says: 'Sl. 9(iii) sub-item (b): "6" → "9" (with-ITC option becomes 18%); GTA definition excludes e-commerce local delivery' },
  { ref: 'Notification 06/2023-Central Tax (Rate) (state copy: Goa 06/2023-Rate)', url: 'https://statetax.goa.gov.in/PDF/state_notif/Rate/06_(06_3711-2023)_2023(rate).pdf', says: 'forward-charge option, once exercised, continues for future years unless Annexure VI is filed 1 Jan – 31 Mar of the preceding FY' },
  { ref: 'Notification 13/2017-Central Tax (Rate), Sl. 1 (reverse charge)', url: 'https://gstcouncil.gov.in/sites/default/files/2024-05/download_8_0.pdf', says: 'recipient pays when it is a factory, a society, a co-operative society, a GST-registered person, a body corporate, a partnership firm / AOP, or a casual taxable person' },
  { ref: 'Notification 05/2022-Central Tax (Rate) dated 13.07.2022 (w.e.f. 18.07.2022)', url: 'https://cbic-gst.gov.in/pdf/central-tax-rate/05_2022-ctr-eng.pdf', says: 'RCM entry does not apply where the registered GTA opted for forward charge and its tax invoice carries the Annexure III declaration' },
] as const;

/** The declaration 05/2022 (Annexure III to 13/2017) requires on a forward-charge GTA invoice. */
export const ANNEXURE_III_DECLARATION = (fy: string) =>
  `I/we have taken registration under the CGST Act, 2017 and have exercised the option to pay tax on services of GTA in relation to transport of goods supplied by us during the Financial Year ${fy} under forward charge.`;

/** Recipient categories of 13/2017-CT(R) Sl.1 col.(4) — shown to the user when choosing RCM. */
export const RCM_RECIPIENT_CATEGORIES_HI = [
  'कारख़ाना (Factories Act, 1948)',
  'सोसाइटी (Societies Registration Act, 1860 या अन्य क़ानून)',
  'सहकारी समिति',
  'GST में पंजीकृत व्यक्ति',
  'कंपनी / body corporate',
  'साझेदारी फ़र्म / AOP',
  'casual taxable person',
] as const;

const FCM_FROM = '2022-07-18';   // 03/2022 + 05/2022 in force
const RATE18_FROM = '2025-09-22'; // 15/2025

/** CGST % (== SGST %; IGST = 2×) for a mode on a date; null when the mode has no sourced rate on that date. */
export function gtaCgstPct(mode: GtaGstMode, date: string): number | null {
  if (mode === 'none') return 0;
  if (date < FCM_FROM) return null;                 // pre-July-2022 regime is not modelled
  if (mode === 'rcm' || mode === 'fcm5') return 2.5;
  return date >= RATE18_FROM ? 9 : 6;               // fcm18 (12% before 22.09.2025)
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface GtaTax { cgst: number; sgst: number; igst: number; total: number; ratePct: number }

/** Tax on a taxable value. Intra-state → CGST + SGST; inter-state → IGST. */
export function gtaTax(mode: GtaGstMode, date: string, taxable: number, interState: boolean): GtaTax | null {
  const c = gtaCgstPct(mode, date);
  if (c === null) return null;
  const t = Number(taxable) || 0;
  if (interState) { const igst = r2(t * (2 * c) / 100); return { cgst: 0, sgst: 0, igst, total: igst, ratePct: 2 * c }; }
  const cgst = r2(t * c / 100);
  return { cgst, sgst: cgst, igst: 0, total: r2(cgst * 2), ratePct: 2 * c };
}

/** Why this mode cannot be used for this trip (Hindi first, RULE 7), or null. */
export function gtaModeProblem(input: {
  mode: GtaGstMode; date: string; societyGstin?: string; societyStateCode: string;
  customerHasGstin: boolean; rcmRecipientConfirmed?: boolean; forwardOptionConfirmed?: boolean;
}): string | null {
  const { mode } = input;
  if (mode === 'none') return null;
  if (input.date < FCM_FROM) return 'यह GST विकल्प 18.07.2022 से पहले की तारीख़ पर लागू नहीं किया जा सकता।';
  if (mode === 'rcm') {
    return input.customerHasGstin || input.rcmRecipientConfirmed
      ? null
      : 'Reverse charge तभी लगता है जब ग्राहक अधिसूचना 13/2017 की सूची में हो (कारख़ाना, सोसाइटी, सहकारी समिति, GST-पंजीकृत, कंपनी, फ़र्म …) — ग्राहक का GSTIN भरें या पुष्टि करें।';
  }
  if (!(input.societyGstin || '').trim()) return 'Forward charge के लिए समिति का GST पंजीकरण (GSTIN) ज़रूरी है — Society Setup में GSTIN भरें।';
  if (!input.societyStateCode) return 'समिति का राज्य/GSTIN नहीं मिला — CGST/SGST या IGST तय नहीं हो सकता। Society Setup में भरें।';
  if (!input.forwardOptionConfirmed) return 'Forward charge तभी, जब समिति ने इस वित्त वर्ष के लिए Annexure V से विकल्प चुना हो — पुष्टि का बॉक्स टिक करें।';
  return null;
}

/** One-line note for the voucher narration / invoice. */
export function gtaNarration(mode: GtaGstMode, tax: GtaTax | null, fy: string): string {
  if (mode === 'none' || !tax) return '';
  const split = tax.igst ? `IGST ${tax.ratePct}% ₹${tax.igst}` : `CGST ${tax.ratePct / 2}% ₹${tax.cgst} + SGST ${tax.ratePct / 2}% ₹${tax.sgst}`;
  if (mode === 'rcm') return `GST reverse charge — प्राप्तकर्ता देय (${split}), अधि. 13/2017-CT(R) क्र.1`;
  return `GST forward charge ${tax.ratePct}% — ${split}. ${ANNEXURE_III_DECLARATION(fy)}`;
}
