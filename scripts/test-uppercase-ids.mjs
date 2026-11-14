// PAN, IFSC and GSTIN are always capital letters, whatever case the user types (founder, 2026-11-14).
// Source scan: every <Input> bound to a PAN / IFSC / GSTIN value must upper-case in its onChange
// (directly, or via a handler that does). The two key-mapped forms (partner portal, admin payouts) are pinned by name.
// CSS `uppercase` alone does NOT count — it only changes how the letters look; the stored value stays lowercase.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(SRC);

// value={...} that names a PAN / IFSC / GSTIN field (camelCase or snake_case), not "panel", "span", "company" …
const ID_VALUE = /value=\{[^}]*\b(?:[A-Za-z]*\.)?(pan|deducteePan|deductorPan|entityPan|ifsc|bankIfsc|fIfsc|gstin|transporterGstin|gstNo)\b[^}]*\}/;
// handlers known to upper-case (verified below)
const UPPER_HANDLERS = ['handleGstinChange'];

let scanned = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  for (const m of src.matchAll(/<Input\b[\s\S]*?\/>/g)) {
    const el = m[0];
    if (!ID_VALUE.test(el)) continue;
    if (/readOnly/.test(el)) continue;
    scanned++;
    const upper = /toUpperCase\(\)/.test(el) || UPPER_HANDLERS.some((h) => el.includes(h));
    const line = src.slice(0, m.index).split('\n').length;
    ok(upper, `${rel}:${line} — a PAN / IFSC / GSTIN input does not upper-case what is typed`);
  }
}
ok(scanned >= 15, `found the PAN / IFSC / GSTIN inputs (${scanned})`);

for (const h of UPPER_HANDLERS) {
  for (const f of ['src/pages/Customers.tsx', 'src/pages/Suppliers.tsx']) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const body = src.slice(src.indexOf(`const ${h} = `), src.indexOf(`const ${h} = `) + 200);
    ok(/raw\.toUpperCase\(\)/.test(body), `${f}: ${h} upper-cases`);
  }
}

const portal = readFileSync(join(ROOT, 'src/pages/PartnerPortal.tsx'), 'utf8');
ok(/const UPPERCASE_FIELDS: string\[\] = \['pan', 'ifsc', 'gstin'\];/.test(portal) && /UPPERCASE_FIELDS\.includes\(k\) \? e\.target\.value\.toUpperCase\(\)/.test(portal), 'partner portal: PAN / IFSC / GSTIN upper-cased');
const payouts = readFileSync(join(ROOT, 'src/components/partners/AdminPayoutsPanel.tsx'), 'utf8');
ok(/\['pan', 'ifsc', 'gstin'\]\.includes\(k\) \? e\.target\.value\.toUpperCase\(\)/.test(payouts), 'admin payout details: PAN / IFSC / GSTIN upper-cased');

console.log(`uppercase ids: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
