/**
 * K1 · the Trial Balance page renders on real (staging) data and is balanced. Its voucher-state compute
 * now lives in lib/reports/trialBalance (pure, unit-tested by test:trial-balance); this proves the page
 * still reads it through DataContext (K2 adds the Trading A/c and I&E pages). Staging only holds balanced vouchers the other specs post.
 */
import { test, expect } from '@playwright/test';
import { HAS_LOGIN, login } from './helpers';

test.skip(!HAS_LOGIN, 'E2E_EMAIL / E2E_PASSWORD (staging test login) not set');

test('trial balance renders and is balanced', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page);
  await page.goto('/trial-balance');
  await expect(page.getByText(/ट्रायल बैलेंस संतुलित है|Trial Balance is Balanced/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/असंतुलित|NOT Balanced/)).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

// K2–K4 · the Trading A/c, I&E, Receipts & Payments, Cash Book and Bank Book pages read lib/reports/* through DataContext.
// /profit-loss is titled by capability (statements.profitLossStatement): लाभ-हानि खाता for a trading society, else आय-व्यय खाता.
for (const [path, heading] of [['/trading-account', /व्यापार खाता|Trading Account/], ['/profit-loss', /लाभ-हानि खाता|आय-व्यय खाता|Profit & Loss Account|Income & Expenditure Account/], ['/receipts-payments', /प्राप्ति एवं भुगतान खाता|Receipts & Payments Account/], ['/cash-book', /कैश बुक|Cash Book/], ['/bank-book', /बैंक बुक|Bank Book/]] as const) {
  test(`${path} renders without page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);   // let the statement compute after data load
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
