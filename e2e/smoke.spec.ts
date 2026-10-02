/**
 * I6 smoke · the app boots against STAGING, renders the login page without page errors, and every
 * Supabase request goes to the staging project — never production. Needs no login.
 */
import { test, expect } from '@playwright/test';

const PROD_REF = 'rwffxupenwdtrmyabytk';

test('login page renders against staging, with no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/login');
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
  await expect(page.getByRole('button', { name: /लॉगिन|Login/ })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('no request ever reaches the production project', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', r => { try { hosts.add(new URL(r.url()).host); } catch { /* data: urls */ } });
  await page.goto('/login');
  await page.getByPlaceholder('your@email.com').fill('nobody@sahakarlekha.test');
  await page.getByPlaceholder('••••••••').fill('not-a-real-password');
  await page.getByRole('button', { name: /लॉगिन|Login/ }).click();
  await page.waitForTimeout(3000);
  const supa = [...hosts].filter(h => h.endsWith('.supabase.co'));
  expect([...hosts].some(h => h.includes(PROD_REF)), [...hosts].join(', ')).toBe(false);
  expect(supa.every(h => h.startsWith(new URL(process.env.E2E_SUPABASE_URL!).host.split('.')[0])), supa.join(', ')).toBe(true);
});
