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
