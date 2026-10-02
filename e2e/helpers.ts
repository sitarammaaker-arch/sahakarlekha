/** Shared steps for the staging e2e specs (I6/I7). */
import { expect, type Page } from '@playwright/test';

export const EMAIL = process.env.E2E_EMAIL ?? '';
export const PASSWORD = process.env.E2E_PASSWORD ?? '';
export const HAS_LOGIN = !!EMAIL && !!PASSWORD;

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('your@email.com').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /लॉगिन|Login/ }).click();
  await page.waitForURL(/\/(dashboard|my-dashboard)/, { timeout: 30_000 });
  // Books loaded fully from staging — no read-only / incomplete-data banner (F1).
  await expect(page.getByText(/entry बंद है|entry is paused/)).toHaveCount(0);
}

/** Saves an admission-fee receipt through the Vouchers page template; returns its unique narration tag. */
export async function createVoucher(page: Page, prefix = 'E2E'): Promise<string> {
  const tag = `${prefix}-${Date.now()}`;
  const amount = String(100 + (Date.now() % 800));
  await page.goto('/vouchers');
  await page.getByText('प्रवेश शुल्क', { exact: true }).first().click();
  await page.getByRole('spinbutton', { name: '0' }).fill(amount);   // exact amount box (placeholder '0' also substring-matches the voucher no.)
  await page.getByPlaceholder('विवरण...').fill(tag);
  // Wait for the server to commit the voucher (post_voucher) — a reload mid-request would abort it.
  const saved = page.waitForResponse(r => r.url().includes('/rpc/post_voucher') && r.request().method() === 'POST', { timeout: 20_000 });
  await page.getByRole('button', { name: 'सहेजें' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText(/cloud par save NAHI|Cloud save fail|सेव नहीं हुआ/)).toHaveCount(0, { timeout: 8_000 });
  return tag;
}

export async function openList(page: Page) {
  await page.getByRole('button', { name: /^सूची/ }).click();
}
