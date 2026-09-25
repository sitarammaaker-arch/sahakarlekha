/**
 * member-portal-admin — lets a society ADMIN issue, reset or revoke a member's portal login
 * (Member Portal S2a). Actions (POST JSON):
 *   { action: 'list' }                         → which members have a login, and its state
 *   { action: 'issue',     member_id }         → create (or re-activate) the login; returns a fresh PIN once
 *   { action: 'reset_pin', member_id }         → new PIN for an active login; returns it once
 *   { action: 'revoke',    member_id }         → deactivate + ban the login
 *
 * TRUST: the caller is verified by value (getUser(bearer), stateless — the ai-ask fix), their society
 * and role come from society_users, and ONLY an active admin passes. The society is never read from
 * the body, so an admin can only ever touch their own society's members. The PIN is returned once,
 * never stored by us and never written to audit_log (Supabase Auth keeps only its hash).
 *
 * The member's login email is on a members-only domain, so it can never be in society_users: every
 * tenant RLS policy gives it zero rows, and member_portal_snapshot() (064) is its only data path.
 *
 * Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. No new secret.
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy member-portal-admin
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  memberLoginEmail, normalizeMemberNo, generatePin, canManagePortal, portalPlanAllowed,
  memberEligible, parseRequest, MESSAGES,
} from '../_shared/member-portal-core.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BAN_FOREVER = '876000h'; // ~100 years — Supabase's way to disable a user

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
function fail(reason: keyof typeof MESSAGES, status: number): Response {
  return json({ ok: false, reason, message: MESSAGES[reason] }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !svcKey) return fail('server_error', 500);

  // ── 1. WHO is calling — verified by value, never from the body ──
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer || bearer === anonKey) return fail('unauthenticated', 401);
  const { data: authData, error: authErr } = await createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.getUser(bearer);
  const callerEmail = authData?.user?.email?.toLowerCase();
  if (authErr || !callerEmail) return fail('unauthenticated', 401);

  const svc = createClient(url, svcKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: staff } = await svc
    .from('society_users').select('society_id, role, is_active, name')
    .eq('email', callerEmail).maybeSingle();
  if (!canManagePortal(staff)) return fail('forbidden', 403);
  const societyId = String(staff!.society_id);

  const parsed = parseRequest(await req.json().catch(() => null));
  if (!parsed.ok) return fail('bad_request', 400);

  try {
    // ── list ──
    if (parsed.action === 'list') {
      const { data, error } = await svc
        .from('member_portal_users').select('member_id, is_active, created_at, revoked_at')
        .eq('society_id', societyId);
      if (error) return fail('server_error', 500);
      return json({ ok: true, logins: data ?? [] });
    }

    const memberId = parsed.memberId!;
    const { data: link } = await svc
      .from('member_portal_users').select('auth_user_id, is_active')
      .eq('society_id', societyId).eq('member_id', memberId).maybeSingle();

    const audit = (action: string, after: Record<string, unknown>) =>
      svc.from('audit_log').insert({
        society_id: societyId, actor_name: staff!.name ?? callerEmail, actor_email: callerEmail,
        actor_role: 'admin', entity_type: 'member_portal_login', entity_id: memberId,
        action, after, source: 'member-portal-admin',
      }).then(({ error }) => { if (error) console.error('audit_log insert failed', error.message); });

    // ── revoke — always allowed (even after a plan downgrade) ──
    if (parsed.action === 'revoke') {
      if (!link) return fail('not_issued', 404);
      const { error: upErr } = await svc.from('member_portal_users')
        .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: callerEmail })
        .eq('auth_user_id', link.auth_user_id);
      if (upErr) return fail('server_error', 500);
      const { error: banErr } = await svc.auth.admin.updateUserById(link.auth_user_id, { ban_duration: BAN_FOREVER });
      if (banErr) console.error('ban failed (link already inactive, RPC denies access)', banErr.message);
      await audit('revoke', {});
      return json({ ok: true });
    }

    // ── issue / reset_pin — plan + member checks ──
    const { data: sub } = await svc.from('subscriptions').select('plan, status').eq('society_id', societyId).maybeSingle();
    if (!portalPlanAllowed(sub)) return fail('plan_unavailable', 403);

    const { data: member } = await svc
      .from('members').select('id, memberId, name, status, isDeleted')
      .eq('society_id', societyId).eq('id', memberId).maybeSingle();
    const elig = memberEligible(member);
    if (!elig.ok) return fail(elig.reason as keyof typeof MESSAGES, elig.reason === 'member_not_found' ? 404 : 409);
    const memberNo = normalizeMemberNo(member!.memberId);
    const pin = generatePin();
    const handout = { ok: true, pin, memberNo, societyId, portalPath: `/sadasya/${encodeURIComponent(societyId)}` };

    if (parsed.action === 'reset_pin') {
      if (!link || !link.is_active) return fail('not_issued', 404);
      const { error } = await svc.auth.admin.updateUserById(link.auth_user_id, { password: pin });
      if (error) return fail('server_error', 500);
      await audit('reset_pin', { memberNo });
      return json(handout);
    }

    // issue
    if (link?.is_active) return fail('already_issued', 409);
    if (link) {
      // Re-activate a revoked login: new PIN, lift the ban, mark active.
      const { error } = await svc.auth.admin.updateUserById(link.auth_user_id, { password: pin, ban_duration: 'none' });
      if (error) return fail('server_error', 500);
      const { error: upErr } = await svc.from('member_portal_users')
        .update({ is_active: true, revoked_at: null, revoked_by: null })
        .eq('auth_user_id', link.auth_user_id);
      if (upErr) return fail('server_error', 500);
      await audit('reactivate', { memberNo });
      return json(handout);
    }

    const email = await memberLoginEmail(societyId, memberNo);
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email, password: pin, email_confirm: true, user_metadata: { member_portal: true },
    });
    if (createErr || !created?.user) {
      const exists = /already|registered|exists/i.test(createErr?.message ?? '');
      return fail(exists ? 'login_exists' : 'server_error', exists ? 409 : 500);
    }
    const { error: linkErr } = await svc.from('member_portal_users').insert({
      auth_user_id: created.user.id, society_id: societyId, member_id: memberId, created_by: callerEmail,
    });
    if (linkErr) {
      // Never leave an auth user without its link — roll it back.
      await svc.auth.admin.deleteUser(created.user.id);
      return fail('server_error', 500);
    }
    await audit('issue', { memberNo });
    return json(handout);
  } catch (e) {
    console.error('member-portal-admin', e instanceof Error ? e.message : String(e));
    return fail('server_error', 500);
  }
});
