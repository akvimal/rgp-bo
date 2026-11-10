import { createHmac } from 'crypto';
import { Pool } from 'pg';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/**
 * The webhook's SQL against a real PostgreSQL. Runs only when WA_TEST_DB_URL names a scratch copy of a dev database that has
 * sql/migrations/180_whatsapp_customer.sql applied. Never point it at real data: it changes customers and messages.
 * It shares its scratch data with whatsapp.integration.spec.ts, so run them one after the other: npx jest whatsapp --runInBand
 */
const url = process.env.WA_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('WhatsAppWebhookService against PostgreSQL', () => {
  let pool: Pool;
  let hook: WhatsAppWebhookService;
  let svc: WhatsAppService;
  let user: { id: number; roleid: number };
  let saleId: number, storeId: number, customerId: number;
  const audit = { record: jest.fn() };
  const PHONE_ID = '555000111222';
  const SECRET = 'app-secret-for-tests';

  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);
  const call = (payload: any, secret = SECRET) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return hook.receive(raw, 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex'), payload);
  };
  const receipt = (id: string, status: string, ts = 1760000000, errors?: any[]) => ({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PHONE_ID }, statuses: [{ id, status, timestamp: String(ts), errors }] } }] }] });
  const reply = (from: string, text: string, phoneId = PHONE_ID) => ({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneId }, messages: [{ from, type: 'text', text: { body: text } }] } }] }] });
  const message = async (status: string, providerId: string | null) =>
    (await q(`insert into customer_message (store_id, customer_id, sale_id, kind, template, language, params, to_mobile, status, provider_id)
              values ($1, $2, $3, 'BILL', 'bill_copy_en', 'en', '[]', '919876543210', $4, $5) returning id`, [storeId, customerId, saleId, status, providerId]))[0].id;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';
    pool = new Pool({ connectionString: url });
    hook = new WhatsAppWebhookService({ query: q } as any, audit as any);
    svc = new WhatsAppService({ query: q } as any, new WhatsAppAdapter(), audit as any);
    const [u] = await q(`select u.id, u.role_id as roleid from app_user u join app_role r on r.id = u.role_id where r.name = 'Business Head' and u.active and u.business_id = (select st.business_id from sale s2 join stores st on st.id = s2.store_id where s2.status = 'COMPLETE' group by 1 order by count(*) desc limit 1) order by u.id limit 1`);
    user = { id: u.id, roleid: u.roleid };
    const [s] = await q(`select s.id, s.store_id, s.customer_id from sale s join stores st on st.id = s.store_id where s.status = 'COMPLETE' and s.active and not s.archive and s.customer_id is not null and st.business_id = (select business_id from app_user where id = $1) order by s.id desc limit 1`, [u.id]);
    saleId = s.id; storeId = s.store_id; customerId = s.customer_id;
  });
  afterAll(() => pool.end());

  beforeEach(async () => {
    await q(`delete from customer_message where sale_id = $1`, [saleId]);
    await q(`update customer set mobile = '9876543210', do_not_contact = false where id = $1`, [customerId]);
    await q(`delete from store_whatsapp where store_id = $1`, [storeId]);
    await svc.saveSettings(user, storeId, { mode: 'LIVE', phone_number_id: PHONE_ID, token: 'EAAG' + 'y'.repeat(60), enabled: true });
    audit.record.mockClear();
  });

  it('answers Meta\'s challenge only with our verify token', () => {
    expect(hook.verifyChallenge('subscribe', 'verify-me', '12345')).toBe('12345');
    expect(() => hook.verifyChallenge('subscribe', 'wrong', '12345')).toThrow(/Verification failed/);
    expect(() => hook.verifyChallenge('unsubscribe', 'verify-me', '1')).toThrow();
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    try { expect(() => hook.verifyChallenge('subscribe', '', '1')).toThrow(); } finally { process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me'; }
  });

  it('refuses a call with a wrong or missing signature and changes nothing', async () => {
    const id = await message('SENT', 'wamid.SIG');
    await expect(call(receipt('wamid.SIG', 'read'), 'not-the-secret')).rejects.toThrow(/signature/);
    await expect(hook.receive(Buffer.from('{}'), undefined, {})).rejects.toThrow(/signature/);
    expect((await q(`select status from customer_message where id = $1`, [id]))[0].status).toBe('SENT');
  });

  it('moves a bill to Delivered then Read with the times Meta gives, and never back', async () => {
    const id = await message('SENT', 'wamid.FWD');
    expect(await call(receipt('wamid.FWD', 'delivered', 1760000000))).toEqual({ statuses: 1, stopped: 0 });
    let [m] = await q(`select status, delivered_on, read_on from customer_message where id = $1`, [id]);
    expect(m.status).toBe('DELIVERED');
    expect(new Date(m.delivered_on).getTime()).toBe(1760000000000);
    expect(m.read_on).toBeNull();
    await call(receipt('wamid.FWD', 'read', 1760000100));
    [m] = await q(`select status, read_on from customer_message where id = $1`, [id]);
    expect(m.status).toBe('READ');
    expect(new Date(m.read_on).getTime()).toBe(1760000100000);
    expect(await call(receipt('wamid.FWD', 'delivered', 1760000200))).toEqual({ statuses: 0, stopped: 0 });    // a late receipt
    expect((await q(`select status from customer_message where id = $1`, [id]))[0].status).toBe('READ');
  });

  it('records why a message failed, and ignores receipts for messages that are not ours', async () => {
    const id = await message('SENT', 'wamid.BAD');
    await call(receipt('wamid.BAD', 'failed', 1760000000, [{ code: 131026, title: 'Undeliverable', error_data: { details: 'Not on WhatsApp' } }]));
    const [m] = await q(`select status, last_error from customer_message where id = $1`, [id]);
    expect(m).toEqual({ status: 'FAILED', last_error: 'Not on WhatsApp' });
    expect(await call(receipt('wamid.UNKNOWN', 'read'))).toEqual({ statuses: 0, stopped: 0 });
  });

  it('stops contacting a customer who writes STOP to a store number, and cancels what is waiting', async () => {
    const waiting = await message('PENDING', null);
    expect(await call(reply('919876543210', ' stop '))).toEqual({ statuses: 0, stopped: 1 });
    expect((await q(`select do_not_contact from customer where id = $1`, [customerId]))[0].do_not_contact).toBe(true);
    expect((await q(`select status, last_error from customer_message where id = $1`, [waiting]))[0]).toEqual({ status: 'SKIPPED', last_error: 'The customer asked to stop.' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'whatsapp.customer_stopped', entityId: customerId }));
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/not to be contacted/);
  });

  it('stops on the Tamil word too, but not on other words, other numbers or numbers that are not ours', async () => {
    expect(await call(reply('919876543210', 'thank you'))).toEqual({ statuses: 0, stopped: 0 });
    expect(await call(reply('919876543210', 'STOP', '999999999'))).toEqual({ statuses: 0, stopped: 0 });          // not one of our numbers
    expect(await call(reply('919000000000', 'STOP'))).toEqual({ statuses: 0, stopped: 0 });                       // no such customer
    expect((await q(`select do_not_contact from customer where id = $1`, [customerId]))[0].do_not_contact).toBe(false);
    expect(await call(reply('919876543210', 'நிறுத்து'))).toEqual({ statuses: 0, stopped: 1 });
  });
});
