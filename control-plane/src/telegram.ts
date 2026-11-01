/**
 * A customer's Telegram bot, as the control plane keeps it: the bot's token (encrypted, like the assistant's key), its @name and the app's public address.
 * They end up in the customer's env file, so only plain characters are let through. Pure: the check against Telegram takes the fetch it should use.
 */

/** a token from BotFather: the bot's number, a colon, and a secret of letters, digits, dashes and underscores */
export const BOT_TOKEN_SHAPE = /^\d{6,12}:[A-Za-z0-9_-]{30,60}$/;

/** a bot's @name (without the @): 5 to 32 letters, digits and underscores, starting with a letter */
export const BOT_NAME_SHAPE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** the app's public address: https, a host, an optional port and path, nothing that could break an env file */
export const APP_URL_SHAPE = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:\d{2,5})?(\/[A-Za-z0-9._~\-\/]*)?$/;

export const cleanBotName = (v: any): string => String(v ?? '').trim().replace(/^@/, '');
export const cleanAppUrl = (v: any): string => String(v ?? '').trim().replace(/\/+$/, '');

export interface TokenCheck { ok: boolean; username?: string; error?: string }

/**
 * Asks Telegram who the token belongs to (getMe). Telegram saying no is an answer (the token is wrong); not reaching Telegram is not, and is said as such.
 * TELEGRAM_API_BASE points elsewhere for a test.
 */
export async function checkBotToken(token: string, fetchFn: typeof fetch = fetch, base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'): Promise<TokenCheck> {
  let res: Response;
  try {
    res = await fetchFn(`${base.replace(/\/$/, '')}/bot${token}/getMe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
  } catch {
    return { ok: false, error: 'Telegram could not be reached to check the token. Try again in a minute.' };
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (res.ok && json?.ok && json.result?.username) return { ok: true, username: String(json.result.username) };
  if (res.status === 401 || res.status === 404) return { ok: false, error: 'Telegram does not accept that token. Copy it again from BotFather.' };
  return { ok: false, error: `Telegram could not check the token (${String(json?.description ?? `HTTP ${res.status}`).slice(0, 100)}).` };
}
