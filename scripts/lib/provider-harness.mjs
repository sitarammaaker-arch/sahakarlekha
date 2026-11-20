// TEST-01 (product audit 2026-11-17) — a provider-contract harness: the REAL DataProvider, rendered by React in a
// happy-dom window, against a fake Supabase client the test programs. A source pin cannot catch a wrong rollback, a
// stale closure or an argument mix-up; calling the real add* / update* / delete* and reading the real state can.
//
//   const h = await mountDataProvider();          // renders <DataProvider>, waits for the load
//   h.respond((q) => q.table === 'employees' && q.op === 'update' ? { error: { message: 'boom' } } : undefined);
//   h.ctx().updateEmployee(id, { phone: '9' });   // the real function
//   await h.settle();                             // flush promises + React updates
//   h.ctx().employees, h.toasts, h.calls          // what the user would see / what was sent
//
// Fakes (esbuild aliases): @/lib/supabase → a chainable recorder; @/contexts/AuthContext → a fixed admin user;
// @/hooks/use-toast → records every toast. Everything else is the shipped code.
import { build } from 'esbuild';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = resolve(ROOT, 'src');

const FAKE_SUPABASE = `
const h = () => globalThis.__harness;
const WRITE = new Set(['insert', 'upsert', 'update', 'delete']);
function query(table) {
  const q = { table, op: 'select', ops: [], payload: undefined, filters: [] };
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => h().answer(q).then(res, rej);
      if (prop === 'catch') return (rej) => h().answer(q).catch(rej);
      if (prop === 'finally') return (f) => h().answer(q).finally(f);
      return (...args) => {
        q.ops.push([prop, args]);
        if (WRITE.has(prop)) { q.op = prop; q.payload = args[0]; }
        else if (['eq', 'neq', 'in', 'is', 'match'].includes(prop)) q.filters.push([prop, ...args]);
        return proxy;
      };
    },
  });
  return proxy;
}
const auth = new Proxy({}, { get: (_t, p) => (p === 'onAuthStateChange'
  ? () => ({ data: { subscription: { unsubscribe() {} } } })
  : async () => ({ data: { session: null, user: null }, error: null })) });
const channel = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: async () => ({}) }; return c; };
export const supabase = {
  from: (t) => query(t),
  rpc: (name, args) => { const q = { table: 'rpc:' + name, op: 'rpc', ops: [], payload: args, filters: [] }; return { then: (res, rej) => h().answer(q).then(res, rej) }; },
  auth, channel, removeChannel: async () => ({}),
  storage: { from: () => ({ upload: async () => ({ data: null, error: null }), download: async () => ({ data: null, error: null }), list: async () => ({ data: [], error: null }), remove: async () => ({ data: null, error: null }), createSignedUrl: async () => ({ data: null, error: null }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};
export default supabase;
`;
const FAKE_AUTH = `
export const useAuth = () => globalThis.__harness.auth;
export const AuthProvider = ({ children }) => children;
export default { useAuth };
`;
const FAKE_TOAST = `
const toast = (t) => { globalThis.__harness.toasts.push(t); return { id: String(globalThis.__harness.toasts.length), dismiss() {}, update() {} }; };
export const useToast = () => ({ toast, toasts: [], dismiss() {} });
export { toast };
`;
const ENTRY = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { DataProvider, useData } from '@/contexts/DataContext';
import { HousingProvider, useHousingData } from '@/contexts/HousingDataContext';
import { MarketingProvider, useMarketingData } from '@/contexts/MarketingDataContext';
import { LabourProvider, useLabourData } from '@/contexts/LabourDataContext';
import { DairyProvider, useDairyData } from '@/contexts/DairyDataContext';
import { TransportOpsProvider, useTransportOps } from '@/contexts/TransportOpsContext';
import { ConsumerProvider, useConsumerData } from '@/contexts/ConsumerDataContext';
// The domain providers sit INSIDE DataProvider, as in the app; each one is the shipped code.
const DOMAINS = [
  ['housing', HousingProvider, useHousingData], ['marketing', MarketingProvider, useMarketingData],
  ['labour', LabourProvider, useLabourData], ['dairy', DairyProvider, useDairyData],
  ['transport', TransportOpsProvider, useTransportOps], ['consumer', ConsumerProvider, useConsumerData],
];
export function mount(onCtx, withDomains) {
  const list = withDomains ? DOMAINS : [];
  const Probe = () => { const v = { data: useData() }; for (const [k, , use] of list) v[k] = use(); onCtx(v); return null; };
  let tree = React.createElement(Probe);
  for (let i = list.length - 1; i >= 0; i--) tree = React.createElement(list[i][1], null, tree);
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(DataProvider, null, tree)); });
  return root;
}
export { act };
`;

let bundled;
async function bundle() {
  if (bundled) return bundled;
  const dir = resolve(tmpdir(), 'sl-provider-harness');
  mkdirSync(dir, { recursive: true });
  const fakes = { '@/lib/supabase': FAKE_SUPABASE, '@/contexts/AuthContext': FAKE_AUTH, '@/hooks/use-toast': FAKE_TOAST };
  const out = resolve(dir, 'provider.mjs');
  await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'js' },
    bundle: true, platform: 'browser', format: 'esm', outfile: out, write: true, logLevel: 'error',
    jsx: 'automatic', loader: { '.ts': 'ts', '.tsx': 'tsx' },
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'false', 'import.meta.env.MODE': '"test"' },
    plugins: [{
      name: 'harness-fakes',
      setup(b) {
        b.onResolve({ filter: /^@\/(lib\/supabase|contexts\/AuthContext|hooks\/use-toast)$/ }, (a) => ({ path: a.path, namespace: 'fake' }));
        b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: fakes[a.path], loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (a) => ({ path: resolveSrc(a.path.slice(2)) }));
      },
    }],
  });
  bundled = await import(pathToFileURL(out).href + '?t=' + Date.now());
  return bundled;
}
function resolveSrc(rel) {
  const base = resolve(SRC, rel);
  for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']) if (existsSync(c)) return c;
  return base;   // has its own extension (.json, .css, …)
}

/** Render the real DataProvider and wait for its load. `seed` = rows per table returned by the load's selects.
 *  `domains: true` also mounts the six domain providers inside it (domain('housing') etc. reads their context). */
export async function mountDataProvider({ seed = {}, user, domains = false } = {}) {
  if (!globalThis.window) GlobalRegistrator.register({ url: 'http://localhost/' });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  const toasts = [];
  let responder = () => undefined;
  const harness = {
    auth: { user: user ?? { id: 'u1', name: 'Harness Admin', email: 'admin@harness.test', role: 'admin', societyId: 'SOC-H' }, isAuthenticated: true },
    toasts,
    answer(q) {
      calls.push(q);
      const custom = responder(q);
      if (custom !== undefined) return Promise.resolve(custom);
      if (q.op === 'select') {
        const rows = seed[q.table] ?? [];
        const single = q.ops.some(([m]) => m === 'maybeSingle' || m === 'single');
        return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length });
      }
      if (q.op === 'rpc') return Promise.resolve({ data: null, error: null });
      // a write: echo the id(s) so `.select('id')` reads "1 row changed"
      const idF = q.filters.find(([m, c]) => m === 'eq' && c === 'id');
      const ids = idF ? [idF[2]] : [].concat(q.payload ?? []).map((r) => r && r.id).filter(Boolean);
      return Promise.resolve({ data: ids.map((id) => ({ id })), error: null });
    },
  };
  globalThis.__harness = harness;
  const { mount, act } = await bundle();
  let all;
  mount((c) => { all = c; }, domains);
  const settle = async (ms = 30) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
  await settle(80);
  return {
    ctx: () => all.data,
    domain: (name) => all[name],
    calls,
    toasts,
    settle,
    act,
    respond(fn) { responder = fn; },
    reset() { calls.length = 0; toasts.length = 0; responder = () => undefined; },
    writes: (table) => calls.filter((q) => q.table === table && q.op !== 'select'),
    destructive: () => toasts.filter((t) => t.variant === 'destructive'),
  };
}
