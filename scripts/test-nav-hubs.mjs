// Compact menu + group pages (founder 2026-10-10: "only what is needed on the sidebar, the rest on one page per group").
//   • every catalog module has exactly ONE place: a direct entry or one hub section (a new module cannot fall off)
//   • for every role the compact menu + its hub pages reach EXACTLY the pages the engine shows — no more, no fewer
//   • a hub with one visible page links straight to it; with none it is not shown
//   • search / next-steps use the untrimmed list (a page not in the menu is still findable)
//   • the full menu stays one click away; hub page is responsive (1 → 2 → 3 → 4 columns)
// Run: node scripts/test-nav-hubs.mjs   (npm run test:nav-hubs)
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
const nav = (f) => import(pathToFileURL(resolve(SRC, 'lib', 'navigation', f)).href);
const { HUBS, DIRECT_ENTRIES, hubSections, compactSidebar, entryIsActive, hubById } = await nav('hubs.ts');
const { MODULE_CATALOG } = await nav('moduleCatalog.ts');
const { getVisibleGroups } = await nav('navVisibility.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. One place per module
const DOMAIN_HUB_DOMAINS = new Set(HUBS.flatMap((h) => h.sections.filter((s) => s.domain).map((s) => s.domain)));
const places = new Map();
const add = (id, where) => places.set(id, [...(places.get(id) ?? []), where]);
for (const id of DIRECT_ENTRIES) add(id, 'direct');
for (const h of HUBS) for (const s of h.sections) for (const id of s.moduleIds ?? []) add(id, `${h.id}/${s.en}`);
for (const m of MODULE_CATALOG) if (DOMAIN_HUB_DOMAINS.has(m.domain)) add(m.id, `domain:${m.domain}`);
const catIds = new Set(MODULE_CATALOG.map((m) => m.id));
const missing = MODULE_CATALOG.filter((m) => !places.has(m.id)).map((m) => m.id);
ok(missing.length === 0, `every catalog module is on the compact menu or a group page (missing: ${missing.join(', ')})`);
const unknown = [...places.keys()].filter((id) => !catIds.has(id));
ok(unknown.length === 0, `hubs name only real modules (unknown: ${unknown.join(', ')})`);
// myDashboard is a direct entry only for roles without Dashboard, and under Reports › Analysis otherwise — the one allowed double.
const dup = [...places].filter(([id, w]) => w.length > 1 && id !== 'myDashboard').map(([id, w]) => `${id}@${w.join('+')}`);
ok(dup.length === 0, `no module is in two places (dup: ${dup.join(', ')})`);
ok(HUBS.length <= 10 && HUBS.at(-1).id === 'settings', 'at most 10 groups, Settings last');

// 2. Reachability per role — compact menu ∪ its hub pages == the engine's visible set
const ALL_CAPS = new Set(MODULE_CATALOG.flatMap((m) => m.requiredCapabilities));
const reach = (visible) => {
  const ids = new Set();
  for (const e of compactSidebar(visible)) {
    if (e.kind === 'module') ids.add(e.id);
    else for (const s of hubSections(e.hub, visible)) for (const m of s.items) ids.add(m.id);
  }
  return ids;
};
const legacy = (role, caps = ALL_CAPS) => ({ societyType: 'other', capabilities: caps, hasRole: (rs) => rs.includes(role), userRole: role, superAdminShowAll: false });
const contexts = {
  superAdmin: { societyType: 'other', capabilities: new Set(), hasRole: () => true, userRole: 'admin', superAdminShowAll: true },
  admin: legacy('admin'), accountant: legacy('accountant'), viewer: legacy('viewer'), auditor: legacy('auditor'),
  adminNoCaps: legacy('admin', new Set()),
  storeKeeper: legacy('storeKeeper'), procurementOfficer: legacy('procurementOfficer'), cashier: legacy('cashier'), manager: legacy('manager'),
};
for (const [name, ctx] of Object.entries(contexts)) {
  const visible = getVisibleGroups(ctx).flatMap((g) => g.items);
  const r = reach(visible);
  const lost = visible.filter((m) => !r.has(m.id)).map((m) => m.id);
  const extra = [...r].filter((id) => !visible.some((m) => m.id === id));
  ok(lost.length === 0 && extra.length === 0, `${name}: compact menu reaches exactly its ${visible.length} pages (lost: ${lost.join(',')} extra: ${extra.join(',')})`);
  const entries = compactSidebar(visible);
  ok(entries.length <= 13, `${name}: ${entries.length} sidebar entries (≤ 13)`);
}
const superVisible = getVisibleGroups(contexts.superAdmin).flatMap((g) => g.items);
const superEntries = compactSidebar(superVisible);
ok(superEntries[0].id === 'dashboard' && superEntries[1].id === 'vouchers' && superEntries.at(-1).id === 'settings', 'order: Dashboard, Vouchers … Settings');
ok(!superEntries.some((e) => e.id === 'myDashboard'), 'My Dashboard is not a second direct entry when Dashboard is there');

// 3. Single / empty hubs
const pick = (ids) => MODULE_CATALOG.filter((m) => ids.includes(m.id));
const small = compactSidebar(pick(['dashboard', 'vouchers', 'salary', 'trialBalance', 'balanceSheet']));
ok(small.some((e) => e.kind === 'module' && e.id === 'salary'), 'a group with one visible page links straight to that page');
ok(small.some((e) => e.kind === 'hub' && e.id === 'reports' && e.count === 2), 'a group with 2+ pages becomes a group page');
ok(!small.some((e) => e.id === 'sales' || e.id === 'society'), 'a group with no visible page is not shown');
ok(compactSidebar(pick(['myDashboard', 'cashBook', 'bankBook']))[0].id === 'myDashboard', 'a role without Dashboard gets My Dashboard first');
const repEntry = small.find((e) => e.id === 'reports');
ok(entryIsActive(repEntry, '/hub/reports') && entryIsActive(repEntry, '/balance-sheet') && !entryIsActive(repEntry, '/vouchers'), 'a group entry is highlighted on its page and on its pages');
ok(!hubById('nope') && hubById('books').sections.length > 0, 'unknown group id resolves to nothing');

// 4. Wiring
const hook = read('hooks/useNavigation.ts');
ok(/export function useAllNavigation\(\)/.test(hook) && /return getVisibleGroups\(ctx\);/.test(hook) && /return trimSidebar\(all,/.test(hook), 'useAllNavigation = engine output; useNavigation = that minus the trim');
ok(/const navGroups = useAllNavigation\(\);/.test(read('components/GlobalSearch.tsx')), 'Ctrl+K search covers every page the user may open');
ok(/const groups = useAllNavigation\(\);/.test(read('components/layout/NextSteps.tsx')), 'next-steps too');
const sb = read('components/layout/Sidebar.tsx');
ok(/compactSidebar\(allGroups\.flatMap/.test(sb) && /localStorage\.getItem\(MODE_KEY\) === 'full' \? 'full' : 'compact'/.test(sb), 'sidebar: compact by default, full menu remembered per browser');
ok(/पूरा menu दिखाएँ/.test(sb) && /छोटा menu/.test(sb), 'the full menu is one click away');
ok(/max-md:-translate-x-full/.test(sb) && /onClick=\{onMobileClose\}/.test(sb), 'phone: drawer kept, closes on tap');
const hubPage = read('pages/NavHub.tsx');
ok(/useAllNavigation\(\)/.test(hubPage) && /hubSections\(hub, visible\)/.test(hubPage) && !/MODULE_CATALOG/.test(hubPage), 'group page shows only engine-visible pages');
ok(/grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/.test(hubPage) && /min-h-\[56px\]/.test(hubPage) && /overflow-x-auto/.test(hubPage), 'group page: 1→2→3→4 columns, 56px tap targets, group strip scrolls inside the page');
ok(/path="\/hub\/:hubId" element=\{<ProtectedRoute><NavHub \/><\/ProtectedRoute>\}/.test(read('App.tsx')), 'route behind login');

console.log(`Nav hubs: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
