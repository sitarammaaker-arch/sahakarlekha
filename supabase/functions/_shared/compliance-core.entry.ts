/**
 * Bundle entry for the compliance reminder core (email slice 4).
 *
 * Re-exports the EXACT engine the in-app Compliance Calendar uses, plus the sourced reminder filter, so the
 * compliance-reminders Edge Function computes the same due dates as the app (RULE 2 — one rule, never a
 * second copy). esbuild bundles src/ into one Deno-friendly ESM file (compliance-core.mjs); no Supabase
 * client is pulled in.
 *
 * Regenerate after any change to complianceCalendar.ts / complianceReminders.ts:
 *   npm run build:compliance-core
 */
export { buildComplianceCalendar } from '../../../src/lib/complianceCalendar';
export { COMPLIANCE_SOURCES, REMINDER_OFFSETS, dueReminders, istDate, ruleKeyOf } from '../../../src/lib/complianceReminders';
