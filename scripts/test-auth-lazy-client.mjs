// SEO-13 part 2 (product audit 2026-11-17): AuthProvider and error reporting take the Supabase client through
// lib/supabaseLazy (a dynamic import), so supabase-js (51 KB gzip) is off every public page's entry path.
// This test renders the REAL AuthProvider (happy-dom, esbuild bundle) against a programmable fake client and drives
// the flows that now wait for the client: restore on mount, the auth-state subscription (and its cleanup, also when
// the page unmounts before the client arrives), password login, wrong password, 2FA challenge + verify, logout and
// password reset. Plus: no module on main.tsx's static import graph imports @/lib/supabase.
// Run: node scripts/test-auth-lazy-client.mjs
import { build } from 'esbuild';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. static graph: nothing on main.tsx's static imports reaches @/lib/supabase ──
{
  const res = (spec, from) => {
    let base;
    if (spec.startsWith('@/')) base = resolve(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null;
    for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx', base]) if (existsSync(c) && /\.(ts|tsx)$/.test(c)) return c;
    return null;
  };
  const seen = new Map();
  const walk = (f) => {
    if (seen.has(f)) return;
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const deps = [...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)].map((m) => res(m[1], f)).filter(Boolean);
    seen.set(f, deps);
    deps.forEach(walk);
  };
  walk(resolve(SRC, 'main.tsx'));
  const target = resolve(SRC, 'lib/supabase.ts');
  const importers = [...seen].filter(([, d]) => d.includes(target)).map(([f]) => f.replace(SRC, 'src').replace(/\\/g, '/'));
  ok(seen.size > 20 && importers.length === 0, `no module on main.tsx's static graph imports @/lib/supabase (${importers.join(', ') || 'none'}; ${seen.size} modules walked)`);
  ok(/import \{ getSupabase[^}]*\} from '@\/lib\/supabaseLazy'/.test(readFileSync(resolve(SRC, 'contexts/AuthContext.tsx'), 'utf8')) && readFileSync(resolve(SRC, 'lib/errorReporting.ts'), 'utf8').includes("import { getSupabase } from '@/lib/supabaseLazy'"), 'AuthContext and errorReporting take the client through getSupabase()');
  const lazy = readFileSync(resolve(SRC, 'lib/supabaseLazy.ts'), 'utf8');
  ok(lazy.includes("import('@/lib/supabase')") && lazy.includes('pending = null;'), 'getSupabase loads the client once, and a failed load can be retried');
}

// ── 2. behaviour: the real AuthProvider against a fake client ──
const FAKE_SUPABASE = `
const S = () => globalThis.__auth;
export const supabase = {
  from: (table) => {
    const q = { table, filters: [] };
    const chain = { select: () => chain, eq: (k, v) => { q.filters.push([k, v]); return chain; }, maybeSingle: async () => S().row(q) };
    return chain;
  },
  rpc: async (name, args) => { S().calls.push(['rpc', name, args]); return S().rpc(name, args); },
  auth: {
    getSession: async () => { S().calls.push(['getSession']); return { data: { session: S().session } }; },
    onAuthStateChange: (cb) => { S().calls.push(['subscribe']); S().listener = cb; return { data: { subscription: { unsubscribe: () => S().calls.push(['unsubscribe']) } } }; },
    signInWithPassword: async (c) => { S().calls.push(['signIn', c.email]); return S().signIn(c); },
    signOut: async (o) => { S().calls.push(['signOut', o?.scope || 'global']); return { error: null }; },
    refreshSession: async () => { S().calls.push(['refresh']); return { data: { session: { access_token: S().token } }, error: null }; },
    resetPasswordForEmail: async (email) => { S().calls.push(['reset', email]); return { error: null }; },
    signUp: async () => ({ error: null }),
  },
};
export default supabase;
`;
const ENTRY = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
export function mount(onCtx) {
  const Probe = () => { onCtx(useAuth()); return null; };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  return root;
}
export { act };
`;
const resolveSrc = (rel) => { const b = resolve(SRC, rel); for (const c of [b + '.ts', b + '.tsx', b + '/index.ts', b + '/index.tsx']) if (existsSync(c)) return c; return b; };
const dir = resolve(tmpdir(), 'sl-auth-lazy');
mkdirSync(dir, { recursive: true });
const out = resolve(dir, 'auth.mjs');
await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'js' },
  bundle: true, platform: 'browser', format: 'esm', outfile: out, write: true, logLevel: 'error',
  jsx: 'automatic', loader: { '.ts': 'ts', '.tsx': 'tsx' },
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"test"' },
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase$/ }, (a) => ({ path: a.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: FAKE_SUPABASE, loader: 'js' }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: resolveSrc(a.path.slice(2)) }));
  } }],
});
GlobalRegistrator.register({ url: 'https://app.sahakarlekha.test/' });   // not localhost: no demo-user path
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const M = await import(pathToFileURL(out).href + '?t=' + Date.now());
const tok = (payload) => 'h.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.s';
const ROW = { id: 'u1', name: 'Ram', email: 'ram@x.test', role: 'accountant', society_id: 'S1', is_active: true, mfa_enabled: false, branch_id: null };
const fresh = (over = {}) => {
  globalThis.__auth = { calls: [], session: null, token: tok({ mfa_pending: false }), listener: null,
    row: async () => ({ data: null, error: null }), rpc: async () => ({ data: null, error: null }),
    signIn: async () => ({ data: { user: null }, error: { message: 'Invalid login credentials', status: 400 } }), ...over };
  window.localStorage.clear();
  // supabase-js keeps a signed-in session under sb-<project>-auth-token — that is what tells AuthProvider to restore
  if (over.session) window.localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: over.session.user }));
  return globalThis.__auth;
};
const settle = async () => { for (let i = 0; i < 6; i++) await M.act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const has = (S, ...c) => S.calls.some((x) => c.every((v, i) => x[i] === v));

// 0. FIRST (the loaded-client promise is module state): a visitor who never signed in does not load the client at
//    mount; signing in loads it, and only then does the auth-state subscription attach (no late restore racing it)
{
  const S = fresh({ signIn: async () => ({ data: { user: { id: 'u1', user_metadata: {} } }, error: null }), row: async () => ({ data: ROW, error: null }) });
  let ctx; const root = M.mount((c) => { ctx = c; });
  await settle();
  ok(!has(S, 'getSession') && !has(S, 'subscribe'), 'anonymous visitor: the client is not loaded on mount (no getSession, no subscription)');
  let r; await M.act(async () => { r = await ctx.login('ram@x.test', 'pw'); });
  await settle();
  ok(r?.status === 'ok' && has(S, 'subscribe') && !has(S, 'getSession'), 'after a sign-in loads the client: the subscription attaches, the empty restore is not re-run');
  M.act(() => root.unmount());
  ok(has(S, 'unsubscribe'), 'and unmount unsubscribes it');
}
// a. restore on mount: the client arrives, the stored session becomes the user, the subscription is made
{
  const S = fresh({ session: { access_token: tok({ mfa_pending: false }), user: { id: 'u1', email: 'ram@x.test' } }, row: async () => ({ data: ROW, error: null }) });
  let ctx; const root = M.mount((c) => { ctx = c; });
  await settle();
  ok(has(S, 'getSession') && has(S, 'subscribe'), 'on mount: getSession and the auth-state subscription run once the client has loaded');
  ok(ctx.isAuthenticated && ctx.user?.email === 'ram@x.test' && ctx.user?.societyId === 'S1', 'a stored session restores the signed-in user');
  M.act(() => root.unmount());
  ok(has(S, 'unsubscribe'), 'unmount unsubscribes');
}
// b. unmount BEFORE the client arrives: no subscription is left behind
{
  const S = fresh();
  const root = M.mount(() => {});
  M.act(() => root.unmount());
  await settle();
  ok(!has(S, 'subscribe') || has(S, 'unsubscribe'), 'unmounted before the client loaded: nothing stays subscribed');
}
// c. SIGNED_OUT from the subscription logs the tab out
{
  const S = fresh({ session: { access_token: tok({ mfa_pending: false }), user: { id: 'u1', email: 'ram@x.test' } }, row: async () => ({ data: ROW, error: null }) });
  let ctx; const root = M.mount((c) => { ctx = c; });
  await settle();
  M.act(() => S.listener('SIGNED_OUT', null));
  await settle();
  ok(!ctx.isAuthenticated, 'a SIGNED_OUT event from the client signs the tab out');
  M.act(() => root.unmount());
}
// d. password login, wrong password, 2FA, logout, reset
{
  const S = fresh({ signIn: async () => ({ data: { user: { id: 'u1', user_metadata: {} } }, error: null }), row: async () => ({ data: ROW, error: null }) });
  let ctx; const root = M.mount((c) => { ctx = c; });
  await settle();
  let r; await M.act(async () => { r = await ctx.login('ram@x.test', 'pw'); });
  await settle();
  ok(r?.status === 'ok' && has(S, 'signIn', 'ram@x.test') && ctx.user?.email === 'ram@x.test', 'login: signInWithPassword through the lazy client, then the society user → status ok');

  S.signIn = async () => ({ data: { user: null }, error: { message: 'Invalid login credentials', status: 400 } });
  await M.act(async () => { r = await ctx.login('ram@x.test', 'bad'); });
  ok(r?.status === 'failed' && r.reason === 'credentials', 'wrong password → failed / credentials (not a network error)');

  await M.act(async () => { await ctx.logout(); });
  await settle();
  ok(has(S, 'signOut') && !ctx.isAuthenticated, 'logout signs out through the lazy client and clears the user');

  S.signIn = async () => ({ data: { user: { id: 'u1', user_metadata: {} } }, error: null });
  S.row = async () => ({ data: { ...ROW, mfa_enabled: true }, error: null });
  await M.act(async () => { r = await ctx.login('ram@x.test', 'pw'); });
  ok(r?.status === 'mfa' && !ctx.isAuthenticated, '2FA user: login stops at the challenge');
  S.rpc = async (name) => (name === 'app_verify_mfa' ? { data: true, error: null } : { data: null, error: null });
  let v; await M.act(async () => { v = await ctx.verifyMfaCode('123456'); });
  await settle();
  ok(v === true && has(S, 'rpc', 'app_verify_mfa') && has(S, 'refresh') && ctx.isAuthenticated, '2FA verify: server check + refreshed session through the lazy client → signed in');

  let p; await M.act(async () => { p = await ctx.sendPasswordReset('ram@x.test'); });
  ok(p?.success && p.isEmailSent && has(S, 'reset', 'ram@x.test'), 'password reset is sent through the lazy client');
  M.act(() => root.unmount());
}

console.log(`auth lazy client (SEO-13 part 2): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
