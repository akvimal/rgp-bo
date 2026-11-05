import { Pool } from 'pg';
import { DeviceService } from './device.service';

/**
 * The SQL of registered store PCs against a real PostgreSQL. Runs only when DEVICE_TEST_DB_URL names a scratch database with the app schema and
 * sql/migrations/153_store_devices.sql applied, and at least one store. Never point it at real data: it writes users, roles and devices.
 */
const url = process.env.DEVICE_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('DeviceService against PostgreSQL', () => {
  let pool: Pool;
  let svc: DeviceService;
  const audit = { record: jest.fn() };
  let storeId: number;
  let businessId: number;
  let owner: number, storeHead: number, counter: number, staff: number;

  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);
  const roleId = async (name: string) => {
    const [r] = await q(`select id from app_role where name = $1`, [name]);
    if (r) return r.id;
    return (await q(`insert into app_role (name) values ($1) returning id`, [name]))[0].id;
  };
  const user = async (email: string, role: string, withStore = false) => {
    const [u] = await q(`insert into app_user (email, full_name, role_id, business_id) values ($1, $1, $2, $3) returning id`, [email, await roleId(role), businessId]);
    if (withStore) await q(`insert into user_stores (user_id, store_id) values ($1, $2)`, [u.id, storeId]);
    return u.id as number;
  };
  const setMode = (m: string) => q(`update app_setting set setting_value = $1 where setting_key = 'trusted_device_mfa'`, [m]);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    svc = new DeviceService(audit as any, { query: q } as any);
    await q(`delete from store_device`);
    await q(`delete from user_stores where user_id in (select id from app_user where email like 'dev-it-%')`);
    await q(`delete from app_user where email like 'dev-it-%'`);
    [{ id: storeId, business_id: businessId }] = await q(`select id, business_id from stores where active and not archive order by id limit 1`);
    owner = await user('dev-it-owner@example.com', 'Business Head');
    storeHead = await user('dev-it-head@example.com', 'Store Head');
    counter = await user('dev-it-counter@example.com', 'Counter', true);
    staff = await user('dev-it-staff@example.com', 'Sales Staff', true);
    await setMode('counter');
  });
  afterAll(async () => {
    await q(`delete from store_device`);
    await q(`delete from user_stores where user_id in (select id from app_user where email like 'dev-it-%')`);
    await q(`delete from app_user where email like 'dev-it-%'`);
    await pool.end();
  });

  it('an owner registers a PC; only the hash is stored; the secret finds it', async () => {
    const r = await svc.register(owner, { name: 'Billing 1', storeid: storeId, counteruserid: counter }, '10.0.0.5');
    expect(r.token.length).toBeGreaterThan(30);
    const [row] = await q(`select token_hash, counter_user_id from store_device where id = $1`, [r.id]);
    expect(row.token_hash).not.toContain(r.token);
    expect(row.counter_user_id).toBe(counter);
    expect(await svc.resolve(r.token)).toMatchObject({ id: r.id, name: 'Billing 1', storeid: storeId });
    expect(await svc.resolve('not-the-secret-not-the-secret')).toBeNull();
    expect(await svc.status(r.token)).toMatchObject({ registered: true, autosignin: true });
    expect(await svc.status(undefined)).toEqual({ registered: false, autosignin: false });
  });

  it('a Store Head with no store of their own, and a Sales Staff login, cannot register', async () => {
    await expect(svc.register(storeHead, { name: 'Nope', storeid: storeId })).rejects.toThrow(/not one of yours/);
    await expect(svc.register(staff, { name: 'Nope', storeid: storeId })).rejects.toThrow(/Only a Business Head/);
  });

  it('only a Counter login of the business may be linked', async () => {
    await expect(svc.register(owner, { name: 'Bad link', storeid: storeId, counteruserid: staff })).rejects.toThrow(/Counter login/);
  });

  it('the list shows the PC, the stores and the Counter logins', async () => {
    const l = await svc.list(owner);
    expect(l.mode).toBe('counter');
    expect(l.canSetMode).toBe(true);
    expect(l.stores.map((s: any) => s.id)).toContain(storeId);
    expect(l.counterUsers.map((u: any) => u.id)).toEqual([counter]);
    expect(l.devices.some((d: any) => d.name === 'Billing 1' && d.counteremail === 'dev-it-counter@example.com')).toBe(true);
  });

  it('the second step is skipped for a Counter login on a registered PC, not for others, and never for owners', async () => {
    const { token } = await svc.register(owner, { name: 'Billing 2', storeid: storeId });
    expect(await svc.skipsMfa(token, 'Counter')).toMatchObject({ name: 'Billing 2' });
    expect(await svc.skipsMfa(token, 'Sales Staff')).toBeNull();
    expect(await svc.skipsMfa(undefined, 'Counter')).toBeNull();
    await svc.setMode(owner, 'all');
    expect(await svc.skipsMfa(token, 'Sales Staff')).not.toBeNull();
    expect(await svc.skipsMfa(token, 'Business Head')).toBeNull();
    await svc.setMode(owner, 'off');
    expect(await svc.skipsMfa(token, 'Counter')).toBeNull();
    await expect(svc.setMode(storeHead, 'all')).rejects.toThrow(/Only a Business Head/);
    await expect(svc.setMode(owner, 'sometimes')).rejects.toThrow(/Choose/);
    await setMode('counter');
  });

  it('a PC with a linked Counter login signs it in; one without does not; "off" stops it', async () => {
    const linked = await svc.register(owner, { name: 'Billing 3', storeid: storeId, counteruserid: counter });
    expect((await svc.counterLogin(linked.token)).userId).toBe(counter);
    const plain = await svc.register(owner, { name: 'Back office', storeid: storeId });
    await expect(svc.counterLogin(plain.token)).rejects.toThrow();
    await svc.linkCounter(owner, plain.id, counter);
    expect((await svc.counterLogin(plain.token)).userId).toBe(counter);
    await svc.linkCounter(owner, plain.id, null);
    await expect(svc.counterLogin(plain.token)).rejects.toThrow();
    await svc.setMode(owner, 'off');
    await expect(svc.counterLogin(linked.token)).rejects.toThrow();
    await setMode('counter');
  });

  it('revoking a PC ends it at once: the secret no longer resolves and its sessions fail the guard check', async () => {
    const r = await svc.register(owner, { name: 'Lost laptop', storeid: storeId, counteruserid: counter });
    expect(await svc.stillRegistered(r.id)).toBe(true);
    await svc.revoke(owner, r.id);
    expect(await svc.stillRegistered(r.id)).toBe(false);
    expect(await svc.resolve(r.token)).toBeNull();
    expect(await svc.status(r.token)).toEqual({ registered: false, autosignin: false });
    await expect(svc.revoke(storeHead, r.id)).rejects.toThrow();
    const l = await svc.list(owner);
    expect(l.devices.find((d: any) => d.id === r.id)?.active).toBe(false);
  });
});
