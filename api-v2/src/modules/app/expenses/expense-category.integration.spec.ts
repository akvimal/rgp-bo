import { Pool } from 'pg';
import { ExpenseService } from './expense.service';

/**
 * Expense category levels and groups, and repeating expenses that are not monthly, against a real PostgreSQL. Runs only when
 * EXPENSE_TEST_DB_URL names a scratch database with the app schema and sql/migrations/156_expense_category_level_group.sql applied.
 * Never point it at real data: it writes users, expenses and templates.
 */
const url = process.env.EXPENSE_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('expense categories against PostgreSQL', () => {
  let pool: Pool;
  let svc: ExpenseService;
  const audit = { record: jest.fn() };
  let business: number, store: number;
  let owner: any, head: any;
  const cat: Record<string, number> = {};

  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);
  const person = async (email: string, role: string, stores: number[]) => {
    const [r] = await q(`select id from app_role where name = $1`, [role]);
    const [u] = await q(`insert into app_user (email, full_name, role_id, business_id) values ($1, $1, $2, $3) returning id`, [email, r.id, business]);
    for (const s of stores) await q(`insert into user_stores (user_id, store_id) values ($1, $2)`, [u.id, s]);
    return { id: u.id as number, roleid: r.id as number };
  };
  const clean = async () => {
    await q(`delete from expense where raised_by in (select id from app_user where email like 'exp-it-%')`);
    await q(`delete from expense_recurring where created_by in (select id from app_user where email like 'exp-it-%')`);
    await q(`delete from user_stores where user_id in (select id from app_user where email like 'exp-it-%')`);
    await q(`delete from app_user where email like 'exp-it-%'`);
    await q(`delete from expense_category where name like 'ZZ test%'`);
  };
  const base = { expense_date: new Date().toISOString().slice(0, 10), amount: 1000, pay_mode: 'CASH' };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    svc = new ExpenseService({ query: q } as any, audit as any, { refreshShiftTotals: async () => undefined } as any);
    [{ id: store, business_id: business }] = await q(`select id, business_id from stores where active and not archive order by id limit 1`);
    await clean();
    owner = await person('exp-it-owner@example.com', 'Business Head', []);
    head = await person('exp-it-head@example.com', 'Store Head', [store]);
    for (const n of ['Water', 'Rent', 'Insurance', 'Software and subscriptions']) cat[n] = (await q(`select id from expense_category where name = $1`, [n]))[0].id;
  });
  afterAll(async () => { await clean(); await pool.end(); });

  it('a store-only category (water) needs a store, and a Store Head raises it and approves it within the limit', async () => {
    await expect(svc.raise({ ...base, category_id: cat.Water, store_id: null }, owner)).rejects.toThrow(/paid at a store/);
    const r = await svc.raise({ ...base, category_id: cat.Water, store_id: store }, head);
    expect(r.status).toBe('APPROVED');
  });

  it('a business-only category (insurance) is refused at a store, and a Store Head cannot raise it at all', async () => {
    await expect(svc.raise({ ...base, category_id: cat.Insurance, store_id: store }, owner)).rejects.toThrow(/business-level/);
    await expect(svc.raise({ ...base, category_id: cat.Insurance, store_id: store }, head)).rejects.toThrow(/business-level/);
    const r = await svc.raise({ ...base, category_id: cat.Insurance, store_id: null }, owner);
    expect(r.status).toBe('APPROVED');
  });

  it('rent and software go either way: a store pays them, or the Business Head', async () => {
    for (const c of [cat.Rent, cat['Software and subscriptions']]) {
      expect((await svc.raise({ ...base, category_id: c, store_id: store }, head)).status).toBe('APPROVED');
      expect((await svc.raise({ ...base, category_id: c, store_id: null }, owner)).status).toBe('APPROVED');
    }
  });

  it('a category is saved with its level and group, and a wrong one is refused', async () => {
    const made = await svc.saveCategory(null, { name: 'ZZ test hosting', level: 'BUSINESS', cost_group: 'Technology' }, owner);
    const [row] = await q(`select level, cost_group from expense_category where id = $1`, [made.id]);
    expect(row).toEqual({ level: 'BUSINESS', cost_group: 'Technology' });
    await svc.saveCategory(made.id, { name: 'ZZ test hosting', active: true }, owner);                          // not sent: kept
    expect((await q(`select level from expense_category where id = $1`, [made.id]))[0].level).toBe('BUSINESS');
    await expect(svc.saveCategory(null, { name: 'ZZ test bad', level: 'REGION' }, owner)).rejects.toThrow(/store, business or both/);
    await expect(svc.saveCategory(null, { name: 'ZZ test bad', cost_group: 'Fun' }, owner)).rejects.toThrow(/Group is one of/);
    const list = await svc.categories();
    expect(list.find((c: any) => c.name === 'Water')).toMatchObject({ level: 'STORE', cost_group: 'Premises' });
  });

  it('a repeating expense follows the level, and a yearly one comes only in its month', async () => {
    const t = { category_id: cat['Software and subscriptions'], store_id: store, amount: 12000, pay_mode: 'BANK', day_of_month: 5, start_month: '2026-03', every_months: 12 };
    await expect(svc.saveRecurring(null, { ...t, category_id: cat.Insurance }, owner)).rejects.toThrow(/business-level/);
    await expect(svc.saveRecurring(null, { ...t, every_months: 5 }, owner)).rejects.toThrow(/1, 3, 6 or 12/);
    const yearly = await svc.saveRecurring(null, t, owner);
    const monthly = await svc.saveRecurring(null, { ...t, amount: 500, every_months: 1 }, owner);
    expect((await svc.generate('2026-03', owner)).created).toBe(2);        // both come in their first month
    expect((await svc.generate('2026-04', owner)).created).toBe(1);        // only the monthly one
    expect((await svc.generate('2027-03', owner)).created).toBe(2);        // a year on, the yearly one is back
    expect((await svc.generate('2027-03', owner)).created).toBe(0);        // never twice
    const [n] = await q(`select count(*)::int as n from expense where recurring_id = $1`, [yearly.id]);
    expect(n.n).toBe(2);
    const [m] = await q(`select count(*)::int as n from expense where recurring_id = $1`, [monthly.id]);
    expect(m.n).toBeGreaterThanOrEqual(3);
  });

  it('the report rolls the money up by group', async () => {
    const r = await svc.report({ from: base.expense_date, to: base.expense_date }, owner);
    const groups = r.byGroup.map((g: any) => g.name);
    expect(groups).toEqual(expect.arrayContaining(['Premises', 'Technology']));
    const premises = r.byGroup.find((g: any) => g.name === 'Premises');
    expect(premises!.categories.map((c: any) => c.name)).toEqual(expect.arrayContaining(['Water', 'Rent']));
    // the groups add up to the same total as the categories
    expect(r.byGroup.reduce((t: number, g: any) => t + g.amount, 0)).toBeCloseTo(r.byCategory.reduce((t: number, c: any) => t + c.amount, 0), 2);
  });
});
