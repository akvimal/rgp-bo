import { Pool } from 'pg';
import { TodoService } from './todo.service';
import { KINDS } from '../alerts/alert-kinds';
import { canSee } from '../alerts/alert-access';
import { addDays, dueInstant, istDay } from './todo-rules';

/**
 * The to-do list against a real PostgreSQL. Runs only when TODO_TEST_DB_URL names a scratch database with the app schema and
 * sql/migrations/155_todos.sql applied, and at least two stores of one business. Never point it at real data: it writes users and to-dos.
 */
const url = process.env.TODO_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('TodoService against PostgreSQL', () => {
  let pool: Pool;
  let svc: any;           // create() returns no id for a repeat that starts later
  const audit = { record: jest.fn() };
  let business: number, storeA: number, storeB: number;
  let owner: any, head: any, staff: any, counter: any, outsider: any;

  const q = (sql: string, params?: any[]) => pool.query(sql, params).then((r) => r.rows);
  const manager: any = {
    query: q,
    transaction: async (cb: any) => {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const out = await cb({ query: (sql: string, p?: any[]) => c.query(sql, p).then((r) => r.rows) });
        await c.query('commit');
        return out;
      } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    },
  };
  const roleId = async (name: string) => (await q(`select id from app_role where name = $1`, [name]))[0].id;
  const person = async (email: string, role: string, stores: number[]) => {
    const rid = await roleId(role);
    const [u] = await q(`insert into app_user (email, full_name, role_id, business_id) values ($1, $1, $2, $3) returning id`, [email, rid, business]);
    for (const s of stores) await q(`insert into user_stores (user_id, store_id) values ($1, $2)`, [u.id, s]);
    return { id: u.id as number, roleid: rid as number };
  };
  const clean = async () => {
    await q(`delete from todo_item where business_id = $1`, [business]);
    await q(`delete from todo_template where business_id = $1`, [business]);
    await q(`delete from user_stores where user_id in (select id from app_user where email like 'todo-it-%')`);
    await q(`delete from app_user where email like 'todo-it-%'`);
  };
  const today = () => istDay();
  const ids = (r: any) => r.items.map((i: any) => i.title);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    svc = new TodoService(audit as any, manager);
    const stores = await q(`select id, business_id from stores where active and not archive order by id limit 2`);
    business = stores[0].business_id; storeA = stores[0].id; storeB = stores[1].id;
    await q(`delete from todo_item`); await q(`delete from todo_template`);
    await q(`delete from user_stores where user_id in (select id from app_user where email like 'todo-it-%')`);
    await q(`delete from app_user where email like 'todo-it-%'`);
    owner = await person('todo-it-owner@example.com', 'Business Head', []);
    head = await person('todo-it-head@example.com', 'Store Head', [storeA]);
    staff = await person('todo-it-staff@example.com', 'Sales Staff', [storeA]);
    counter = await person('todo-it-counter@example.com', 'Counter', [storeA]);
    outsider = await person('todo-it-outsider@example.com', 'Sales Staff', [storeB]);
  });
  afterAll(async () => { await clean(); await pool.end(); });

  it('the roles got the permission by migration: managers give, staff keep their own', async () => {
    expect(await svc.can(owner.roleid, 'assign')).toBe(true);
    expect(await svc.can(head.roleid, 'assign')).toBe(true);
    expect(await svc.can(staff.roleid, 'view')).toBe(true);
    expect(await svc.can(staff.roleid, 'assign')).toBe(false);
  });

  it('a person keeps their own to-do and nobody else sees it', async () => {
    await svc.create(staff, { title: 'Wipe the shelves', dueday: today(), duetime: '09:00' });
    expect(ids(await svc.list(staff, {}))).toEqual(['Wipe the shelves']);
    expect(ids(await svc.list(outsider, {}))).toEqual([]);
    expect(ids(await svc.list(counter, {}))).toEqual([]);
  });

  it('staff cannot give a to-do to someone else, or to a store pool', async () => {
    await expect(svc.create(staff, { title: 'For the head', dueday: today(), assigneeuserid: head.id })).rejects.toThrow(/own to-dos/);
    await expect(svc.create(staff, { title: 'For the store', dueday: today(), pool: true, storeid: storeA })).rejects.toThrow(/manager gives/);
  });

  it('a Store Head gives to the people and stores they look after, not to others', async () => {
    await svc.create(head, { title: 'Count the fridge stock', dueday: today(), assigneeuserid: staff.id });
    expect(ids(await svc.list(staff, {}))).toContain('Count the fridge stock');
    expect(ids(await svc.list(head, { scope: 'team' }))).toContain('Count the fridge stock');
    await expect(svc.create(head, { title: 'Out of reach', dueday: today(), assigneeuserid: outsider.id })).rejects.toThrow(/people you look after/);
    await expect(svc.create(head, { title: 'Other store pool', dueday: today(), pool: true, storeid: storeB })).rejects.toThrow(/not one of yours/);
    await expect(svc.list(staff, { scope: 'team' })).rejects.toThrow();
  });

  it('a store pool is seen by the store\'s logins only, and a shared counter login ticks for whoever served', async () => {
    const { id } = await svc.create(owner, { title: 'Open the window blinds', dueday: today(), pool: true, storeid: storeA });
    for (const who of [staff, counter]) expect(ids(await svc.list(who, {}))).toContain('Open the window blinds');
    expect(ids(await svc.list(outsider, {}))).not.toContain('Open the window blinds');
    await expect(svc.done(outsider, id, {})).rejects.toThrow();
    await svc.done(counter, id, { actinguserid: staff.id, note: 'done before opening' });
    const [row] = await q(`select status, completed_by, done_note from todo_item where id = $1`, [id]);
    expect(row).toMatchObject({ status: 'DONE', completed_by: staff.id, done_note: 'done before opening' });
    // a login that is not a person cannot be credited
    const second = await svc.create(owner, { title: 'Water the plants', dueday: today(), pool: true, storeid: storeA });
    await svc.done(staff, second.id, { actinguserid: counter.id });
    const [r2] = await q(`select completed_by from todo_item where id = $1`, [second.id]);
    expect(r2.completed_by).toBe(staff.id);
  });

  it('only the giver or a manager changes, removes or reopens; the assignee ticks', async () => {
    const { id } = await svc.create(head, { title: 'Tidy the back room', dueday: today(), assigneeuserid: staff.id });
    await expect(svc.update(staff, id, { title: 'Changed by staff' })).rejects.toThrow(/gave this to-do/);
    await expect(svc.remove(staff, id)).rejects.toThrow(/gave this to-do/);
    await svc.update(head, id, { title: 'Tidy the back room well', priority: 'high' });
    await svc.done(staff, id, {});
    await expect(svc.update(head, id, { title: 'Late change' })).rejects.toThrow(/open to-do/);
    await svc.reopen(staff, id);                       // the person who ticked it may reopen it
    const [row] = await q(`select status, title, priority from todo_item where id = $1`, [id]);
    expect(row).toMatchObject({ status: 'OPEN', title: 'Tidy the back room well', priority: 'high' });
    await svc.remove(head, id);
    expect(ids(await svc.list(staff, {}))).not.toContain('Tidy the back room well');
  });

  it('a daily repeat makes one open to-do, counts a lapsed day, and makes the next as soon as one is ticked', async () => {
    const made = await svc.create(owner, { title: 'Check the fridge temperature', dueday: today(), assigneeuserid: staff.id, repeat: { repeat: 'DAILY' } });
    expect(made.templateid).toBeTruthy();
    const count = async () => Number((await q(`select count(*)::int as n from todo_item where template_id = $1`, [made.templateid]))[0].n);
    expect(await count()).toBe(1);
    await svc.generate();
    expect(await count()).toBe(1);                      // nothing breeds while the last one is open
    await svc.done(staff, made.id, {});
    await svc.generate();
    expect(await count()).toBe(2);                      // tomorrow's is made once today's is ticked (its heads-up has begun)
    const [t] = await q(`select next_due_on::text as next, missed from todo_template where id = $1`, [made.templateid]);
    expect(t.next).toBe(addDays(today(), 2));
    // the stop leaves what is open and makes no more
    await svc.stopRepeat(owner, made.templateid);
    const [t2] = await q(`select active, next_due_on from todo_template where id = $1`, [made.templateid]);
    expect(t2).toMatchObject({ active: false, next_due_on: null });
  });

  it('a repeat that follows completion is set for N days after it is ticked, and made when its heads-up begins', async () => {
    const made = await svc.create(owner, { title: 'Deep clean the counter', dueday: today(), assigneeuserid: staff.id, repeat: { repeat: 'EVERY_N_DAYS_AFTER_DONE', every: 10 } });
    await svc.done(staff, made.id, {});
    const [t] = await q(`select next_due_on::text as next, active from todo_template where id = $1`, [made.templateid]);
    expect(t).toMatchObject({ next: addDays(today(), 10), active: true });
    expect(Number((await q(`select count(*)::int as n from todo_item where template_id = $1`, [made.templateid]))[0].n)).toBe(1);   // not yet: its heads-up is nine days off
    await q(`update todo_template set next_due_on = $2::date where id = $1`, [made.templateid, addDays(today(), 1)]);             // time passes
    await svc.generate();
    const items = await q(`select due_on from todo_item where template_id = $1 order by id`, [made.templateid]);
    expect(items.length).toBe(2);
    expect(new Date(items[1].due_on).getTime()).toBe(dueInstant(addDays(today(), 1), '09:00').getTime());
  });

  it('a bad repeat or a past day is refused', async () => {
    await expect(svc.create(owner, { title: 'Bad weekly', dueday: today(), assigneeuserid: staff.id, repeat: { repeat: 'WEEKLY', days: [] } })).rejects.toThrow(/days of the week/);
    await expect(svc.create(owner, { title: 'Yesterday', dueday: addDays(today(), -5), assigneeuserid: staff.id })).rejects.toThrow(/already passed/);
  });

  describe('the reminders (alert kind todo_due)', () => {
    const kind = KINDS.find((k) => k.kind === 'todo_due')!;
    const ctx = () => ({ manager, stores: null as any, businessId: business, today: today() });

    it('a person\'s reminder names that person; a pool\'s names the store\'s staff and head; nobody else is told', async () => {
      await q(`delete from todo_item where business_id = $1`, [business]);
      await svc.create(head, { title: 'Reminder for staff', dueday: today(), duetime: '00:01', assigneeuserid: staff.id });
      await svc.create(owner, { title: 'Reminder for the store', dueday: today(), duetime: '00:01', pool: true, storeid: storeA });
      const found = await kind.evaluate(ctx(), {});
      const personal = found.find((f) => f.params.title === 'Reminder for staff')!;
      const pooled = found.find((f) => f.params.title === 'Reminder for the store')!;
      expect(personal.code).toBe('todo_due');
      const whoStaff = { id: staff.id, role: 'Sales Staff', owner: false, storeIds: [storeA] };
      const whoOwner = { id: owner.id, role: 'Business Head', owner: true, storeIds: [] };
      const whoHead = { id: head.id, role: 'Store Head', owner: false, storeIds: [storeA] };
      const whoOut = { id: outsider.id, role: 'Sales Staff', owner: false, storeIds: [storeB] };
      expect(canSee(personal.recipients, whoStaff, personal.storeid)).toBe(true);
      expect(canSee(personal.recipients, whoOwner, personal.storeid)).toBe(false);
      expect(canSee(personal.recipients, whoHead, personal.storeid)).toBe(false);
      expect(canSee(pooled.recipients, whoStaff, pooled.storeid)).toBe(true);
      expect(canSee(pooled.recipients, whoHead, pooled.storeid)).toBe(true);
      expect(canSee(pooled.recipients, whoOut, pooled.storeid)).toBe(false);
      expect(canSee(pooled.recipients, whoOwner, pooled.storeid)).toBe(false);
    });

    it('a ticked to-do raises nothing; a very late one is also raised to the giver and the store head', async () => {
      await q(`delete from todo_item where business_id = $1`, [business]);
      const { id } = await svc.create(head, { title: 'Late one', dueday: today(), duetime: '00:01', assigneeuserid: staff.id });
      await q(`update todo_item set due_on = now() - interval '5 days' where id = $1`, [id]);
      const late = await kind.evaluate(ctx(), {});
      expect(late.map((f) => f.code).sort()).toEqual(['todo_escalated', 'todo_overdue']);
      const esc = late.find((f) => f.code === 'todo_escalated')!;
      expect(esc.severity).toBe('critical');
      expect(esc.recipients!.userids).toEqual([head.id]);
      await svc.done(staff, id, {});
      expect(await kind.evaluate(ctx(), {})).toEqual([]);
    });

    it('a self-set to-do is never escalated to anyone else', async () => {
      await q(`delete from todo_item where business_id = $1`, [business]);
      const { id } = await svc.create(staff, { title: 'My own late one', dueday: today() });
      await q(`update todo_item set due_on = now() - interval '9 days' where id = $1`, [id]);
      expect((await kind.evaluate(ctx(), {})).map((f) => f.code)).toEqual(['todo_overdue']);
    });
  });
});
