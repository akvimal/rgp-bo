import { PROFILE_FORMAT, PlanInput, SCHEMA_VERSION, parseProfile, planImport, tempPassword } from './config-profile';
import { profileToWorkbook, workbookToProfile } from './config-profile-xlsx';

const base = (over: any = {}) => ({ format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION, ...over });
const store = (over: any = {}) => ({ name: 'Anna Nagar', type: 'pharmacy', shiftMode: 'time', ...over });

const emptyInput = (over: Partial<PlanInput> = {}): PlanInput => ({
  business: { name: 'Acme', phone: null },
  stores: [], users: [], businessId: 1, roomLeft: { stores: null, users: null },
  roles: { 'Store Head': { id: 3, locked: false }, 'Sales Staff': { id: 4, locked: false }, Counter: { id: 5, locked: false }, 'Business Head': { id: 1, locked: false } },
  ...over,
});
const existingStore = (over: any = {}) => ({
  id: 10, name: 'Anna Nagar', vaultBalance: 0, openShifts: 0, shifts: [],
  ...over,
  values: { type: 'pharmacy', shiftMode: 'time', operatorRequired: true, depositThreshold: 0, depositSchedule: 'none', depositWeekdays: [], depositMonthDays: [], vaultEnabled: false, floatAmount: 0, active: true, ...over.values },
});
const user = (over: any = {}) => ({ id: 20, email: 'a@x.in', fullName: 'A', phone: null, location: null, role: 'Sales Staff', businessId: 1, active: true, archived: false, stores: ['Anna Nagar'], ...over });

describe('parseProfile', () => {
  it('refuses a file that is not a profile, or is from a newer version', () => {
    expect(parseProfile({}).errors[0]).toMatch(/not a business profile/);
    expect(parseProfile(base({ schemaVersion: 99 })).errors[0]).toMatch(/newer version/);
    expect(parseProfile(null).errors.length).toBe(1);
  });

  it('lists every problem it finds and ignores unknown keys with a warning', () => {
    const r = parseProfile(base({
      extra: 1,
      business: { name: 'A', phone: 'abc', billShowMrp: 'yes' },
      stores: [store({ shiftMode: 'weekly' }), store({ name: 'anna nagar' })],
      staff: [{ email: 'bad', fullName: 'x', role: 'Sales Staff' }],
    }));
    expect(r.errors.length).toBeGreaterThanOrEqual(5);
    expect(r.warnings.join(' ')).toMatch(/"extra"/);
  });

  it('keeps only what is present and tidies values', () => {
    const r = parseProfile(base({ business: { name: '  Acme   Pharma ', gstin: '33abcde1234f1z5' }, stores: [store({ depositSchedule: 'weekly', depositWeekdays: [3, 1, 3] })] }));
    expect(r.errors).toEqual([]);
    expect(r.profile.business).toEqual({ name: 'Acme Pharma', gstin: '33ABCDE1234F1Z5' });
    expect(r.profile.stores![0].depositWeekdays).toEqual([1, 3]);
  });

  it('needs days for a weekly or monthly deposit, and shift times that look like times', () => {
    expect(parseProfile(base({ stores: [store({ depositSchedule: 'weekly' })] })).errors[0]).toMatch(/weekday/);
    const r = parseProfile(base({ stores: [store({ shifts: [{ name: 'Day', startTime: '9am', endTime: '17:00' }] })] }));
    expect(r.errors[0]).toMatch(/start time/);
    const ok = parseProfile(base({ stores: [store({ shifts: [{ name: 'Day', startTime: '9:00', endTime: '17:00' }] })] }));
    expect(ok.profile.stores![0].shifts![0].startTime).toBe('09:00');
  });

  it('takes a float given as notes as the amount, and refuses a mismatch', () => {
    const ok = parseProfile(base({ stores: [store({ floatDenominations: [{ d: 500, n: 2 }, { d: 100, n: 5 }] })] }));
    expect(ok.profile.stores![0].floatAmount).toBe(1500);
    expect(parseProfile(base({ stores: [store({ floatDenominations: [{ d: 500, n: 2 }], floatAmount: 900 })] })).errors[0]).toMatch(/add up to Rs 1000/);
  });
});

describe('planImport', () => {
  it('creates a store with defaults and a login with its stores', () => {
    const p = parseProfile(base({ stores: [store({ shifts: [{ name: 'Day', startTime: '09:00', endTime: '17:00' }] })], staff: [{ email: 'a@x.in', fullName: 'A', role: 'Sales Staff', stores: ['Anna Nagar'] }] })).profile;
    const plan = planImport(p, emptyInput());
    expect(plan.stores[0].action).toBe('create');
    expect(plan.stores[0].values.operatorRequired).toBe(true);
    expect(plan.stores[0].shifts[0].action).toBe('create');
    expect(plan.staff[0].action).toBe('create');
    expect(plan.counts).toMatchObject({ storesCreated: 1, staffCreated: 1, shiftsChanged: 1 });
  });

  it('matches by name ignoring case and reports only real changes', () => {
    const p = parseProfile(base({ stores: [store({ name: 'ANNA NAGAR', phone: '044 1234567', shiftMode: 'time' })] })).profile;
    const plan = planImport(p, emptyInput({ stores: [existingStore() as any] }));
    expect(plan.stores[0].action).toBe('update');
    expect(plan.stores[0].id).toBe(10);
    expect(plan.stores[0].changes.map((c) => c.label)).toEqual(['Phone']);
  });

  it('an identical profile changes nothing', () => {
    const p = parseProfile(base({ stores: [store()], staff: [{ email: 'a@x.in', fullName: 'A', role: 'Sales Staff', stores: ['Anna Nagar'] }] })).profile;
    const plan = planImport(p, emptyInput({ stores: [existingStore() as any], users: [user()] }));
    expect(plan.stores[0].action).toBe('same');
    expect(plan.staff[0].action).toBe('same');
    expect(plan.business).toBeNull();
  });

  it('skips logins it must not touch, with a reason', () => {
    const staff = [
      { email: 'o@x.in', fullName: 'O', role: 'Business Head' },
      { email: 'n@x.in', fullName: 'N', role: 'Nobody' },
      { email: 'g@x.in', fullName: 'G', role: 'Sales Staff', stores: ['Nowhere'] },
      { email: 'e@x.in', fullName: 'E', role: 'Sales Staff' },
      { email: 'r@x.in', fullName: 'R', role: 'Sales Staff' },
      { email: 'h@x.in', fullName: 'H', role: 'Sales Staff' },
    ];
    const plan = planImport(parseProfile(base({ staff })).profile, emptyInput({
      users: [user({ email: 'e@x.in', businessId: 2 }), user({ email: 'r@x.in', active: false }), user({ email: 'h@x.in', role: 'Business Head' })],
    }));
    expect(plan.staff.map((s) => s.action)).toEqual(['skip', 'skip', 'skip', 'skip', 'skip', 'skip']);
    expect(plan.staff[0].reason).toMatch(/platform administrator/);
    expect(plan.staff[3].reason).toMatch(/another business/);
    expect(plan.staff[4].reason).toMatch(/removed/);
    expect(plan.staff[5].reason).toMatch(/owner login/);
  });

  it('changes a login role and stores, and says so', () => {
    const p = parseProfile(base({ stores: [store(), store({ name: 'T Nagar' })], staff: [{ email: 'a@x.in', fullName: 'A', role: 'Store Head', stores: ['T Nagar', 'Anna Nagar'] }] })).profile;
    const plan = planImport(p, emptyInput({ stores: [existingStore() as any], users: [user()] }));
    expect(plan.staff[0].action).toBe('update');
    expect(plan.staff[0].changes.map((c) => c.label)).toEqual(['Role', 'Stores']);
    expect(plan.staff[0].storesChanged).toBe(true);
  });

  it('blocks a shift mode change while a shift is open, and keeps a vault that still holds cash', () => {
    const p = parseProfile(base({ stores: [store({ shiftMode: 'staff', vaultEnabled: false })] })).profile;
    const plan = planImport(p, emptyInput({ stores: [existingStore({ openShifts: 1, vaultBalance: 500, values: { vaultEnabled: true } }) as any] }));
    expect(plan.blockers.join(' ')).toMatch(/shift open/);
    expect(plan.warnings.join(' ')).toMatch(/vault still holds Rs 500/);
  });

  it('blocks more stores or logins than the plan allows; Counter and Personal logins are free', () => {
    const p = parseProfile(base({
      stores: [store(), store({ name: 'B' })],
      staff: [{ email: 'a@x.in', fullName: 'A', role: 'Sales Staff', stores: ['B'] }, { email: 'c@x.in', fullName: 'C', role: 'Counter', stores: ['B'] }],
    })).profile;
    const plan = planImport(p, emptyInput({ roomLeft: { stores: 1, users: 1 } }));
    expect(plan.blockers.length).toBe(1);
    expect(plan.blockers[0]).toMatch(/room for 1 more store/);
  });

  it('accepts 0 as the last day of the month, and refuses to guess between two stores with the same name', () => {
    const ok = parseProfile(base({ stores: [store({ depositSchedule: 'monthly', depositMonthDays: [0, 1, 15] })] }));
    expect(ok.errors).toEqual([]);
    const plan = planImport(ok.profile, emptyInput({ stores: [existingStore() as any, existingStore({ id: 11 }) as any] }));
    expect(plan.blockers.join(' ')).toMatch(/More than one store here is called "Anna Nagar"/);
  });

  it('only sets a default opener who works at that store', () => {
    const p = parseProfile(base({ stores: [store({ shifts: [{ name: 'Day', startTime: '09:00', endTime: '17:00', defaultOpener: 'a@x.in' }, { name: 'Night', startTime: '17:00', endTime: '23:00', defaultOpener: 'z@x.in' }] })] })).profile;
    const plan = planImport(p, emptyInput({ stores: [existingStore() as any], users: [user()] }));
    expect(plan.stores[0].shifts[0].opener).toBe('a@x.in');
    expect(plan.stores[0].shifts[1].opener).toBeUndefined();
    expect(plan.warnings.join(' ')).toMatch(/z@x.in/);
  });
});

describe('tempPassword', () => {
  it('is 10 characters with a capital, a small letter and a digit, and no look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const p = tempPassword();
      expect(p).toMatch(/^[A-Za-z0-9]{10}$/);
      expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[0OIl1]/);
    }
  });
  it('differs from one call to the next', () => {
    expect(new Set(Array.from({ length: 50 }, () => tempPassword())).size).toBe(50);
  });
});

describe('Excel round trip', () => {
  it('a profile written to a workbook reads back as the same profile', async () => {
    const original = parseProfile(base({
      business: { name: 'Acme', phone: '044 1234567', billShowMrp: true, businessType: 'pharmacy' },
      stores: [store({ depositSchedule: 'weekly', depositWeekdays: [1, 4], floatDenominations: [{ d: 500, n: 2 }], vaultEnabled: true, shifts: [{ name: 'Day', startTime: '09:00', endTime: '17:00', active: true, defaultOpener: 'a@x.in' }] }), store({ name: 'T Nagar, East' })],
      staff: [{ email: 'a@x.in', fullName: 'A', role: 'Sales Staff', stores: ['Anna Nagar', 'T Nagar, East'] }],
    })).profile;
    const buf = await profileToWorkbook(original, ['Sales Staff', 'Store Head']);
    const back = parseProfile(await workbookToProfile(buf));
    expect(back.errors).toEqual([]);
    expect(back.profile.business).toEqual(original.business);
    expect(back.profile.stores).toEqual(original.stores);
    expect(back.profile.staff).toEqual(original.staff);
  });

  it('reads the empty template as an empty profile, and refuses a file that is not a workbook', async () => {
    const empty = await profileToWorkbook({ format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION }, []);
    expect(parseProfile(await workbookToProfile(empty)).errors).toEqual([]);
    await expect(workbookToProfile(Buffer.from('not a workbook'))).rejects.toThrow(/not an Excel/);
  });
});
