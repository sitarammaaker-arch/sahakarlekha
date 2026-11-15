/**
 * English overlay for the journal-entry cookbook (/cookbook). The Hindi entries in ../index.ts (+ extras, inApp) stay
 * the source of truth — prerender parses them — and an English entry is laid over one by slug at render time.
 *
 * Lists keep the Hindi length and order: `lines[i]` is the English for Hindi line i (its Dr/Cr side comes from the
 * Hindi), `example.rows[i]` the English account name for Hindi row i (its amounts come from the Hindi).
 * scripts/test-content-en.mjs checks lengths, numbers and **bold** markers.
 */
export interface CookbookEntryEn {
  metaTitle: string;
  metaDescription: string;
  title: string;
  scenario: string;
  lines: { account: string; note?: string }[];
  narration: string;
  notes?: string[];
  deepLinkLabel?: string;
  example?: { text: string; rows: string[] };
  useWhen?: string;
  avoidWhen?: string;
  correction?: string;
  inApp?: string;
}
