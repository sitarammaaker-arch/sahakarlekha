// The logged-in app's shell (data providers, layout, route guard) must stay OUT of the entry chunk, and
// the list of public paths that skip it must agree with the routes in src/App.tsx.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_SEGMENTS, needsAppData, firstSegment } from '../src/lib/appDataPaths.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const shell = readFileSync(resolve(ROOT, 'src/AppDataShell.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };

// 1. App.tsx imports none of the app shell statically
const staticImports = [...app.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
const HEAVY = /contexts\/(DataContext|LabourDataContext|HousingDataContext|DairyDataContext|MarketingDataContext|TransportOpsContext|ConsumerDataContext)$|components\/layout\/MainLayout$|components\/CapabilityGuard$|components\/ExportContextBinder$|^\.\/AppDataShell$/;
const leaked = staticImports.filter((s) => HEAVY.test(s));
ok('App.tsx statically imports no data context, app layout, guard or export binder', leaked.length === 0, `eager again: ${leaked.join(', ')} — these put the whole app in every public page's entry chunk`);
ok('App.tsx loads the shell with a dynamic import', /import\(["']\.\/AppDataShell["']\)/.test(app));
ok('the shell still nests every provider', ['DataProvider', 'LabourProvider', 'HousingProvider', 'DairyProvider', 'MarketingProvider', 'TransportOpsProvider', 'ConsumerProvider', 'ExportContextBinder'].every((p) => shell.includes(`<${p}`)));
ok('the protected shell keeps the login check, the loading screen, the layout and the capability guard',
  shell.includes('<Navigate to="/login" replace />') && shell.includes('isLoading') && shell.includes('<MainLayout><CapabilityGuard>') && shell.includes('useNoIndex()'));
ok('the gate keeps the providers mounted once an app path was opened', /everWanted/.test(app) && /wanted \|\| everWanted/.test(app));

// 2. the public list agrees with the routes
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^\n]*)/g)].map((m) => ({ path: m[1], el: m[2] }));
const isPrivate = (r) => /ProtectedRoute|CapabilityGuard|SuperAdminRoute/.test(r.el);
const privateListed = routes.filter(isPrivate).filter((r) => PUBLIC_SEGMENTS.has(firstSegment(r.path)));
ok(`no app route is listed as public (${routes.filter(isPrivate).length} app routes)`, privateListed.length === 0, `these would render without their data providers: ${privateListed.map((r) => r.path).join(', ')}`);
const publicPages = routes.filter((r) => !isPrivate(r) && r.path !== '*' && !/<Navigate\b/.test(r.el));
const unlisted = [...new Set(publicPages.filter((r) => !PUBLIC_SEGMENTS.has(firstSegment(r.path))).map((r) => r.path))];
ok(`every public page skips the app shell (${publicPages.length} public routes)`, unlisted.length === 0, `not in PUBLIC_SEGMENTS (they load the app chunk for nothing): ${unlisted.join(', ')}`);

// 3. behaviour
ok('app paths need the data providers', ['/dashboard', '/vouchers', '/members/abc', '/super-admin/emails', '/hub/accounts'].every(needsAppData));
ok('public paths do not', ['/', '/blog', '/blog/any-post', '/guide/x', '/glossary/bank-book', '/pricing', '/login', '/register', '/member/soc-1'].every((p) => !needsAppData(p)));
ok('an unknown path gets the providers (safe default)', needsAppData('/something-new'));

console.log(`\napp data paths: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
