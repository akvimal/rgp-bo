/**
 * A stand-in for Telegram's Bot API, for tests of staff alerts. Start the API with TELEGRAM_BOT_TOKEN=test:token, TELEGRAM_BOT_USERNAME=ShopTestBot and
 * TELEGRAM_API_BASE=http://localhost:<port>, then run the spec with QA_TELEGRAM_FAKE_PORT=<port>.
 *
 * Bot API: getMe, getUpdates (waits briefly for something to arrive), sendMessage. A message to chat 999 is refused as blocked (403), and the first message
 * to chat 777 fails with a server error (500), so a permanent and a transient failure can be seen. Test controls: POST /__push (a person typed something),
 * GET /__sent (what the bot sent), POST /__reset.
 */
import http from 'node:http';

export interface FakeTelegram {
  port: number;
  push(chatId: string | number, text: string, username?: string): Promise<void>;
  sent(): Promise<{ chat_id: string; text: string }[]>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function startFakeTelegram(port: number): Promise<FakeTelegram> {
  // update ids only ever go up, as Telegram's do: the app keeps the last one it saw, so a later run must start above it
  let updateId = Math.floor(Date.now() / 1000);
  let queue: any[] = [];
  let sent: { chat_id: string; text: string }[] = [];
  const failedOnce = new Set<string>();

  const body = (req: http.IncomingMessage) => new Promise<any>((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
  });
  const reply = (res: http.ServerResponse, status: number, json: any) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };

  const server = http.createServer(async (req, res) => {
    const url = req.url || '';
    const b = await body(req);
    if (url === '/__push') {
      queue.push({ update_id: ++updateId, message: { message_id: updateId, text: b.text, chat: { id: Number(b.chat_id), type: 'private' }, from: { username: b.username || null } } });
      return reply(res, 200, { ok: true });
    }
    if (url === '/__sent') return reply(res, 200, sent);
    if (url === '/__reset') { queue = []; sent = []; failedOnce.clear(); return reply(res, 200, { ok: true }); }
    const m = /^\/bot[^/]+\/(\w+)$/.exec(url);
    if (!m) return reply(res, 404, { ok: false, description: 'Not Found' });
    if (m[1] === 'getMe') return reply(res, 200, { ok: true, result: { username: 'ShopTestBot' } });
    if (m[1] === 'getUpdates') {
      const offset = Number(b.offset) || 0;
      const until = Date.now() + Math.min(Number(b.timeout) || 0, 1) * 1000;
      for (;;) {
        const due = queue.filter((u) => u.update_id >= offset);
        queue = queue.filter((u) => u.update_id >= offset);
        if (due.length || Date.now() >= until) return reply(res, 200, { ok: true, result: due });
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (m[1] === 'sendMessage') {
      const chat = String(b.chat_id);
      if (chat === '999') return reply(res, 403, { ok: false, description: 'Forbidden: bot was blocked by the user' });
      // the one failure is kept for an alert, not the "Connected" reply that comes first
      if (chat === '777' && !/^Connected/.test(String(b.text)) && !failedOnce.has(chat)) { failedOnce.add(chat); return reply(res, 500, { ok: false, description: 'Internal Server Error' }); }
      sent.push({ chat_id: chat, text: String(b.text) });
      return reply(res, 200, { ok: true, result: { message_id: sent.length } });
    }
    return reply(res, 404, { ok: false, description: 'Not Found' });
  });
  await new Promise<void>((r) => server.listen(port, r));

  const call = async (path: string, init?: any) => (await fetch(`http://localhost:${port}${path}`, init)).json();
  return {
    port,
    push: async (chatId, text, username) => { await call('/__push', { method: 'POST', body: JSON.stringify({ chat_id: chatId, text, username }) }); },
    sent: async () => call('/__sent'),
    reset: async () => { await call('/__reset', { method: 'POST', body: '{}' }); },
    close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
