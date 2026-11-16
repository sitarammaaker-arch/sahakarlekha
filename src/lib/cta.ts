/**
 * The ONE wording for the public site's main call to action (audit 2026-11-16, C-1 / J-20).
 *
 * Eight different labels used to point at the same /register — "शुरू करें", "रजिस्टर करें", "पंजीकरण",
 * "मुफ्त रजिस्टर करें", "अभी शुरू करें"… — and a visitor could not tell whether they were different
 * things. They are one thing: registering starts the free trial. The label says exactly that, and its
 * number comes from TRIAL_DAYS, so it cannot drift from the pricing page or the Register page.
 *
 * Where there is no room (the header on a phone or tablet) the short form is plain "रजिस्टर / Register".
 * scripts/test-public-cta.mjs keeps the prerendered HTML and the guide strings on the same wording.
 */
import { TRIAL_DAYS } from './plans';

export const TRIAL_CTA: { hi: string; en: string } = {
  hi: `${TRIAL_DAYS} दिन मुफ़्त आज़माएँ`,
  en: `Start ${TRIAL_DAYS}-day free trial`,
};

/**
 * Shown under a button that names an APP screen ("App में बिक्री दर्ज करें") when the visitor is signed
 * out. The button cannot open that screen for them yet — it goes to Register, and Register opens the
 * screen afterwards (?next=). The label alone promised the screen; this line says what really happens.
 */
export const SIGNED_OUT_NOTE: { hi: string; en: string } = {
  hi: `यह स्क्रीन ऐप के अंदर है। पहले अपनी समिति रजिस्टर करें (${TRIAL_DAYS} दिन मुफ़्त trial) — उसके बाद यही स्क्रीन खुलेगी। पहले से खाता है तो रजिस्टर पेज पर "लॉगिन" चुनें।`,
  en: `This screen is inside the app. Register your society first (${TRIAL_DAYS}-day free trial) — this same screen opens afterwards. Already have an account? Choose "Login" on the register page.`,
};
