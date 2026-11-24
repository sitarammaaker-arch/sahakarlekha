// Physical stock verification (भौतिक स्टॉक सत्यापन) — HAFED Accounts Manual 1976, para 10.20, Annexure XV/1.
// The manager counts the stock every fortnight and certifies it. A count is compared with the book figure — the SAME
// figure the Inventory page shows (RULE 2: reconciled movements; per godown through godownStock) — and every
// difference becomes an ordinary stock adjustment with its reason (lib/godownShortage).
//
// Pure: no React, no Supabase.
import type { StockItem, StockMovement, StockVerification, StockVerificationLine, StockAdjustmentReason } from '@/types';
import { computeStockMap, computeStockCostRate } from '@/lib/stockUtils';
import { computeGodownStock, godownMovementsWithOpening } from '@/lib/godownStock';
import { validateAdjustment, shortageAmount } from '@/lib/godownShortage';

export const VERIFY_EVERY_DAYS = 15;   // "every fortnight" (Annexure XV/1)
export const ALL_STOCK = '';           // the godownId of a count of the whole society (no godowns kept)

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The book side of a count sheet: every active item, and any inactive one that still has stock. */
export function buildCountSheet(input: {
  items: readonly StockItem[];
  reconciled: readonly StockMovement[];
  godownId?: string;   // '' / undefined = whole society
  hi?: boolean;
}): Array<Pick<StockVerificationLine, 'itemId' | 'itemName' | 'unit' | 'bookQty' | 'rate'>> {
  const { items, reconciled, godownId, hi } = input;
  let book: Record<string, number>;
  if (godownId) {
    const rows = computeGodownStock(godownMovementsWithOpening(items, reconciled as StockMovement[]));
    book = {};
    for (const r of rows) if (r.godownId === godownId) book[r.itemId] = r.qty;
  } else {
    book = computeStockMap(items as StockItem[], reconciled as StockMovement[]);
  }
  return items
    .filter(i => i.isActive !== false || (book[i.id] || 0) > 0)
    .map(i => ({
      itemId: i.id,
      itemName: hi && i.nameHi ? i.nameHi : i.name,
      unit: i.unit || '',
      bookQty: r3(book[i.id] || 0),
      rate: Math.round(computeStockCostRate(i, reconciled as StockMovement[]) * 100) / 100,
    }))
    .sort((a, b) => (b.bookQty > 0 ? 1 : 0) - (a.bookQty > 0 ? 1 : 0) || a.itemName.localeCompare(b.itemName));
}

/** A counted line: the difference and its value. */
export function countLine(
  base: Pick<StockVerificationLine, 'itemId' | 'itemName' | 'unit' | 'bookQty' | 'rate'>,
  physicalQty: number, reason?: StockAdjustmentReason, person?: string,
): StockVerificationLine {
  const diff = r3(physicalQty - base.bookQty);
  return { ...base, physicalQty: r3(physicalQty), diff, value: shortageAmount(diff, base.rate), reason: diff ? reason : undefined, person: diff && reason === 'shortageRecoverable' ? person : undefined };
}

/** Errors that stop the save (empty = may be saved). Only lines that were counted and differ need a reason. */
export function validateCount(input: { verifiedBy: string; date: string; lines: readonly StockVerificationLine[] }, hi: boolean): string[] {
  const errs: string[] = [];
  if (!input.verifiedBy.trim()) errs.push(hi ? 'सत्यापन करने वाले का नाम दें' : 'Name the person who verified');
  if (!input.date) errs.push(hi ? 'तारीख़ दें' : 'Give the date');
  if (!input.lines.length) errs.push(hi ? 'कम से कम एक वस्तु गिनें' : 'Count at least one item');
  for (const l of input.lines) {
    if (!Number.isFinite(l.physicalQty) || l.physicalQty < 0) { errs.push(`${l.itemName}: ${hi ? 'गिनी मात्रा शून्य या उससे ज़्यादा हो' : 'counted quantity must be zero or more'}`); continue; }
    if (!l.diff) continue;
    const e = validateAdjustment({ qty: l.diff, reason: l.reason, person: l.person, rate: l.rate }, hi);
    if (e) errs.push(`${l.itemName}: ${e}`);
  }
  return errs;
}

export const nextVerificationNo = (existing: readonly Pick<StockVerification, 'verificationNo'>[]): string => {
  const max = existing.reduce((m, v) => Math.max(m, Number((v.verificationNo || '').replace(/^PV\//, '')) || 0), 0);
  return `PV/${max + 1}`;
};

/** `place` is the godown's name; leave it out for a count of the society's whole stock. */
export function certificateText(input: { verifiedBy: string; designation?: string; date: string; place?: string; differences: number }, hi: boolean): string {
  const who = input.designation ? `${input.verifiedBy} (${input.designation})` : input.verifiedBy;
  const named = input.place && /गोदाम|godown|warehouse/i.test(input.place);   // "मुख्य गोदाम" — don't say "गोदाम" twice
  const whatHi = input.place ? `${input.place}${named ? '' : ' गोदाम'} के स्टॉक` : 'समिति के पूरे स्टॉक';
  const whatEn = input.place ? `the stock of ${named ? input.place : `the ${input.place} godown`}` : "the society's whole stock";
  return hi
    ? `प्रमाणित किया जाता है कि मैंने ${input.date} को ${whatHi} का भौतिक सत्यापन स्वयं किया। गिनी गई मात्राएँ ऊपर दर्ज हैं; ${input.differences ? `${input.differences} वस्तुओं में अंतर मिला, जिनका कारण साथ लिखा है` : 'किताब और भौतिक स्टॉक में कोई अंतर नहीं मिला'}। — ${who}`
    : `Certified that I physically verified ${whatEn} on ${input.date}. The quantities counted are recorded above; ${input.differences ? `${input.differences} item(s) differed, each with its reason stated` : 'the book and the physical stock agree'}. — ${who}`;
}

/** Status after posting: complete only when every difference was saved. */
export const statusAfterPosting = (lines: readonly StockVerificationLine[]): StockVerification['status'] =>
  lines.every(l => !l.diff || l.posted) ? 'complete' : 'partial';

/** Places (godowns, or the whole society) whose last count is older than the fortnight, or that were never counted. */
export function overdueCounts(input: {
  verifications: readonly Pick<StockVerification, 'date' | 'godownId'>[];
  places: readonly { id: string; name: string }[];   // pass [{ id: ALL_STOCK, name }] when no godowns are kept
  today: string;
  days?: number;
}): Array<{ id: string; name: string; lastDate: string | null; daysSince: number | null }> {
  const days = input.days ?? VERIFY_EVERY_DAYS;
  const t = Date.parse(input.today);
  return input.places
    .map(p => {
      const last = input.verifications.filter(v => (v.godownId || ALL_STOCK) === p.id).map(v => v.date).sort().pop() ?? null;
      const daysSince = last ? Math.floor((t - Date.parse(last)) / 86_400_000) : null;
      return { id: p.id, name: p.name, lastDate: last, daysSince };
    })
    .filter(p => p.daysSince === null || p.daysSince > days);
}

export function countTotals(lines: readonly StockVerificationLine[]) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    counted: lines.length,
    differing: lines.filter(l => l.diff).length,
    shortValue: r2(lines.filter(l => l.diff < 0).reduce((s, l) => s + l.value, 0)),
    excessValue: r2(lines.filter(l => l.diff > 0).reduce((s, l) => s + l.value, 0)),
  };
}
