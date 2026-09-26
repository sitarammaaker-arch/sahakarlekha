// Print chrome — printing a staff page prints the PAGE, not the app. Static guard on MainLayout:
// header / sidebar / breadcrumbs / glossary / subscription banner / next-steps are print:hidden, the
// main area drops its screen offsets in print, and a print-only identity line (society, reg. no, FY,
// printed date) replaces the hidden header. Nothing may change on screen: every new class is print:-only.
// (Found in the founder's Member-360 PDFs: the fixed header repeated on every sheet.)
// Run: node scripts/test-print-chrome.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'src/components/layout/MainLayout.tsx'), 'utf8');
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*/g, '');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// The chrome block: <div className="print:hidden"> … <Sidebar … <Header … </div>
const chrome = code.match(/<div className="print:hidden">([\s\S]*?)<\/div>\s*<main/);
ok(!!chrome, 'header/sidebar wrapped in a print:hidden block');
ok(chrome && /<Sidebar/.test(chrome[1]) && /<Header/.test(chrome[1]) && /<KeyboardShortcutsHelp/.test(chrome[1]), 'Sidebar, Header and shortcuts help are inside it');
ok(/<div className="print:hidden">\s*<SubscriptionBanner \/>\s*<Breadcrumbs \/>\s*<ModuleGlossaryBar \/>\s*<\/div>/.test(code), 'banner, breadcrumbs and glossary bar are print:hidden');
ok(/<div className="print:hidden"><NextSteps \/><\/div>/.test(code), 'NEXT STEP block is print:hidden');
ok(/\{children\}/.test(code) && !/print:hidden[^"]*">\s*\{children\}/.test(code), 'the page content itself is NOT hidden');
ok(/print:pt-0 print:ml-0/.test(code), 'main drops the header offset + sidebar margin in print');
ok(/p-4 md:p-6 pb-24 md:pb-24 print:p-0/.test(code), 'content padding removed in print');

// Print-only identity line.
const line = code.match(/<div className="hidden print:block[^"]*">([\s\S]*?)<\/div>/);
ok(!!line, 'print-only identity line exists (hidden on screen)');
ok(line && /society\.name/.test(line[1]) && /society\.registrationNo/.test(line[1]) && /society\.financialYear/.test(line[1]), 'identity line shows society, reg. no and FY');
ok(line && /छापा गया/.test(line[1]) && /Printed/.test(line[1]), 'identity line shows the printed date (Hindi + English)');

// Screen unchanged: every class token added by this change is a print: variant (or the `hidden` that
// hides the print-only line on screen).
const added = ['print:hidden', 'print:pt-0', 'print:ml-0', 'print:min-h-0', 'print:p-0', 'print:block'];
for (const t of added) ok(code.includes(t), `uses ${t}`);
ok(/'pt-16 min-h-screen transition-all duration-300 /.test(code), 'screen classes of <main> unchanged');

console.log(`print chrome: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
