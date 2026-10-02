/**
 * I7 · sale → stock, end to end (RULE 1 + RULE 2): sell 1 unit of the seeded staging item through the
 * real Sale form, RELOAD, and the available quantity the form shows must be exactly 1 lower — the sale
 * reached the cloud (post_stock_document) and stock is derived from live records.
 * Needs the staging seed item "E2E परीक्षण वस्तु" (staging-04-seed-stock.sql) and the staging login.
 */
import { test, expect, type Page } from '@playwright/test';
import { HAS_LOGIN, login } from './helpers';

test.skip(!HAS_LOGIN, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

const ITEM = 'E2E परीक्षण वस्तु';

async function openSaleWithItem(page: Page): Promise<number> {
  await page.goto('/sales');
  await page.getByRole('combobox').filter({ hasText: 'वस्तु चुनें' }).first().click();
  await page.getByRole('option', { name: ITEM }).click();
  // The availability badge sits in the item row; it shows the live (movement-derived) quantity.
  const row = page.getByRole('row').filter({ has: page.getByRole('combobox').filter({ hasText: ITEM }) }).first();
  const badge = row.locator('.font-mono').first();
  await expect(badge).toHaveText(/^\d+(\.\d+)?$/);
  return Number(await badge.textContent());
}

test('a sale saved in the UI lowers stock by exactly its quantity, and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);

  const before = await openSaleWithItem(page);
  expect(before).toBeGreaterThan(0);

  await page.getByRole('combobox').filter({ hasText: 'ग्राहक चुनें' }).click();
  await page.getByRole('option', { name: /नकद ग्राहक/ }).click();
  const qty = page.getByRole('row').filter({ has: page.getByRole('combobox').filter({ hasText: ITEM }) }).first().getByRole('spinbutton').first();
  await qty.fill('1');
  await page.getByPlaceholder('नोट लिखें...').fill(`E2E-SALE-${Date.now()}`);
  await page.getByRole('button', { name: 'बिक्री सहेजें' }).click();
  await expect(page.getByText(/cloud par save NAHI|Cloud save fail|सेव नहीं हुआ/)).toHaveCount(0, { timeout: 8_000 });

  await page.reload();
  await expect.poll(async () => openSaleWithItem(page), { timeout: 30_000 }).toBe(before - 1);
  expect(errors, errors.join('\n')).toEqual([]);
});
