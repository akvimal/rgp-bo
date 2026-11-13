/**
 * The daily digest — DDIG-1
 * The store's group gets the day by shift, the customers, purchases and stock activity with no cash and no amount of a difference; a connected owner or head gets
 * the same day in a personal message with the drawer and each difference; once per day unless resent. Needs the API started against the fake Telegram (see
 * fixtures/fake-telegram.ts) and QA_TELEGRAM_FAKE_PORT set.
 */
import { test, expect } from '../fixtures/index.js';
import { startFakeTelegram, FakeTelegram } from '../fixtures/fake-telegram.js';
import { q } from '../seed/db.js';

const PORT = Number(process.env.QA_TELEGRAM_FAKE_PORT || 0);
test.skip(!PORT, 'needs QA_TELEGRAM_FAKE_PORT and an API started with TELEGRAM_API_BASE pointing at the fake Telegram');

const MGR = 'businesshead@local.test';
const GROUP = '-1009002';
const DM = '5102';

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


test.beforeEach(async () => { await q(`delete from message_outbox where channel = 'TELEGRAM' and kind = 'DAILY_DIGEST'`); });
test.afterEach(async ({ api }) => {
  await api.request('DELETE', '/messaging/telegram/me', undefined, MGR);
  await fake.reset();
});

test.describe('Daily digest @p1', () => {
  test('DDIG-1 the group gets the day without cash; the head gets the cash and the difference; once per day unless resent @happy', async ({ api }) => {
    await connectHead(api);
    const { store, shift } = await closedShift(api, 'daily');
    const [row] = await q(`select to_char(shift_date, 'YYYY-MM-DD') as d from store_shifts where id = $1`, [shift]);
    const send = (force: boolean) => api.request('POST', `/notifications/daily/send?date=${row.d}&storeid=${store}${force ? '&force=true' : ''}`, {}, MGR);

    const first = await send(true);
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    expect(await until(async () => (await sentTo(GROUP)).length > 0 && (await sentTo(DM)).some((m) => /Expected/.test(m.text)))).toBe(true);

    const group = (await sentTo(GROUP)).find((m) => /By shift/.test(m.text))!.text;
    expect(group).toContain('Evening (14:00-22:00)');
    expect(group).toContain('with a difference, with the store head to check');
    expect(group).not.toMatch(/Expected|counted|drawer|short|963|1,000|37/i);

    const dm = (await sentTo(DM)).find((m) => /Expected/.test(m.text))!.text;
    expect(dm).toContain('Opening ₹1,000');
    expect(dm).toContain('counted ₹963 — short ₹37');
    expect(dm).toContain('Evening (14:00-22:00)');
    expect(dm).toContain('drawer short ₹37');
    expect(dm).toContain('To look at');

    // a second send without force does nothing more
    const before = (await fake.sent()).length;
    const again = await send(false);
    expect(again.status).toBeLessThan(300);
    await new Promise((r) => setTimeout(r, 2500));
    expect((await fake.sent()).length).toBe(before);
    expect((await q(`select count(*)::int as n from message_outbox where kind = 'DAILY_DIGEST' and ref_id = $1`, [store]))[0].n).toBe(1);

    // a resend replaces the personal message and sends the group's again
    expect((await send(true)).status).toBeLessThan(300);
    expect(await until(async () => (await sentTo(DM)).filter((m) => /Expected/.test(m.text)).length === 2)).toBe(true);
    expect((await q(`select count(*)::int as n from message_outbox where kind = 'DAILY_DIGEST' and ref_id = $1`, [store]))[0].n).toBe(1);
  });
});
