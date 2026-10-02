/**
 * I7 core flow · RULE 1 end to end ("लोकल में सेव हो रहा है, Supabase में नहीं" must be impossible):
 * log in to the staging demo society, save a voucher through the real UI, RELOAD the page (wiping
 * local state), and the voucher must still be there — i.e. it reached the cloud.
 * Skipped unless E2E_EMAIL / E2E_PASSWORD (the staging test login) are set.
 */
import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('your@email.com').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /लॉगिन|Login/ }).click();
  await page.waitForURL(/\/(dashboard|my-dashboard)/, { timeout: 30_000 });
}

test('a voucher saved in the UI survives a reload (it reached the cloud)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);

  // Books loaded fully from staging — no read-only / incomplete-data banner (F1).
  await expect(page.getByText(/entry बंद है|entry is paused/)).toHaveCount(0);

  // A unique, traceable entry for this run.
  const tag = `E2E-${Date.now()}`;
  const amount = String(100 + (Date.now() % 800));

  await page.goto('/vouchers');
  await page.getByText('प्रवेश शुल्क', { exact: true }).first().click();   // template: admission-fee receipt
  await page.getByRole('spinbutton', { name: '0' }).fill(amount);   // exact amount box (placeholder '0' also substring-matches the voucher no.)
  await page.getByPlaceholder('विवरण...').fill(tag);
  await page.getByRole('button', { name: 'सहेजें' }).click();

  // No red "cloud save failed" toast.
  await expect(page.getByText(/cloud par save NAHI|Cloud save fail|सेव नहीं हुआ/)).toHaveCount(0, { timeout: 8_000 });

  // Visible in the list now …
  await page.getByRole('button', { name: /सूची/ }).click();
  await expect(page.getByText(tag)).toBeVisible();

  // … and still there after a full reload: local state is gone, so it came back from Supabase.
  await page.reload();
  await page.getByRole('button', { name: /सूची/ }).click();
  await expect(page.getByText(tag)).toBeVisible({ timeout: 30_000 });

  expect(errors, errors.join('\n')).toEqual([]);
});
