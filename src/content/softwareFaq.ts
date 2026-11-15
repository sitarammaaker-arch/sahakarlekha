/**
 * Questions and answers for the /software/<type> pages.
 *
 * Two kinds, neither hand-written per society type:
 *  - derived: built from the app's own module list for that type (softwareModules) and the public plans
 *    (lib/plans), so a number or a module name on the page is whatever the product has today;
 *  - reused: answers taken word for word from the site FAQ (content/faq), so the two never disagree.
 * PURE — also loaded by scripts/prerender-guide.mjs.
 */
import { FAQ_CATEGORIES } from '@/content/faq';
import { PLAN_CATALOG, TRIAL_DAYS, priceLabel } from '@/lib/plans';
import { softwareModuleGroups } from '@/content/softwareModules';

export interface SoftwareFaqItem { qHi: string; qEn: string; aHi: string; aEn: string }

/** FAQ items reused as they are — matched by the start of the Hindi question. */
const REUSED = ['डेटा कहाँ स्टोर होता है?', 'मोबाइल पर चलता है?', 'Tally से डेटा कैसे लाएं?', 'डेटा एक्सपोर्ट कैसे लें?'];

const split = (q: string): { hi: string; en: string } => {
  const i = q.indexOf(' / ');
  return i === -1 ? { hi: q, en: q } : { hi: q.slice(0, i), en: q.slice(i + 3) };
};

const joinHi = (xs: string[]) => xs.join(', ');

export function softwareFaq(slug: string, nameHi: string, nameEn: string): SoftwareFaqItem[] {
  const groups = softwareModuleGroups(slug);
  if (groups.length === 0) return [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const reports = groups.find((g) => g.domain === 'reports')?.items ?? [];
  const shown = reports.slice(0, 8);
  const p = PLAN_CATALOG;

  const derived: SoftwareFaqItem[] = [
    {
      qHi: `${nameHi} के लिए SahakarLekha में क्या-क्या मिलता है?`,
      qEn: `What does SahakarLekha give a ${nameEn}?`,
      aHi: `समिति का प्रकार "${nameHi}" चुनने पर menu में ${total} module आते हैं: ${joinHi(groups.map((g) => `${g.hi} (${g.items.length})`))}। पूरी सूची इसी पृष्ठ पर ऊपर दी है।`,
      aEn: `When the society type is set to "${nameEn}", the menu shows ${total} modules: ${groups.map((g) => `${g.en} (${g.items.length})`).join(', ')}. The full list is on this page, above.`,
    },
    {
      qHi: `${nameHi} के लिए कौन-सी रिपोर्ट बनती हैं?`,
      qEn: `Which reports does a ${nameEn} get?`,
      aHi: `${joinHi(shown.map((r) => r.hi))}${reports.length > shown.length ? ` आदि — कुल ${reports.length} रिपोर्ट` : ''}। रिपोर्ट वाउचर से अपने-आप बनती हैं; अलग से कुछ भरना नहीं पड़ता।`,
      aEn: `${shown.map((r) => r.en).join(', ')}${reports.length > shown.length ? ` and more — ${reports.length} reports in all` : ''}. Reports are built from the vouchers by themselves; nothing has to be filled in separately.`,
    },
    {
      qHi: `क्या ${nameHi} के लिए दाम अलग है?`,
      qEn: `Is the price different for a ${nameEn}?`,
      aHi: `नहीं। दाम समिति के प्रकार पर नहीं, users की संख्या और कुछ सुविधाओं पर निर्भर है। रजिस्टर करने पर ${TRIAL_DAYS} दिन का मुफ़्त trial मिलता है; उसके बाद Starter ${priceLabel(p.starter.price)}/साल + GST, Plus ${priceLabel(p.plus.price)}/साल + GST (${p.plus.seatsLimit} users) और Pro ${priceLabel(p.pro.price)}/साल + GST (असीमित users)।`,
      aEn: `No. The price depends on the number of users and a few features, not on the society type. Registering gives a ${TRIAL_DAYS}-day free trial; after that Starter is ${priceLabel(p.starter.price)}/year + GST, Plus ${priceLabel(p.plus.price)}/year + GST (${p.plus.seatsLimit} users) and Pro ${priceLabel(p.pro.price)}/year + GST (unlimited users).`,
    },
  ];

  const all = FAQ_CATEGORIES.flatMap((c) => c.items);
  const reused: SoftwareFaqItem[] = REUSED.flatMap((start) => {
    const it = all.find((x) => x.q.startsWith(start));
    if (!it) return [];
    const q = split(it.q);
    return [{ qHi: q.hi, qEn: q.en, aHi: it.aHi, aEn: it.aEn }];
  });

  return [...derived, ...reused];
}

/** schema.org FAQPage for the page (Hindi — the language of the static page). */
export const softwareFaqLd = (items: SoftwareFaqItem[], lang: 'hi' | 'en' = 'hi') => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((it) => ({
    '@type': 'Question',
    name: lang === 'hi' ? it.qHi : it.qEn,
    acceptedAnswer: { '@type': 'Answer', text: lang === 'hi' ? it.aHi : it.aEn },
  })),
});
