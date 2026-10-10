// ⭐ favourites + recent pages (compact menu phase 2, 2026-10-10).
//   • per-viewer, per user + society, in the browser; ids only; malformed storage → empty, never a crash
//   • every list is filtered through the pages the engine shows this user NOW (no access can leak in)
//   • star on the breadcrumb + on each group-page card; favourites at the top of the menu; Ctrl+K shows
//     favourites + recent pages before anything is typed; the breadcrumb's middle crumb links to the group page
// Run: node scripts/test-nav-favourites.mjs   (npm run test:nav-favourites)
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
const { MAX_FAVOURITES, MAX_RECENTS, prefsKey, parseList, toggleId, pushRecent, keepVisible, recordableModule } = await nav('navPrefs.ts');
const { hubForModule } = await nav('hubs.ts');
const { MODULE_CATALOG } = await nav('moduleCatalog.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Pure list rules
ok(prefsKey('fav', 'u1', 's1') === 'sl.nav.fav.u1.s1' && prefsKey('recent', 'u1', 's2') !== prefsKey('recent', 'u1', 's1'), 'kept per user AND per society');
ok(parseList(null).length === 0 && parseList('{bad').length === 0 && parseList('{"a":1}').length === 0, 'broken storage → empty list, no crash');
ok(parseList('["cashBook","nope",3,"cashBook","ledger"]').join() === 'cashBook,ledger', 'unknown / duplicate / non-string ids dropped');
ok(toggleId(['a'], 'b').join() === 'a,b' && toggleId(['a', 'b'], 'a').join() === 'b', 'star adds, second tap removes');
ok(toggleId(Array.from({ length: MAX_FAVOURITES }, (_, i) => `x${i}`), 'new').length === MAX_FAVOURITES, `at most ${MAX_FAVOURITES} favourites`);
ok(pushRecent(['a', 'b', 'c'], 'b').join() === 'b,a,c', 'reopened page moves to the front, no duplicate');
ok(pushRecent(Array.from({ length: MAX_RECENTS }, (_, i) => `x${i}`), 'new').length === MAX_RECENTS, `at most ${MAX_RECENTS} recent pages`);
ok(keepVisible(['cashBook', 'userManagement', 'ledger'], new Set(['ledger', 'cashBook'])).join() === 'cashBook,ledger', 'a page the user may no longer open is never shown');
ok(recordableModule('/cash-book') === 'cashBook' && recordableModule('/members/abc') === 'members', 'a visit counts for its page (detail → its list page)');
ok(recordableModule('/dashboard') === null && recordableModule('/hub/books') === null && recordableModule('/nope') === null, 'dashboard, group pages and unknown paths are not "recent"');

// 2. Breadcrumb parent = the group
const by = (id) => MODULE_CATALOG.find((m) => m.id === id);
ok(hubForModule(by('balanceSheet')).id === 'reports' && hubForModule(by('cashBook')).id === 'books' && hubForModule(by('milkCollection')).id === 'society', 'every page knows its group');
ok(hubForModule(by('dashboard')) === null && hubForModule(by('vouchers')) === null, 'direct entries have no group');

// 3. Wiring
const hook = read('hooks/useNavPrefs.ts');
ok(/useAllNavigation\(\)/.test(hook) && /keepVisible\(favIds, visibleIds\)/.test(hook) && /keepVisible\(recentIds, visibleIds\)/.test(hook), 'hook filters both lists through the engine-visible pages');
ok(/try \{ return localStorage\.getItem\(key\) \?\? ''; \} catch \{ return ''; \}/.test(hook) && /try \{ localStorage\.setItem/.test(hook), 'every storage access is wrapped');
ok(/if \(!visibleIds\.has\(id\)\) return;/.test(hook), 'cannot star / record a page the user may not open');
const bc = read('components/layout/Breadcrumbs.tsx');
ok(/const hub = hubForModule\(mod\);/.test(bc) && /to=\{hubRoute\(hub\.id\)\}/.test(bc), 'breadcrumb middle crumb links to the group page');
ok(/onClick=\{\(\) => toggleFavourite\(mod\.id\)\}/.test(bc) && /aria-pressed=\{fav\}/.test(bc) && /h-8 w-8/.test(bc), 'breadcrumb ⭐ (accessible, 32px)');
ok(/const id = recordableModule\(pathname\);\s*if \(id\) recordVisit\(id\);/.test(read('components/layout/MainLayout.tsx')), 'opening a page records it');
const sb = read('components/layout/Sidebar.tsx');
ok(/favourites\.length > 0 &&/.test(sb) && /favourites\.map\(m => renderLink\(/.test(sb), 'menu shows ⭐ favourites at the top');
ok(sb.indexOf('favourites.map') < sb.indexOf("mode === 'compact' && ("), '…above the groups');
const gs = read('components/GlobalSearch.tsx');
ok(/\{short && \[/.test(gs) && /list: favourites/.test(gs) && /list: recents\.filter/.test(gs), 'Ctrl+K: favourites + recent before typing');
const hub = read('pages/NavHub.tsx');
ok(/onClick=\{\(\) => toggleFavourite\(m\.id\)\}/.test(hub) && /w-12 flex items-center justify-center/.test(hub), 'group-page card has its own ⭐ tap target (48px wide)');
ok(/min-h-\[56px\]/.test(hub) && /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/.test(hub), 'responsive grid kept');

console.log(`Nav favourites: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
