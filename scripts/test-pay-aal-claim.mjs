// ADR-0012 live-auth check (task-1 / task-5 foundation). Proves the JWT claim the AAL2 gate rests on:
// a real staging session carries `aal: 'aal1'` after password sign-in, and transitions to
// `aal: 'aal2'` after enrolling + verifying a native TOTP factor — so the migration-114 policies
// (`auth.jwt()->>'aal' = 'aal2'`) are enforceable. Reads test creds from .env.staging.local; never
// hard-codes secrets. Cleans up the factor it enrols. Imports the repo's real src/lib/totp.ts.
//
// Run (from the schema worktree, needs @supabase/supabase-js + .env.staging.local):
//   node scripts/test-pay-aal-claim.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const { totp } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/lib/totp.ts')).href);

function env(key) {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(process.cwd(), '.env.staging.local');
  const m = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').match(new RegExp('^' + key + '=(.*)$', 'm')) : null;
  return m ? m[1].trim() : '';
}

const URL = env('SUPABASE_URL'), ANON = env('SUPABASE_ANON_KEY');
const EMAIL = env('RLS_TEST_A_EMAIL'), PASSWORD = env('RLS_TEST_A_PASSWORD');
if (!URL || !ANON || !EMAIL || !PASSWORD) { console.log('SKIP — missing SUPABASE_URL/ANON/RLS_TEST_A creds'); process.exit(0); }

const aalOf = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')).aal;

// TOTP is time-based; this box's clock may be skewed vs the Supabase server (e.g. a sandbox clock).
// Read the server's own time from a response Date header so codes match the server's window.
async function serverNowMs() {
  try {
    const res = await fetch(URL + '/auth/v1/health', { headers: { apikey: ANON } });
    const d = res.headers.get('date');
    if (d) return new Date(d).getTime();
  } catch { /* fall back to local */ }
  return Date.now();
}
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };

const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  // 1. password sign-in → aal1
  const { data: si, error: e1 } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (e1) throw new Error('sign-in failed: ' + e1.message);
  const aal1 = aalOf(si.session.access_token);
  ok(aal1 === 'aal1', `password-only session carries aal='aal1' (got '${aal1}')`);

  // clean any leftover factors from a prior run
  const { data: fl } = await sb.auth.mfa.listFactors();
  for (const f of [...(fl?.totp ?? []), ...(fl?.all ?? [])]) { try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ } }

  // 2. enrol a native TOTP factor
  const { data: en, error: e2 } = await sb.auth.mfa.enroll({ factorType: 'totp' });
  if (e2) throw new Error('enroll failed: ' + e2.message);
  const factorId = en.id;
  const secret = en.totp.secret;
  ok(!!secret, 'native TOTP factor enrolled (secret returned)');

  // 3. challenge + verify with a generated code → step up to aal2 (retry once across a step boundary)
  let verified = null, lastErr = null;
  const baseMs = await serverNowMs();
  const skewSec = Math.round((baseMs - Date.now()) / 1000);
  if (Math.abs(skewSec) > 30) console.log(`  (local↔server clock skew ~${skewSec}s — generating TOTP at server time)`);
  // try the server's current step and its neighbours (covers step boundaries + small skew)
  const offsets = [0, 30000, -30000, 60000, -60000];
  for (const off of offsets) {
    if (verified) break;
    const code = await totp(secret, baseMs + off);
    const { data: ch, error: ec } = await sb.auth.mfa.challenge({ factorId });
    if (ec) { lastErr = ec; continue; }
    const { data: vf, error: ev } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    if (ev) { lastErr = ev; continue; }
    verified = vf;
  }
  if (!verified) throw new Error('verify failed: ' + (lastErr?.message ?? 'unknown'));

  // 4. the stepped-up session's JWT must carry aal2 (what the RLS gate checks)
  const aal2 = aalOf(verified.access_token);
  ok(aal2 === 'aal2', `after a completed TOTP factor the session carries aal='aal2' (got '${aal2}')`);

  // 5. cleanup — leave the test user as we found it
  const { error: eu } = await sb.auth.mfa.unenroll({ factorId });
  ok(!eu, 'test factor unenrolled (cleanup)');

  await sb.auth.signOut();
} catch (e) {
  fail++; console.error('  ✗ FATAL:', e.message);
  try { await sb.auth.signOut(); } catch { /* ignore */ }
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay aal-claim — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
