import { Pool } from 'pg';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { WhatsAppService } from './whatsapp.service';

/**
 * The SQL of the WhatsApp queue against a real PostgreSQL. Runs only when WA_TEST_DB_URL names a scratch copy of a dev database that has
 * sql/migrations/180_whatsapp_customer.sql applied. Never point it at real data: it changes customers' mobiles and writes messages.
 * Stores stay in MOCK mode, so nothing leaves the machine.
 * Both integration specs use the same scratch data, so run them one after the other: npx jest whatsapp --runInBand
 */
const url = process.env.WA_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('WhatsAppService against PostgreSQL', () => {
  let pool: Pool;
  let svc: WhatsAppService;
  let user: { id: number; roleid: number };
  let saleId: number, storeId: number, customerId: number;
  const audit = { record: jest.fn() };

  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    svc = new WhatsAppService({ query: q } as any, new WhatsAppAdapter(), audit as any);
    const [u] = await q(`select u.id, u.role_id as roleid, u.business_id from app_user u join app_role r on r.id = u.role_id where r.name = 'Business Head' and u.active and u.business_id = (select st.business_id from sale s2 join stores st on st.id = s2.store_id where s2.status = 'COMPLETE' group by 1 order by count(*) desc limit 1) order by u.id limit 1`);
    user = { id: u.id, roleid: u.roleid };
    const [s] = await q(
      `select s.id, s.store_id, s.customer_id from sale s join stores st on st.id = s.store_id where s.status = 'COMPLETE' and s.active and not s.archive and s.customer_id is not null and st.business_id = $1
          and exists (select 1 from sale_item i where i.sale_id = s.id and i.active and not i.archive) order by s.id desc limit 1`, [u.business_id]);
    saleId = s.id; storeId = s.store_id; customerId = s.customer_id;
  });
  afterAll(() => pool.end());

  beforeEach(async () => {
    await q(`delete from customer_message where sale_id = $1`, [saleId]);
    await q(`update customer set mobile = '9876543210', do_not_contact = false, contact_consent = null, message_language = null where id = $1`, [customerId]);
    await q(`delete from store_whatsapp where store_id = $1`, [storeId]);
    audit.record.mockClear();
  });

  /** queues without the background send that queueBill starts, so a test decides when the worker runs */
  const queue = async () => {
    const spy = jest.spyOn(svc, 'processQueue').mockResolvedValueOnce(0);
    try { return await svc.queueBill(user, saleId); } finally { spy.mockRestore(); }
  };
  const on = () => svc.saveSettings(user, storeId, { mode: 'MOCK', enabled: true, monthly_cap: 1000 });

  it('refuses until the store has WhatsApp switched on', async () => {
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/not switched on/);
    await svc.saveSettings(user, storeId, { mode: 'MOCK', enabled: false });
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/not switched on/);
  });

  it('saves settings, keeps the token sealed and shows only its tail', async () => {
    const r = await svc.saveSettings(user, storeId, { mode: 'LIVE', phone_number_id: '123456789012345', token: 'EAAG' + 'x'.repeat(60) + 'WXYZ', enabled: true });
    expect(r).toMatchObject({ mode: 'LIVE', enabled: true, has_token: true, token_hint: '...WXYZ', phone_number_id: '123456789012345' });
    expect(JSON.stringify(r)).not.toContain('EAAG');
    const [row] = await q(`select token_sealed from store_whatsapp where store_id = $1`, [storeId]);
    expect(row.token_sealed).not.toContain('EAAG');
    await expect(svc.saveSettings(user, storeId, { mode: 'LIVE', clear_token: true })).rejects.toThrow(/LIVE needs/);
  });

  it('queues a bill, sends it once in MOCK mode and refuses a second send', async () => {
    await on();
    const queued = await queue();
    expect(queued.status).toBe('PENDING');
    await svc.processQueue();
    const [m] = await q(`select status, provider_id, template, language, to_mobile, params, attempts from customer_message where sale_id = $1`, [saleId]);
    expect(m).toMatchObject({ status: 'SENT', template: 'bill_copy_en', language: 'en', to_mobile: '919876543210' });
    expect(String(m.provider_id)).toMatch(/^mock\./);
    expect(m.params).toHaveLength(4);
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/already been sent/);
    expect((await svc.forSale(user, saleId))[0].status).toBe('SENT');
  });

  it('uses the Tamil template for a Tamil customer', async () => {
    await on();
    await q(`update customer set message_language = 'ta' where id = $1`, [customerId]);
    await queue();
    const [m] = await q(`select template, language from customer_message where sale_id = $1`, [saleId]);
    expect(m).toEqual({ template: 'bill_copy_ta', language: 'ta' });
  });

  it('does not message a customer who said no, switched contact off, or has no mobile', async () => {
    await on();
    await q(`update customer set contact_consent = 'NO' where id = $1`, [customerId]);
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/said no/);
    await q(`update customer set contact_consent = null, do_not_contact = true where id = $1`, [customerId]);
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/not to be contacted/);
    await q(`update customer set do_not_contact = false, mobile = null where id = $1`, [customerId]);
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/no valid mobile/);
    expect(await q(`select 1 from customer_message where sale_id = $1`, [saleId])).toHaveLength(0);
  });

  it('stops at the monthly limit', async () => {
    await svc.saveSettings(user, storeId, { mode: 'MOCK', enabled: true, monthly_cap: 0 });
    await expect(svc.queueBill(user, saleId)).rejects.toThrow(/limit of 0/);
  });

  it('only sends a completed bill', async () => {
    await on();
    await q(`update sale set status = 'NEW' where id = $1`, [saleId]);
    try { await expect(svc.queueBill(user, saleId)).rejects.toThrow(/completed bill/); }
    finally { await q(`update sale set status = 'COMPLETE' where id = $1`, [saleId]); }
  });

  it('fails a queued message permanently when the store is switched off before it goes', async () => {
    await on();
    await queue();
    await svc.saveSettings(user, storeId, { enabled: false });
    await svc.processQueue();
    const [m] = await q(`select status, last_error from customer_message where sale_id = $1`, [saleId]);
    expect(m.status).toBe('FAILED');
    expect(m.last_error).toMatch(/switched off/);
  });

  it('builds the bill PDF from the real bill and lists the log with masked numbers', async () => {
    await on();
    const f = await svc.billPdf(user, saleId);
    expect(f.data.slice(0, 4).toString()).toBe('%PDF');
    expect(f.filename).toMatch(/^Bill-.*\.pdf$/);
    await queue();
    const log = await svc.recent(user, storeId);
    expect(log.messages[0].to_mobile).toBe('******3210');
    expect(log.this_month).toBeGreaterThanOrEqual(1);
  });

  it('sends the bill by itself only when the store has auto-send on, and never throws', async () => {
    await on();
    const spy = jest.spyOn(svc, 'processQueue').mockResolvedValue(0);
    try {
      await svc.autoSendBill(user, saleId);
      expect(await q(`select 1 from customer_message where sale_id = $1`, [saleId])).toHaveLength(0);     // auto-send is off
      await svc.saveSettings(user, storeId, { auto_send_bill: true });
      await svc.autoSendBill(user, saleId);
      const rows = await q(`select status, created_by from customer_message where sale_id = $1`, [saleId]);
      expect(rows).toEqual([{ status: 'PENDING', created_by: null }]);
      await expect(svc.autoSendBill(user, saleId)).resolves.toBeUndefined();                                // a second try is quietly ignored
      await expect(svc.autoSendBill(user, 'abc')).resolves.toBeUndefined();
      await expect(svc.autoSendBill(user, 99999999)).resolves.toBeUndefined();
      expect(await q(`select 1 from customer_message where sale_id = $1`, [saleId])).toHaveLength(1);
    } finally { spy.mockRestore(); }
  });

  it('sends a test message in MOCK mode', async () => {
    await on();
    expect((await svc.test(user, storeId, '98765 43210')).ok).toBe(true);
    await expect(svc.test(user, storeId, '123')).rejects.toThrow(/valid 10-digit/);
  });
});
