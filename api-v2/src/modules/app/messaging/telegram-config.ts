/**
 * The shop's Telegram bot: its token, its @name and the app's public address. The owner saves them in the app (Settings > Alerts), where the token is kept
 * encrypted; the server's environment (TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, APP_BASE_URL) is the fallback when nothing was saved in the app.
 * Held in one place so the alert sender and the digest sender always see the same bot. TELEGRAM_API_BASE (a stand-in for tests) stays environment only.
 */
export interface StoredTelegram { token: string | null; username: string | null; appUrl: string | null }

let STORED: StoredTelegram = { token: null, username: null, appUrl: null };

export const setStoredTelegram = (s: StoredTelegram) => { STORED = s; };
export const storedTelegram = (): StoredTelegram => STORED;

export const telegramToken = (): string | null => STORED.token || process.env.TELEGRAM_BOT_TOKEN || null;
export const telegramUsername = (): string | null => {
  const n = STORED.token ? STORED.username : (process.env.TELEGRAM_BOT_USERNAME || null);
  return n ? n.replace(/^@/, '') : null;
};
export const telegramAppUrl = (): string => STORED.appUrl || process.env.APP_BASE_URL || '';
export const telegramApiBase = (): string => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');

/** where the bot's details come from, for the settings page */
export const telegramSource = (): 'app' | 'server' | null => (STORED.token ? 'app' : process.env.TELEGRAM_BOT_TOKEN ? 'server' : null);

/** a token as BotFather gives it: digits, a colon, then letters, digits, - and _ */
export function cleanBotToken(v: any): string | null {
  const t = String(v ?? '').trim().replace(/^["']|["']$/g, '');
  return /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t) ? t : null;
}

/** the app's public address: https, no path needed; empty clears it */
export function cleanAppUrl(v: any): string | null | undefined {
  const t = String(v ?? '').trim().replace(/\/+$/, '');
  if (!t) return null;
  return /^https:\/\/[A-Za-z0-9.-]+(:\d{2,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(t) && t.length <= 200 ? t : undefined;
}

/** the last characters of the token, to recognise it by */
export const tokenHint = (t: string): string => (t.length > 8 ? '...' + t.slice(-4) : '');
