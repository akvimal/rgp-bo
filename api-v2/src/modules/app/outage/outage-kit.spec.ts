import { procedureFor, PROCEDURE } from './outage-kit';
import { daysSince, isReady, KIT_CHECKLIST, recordItems } from './outage-kit';

describe('outage kit', () => {
  it('lists every item with its wording, and says whether all are ticked', () => {
    const all = Object.fromEntries(KIT_CHECKLIST.map((i) => [i.key, true]));
    const full = recordItems(all);
    expect(full.items).toHaveLength(KIT_CHECKLIST.length);
    expect(full.complete).toBe(true);
    expect(full.items[0].label).toBe(KIT_CHECKLIST[0].label);

    const partial = recordItems({ ...all, light: false });
    expect(partial.complete).toBe(false);
    expect(partial.items.find((i) => i.key === 'light')!.ticked).toBe(false);
  });

  it('treats nothing ticked, unknown keys and odd values as not ticked', () => {
    expect(recordItems(undefined).complete).toBe(false);
    expect(recordItems({ made_up: true }).items.every((i) => !i.ticked)).toBe(true);
    expect(recordItems({ light: 'yes' }).items.find((i) => i.key === 'light')!.ticked).toBe(false);
    expect(recordItems({ light: 'true' }).items.find((i) => i.key === 'light')!.ticked).toBe(true);
  });

  it('counts whole days, never below zero', () => {
    expect(daysSince('2026-10-20', '2026-10-24')).toBe(4);
    expect(daysSince('2026-10-24T09:00:00.000Z', '2026-10-24')).toBe(0);
    expect(daysSince('2026-10-30', '2026-10-24')).toBe(0);
    expect(daysSince(null, '2026-10-24')).toBeNull();
  });

  it('is ready when last checked completely within the week', () => {
    expect(isReady('2026-10-20', '2026-10-24')).toBe(true);
    expect(isReady('2026-10-17', '2026-10-24')).toBe(false);     // 7 days ago
    expect(isReady(null, '2026-10-24')).toBe(false);
  });

  it('leaves the pharmacy steps out of the outage procedure for a business that is not a pharmacy', () => {
    const all = procedureFor(true).flatMap((p) => p.steps);
    const other = procedureFor(false).flatMap((p) => p.steps);
    expect(all.length).toBe(PROCEDURE.flatMap((p) => p.steps).length);
    expect(other.length).toBe(all.length - 2);
    expect(other.join(' ')).not.toMatch(/medicine|prescription|Rx/i);
    expect(other.join(' ')).toMatch(/bill book/);
  });
});
