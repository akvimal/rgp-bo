/**
 * Staff alerts on Telegram — ATG-1..4
 * A person connects with a one-time link and Start; an alert that opens is written to the outbox and sent once to each connected person who can see it and wants
 * that level; quiet hours hold the lower levels; /stop stops; a blocked chat is marked and not retried, a transient failure is retried; the owner sees and can
 * switch it. Needs the API started against a stand-in for Telegram (see fixtures/fake-telegram.ts) and QA_TELEGRAM_FAKE_PORT set.
 */
import { test, expect } from '../fixtures/index.js';
import { startFakeTelegram, FakeTelegram } from '../fixtures/fake-telegram.js';
import { q } from '../seed/db.js';

const PORT = Number(process.env.QA_TELEGRAM_FAKE_PORT || 0);
test.skip(!PORT, 'needs QA_TELEGRAM_FAKE_PORT and an API started with TELEGRAM_API_BASE pointing at the fake Telegram');

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';

let fake: FakeTelegram;
test.beforeAll(async () => { fake = await startFakeTelegram(PORT); });
test.afterAll(async () => { await fake.close(); });

const until = async (fn: () => Promise<boolean>, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
};
const tokenOf = (url: string) => new URL(url).searchParams.get('start') as string;
const istClock = (offsetMin: number) => { const d = new Date(Date.now() + 5.5 * 3600000 + offsetMin * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/** connects a person's Telegram to a chat: the link, then Start in that chat */
async function connect(api: any, who: string, chat: string) {
  const link = await api.request('POST', '/messaging/telegram/link', {}, who);
  expect(link.status, JSON.stringify(link.body)).toBeLessThan(300);
  expect(link.body.url).toMatch(/^https:\/\/t\.me\/ShopTestBot\?start=/);
  await fake.push(chat, `/start ${tokenOf(link.body.url)}`, 'qa_person');
  const ok = await until(async () => (await api.request('GET', '/messaging/telegram/me', undefined, who)).body.linked === true);
  expect(ok, 'the person is connected after pressing Start').toBe(true);
}

const rules: { id: number; who: string }[] = [];
/** an alert that opens now: stock adjustments waiting over an hour (the dev data always has some), at the chosen level */
async function alertNow(api: any, severity: string, recipients: any = { roles: ['owners'] }, storeid?: number) {
  const r = await api.request('POST', '/alerts/rules', { kind: 'approvals_pending', name: `QA telegram ${severity} ${Date.now()}`, params: { hours: 1 }, severity, recipients, ...(storeid ? { storeid } : {}) }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  rules.push({ id: r.body.id, who: MGR });
  return r.body.id as number;
}
const outbox = async (userEmail: string, ruleId?: number) =>
  q(`select o.status, o.attempts, o.last_error, o.severity, o.send_after > now() as held from message_outbox o join app_user u on u.id = o.recipient_user_id
      join notification n on n.id = o.ref_id and o.ref_type = 'notification' where lower(u.email) = lower($1) ${ruleId ? 'and n.rule_id = ' + ruleId : ''} order by o.id`, [userEmail]);

// earlier runs leave messages in the outbox, and the hourly limit counts them
test.beforeEach(async () => { await q(`delete from message_outbox where channel = 'TELEGRAM'`); });

test.afterEach(async ({ api }) => {
  while (rules.length) { const r = rules.pop()!; await api.request('DELETE', `/alerts/rules/${r.id}`, undefined, r.who); }
  for (const w of [MGR, SALES, STORE_HEAD]) await api.request('DELETE', '/messaging/telegram/me', undefined, w);
  await api.request('PUT', '/messaging/overview/enabled', { on: true }, MGR);
  await fake.reset();
});

test.describe('Staff alerts on Telegram @p1', () => {
  test('ATG-1 a person connects with a one-time link; the link works once; a chat belongs to one person; /stop stops @happy', async ({ api }) => {
    const me0 = (await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body;
    expect(me0).toMatchObject({ configured: true, enabled: true, bot: 'ShopTestBot', linked: false });
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'warning' }, MGR)).status).toBe(400);          // connect first
    expect((await api.request('POST', '/messaging/telegram/test', {}, MGR)).status).toBe(400);

    const link = await api.request('POST', '/messaging/telegram/link', {}, MGR);
    const token = tokenOf(link.body.url);
    await fake.push('5001', `/start ${token}`, 'asha');
    expect(await until(async () => (await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body.linked)).toBe(true);
    expect((await fake.sent()).some((m) => m.chat_id === '5001' && /Connected/.test(m.text))).toBe(true);
    expect((await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body).toMatchObject({ linked: true, status: 'ACTIVE', handle: 'asha', min_severity: 'warning', quiet_from: '22:00', quiet_to: '07:00' });

    // the token is single use, and another chat cannot take it
    await fake.push('5002', `/start ${token}`);
    expect(await until(async () => (await fake.sent()).some((m) => m.chat_id === '5002' && /expired|already used/.test(m.text)))).toBe(true);
    // a chat already connected to one person is refused for another
    const other = await api.request('POST', '/messaging/telegram/link', {}, SALES);
    await fake.push('5001', `/start ${tokenOf(other.body.url)}`);
    expect(await until(async () => (await fake.sent()).some((m) => m.chat_id === '5001' && /already connected to someone else/.test(m.text)))).toBe(true);
    expect((await api.request('GET', '/messaging/telegram/me', undefined, SALES)).body.linked).toBe(false);

    // a test message goes at once; settings are checked
    expect((await api.request('POST', '/messaging/telegram/test', {}, MGR)).status).toBeLessThan(300);
    expect((await fake.sent()).some((m) => m.chat_id === '5001' && /test from the shop/.test(m.text))).toBe(true);
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'loud' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'warning', quiet_from: '22:00' }, MGR)).status).toBe(400);        // both or neither
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'warning', quiet_from: '25:00', quiet_to: '07:00' }, MGR)).status).toBe(400);

    // /stop from the chat stops the alerts
    await fake.push('5001', '/stop');
    expect(await until(async () => (await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body.status === 'STOPPED')).toBe(true);
    expect((await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body.linked).toBe(false);
  });

  test('ATG-2 an alert that opens is sent once to each connected person who wants that level; quiet hours hold the lower levels @happy', async ({ api }) => {
    await connect(api, MGR, '5001');

    const warn = await alertNow(api, 'warning');
    expect(await until(async () => (await fake.sent()).some((m) => m.chat_id === '5001' && /adjustment/i.test(m.text) && m.text.startsWith('\u{1F7E0}')))).toBe(true);
    // one alert for each store with something waiting, each sent once
    expect(await until(async () => (await outbox(MGR, warn)).every((o: any) => o.status === 'SENT'))).toBe(true);
    const made = (await outbox(MGR, warn)).length;
    expect(made).toBeGreaterThanOrEqual(1);
    // running again does not send them again
    const count = (await fake.sent()).filter((m) => m.chat_id === '5001' && /adjustment/i.test(m.text)).length;
    await api.request('POST', '/alerts/run', {}, MGR);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await fake.sent()).filter((m) => m.chat_id === '5001' && /adjustment/i.test(m.text)).length).toBe(count);
    expect((await outbox(MGR, warn))).toHaveLength(made);

    // the level a person asks for
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'critical', quiet_from: null, quiet_to: null }, MGR)).status).toBeLessThan(300);
    const low = await alertNow(api, 'warning');
    expect(await outbox(MGR, low)).toHaveLength(0);                                                  // not wanted: not even queued
    const crit = await alertNow(api, 'critical');
    expect(await until(async () => (await outbox(MGR, crit)).some((o: any) => o.status === 'SENT'))).toBe(true);
    expect((await fake.sent()).some((m) => m.text.startsWith('\u{1F534}'))).toBe(true);

    // quiet hours hold a warning until morning, but a critical alert still comes
    expect((await api.request('PUT', '/messaging/telegram/me', { min_severity: 'warning', quiet_from: istClock(-60), quiet_to: istClock(60) }, MGR)).status).toBeLessThan(300);
    const quiet = await alertNow(api, 'warning');
    const held = await outbox(MGR, quiet);
    expect(held.length).toBeGreaterThanOrEqual(1);
    for (const h of held) expect(h).toMatchObject({ status: 'PENDING', held: true });
    const crit2 = await alertNow(api, 'critical');
    expect(await until(async () => (await outbox(MGR, crit2)).some((o: any) => o.status === 'SENT'))).toBe(true);

    // after /stop nothing new is queued
    await fake.push('5001', '/stop');
    expect(await until(async () => (await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body.status === 'STOPPED')).toBe(true);
    const after = await alertNow(api, 'critical');
    expect(await outbox(MGR, after)).toHaveLength(0);
  });

  test('ATG-3 a blocked chat is marked and not retried; a failure that may pass is retried; the owner can switch it off @edge', async ({ api }) => {
    await connect(api, SALES, '999');                                                                 // this chat refuses messages
    await connect(api, STORE_HEAD, '777');                                                            // this chat fails once with a server error
    const all = { roles: ['owners', 'managers', 'staff'] };
    // store 1 (where these two work) needs an adjustment that has waited for over an hour, so the alert is theirs to see
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-ATG-${Date.now()}`, invoicedate: '2026-07-01' }, MGR);
    const prod = await api.request('POST', '/products', { title: `QA-ATG-PROD-${Date.now()}`, taxpcnt: 12, category: 'QA', code: `ATG${Date.now()}`, pack: 1 }, MGR);
    const item = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: 3500, batch: `ATG-${Date.now()}`, expdate: '2028-06-30' }, MGR);
    const adj = await api.request('POST', '/stock/adjust/qty', { itemid: item.body.id, qty: -2, reasoncode: 'SHRINKAGE', status: 'PENDING', storeid: 1 }, MGR);
    expect(adj.status, JSON.stringify(adj.body)).toBeLessThan(300);
    await q(`update product_qtychange set created_on = now() - interval '3 hours' where id = $1`, [adj.body.id]);
    const r1 = await alertNow(api, 'critical', all, 1);

    expect(await until(async () => (await outbox(SALES, r1)).some((o: any) => o.status === 'FAILED'))).toBe(true);
    expect((await outbox(SALES, r1))[0]).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect((await api.request('GET', '/messaging/telegram/me', undefined, SALES)).body.status).toBe('BLOCKED');

    expect(await until(async () => (await outbox(STORE_HEAD, r1)).some((o: any) => o.status === 'PENDING' && o.attempts === 1))).toBe(true);
    expect((await outbox(STORE_HEAD, r1))[0].last_error).toMatch(/Internal Server Error/);
    await q(`update message_outbox set send_after = now() where recipient_user_id = (select id from app_user where lower(email) = lower($1)) and status = 'PENDING'`, [STORE_HEAD]);
    expect(await until(async () => (await outbox(STORE_HEAD, r1)).some((o: any) => o.status === 'SENT'), 45000)).toBe(true);     // the next run of the worker
    expect((await fake.sent()).some((m) => m.chat_id === '777')).toBe(true);

    // the owner sees who is connected and how it went, and can switch alerts out of the app off
    const ov = (await api.request('GET', '/messaging/overview', undefined, MGR)).body;
    expect(ov.configured).toBe(true);
    expect(ov.staff.map((s: any) => s.status)).toEqual(expect.arrayContaining(['BLOCKED', 'ACTIVE']));
    expect(ov.week.failed).toBeGreaterThanOrEqual(1);
    expect((await api.request('GET', '/messaging/overview', undefined, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/messaging/overview/enabled', { on: false }, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/messaging/overview/enabled', { on: false }, MGR)).body.enabled).toBe(false);
    const r2 = await alertNow(api, 'critical', all);
    expect(await outbox(STORE_HEAD, r2)).toHaveLength(0);
  });

  test('ATG-4 a person with no Telegram, and an unconnected chat, get nothing @negative', async ({ api }) => {
    const r = await alertNow(api, 'critical');
    await new Promise((x) => setTimeout(x, 1500));
    expect(await outbox(MGR, r)).toHaveLength(0);
    expect(await fake.sent()).toHaveLength(0);
    // talking to the bot without a link explains how to connect, and connects nobody
    await fake.push('6001', '/start');
    expect(await until(async () => (await fake.sent()).some((m) => m.chat_id === '6001' && /Connect Telegram/.test(m.text)))).toBe(true);
    expect((await q(`select count(*)::int as n from user_channel where chat_id = '6001'`))[0].n).toBe(0);
    await fake.push('6001', '/status');
    expect(await until(async () => (await fake.sent()).some((m) => m.chat_id === '6001' && /not connected to anyone/.test(m.text)))).toBe(true);
  });
});
