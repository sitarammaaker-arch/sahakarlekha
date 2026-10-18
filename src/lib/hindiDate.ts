/**
 * ISO date → readable Hindi date, e.g. "2026-06-30" → "30 जून 2026". Pure (no imports), so the
 * blog pages AND scripts/prerender-guide.mjs print dates the same way.
 */
const HI_MONTHS = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'];

export function formatHindiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${HI_MONTHS[m - 1]} ${y}`;
}
