/**
 * Whether report PDFs carry the "Generated free with SahakarLekha" marketing footer (R9).
 *
 * Certified statutory statements of a PAYING society should not carry our advertising; trial and
 * grandfathered (legacy) societies keep it. Bound once from the subscription by <ExportContextBinder/>.
 * The default is ON, so a report generated before the plan has loaded, or for a society whose plan cannot
 * be read, behaves exactly as it did before this change. PURE module state, dependency-free.
 */
let showBrandFooter = true;

export function setReportBranding(opts: { showBrandFooter: boolean }): void {
  showBrandFooter = opts.showBrandFooter;
}

export function getReportBranding(): { showBrandFooter: boolean } {
  return { showBrandFooter };
}

/** Plans that PAY (by name, not by price — Enterprise has a custom, null price). Must mirror lib/plans.ts. */
const PAYING_PLANS = ['starter', 'plus', 'pro', 'enterprise'];

/** PURE — paying plans get the clean footer; trial / legacy / unknown / not-yet-loaded keep the brand line. */
export function brandFooterFor(plan: string | undefined | null): boolean {
  return !PAYING_PLANS.includes(String(plan));
}
