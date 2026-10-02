/**
 * Phase-2 I6 · end-to-end tests against the STAGING Supabase project — never production.
 *
 * Env (from the process, or a git-ignored `.env.e2e.local` with KEY=VALUE lines):
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY   staging project URL + anon (public) key
 *   E2E_EMAIL, E2E_PASSWORD                   the staging test login (login specs skip without them)
 *   E2E_BROWSER_CHANNEL                       optional: 'msedge' / 'chrome' to use an installed browser
 *
 * The app is served by Vite with VITE_SUPABASE_* pointed at staging. The config refuses to run if the
 * URL is the production project, so a mis-set variable can never point a test run at real books.
 */
import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const PROD_REF = 'rwffxupenwdtrmyabytk';
const PORT = 5179;

function loadLocalEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadLocalEnv('.env.e2e.local');

const url = process.env.E2E_SUPABASE_URL ?? '';
const anon = process.env.E2E_SUPABASE_ANON_KEY ?? '';
if (url.includes(PROD_REF) || anon.includes(PROD_REF)) {
  throw new Error('E2E refused: E2E_SUPABASE_URL points at PRODUCTION. Use the staging project only.');
}
if (!url || !anon) {
  throw new Error('E2E needs E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY (staging). See playwright.config.ts.');
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,          // one shared staging society — keep runs sequential
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'hi-IN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon },
  },
});
