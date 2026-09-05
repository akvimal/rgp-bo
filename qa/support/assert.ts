import { expect, type Page } from '@playwright/test';

/** wait until the app shell is mounted (user resolved) */
export async function expectShell(page: Page) {
  await expect(page.getByTestId('user-menu')).toBeVisible({ timeout: 20_000 });
}

/** the app redirected (or stayed) on the login screen */
export async function expectOnLogin(page: Page) {
  await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 15_000 });
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

export async function sessionToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try { return sessionStorage.getItem('token'); } catch { return null; }
  });
}

/** numeric text like "₹1,234.50" or "1,234" -> number */
export function money(text: string | null): number {
  if (!text) return NaN;
  return Number(text.replace(/[^0-9.-]/g, ''));
}

export { expect };
