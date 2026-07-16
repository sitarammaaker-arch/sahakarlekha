/**
 * TDS section references, resolved by DATE — the Income-tax Act 2025 renumbering.
 *
 * THE FACT THIS EXISTS FOR. Per the ITD's own portal, the **Income Tax Act, 2025** came
 * into force **1 April 2026** and *"the 1961 Act stands repealed"*; sections were
 * renumbered (819 → 536). `TdsSection` in types/index.ts is still a union of 1961
 * numbers — 192, 194C, 194Q — and every TDS register, 26Q export and certificate prints
 * them. Source: incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/objective-and-scope-new-act
 *
 * WHY THIS IS A LOOKUP AND NOT A RENAME — the single most important thing here.
 * `TdsEntry.section` and `Supplier.tdsSection` are PERSISTED columns; live rows already
 * hold '194C'. Renaming them would be wrong, not merely risky: the 2025 Act's own
 * transitional provisions keep the 1961 Act alive for earlier tax years, so an
 * FY 2024-25 26Q must still print **194C** while an FY 2026-27 one prints
 * **393(1) Table 6(i)**. A rename falsifies history and destroys reproducibility —
 * the exact property ADR-0008 exists to guarantee.
 *
 *     stored:  '194C'          (untouched, forever — it is the key, not the label)
 *                ↓ + the entry's own date
 *     shown:   2024 → "194C"
 *              2026 → "393(1) Table 6(i)"
 *
 * Same shape as rules/incomeTax.ts: store once, resolve by date, never mutate history.
 *
 * ⚠️ EVERY 2025 MAPPING IS `verified: false`. It is CA-confirmed but single-sourced;
 * only 26Q→Form 141 is independently corroborated (the ITD portal publishes "Form 141,
 * challan-cum-statement u/s 393(1)"). So callers get the old label plus an explicit
 * "unverified" flag, and must hedge rather than assert — the same discipline as
 * rules/tax.ts. A confidently wrong statutory reference on a government return is worse
 * than an obviously stale one.
 */
import type { TdsSection } from '@/types';

/** The Act a reference belongs to. Both are live: 1961 for earlier tax years. */
export type TaxAct = '1961' | '2025';

/** 1 April 2026 — the 2025 Act's commencement; the 1961 Act stands repealed. */
export const ACT_2025_FROM = '2026-04-01';

export interface SectionRef {
  act: TaxAct;
  /** What to print: "194C" under the 1961 Act, "393(1) Table 6(i)" under 2025. */
  label: string;
  /** Structured, because under the 2025 Act one section holds many provisions. */
  section: string;
  subSection?: string;
  table?: string;
  serial?: string;
  /** Plain description, unchanged across Acts — the payment is the same payment. */
  nature: string;
  /**
   * false ⇒ the mapping is recorded but unconfirmed by an independent source. The UI
   * must say so rather than present it as settled.
   */
  verified: boolean;
  /** What to read to check it. */
  cite: string;
}

const NATURE: Record<string, string> = {
  '192': 'Salary',
  '194A': 'Interest',
  '194C': 'Contractor',
  '194H': 'Commission / brokerage',
  '194I': 'Rent',
  '194J': 'Professional / technical',
  '194Q': 'Purchase of goods',
  '195': 'Payment to non-resident',
};

/**
 * 1961 section → its 2025 counterpart.
 *
 * CA-confirmed (docs/CA-VERIFICATION-2026-07.md, 2026-07-16) and NOT independently
 * corroborated — hence every entry is unverified. Note the structure the CA flagged and
 * which this module exists to honour: under the 2025 Act most TDS folds into ONE section
 * (393), distinguished by Table and Serial. "393" alone is not an answer.
 */
const MAP_2025: Record<string, Omit<SectionRef, 'act' | 'nature' | 'verified' | 'cite'>> = {
  '192':  { label: '392',                    section: '392' },
  '194A': { label: '393(1) Table 5 Sl.(ii)', section: '393', subSection: '1', table: '5', serial: 'ii' },
  '194C': { label: '393(1) Table 6 Sl.(i)',  section: '393', subSection: '1', table: '6', serial: 'i' },
  '194H': { label: '393(1) Table 1 Sl.(ii)', section: '393', subSection: '1', table: '1', serial: 'ii' },
  '194I': { label: '393(1) Table 2',         section: '393', subSection: '1', table: '2' },
  '194J': { label: '393(1) Table 6 Sl.(iii)', section: '393', subSection: '1', table: '6', serial: 'iii' },
  '194Q': { label: '393(1) Table 8 Sl.(ii)', section: '393', subSection: '1', table: '8', serial: 'ii' },
  '195':  { label: '393(2)',                 section: '393', subSection: '2' },
};

const CITE_2025 =
  'Income-tax Act 2025 (in force 1-4-2026; 1961 Act repealed). Mapping confirmed by the society\'s CA ' +
  'against docs/CA-VERIFICATION-2026-07.md on 2026-07-16 — NOT independently corroborated. VERIFY before filing.';

/**
 * PURE — which section reference applies to an entry dated `asOf`?
 *
 * `stored` is the 1961 key that lives in the database and never changes. Before
 * 1-4-2026 it is also the answer. On or after, it maps into the 2025 Act.
 *
 * An unmapped or malformed input falls back to the stored value under the 1961 Act
 * rather than throwing: a TDS register that crashes is worse than one showing the key it
 * has, and an unknown section is exactly the case where inventing an answer is worst.
 */
export function resolveSectionRef(stored: TdsSection | string, asOf: string): SectionRef {
  const key = String(stored || '').toUpperCase().replace(/^SEC(TION)?\s*/, '').trim();
  const nature = NATURE[key] || key;
  const old: SectionRef = {
    act: '1961',
    label: key,
    section: key,
    nature,
    verified: true, // the 1961 numbering is not in doubt; only its successor is
    cite: 'Income-tax Act 1961 — applies to tax years before 2026-27 (2025 Act transitional provisions)',
  };

  const t = Date.parse(asOf);
  if (Number.isNaN(t) || t < Date.parse(ACT_2025_FROM)) return old;

  const m = MAP_2025[key];
  if (!m) return old; // unknown section under the new Act → say what we have, invent nothing
  return { act: '2025', ...m, nature, verified: false, cite: CITE_2025 };
}

/** PURE — one honest line for a UI (RULE 7: Hindi-first). */
export function describeSectionRef(ref: SectionRef): string {
  if (ref.act === '1961') return `धारा ${ref.label} (अधिनियम 1961)`;
  return `धारा ${ref.label} (अधिनियम 2025) — ⚠️ सत्यापित नहीं, दाख़िल करने से पहले CA से पुष्टि करें`;
}

/** PURE — is this date governed by the 2025 Act? */
export function isAct2025(asOf: string): boolean {
  const t = Date.parse(asOf);
  return !Number.isNaN(t) && t >= Date.parse(ACT_2025_FROM);
}
