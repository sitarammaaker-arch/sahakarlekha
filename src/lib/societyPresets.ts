/**
 * Society presets — a state-specific NAME for a society that legally stays one of the
 * SocietyType values. A preset is NOT a new type (ADR-0002/0003: the type is the thin legal
 * anchor; business lines are activities). It only records what the society is called and
 * picks a sensible legal type + state at registration.
 *
 * CM-PACS (Haryana) = Comprehensive Multi-Purpose Activities Cooperative Society — Haryana's
 * own model (RCS Haryana memo PA/RCS/225-275, 25.12.2023, Model Bye-laws). It is NOT
 * "मुख्यमंत्री-पैक्स" and NOT the all-India PACS (Primary Agricultural Credit Society).
 *
 * Legal type = 'multipurpose' on purpose. Founder decision 2026-10-19: the PACS-only rules — s.16
 * 60-day deemed admission, NABARD CAS formats (Audit Schedules), the NABARD / RCS return — do NOT
 * apply to a CM-PACS. They key on societyType === 'pacs', so the preset must never save 'pacs'
 * (guarded by test:society-presets). Nothing here changes a statutory rule.
 */
import type { SocietyType } from '@/types';

export type SocietyVariant = 'cm_pacs';

export interface SocietyPreset {
  variant: SocietyVariant;
  legalType: SocietyType;
  /** INDIAN_STATES value the preset belongs to. */
  state: string;
  short: string;
  label: string;
  labelHi: string;
}

export const SOCIETY_PRESETS: Record<SocietyVariant, SocietyPreset> = {
  cm_pacs: {
    variant: 'cm_pacs',
    legalType: 'multipurpose',
    state: 'hr',
    short: 'CM-PACS',
    label: 'CM-PACS (Haryana) — Comprehensive Multi-Purpose Activities Cooperative Society',
    labelHi: 'CM-PACS (हरियाणा) — बहुउद्देश्यीय गतिविधि सहकारी समिति',
  },
};

const PREFIX = 'preset:';

export const isSocietyVariant = (v: unknown): v is SocietyVariant =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(SOCIETY_PRESETS, v);

/** Presets offered for a state ('' = state not chosen yet → all presets are offered). */
export function presetsForState(state: string | undefined): SocietyPreset[] {
  return Object.values(SOCIETY_PRESETS).filter(p => !state || p.state === state);
}

/** The value a type dropdown uses for a preset option. */
export const presetChoice = (variant: SocietyVariant) => `${PREFIX}${variant}`;

/** Dropdown value → what gets saved. A plain type clears the variant (null, so the DB column is cleared too). */
export function resolveTypeChoice(choice: string): { societyType: SocietyType; societyVariant: SocietyVariant | null; state?: string } {
  if (choice.startsWith(PREFIX)) {
    const v = choice.slice(PREFIX.length);
    if (isSocietyVariant(v)) {
      const p = SOCIETY_PRESETS[v];
      return { societyType: p.legalType, societyVariant: v, state: p.state };
    }
  }
  return { societyType: choice as SocietyType, societyVariant: null };
}

/** Saved (type, variant) → dropdown value. An unknown or mismatched variant falls back to the plain type. */
export function typeChoiceOf(societyType: SocietyType | '' | undefined, variant: string | null | undefined): string {
  if (isSocietyVariant(variant) && SOCIETY_PRESETS[variant].legalType === societyType) return presetChoice(variant);
  return societyType || '';
}

/** Display name of a society's type: the preset's name when one is set, else the type label. */
export function societyTypeDisplay(
  society: { societyType?: SocietyType; societyVariant?: string | null },
  types: { value: SocietyType; label: string; labelHi: string }[],
  hi: boolean,
): string {
  const v = society.societyVariant;
  if (isSocietyVariant(v) && SOCIETY_PRESETS[v].legalType === society.societyType) {
    return hi ? SOCIETY_PRESETS[v].labelHi : SOCIETY_PRESETS[v].label;
  }
  const t = types.find(x => x.value === society.societyType);
  return t ? (hi ? t.labelHi : t.label) : (society.societyType ?? '');
}
