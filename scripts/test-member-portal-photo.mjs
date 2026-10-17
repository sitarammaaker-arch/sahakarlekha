// Member portal — the member sees their OWN photograph (migration 124, 2026-10-17). STATIC guard.
// The SQL behaviour was rehearsed on a throwaway local Postgres 18: the linked member reads exactly their own object,
// a revoked / exited member and another member's path get nothing, staff keep the 119 read, anon cannot call the
// helper, and the down file restores the 107 snapshot. This file pins the source so none of that can regress.
// Run: node scripts/test-member-portal-photo.mjs   (npm run test:member-portal-photo)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const fnOf = (sql) => {
  const a = sql.indexOf('create or replace function public.member_portal_snapshot()');
  const b = sql.indexOf('grant execute on function public.member_portal_snapshot() to authenticated;');
  return a < 0 || b < 0 ? '' : sql.slice(a, b);
};
const m107 = read('supabase/migrations/107_member_portal_identity.sql');
const m124 = read('supabase/migrations/124_member_portal_photo.sql');
const d124 = read('supabase/migrations/124_member_portal_photo_down.sql');
const LINE = `      -- 124: the member's own photograph path (s.40); the portal reads the file through member_photos_portal_select.\n      'photoPath', nullif(v_member."photoPath", ''),\n`;

// ── the snapshot is 107 plus exactly one key ──
ok(fnOf(m124) === fnOf(m107).replace(`      'kycStatus', v_member."kycStatus",\n`, `      'kycStatus', v_member."kycStatus",\n${LINE}`), '124 snapshot = 107 snapshot + member.photoPath, nothing else');
ok(fnOf(d124) === fnOf(m107), '124 down restores the 107 snapshot exactly');
ok(/security definer\s*\nset search_path = ''/.test(fnOf(m124)) && /member_portal_snapshot\(\)\s*\nreturns jsonb/.test(fnOf(m124)), 'snapshot keeps SECURITY DEFINER, search_path \'\', zero parameters');
ok(/revoke execute on function public\.member_portal_snapshot\(\) from public, anon;/.test(m124), 'snapshot still not executable by anon');

// ── the own-photo helper + storage policy ──
const hStart = m124.indexOf('create or replace function public.member_portal_own_photo_path()');
const helper = hStart < 0 ? '' : m124.slice(hStart, m124.indexOf('$$;', hStart + 70) + 3);
ok(/returns text\s+language sql stable security definer set search_path to ''/.test(helper), 'helper: SECURITY DEFINER, pinned search_path, no parameters');
ok(/u\.auth_user_id = auth\.uid\(\)/.test(helper) && /and u\.is_active/.test(helper) && /coalesce\(m\."isDeleted", false\) = false/.test(helper) && /m\.status not in \('resigned', 'expelled', 'deceased'\)/.test(helper), 'helper: own active link, live, not-exited member only');
ok(/m\.id = u\.member_id and m\.society_id = u\.society_id/.test(helper), 'helper: member matched on BOTH id and society');
ok(/revoke execute on function public\.member_portal_own_photo_path\(\) from public, anon;/.test(m124) && /grant execute on function public\.member_portal_own_photo_path\(\) to authenticated;/.test(m124), 'helper: anon cannot call it');
ok(/create policy "member_photos_portal_select" on storage\.objects for select to authenticated\s+using \(bucket_id = 'member-photos' and name = public\.member_portal_own_photo_path\(\)\);/.test(m124), 'storage: a portal member reads exactly their one object (read-only)');
ok(!/member_photos_portal_(insert|update|delete)/.test(m124), 'storage: no write access for portal members');
ok(/drop policy if exists "member_photos_portal_select"/.test(d124) && /drop function if exists public\.member_portal_own_photo_path\(\)/.test(d124), 'down removes the policy and the helper');
ok(/insert into public\.app_migrations \(version, name\) values \('124', 'member_portal_photo'\)/.test(m124), 'logged in app_migrations');

// ── the page ──
const cl = read('src/lib/memberPortalClient.ts');
ok(/export async function memberOwnPhotoUrl\(path[^)]*\)/.test(cl) && cl.includes("memberPortalClient().storage.from('member-photos').createSignedUrl(path, 600)"), 'portal client: 10-minute signed URL from the member\'s OWN session');
const page = read('src/pages/MemberPortal.tsx');
ok(page.includes('memberOwnPhotoUrl(photoPath)') && /<img src=\{photoUrl\} alt=\{m\.name\}/.test(page), 'portal page shows the photo beside the name (and so on Print / PDF)');
ok(page.includes('onError={() => setPhotoUrl(null)}'), 'a broken / expired photo link simply hides the image');
ok(read('src/lib/memberPortalView.ts').includes('photoPath?: string | null;'), 'snapshot type carries photoPath (optional — older payloads still parse)');

console.log(`member-portal-photo: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
