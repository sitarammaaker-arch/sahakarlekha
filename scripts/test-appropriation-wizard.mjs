// लाभ विनियोजन wizard (2026-10-10, phases 1+2) — one screen, one order, NO new calculation / posting path.
//   • phase 1: the Reserve Fund and Profit Distribution pages export their whole body as a panel (`embedded` hides only
//     the page title / the flag-gated statutory panel); the pages render that same panel — screens unchanged
//   • phase 2: /surplus-appropriation steps through summary → FundAppropriationPanel → ProfitDistributionPanel; the
//     summary reads the same shared appropriation helpers (lib/distribution/dividendRuns) the steps post with
//   • the old pages stay reachable (phase 3 = redirects, after the founder checks)
// Source checks (house style).
//
// Run: node scripts/test-appropriation-wizard.mjs   (npm run test:appropriation-wizard)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// Phase 1 — panels
const rf = read('pages/ReserveFund.tsx'), pd = read('pages/ProfitDistribution.tsx');
ok(/export const FundAppropriationPanel: React\.FC<\{ embedded\?: boolean \}>/.test(rf) && /const ReserveFund: React\.FC = \(\) => <FundAppropriationPanel \/>;/.test(rf), 'Reserve Fund page = its exported panel');
ok(/export const ProfitDistributionPanel: React\.FC<\{ embedded\?: boolean; section\?: 'all' \| 'bonus' \| 'dividend' \}>/.test(pd) && /const ProfitDistribution: React\.FC = \(\) => <ProfitDistributionPanel \/>;/.test(pd), 'Profit Distribution page = its exported panel');
ok(/\{!embedded && <StatutoryAppropriationPanel \/>\}/.test(pd), 'the flag-gated statutory panel stays out of the wizard');
ok((rf.match(/addVoucher\(/g) || []).length === 1 && (pd.match(/addVoucher\(/g) || []).length === 3, 'posting calls unchanged (no new path)');

// Phase 2 — wizard
const wz = read('pages/SurplusAppropriation.tsx');
ok(/<FundAppropriationPanel embedded \/>/.test(wz) && /<ProfitDistributionPanel embedded section="bonus" \/>/.test(wz) && /<ProfitDistributionPanel embedded section="dividend" \/>/.test(wz), 'wizard steps ARE the page panels: bonus → funds → dividend');
ok(wz.indexOf('section="bonus"') < wz.indexOf('<FundAppropriationPanel embedded') && wz.indexOf('<FundAppropriationPanel embedded') < wz.indexOf('section="dividend"'), 'ORDER: bonus (an expense) before the funds, dividend after (guide ch.22)');
ok(/const n = Number\(params\.get\('step'\)\); if \(n >= 1 && n <= 4\) setStep/.test(wz), 'wizard opens the step named in ?step=');
ok(/s\.netProfit <= 0\s*\?\s*<p className="font-bold text-muted-foreground">\{hi \? 'घाटा — विनियोजन नहीं'/.test(wz), 'a deficit year shows "घाटा — विनियोजन नहीं", not a red negative remaining');
ok(/const showBonus = section !== 'dividend';/.test(pd) && /if \(!bonusPosted && effBonus > 0\)/.test(pd) && /if \(!divPosted && effDividend > 0\)/.test(pd), 'a section posts only its own part');
ok(/disabled=\{\(effDividend === 0 && effBonus === 0\) \|\| \(effDividend > 0 && \(!shareRecon\.reconciled \|\| !!dividendCapIssue\)\)\}/.test(pd), 'share-capital mismatch blocks the DIVIDEND only — a bonus can post alone');
ok(!/id: 'reserveFund'|id: 'profitDistribution'/.test(read('lib/navigation/moduleCatalog.ts')), 'one menu entry (the two old ones removed)');
ok(!/addVoucher|supabase\./.test(wz), 'the wizard itself posts nothing');
ok(/appropriatedToFunds\(vouchers, appropriationFunds\(accounts\)\.map\(a => a\.id\), fy\)/.test(wz) && /postedAppropriation\(vouchers, ACC_NET_SURPLUS, ACC_DIVIDEND, fy\)/.test(wz), 'summary reads the shared appropriation rule');
ok(/balanceSheetTallied\(/.test(wz) && /getShareCapitalReconciliation\(\)\.reconciled/.test(wz), 'step 1 checks the Balance Sheet tally and share capital first');
const app = read('App.tsx');
ok(/path="\/surplus-appropriation" element=\{<ProtectedRoute><SurplusAppropriation \/><\/ProtectedRoute>\}/.test(app), 'route behind login');
// Phase 3 — the old pages land on their step; one menu entry
ok(/path="\/reserve-fund" element=\{<Navigate to="\/surplus-appropriation\?step=3" replace \/>\}/.test(app) && /path="\/profit-distribution" element=\{<Navigate to="\/surplus-appropriation\?step=4" replace \/>\}/.test(app), 'old routes redirect to their wizard step');
const cat = read('lib/navigation/moduleCatalog.ts');
ok(/id: 'surplusAppropriation'[^\n]*requiredRoles: \['admin', 'accountant'\]/.test(cat), 'menu entry with the same roles as the two pages');
ok(/surplusAppropriation: \{ hi: 'लाभ विनियोजन'/.test(read('contexts/LanguageContext.tsx')), 'menu name लाभ विनियोजन');

console.log(`Appropriation wizard: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
