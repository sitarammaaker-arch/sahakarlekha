/**
 * Bank statement ingest & reconciliation proposals (T-28 / API Constitution Art. VII; API-P7, BANK-2).
 *
 * PURE. A bank statement is UNTRUSTED data (API-P7): it is validated, normalized to exact money, and
 * RECONCILED against the ledger — never trusted as truth because it came from "the bank". This
 * module is the SSOT for two things every banking adapter needs:
 *
 *   • normalizeStatementLine — turn an untrusted external line into a canonical, exact minor-unit
 *     statement line, or REFUSE it (fail-closed). Read-only; ingest never posts.
 *   • proposeMatches — auto-match candidates are PROPOSALS only. Amounts must match EXACTLY in minor
 *     units (BANK-2 — a reconciliation tolerance is an explicit, recorded rule, never silent
 *     rounding); a human confirms every posting (Article VII, parallels AI Tier-D). Nothing here
 *     mutates the ledger; corrections to a wrong match are reversing entries (CL-2), done elsewhere.
 *
 * Exact money via money.ts (ADR-0006). No I/O; deterministic.
 */
import { type Minor, toMinor, isValidMinor } from '../../money';

/** A raw, UNTRUSTED bank statement line as an inbound adapter receives it (external shape). */
export interface RawStatementLine {
  date: string;
  description?: string;
  /** Rupee amounts as received (number or comma-string) — normalized to exact minor units. */
  debit?: number | string;
  credit?: number | string;
  ref?: string;
}

/** Direction on the bank account: `debit` = money OUT, `credit` = money IN. */
export type StatementDirection = 'debit' | 'credit';

/** A canonical, validated statement line — exact minor-unit amount, always positive. */
export interface StatementLine {
  date: string;
  description: string;
  amountMinor: Minor;
  direction: StatementDirection;
  ref?: string;
}

export type NormalizeResult =
  | { ok: true; line: StatementLine }
  | { ok: false; reason: string };

function parseRupees(v: number | string | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * PURE — normalize an untrusted external statement line to a canonical exact-money line, or REFUSE
 * it (API-P7 fail-closed). A valid line has a parseable date and EXACTLY one of debit/credit as a
 * positive amount — a line that is both, neither, or negative is rejected, never guessed.
 */
export function normalizeStatementLine(raw: RawStatementLine): NormalizeResult {
  if (!raw || typeof raw.date !== 'string' || Number.isNaN(Date.parse(raw.date))) {
    return { ok: false, reason: 'statement line has no valid date' };
  }
  const debit = parseRupees(raw.debit);
  const credit = parseRupees(raw.credit);
  if (Number.isNaN(debit) || Number.isNaN(credit)) return { ok: false, reason: 'statement line amount is not a number' };
  const hasDebit = debit > 0;
  const hasCredit = credit > 0;
  if (hasDebit === hasCredit) {
    return { ok: false, reason: 'statement line must be exactly one of debit or credit (positive)' };
  }
  const amountMinor = toMinor(hasDebit ? debit : credit);
  if (!isValidMinor(amountMinor) || amountMinor <= 0) return { ok: false, reason: 'statement line amount is not a positive minor-unit value' };
  return {
    ok: true,
    line: {
      date: raw.date,
      description: typeof raw.description === 'string' ? raw.description : '',
      amountMinor,
      direction: hasDebit ? 'debit' : 'credit',
      ref: raw.ref,
    },
  };
}

/** A book (ledger) entry awaiting reconciliation — the uncleared bank-side amount. */
export interface BookEntry {
  id: string;
  date: string;
  amountMinor: Minor;
  direction: StatementDirection;
}

/** A reconciliation candidate — a PROPOSAL a human confirms; never auto-applied. */
export interface MatchProposal {
  statementIndex: number;
  bookEntryId: string;
  /** 0..1 — higher = closer date; amount & direction are always exact for a proposal to exist. */
  confidence: number;
}

export interface MatchOptions {
  /** Max day gap for a date match (amount must still be exact). */
  dateWindowDays: number;
}

function dayGap(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/**
 * PURE — propose reconciliation matches between untrusted statement lines and book entries. A
 * proposal requires an EXACT minor-unit amount match and the same direction (BANK-2 — no silent
 * tolerance); date proximity within the window sets confidence. Each book entry is proposed at most
 * once (greedy by confidence). NOTHING is applied — a human confirms each posting (Article VII).
 */
export function proposeMatches(
  statement: readonly StatementLine[],
  book: readonly BookEntry[],
  opts: MatchOptions,
): MatchProposal[] {
  const window = Math.max(0, opts.dateWindowDays);
  const used = new Set<string>();
  const proposals: MatchProposal[] = [];
  statement.forEach((line, statementIndex) => {
    let best: { id: string; confidence: number } | null = null;
    for (const entry of book) {
      if (used.has(entry.id)) continue;
      if (entry.amountMinor !== line.amountMinor || entry.direction !== line.direction) continue;
      const gap = dayGap(line.date, entry.date);
      if (gap > window) continue;
      const confidence = 1 - gap / (window + 1);
      if (!best || confidence > best.confidence) best = { id: entry.id, confidence };
    }
    if (best) {
      used.add(best.id);
      proposals.push({ statementIndex, bookEntryId: best.id, confidence: best.confidence });
    }
  });
  return proposals;
}
