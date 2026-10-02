/**
 * I7 · RULE 3 end to end: a voucher cancelled with a reason leaves the active list, and after a full
 * RELOAD it is in the cancelled list (the cancel reached the cloud, not just local state).
 */
import { test, expect } from '@playwright/test';
import { HAS_LOGIN, login, createVoucher, openList } from './helpers';

test.skip(!HAS_LOGIN, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

test('a cancelled voucher stays cancelled after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);
  const tag = await createVoucher(page, 'E2E-CANCEL');

  await openList(page);
  const row = page.getByRole('row').filter({ hasText: tag });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'वाउचर रद्द करें' }).click();

  const dialog = page.getByRole('alertdialog');
  // The cancelled list shows the cancel REASON in its note column (not the narration), so carry the tag there.
  await dialog.getByPlaceholder('कारण लिखें...').fill(`e2e cancel ${tag}`);
  await dialog.getByRole('button', { name: 'रद्द करें' }).click();
  await expect(page.getByRole('row').filter({ hasText: tag })).toHaveCount(0);   // gone from the active list

  await page.reload();
  await openList(page);
  await expect(page.getByRole('row').filter({ hasText: tag })).toHaveCount(0);    // still not active after reload
  await page.getByRole('button', { name: /^रद्द \(/ }).click();                   // show cancelled
  await expect(page.getByRole('row').filter({ hasText: tag })).toHaveCount(1, { timeout: 30_000 });
  expect(errors, errors.join('\n')).toEqual([]);
});
