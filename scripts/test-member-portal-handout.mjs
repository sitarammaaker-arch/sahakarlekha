// Member Portal S2b — the admin dialog's pure hand-out helpers (src/lib/memberPortalHandout.ts) +
// a static guard that the dialog/page wiring keeps the admin-only, PIN-not-kept rules.
// Run: node scripts/test-member-portal-handout.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const h = await import(pathToFileURL(resolve(ROOT, 'src/lib/memberPortalHandout.ts')).href);
const core = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/member-portal-core.mjs')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── plan gate: UI mirror must agree with the server gate for every combination ──
for (const plan of ['starter', 'plus', 'pro', 'enterprise', 'legacy', 'trial', 'bogus']) {
  for (const status of ['active', 'trialing', 'grace', 'expired']) {
    ok(h.portalPlanAllowed(plan, status) === core.portalPlanAllowed({ plan, status }), `UI plan gate = server gate for ${plan}/${status}`);
  }
}

// ── portal URL ──
ok(h.portalUrl('https://sahakarlekha.com', '/sadasya/SOC001') === 'https://sahakarlekha.com/sadasya/SOC001', 'url joins origin + path');
ok(h.portalUrl('https://sahakarlekha.com/', 'sadasya/SOC001') === 'https://sahakarlekha.com/sadasya/SOC001', 'url normalises slashes');

// ── WhatsApp number ──
ok(h.whatsappPhone('9876543210') === '919876543210', '10-digit mobile → 91 prefix');
ok(h.whatsappPhone('+91 98765-43210') === '919876543210', '+91 with spaces/dashes');
ok(h.whatsappPhone('09876543210') === '919876543210', 'leading 0 dropped');
ok(h.whatsappPhone('919876543210') === '919876543210', 'already 91-prefixed');
for (const bad of ['', undefined, '12345', '1234567890', '01722212345']) ok(h.whatsappPhone(bad) === '', `invalid/landline "${bad}" → empty (WhatsApp lets admin pick)`);

// ── message ──
const msg = h.handoutMessage({ memberName: 'रामलाल', societyName: 'असंध PACS', memberNo: 'M-001', pin: '482913', url: 'https://sahakarlekha.com/sadasya/SOC001' });
ok(msg.includes('रामलाल') && msg.includes('असंध PACS'), 'message names member + society');
ok(msg.includes('https://sahakarlekha.com/sadasya/SOC001') && msg.includes('M-001') && msg.includes('482913'), 'message carries link, member no, PIN');
ok(/किसी को न बताएँ/.test(msg), 'message warns not to share the PIN');
ok(!h.handoutMessage({ memberName: 'x', memberNo: '1', pin: '1', url: 'u' }).includes('undefined'), 'no "undefined" when society name missing');
const link = h.whatsappLink('9876543210', 'PIN: 1&2');
ok(link.startsWith('https://wa.me/919876543210?text=') && link.includes(encodeURIComponent('PIN: 1&2')), 'wa.me link encodes the text');

// ── orphan reclaim rule (Edge Function) ──
ok(core.orphanReclaimable({ id: 'x', email_confirmed_at: null }, false), 'unconfirmed + unlinked → reclaim');
ok(!core.orphanReclaimable({ id: 'x', email_confirmed_at: '2026-09-25' }, false), 'confirmed → never deleted');
ok(!core.orphanReclaimable({ id: 'x', email_confirmed_at: null }, true), 'linked → never deleted');
ok(!core.orphanReclaimable(null, false), 'not found → nothing to reclaim');

// ── static guards ──
const strip = (f) => readFileSync(resolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const fn = strip('supabase/functions/member-portal-admin/index.ts');
ok(/orphanReclaimable\(existing, !!linkedRow\)/.test(fn), 'Edge Function reclaims only via orphanReclaimable');
ok(fn.indexOf('orphanReclaimable(') < fn.indexOf('deleteUser(existing'), 'delete happens only after the reclaim check');
const dlg = strip('src/components/members/MemberPortalDialog.tsx');
ok(!/localStorage|sessionStorage/.test(dlg), 'dialog never persists the PIN');
ok(/setHandout\(null\)/.test(dlg), 'PIN dropped when the dialog closes');
ok(/rel="noopener noreferrer"/.test(dlg), 'WhatsApp link opened safely');
const page = strip('src/pages/Members.tsx');
ok(/const isAdmin = user\?\.role === 'admin'/.test(page), 'Members page gates on admin');
ok(/isAdmin && !showApprovalActions && !\['resigned', 'expelled', 'deceased'\]\.includes\(member\.status\)/.test(page), 'portal button: admin only, not for exited members');
ok(/if \(!isAdmin\) return;/.test(page), 'non-admins never call the function');

console.log(`member-portal hand-out (S2b): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
