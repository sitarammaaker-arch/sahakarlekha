/**
 * PF wage for the Payroll engine — the whitelisted `pf_wage` function. PURE.
 *
 *     formula "PF" :: Money let w = pf_wage(BASIC * 120%) in w * (pf_rate / 100) * ((30 - attendance.lopDays) / 30)
 *
 * PF is charged on the wage up to the EPFO ceiling (EPFO FAQ on S.O. 5109(E), Q21: above the ceiling the contribution is
 * restricted to the ceiling — contributing on the higher wage is a separate, explicit choice that is NOT the default here).
 * The ceiling is DATED data (lib/rules/epfEsi.ts, `pf.wageCeiling`) read for the month being processed — never today —
 * and when it changes inside the month (September 2026: ₹15,000 for 1–16, ₹25,000 for 17–30, FAQ Q7/Q13) each part is
 * capped on its own ceiling and weighted by its days:
 *
 *     pf_wage(w) = Σ min(w, ceiling of the part) × days of the part ÷ days of the month
 *
 * In an ordinary month there is one part and this is simply min(w, ceiling). The ceiling rows are `verified: false` until a
 * person has read the notification text (see epfEsi.ts) — this function does not hide that, it only applies them.
 */
import { resolveMonthSegments } from '@/lib/rules/epfEsi';
import { makeMoney, type MoneyValue } from '../formula/evaluator.ts';

/** The formula-language signature of the whitelisted function (TypeEnv.fns). */
export const PF_WAGE_SIG = { params: ['Money'], ret: 'Money' } as const;
export const PF_WAGE_NAME = 'pf_wage';

export interface PfWageContext {
  /** first day of the period's month, YYYY-MM-01 — the month being paid, never today */
  asOf: string;
  currency: string;
}

function refuse(code: string, msg: string): never {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}

export function makePfWage(ctx: PfWageContext): (wage: unknown) => MoneyValue {
  const segments = resolveMonthSegments('pf.wageCeiling', ctx.asOf);
  const monthDays = segments.reduce((s, g) => s + g.days, 0);
  return (wage) => {
    const w = wage as MoneyValue | null;
    if (!w || w.kind !== 'money') refuse('PAY-DSL-TYPE-015', 'pf_wage: the wage must be Money');
    if (w.currency !== ctx.currency) refuse('PAY-DSL-TYPE-011', `pf_wage: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (!(monthDays > 0)) refuse('PAY-PF-501', `pf_wage: no PF ceiling segments for ${ctx.asOf}`);
    let minor = 0;
    for (const g of segments) minor += Math.min(w.minor, Math.round(g.value * 100)) * g.days;
    return makeMoney(Math.round(minor / monthDays), ctx.currency);
  };
}
