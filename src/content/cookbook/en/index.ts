/**
 * English cookbook content, laid over the Hindi entries by slug. A slug missing here renders in Hindi with the
 * HindiOnlyNotice.
 */
import type { CookbookEntry } from '../index';
import type { CookbookEntryEn } from './types';
import { COOKBOOK_EN_PART1 } from './part1';
import { COOKBOOK_EN_PART2 } from './part2';

export type { CookbookEntryEn };

export const COOKBOOK_EN: Record<string, CookbookEntryEn> = { ...COOKBOOK_EN_PART1, ...COOKBOOK_EN_PART2 };

/** English names for the Hindi category chips (the hub still groups by the Hindi key). */
export const COOKBOOK_CATEGORY_EN: Record<string, string> = {
  'खरीद-बिक्री': 'Purchase & sale',
  'सदस्य व शेयर': 'Members & shares',
  'लोन व ब्याज': 'Loans & interest',
  'वेतन': 'Salary',
  'बैंक': 'Bank',
  'साल-अंत': 'Year-end',
  'HAFED / MSP': 'HAFED / MSP',
  'भुगतान व वसूली': 'Payments & recoveries',
  'संपत्ति': 'Assets',
  'खर्च': 'Expenses',
  'अनुपालन (Compliance)': 'Compliance',
  'समिति-प्रकार': 'Society types',
  'अनुदान व अन्य आय': 'Grants & other income',
  'व्यय': 'Expenditure',
};

export function cookbookCategoryLabel(category: string, lang: 'hi' | 'en'): string {
  return lang === 'en' ? COOKBOOK_CATEGORY_EN[category] ?? category : category;
}

export type LocalizedCookbookEntry = CookbookEntry & { translated: boolean };

/** The entry in the reader's language; Dr/Cr sides, amounts, routes and links always come from the Hindi entry. */
export function localizeCookbookEntry(entry: CookbookEntry, lang: 'hi' | 'en'): LocalizedCookbookEntry {
  const en = lang === 'en' ? COOKBOOK_EN[entry.slug] : undefined;
  if (!en) return { ...entry, translated: lang === 'hi' };
  return {
    ...entry,
    metaTitle: en.metaTitle,
    metaDescription: en.metaDescription,
    category: cookbookCategoryLabel(entry.category, 'en'),
    title: en.title,
    scenario: en.scenario,
    lines: entry.lines.map((l, i) => ({ ...l, account: en.lines[i]?.account ?? l.account, note: l.note != null ? en.lines[i]?.note ?? l.note : undefined })),
    narration: en.narration,
    notes: en.notes ?? entry.notes,
    deepLink: entry.deepLink ? { ...entry.deepLink, label: en.deepLinkLabel ?? entry.deepLink.label } : undefined,
    example: entry.example && en.example
      ? { text: en.example.text, rows: entry.example.rows.map((r, i) => ({ ...r, account: en.example!.rows[i] ?? r.account })) }
      : entry.example,
    useWhen: en.useWhen ?? entry.useWhen,
    avoidWhen: en.avoidWhen ?? entry.avoidWhen,
    correction: en.correction ?? entry.correction,
    inApp: en.inApp ?? entry.inApp,
    translated: true,
  };
}
