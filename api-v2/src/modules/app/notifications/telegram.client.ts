import { Injectable, Logger } from "@nestjs/common";

const MAX_LEN = 4096;
// Overridable so tests (and proxies) can stand in for api.telegram.org.
const apiBase = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");

@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);

  get configured(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  /** Sends HTML text, splitting on line boundaries when over Telegram's 4096-char limit. Throws on failure. */
  async send(chatId: string, html: string): Promise<void> {
    for (const part of this.split(html)) {
      await this.post(chatId, part);
    }
  }

  private split(text: string): string[] {
    if (text.length <= MAX_LEN) return [text];
    const parts: string[] = [];
    let current = "";
    for (const line of text.split("\n")) {
      if (current.length + line.length + 1 > MAX_LEN) {
        parts.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + line.slice(0, MAX_LEN);
    }
    if (current) parts.push(current);
    return parts;
  }

  private async post(chatId: string, text: string, attempt = 1): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

    const res = await fetch(`${apiBase()}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) return;

    const body: any = await res.json().catch(() => ({}));
    // 429 carries the mandatory back-off; 5xx is transient. Anything else (bad chat id, bot removed) is permanent.
    const transient = res.status === 429 || res.status >= 500;
    if (transient && attempt < 3) {
      const waitMs = (body?.parameters?.retry_after ?? attempt * 2) * 1000;
      this.logger.warn(`Telegram ${res.status}, retrying in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      return this.post(chatId, text, attempt + 1);
    }
    throw new Error(`Telegram ${res.status}: ${body?.description ?? res.statusText}`);
  }
}
