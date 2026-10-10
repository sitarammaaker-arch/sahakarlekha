// "＋ नई entry" create menu (compact menu phase 3, 2026-10-10).
//   • every action opens the page's OWN form (deep link the page reads) — no new save path
//   • an action is offered only when its page is visible to the user (same engine)
//   • ?new=1 calls the same handler as the page's "नया …" button, then drops the flag
//   • one button at the top of the menu (all sizes); a phone gets a "खोजें" button there too
// Run: node scripts/test-nav-create-menu.mjs   (npm run test:nav-create-menu)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const { CREATE_GROUPS, visibleCreateGroups } = await import(pathToFileURL(resolve(SRC, 'lib', 'navigation', 'createMenu.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const cat = read('lib/navigation/moduleCatalog.ts');
const routeOf = (id) => (cat.match(new RegExp(`id: '${id}',[^\\n]*route: '([^']+)'`)) || [])[1];
const actions = CREATE_GROUPS.flatMap((g) => g.actions);

// 1. Definitions
ok(new Set(actions.map((a) => a.id)).size === actions.length, 'action ids unique');
const badRoute = actions.filter((a) => !routeOf(a.moduleId) || a.to.split('?')[0] !== routeOf(a.moduleId)).map((a) => a.id);
ok(badRoute.length === 0, `each action goes to its own module's page (bad: ${badRoute.join(', ')})`);
ok(['receipt', 'payment', 'journal', 'contra', 'sale', 'purchase', 'member', 'customer', 'supplier', 'item', 'ledgerHead', 'loan'].every((id) => actions.some((a) => a.id === id)), 'the everyday entries are all there');

// 2. Visibility
const only = visibleCreateGroups(new Set(['vouchers', 'members']));
ok(only.flatMap((g) => g.actions).every((a) => ['vouchers', 'members'].includes(a.moduleId)) && only.length === 2, 'only actions whose page is visible; empty groups dropped');
ok(visibleCreateGroups(new Set()).length === 0, 'no visible page → no menu');

// 3. Each deep link is read by the page
const vch = read('pages/Vouchers.tsx');
ok(/t === 'journal' \|\| t === 'receipt' \|\| t === 'payment' \|\| t === 'contra'\) \{ setVoucherType\(t\); setActiveTab\('entry'\); \}/.test(vch), 'Vouchers ?type= opens the entry form of that type');
ok(/bw === 'receive' \|\| bw === 'pay'/.test(vch), 'Vouchers ?billwise= opens the bill-wise panel');
ok(/document\.getElementById\(`tpl-\$\{t\}`\)\?\.scrollIntoView/.test(vch) && /id="tpl-receipt"/.test(vch) && /id="tpl-payment"/.test(vch), 'easy mode scrolls to the receipt / payment templates');
ok(['journal', 'contra'].every((id) => actions.find((a) => a.id === id).to.startsWith('/vouchers?mode=expert&type=')), 'journal + contra open the expert form (easy mode has no journal / contra)');
const NEW = {
  'pages/Members.tsx': /useOpenOnNew\(\(\) => \{ setForm\(\{ \.\.\.EMPTY_FORM, memberId: getNextMemberId\(\) \}\); setIsAddOpen\(true\); \}\)/,
  'pages/Customers.tsx': /useOpenOnNew\(\(\) => openAdd\(\)\)/,
  'pages/Suppliers.tsx': /useOpenOnNew\(\(\) => openAdd\(\)\)/,
  'pages/Inventory.tsx': /useOpenOnNew\(\(\) => openAddItem\(\)\)/,
  'pages/LedgerHeads.tsx': /useOpenOnNew\(\(\) => openAdd\(\)\)/,
  'pages/LoanRegister.tsx': /useOpenOnNew\(\(\) => \{ setForm\(EMPTY_FORM\); setIsAddOpen\(true\); \}\)/,
  'pages/Deposits.tsx': /useOpenOnNew\(\(\) => setOpenNew\(true\), canEdit\)/,
  'pages/SaleManagement.tsx': /useOpenOnNew\(\(\) => setActiveTab\('new-sale'\)\)/,
  'pages/PurchaseManagement.tsx': /useOpenOnNew\(\(\) => setActiveTab\('new-purchase'\)\)/,
  'pages/consumer/SalesReturn.tsx': /useOpenOnNew\(\(\) => setTab\('new'\)\)/,
  'pages/consumer/PurchaseReturn.tsx': /useOpenOnNew\(\(\) => setTab\('new'\)\)/,
};
for (const [f, re] of Object.entries(NEW)) ok(re.test(read(f)), `${f}: ?new=1 runs the page's own "add" handler`);
ok(actions.filter((a) => a.to.includes('new=1')).length === Object.keys(NEW).length, 'every ?new=1 action has a page that reads it');
const hook = read('hooks/useOpenOnNew.ts');
ok(/next\.delete\('new'\);\s*setParams\(next, \{ replace: true \}\);/.test(hook) && /if \(enabled\) openRef\.current\(\);/.test(hook), 'flag dropped after use (refresh / back does not reopen); page gate respected');
ok(!/addVoucher|supabase|upsert/.test(read('components/layout/CreateMenu.tsx') + read('lib/navigation/createMenu.ts') + hook), 'the menu saves nothing itself');

// 4. Placement
const sb = read('components/layout/Sidebar.tsx');
ok(/<CreateMenu/.test(sb) && /onPicked=\{onMobileClose\}/.test(sb), 'menu at the top of the sidebar; the phone drawer closes on pick');
ok(/className="md:hidden gap-2[^"]*"/.test(sb) && /window\.dispatchEvent\(new Event\('sl:open-search'\)\)/.test(sb), 'phone drawer has a खोजें button');
ok(/window\.addEventListener\('sl:open-search', open\)/.test(read('components/layout/Header.tsx')), 'header opens search on that request');
const cm = read('components/layout/CreateMenu.tsx');
ok(/useAllNavigation\(\)/.test(cm) && /visibleCreateGroups\(/.test(cm), 'menu built from the engine-visible pages');
ok(/society\.fyLocked &&/.test(cm), 'a locked FY is said up front');
ok(/w-\[min\(18rem,calc\(100vw-2rem\)\)\]/.test(cm) && /max-h-\[70vh\] overflow-y-auto/.test(cm), 'fits a phone screen');

console.log(`Nav create menu: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
