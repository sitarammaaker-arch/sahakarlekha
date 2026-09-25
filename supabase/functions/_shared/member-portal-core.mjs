/**
 * member-portal-core — the PURE decisions behind the member-portal-admin Edge Function
 * (Member Portal S2a). Hand-written plain JS (NOT an esbuild bundle) so Deno and the node tests
 * import the very same file — there is no build step that could drift.
 *
 *   memberLoginEmail  — the deterministic, members-only login email for (society, member number).
 *                       The S3 login page must derive the identical string (parity-tested there).
 *   generatePin       — a uniformly random 6-digit PIN, rejecting trivially guessable ones.
 *   canManagePortal   — only an active ADMIN may issue / reset / revoke (founder decision 2026-09-25).
 *   portalPlanAllowed — the same plan gate as member_portal_snapshot() (064).
 *   memberEligible    — exited or archived members cannot be given a login.
 *   parseRequest      — validates the request body; society NEVER comes from the body.
 */

export const MEMBER_EMAIL_DOMAIN = 'm.sahakarlekha.com';
export const PIN_LENGTH = 6;
export const ACTIONS = ['list', 'issue', 'reset_pin', 'revoke'];

const EXITED = new Set(['resigned', 'expelled', 'deceased']);
const PORTAL_PLANS = new Set(['plus', 'pro', 'enterprise', 'legacy', 'trial']);
const PORTAL_STATUSES = new Set(['active', 'trialing', 'grace']);

/** Canonical member number: trimmed and upper-cased, so "m-001 " and "M-001" are one login. */
export function normalizeMemberNo(memberNo) {
  return String(memberNo ?? '').trim().toUpperCase();
}

/**
 * `m-<first 40 hex of sha256("<societyId>|<MEMBER NO>")>@m.sahakarlekha.com`. Fixed length (the
 * email local part is capped at 64 chars), no raw member data in the address, and a staff email
 * can never collide with it (different domain). Uses WebCrypto — available in Deno, Node ≥ 20
 * and every browser, so all three derive the same string.
 */
export async function memberLoginEmail(societyId, memberNo) {
  const sid = String(societyId ?? '').trim();
  const no = normalizeMemberNo(memberNo);
  if (!sid || !no) throw new Error('societyId and memberNo are required');
  const bytes = new TextEncoder().encode(`${sid}|${no}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  return `m-${hex.slice(0, 40)}@${MEMBER_EMAIL_DOMAIN}`;
}

/** True for PINs a person would guess first: one repeated digit, or a straight run (012345 / 987654). */
export function isWeakPin(pin) {
  if (!/^\d+$/.test(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  if (step === 1 || step === -1) {
    if (d.every((x, i) => i === 0 || x - d[i - 1] === step)) return true;
  }
  return false;
}

/**
 * Uniformly random PIN_LENGTH-digit PIN (leading zeros allowed). Rejection sampling on bytes ≥ 250
 * removes modulo bias; weak PINs are redrawn. `randomBytes(n)` is injectable for tests.
 */
export function generatePin(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  for (;;) {
    let pin = '';
    while (pin.length < PIN_LENGTH) {
      for (const b of randomBytes(16)) {
        if (b >= 250) continue; // 250 = 25 × 10 — keep only the unbiased range
        pin += String(b % 10);
        if (pin.length === PIN_LENGTH) break;
      }
    }
    if (!isWeakPin(pin)) return pin;
  }
}

/** Only an active admin of the society may manage member logins. */
export function canManagePortal(staffRow) {
  return !!staffRow && staffRow.is_active !== false && staffRow.role === 'admin';
}

/** Mirrors member_portal_snapshot() (064) and useSubscription: a missing row is legacy/active. */
export function portalPlanAllowed(subscription) {
  const plan = subscription?.plan ?? 'legacy';
  const status = subscription?.status ?? 'active';
  return PORTAL_PLANS.has(plan) && PORTAL_STATUSES.has(status);
}

/** A login can be issued only to a live, current member who has a member number. */
export function memberEligible(member) {
  if (!member) return { ok: false, reason: 'member_not_found' };
  if (member.isDeleted) return { ok: false, reason: 'member_not_found' };
  if (EXITED.has(member.status)) return { ok: false, reason: 'member_inactive' };
  if (!normalizeMemberNo(member.memberId)) return { ok: false, reason: 'member_no_missing' };
  return { ok: true };
}

/** Validates the body. Anything identifying the society is ignored — it comes from the verified caller. */
export function parseRequest(body) {
  const action = body?.action;
  if (!ACTIONS.includes(action)) return { ok: false, reason: 'bad_request' };
  if (action === 'list') return { ok: true, action };
  const memberId = typeof body.member_id === 'string' ? body.member_id.trim() : '';
  if (!memberId) return { ok: false, reason: 'bad_request' };
  return { ok: true, action, memberId };
}

/** Hindi-first messages for every refusal (RULE 7). */
export const MESSAGES = {
  unauthenticated: 'कृपया दोबारा login करें। / Please log in again.',
  forbidden: 'यह काम केवल admin कर सकते हैं। / Only an admin can do this.',
  plan_unavailable: 'सदस्य portal Plus plan और उससे ऊपर में उपलब्ध है। / Member portal needs the Plus plan or higher.',
  bad_request: 'अनुरोध अधूरा है। / Incomplete request.',
  member_not_found: 'यह सदस्य आपकी समिति में नहीं मिला। / Member not found in your society.',
  member_inactive: 'इस्तीफ़ा/निष्कासित/मृत सदस्य को login नहीं दिया जा सकता। / Exited members cannot get a login.',
  member_no_missing: 'पहले सदस्य संख्या भरें। / Set the member number first.',
  already_issued: 'इस सदस्य का login पहले से चालू है — "PIN बदलें" इस्तेमाल करें। / Login already active — use Reset PIN.',
  not_issued: 'इस सदस्य का चालू login नहीं है। / This member has no active login.',
  login_exists: 'इस सदस्य संख्या का login पहले से मौजूद है; support से संपर्क करें। / A login for this member number already exists; contact support.',
  server_error: 'सर्वर में गड़बड़ी — थोड़ी देर बाद फिर कोशिश करें। / Server error — please retry.',
};
