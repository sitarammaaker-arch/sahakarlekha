/**
 * One file-name scheme for every file the portal hands out (PDF, Excel, CSV)
 * — docs/research/REPORT-UNIFORMITY-STANDARD-DRAFT.md rule R13:
 *
 *     <Type>_<Society>_<Scope>_<yyyymmdd-hhmm>.<ext>
 *     TrialBalance_KapilNutriStore_FY2026-27_20261004-0841.pdf
 *     DayBook_AssandhCooperativeMarketing_2026-04-01-to-2026-04-30_20261004-0841.xlsx
 *
 * ASCII only, no spaces or path characters, length-capped, and the SAME stem for the PDF, Excel and CSV
 * of one report (a PDF's `TrialBalance` and a CSV's legacy `trial-balance-2026-27` both become
 * `TrialBalance_…_FY2026-27_…`). PURE and dependency-free so scripts/test-export-naming.mjs imports it directly.
 */

export interface NamingSociety { name?: string; registrationNo?: string }

const DROP_WORDS = new Set(['the', 'ltd', 'limited', 'society', 'soc', 'co', 'op']);
const MAX_SOCIETY = 24;
const MAX_STEM = 120;

const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** PURE — a short ASCII society tag. Hindi-only names fall back to the registration number, then "Society". */
export function societyShortName(society: NamingSociety | undefined | null): string {
  const words = (society?.name ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter(w => w && !DROP_WORDS.has(w.toLowerCase()));
  // up to three words, but whole words only — never cut a word in half to fit the cap
  let tag = '';
  for (const w of words.slice(0, 3)) {
    const next = tag + titleCase(w);
    if (tag && next.length > MAX_SOCIETY) break;
    tag = next;
  }
  if (!tag) {
    const reg = (society?.registrationNo ?? '').replace(/[^A-Za-z0-9]+/g, '');
    tag = reg ? `Reg${reg}` : 'Society';
  }
  return tag.slice(0, MAX_SOCIETY);
}

/** PURE — `yyyymmdd-hhmm` in LOCAL time (the user's IST clock), injectable for tests. */
export function fileTimestamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

/** A financial-year pair: the second part is the next year's last two digits ("2026-27", "2099-00"). */
const isFy = (a: string, b: string) => +b === (+a + 1) % 100;

/**
 * PURE — split a page-authored base name ("trial-balance-2026-27", "GSTR9_2026-04-01_to_2026-04-30",
 * "customers.csv", "form24Q_2026-27_Q1") into `{ type, scope }`.
 *   type  = the leading tokens up to the first one that starts with a digit, PascalCased
 *   scope = everything after, with a bare financial year labelled `FY2026-27`
 */
export function parseBaseName(base: string): { type: string; scope: string } {
  const noExt = base.replace(/\.(csv|xlsx|xls|pdf|json)$/i, '');
  const cleaned = noExt.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const tokens = cleaned ? cleaned.split('-') : [];
  const firstDigit = tokens.findIndex(t => /^[0-9]/.test(t));
  const typeTokens = firstDigit === -1 ? tokens : tokens.slice(0, firstDigit);
  const scopeTokens = firstDigit === -1 ? [] : tokens.slice(firstDigit);
  const type = typeTokens.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join('') || 'Report';
  let scope = scopeTokens.join('-');
  const fy = /^(\d{4})-(\d{2})(?=$|-)/.exec(scope);
  if (fy && isFy(fy[1].slice(2), fy[2])) scope = 'FY' + scope;
  return { type, scope };
}

export interface StemInput {
  /** The page's own name ("trial-balance-2026-27") or a PDF report type ("TrialBalance"). */
  base: string;
  society: NamingSociety | undefined | null;
  now: Date;
  /** Overrides the scope parsed from `base` (PDFs pass FY / date range explicitly). */
  scope?: string;
}

/** PURE — the standard stem (no extension). */
export function standardFileStem({ base, society, now, scope }: StemInput): string {
  const parsed = parseBaseName(base);
  const sc = (scope ?? parsed.scope).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const parts = [parsed.type, societyShortName(society), sc, fileTimestamp(now)].filter(Boolean);
  return parts.join('_').slice(0, MAX_STEM);
}

/** PURE — scope text for a date range or a financial year (ISO dates in, ISO dates out). */
export function scopeFor(opts: { fromDate?: string; toDate?: string; financialYear?: string }): string {
  if (opts.fromDate && opts.toDate) return `${opts.fromDate}-to-${opts.toDate}`;
  return opts.financialYear ? `FY${opts.financialYear}` : '';
}
