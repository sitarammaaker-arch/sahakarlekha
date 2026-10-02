/**
 * K1 · the Trial Balance page renders on real (staging) data and is balanced. Its voucher-state compute
 * now lives in lib/reports/trialBalance (pure, unit-tested by test:trial-balance); this proves the page
 * still reads it through DataContext. Staging only holds balanced vouchers the other specs post.
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
