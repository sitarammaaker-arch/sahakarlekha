/**
 * English overlay for the calculators (/tools). The Hindi configs in ../index.ts stay the source of truth (their
 * compute() functions are the maths); an English entry is laid over one by slug at render time. The H1 in English
 * is the config's own englishName, so it is not repeated here.
 *
 * Lists keep the Hindi length and order; inputs are keyed by input key, select options by option value.
 * scripts/test-content-en.mjs checks lengths, numbers and **bold** markers.
 */
export interface CalcInputEn {
  label: string;
  sub?: string;
  suffix?: string;
  /** option value → English label */
  options?: Record<string, string>;
}

export interface CalcConfigEn {
  metaTitle: string;
  metaDescription: string;
  intro: string;
  inputs: Record<string, CalcInputEn>;
  formula: string;
  explanation: string;
  example: string;
  mistakes: string;
  faqs?: { q: string; a: string }[];
  relatedArticles: string[];
  relatedHelp?: string[];
  relatedGuide: string[];
  relatedModules: string[];
}
