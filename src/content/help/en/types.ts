/**
 * English overlay for the help center (/help). The Hindi tasks in ../index.ts stay the source of truth (prerender
 * parses them, so their shape must not change); an English entry here is laid over a task by slug at render time.
 *
 * Every array must have the SAME length and order as the merged Hindi task (HELP_TASKS), and every number, section
 * and ₹ amount must survive translation — scripts/test-content-en.mjs enforces both.
 */
export interface HelpTaskEn {
  metaTitle: string;
  metaDescription: string;
  title: string;
  /** e.g. "3 min" */
  estTime: string;
  tldr: string;
  /** labels only, same order as the Hindi prerequisites (slugs come from the Hindi task) */
  prerequisites?: string[];
  steps: string[];
  commonMistakes?: string[];
  faqs?: { q: string; a: string }[];
  troubleshooting?: { problem: string; fix: string }[];
  /** CTA button label */
  deepLinkLabel: string;
}
