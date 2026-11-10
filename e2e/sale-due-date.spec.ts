/**
 * Credit terms on a bill, end to end (RULE 1): save a CREDIT sale with 15 credit days through the real
 * Sale form, RELOAD, and the row the cloud returns must still carry creditDays = 15 and
 * dueDate = bill date + 15 days. Before migration 152 the server dropped both without an error
 * (post_stock_document ignores a key that has no column), so only a read-back after a reload proves it.
 * Needs the staging seed item "E2E परीक्षण वस्तु" (staging-04-seed-stock.sql) and the staging login.
 */
import { test, expect } from '@playwright/test';
import { HAS_LOGIN, login } from './helpers';

test.skip(!HAS_LOGIN, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

const ITEM = 'E2E परीक्षण वस्तु';
const DAYS = 15;

/** YYYY-MM-DD plus n days, in UTC so no timezone can shift the day. */
function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

test('a credit sale keeps its credit days and due date after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);

  await page.goto('/sales');
  await page.getByRole('combobox').filter({ hasText: 'वस्तु चुनें' }).first().click();
  await page.getByRole('option', { name: ITEM }).click();
  await page.getByRole('combobox').filter({ hasText: 'ग्राहक चुनें' }).click();
  await page.getByRole('option', { name: /नकद ग्राहक/ }).click();
  await page.getByRole('row').filter({ has: page.getByRole('combobox').filter({ hasText: ITEM }) }).first().getByRole('spinbutton').first().fill('1');

  await page.getByRole('button', { name: 'उधार', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'उधार के दिन' }).fill(String(DAYS));
  await expect(page.getByText(/देय तिथि:/)).toBeVisible();

  const tag = `E2E-DUE-${Date.now()}`;
  await page.getByPlaceholder('नोट लिखें...').fill(tag);
  // Wait for the server to commit the sale before reloading (a reload mid-request aborts it).
  const saved = page.waitForResponse(r => r.url().includes('/rpc/post_stock_document') && r.request().method() === 'POST', { timeout: 20_000 });
  await page.getByRole('button', { name: 'बिक्री सहेजें' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText(/cloud par save NAHI|Cloud save fail|सेव नहीं हुआ/)).toHaveCount(0, { timeout: 8_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});   // let the step-2 extras land

  // Read the bill back from the CLOUD: collect every `sales` page the app loads after the reload.
  const rows: Record<string, unknown>[] = [];
  page.on('response', async r => {
    if (r.request().method() !== 'GET' || !/\/rest\/v1\/sales\?/.test(r.url()) || !r.ok()) return;
    try { const body = await r.json(); if (Array.isArray(body)) rows.push(...body); } catch { /* not JSON */ }
  });
  await page.reload();
  await expect.poll(() => rows.some(s => s.narration === tag), { timeout: 30_000 }).toBe(true);

  const bill = rows.find(s => s.narration === tag)!;
  expect(bill.paymentMode).toBe('credit');
  expect(bill.creditDays).toBe(DAYS);
  expect(bill.dueDate).toBe(plusDays(String(bill.date), DAYS));
  expect(errors, errors.join('\n')).toEqual([]);
});
