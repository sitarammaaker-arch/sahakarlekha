// Reports statement selection wiring (T-21 activation) — Reports.tsx ← selectStatements.
//
// Verifies the capability-driven UCAS Part D statement set on the Reports landing:
//   • a trading society (inventory_sales) surfaces Trading A/c + P&L, NOT Income & Expenditure;
//   • a service society surfaces Income & Expenditure, NOT Trading A/c / P&L;
//   • every surfaced statement code maps to a report route that actually exists in App.tsx;
//   • Reports.tsx drives selection from selectStatements (no duplicated capability rule).
//
// Run: node scripts/test-reports-statements-wiring.mjs   (npm run test:reports-statements-wiring)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let selectStatements, profitLossStatement;
try {
  ({ selectStatements, profitLossStatement } = await import(abs('../src/lib/reports/statements.ts')));
} catch (e) {
  console.error('\nFAIL    Could not import reports/statements.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// The exact code → route map wired in Reports.tsx (kept in sync by the source assertions below).
const STMT_META = { trading_ac: '/trading-account', profit_loss: '/profit-loss', income_expenditure: '/profit-loss' };
const surfaced = (caps, legalType) =>
  selectStatements({ capabilities: new Set(caps), legalType }).map(s => s.code).filter(c => STMT_META[c]);

// ── 1. TRADING society (inventory_sales) → Trading A/c + P&L ──────────────────
const trading = surfaced(['inventory_sales'], 'multipurpose');
ok(trading.includes('trading_ac') && trading.includes('profit_loss'), 'a trading society surfaces Trading A/c + P&L');
ok(!trading.includes('income_expenditure'), 'a trading society does NOT surface Income & Expenditure');

// ── 2. SERVICE society (no inventory_sales) → Income & Expenditure ────────────
const service = surfaced([], 'multipurpose');
ok(service.includes('income_expenditure'), 'a service society surfaces Income & Expenditure');
ok(!service.includes('trading_ac') && !service.includes('profit_loss'), 'a service society does NOT surface Trading A/c / P&L');

// mutually exclusive — never both I&E and Trading on the same landing.
ok(!(trading.includes('income_expenditure')) && !(service.includes('trading_ac')),
  'the trading and service P&L-family sets are mutually exclusive (UCAS Part D)');

// ── 3. Every surfaced code maps to an EXISTING report route ──────────────────
const app = readFileSync(pathResolve(ROOT, 'src', 'App.tsx'), 'utf8');
for (const code of new Set([...trading, ...service])) {
  const route = STMT_META[code];
  ok(app.includes(`path="${route}"`), `surfaced statement "${code}" → route ${route} exists in App.tsx`);
}

// ── 4. Reports.tsx activates the pure core with NO duplicated capability rule ─
const rep = readFileSync(pathResolve(ROOT, 'src', 'pages', 'Reports.tsx'), 'utf8');
ok(/import\s*\{\s*selectStatements\s*\}\s*from\s*'@\/lib\/reports\/statements'/.test(rep), 'Reports.tsx imports selectStatements (activates T-21)');
ok(rep.includes('selectStatements({'), 'Reports.tsx drives the P&L-family cards from selectStatements');
ok(!rep.includes("capabilities.has('inventory_sales')") && !rep.includes('capabilities.has("inventory_sales")'),
  'Reports.tsx does NOT re-implement the trading-vs-service rule inline (no duplicate logic)');
ok(!rep.includes("key: 'profitLoss'"), 'the fixed "Income & Expenditure for everyone" card was removed');

// The /profit-loss page itself (founder 2026-10-09): titled by the SAME rule — लाभ-हानि for trading, आय-व्यय otherwise.
ok(profitLossStatement(new Set(['inventory_sales'])).labelHi === 'लाभ-हानि खाता', 'trading society: page is "लाभ-हानि खाता"');
ok(profitLossStatement(new Set([])).labelHi === 'आय-व्यय खाता', 'service society: page is "आय-व्यय खाता"');
const plPage = readFileSync(pathResolve(ROOT, 'src/pages/ProfitLoss.tsx'), 'utf8');
ok(/profitLossStatement\(capabilities\)/.test(plPage) && (plPage.match(/\{stmtTitle\}/g) || []).length === 2, 'ProfitLoss.tsx: heading + statement title come from profitLossStatement');
ok(!/\{hi \? 'आय-व्यय खाता' : 'Income & Expenditure Account'\}/.test(plPage), 'ProfitLoss.tsx: no fixed "आय-व्यय खाता for everyone" title left');
ok(/'Profit & Loss A\/c' : 'Income & Expenditure Account'\)/.test(plPage), 'the PDF gets the same title');

console.log(`\nReports statement-selection wiring: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
