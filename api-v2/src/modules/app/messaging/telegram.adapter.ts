import { Injectable } from '@nestjs/common';
import { telegramApiBase, telegramAppUrl, telegramToken, telegramUsername } from './telegram-config';

/** a send that failed: permanent (the person blocked the bot, the chat is gone) or worth trying again */
export class ChannelError extends Error {
  constructor(message: string, readonly permanent: boolean, readonly blocked = false, readonly retryAfterSeconds?: number) { super(message); }
}

/**
 * Telegram's Bot API, the only place the app talks to it. The bot belongs to the shop (a token from BotFather, saved in the app under Settings > Alerts or, failing that, in
 * TELEGRAM_BOT_TOKEN, with the bot's @name beside it). A bot can only write to someone who pressed Start, so the app links each person through a one-time link.
 * TELEGRAM_API_BASE points at another address (a stand-in for tests). The token is never returned or logged.
 */
@Injectable()
export class TelegramAdapter {
  private nameCache: string | null = null;

  get configured(): boolean { return !!telegramToken(); }

  /** forget the cached bot name (the token was changed) */
  reset() { this.nameCache = null; }

  /** the public address of the app, used for "open it" links in messages (only https links are sent) */
  get baseUrl(): string { return telegramAppUrl(); }

  private url(method: string, token: string | null): string {
    return `${telegramApiBase()}/bot${token}/${method}`;
  }

  private async call(method: string, body: any, timeoutMs = 15000, token: string | null = telegramToken()): Promise<any> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.url(method, token), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    } catch (e: any) {
      throw new ChannelError(e?.name === 'AbortError' ? 'Telegram did not answer in time.' : `Telegram could not be reached: ${e?.message ?? e}`, false);
    } finally { clearTimeout(timer); }
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    if (res.ok && json?.ok) return json.result;
    const desc = String(json?.description ?? `HTTP ${res.status}`).slice(0, 200);
    const retry = Number(json?.parameters?.retry_after) || undefined;
    if (res.status === 429) throw new ChannelError(desc, false, false, retry);
    if (res.status === 403) throw new ChannelError(desc, true, true);                                 // blocked the bot, or removed it
    if (res.status === 400 && /chat not found|user is deactivated|PEER_ID_INVALID/i.test(desc)) throw new ChannelError(desc, true, true);
    if (res.status === 401) throw new ChannelError('The bot token is not accepted by Telegram.', true);
    throw new ChannelError(desc, res.status >= 400 && res.status < 500);
  }

  /** the bot's @name: from the settings, else asked of Telegram once */
  async username(): Promise<string | null> {
    const named = telegramUsername();
    if (named) return named;
    if (this.nameCache) return this.nameCache;
    try { this.nameCache = (await this.call('getMe', {}))?.username ?? null; } catch { /* the page says the bot is not reachable */ }
    return this.nameCache;
  }

  /** asks Telegram who a token belongs to (before it is saved); throws a ChannelError when it is not accepted or Telegram cannot be reached */
  async check(token: string): Promise<string> {
    const me = await this.call('getMe', {}, 15000, token);
    if (!me?.username) throw new ChannelError('Telegram did not say whose bot this is.', true);
    return String(me.username);
  }

  /** sends text to a chat; returns Telegram's message id */
  async send(chatId: string, text: string): Promise<string> {
    const r = await this.call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
    return String(r?.message_id ?? '');
  }

  /** what people typed to the bot since `offset`, waiting up to `waitSeconds` for something to arrive */
  async updates(offset: number, waitSeconds: number): Promise<any[]> {
    return (await this.call('getUpdates', { offset, timeout: waitSeconds, allowed_updates: ['message'] }, (waitSeconds + 10) * 1000)) ?? [];
  }
}
