/**
 * Vernacular i18n — locale registry, fallback & script integrity (T-38 / TASK4.1; RULE 7, RULE 8).
 *
 * PURE. Correct cooperative accounting must be reachable by a secretary in their OWN language — the
 * vernacular principle, extended beyond Hindi to India's regional languages. This module is the SSOT
 * for locale resolution, and it protects the one thing that silently destroys multilingual data:
 * ENCODING. A Devanagari or Tamil string decoded with the wrong codec becomes permanent garbage
 * (RULE 8); a missing translation must degrade gracefully (RULE 7 Hindi-first), never show a blank.
 *
 *   resolveMessage    — requested language → Hindi → English → the key itself; never empty (RULE 7).
 *   isScriptClean     — reject the U+FFFD mojibake marker and any character from a DIFFERENT Indic
 *                       script than expected (wrong-script corruption) — the integrity guard (RULE 8).
 *   localizeAmount    — the numeric VALUE comes from money.formatMinor (exact, never diverges,
 *                       RULE 2); only the glyphs transliterate per locale.
 *
 * The actual translation content packs and the LanguageContext widening are additive wire-layer
 * work. No I/O; deterministic.
 */
import { formatMinor, type Minor } from '../money';

export type LanguageCode =
  | 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'pa' | 'ta' | 'te' | 'kn' | 'ml' | 'or' | 'as';

export type ScriptName =
  | 'Devanagari' | 'Latin' | 'Gujarati' | 'Bengali' | 'Gurmukhi'
  | 'Tamil' | 'Telugu' | 'Kannada' | 'Malayalam' | 'Odia';

export interface LocaleMeta {
  code: LanguageCode;
  script: ScriptName;
  englishName: string;
  nativeName: string;
}

/** Supported locales. Marathi reuses the Devanagari script (proving script-level reuse). */
export const LOCALES: Record<LanguageCode, LocaleMeta> = {
  hi: { code: 'hi', script: 'Devanagari', englishName: 'Hindi', nativeName: 'हिन्दी' },
  en: { code: 'en', script: 'Latin', englishName: 'English', nativeName: 'English' },
  mr: { code: 'mr', script: 'Devanagari', englishName: 'Marathi', nativeName: 'मराठी' },
  gu: { code: 'gu', script: 'Gujarati', englishName: 'Gujarati', nativeName: 'ગુજરાતી' },
  bn: { code: 'bn', script: 'Bengali', englishName: 'Bengali', nativeName: 'বাংলা' },
  pa: { code: 'pa', script: 'Gurmukhi', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  ta: { code: 'ta', script: 'Tamil', englishName: 'Tamil', nativeName: 'தமிழ்' },
  te: { code: 'te', script: 'Telugu', englishName: 'Telugu', nativeName: 'తెలుగు' },
  kn: { code: 'kn', script: 'Kannada', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  ml: { code: 'ml', script: 'Malayalam', englishName: 'Malayalam', nativeName: 'മലയാളം' },
  or: { code: 'or', script: 'Odia', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  as: { code: 'as', script: 'Bengali', englishName: 'Assamese', nativeName: 'অসমীয়া' },
};

/** PURE — the resolution order (RULE 7): the requested language, then Hindi, then English. Deduped. */
export function fallbackChain(lang: LanguageCode): LanguageCode[] {
  const chain: LanguageCode[] = [lang, 'hi', 'en'];
  return [...new Set(chain)];
}

/** A message pack per language: key → localized string. */
export type MessagePacks = Partial<Record<LanguageCode, Readonly<Record<string, string>>>>;

/**
 * PURE — resolve a message key in the requested language, falling back requested → hi → en. If no
 * pack has the key, the KEY itself is returned — a visible, non-empty last resort, never a blank
 * label (RULE 7 graceful degradation).
 */
export function resolveMessage(packs: MessagePacks, lang: LanguageCode, key: string): string {
  for (const l of fallbackChain(lang)) {
    const val = packs[l]?.[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return key;
}

// ── Script integrity (RULE 8) ────────────────────────────────────────────────

const SCRIPT_RANGE: Record<ScriptName, [number, number]> = {
  Devanagari: [0x0900, 0x097f],
  Gujarati: [0x0a80, 0x0aff],
  Bengali: [0x0980, 0x09ff],
  Gurmukhi: [0x0a00, 0x0a7f],
  Tamil: [0x0b80, 0x0bff],
  Telugu: [0x0c00, 0x0c7f],
  Kannada: [0x0c80, 0x0cff],
  Malayalam: [0x0d00, 0x0d7f],
  Odia: [0x0b00, 0x0b7f],
  Latin: [0x0041, 0x007a],
};

/** Characters allowed in ANY localized string: printable ASCII, whitespace, the rupee sign, and the
 *  Indic danda punctuation (shared across scripts). */
function isCommon(cp: number): boolean {
  return (cp >= 0x20 && cp <= 0x7e) || cp === 0x09 || cp === 0x0a || cp === 0x0d ||
    cp === 0x20b9 /* ₹ */ || cp === 0x0964 || cp === 0x0965 /* danda */;
}

/** PURE — does the text contain the Unicode REPLACEMENT CHARACTER (U+FFFD)? Its presence is the
 *  fingerprint of a decoding failure — mojibake (RULE 8). */
export function hasMojibake(text: string): boolean {
  return text.includes('�');
}

/**
 * PURE — is the text clean for its expected script (RULE 8)? Rejected if it contains the mojibake
 * marker, or ANY character that is neither common nor within the expected script's Unicode block —
 * which catches a string corrupted into (or mixed with) a DIFFERENT Indic script. Devanagari-safe.
 */
export function isScriptClean(text: string, script: ScriptName): boolean {
  const [lo, hi] = SCRIPT_RANGE[script];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfffd) return false;
    if (isCommon(cp)) continue;
    if (cp >= lo && cp <= hi) continue;
    return false;
  }
  return true;
}

// ── Vernacular numerals & amounts ────────────────────────────────────────────

/** The Unicode codepoint of digit '0' per script (digits run 0..9 contiguously from here). */
const DIGIT_ZERO: Partial<Record<ScriptName, number>> = {
  Devanagari: 0x0966, Gujarati: 0x0ae6, Bengali: 0x09e6, Gurmukhi: 0x0a66,
  Tamil: 0x0be6, Telugu: 0x0c66, Kannada: 0x0ce6, Malayalam: 0x0d66, Odia: 0x0b66,
};

/**
 * PURE — transliterate the ASCII digits 0-9 in a string to the locale's native numerals (Latin and
 * scripts with no distinct digit set are returned unchanged). Only digits change — grouping,
 * decimal point, and the ₹ sign are untouched.
 */
export function toNativeDigits(text: string, lang: LanguageCode): string {
  const zero = DIGIT_ZERO[LOCALES[lang].script];
  if (zero == null) return text;
  return text.replace(/[0-9]/g, (d) => String.fromCodePoint(zero + (d.charCodeAt(0) - 48)));
}

/**
 * PURE — localize an exact money amount for a locale. The VALUE and its Indian grouping come from
 * money.formatMinor (ADR-0006 exact, RULE 2 — the figure NEVER diverges by locale); only the digit
 * glyphs are transliterated. A statutory statement in Marathi shows the same paise as in English.
 */
export function localizeAmount(minor: Minor, lang: LanguageCode, opts: { symbol?: boolean } = {}): string {
  return toNativeDigits(formatMinor(minor, opts), lang);
}
