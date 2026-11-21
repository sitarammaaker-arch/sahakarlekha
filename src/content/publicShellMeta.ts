/**
 * SEO-03 (product audit 2026-11-17): /register — the most-linked URL on the site — and /partner, /search and /ask had
 * no static HTML, so a crawler without JavaScript got the HOMEPAGE (its title, its canonical "/"). The build-time
 * prerender (scripts/prerender-guide.mjs) now writes each one its own head and a short honest body from THIS module,
 * and the pages read their title / description from it too — one source, so the two can never disagree.
 * Figures come from lib/plans (the same constants as the pricing page). Hindi first (RULE 7).
 */
import { PLAN_CATALOG, TRIAL_DAYS, priceLabel } from '@/lib/plans';

export interface ShellMeta { title: string; description: string; h1: string }

const starter = priceLabel(PLAN_CATALOG.starter.price);

export const PUBLIC_SHELL_META: Record<'register' | 'partner' | 'search' | 'ask', { hi: ShellMeta; en: ShellMeta }> = {
  register: {
    hi: {
      title: `नई समिति पंजीकरण — ${TRIAL_DAYS} दिन मुफ़्त | SahakarLekha`,
      description: `अपनी सहकारी समिति का पंजीकरण करें और लेखा प्रणाली का उपयोग शुरू करें — ${TRIAL_DAYS} दिन का मुफ़्त trial, रजिस्टर करते समय कोई भुगतान नहीं। आगे plan ${starter}/साल + GST से।`,
      h1: 'नई समिति पंजीकरण',
    },
    en: {
      title: `New Society Registration — ${TRIAL_DAYS}-day free trial | SahakarLekha`,
      description: `Register your cooperative society and start using the accounting system — a ${TRIAL_DAYS}-day free trial, nothing to pay when you register. Plans afterwards start at ${starter}/year + GST.`,
      h1: 'New Society Registration',
    },
  },
  partner: {
    hi: {
      title: 'Partner बनें — SahakarLekha referral program',
      description: 'सहकारी समितियों को SahakarLekha से जोड़िए। Partner बनने पर आपको अपना referral code और link मिलेगा, जिससे आपके द्वारा जुड़ी हर समिति का रिकॉर्ड रहेगा।',
      h1: 'Partner बनें',
    },
    en: {
      title: 'Become a Partner — SahakarLekha referral program',
      description: 'Bring cooperative societies to SahakarLekha. As a partner you get your own referral code and link, and every society that joins through you is recorded in your name.',
      h1: 'Become a Partner',
    },
  },
  search: {
    hi: {
      title: 'खोजें — SahakarLekha मदद, कुकबुक, गाइड, ब्लॉग व शब्दकोश',
      description: 'सहकारी समिति लेखांकन से जुड़ा कुछ भी खोजें — मदद लेख, एंट्री कुकबुक, गाइड अध्याय, ब्लॉग और शब्दकोश, एक साथ।',
      h1: 'खोजें',
    },
    en: {
      title: 'Search — SahakarLekha help, cookbook, guide, blog and glossary',
      description: 'Search anything about cooperative society accounting — help articles, entry cookbook, guide chapters, blog and glossary, all at once.',
      h1: 'Search',
    },
  },
  ask: {
    hi: {
      title: 'पूछें (Ask SahakarLekha) — सहकारी समिति लेखांकन सहायक',
      description: 'सहकारी समिति लेखांकन का कोई भी सवाल पूछें — मदद, एंट्री कुकबुक, गाइड व FAQ से सीधा, स्रोत-सहित जवाब। कोई अनुमान नहीं, सिर्फ़ असली जानकारी।',
      h1: 'पूछें — सहकारी समिति लेखांकन सहायक',
    },
    en: {
      title: 'Ask SahakarLekha — cooperative society accounting assistant',
      description: 'Ask any cooperative society accounting question — direct answers with their source, from the help articles, entry cookbook, guide and FAQ. No guesses, only real information.',
      h1: 'Ask — cooperative society accounting assistant',
    },
  },
};
