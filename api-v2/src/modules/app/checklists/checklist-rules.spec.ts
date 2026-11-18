import { cleanItems, daysSince, defaultList, DEFAULT_CHECKLISTS, isCurrent, procedureFor, recordRun } from './checklist-rules';
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
