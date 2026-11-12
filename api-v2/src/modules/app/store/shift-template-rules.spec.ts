import { distanceToWindow, minutesOf, suggestTemplate } from './shift-template-rules';

const t = (id: number, name: string, starttime: string, endtime: string) => ({ id, name, starttime, endtime });
const MORNING = t(1, 'Morning', '09:00', '14:00');
const EVENING = t(2, 'Evening', '14:00', '22:00');
const at = (hhmm: string) => minutesOf(hhmm) as number;

describe('which shift template fits now', () => {
  it('reads times and refuses anything else', () => {
    expect(minutesOf('09:30')).toBe(570);
    expect(minutesOf('9:05')).toBe(545);
    expect(minutesOf('')).toBeNull();
    expect(minutesOf('25:00')).toBeNull();
    expect(minutesOf(null)).toBeNull();
  });

  it('picks the window that holds the time', () => {
    const p = suggestTemplate([MORNING, EVENING], at('10:15'))!;
    expect(p.template.name).toBe('Morning');
    expect(p.within).toBe(true);
    expect(p.distance).toBe(0);
    expect(suggestTemplate([MORNING, EVENING], at('17:00'))!.template.name).toBe('Evening');
  });

  it('opening later than planned still matches within the 2 hour tolerance', () => {
    const early = suggestTemplate([MORNING], at('07:30'))!;            // 90 minutes before the window
    expect(early.template.name).toBe('Morning');
    expect(early.within).toBe(true);
    expect(suggestTemplate([MORNING], at('15:30'))!.within).toBe(true);   // 90 minutes after it ended
  });

  it('beyond the tolerance it still offers the nearest one, marked as not within', () => {
    const p = suggestTemplate([MORNING], at('18:00'))!;                   // 4 hours after the window
    expect(p.template.name).toBe('Morning');
    expect(p.within).toBe(false);
    expect(p.distance).toBe(240);
  });

  it('at the boundary of two windows the earlier one wins a tie', () => {
    expect(suggestTemplate([EVENING, MORNING], at('14:00'))!.template.name).toBe('Morning');
  });

  it('handles a window that runs past midnight, in the evening and in the small hours', () => {
    const night = t(3, 'Night', '22:00', '06:00');
    expect(distanceToWindow(at('23:00'), 22 * 60, 6 * 60)).toBe(0);
    expect(distanceToWindow(at('02:00'), 22 * 60, 6 * 60)).toBe(0);
    expect(distanceToWindow(at('12:00'), 22 * 60, 6 * 60)).toBe(360);     // 6 hours after it ends
    expect(suggestTemplate([MORNING, night], at('01:00'))!.template.name).toBe('Night');
  });

  it('offers a single template whatever the time, and nothing when there is none or the times are unusable', () => {
    expect(suggestTemplate([MORNING], at('03:00'))!.template.name).toBe('Morning');
    expect(suggestTemplate([], at('10:00'))).toBeNull();
    expect(suggestTemplate([t(9, 'Broken', 'x', 'y')], at('10:00'))).toBeNull();
  });
});
