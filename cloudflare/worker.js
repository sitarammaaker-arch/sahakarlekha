// Cloudflare Worker for sahakarlekha.com (2026-11-21, after the Vercel team pause).
//
// Cloudflare serves every request that matches a file in dist/ by itself (with dist/_headers). This Worker runs
// ONLY when no file matches, and does what vercel.json did for those paths — from the same rules
// (cloudflare/routes.generated.json, generated from vercel.json by scripts/cloudflare-config.mjs):
//   1. POST /api/subscribe  → the welcome email (port of api/subscribe.ts)
//   2. a trailing slash     → 308 to the address without it (Vercel trailingSlash: false)
//   3. a redirect rule      → 308 / 307 (the 157 vercel.json redirects, incl. /en/<app page> → Hindi page)
//   4. an app route         → the SPA shell (dist/index.html), 200, with the route's headers (X-Robots-Tag)
//   5. anything else        → dist/404.html with status 404 (no soft 404s — SEO-01)
import routes from './routes.generated.json' with { type: 'json' };
import { handleSubscribe } from './subscribe.js';

const compiled = {
  redirects: routes.redirects.map((r) => ({ re: new RegExp(r.re), to: r.to, status: r.status })),
  spa: routes.spa.map((s) => new RegExp(s)),
  headers: routes.headers.map((h) => ({ re: new RegExp(h.re), set: h.set })),
};

/** Fill :name / :name* placeholders in a Vercel destination from the match's named groups. */
export function fillDestination(to, groups = {}) {
  return to.replace(/\/:([A-Za-z_]\w*)\*/g, (_m, k) => groups[k] ?? '').replace(/:([A-Za-z_]\w*)/g, (_m, k) => groups[k] ?? '');
}

/** Every header rule that matches the path, merged in vercel.json order (later wins, like Vercel). */
export function headersFor(path) {
  const out = {};
  for (const h of compiled.headers) if (h.re.test(path)) Object.assign(out, h.set);
  return out;
}

const withHeaders = (res, extra) => {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
};

/** Pure routing decision (exported for tests): what to do with a path that matched no file. */
export function route(path) {
  if (path.length > 1 && path.endsWith('/')) return { kind: 'redirect', to: path.replace(/\/+$/, '') || '/', status: 308 };
  for (const r of compiled.redirects) {
    const m = r.re.exec(path);
    if (m) return { kind: 'redirect', to: fillDestination(r.to, m.groups), status: r.status };
  }
  if (compiled.spa.some((re) => re.test(path))) return { kind: 'spa' };
  return { kind: 'notfound' };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/subscribe') return handleSubscribe(request, env);

    const decision = route(url.pathname);
    if (decision.kind === 'redirect') {
      const target = new URL(decision.to, url.origin);
      target.search = url.search;
      return new Response(null, { status: decision.status, headers: { Location: target.toString(), ...headersFor(url.pathname) } });
    }
    if (decision.kind === 'spa') {
      // Ask for "/", not "/index.html": with html_handling drop-trailing-slash the assets binding answers
      // /index.html with a redirect to "/" (empty body) — the shell must be the HTML itself.
      const shell = await env.ASSETS.fetch(new Request(new URL('/', url.origin), { method: 'GET', headers: request.headers }));
      if (!shell.ok) return shell;
      const res = new Response(shell.body, { status: 200, headers: shell.headers });
      res.headers.delete('Location');
      return withHeaders(res, headersFor(url.pathname));
    }
    // Unknown path: let the assets binding answer — not_found_handling "404-page" serves dist/404.html with 404.
    const res = await env.ASSETS.fetch(request);
    return withHeaders(res, headersFor(url.pathname));
  },
};
