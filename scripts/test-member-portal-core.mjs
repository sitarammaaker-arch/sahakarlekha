// Member Portal S2a — the member-portal-admin Edge Function's pure core + a static guard on the
// function itself. Imports the REAL _shared/member-portal-core.mjs (the file Deno runs).
// Run: node scripts/test-member-portal-core.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const core = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/member-portal-core.mjs')).href);
const {
  memberLoginEmail, normalizeMemberNo, generatePin, isWeakPin, canManagePortal, portalPlanAllowed,
  memberEligible, parseRequest, MESSAGES, MEMBER_EMAIL_DOMAIN, PIN_LENGTH,
} = core;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── login email ──
const e1 = await memberLoginEmail('SOC001', 'M-001');
ok(/^m-[0-9a-f]{40}@m\.sahakarlekha\.com$/.test(e1), 'email format m-<40 hex>@m.sahakarlekha.com');
ok(e1.split('@')[0].length <= 64, 'local part within the 64-char limit');
ok(e1 === await memberLoginEmail('SOC001', 'M-001'), 'deterministic');
ok(e1 === await memberLoginEmail(' SOC001 ', '  m-001 '), 'member number trimmed + upper-cased');
ok(e1 !== await memberLoginEmail('SOC002', 'M-001'), 'different society ⇒ different login');
ok(e1 !== await memberLoginEmail('SOC001', 'M-002'), 'different member ⇒ different login');
ok(!e1.includes('SOC001') && !e1.toUpperCase().includes('M-001'), 'no raw society/member data in the address');
ok(e1.endsWith('@' + MEMBER_EMAIL_DOMAIN), 'members-only domain');
const longNo = 'X'.repeat(200);
ok((await memberLoginEmail('8fa05310-0000-4000-8000-000000000000', longNo)).split('@')[0].length === 42, 'fixed length even for long ids');
let threw = false; try { await memberLoginEmail('SOC001', '  '); } catch { threw = true; }
ok(threw, 'blank member number rejected');
ok(normalizeMemberNo(undefined) === '', 'normalize handles undefined');

// ── PIN ──
const pins = Array.from({ length: 2000 }, () => generatePin());
ok(pins.every((p) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(p)), 'every PIN is exactly 6 digits');
ok(pins.every((p) => !isWeakPin(p)), 'no weak PIN is ever returned');
ok(new Set(pins).size > 1990, 'PINs are effectively unique across 2000 draws');
ok(pins.some((p) => p.startsWith('0')), 'leading zeros are possible (full 000000–999999 space)');
for (const w of ['000000', '111111', '999999', '123456', '012345', '654321', '987654', '12345a', '']) ok(isWeakPin(w), `weak: "${w}"`);
for (const s of ['102938', '482913', '135790', '112233']) ok(!isWeakPin(s), `not weak: "${s}"`);
// Rejection sampling: bytes ≥ 250 are skipped; a weak first draw is redrawn.
let call = 0;
const scripted = [[250, 251, 255, 1, 1, 1, 1, 1, 1], [4, 8, 2, 9, 1, 3]];
const pin = generatePin(() => new Uint8Array(scripted[Math.min(call++, 1)]));
ok(pin === '482913', `biased bytes skipped + weak "111111" redrawn (got ${pin})`);
// Uniformity sanity: each digit ~10% over 2000×6 digits.
const counts = Array(10).fill(0); for (const p of pins) for (const c of p) counts[c]++;
ok(counts.every((c) => c > 900 && c < 1500), `digit distribution roughly uniform (${counts.join(',')})`);

// ── who may manage ──
ok(canManagePortal({ role: 'admin', is_active: true }), 'active admin allowed');
ok(canManagePortal({ role: 'admin' }), 'admin with is_active unset (default true) allowed');
for (const role of ['accountant', 'secretary', 'manager', 'cashier', 'viewer', 'auditor', 'chairman']) ok(!canManagePortal({ role, is_active: true }), `${role} refused (admin-only)`);
ok(!canManagePortal({ role: 'admin', is_active: false }), 'deactivated admin refused');
ok(!canManagePortal(null), 'no society_users row refused');

// ── plan gate (mirrors 064) ──
for (const plan of ['plus', 'pro', 'enterprise', 'legacy', 'trial']) ok(portalPlanAllowed({ plan, status: 'active' }), `${plan} allowed`);
ok(!portalPlanAllowed({ plan: 'starter', status: 'active' }), 'starter refused');
ok(!portalPlanAllowed({ plan: 'pro', status: 'expired' }), 'expired refused');
ok(portalPlanAllowed({ plan: 'plus', status: 'grace' }) && portalPlanAllowed({ plan: 'trial', status: 'trialing' }), 'grace/trialing allowed');
ok(portalPlanAllowed(null), 'missing subscription = legacy/active');

// ── member eligibility ──
ok(memberEligible({ memberId: 'M-1', status: 'active' }).ok, 'active member eligible');
ok(memberEligible({ memberId: 'M-1', status: 'inactive' }).ok, 'inactive (not exited) member eligible');
for (const status of ['resigned', 'expelled', 'deceased']) ok(memberEligible({ memberId: 'M-1', status }).reason === 'member_inactive', `${status} refused`);
ok(memberEligible({ memberId: 'M-1', status: 'active', isDeleted: true }).reason === 'member_not_found', 'archived refused');
ok(memberEligible(null).reason === 'member_not_found', 'missing member refused');
ok(memberEligible({ memberId: ' ', status: 'active' }).reason === 'member_no_missing', 'blank member number refused');

// ── request parsing ──
ok(parseRequest({ action: 'list' }).ok, 'list parses');
ok(parseRequest({ action: 'issue', member_id: 'abc' }).memberId === 'abc', 'issue parses member_id');
ok(!parseRequest({ action: 'issue' }).ok, 'issue without member_id refused');
ok(!parseRequest({ action: 'drop_table' }).ok && !parseRequest(null).ok, 'unknown action / no body refused');
ok(!('societyId' in parseRequest({ action: 'issue', member_id: 'a', society_id: 'EVIL' })), 'society_id in the body is ignored');
for (const k of ['unauthenticated', 'forbidden', 'plan_unavailable', 'member_inactive', 'already_issued', 'not_issued', 'login_exists']) ok(/[ऀ-ॿ]/.test(MESSAGES[k]), `Hindi-first message: ${k}`);

// ── static guard on the Edge Function ──
const fn = readFileSync(resolve(ROOT, 'supabase/functions/member-portal-admin/index.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
ok(/\.auth\.getUser\(bearer\)/.test(fn), 'caller verified by value: getUser(bearer)');
ok(/persistSession: false/.test(fn), 'no server-side session state');
ok(/from\('society_users'\)[\s\S]*?\.eq\('email', callerEmail\)/.test(fn), 'role + society from society_users by verified email');
ok(/const societyId = String\(staff!\.society_id\)/.test(fn), 'society comes from the verified caller');
ok(!/body\.society_id|parsed\.society|\.society_id\s*\?\?/.test(fn), 'society never read from the body');
ok(fn.indexOf('canManagePortal(staff)') < fn.indexOf('parseRequest('), 'role checked before anything else runs');
ok((fn.match(/\.eq\('society_id', societyId\)/g) || []).length >= 4, 'every table read scoped to the caller society');
ok(/email_confirm: true/.test(fn), 'no confirmation email is sent');
ok(/deleteUser\(created\.user\.id\)/.test(fn), 'auth user rolled back if the link insert fails');
ok(/ban_duration: BAN_FOREVER/.test(fn) && /ban_duration: 'none'/.test(fn), 'revoke bans; re-issue lifts the ban');
ok(fn.indexOf("parsed.action === 'revoke'") < fn.indexOf('portalPlanAllowed(sub)'), 'revoke works even after a plan downgrade');
const audits = fn.match(/audit\('[a-z_]+', \{[^}]*\}\)/g) || [];
ok(audits.length === 4, `four audited mutations (got ${audits.length})`);
ok(audits.every((a) => !/pin/i.test(a.replace(/reset_pin/, ''))), 'the PIN is never written to audit_log');

console.log(`member-portal core (S2a): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
