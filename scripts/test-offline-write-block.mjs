#!/usr/bin/env node
// F1 · offline policy (अ): online-only entry. Offline, or a CORE part of the books failed to load ⇒
// every mutation is refused and the banner shows; non-core failures only warn. Also pins the wiring:
// the guard every mutation passes, the settings save, the 5 domain contexts, and LOAD_PARTS order.
// Run: node scripts/test-offline-write-block.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const m = await import(pathToFileURL(resolve(root, 'src/lib/connectivity/writeBlock.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

// ── pure decision ──
const full = m.decideWriteBlock({ online: true, failedParts: [] });
ok('online + full load → entry open, no banner', !full.blocked && full.reason === null);
const off = m.decideWriteBlock({ online: false, failedParts: [] });
ok('offline → blocked (reason offline)', off.blocked && off.reason === 'offline');
const core = m.decideWriteBlock({ online: true, failedParts: ['sales', 'kcc_loans'] });
ok('online + a core part failed → blocked (incomplete), parts split core/other',
  core.blocked && core.reason === 'incomplete' && core.failedCore.join() === 'sales' && core.failedOther.join() === 'kcc_loans');
const other = m.decideWriteBlock({ online: true, failedParts: ['p7_entries'] });
ok('online + only a non-core part failed → NOT blocked (warning only)', !other.blocked && other.failedOther.join() === 'p7_entries');
ok('every core part blocks on its own', m.CORE_PARTS.every(p => m.decideWriteBlock({ online: true, failedParts: [p] }).blocked));
ok('core set is exactly the 8 approved parts',
  [...m.CORE_PARTS].sort().join() === 'accounts,members,purchases,sales,society_settings,stock_items,stock_movements,vouchers');
ok('every part has a Hindi label', m.CORE_PARTS.every(p => m.PART_LABEL_HI[p]));
ok('incomplete message names the missing parts in Hindi', m.blockMessage(core).description.includes('बिक्री'));

// ── store lifecycle: drop mid-session, come back; incomplete load needs a reload ──
let toasts = 0; const toast = () => { toasts++; };
m.setOnline(true); m.setLoadFailures([]);
ok('full load → guard lets the mutation through', m.refuseIfWriteBlocked(toast) === false && toasts === 0);
let notified = 0; const unsub = m.subscribeWriteBlock(() => { notified++; });
m.setOnline(false);
ok('net drops mid-session → guard refuses + toasts, banner notified', m.refuseIfWriteBlocked(toast) === true && toasts === 1 && notified === 1);
m.setOnline(true);
ok('net returns after a full load → entry reopens by itself', m.refuseIfWriteBlocked(toast) === false && notified === 2);
m.setLoadFailures(['stock_movements']);
ok('load with a failed core part → refused even while online', m.refuseIfWriteBlocked(toast) === true);
m.setOnline(false); m.setOnline(true);
ok('…and coming back online does NOT reopen it (needs a fresh load)', m.getWriteBlock().blocked && m.getWriteBlock().reason === 'incomplete');
m.setLoadFailures([]);
ok('a fresh full load clears it', !m.getWriteBlock().blocked);
unsub();

// ── a page's unconditional "सहेजा गया" must not replace the red refusal (TOAST_LIMIT = 1) ──
m.setOnline(true); m.setLoadFailures([]);
ok('entry open → success toasts are never suppressed', m.suppressAfterRefusal() === false);
m.setOnline(false);
m.refuseIfWriteBlocked(() => {});
ok('right after a refusal → page success toast suppressed', m.suppressAfterRefusal() === true);
ok('…only for a short window', m.suppressAfterRefusal(Date.now() + m.SUPPRESS_MS + 1) === false);
m.setOnline(true);
ok('back online → suppression off immediately', m.suppressAfterRefusal() === false);
const ut = readFileSync(resolve(root, 'src/hooks/use-toast.ts'), 'utf8');
ok('use-toast drops non-destructive toasts during the suppression window', /variant !== "destructive" && suppressAfterRefusal\(\)/.test(ut));
const ss = readFileSync(resolve(root, 'src/pages/SocietySetup.tsx'), 'utf8');
ok('SocietySetup says "सहेजा गया" only from onSaved', (ss.match(/updateSociety\((form|fyForm), \{ onSaved/g) || []).length === 2);

// ── wiring ──
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
const fy = dc.slice(dc.indexOf('const guardFYLocked = useCallback'), dc.indexOf('const isPeriodLocked'));
ok('DataContext guardFYLocked (every mutation passes it) refuses first', /refuseIfWriteBlocked\(toastRef\.current\)\) return true;[\s\S]*fyLocked/.test(fy));
const us = dc.slice(dc.indexOf('const updateSociety = useCallback'), dc.indexOf('const updateSociety = useCallback') + 700);
ok('updateSociety (skips the FY guard by design) applies the rule itself', us.includes('refuseIfWriteBlocked(toastRef.current)'));
const av = dc.slice(dc.indexOf('const addVoucher = useCallback'), dc.indexOf('const addVoucher = useCallback') + 1500);
ok('addVoucher (own FY check, not guardFYLocked) applies the rule itself', av.includes('refuseIfWriteBlocked(toastRef.current)'));
const cf = dc.slice(dc.indexOf('const closeFinancialYear = useCallback'), dc.indexOf('const closeFinancialYear = useCallback') + 400);
ok('closeFinancialYear refuses up front (no false-success lock)', cf.includes('if (refuseIfWriteBlocked(toastRef.current)) return false;'));
for (const c of ['Consumer', 'Dairy', 'Housing', 'Labour', 'Marketing']) {
  const s = readFileSync(resolve(root, `src/contexts/${c}DataContext.tsx`), 'utf8');
  const g = s.slice(s.indexOf('const guardFYLocked'), s.indexOf('const guardFYLocked') + 400);
  ok(`${c}DataContext guard refuses when write-blocked`, g.includes('refuseIfWriteBlocked(toastRef.current)'));
}
// LOAD_PARTS must name the Promise.all queries in the SAME order (index i ↔ result i).
const pa = dc.slice(dc.indexOf('const loadResults = await Promise.all(['), dc.indexOf(']);', dc.indexOf('const loadResults = await Promise.all([')));
const queried = [...pa.matchAll(/fetchAllPaged<[^>]+>\('([a-z_0-9]+)'|from\('([a-z_0-9]+)'\)/g)].map(x => x[1] || x[2]);
const lp = dc.slice(dc.indexOf('const LOAD_PARTS = ['), dc.indexOf('] as const;', dc.indexOf('const LOAD_PARTS = [')));
const listed = [...lp.matchAll(/'([a-z_0-9]+)'/g)].map(x => x[1]);
ok(`LOAD_PARTS matches the ${queried.length} load queries in order`, queried.length === 19 && queried.join() === listed.join());
ok('a failed accounts query never shows the template nor overwrites the cache',
  dc.includes('aErr ? storage.getAccounts() : [...CMS_SOCIETY_ACCOUNTS]') && dc.includes('if (!aErr) storage.setAccounts(baseAccts);'));
ok('thrown load (catch path) marks the core parts failed', /falling back to localStorage[^\n]*\n\s*setLoadFailures\(\[\.\.\.CORE_PARTS\]\)/.test(dc));
const ml = readFileSync(resolve(root, 'src/components/layout/MainLayout.tsx'), 'utf8');
ok('banner is mounted in the staff layout', ml.includes('<OfflineBanner />'));
ok('browser online/offline listeners are wired at startup', readFileSync(resolve(root, 'src/main.tsx'), 'utf8').includes('initConnectivityListeners();'));
ok('no offline queue / sync is wired (online-only)', !/lib\/offline\//.test(dc));

console.log(`\noffline write-block: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
