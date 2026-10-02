/**
 * I7 core flow · RULE 1 end to end ("लोकल में सेव हो रहा है, Supabase में नहीं" must be impossible):
 * log in to the staging demo society, save a voucher through the real UI, RELOAD the page (wiping
 * local state), and the voucher must still be there — i.e. it reached the cloud.
 */
import { test, expect } from '@playwright/test';
import { HAS_LOGIN, login, createVoucher, openList } from './helpers';

test.skip(!HAS_LOGIN, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

test('a voucher saved in the UI survives a reload (it reached the cloud)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);
  const tag = await createVoucher(page);

  await openList(page);
  await expect(page.getByText(tag)).toBeVisible();

  await page.reload();
  await openList(page);
  await expect(page.getByText(tag)).toBeVisible({ timeout: 30_000 });
  expect(errors, errors.join('\n')).toEqual([]);
});
