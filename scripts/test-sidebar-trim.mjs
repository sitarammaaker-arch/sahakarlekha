// Sidebar trim (founder 2026-10-10: "what in this list is not needed / repeated?") — sidebar-only; every page stays in
// the catalog (route + role/capability gate unchanged) and is reached from its parent page.
//   memberApplication → Members "आवेदन पत्र" · deletedVouchers → Vouchers "रद्द" view · stockValuation → Inventory /
//   Closing Stock · myDashboard hidden for admin/accountant · voucherApproval only when approval is on or pending
// Run: node scripts/test-sidebar-trim.mjs   (npm run test:sidebar-trim)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const { hiddenInSidebar, trimSidebar } = await import(pathToFileURL(resolve(SRC, 'lib', 'navigation', 'navVisibility.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const admin = { fullDashboardRole: true, approvalRequired: false, pendingApprovals: 0 };
const cashier = { fullDashboardRole: false, approvalRequired: false, pendingApprovals: 0 };
ok(['memberApplication', 'deletedVouchers', 'stockValuation'].every(id => hiddenInSidebar(id, admin) && hiddenInSidebar(id, cashier)), 'member application, deleted vouchers, stock valuation are not repeated in the menu');
ok(hiddenInSidebar('myDashboard', admin) && !hiddenInSidebar('myDashboard', cashier), 'My Dashboard: hidden for admin/accountant (they have Dashboard), kept for the narrower roles');
ok(hiddenInSidebar('voucherApproval', admin), 'Voucher Approval hidden when approval is off and nothing is pending');
ok(!hiddenInSidebar('voucherApproval', { ...admin, approvalRequired: true }) && !hiddenInSidebar('voucherApproval', { ...admin, pendingApprovals: 2 }), '…shown when approval is on or a voucher is waiting');
ok(['dashboard', 'vouchers', 'members', 'cashBook', 'inventory', 'closingStockReport'].every(id => !hiddenInSidebar(id, admin)), 'nothing else is hidden');
const groups = [{ domain: 'core', headingKey: null, items: [{ id: 'dashboard' }, { id: 'memberApplication' }] }, { domain: 'x', headingKey: 'x', items: [{ id: 'deletedVouchers' }] }];
const t = trimSidebar(groups, admin);
ok(t.length === 1 && t[0].items.map(i => i.id).join() === 'dashboard', 'trim drops the hidden items and an emptied group');

// Pages stay reachable
const cat = read('lib/navigation/moduleCatalog.ts');
ok(['memberApplication', 'deletedVouchers', 'stockValuation', 'myDashboard', 'voucherApproval'].every(id => cat.includes(`id: '${id}'`)), 'all five stay in the catalog (routes + gates unchanged)');
ok(/return trimSidebar\(all,/.test(read('hooks/useNavigation.ts')) && /return getVisibleGroups\(ctx\);/.test(read('hooks/useNavigation.ts')),'only the sidebar is trimmed (the engine / route guard are untouched)');
ok(/navigate\('\/member-application'\)/.test(read('pages/Members.tsx')), 'Members has the "आवेदन पत्र" button');
ok(/to="\/deleted-vouchers"/.test(read('pages/Vouchers.tsx')), 'Vouchers "रद्द" view links the cancelled-voucher register');
ok(/to="\/stock-valuation"/.test(read('pages/Inventory.tsx')) && /to="\/stock-valuation"/.test(read('pages/ClosingStockReport.tsx')), 'Inventory + Closing Stock link Stock Valuation');

console.log(`Sidebar trim: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
