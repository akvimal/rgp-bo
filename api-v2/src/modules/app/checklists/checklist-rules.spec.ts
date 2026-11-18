import { cleanItems, cleanOrder, DEFAULT_SCHEDULE, effectiveSchedule, everyOf, scheduleLabel, scheduleProblem, daysSince, defaultList, DEFAULT_CHECKLISTS, isCurrent, orderLists, procedureFor, recordRun } from './checklist-rules';
import { dayProblem, effectiveSetting, SYSTEM_TASKS, systemTask } from './system-tasks';

describe('checklist items', () => {
  it('ships the outage list with the price list item automatic', () => {
    const l = defaultList('outage_readiness')!;
    expect(l.items.length).toBe(9);
    expect(l.items.find((i) => i.key === 'price_list')!.auto).toBe('price_list');
    expect(new Set(DEFAULT_CHECKLISTS.map((d) => d.key)).size).toBe(DEFAULT_CHECKLISTS.length);
  });

  it('cleans an edited list: trims, keys the new ones, drops duplicate keys', () => {
    const r = cleanItems([{ key: 'a', label: ' One ' }, { key: 'a', label: 'Two' }, { label: 'Three', kind: 'text' }]);
    expect(r.problem).toBeNull();
    expect(r.items.map((i) => i.label)).toEqual(['One', 'Two', 'Three']);
    expect(new Set(r.items.map((i) => i.key)).size).toBe(3);
    expect(r.items[2].kind).toBe('text');
  });

  it('refuses an empty list, an empty item and a long list', () => {
    expect(cleanItems([]).problem).toBeTruthy();
    expect(cleanItems([{ label: '  ' }]).problem).toBeTruthy();
    expect(cleanItems(Array.from({ length: 41 }, (_, i) => ({ label: 'x' + i }))).problem).toBeTruthy();
  });
});

describe('recording a run', () => {
  const list = defaultList('outage_readiness')!.items;
  it('is complete only when every item is done; a text item needs its text; an automatic one is the system\'s word', () => {
    const ticks = Object.fromEntries(list.map((i) => [i.key, true]));
    expect(recordRun(list, ticks, { bill_book: 'M-12' }, { price_list: true }).complete).toBe(true);
    expect(recordRun(list, ticks, {}, { price_list: true }).complete).toBe(false);
    expect(recordRun(list, ticks, { bill_book: 'M-12' }, { price_list: false }).complete).toBe(false);
    const r = recordRun(list, { ...ticks, light: false }, { bill_book: 'M-12' }, { price_list: true });
    expect(r.complete).toBe(false);
    expect(r.items.find((i) => i.key === 'light')!.ticked).toBe(false);
    expect(r.items.find((i) => i.key === 'bill_book')!.value).toBe('M-12');
  });
  it('ignores keys not on the list', () => {
    expect(recordRun([{ key: 'a', label: 'A', kind: 'tick' }], { a: 'true', zzz: true }, {}).items).toHaveLength(1);
  });
});

describe('currency', () => {
  it('a weekly list is current for six days after a full run', () => {
    expect(daysSince('2026-11-10', '2026-11-18')).toBe(8);
    expect(isCurrent('WEEKLY', '2026-11-12', '2026-11-18')).toBe(true);
    expect(isCurrent('WEEKLY', '2026-11-11', '2026-11-18')).toBe(false);
    expect(isCurrent('WEEKLY', null, '2026-11-18')).toBe(false);
  });
  it('the procedure drops the pharmacy steps for another business', () => {
    const all = procedureFor(true).flatMap((p) => p.steps).length;
    expect(procedureFor(false).flatMap((p) => p.steps).length).toBe(all - 2);
  });
});

describe('system tasks', () => {
  it('has unique keys, valid days, and links into the app', () => {
    expect(new Set(SYSTEM_TASKS.map((t) => t.key)).size).toBe(SYSTEM_TASKS.length);
    for (const t of SYSTEM_TASKS) {
      expect(dayProblem(t, t.day)).toBeNull();
      expect(t.link.startsWith('/secure/')).toBe(true);
    }
  });
  it('a store setting beats the business one, which beats the default', () => {
    const t = systemTask('price_list')!;
    expect(effectiveSetting(t, undefined, undefined)).toEqual({ enabled: true, day: t.day });
    expect(effectiveSetting(t, undefined, { enabled: false, day: 3 })).toEqual({ enabled: false, day: 3 });
    expect(effectiveSetting(t, { enabled: true, day: 5 }, { enabled: false, day: 3 })).toEqual({ enabled: true, day: 5 });
    expect(effectiveSetting(t, { enabled: true, day: null }, { enabled: true, day: 3 })).toEqual({ enabled: true, day: 3 });
  });
  it('checks the day against the cadence', () => {
    expect(dayProblem(systemTask('price_list')!, 9)).toBeTruthy();
    expect(dayProblem(systemTask('stock_count')!, 0)).toBeNull();
    expect(dayProblem(systemTask('stock_count')!, 32)).toBeTruthy();
  });
});

describe('the order of the checklists', () => {
  const lists = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
  it('follows the saved order, then any list the order does not name', () => {
    expect(orderLists(lists, ['c', 'a']).map((l) => l.key)).toEqual(['c', 'a', 'b', 'd']);
    expect(orderLists(lists, null).map((l) => l.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(orderLists(lists, []).map((l) => l.key)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores a key that no longer exists and a key named twice', () => {
    expect(orderLists(lists, ['zzz', 'd', 'd', 'b']).map((l) => l.key)).toEqual(['d', 'b', 'a', 'c']);
  });
  it('cleans an order asked for: known keys once each, the rest kept at the end', () => {
    expect(cleanOrder([' d ', 'x', 'a', 'd'], ['a', 'b', 'c', 'd'])).toEqual({ keys: ['d', 'a', 'b', 'c'], problem: null });
    expect(cleanOrder([], ['a']).problem).toBeTruthy();
    expect(cleanOrder('a', ['a']).problem).toBeTruthy();
    expect(cleanOrder(['x', 'y'], ['a']).problem).toBeTruthy();
  });
});

describe('when a checklist is done', () => {
  it('ships daily opening and closing, weekly outage readiness and monthly housekeeping; a list of your own is not scheduled', () => {
    expect(effectiveSchedule('opening').schedule).toEqual({ cadence: 'DAILY', day: null, time: '09:00' });
    expect(effectiveSchedule('closing').schedule.time).toBe('21:00');
    expect(effectiveSchedule('outage_readiness').schedule).toMatchObject({ cadence: 'WEEKLY', day: 1 });
    expect(effectiveSchedule('monthly_housekeeping').schedule).toMatchObject({ cadence: 'MONTHLY', day: 5 });
    expect(effectiveSchedule('c_my_list')).toEqual({ schedule: { cadence: 'NONE', day: null, time: '09:00' }, source: 'default' });
    expect(Object.keys(DEFAULT_SCHEDULE)).toHaveLength(4);
  });

  it('a store beats the business, which beats the shipped schedule', () => {
    const own = { cadence: 'EACH_SHIFT', day: null, at_time: '09:00' }, wide = { cadence: 'WEEKLY', day: 3, at_time: '10:30' };
    expect(effectiveSchedule('opening', own, wide)).toMatchObject({ source: 'store', schedule: { cadence: 'EACH_SHIFT' } });
    expect(effectiveSchedule('opening', null, wide)).toMatchObject({ source: 'business', schedule: { cadence: 'WEEKLY', day: 3, time: '10:30' } });
    expect(effectiveSchedule('opening', null, null).source).toBe('default');
    // a switched-off row is a schedule too: it beats the shipped one
    expect(effectiveSchedule('opening', { cadence: 'NONE', day: null, at_time: '09:00' }, null).schedule.cadence).toBe('NONE');
  });

  it('a weekly or monthly row with no day follows the day the list is shipped with', () => {
    expect(effectiveSchedule('outage_readiness', { cadence: 'WEEKLY', day: null, at_time: null }, null).schedule).toMatchObject({ day: 1, time: '09:00' });
    expect(effectiveSchedule('monthly_housekeeping', { cadence: 'MONTHLY', day: null, at_time: null }, null).schedule.day).toBe(5);
    expect(effectiveSchedule('c_x', { cadence: 'MONTHLY', day: null, at_time: null }, null).schedule.day).toBe(1);
  });

  it('checks a schedule asked for', () => {
    expect(scheduleProblem('DAILY', null, '09:30')).toBeNull();
    expect(scheduleProblem('NONE', null, null)).toBeNull();
    expect(scheduleProblem('EACH_SHIFT', null, null)).toBeNull();
    expect(scheduleProblem('SOMETIMES', null, '09:00')).toBeTruthy();
    expect(scheduleProblem('WEEKLY', null, '09:00')).toBeTruthy();                       // needs a weekday
    expect(scheduleProblem('WEEKLY', 7, '09:00')).toBeTruthy();
    expect(scheduleProblem('MONTHLY', 32, '09:00')).toBeTruthy();
    expect(scheduleProblem('MONTHLY', 0, '09:00')).toBeNull();                           // the last day
    expect(scheduleProblem('DAILY', null, '25:00')).toBeTruthy();
    expect(scheduleProblem('DAILY', null, '9:30')).toBeTruthy();
  });

  it('says it in words, and sets how long a run counts as current', () => {
    expect(scheduleLabel({ cadence: 'NONE', day: null, time: '09:00' })).toBe('Not scheduled');
    expect(scheduleLabel({ cadence: 'EACH_SHIFT', day: null, time: '09:00' })).toBe('Every shift');
    expect(scheduleLabel({ cadence: 'DAILY', day: null, time: '21:00' })).toBe('Daily at 21:00');
    expect(scheduleLabel({ cadence: 'WEEKLY', day: 1, time: '09:00' })).toBe('Every Monday at 09:00');
    expect(scheduleLabel({ cadence: 'MONTHLY', day: 5, time: '09:00' })).toBe('Monthly on the 5th at 09:00');
    expect(scheduleLabel({ cadence: 'MONTHLY', day: 0, time: '09:00' })).toBe('Monthly on the last day at 09:00');
    expect(scheduleLabel({ cadence: 'MONTHLY', day: 22, time: '09:00' })).toBe('Monthly on the 22nd at 09:00');
    expect(scheduleLabel({ cadence: 'MONTHLY', day: 11, time: '09:00' })).toBe('Monthly on the 11th at 09:00');
    expect(everyOf('EACH_SHIFT', 'WEEKLY')).toBe('DAILY');
    expect(everyOf('NONE', 'MONTHLY')).toBe('MONTHLY');
  });
});
