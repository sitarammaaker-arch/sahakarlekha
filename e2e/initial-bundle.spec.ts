/**
 * J1 guard · the first page load must not download the heavy feature bundles. Before J1, Rollup hoisted
 * React/clsx into "charts" and Vite's preload helper into "pdf", so every page (landing, blog, login)
 * pulled recharts + jspdf/html2canvas (~350 KB gzip) it never used. Production build (vite preview).
 */
import { test, expect } from '@playwright/test';

test('login page downloads no pdf / charts / xlsx chunk', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', r => { if (r.resourceType() === 'script' || r.url().endsWith('.js')) scripts.push(r.url()); });
  await page.goto('/login');
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const heavy = scripts.filter(u => /\/assets\/(pdf|charts|xlsx)-[^/]+\.js$/.test(u));
  expect(heavy, heavy.join('\n')).toEqual([]);
});

test('landing page downloads no pdf / charts / xlsx chunk', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', r => { if (r.url().endsWith('.js')) scripts.push(r.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const heavy = scripts.filter(u => /\/assets\/(pdf|charts|xlsx)-[^/]+\.js$/.test(u));
  expect(heavy, heavy.join('\n')).toEqual([]);
});

// J2 · article bodies are lazy chunks: list pages must not download any, and an article page must load its
// own body and render it (headings from the markdown).
test('landing and blog index download no article-body chunk', async ({ page }) => {
  const bodies: string[] = [];
  page.on('request', r => { if (/\/assets\/cooperative-accounting-basics-[^/]+\.js$/.test(r.url())) bodies.push(r.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.goto('/blog');
  await page.waitForLoadState('networkidle');
  expect(bodies, bodies.join('\n')).toEqual([]);
});

test('an article page loads and renders its own body', async ({ page }) => {
  await page.goto('/blog/cooperative-accounting-basics');
  await expect(page.getByRole('heading', { name: 'लेखांकन है क्या?' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/मिनट/).first()).toBeVisible();
});

// J6 · logged out there is no society to load. DataContext used to load the placeholder 'SOC001' —
// ~41 Supabase requests on EVERY public page view (vouchers, members, accounts …), all returning nothing.
const PUBLIC_OK = /\/rest\/v1\/(rpc\/public_reviews|public_reviews|blog_post_views|rpc\/increment_blog_view|rpc\/get_blog_view_count)\b/;
for (const path of ['/', '/blog', '/blog/cooperative-accounting-basics', '/login']) {
  test(`public page ${path} makes no society-data request`, async ({ page }) => {
    const bad: string[] = [];
    page.on('request', r => { const u = r.url(); if (u.includes('.supabase.co/rest/v1/') && !PUBLIC_OK.test(u)) bad.push(u.replace(/^.*\/rest\/v1\//, '').slice(0, 80)); });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(bad, bad.join('\n')).toEqual([]);
  });
}

// L1 · a blog body chunk that cannot load (stale after a deploy / weak network) must NOT bounce the reader
// to /blog. The page reloads once to pick up the fresh build; if the chunk still fails it shows a reload
// message on the article URL.
test('an article whose body chunk fails shows a reload message, not a redirect', async ({ page }) => {
  let blocked = 0;
  await page.route(/\/assets\/cooperative-accounting-basics-[^/]+\.js$/, (r) => { blocked++; return r.abort(); });
  await page.goto('/blog/cooperative-accounting-basics');
  await expect(page.getByText('लेख लोड नहीं हो पाया')).toBeVisible({ timeout: 20_000 });
  expect(page.url()).toContain('/blog/cooperative-accounting-basics');
  await expect(page.getByRole('button', { name: 'पेज फिर से लोड करें' })).toBeVisible();
  await page.waitForTimeout(3000);             // a reload loop would keep requesting the chunk
  expect(blocked).toBe(2);                     // the first load + once after the ONE automatic reload — never a loop
});

// L8 · a hand-written glossary link to a term that doesn't exist renders as plain text (it used to
// bounce the reader to the /glossary index); a link to a real term stays a link.
test('article glossary links: missing term → plain text, real term → link', async ({ page }) => {
  await page.goto('/blog/amul-anand-pattern-dairy-cooperative');
  const article = page.locator('article, main').first();
  await expect(article.locator('a[href="/glossary/dairy-cooperative"]').first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('a[href^="/glossary/amul"]').count()).toBe(0);
  expect(await page.locator('a[href="/glossary/anand-pattern"], a[href="/glossary/white-revolution"]').count()).toBe(0);
  await expect(article.getByText('Amul', { exact: false }).first()).toBeVisible();
});
