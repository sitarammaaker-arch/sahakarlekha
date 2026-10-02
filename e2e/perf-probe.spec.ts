/**
 * J5 probe · measures (does not assert) what an app load costs after login on staging: time to a usable
 * dashboard, Supabase request count, the slowest requests, and paging round-trips. Numbers land in the CI log.
 */
import { test } from '@playwright/test';
import { HAS_LOGIN, EMAIL, PASSWORD } from './helpers';

test.skip(!HAS_LOGIN, 'staging login not set');

test('perf probe: login → dashboard data load', async ({ page }) => {
  const reqs: { url: string; start: number; end?: number; status?: number; bytes?: number }[] = [];
  const t0 = Date.now();
  page.on('request', r => { if (r.url().includes('.supabase.co/')) reqs.push({ url: r.url(), start: Date.now() - t0 }); });
  page.on('requestfinished', async r => {
    const e = reqs.find(x => x.url === r.url() && x.end === undefined);
    if (!e) return;
    e.end = Date.now() - t0;
    try { const res = await r.response(); e.status = res?.status(); e.bytes = (await res?.body())?.length; } catch { /* ignore */ }
  });
  await page.goto('/login');
  await page.getByPlaceholder('your@email.com').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  const tClick = Date.now() - t0;
  await page.getByRole('button', { name: /लॉगिन|Login/ }).click();
  await page.waitForURL(/\/(dashboard|my-dashboard)/, { timeout: 30_000 });
  const tUrl = Date.now() - t0;
  await page.getByText('डेटा लोड हो रहा है...').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});
  const tReady = Date.now() - t0;
  await page.waitForLoadState('networkidle');
  const tIdle = Date.now() - t0;

  const rest = reqs.filter(r => r.url.includes('/rest/v1/') && r.start >= tClick);
  const tables = new Map<string, number>();
  for (const r of rest) { const m = r.url.match(/\/rest\/v1\/(?:rpc\/)?([a-z_0-9]+)/); if (m) tables.set(m[1], (tables.get(m[1]) ?? 0) + 1); }
  const slow = [...rest].filter(r => r.end).sort((a, b) => (b.end! - b.start) - (a.end! - a.start)).slice(0, 8);
  const afterClick = rest.filter(r => r.start >= tClick);
  const firstStart = Math.min(...afterClick.map(r => r.start)), lastEnd = Math.max(...afterClick.map(r => r.end ?? 0));
  console.log(`[perf] login click→dashboard URL ${tUrl - tClick} ms; click→data ready ${tReady - tClick} ms; click→network idle ${tIdle - tClick} ms`);
  console.log(`[perf] supabase REST requests after login: ${afterClick.length} (first ${firstStart - tClick} ms, last end ${lastEnd - tClick} ms after click); bytes ${Math.round(afterClick.reduce((s, r) => s + (r.bytes ?? 0), 0) / 1024)} KB`);
  console.log(`[perf] distinct tables/rpcs: ${tables.size}; repeated: ${[...tables].filter(([, n]) => n > 1).map(([t, n]) => `${t}×${n}`).join(', ')}`);
  for (const r of reqs.filter(x => /\/rest\/v1\/(vouchers|society_settings)\?/.test(x.url))) console.log(`[perf] dup? start+${r.start - tClick} ms  ${r.url.replace(/^.*\/rest\/v1\//, '').slice(0, 110)}`);
  for (const r of slow) console.log(`[perf] slow ${String(r.end! - r.start).padStart(5)} ms  start+${r.start - tClick}  ${r.url.replace(/^.*\/rest\/v1\//, '').slice(0, 90)}`);
});
