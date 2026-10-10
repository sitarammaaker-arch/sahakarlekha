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
ok(/export const ProfitDistributionPanel: React\.FC<\{ embedded\?: boolean \}>/.test(pd) && /const ProfitDistribution: React\.FC = \(\) => <ProfitDistributionPanel \/>;/.test(pd), 'Profit Distribution page = its exported panel');
ok(/\{!embedded && <StatutoryAppropriationPanel \/>\}/.test(pd), 'the flag-gated statutory panel stays out of the wizard');
ok((rf.match(/addVoucher\(/g) || []).length === 1 && (pd.match(/addVoucher\(/g) || []).length === 3, 'posting calls unchanged (no new path)');

// Phase 2 — wizard
const wz = read('pages/SurplusAppropriation.tsx');
ok(/<FundAppropriationPanel embedded \/>/.test(wz) && /<ProfitDistributionPanel embedded \/>/.test(wz), 'wizard steps 2 and 3 ARE the page panels');
ok(!/addVoucher|supabase\./.test(wz), 'the wizard itself posts nothing');
ok(/appropriatedToFunds\(vouchers, appropriationFunds\(accounts\)\.map\(a => a\.id\), fy\)/.test(wz) && /postedAppropriation\(vouchers, ACC_NET_SURPLUS, ACC_DIVIDEND, fy\)/.test(wz), 'summary reads the shared appropriation rule');
ok(/balanceSheetTallied\(/.test(wz) && /getShareCapitalReconciliation\(\)\.reconciled/.test(wz), 'step 1 checks the Balance Sheet tally and share capital first');
const app = read('App.tsx');
ok(/path="\/surplus-appropriation" element=\{<ProtectedRoute><SurplusAppropriation \/><\/ProtectedRoute>\}/.test(app), 'route behind login');
ok(/path="\/reserve-fund"/.test(app) && /path="\/profit-distribution"/.test(app), 'old pages still reachable until phase 3');
const cat = read('lib/navigation/moduleCatalog.ts');
ok(/id: 'surplusAppropriation'[^\n]*requiredRoles: \['admin', 'accountant'\]/.test(cat), 'menu entry with the same roles as the two pages');
ok(/surplusAppropriation: \{ hi: 'लाभ विनियोजन'/.test(read('contexts/LanguageContext.tsx')), 'menu name लाभ विनियोजन');

console.log(`Appropriation wizard: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
