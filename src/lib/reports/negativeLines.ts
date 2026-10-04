/**
 * Presentation of lines whose sign is opposite to their side.
 *
 * A direct-expense ledger with a CREDIT balance (a recovery / reversal), or an income ledger with a DEBIT
 * balance, comes out of the aggregators as a negative amount on its own side. Printed that way it reads as
 * an error ("Rs. -5,21,756.80"). The accounting-correct statement shows it on the OPPOSITE side as a
 * positive line. This only moves the printed line: the figure, the net result (gross profit / surplus /
 * deficit) and the ledger itself are untouched — only the two side totals grow by the same amount.
 */

export interface NamedAmount { name: string; amount: number }

export interface SplitResult<T extends NamedAmount> {
  /** Lines that keep their own side (amount >= 0 or exactly zero). */
  kept: T[];
  /** Negative lines, re-signed positive and relabelled, for the opposite side. */
  moved: NamedAmount[];
  movedTotal: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function splitNegativeLines<T extends NamedAmount>(items: T[], movedSuffix: string): SplitResult<T> {
  const kept: T[] = [];
  const moved: NamedAmount[] = [];
  for (const it of items) {
    if (it.amount < 0) moved.push({ name: `${it.name} ${movedSuffix}`, amount: r2(-it.amount) });
    else kept.push(it);
  }
  return { kept, moved, movedTotal: r2(moved.reduce((s, m) => s + m.amount, 0)) };
}

/** Income & Expenditure: negative income lines -> expenditure side; negative expense lines -> income side. */
export function reclassifyIncomeExpenditure<T extends NamedAmount>(income: T[], expense: T[]) {
  const inc = splitNegativeLines(income, '(debit balance in income A/c)');
  const exp = splitNegativeLines(expense, '(credit balance in expense A/c)');
  return {
    income: [...inc.kept, ...exp.moved] as NamedAmount[],
    expense: [...exp.kept, ...inc.moved] as NamedAmount[],
  };
}
