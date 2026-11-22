// Cloudflare hosting (2026-11-21) — the routing Worker gives every path that matches no file the same answer
// vercel.json gave: each of the redirects, the SPA shell for app routes, a real 404 otherwise; /api/subscribe sends
// the same welcome email as api/subscribe.ts. Runs the shipped cloudflare/worker.js + subscribe.js in Node.
// Run: node scripts/test-cloudflare-worker.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = await import(pathToFileURL(resolve(ROOT, 'cloudflare/worker.js')).href);
const Sub = await import(pathToFileURL(resolve(ROOT, 'cloudflare/subscribe.js')).href);
const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── every exact redirect from vercel.json ──
const exact = vercel.redirects.filter((r) => !/[:(]/.test(r.source));
let bad = [];
for (const r of exact) {
  const d = W.route(r.source);
  if (!(d.kind === 'redirect' && d.to === r.destination && d.status === (r.permanent === false ? 307 : 308))) bad.push(`${r.source} → ${JSON.stringify(d)}`);
}
ok(bad.length === 0 && exact.length > 100, `all ${exact.length} exact vercel.json redirects give the same target + status (${bad.slice(0, 3).join(' ; ')})`);

// ── /en redirects with placeholders ──
const d1 = W.route('/en/dashboard');
ok(d1.kind === 'redirect' && d1.to === '/dashboard' && d1.status === 307, `/en/dashboard → 307 /dashboard (got ${JSON.stringify(d1)})`);
const d2 = W.route('/en/vouchers/abc/def');
ok(d2.kind === 'redirect' && d2.to === '/vouchers/abc/def', `/en/vouchers/abc/def keeps the sub-path (got ${JSON.stringify(d2)})`);
const d3 = W.route('/en/guide/quiz/3');
ok(d3.kind === 'redirect' && d3.to === '/guide/quiz/3', `/en/guide/quiz/3 → /guide/quiz/3 (got ${JSON.stringify(d3)})`);
ok(W.route('/en/pricing').kind === 'notfound', '/en/pricing is not redirected (it is a prerendered file Cloudflare serves first)');

// ── SPA shell vs real 404 ──
const appSegs = [...vercel.rewrites.find((r) => !r.source.includes(':path*')).source.match(/^\/\(([^)]+)\)$/)[1].split('|')];
const notSpa = appSegs.filter((s) => W.route(`/${s}`).kind !== 'spa' && W.route(`/${s}`).kind !== 'redirect');
ok(notSpa.length === 0 && appSegs.length > 100, `all ${appSegs.length} app route segments get the SPA shell (missing: ${notSpa.slice(0, 5).join(', ')})`);
ok(W.route('/members/123').kind === 'spa' && W.route('/dashboard').kind === 'spa', 'app sub-paths get the SPA shell');
for (const p of ['/zzz-none', '/en/zzz-none', '/wp-login.php', '/blog/does-not-exist', '/PRICING']) ok(W.route(p).kind === 'notfound', `${p} → real 404`);
const ts = W.route('/dashboard/');
ok(ts.kind === 'redirect' && ts.to === '/dashboard' && ts.status === 308, 'a trailing slash → 308 to the address without it (trailingSlash: false)');

// ── headers ──
const hRoot = W.headersFor('/dashboard');
ok(hRoot['X-Robots-Tag'] === 'noindex' && hRoot['Strict-Transport-Security'] && hRoot['X-Frame-Options'] === 'SAMEORIGIN', 'the SPA shell for an app route carries noindex + the security headers');
ok(!('X-Robots-Tag' in W.headersFor('/zzz-none')) && W.headersFor('/zzz-none')['X-Content-Type-Options'] === 'nosniff', 'the 404 carries the security headers, not the app noindex rule');
ok(W.fillDestination('/:seg/:path*', { seg: 'x', path: '' }) === '/x' && W.fillDestination('/:seg/:path*', { seg: 'x', path: '/a/b' }) === '/x/a/b', 'destination placeholders fill like Vercel');

// ── fetch(): the SPA shell is the real HTML even though /index.html redirects ──
{
  const calls = [];
  const ASSETS = { fetch: async (req) => { const u = new URL(req.url); calls.push(u.pathname); return u.pathname === '/' ? new Response('<html>shell</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) : u.pathname === '/index.html' ? new Response(null, { status: 307, headers: { Location: '/' } }) : new Response('not found page', { status: 404 }); } };
  const r = await W.default.fetch(new Request('https://sahakarlekha.com/dashboard'), { ASSETS });
  ok(r.status === 200 && (await r.text()) === '<html>shell</html>' && !r.headers.get('Location') && calls[0] === '/', 'app route: 200 with the shell HTML (asks for "/", no Location header leaks)');
  const n = await W.default.fetch(new Request('https://sahakarlekha.com/zzz-none'), { ASSETS });
  ok(n.status === 404 && n.headers.get('X-Content-Type-Options') === 'nosniff', 'unknown path: 404 from the assets 404 page, with security headers');
  ok(n.headers.get('Cache-Control') === 'no-store', 'unknown path: the 404 is never cached');
  const old = await W.default.fetch(new Request('https://sahakarlekha.com/assets/AppDataShell-oldhash.js'), { ASSETS });
  ok(old.status === 404 && old.headers.get('Cache-Control') === 'no-store' && !/immutable/.test(old.headers.get('Cache-Control') || ''), 'a missing /assets file (old chunk after a deploy): 404 with no-store, NOT the one-year immutable cache of real assets');
  ok(/immutable/.test(W.headersFor('/assets/x.js')['Cache-Control'] || '') && W.notFoundHeaders('/assets/x.js', 200)['Cache-Control'] === W.headersFor('/assets/x.js')['Cache-Control'], 'a 2xx keeps the path rule (real assets stay immutable)');
  const rd = await W.default.fetch(new Request('https://sahakarlekha.com/guide/adhyay-1?x=1'), { ASSETS });
  ok(rd.status === 308 && rd.headers.get('Location') === 'https://sahakarlekha.com/guide/accounting-foundations?x=1', 'redirect keeps the query string');
}

// ── /api/subscribe ──
{
  const req = (method, body) => new Request('https://sahakarlekha.com/api/subscribe', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  ok((await Sub.handleSubscribe(req('GET'), {})).status === 405, 'GET → 405');
  ok((await Sub.handleSubscribe(req('POST', { email: 'bad' }), {})).status === 400, 'bad email → 400');
  const nc = await (await Sub.handleSubscribe(req('POST', { email: 'a@b.co' }), {})).json();
  ok(nc.sent === false && nc.reason === 'email_not_configured', 'no key → 200 sent:false (lead capture never breaks)');
  let sent;
  const r = await Sub.handleSubscribe(req('POST', { email: 'a@b.co', name: '<img src=x>' }), { RESEND_API_KEY: 'k', RESEND_FROM: 'f@x' }, async (url, init) => { sent = { url, init }; return new Response('{}', { status: 200 }); });
  const body = JSON.parse(sent.init.body);
  ok((await r.json()).sent === true && sent.url === 'https://api.resend.com/emails' && body.to[0] === 'a@b.co' && body.subject === Sub.WELCOME_SUBJECT, 'configured → one Resend call to the given address with the fixed subject');
  ok(!body.html.includes('<img') && body.html.includes('&lt;img'), 'the name is HTML-escaped (no markup injection into the email)');
  const vs = readFileSync(resolve(ROOT, 'api/subscribe.ts'), 'utf8');
  ok(vs.includes(`subject: '${Sub.WELCOME_SUBJECT}'`) && vs.includes('https://sahakarlekha.com/register') && Sub.welcomeHtml('').includes('https://sahakarlekha.com/register'), 'the subject and links match api/subscribe.ts');
}

console.log(`Cloudflare worker: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
