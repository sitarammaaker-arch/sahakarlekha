# 10 — Calculator Library

> Every calculator SahakarLekha can provide. Calculators are the **highest-intent, most-linkable**
> assets: free to use → optional "email/save result" → register ([08 §4](08-lead-engine.md)).
> Proposed route: `/tools/:calc` (new surface) + an explainer cluster (D29) each.
> `⚠️ NEV` = formula/rate depends on statute or accounting policy → **validate before publishing**.

**Status:** 🟡 planned · ✅ logic already exists in a module (wrap as public tool).
**Cols:** Calculator · Inputs → Output · Linked cluster/module · Validate · Pri

---

## A. Loans, Interest & Recovery
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| Interest calculator (simple/reducing) | principal, rate, period → interest | C070 / `/loan-interest` ✅ | `⚠️` | P0 |
| EMI calculator | principal, rate, tenure → EMI + schedule | C077 | `⚠️` | P0 |
| Penal interest | overdue amt, rate, days → penalty | C070 | `⚠️` | P1 |
| KCC limit / drawing power | crop, scale-of-finance, area → limit | C071 / `/kcc-loan` | `⚠️` | P1 |
| Loan eligibility | income, existing dues → eligibility | C075 | `⚠️` | P2 |
| NPA classification | overdue days/amount → asset class | C073 / `/aging-analysis` ✅ | `⚠️` | P1 |
| Recovery % | recovered/demand → % | C074 | — | P2 |
| Interest subvention | loan, rate, subvention → net cost | C078 | `⚠️` | P2 |

## B. Deposits
| Calculator | Inputs → Output | Cluster | Validate | Pri |
| --- | --- | --- | --- | --- |
| FD maturity | principal, rate, tenure, comp → maturity | C080 | `⚠️` | P1 |
| RD maturity | installment, rate, months → maturity | C081 | `⚠️` | P2 |
| Deposit interest accrual | balance, rate, period → accrued | C079 | `⚠️` | P2 |
| TDS on interest (15G/15H) | interest, PAN status → TDS | C082 | `⚠️` | P2 |

## C. Assets & Depreciation
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| Depreciation (SLM) | cost, rate/life, salvage → yearly | C112 / `/depreciation-schedule` ✅ | `⚠️` | P0 |
| Depreciation (WDV) | cost, rate → yearly schedule | C112 ✅ | `⚠️` | P0 |
| Asset disposal profit/loss | WDV, sale price → P/L | C113 | `⚠️` | P2 |

## D. Tax
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| GST calculator | amount, rate, incl/excl → CGST/SGST/IGST | C124 / `/gst-summary` ✅ | `⚠️` | P0 |
| TDS calculator | payment type, amount → TDS | C134 / `/tds-register` ✅ | `⚠️` | P0 |
| Reverse GST (incl→base) | gross, rate → base+tax | C124 | `⚠️` | P1 |
| Advance tax estimator | est. income → installments | C140 | `⚠️` | P3 |
| 80P benefit estimator `⚠️` | income type → indicative | C138 | `⚠️` | P2 |

## E. Final Accounts, Ratios & Finance
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| Financial ratios | BS/P&L figures → ratios | C056 | `⚠️` | P1 |
| Closing stock | opening+purchases−sales → closing | C087 / `/closing-stock-report` ✅ | — | P1 |
| Stock valuation (FIFO/Wt-avg) | lots → value | C086 / `/stock-valuation` ✅ | `⚠️` | P1 |
| Break-even / viability | fixed, variable, price → BEP | C183 | — | P2 |
| Working capital | CA, CL → WC + cycle | C180 | — | P2 |
| Cash flow builder | inflows/outflows → net | C060 | — | P3 |
| Budget vs actual | budget, actual → variance | C179 / `/budget-module` ✅ | — | P2 |

## F. Members, Profit & Governance
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| Dividend computation | profit, rate, cap → dividend | C174 / `/profit-distribution` ✅ | `⚠️` | P1 |
| Profit appropriation | net profit → reserve/dividend/funds split | C172 ✅ | `⚠️` | P1 |
| Reserve fund (statutory %) | profit, % → transfer | C173 / `/reserve-fund` ✅ | `⚠️` | P1 |
| Share capital / refund | shares, value → capital | C062 / `/share-register` ✅ | — | P2 |
| AGM quorum | members, % → quorum needed | C163 | `⚠️` | P3 |

## G. Payroll
| Calculator | Inputs → Output | Cluster/Module | Validate | Pri |
| --- | --- | --- | --- | --- |
| Salary / net pay | gross, deductions → net | C117 / `/salary` ✅ | `⚠️` | P1 |
| EPF / ESI | wages → contributions | C118/C119 | `⚠️` | P2 |
| Gratuity | salary, years → gratuity | C122 | `⚠️` | P3 |

---

## Governance for calculators
1. **Wrap, don't rebuild:** many formulas already run inside modules (✅) — expose a public, no-login
   version at `/tools/:calc` that links to the full module ("save this in your books → register").
2. Every `⚠️` calculator shows a **"rates/rules vary — verify with CA/portal"** disclaimer + cite source ([13](13-authority-engine.md)). Never hard-code a rate as fact; make rates **inputs** or clearly dated defaults.
3. Each calculator = a landing cluster (explainer + tool + related template + CTA).
4. Emit `WebApplication` schema; track `calc_used` (GA4) and offer email-the-result capture.
5. Show the **formula** transparently (builds trust + targets "{X} formula" queries).

---

### Cross-references
[Template Library](09-template-library.md) · [Lead Engine](08-lead-engine.md) · [Topic Registry](03-topic-registry.md) · [Authority Engine](13-authority-engine.md)
