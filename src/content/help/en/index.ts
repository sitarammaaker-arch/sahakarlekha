/**
 * English help content, laid over the Hindi tasks by slug. A slug missing here simply renders in Hindi with the
 * HindiOnlyNotice — so translation can land a few tasks at a time.
 */
import type { HelpTask } from '../index';
import type { HelpTaskEn } from './types';
import { HELP_EN_PART1 } from './part1';
import { HELP_EN_PART2 } from './part2';

export type { HelpTaskEn };

export const HELP_EN: Record<string, HelpTaskEn> = { ...HELP_EN_PART1, ...HELP_EN_PART2 };

/** English names for the Hindi category chips (the hub still groups by the Hindi key). */
export const HELP_CATEGORY_EN: Record<string, string> = {
  'सदस्य व शेयर': 'Members & shares',
  'शुरुआत': 'Getting started',
  'वाउचर एंट्री': 'Voucher entry',
  'खाता-बही': 'Ledgers',
  'रिपोर्ट्स': 'Reports',
  'बैंक': 'Bank',
  'लोन': 'Loans',
  'सेटिंग्स': 'Settings',
  'ऑडिट': 'Audit',
  'खरीद-बिक्री': 'Purchase & sale',
  'लेन-देन': 'Receipts & payments',
  'वेतन': 'Salary',
  'GST व TDS': 'GST & TDS',
  'इन्वेंटरी': 'Inventory',
  'वर्ष-अंत': 'Year-end',
};

export function helpCategoryLabel(category: string, lang: 'hi' | 'en'): string {
  return lang === 'en' ? HELP_CATEGORY_EN[category] ?? category : category;
}

export type LocalizedHelpTask = HelpTask & { translated: boolean };

/**
 * The task in the reader's language. Hindi → unchanged. English → the overlay merged in (slugs, routes, related,
 * guide links all stay from the Hindi task); with no overlay the Hindi task comes back with translated=false.
 */
export function localizeHelpTask(task: HelpTask, lang: 'hi' | 'en'): LocalizedHelpTask {
  const en = lang === 'en' ? HELP_EN[task.slug] : undefined;
  if (!en) return { ...task, translated: lang === 'hi' };
  return {
    ...task,
    metaTitle: en.metaTitle,
    metaDescription: en.metaDescription,
    category: helpCategoryLabel(task.category, 'en'),
    title: en.title,
    estTime: en.estTime,
    tldr: en.tldr,
    prerequisites: task.prerequisites?.map((p, i) => ({ ...p, label: en.prerequisites?.[i] ?? p.label })),
    steps: en.steps,
    commonMistakes: en.commonMistakes ?? task.commonMistakes,
    faqs: en.faqs ?? task.faqs,
    troubleshooting: en.troubleshooting ?? task.troubleshooting,
    deepLink: { ...task.deepLink, label: en.deepLinkLabel },
    translated: true,
  };
}
