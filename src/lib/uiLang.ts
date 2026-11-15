/**
 * uiLang — the reader's language for text built OUTSIDE React render: toasts and errors raised inside the data
 * contexts (DataContext, persistVoucher, …), where a hook can't be called. LanguageProvider keeps it in step with
 * the site language ('sahayata_language'); Hindi is the default (RULE 7: Hindi first, plain English second).
 *
 *   toastRef.current({ title: tr('वाउचर सेव नहीं हुआ', 'Voucher not saved'), … })
 *
 * Both strings are evaluated, so template literals with ${…} work the same in either language.
 */
export type UiLang = 'hi' | 'en';

let current: UiLang = 'hi';

/** Called by LanguageProvider on every render — not for general use. */
export function setUiLanguage(lang: UiLang): void {
  current = lang;
}

export function uiLanguage(): UiLang {
  return current;
}

/** The Hindi or the English, by the reader's chosen language. */
export function tr(hi: string, en: string): string {
  return current === 'en' ? en : hi;
}
