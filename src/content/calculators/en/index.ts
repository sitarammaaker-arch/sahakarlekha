/**
 * English calculator text, laid over the Hindi configs by slug. A slug missing here renders in Hindi with the
 * HindiOnlyNotice.
 */
import type { CalcConfig, CalcResult } from '../index';
import type { CalcConfigEn } from './types';
import { CALC_EN_TEXT } from './text';
import { CALC_RESULT_EN } from './results';

export type { CalcConfigEn };
export { CALC_EN_TEXT, CALC_RESULT_EN };

/** Numbers inside a compute() string: ₹ amounts, decimals, Indian grouping, negatives. */
export const CALC_NUM = /₹?-?\d[\d,]*(?:\.\d+)?/g;

/** One compute() string in English: look up its number-free template, put the numbers back in order. */
export function translateCalcString(s: string): string {
  if (!/[ऀ-ॿ]/.test(s)) return s;
  const nums = s.match(CALC_NUM) ?? [];
  const en = CALC_RESULT_EN[s.replace(CALC_NUM, '{#}')];
  if (en == null) return s;
  let i = 0;
  return en.replace(/\{#\}/g, () => nums[i++] ?? '');
}

function translateResult(r: CalcResult): CalcResult {
  return {
    ...r,
    stats: r.stats.map((s) => ({ ...s, label: translateCalcString(s.label), value: translateCalcString(s.value) })),
    table: r.table ? { head: r.table.head.map(translateCalcString), rows: r.table.rows.map((row) => row.map(translateCalcString)) } : undefined,
    note: r.note != null ? translateCalcString(r.note) : undefined,
  };
}

export type LocalizedCalcConfig = CalcConfig & { translated: boolean };

/** The calculator in the reader's language; the maths (compute) is the Hindi config's, only its words change. */
export function localizeCalculator(config: CalcConfig, lang: 'hi' | 'en'): LocalizedCalcConfig {
  const en = lang === 'en' ? CALC_EN_TEXT[config.slug] : undefined;
  if (!en) return { ...config, translated: lang === 'hi' };
  const titles = <T extends object>(list: T[], names: string[] | undefined, key: keyof T): T[] =>
    list.map((x, i) => ({ ...x, [key]: names?.[i] ?? x[key] }));
  return {
    ...config,
    metaTitle: en.metaTitle,
    metaDescription: en.metaDescription,
    title: config.englishName,
    intro: en.intro,
    inputs: config.inputs.map((inp) => {
      const e = en.inputs[inp.key];
      if (!e) return inp;
      return {
        ...inp,
        label: e.label,
        sub: inp.sub != null ? e.sub ?? inp.sub : undefined,
        suffix: inp.suffix != null ? e.suffix ?? inp.suffix : undefined,
        options: inp.options?.map((o) => ({ ...o, label: e.options?.[o.value] ?? o.label })),
      };
    }),
    compute: (v) => translateResult(config.compute(v)),
    formula: en.formula,
    explanation: en.explanation,
    example: en.example,
    mistakes: en.mistakes,
    faqs: en.faqs ?? config.faqs,
    relatedArticles: titles(config.relatedArticles, en.relatedArticles, 'title'),
    relatedHelp: config.relatedHelp ? titles(config.relatedHelp, en.relatedHelp, 'title') : undefined,
    relatedGuide: titles(config.relatedGuide, en.relatedGuide, 'title'),
    relatedModules: titles(config.relatedModules, en.relatedModules, 'label'),
    translated: true,
  };
}
