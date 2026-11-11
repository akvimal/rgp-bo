import { Pool } from 'pg';
import { DrugRegisterService } from './drug-register.service';

/**
 * The drug register's SQL against a real PostgreSQL: a supply with no prescription in hand needs no prescriber, and the prescriber is added later.
 * Runs only when DR_TEST_DB_URL names a scratch copy of a dev database that has the register tables (migration 104 and later). Never point it at real
 * data: it changes a product's schedule and writes register lines.
 */
const url = process.env.DR_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('DrugRegisterService against PostgreSQL', () => {
  let pool: Pool;
  let svc: DrugRegisterService;
  let manager: any;
  let user: { id: number; roleid: number };
  let saleId: number, storeId: number, productId: number, customerId: number;
  let items: any[];
  const audit = { record: jest.fn() };
  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    manager = {
      query: q,
      transaction: async (fn: any) => {
        const c = await pool.connect();
        try { await c.query('begin'); const out = await fn({ query: (s: string, p?: any[]) => c.query(s, p).then((r) => r.rows) }); await c.query('commit'); return out; }
        catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
      },
    };
    svc = new DrugRegisterService(manager, audit as any);
    const [u] = await q(`select u.id, u.role_id as roleid from app_user u join app_role r on r.id = u.role_id where r.name = 'Business Head' and u.active order by u.id limit 1`);
    user = { id: u.id, roleid: u.roleid };
    const [s] = await q(
      `select s.id, s.store_id, s.customer_id, si.product_id from sale s join sale_item si on si.sale_id = s.id and si.active and not si.archive and si.status = 'Complete'
        join stores st on st.id = s.store_id join app_user bu on bu.id = $1 and bu.business_id = st.business_id
        where s.status = 'COMPLETE' and s.active and not s.archive order by s.id desc limit 1`, [u.id]);
    saleId = s.id; storeId = s.store_id; productId = s.product_id; customerId = s.customer_id;
    await q(`update product set more_props = coalesce(more_props::jsonb, '{}'::jsonb) || '{"schedule":"H"}'::jsonb where id = $1`, [productId]);
    items = await q(`select id, purchase_item_id, product_id, batch, qty from sale_item where sale_id = $1 and active and not archive and status = 'Complete'`, [saleId]);
  });
  afterAll(() => pool.end());

  beforeEach(async () => {
    await q(`delete from schedule_register where sale_id = $1`, [saleId]);
    await q(`delete from prescriber where name = 'Dr Test Doctor'`);
    // every schedule needs details, and the bill is held back until they are given (the scratch data may have either setting empty, which means none)
    await q(`delete from app_setting where setting_key in ('schedule_register_enforce', 'schedule_register_required')`);
    await q(`insert into app_setting (category, setting_key, setting_value) values ('pharmacy', 'schedule_register_enforce', 'yes'), ('pharmacy', 'schedule_register_required', 'H1,H,X')`);
    audit.record.mockClear();
  });

  const bill = (detail: any, documents: any[] = []) => ({
    status: 'COMPLETE', items: items.map((i) => ({ ...i, productid: i.product_id, itemid: i.purchase_item_id, qty: i.qty })),
    props: { scheduledetail: detail, documents }, customer: { id: customerId },
  });
  const ctx = (detail: any, documents: any[] = []) => ({ manager, sale: bill(detail, documents), storeId, userId: user.id, actingUserId: user.id });
  const complete = async (detail: any, documents: any[] = []) => {
    const c: any = ctx(detail, documents);
    await svc.check(c);
    await svc.saved({ ...c, saved: { id: saleId, storeid: storeId, billno: 1, billdate: new Date(), customerid: customerId, status: 'COMPLETE' }, items });
  };
  const patient = { patient_name: 'A Patient', patient_address: '12 Main Road, Town' };

  it('completes a bill with no prescription in hand and no prescriber, and records the reason', async () => {
    await complete({ ...patient, rx_basis: 'COULD_NOT', rx_note: 'Pharmacist advised a topical cream' });
    const rows = await q(`select prescriber_name, prescriber_id, rx_basis, rx_note, patient_name from schedule_register where sale_id = $1 and superseded_on is null`, [saleId]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ prescriber_name: '', prescriber_id: null, rx_basis: 'COULD_NOT', rx_note: 'Pharmacist advised a topical cream', patient_name: 'A Patient' });
    expect(await q(`select 1 from prescriber where btrim(name) = ''`)).toHaveLength(0);               // no empty prescriber was made up
  });

  it('still refuses a bill without a prescriber when a prescription exists, or when the reason is missing', async () => {
    await expect(svc.check(ctx({ ...patient, rx_basis: 'SEEN' }) as any)).rejects.toThrow(/prescriber's name/);
    await expect(svc.check(ctx({ ...patient }) as any)).rejects.toThrow(/prescriber's name/);
    await expect(svc.check(ctx({ ...patient, rx_basis: 'COULD_NOT' }) as any)).rejects.toThrow(/why the customer could not provide/);
    await expect(svc.check(ctx({ rx_basis: 'COULD_NOT', rx_note: 'no prescription' }) as any)).rejects.toThrow(/patient's name/);          // the patient is still required
    await expect(svc.check(ctx({ ...patient, rx_basis: 'ATTACHED' }, [{ id: 1, category: 'Prescription' }]) as any)).rejects.toThrow(/prescriber's name/);
  });

  it('lists the supply as having no prescriber, and will not add one while there is no prescription', async () => {
    await complete({ ...patient, rx_basis: 'COULD_NOT', rx_note: 'no prescription brought' });
    const gaps = (await svc.prescriberGaps(user)).rows.filter((r: any) => r.sale_id === saleId);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ rx_basis: 'COULD_NOT', can_add: false, patient_name: 'A Patient' });
    await expect(svc.addPrescriber(user, saleId, { prescriber_name: 'Dr Test Doctor', prescriber_reg_no: 'TN1' })).rejects.toThrow(/Attach the prescription/);
  });

  it('adds the prescriber once the prescription has arrived, and audits it', async () => {
    await complete({ ...patient, rx_basis: 'LATER', rx_due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) });
    await q(`update schedule_register set rx_basis = 'ATTACHED' where sale_id = $1 and superseded_on is null`, [saleId]);        // what uploading the prescription does
    const before = (await svc.prescriberGaps(user)).rows.find((r: any) => r.sale_id === saleId);
    expect(before.can_add).toBe(true);
    await expect(svc.addPrescriber(user, saleId, { prescriber_name: 'Dr' })).rejects.toThrow(/Give the prescriber's name/);
    const r = await svc.addPrescriber(user, saleId, { prescriber_name: 'Dr Test Doctor', prescriber_reg_no: 'TN12345', rx_date: '2026-11-01' });
    expect(r.lines).toBeGreaterThan(0);
    const rows = await q(`select prescriber_name, prescriber_reg_no, prescriber_id, to_char(rx_date, 'YYYY-MM-DD') as rx_date from schedule_register where sale_id = $1 and superseded_on is null`, [saleId]);
    expect(rows[0]).toMatchObject({ prescriber_name: 'Dr Test Doctor', prescriber_reg_no: 'TN12345', rx_date: '2026-11-01' });
    expect(rows[0].prescriber_id).toBeGreaterThan(0);
    expect((await svc.prescriberGaps(user)).rows.filter((x: any) => x.sale_id === saleId)).toHaveLength(0);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'drug_register.prescriber_added', entityId: saleId }));
    await expect(svc.addPrescriber(user, saleId, { prescriber_name: 'Dr Test Doctor', prescriber_reg_no: 'TN12345' })).rejects.toThrow(/no register line without a prescriber/);
  });

  it('does not let another business see or change the supply', async () => {
    await complete({ ...patient, rx_basis: 'OTHER', rx_note: 'advised by the pharmacist' });
    const [other] = await q(`select u.id, u.role_id as roleid from app_user u join app_role r on r.id = u.role_id where r.name = 'Business Head' and u.active and u.business_id is distinct from (select business_id from app_user where id = $1) limit 1`, [user.id]);
    if (!other) return;                                                  // the scratch data has only one business
    const theirs = await svc.prescriberGaps({ id: other.id, roleid: other.roleid });
    expect(theirs.rows.filter((r: any) => r.sale_id === saleId)).toHaveLength(0);
    await expect(svc.addPrescriber({ id: other.id, roleid: other.roleid }, saleId, { prescriber_name: 'Dr Test Doctor', prescriber_reg_no: 'TN1' })).rejects.toThrow(/Bill not found/);
  });
});
