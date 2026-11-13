/**
 * The message sent when a shift closes — SDIG-1..2
 * The store's group gets the shift's bills and takings with no cash amount, difference or name; a connected owner or head gets the drawer and the difference in a
 * personal message; one message per shift; it can be switched off. Needs the API started against the fake Telegram (see fixtures/fake-telegram.ts) and
 * QA_TELEGRAM_FAKE_PORT set.
 */
import { test, expect } from '../fixtures/index.js';
import { startFakeTelegram, FakeTelegram } from '../fixtures/fake-telegram.js';
import { q } from '../seed/db.js';

const PORT = Number(process.env.QA_TELEGRAM_FAKE_PORT || 0);
test.skip(!PORT, 'needs QA_TELEGRAM_FAKE_PORT and an API started with TELEGRAM_API_BASE pointing at the fake Telegram');

const MGR = 'businesshead@local.test';
const GROUP = '-1009001';
const DM = '5101';

let fake: FakeTelegram;
test.beforeAll(async () => { fake = await startFakeTelegram(PORT); });
test.afterAll(async () => { await fake.close(); });

const until = async (fn: () => Promise<boolean>, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
};
const sentTo = async (chat: string) => (await fake.sent()).filter((m) => m.chat_id === chat && !/^Connected/.test(m.text));

function denoms(amount: number) {
  let left = Math.max(0, Math.round(amount));
  const rows: { d: number; n: number }[] = [];
  for (const d of [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]) { const n = Math.floor(left / d); if (n > 0) { rows.push({ d, n }); left -= n * d; } }
  return rows;
}

/** the shift gate may list duties left over from other runs: give a reason for each, as a person would, and try again */
async function withReasons(api: any, method: string, path: string, body: any) {
  let r = await api.request(method, path, body, MGR);
  if (r.status === 409 && Array.isArray(r.body?.required)) {
    const compliancereasons: Record<string, string> = {};
    for (const x of r.body.required) compliancereasons[x.id] = 'Left over from an earlier test run';
    r = await api.request(method, path, { ...body, compliancereasons }, MGR);
  }
  return r;
}

/** a new store with its group, a connected head, and a shift opened with 1000 and closed with 963 in the drawer */
async function closedShift(api: any, tag: string) {
  const store = (await api.request('POST', '/stores', { location: `SDIG ${tag} ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR)).body.id;
  await q(`update stores set telegram_chat_id = $2, telegram_digest_enabled = true where id = $1`, [store, GROUP]);
  const open = await withReasons(api, 'POST', '/store-cash/shifts', { storeid: store, openingcash: 1000, name: 'Evening', starttime: '14:00', endtime: '22:00', openingdenominations: denoms(1000) });
  expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
  const close = await withReasons(api, 'PUT', `/store-cash/shifts/${open.body.id}/close`, { cashvariancereason: 'qa variance', counteddenominations: denoms(963) });
  expect(close.status, JSON.stringify(close.body)).toBeLessThan(300);
  return { store, shift: open.body.id as number };
}

async function connectHead(api: any) {
  const link = await api.request('POST', '/messaging/telegram/link', {}, MGR);
  await fake.push(DM, `/start ${new URL(link.body.url).searchParams.get('start')}`, 'head');
  expect(await until(async () => (await api.request('GET', '/messaging/telegram/me', undefined, MGR)).body.linked === true)).toBe(true);
  // no quiet hours, so the message is not held to the morning whatever the time of the run
  await api.request('PUT', '/messaging/telegram/me', { min_severity: 'warning', quiet_from: null, quiet_to: null }, MGR);
}

test.beforeEach(async () => { await q(`delete from message_outbox where channel = 'TELEGRAM' and kind = 'SHIFT_CLOSE'`); await q(`delete from notification_log where kind = 'SHIFT_CLOSE'`); });
test.afterEach(async ({ api }) => {
  await q(`delete from app_setting where setting_key = 'shift_close_message'`);
  await api.request('DELETE', '/messaging/telegram/me', undefined, MGR);
  await fake.reset();
});

test.describe('Shift close message @p1', () => {
  test('SDIG-1 the group gets the shift without any cash; the head gets the drawer and the difference; once per shift @happy', async ({ api }) => {
    await connectHead(api);
    const { shift } = await closedShift(api, 'one');

    expect(await until(async () => (await sentTo(GROUP)).length > 0 && (await sentTo(DM)).length > 0)).toBe(true);
    const group = (await sentTo(GROUP))[0].text;
    expect(group).toMatch(/SDIG one .* — Evening \(14:00-22:00\) closed/);
    expect(group).toContain('0 bills');
    expect(group).not.toMatch(/Drawer|expected|counted|short|963|1,000|37/);
    expect(group).toContain('A difference is with the store head to check');

    const dm = (await sentTo(DM))[0].text;
    expect(dm).toContain('Evening');
    expect(dm).toContain('Drawer: expected ₹1,000, counted ₹963 — short ₹37');
    expect(dm).toContain('Not reconciled');

    // one message each, and it is logged
    expect((await sentTo(GROUP)).length).toBe(1);
    expect((await sentTo(DM)).length).toBe(1);
    expect(await until(async () => (await q(`select count(*)::int as n from notification_log where kind = 'SHIFT_CLOSE' and period_key = $1 and status = 'SENT'`, [String(shift)]))[0].n === 1)).toBe(true);
    expect(await until(async () => (await q(`select count(*)::int as n from message_outbox where kind = 'SHIFT_CLOSE' and ref_id = $1 and status = 'SENT'`, [shift]))[0].n === 1)).toBe(true);
  });

  test('SDIG-2 it can be switched off, and a store with no group sends only the personal message @happy', async ({ api }) => {
    await connectHead(api);
    await q(`insert into app_setting (category, setting_key, setting_value) values ('alerts', 'shift_close_message', 'off') on conflict (setting_key) do update set setting_value = 'off', active = true, archive = false`);
    await closedShift(api, 'off');
    await new Promise((r) => setTimeout(r, 3000));
    expect((await fake.sent()).filter((m) => /Evening/.test(m.text))).toHaveLength(0);

    await q(`delete from app_setting where setting_key = 'shift_close_message'`);
    const { store } = await closedShift(api, 'nogroup-pre');
    await q(`update stores set telegram_chat_id = null where id = $1`, [store]);
    await fake.reset();
    const s2 = await withReasons(api, 'POST', '/store-cash/shifts', { storeid: store, openingcash: 500, name: 'Night', starttime: '22:00', endtime: '06:00', openingdenominations: denoms(500) });
    expect(s2.status, JSON.stringify(s2.body)).toBeLessThan(300);
    expect((await withReasons(api, 'PUT', `/store-cash/shifts/${s2.body.id}/close`, { cashvariancereason: 'qa variance', counteddenominations: denoms(500) })).status).toBeLessThan(300);
    expect(await until(async () => (await sentTo(DM)).some((m) => /Night/.test(m.text)))).toBe(true);
    expect((await sentTo(GROUP)).filter((m) => /Night/.test(m.text))).toHaveLength(0);
    expect((await sentTo(DM)).find((m) => /Night/.test(m.text))!.text).toContain('Reconciled');
  });
});
